import datetime,importlib.util,json,pathlib,sys,tempfile,unittest
from unittest.mock import Mock
folder=pathlib.Path(__file__).resolve().parents[1]/'installer'
# Match the existing pinned sibling-module import environment in production.
sys.path.insert(0,str(folder))
def module(name):
 spec=importlib.util.spec_from_file_location('session_update_test_'+name,folder/(name+'.py'))
 m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m);return m
m=module('session_update');core=module('install_core')

class SessionUpdateTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();root=pathlib.Path(self.tmp.name)
  self.p=root/('1'*32);self.p.mkdir();self.o=root/'plan';(self.o/'patch').mkdir(parents=True)
  self.r={'id':self.p.name,'extensionId':'a'*32,'status':'STOPPED','schema':'focurve_user_'+self.p.name,
          'origin':'https://localhost:28455','callback':'chrome-extension://'+'a'*32+'/popup/popup.html',
          'config':{'webPort':28455},'nativeLink':{'hostName':'com.focurve.install_'+self.p.name},'payload':[]}
  (self.p/'installation.json').write_bytes(m.encoded(self.r))
  (self.p/'last-stop-safety.json').write_text('{"local":{},"db":{}}')
  (self.p/'secrets.dpapi').write_bytes(b'UNREADABLE_TEST_SENTINEL')
  self.c=Mock();self.c.owned_record.return_value=self.r;self.c.read.side_effect=lambda p:json.loads(p.read_text())
  self.c.safety_clear.return_value=True;self.c.verify_installed_payload.side_effect=core.verify_installed_payload
  self.c.InstallError=core.InstallError
  files={}
  for rel in set(m.SOURCES)|m.GENERATED:
   f=self.o/'patch'/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(('new:'+rel).encode());files[rel]=m.sha(f)
  self.plan={'contract':'FOCURVE_STOPPED_USER_SESSION_UPDATE_1','installationId':self.r['id'],
             'extensionId':self.r['extensionId'],'expectedRecordSHA256':m.sha(self.p/'installation.json'),
             'notAfterUTC':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=50)).isoformat(),
             'verificationId':'2'*32,'files':files}
  self.save()
 def save(self):(self.o/'PATCH-PREVIEW.json').write_bytes(m.encoded(self.plan))
 def tearDown(self):self.tmp.cleanup()
 def snapshot(self):return {f.relative_to(self.p).as_posix():f.read_bytes() for f in self.p.rglob('*') if f.is_file()}
 def test_apply_changes_only_declared_product_files_keeps_status_and_secret(self):
  m.apply(self.c,self.p,self.o,True)
  r=json.loads((self.p/'installation.json').read_text());self.assertEqual(r['status'],'STOPPED')
  self.assertEqual((self.p/'secrets.dpapi').read_bytes(),b'UNREADABLE_TEST_SENTINEL')
  self.assertFalse((self.p/'product-update.lock').exists());self.assertTrue((self.o/'original-backup/installation.json').exists())
  core.verify_installed_payload(self.p,r);self.c.unprotect.assert_not_called();self.c.spawn_owned.assert_not_called()
 def test_no_approval_is_side_effect_free(self):
  before=self.snapshot()
  with self.assertRaisesRegex(RuntimeError,'APPROVAL'):m.apply(self.c,self.p,self.o)
  self.assertEqual(self.snapshot(),before)
 def test_hold_is_never_migrated_to_stopped(self):
  for state in ['PRODUCT_HOLD_PRESERVED','ACCEPTANCE_HOLD_PRESERVED','UNKNOWN']:
   self.r['status']=state;before=self.snapshot()
   with self.subTest(state=state),self.assertRaises(RuntimeError):m.apply(self.c,self.p,self.o,True)
   self.assertEqual(self.snapshot(),before)
 def test_changed_record_rejected_before_backup_or_patch(self):
  (self.p/'installation.json').write_text('changed');before=self.snapshot()
  with self.assertRaisesRegex(RuntimeError,'TARGET_CHANGED'):m.apply(self.c,self.p,self.o,True)
  self.assertEqual(self.snapshot(),before);self.assertFalse((self.o/'original-backup').exists())
 def test_credentials_or_outside_paths_cannot_be_added_to_patch(self):
  for name in ['secrets.dpapi','../outside','profile/Preferences']:
   self.plan['files'][name]='a'*64;self.save();before=self.snapshot()
   with self.subTest(name=name),self.assertRaisesRegex(RuntimeError,'FILE_SCOPE'):m.apply(self.c,self.p,self.o,True)
   self.assertEqual(self.snapshot(),before);del self.plan['files'][name]
 def test_tampered_stage_cannot_be_blessed_into_payload(self):
  f=self.o/'patch/app/extension/native-link/session.js';f.write_text('changed');before=self.snapshot()
  with self.assertRaisesRegex(RuntimeError,'STAGED_UPDATE_CHANGED'):m.apply(self.c,self.p,self.o,True)
  self.assertEqual(self.snapshot(),before)
 def test_expired_or_oversized_grants_refused(self):
  for minutes in [-1,10,70]:
   self.plan['notAfterUTC']=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=minutes)).isoformat();self.save()
   with self.subTest(minutes=minutes),self.assertRaisesRegex(RuntimeError,'WINDOW'):m.apply(self.c,self.p,self.o,True)
 def test_active_update_or_runtime_cannot_overlap(self):
  for name in ['product-update.lock','product-runtime.lock','STOP']:
   f=self.p/name;f.touch()
   with self.subTest(name=name),self.assertRaisesRegex(RuntimeError,'ACTIVE_OPERATION'):m.apply(self.c,self.p,self.o,True)
   f.unlink()
 def test_other_schema_and_callback_rejected(self):
  self.r['schema']='operating_database'
  with self.assertRaisesRegex(RuntimeError,'BINDING_MISMATCH'):m.apply(self.c,self.p,self.o,True)
 @unittest.skipUnless(m.os.name=='nt','Windows native compiler integration')
 def test_normal_stopped_renewal_builds_native_without_chrome_db_or_secret_access(self):
  import shutil
  # A synthetic installation only: dummy Python path and ownership adapter.
  # The actual compiled host must reject this non-Chrome parent before executing it.
  for target,rel in m.SOURCES.items():
   dest=self.p/target;dest.parent.mkdir(parents=True,exist_ok=True)
   shutil.copyfile(folder.parents[1]/rel,dest)
  python=self.p/'runtimes/python/python.exe';python.parent.mkdir(parents=True);python.write_bytes(b'NOT_EXECUTABLE_TEST_SENTINEL')
  self.r['runtimes']={'python':str(python)}
  self.r['config']['mysqlPort']=28456
  binding={'contract':'FOCURVE_NATIVE_BINDING_1','installationId':self.r['id'],'extensionId':self.r['extensionId'],
           'profile':str(self.p/'profile'),'chromePID':0,'chromeCreatedMs':12345,
           'chromeExecutable':r'C:\not-installed\chrome.exe','userSid':'SYNTHETIC_SID'}
  native=self.p/'control/native-link';native.mkdir(parents=True)
  (native/'binding.json').write_bytes(m.encoded(binding))
  (self.p/'chrome-process.json').write_bytes(m.encoded({'ProcessId':0,'CreationDate':'/Date(12345)/','ExecutablePath':binding['chromeExecutable']}))
  (self.p/'control/MANIFEST.json').write_bytes(m.encoded({'files':[]}))
  self.r['payload']=[{'path':f.relative_to(self.p).as_posix(),'sha256':m.sha(f)} for d in ['app','control','runtimes'] for f in (self.p/d).rglob('*') if f.is_file()]
  (self.p/'installation.json').write_bytes(m.encoded(self.r))
  output=self.o.parent/('renewal-'+'a'*95)/('stage-'+'b'*45)
  plan=m.prepare(self.c,self.p,self.p,output,datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=45),True,source_layout='installed')
  self.assertFalse(plan['requiresUserExtensionReload']);self.assertFalse(plan['servicesStarted'])
  self.assertEqual(set(plan['files']),set(m.SOURCES)|m.GENERATED)
  m.apply(self.c,self.p,output,True)
  self.assertEqual((self.p/'secrets.dpapi').read_bytes(),b'UNREADABLE_TEST_SENTINEL')
  self.c.spawn_owned.assert_not_called();self.c.unprotect.assert_not_called();self.c.sql.assert_not_called()
  self.assertFalse((self.p/'product-update.lock').exists());core.verify_installed_payload(self.p,self.r)
