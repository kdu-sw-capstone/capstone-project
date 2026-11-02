import datetime,importlib.util,json,pathlib,tempfile,types,unittest
from unittest.mock import Mock,patch

path=pathlib.Path(__file__).resolve().parents[1]/'installer/native_setup.py'
spec=importlib.util.spec_from_file_location('native_setup_tests',path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class SyntheticLockCustody:
 """Contract-order double ONLY: no Windows sharing/handle claim.
 Windows protection is covered separately using the real implementation.
 """
 def __init__(self,path,expected):self.path=path;self.expected=expected
 def __enter__(self):self.check();return self
 def check(self):m._need(m._file(self.path)==self.expected,'SYNTHETIC_LOCK_CHANGED')
 def archive(self,target):
  self.check();m._need(not target.exists(),'SYNTHETIC_ARCHIVE_COLLISION')
  self.path.rename(target);self.path=target;self.check()
 def remove(self):self.check();self.path.unlink()
 def __exit__(self,*args):pass

def synthetic_custody_on_nonwindows(case):
 if m.os.name!='nt':
  q=patch.object(m,'_LockCustody',SyntheticLockCustody);q.start();case.addCleanup(q.stop)

class ProductNativeSetupTests(unittest.TestCase):
 def setUp(self):
  synthetic_custody_on_nonwindows(self)
  self.tmp=tempfile.TemporaryDirectory();self.p=pathlib.Path(self.tmp.name)/('1'*32);self.p.mkdir()
  self.r={'id':'1'*32,'extensionId':'a'*32,'status':'INSTALLED','config':{'browserMode':'regular_manual','webPort':28453,'mysqlPort':28454}}
  actor=patch.object(m,'_actor',return_value={'ProcessId':m.os.getpid(),'CreationDate':'fixture','ExecutablePath':'fixture-python'});actor.start();self.addCleanup(actor.stop)
  snapshot=patch.object(m,'_snapshot',side_effect=lambda core,p:(self.r,{'sid':'S-1-5-21-1'}));snapshot.start();self.addCleanup(snapshot.stop)
  self.c=Mock();self.c.owned_record.return_value=self.r
  def require(ok,code):
   if not ok:raise RuntimeError(code)
  self.c.require.side_effect=require
  self.c.browser_arguments.return_value=['chrome.exe','--user-data-dir='+str(self.p/'profile'),'chrome://extensions/']
  self.c.run.return_value=types.SimpleNamespace(stdout=str(4*1024**3))
  self.c.write.side_effect=lambda p,v:p.write_text(json.dumps(v))
 def tearDown(self):self.tmp.cleanup()
 def test_no_approval_no_files_no_process(self):
  with self.assertRaisesRegex(RuntimeError,'APPROVAL'):m.connect(self.c,self.p)
  self.assertEqual(list(self.p.iterdir()),[]);self.c.spawn_owned.assert_not_called()
 def test_all_installed_launchers_retained_in_registered_payload(self):
  import hashlib
  names=['Start-FOCURVE.cmd','Stop-FOCURVE.cmd','Dashboard.url','Connect-FOCURVE.cmd']
  for name in names:(self.p/name).write_bytes(name.encode())
  rows=m.launcher_payload(self.p)
  self.assertEqual({x['path'] for x in rows},set(names))
  self.assertTrue(all(x['sha256']==hashlib.sha256(x['path'].encode()).hexdigest() for x in rows))
 def test_absent_optional_launcher_is_not_invented(self):
  self.assertEqual(m.launcher_payload(self.p),[])
 def test_installed_command_uses_fixed_grant_and_same_browser_no_services(self):
  with patch.object(m,'main') as registrar:
   result=m.connect(self.c,self.p,15,True)
  self.assertEqual(self.c.spawn_owned.call_count,1)
  self.assertEqual(self.c.spawn_owned.call_args.args[2],'chrome')
  self.assertFalse(result['servicesStarted']);self.assertEqual(result['focusAdmission'],'CLOSED')
  self.assertEqual(result['productPage'],'chrome-extension://'+'a'*32+'/native-link/index.html')
  args=registrar.call_args.args[0];self.assertEqual(args[args.index('--not-after')+1],result['notAfterUTC'])
  self.assertFalse((self.p/'native-setup.lock').exists())
 def test_old_hold_and_configured_install_rejected_without_changes(self):
  for status in ['PRODUCT_HOLD_PRESERVED','ACCEPTANCE_HOLD_PRESERVED','STOPPED']:
   self.r['status']=status
   with self.subTest(status=status),self.assertRaises(RuntimeError):m.connect(self.c,self.p,15,True)
  self.c.spawn_owned.assert_not_called();self.assertEqual(list(self.p.iterdir()),[])
 def test_registration_failure_preserves_scope_and_lock_no_second_attempt(self):
  with patch.object(m,'main',side_effect=RuntimeError('REGISTRATION_FAILED')):
   with self.assertRaisesRegex(RuntimeError,'REGISTRATION_FAILED'):m.connect(self.c,self.p,15,True)
  self.assertTrue((self.p/'native-setup.lock').exists())
  self.assertTrue((self.p/'manual-setup-scope.json').exists())
  with self.assertRaisesRegex(RuntimeError,'ALREADY_ACTIVE'):m.connect(self.c,self.p,15,True)
  self.assertEqual(self.c.spawn_owned.call_count,1)
 def test_low_ram_blocks_before_browser(self):
  self.c.run.return_value.stdout=str(3*1024**3-1)
  with self.assertRaisesRegex(RuntimeError,'RAM_BELOW'):m.connect(self.c,self.p,15,True)
  self.c.spawn_owned.assert_not_called()
 def test_debugging_argument_rejected(self):
  self.c.browser_arguments.return_value.insert(1,'--remote-debugging-port=9222')
  with self.assertRaisesRegex(RuntimeError,'MANUAL_BROWSER_ONLY'):m.connect(self.c,self.p,15,True)
  self.c.spawn_owned.assert_not_called()
 def test_fixed_deadline_not_extended(self):
  deadline=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=5)).isoformat()
  with patch.object(m,'main') as registrar:r=m.connect(self.c,self.p,15,True,deadline)
  self.assertEqual(r['notAfterUTC'],deadline)
 def test_expired_deadline_blocks_before_browser(self):
  with self.assertRaisesRegex(RuntimeError,'TIME_INSUFFICIENT'):m.connect(self.c,self.p,15,True,'2020-01-01T00:00:00+00:00')
  self.c.spawn_owned.assert_not_called()
 def test_port_conflict_does_not_launch_or_change_port(self):
  self.c.port_available.side_effect=RuntimeError('PORT_CONFLICT')
  with self.assertRaisesRegex(RuntimeError,'PORT_CONFLICT'):m.connect(self.c,self.p,15,True)
  self.assertEqual(self.r['config']['webPort'],28453);self.c.spawn_owned.assert_not_called()
 def test_connection_launcher_is_covered_by_installed_integrity_check(self):
  import hashlib
  corepath=path.parent/'install_core.py'
  spec=importlib.util.spec_from_file_location('integrity_setup_test',corepath)
  core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
  command=self.p/'Connect-FOCURVE.cmd';command.write_bytes(b'approved command')
  record={'payload':[{'path':command.name,'sha256':hashlib.sha256(command.read_bytes()).hexdigest()}]}
  core.verify_installed_payload(self.p,record)
  command.write_bytes(b'changed command')
  with self.assertRaisesRegex(core.InstallError,'INSTALLED_FILE_CHANGED'):
   core.verify_installed_payload(self.p,record)
 def test_fresh_user_mode_is_explicit_bounded_and_does_not_start_services(self):
  with patch.object(m,'main') as registrar:r=m.connect(self.c,self.p,60,True,user_session=True)
  self.assertTrue(r['userSessionEnabled']);self.assertFalse(r['servicesStarted'])
  self.assertIn('--user-session',registrar.call_args.args[0]);self.assertEqual(self.c.spawn_owned.call_count,1)
 def test_probe_grant_cannot_silently_become_sixty_minute_user_mode(self):
  with self.assertRaisesRegex(RuntimeError,'APPROVAL'):m.connect(self.c,self.p,60,True)
  self.c.spawn_owned.assert_not_called();self.assertEqual(list(self.p.iterdir()),[])
 def test_short_user_mode_window_is_rejected_before_browser(self):
  with self.assertRaisesRegex(RuntimeError,'APPROVAL'):m.connect(self.c,self.p,15,True,user_session=True)
  self.c.spawn_owned.assert_not_called()
 def test_user_mode_preserves_fixed_deadline_instead_of_extending_it(self):
  end=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=21)).isoformat()
  with patch.object(m,'main'):r=m.connect(self.c,self.p,60,True,end,user_session=True)
  self.assertEqual(r['notAfterUTC'],end)
 def test_user_mode_grant_has_no_automatic_focus_or_recovery_authority(self):
  g=m.grant_fields(True);self.assertEqual(g['scope'],'USER_UI_SERVICES_AND_SAFE_STOP')
  self.assertFalse(g['focusSTART_END']);self.assertFalse(g['automaticFocusCommands'])
 def test_new_explicit_user_grant_can_use_normally_stopped_installation(self):
  self.r['status']='STOPPED';self.r['nativeLink']={'hostName':'owned'}
  with patch.object(m,'_renew_stopped',return_value={'servicesStarted':False}) as renew,patch.object(m,'_connect_fresh') as fresh:
   result=m.connect(self.c,self.p,60,True,user_session=True)
  renew.assert_called_once();fresh.assert_not_called();self.assertFalse(result['servicesStarted'])
  self.assertFalse((self.p/'native-setup.lock').exists())
 def test_preserved_failure_can_never_enter_normal_renewal(self):
  self.r.update(status='PRODUCT_HOLD_PRESERVED',nativeLink={'hostName':'owned'})
  with patch.object(m,'_renew_stopped') as renew,self.assertRaises(RuntimeError):m.connect(self.c,self.p,60,True,user_session=True)
  renew.assert_not_called();self.assertEqual(list(self.p.iterdir()),[])


