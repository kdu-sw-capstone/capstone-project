import datetime,importlib.util,json,pathlib,tempfile,types,unittest
from unittest.mock import Mock,patch

path=pathlib.Path(__file__).resolve().parents[1]/'installer/native_setup.py'
spec=importlib.util.spec_from_file_location('native_setup_tests',path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ProductNativeSetupTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.p=pathlib.Path(self.tmp.name)/('1'*32);self.p.mkdir()
  self.r={'id':'1'*32,'extensionId':'a'*32,'status':'INSTALLED','config':{'browserMode':'regular_manual','webPort':28453,'mysqlPort':28454}}
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
