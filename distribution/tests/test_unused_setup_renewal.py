"""Synthetic files/registry only. No installed profile, credential or DB access."""
import copy,datetime,json,pathlib,shutil,sys,types,unittest
from unittest.mock import MagicMock,patch
import test_session_update as fixture
from test_session_update import m,core,folder,module

native=module('native_setup')

class UnusedSetupRenewalTests(unittest.TestCase):
 def setUp(self):
  fixture.SessionUpdateTests.setUp(self)
  self.r['status']='INSTALLED';self.r['nativeLink'].update(verificationId='v'*32,
   notAfterUTC=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=10)).isoformat())
  (self.p/'last-stop-safety.json').unlink()
  self.binding={'contract':'FOCURVE_NATIVE_BINDING_1','installationId':self.r['id'],
   'extensionId':self.r['extensionId'],'profile':str(self.p/'profile'),'installationPath':str(self.p),
   'verificationId':'v'*32,'allowUserSession':True,'notAfterUTC':self.r['nativeLink']['notAfterUTC']}
  self.grant={'contract':'FOCURVE_USER_SESSION_GRANT_1','scope':'USER_UI_SERVICES_AND_SAFE_STOP',
   'installationId':self.r['id'],'extensionId':self.r['extensionId'],'verificationId':'v'*32,
   'notAfterUTC':self.binding['notAfterUTC']}
  self.host={'name':self.r['nativeLink']['hostName'],'path':str(self.p/'control/native-link/FOCURVE.NativeLink.exe'),
   'type':'stdio','allowed_origins':['chrome-extension://'+self.r['extensionId']+'/']}
  self.setup={'mode':'USER_MANUAL_SETUP_ONLY','installationId':self.r['id'],'servicesStarted':False,'focusAdmission':'CLOSED'}
  self.registry=types.SimpleNamespace(KEY_WOW64_32KEY=1,KEY_WOW64_64KEY=2,KEY_READ=4,HKEY_CURRENT_USER=0,REG_SZ=1,
   OpenKey=MagicMock(),QueryValueEx=MagicMock(return_value=(str(self.p/'control/native-link/native-host.json'),1)))
  self.registry_patch=patch.dict(sys.modules,winreg=self.registry);self.registry_patch.start()
  self.sync()
  self.r['payload']=[{'path':f.relative_to(self.p).as_posix(),'sha256':m.sha(f)} for f in (self.p/'control').rglob('*') if f.is_file()]
  self.sync()
 def sync(self):
  for rel,value in [('control/native-link/binding.json',self.binding),('control/native-link/grant.json',self.grant),
   ('control/native-link/native-host.json',self.host),('manual-setup-scope.json',self.setup),('installation.json',self.r)]:
   p=self.p/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(m.encoded(value))
  self.plan['expectedRecordSHA256']=m.sha(self.p/'installation.json');self.save()
 def save(self):fixture.SessionUpdateTests.save(self)
 def tearDown(self):self.registry_patch.stop();self.tmp.cleanup()
 def snapshot(self):return fixture.SessionUpdateTests.snapshot(self)
 def test_unused_expired_install_is_eligible_without_fabricated_stop_safety(self):
  before=self.snapshot();self.assertEqual(m.eligible(self.c,self.p,True)['status'],'INSTALLED')
  self.assertEqual(before,self.snapshot());self.c.safety_clear.assert_not_called();self.c.sql.assert_not_called()
  self.c.unprotect.assert_not_called();self.c.spawn_owned.assert_not_called()
 def test_original_contract_rejects_identical_unused_fixture(self):
  # Historical regression input is repository-local; never read a developer's installation/output folder.
  oldpath=pathlib.Path(__file__).parent/'fixtures/session_update_before_unused_renewal.py'
  import hashlib
  self.assertEqual(hashlib.sha256(oldpath.read_bytes()).hexdigest(),'67e92d5dcbbd9c7018eee7c433206c8df1f0b5cd80909fc0c073f0ed2887c74f')
  import importlib.util
  spec=importlib.util.spec_from_file_location('before_unused_renewal',oldpath);old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
  with self.assertRaisesRegex(RuntimeError,'NORMAL_STOPPED_NATIVE_INSTALLATION_REQUIRED'):old.eligible(self.c,self.p,True)
 def test_apply_uses_existing_backup_preserves_installed_status_and_credentials(self):
  m.apply(self.c,self.p,self.o,True)
  record=json.loads((self.p/'installation.json').read_text());self.assertEqual(record['status'],'INSTALLED')
  self.assertEqual((self.p/'secrets.dpapi').read_bytes(),b'UNREADABLE_TEST_SENTINEL')
  self.assertEqual(json.loads((self.o/'original-backup/installation.json').read_text())['nativeLink']['notAfterUTC'],self.binding['notAfterUTC'])
  self.assertFalse((self.p/'product-update.lock').exists());self.c.sql.assert_not_called();self.c.unprotect.assert_not_called()
 def test_no_approval_does_not_touch_files(self):
  before=self.snapshot()
  with self.assertRaisesRegex(RuntimeError,'APPROVAL'):m.eligible(self.c,self.p,False)
  self.assertEqual(before,self.snapshot())
 def test_runtime_or_failure_artifacts_block(self):
  for name in ['STOP','server-process.json','hold-mysql-process.json','admission.ready','admission.closed',
    'last-stop-safety.json','product-runtime.lock','start.lock','stop.lock','product-update.lock',
    'product-hold-transition.lock','product-runtime-first-failure.json','operation-first-failure.json']:
   p=self.p/name;p.touch();before=self.snapshot()
   with self.subTest(name=name),self.assertRaises(RuntimeError):m.eligible(self.c,self.p,True)
   self.assertEqual(before,self.snapshot());p.unlink()
 def test_launch_or_recovery_metadata_blocks(self):
  for key in ['launchId','launchDeadlineUTC','holdRecovery','productHoldRecovery']:
   self.r[key]='present'
   with self.subTest(key=key),self.assertRaises(RuntimeError):m.eligible(self.c,self.p,True)
   del self.r[key]
 def test_unexpired_or_naive_old_grant_blocks(self):
  for expiry in [(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=5)).isoformat(),
    datetime.datetime.now().isoformat(),'bad-date']:
   self.binding['notAfterUTC']=self.grant['notAfterUTC']=self.r['nativeLink']['notAfterUTC']=expiry;self.sync()
   with self.subTest(expiry=expiry),self.assertRaises(RuntimeError):m.eligible(self.c,self.p,True)
 def test_foreign_install_extension_profile_or_verification_blocks(self):
  for key in ['installationId','extensionId','profile','installationPath','verificationId']:
   original=self.binding[key];self.binding[key]='foreign';self.sync()
   with self.subTest(key=key),self.assertRaisesRegex(RuntimeError,'BINDING_MISMATCH'):m.eligible(self.c,self.p,True)
   self.binding[key]=original
 def test_probe_only_grant_or_missing_setup_proof_blocks(self):
  self.binding['allowUserSession']=False;self.sync()
  with self.assertRaises(RuntimeError):m.eligible(self.c,self.p,True)
  self.binding['allowUserSession']=True;self.setup['servicesStarted']=True;self.sync()
  with self.assertRaises(RuntimeError):m.eligible(self.c,self.p,True)
 def test_mismatched_expiry_blocks(self):
  self.grant['notAfterUTC']='2020-01-01T00:00:00+00:00';self.sync()
  with self.assertRaisesRegex(RuntimeError,'EXPIRY_BINDING'):m.eligible(self.c,self.p,True)
 def test_native_registration_wrong_or_missing_blocks(self):
  self.registry.QueryValueEx.return_value=('foreign.json',1)
  with self.assertRaisesRegex(RuntimeError,'REGISTRATION_MISMATCH'):m.eligible(self.c,self.p,True)
  self.registry.OpenKey.side_effect=FileNotFoundError
  with self.assertRaisesRegex(RuntimeError,'REGISTRATION_MISSING'):m.eligible(self.c,self.p,True)
 def test_native_host_other_origin_blocks(self):
  self.host['allowed_origins'].append('chrome-extension://'+'b'*32+'/');self.sync()
  with self.assertRaisesRegex(RuntimeError,'HOST_MISMATCH'):m.eligible(self.c,self.p,True)
 def test_active_bootstrap_mysql_blocks_even_without_server(self):
  (self.p/'mysql-process.json').write_text('{"ProcessId":123}')
  with self.assertRaisesRegex(RuntimeError,'PRIOR_SERVICE_PROCESS_PRESENT'):m.eligible(self.c,self.p,True)
 def test_mutation_after_update_lock_is_not_committed(self):
  real_open=m.os.open
  def race(path,*args,**kw):
   fd=real_open(path,*args,**kw)
   if pathlib.Path(path).name=='product-update.lock':(self.p/'server-process.json').write_text('{}')
   return fd
  with patch.object(m.os,'open',side_effect=race),self.assertRaisesRegex(RuntimeError,'EXECUTION_OR_FAILURE'):m.apply(self.c,self.p,self.o,True)
  self.assertFalse((self.o/'original-backup').exists());self.assertTrue((self.p/'product-update.lock').exists())
 def test_connect_routes_unused_setup_through_updater_not_fresh_registration(self):
  self.c.require.side_effect=lambda ok,code:None if ok else (_ for _ in ()).throw(RuntimeError(code))
  with patch.object(native,'_renew_stopped',return_value={'servicesStarted':False}) as renew,patch.object(native,'_connect_fresh') as fresh:
   native.connect(self.c,self.p,60,True,user_session=True)
  renew.assert_called_once();fresh.assert_not_called();self.c.spawn_owned.assert_not_called()
 def test_compiled_unused_prepare_and_apply_preserve_all_non_scope_data(self):
  for target,rel in m.SOURCES.items():
   dest=self.p/target;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(folder.parents[1]/rel,dest)
  py=self.p/'runtimes/python/python.exe';py.parent.mkdir(parents=True);py.write_bytes(b'NOT_EXECUTABLE_SYNTHETIC')
  self.r['runtimes']={'python':str(py)};self.r['config']['mysqlPort']=28456
  self.binding.update(chromePID=0,chromeCreatedMs=12345,chromeExecutable='not-executed.exe')
  (self.p/'chrome-process.json').write_bytes(m.encoded({'ProcessId':0,'CreationDate':'/Date(12345)/','ExecutablePath':'not-executed.exe'}))
  (self.p/'control/MANIFEST.json').write_bytes(m.encoded({'files':[]}));self.sync()
  self.r['payload']=[{'path':f.relative_to(self.p).as_posix(),'sha256':m.sha(f)} for d in ['app','control','runtimes'] for f in (self.p/d).rglob('*') if f.is_file()];self.sync()
  before=self.snapshot();output=self.p.parent/'compiled-unused-plan'
  plan=m.prepare(self.c,self.p,self.p,output,datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=45),True,source_layout='installed')
  self.assertEqual(before,self.snapshot());self.assertFalse(plan['requiresUserExtensionReload'])
  m.apply(self.c,self.p,output,True)
  changed={n for n,raw in before.items() if (self.p/n).read_bytes()!=raw}
  self.assertLessEqual(changed,set(m.SOURCES)|m.GENERATED|{'control/MANIFEST.json','installation.json'})
  self.assertEqual(self.r['status'],'INSTALLED');self.c.sql.assert_not_called();self.c.unprotect.assert_not_called();self.c.spawn_owned.assert_not_called()
  core.verify_installed_payload(self.p,self.r)

if __name__=='__main__':unittest.main()