RealDatabaseLease=m._DatabaseLease

class RestrictedNativeResumeTests(unittest.TestCase):
 def setUp(self):
  synthetic_custody_on_nonwindows(self)
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.p=pathlib.Path(self.tmp.name)/('2'*32);self.p.mkdir()
  self.r={'id':'2'*32,'extensionId':'b'*32,'status':'INSTALLED','payload':[], 'config':{'browserMode':'regular_manual','webPort':28581,'mysqlPort':28582}}
  (self.p/'installation.json').write_text(json.dumps(self.r),encoding='utf-8')
  self.c=Mock();self.c.owned_record.side_effect=lambda p:json.loads((p/'installation.json').read_text(encoding='utf-8'))
  self.c.base_env.return_value={};self.c.require.side_effect=m._need;self.c.run.return_value=types.SimpleNamespace(stdout='0')
  self.c.browser_arguments.return_value=['chrome.exe','--user-data-dir='+str(self.p/'profile'),'chrome://extensions/']
  self.c.write.side_effect=lambda p,v:p.write_text(json.dumps(v))
  for name,value in [('_actor',{'ProcessId':m.os.getpid(),'CreationDate':'fixture','ExecutablePath':'fixture-python'}),('_sid','S-1-5-21-123'),('_owner_sid','S-1-5-21-123'),('_registry_absent',None),('_process_absent',None)]:
   q=patch.object(m,name,return_value=value);q.start();self.addCleanup(q.stop)
  class FakeLease:
   def __init__(self,p):self.p=p;self.live=False;self.fingerprint=[['fixture-db',1,1,1]]
   def __enter__(self):self.live=True;return self
   def validate(self):m._need(self.live,'LEASE_LOST')
   def __exit__(self,*exc):self.live=False
  q=patch.object(m,'_DatabaseLease',FakeLease);q.start();self.addCleanup(q.stop)
  self.end=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=40)).isoformat()
 def fail_before_effect(self):
  # Real connect/pre-effect checks, mocked only host observations: low RAM.
  with self.assertRaisesRegex(RuntimeError,'RAM_BELOW'):m.connect(self.c,self.p,60,True,self.end,True)
  self.c.spawn_owned.assert_not_called()
  return m.resume_plan(self.c,self.p)
 def execute(self,plan):return m.resume(self.c,self.p,m._digest(plan),60,self.end,True,True)
 def test_iso_validation_is_before_all_files_and_observations(self):
  before=list(self.p.iterdir())
  for value in ['11/02/2026 20:55:44','2026-11-02','2026-11-02T10:00:00','2026-13-02T10:00:00Z','2020-01-01T00:00:00Z',datetime.datetime.now()]:
   with self.subTest(value=str(value)),self.assertRaises(RuntimeError):m.connect(self.c,self.p,60,True,value,True)
   self.assertEqual(list(self.p.iterdir()),before)
  short=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=2)).isoformat()
  with self.assertRaisesRegex(RuntimeError,'TIME_INSUFFICIENT'):m.connect(self.c,self.p,60,True,short,True)
  self.c.owned_record.assert_not_called();self.c.spawn_owned.assert_not_called()
  self.assertEqual(m.deadline(60,self.end,True),self.end)
 def test_empty_legacy_lock_cannot_be_retroactively_blessed(self):
  (self.p/'native-setup.lock').touch()
  with self.assertRaises((ValueError,RuntimeError)):m.resume_plan(self.c,self.p)
 def test_pre_effect_failure_plan_pins_original_evidence_and_no_mutations(self):
  plan=self.fail_before_effect();lock=(self.p/'native-setup.lock').read_bytes()
  self.assertEqual(plan['binding']['sid'],'S-1-5-21-123')
  self.assertEqual(m.resume_plan(self.c,self.p),plan)
  self.assertEqual((self.p/'native-setup.lock').read_bytes(),lock)
 def test_successful_resume_archives_raw_lock_and_failure(self):
  plan=self.fail_before_effect();lock=(self.p/'native-setup.lock').read_bytes();folder=self.p/'native-setup-attempts'/plan['attemptId'];failure=(folder/'failure.json').read_bytes()
  with patch.object(m,'_connect_fresh',return_value={'servicesStarted':False}) as fresh:r=self.execute(plan)
  self.assertFalse(r['servicesStarted']);fresh.assert_called_once()
  self.assertEqual((folder/'archive/original.lock').read_bytes(),lock)
  self.assertEqual((folder/'archive/failure.json').read_bytes(),failure)
  self.assertEqual((folder/'failure.json').read_bytes(),failure)
  self.assertFalse((self.p/'native-setup.lock').exists());self.assertFalse((self.p/'native-resume.pending').exists())
  with self.assertRaises((RuntimeError,FileNotFoundError)):self.execute(plan)
 def test_wrong_sid_owner_install_extension_payload_and_lock_rejected(self):
  plan=self.fail_before_effect()
  for name in ['_sid','_owner_sid']:
   with patch.object(m,name,return_value='S-1-5-21-999'),self.assertRaises(RuntimeError):self.execute(plan)
  original=(self.p/'installation.json').read_bytes()
  for field,value in [('id','3'*32),('extensionId','c'*32),('payload',[{'path':'changed','sha256':'0'*64}])]:
   row=dict(self.r);row[field]=value;(self.p/'installation.json').write_text(json.dumps(row),encoding='utf-8')
   with self.assertRaises(RuntimeError):self.execute(plan)
   (self.p/'installation.json').write_bytes(original)
  with (self.p/'native-setup.lock').open('ab') as f:f.write(b' ')
  with self.assertRaises(RuntimeError):self.execute(plan)
 def test_missing_or_uncertain_failure_evidence_rejected(self):
  plan=self.fail_before_effect();folder=self.p/'native-setup-attempts'/plan['attemptId'];f=folder/'failure.json';raw=f.read_bytes();f.unlink()
  with self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
  f.write_bytes(raw);value=json.loads(raw);value['phase']='EFFECT_UNCONFIRMED';f.write_text(json.dumps(value),encoding='utf-8')
  with self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
 def test_all_partial_artifacts_obligations_and_registration_reject(self):
  self.fail_before_effect()
  for name in ['profile','control/native-link','native-setup-staging','manual-setup-scope.json','chrome-process.json','server-process.json','STOP','admission.ready','product-runtime.lock']:
   q=self.p/name;q.parent.mkdir(parents=True,exist_ok=True);q.touch()
   with self.subTest(name=name),self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
   q.unlink()
  with patch.object(m,'_registry_absent',side_effect=RuntimeError('REGISTRATION_PRESENT')),self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
  folder=next((self.p/'native-setup-attempts').iterdir());staging=pathlib.Path(json.loads((folder/'attempt.json').read_text())['staging']);staging.mkdir(parents=True)
  with self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
 def test_running_process_or_port_conflict_rejects_without_stop(self):
  self.fail_before_effect()
  with patch.object(m,'_process_absent',side_effect=RuntimeError('LIVE')),self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
  self.c.port_available.side_effect=RuntimeError('PORT_IN_USE')
  with self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
  self.c.spawn_owned.assert_not_called()
 def test_guard_serializes_connect_and_resume(self):
  plan=self.fail_before_effect()
  with m._Guard(self.p):
   with self.assertRaisesRegex(RuntimeError,'GUARD_PRESENT'):self.execute(plan)
   with self.assertRaisesRegex(RuntimeError,'GUARD_PRESENT'):m.connect(self.c,self.p,60,True,self.end,True)
  self.c.spawn_owned.assert_not_called()
 def test_state_change_between_plan_and_execution_rejects(self):
  plan=self.fail_before_effect();original=m.resume_plan;calls=0
  def changing(*args,**kwargs):
   nonlocal calls
   calls+=1
   if calls==2:(self.p/'profile').mkdir()
   return original(*args,**kwargs)
  with patch.object(m,'resume_plan',side_effect=changing),self.assertRaises(RuntimeError):self.execute(plan)
  self.assertTrue((self.p/'native-setup.lock').exists());self.c.spawn_owned.assert_not_called()
 def test_archive_failure_keeps_lock_and_blocks_further_attempts(self):
  plan=self.fail_before_effect();raw=(self.p/'native-setup.lock').read_bytes()
  with patch('shutil.copyfile',side_effect=OSError('disk')),self.assertRaises(OSError):self.execute(plan)
  self.assertEqual((self.p/'native-setup.lock').read_bytes(),raw)
  with self.assertRaisesRegex(RuntimeError,'INCOMPLETE'):m.connect(self.c,self.p,60,True,self.end,True)
 def test_failure_after_effect_boundary_never_gets_pre_effect_resume(self):
  self.c.run.return_value.stdout=str(4*1024**3)
  with patch.object(m,'main',side_effect=RuntimeError('REGISTER_FAILED')),self.assertRaises(RuntimeError):m.connect(self.c,self.p,60,True,self.end,True)
  with self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
  f=next((self.p/'native-setup-attempts').glob('*/failure.json'))
  self.assertEqual(json.loads(f.read_text())['phase'],'EFFECT_UNCONFIRMED')
 def test_wrong_plan_hash_and_changed_failure_cannot_resume(self):
  plan=self.fail_before_effect()
  with self.assertRaisesRegex(RuntimeError,'PLAN_CHANGED'):m.resume(self.c,self.p,'0'*64,60,self.end,True,True)
  f=self.p/'native-setup-attempts'/plan['attemptId']/'failure.json';value=json.loads(f.read_text());value['code']='OTHER';f.write_text(json.dumps(value),encoding='utf-8')
  with self.assertRaisesRegex(RuntimeError,'PLAN_CHANGED'):self.execute(plan)
 def test_expired_new_deadline_or_missing_approval_cannot_claim_resume(self):
  plan=self.fail_before_effect()
  for approved,end in [(False,self.end),(True,'2020-01-01T00:00:00Z')]:
   with self.assertRaises(RuntimeError):m.resume(self.c,self.p,m._digest(plan),60,end,approved,True)
  self.assertFalse((self.p/'native-resume.pending').exists())

 def test_real_concurrent_connect_cannot_enter_effect_twice(self):
  import threading,concurrent.futures
  entered=threading.Event();release=threading.Event()
  def held(*args,**kwargs):entered.set();release.wait(3);return {'servicesStarted':False}
  with patch.object(m,'_connect_fresh',side_effect=held),concurrent.futures.ThreadPoolExecutor(2) as pool:
   first=pool.submit(m.connect,self.c,self.p,60,True,self.end,True)
   self.assertTrue(entered.wait(2))
   try:
    with self.assertRaisesRegex(RuntimeError,'GUARD_PRESENT'):m.connect(self.c,self.p,60,True,self.end,True)
   finally:release.set()
   self.assertFalse(first.result()['servicesStarted'])
  self.c.spawn_owned.assert_not_called()
 def test_no_native_issuer_called_for_invalid_original_date(self):
  with patch.object(m,'main') as issuer,self.assertRaisesRegex(RuntimeError,'ISO_REQUIRED'):
   m.connect(self.c,self.p,60,True,'11/02/2026 20:55:44',True)
  issuer.assert_not_called();self.c.spawn_owned.assert_not_called()
 def test_evidence_owner_symlink_and_unknown_process_count_fail_closed(self):
  self.fail_before_effect()
  with patch.object(m,'_owner_sid',side_effect=lambda c,p:'S-1-5-21-999' if p.name=='failure.json' else 'S-1-5-21-123'),self.assertRaises(RuntimeError):m.resume_plan(self.c,self.p)
  self.c.run.return_value.stdout='unknown'
  with self.assertRaisesRegex(RuntimeError,'PROCESS_PRESENT_OR_UNKNOWN'):m.resume_plan(self.c,self.p)

 def test_database_lock_proof_failure_never_archives_or_issues(self):
  plan=self.fail_before_effect();raw=(self.p/'native-setup.lock').read_bytes()
  with patch.object(m,'_DatabaseLease',side_effect=RuntimeError('DB_LOCKED')),self.assertRaisesRegex(RuntimeError,'DB_LOCKED'):self.execute(plan)
  self.assertEqual((self.p/'native-setup.lock').read_bytes(),raw);self.c.spawn_owned.assert_not_called()

 @unittest.skipUnless(m.os.name=='nt','Windows exclusive sharing primitive')
 def test_real_windows_database_lease_only_on_temporary_fixture(self):
  data=self.p/'database';data.mkdir();f=data/'synthetic-ibdata';f.write_bytes(b'fixture')
  with RealDatabaseLease(self.p) as lease:
   lease.validate()
   with self.assertRaises(PermissionError):f.read_bytes()
   (data/'unexpected').write_bytes(b'changed')
   with self.assertRaisesRegex(RuntimeError,'DATABASE_CHANGED'):lease.validate()
  self.assertEqual(f.read_bytes(),b'fixture')

 @unittest.skipUnless(m.os.name=='nt','Windows lock custody')
 def test_p2_archive_boundary_write_is_blocked_and_no_issuer_runs(self):
  plan=self.fail_before_effect();original=m._LockCustody.archive
  def changed(custody,target):
   custody.path.write_bytes(b'changed after last check')
   return original(custody,target)
  with patch.object(m._LockCustody,'archive',changed),patch.object(m,'_connect_fresh',return_value={'servicesStarted':False}) as issue:
   with self.assertRaises(RuntimeError):self.execute(plan)
   issue.assert_not_called()
  self.assertTrue((self.p/'native-setup.lock').exists());self.assertTrue((self.p/'native-resume.pending').exists())
 @unittest.skipUnless(m.os.name=='nt','Windows lock custody')
 def test_p2_success_boundary_write_is_blocked_and_success_not_confirmed(self):
  def changed(*args,**kwargs):
   (self.p/'native-setup.lock').write_bytes(b'foreign changed lock')
   return {'servicesStarted':False}
  with patch.object(m,'_connect_fresh',side_effect=changed),self.assertRaises(RuntimeError):m.connect(self.c,self.p,60,True,self.end,True)
  self.assertTrue((self.p/'native-setup.lock').exists())
  folder=next((self.p/'native-setup-attempts').iterdir());self.assertFalse((folder/'completed.json').exists())
 @unittest.skipUnless(m.os.name=='nt','Windows lock custody')
 def test_pre_acquisition_lock_change_is_rejected_and_preserved(self):
  plan=self.fail_before_effect();original=m._LockCustody.__enter__
  def changed(custody):
   custody.path.write_bytes(b'mutated before handle acquired')
   return original(custody)
  with patch.object(m._LockCustody,'__enter__',changed),patch.object(m,'_connect_fresh') as issue:
   with self.assertRaisesRegex(RuntimeError,'LOCK_CHANGED'):self.execute(plan)
   issue.assert_not_called()
  self.assertEqual((self.p/'native-setup.lock').read_bytes(),b'mutated before handle acquired')
 @unittest.skipUnless(m.os.name=='nt','Windows lock custody')
 def test_same_bytes_replacement_has_different_identity(self):
  f=self.p/'custody';f.write_bytes(b'original');identity=m._file(f);other=self.p/'replacement';other.write_bytes(b'original');m.os.replace(other,f)
  with self.assertRaisesRegex(RuntimeError,'LOCK_CHANGED'):
   with m._LockCustody(f,identity):pass
  self.assertEqual(f.read_bytes(),b'original')
 @unittest.skipUnless(m.os.name=='nt','Windows lock custody')
 def test_handle_preserves_identity_after_archive_and_checks_destination(self):
  f=self.p/'custody';f.write_bytes(b'original');identity=m._file(f);dest=self.p/'archived'
  with m._LockCustody(f,identity) as custody:
   custody.archive(dest);custody.check()
   with self.assertRaises(PermissionError):dest.write_bytes(b'changed')
   replacement=self.p/'other';replacement.write_bytes(b'original')
   with self.assertRaises(PermissionError):m.os.replace(replacement,dest)
  self.assertEqual(m._file(dest),identity)
 @unittest.skipUnless(m.os.name=='nt','Windows lock custody')
 def test_wrong_archived_path_never_allows_resume_issuer(self):
  plan=self.fail_before_effect();original=m._LockCustody.archive
  def changed(custody,target):
   original(custody,target)
   wrong=self.p/'wrong';wrong.write_bytes(b'original-looking');custody.path=wrong;custody.check()
  with patch.object(m._LockCustody,'archive',changed),patch.object(m,'_connect_fresh') as issue:
   with self.assertRaisesRegex(RuntimeError,'IDENTITY_CHANGED'):self.execute(plan)
   issue.assert_not_called()
  self.assertTrue((self.p/'native-resume.pending').exists())


class NonWindowsSecurityBoundaryTests(unittest.TestCase):
 def nonwindows(self):
  original=m.os
  class Platform:
   name='posix'
   def __getattr__(self,key):return getattr(original,key)
  return patch.object(m,'os',Platform())
 def test_production_lock_custody_rejects_nonwindows_before_open(self):
  with self.nonwindows(),patch.object(m.os,'open') as opened:
   with self.assertRaisesRegex(RuntimeError,'LOCK_CUSTODY_UNAVAILABLE'):
    with m._LockCustody(pathlib.Path('unused'),{}):pass
   opened.assert_not_called()
 def test_production_database_lease_rejects_nonwindows(self):
  with self.nonwindows(),self.assertRaisesRegex(RuntimeError,'DATABASE_LOCK_PROOF_UNAVAILABLE'):
   with m._DatabaseLease(pathlib.Path('unused')):pass
 def test_synthetic_double_is_contract_only_and_detects_mutation(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t)/'lock';p.write_bytes(b'fixture');expected=m._file(p)
   with SyntheticLockCustody(p,expected) as custody:
    p.write_bytes(b'changed') # Intentionally permitted: this double is NOT a sharing lock.
    with self.assertRaisesRegex(RuntimeError,'SYNTHETIC_LOCK_CHANGED'):custody.check()
