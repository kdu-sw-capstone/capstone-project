import pathlib,tempfile,json,sys,unittest,uuid,base64,hashlib,types,datetime,importlib.util
from unittest.mock import patch
CODE=pathlib.Path(__file__).resolve().parents[1]/'installer';sys.path.insert(0,str(CODE))
import hold_recovery as h
from recovery_runtime import WindowsRuntime,DATABASE_SQL

class NativeContractTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.p=self.root/uuid.uuid4().hex;self.p.mkdir();(self.p/'profile').mkdir();(self.p/'app/extension').mkdir(parents=True);(self.p/'runtimes/mysql/bin').mkdir(parents=True);(self.p/'database').mkdir();(self.p/'root-client.ini').write_text('fixture credential not read')
  pub=b'SYNTHETIC_PUBLIC_KEY_NOT_A_CHROME_INSTALL';hx=hashlib.sha256(pub).hexdigest()[:32];eid=''.join(chr(97+int(x,16)) for x in hx);(self.p/'app/extension/manifest.json').write_text(json.dumps({'key':base64.b64encode(pub).decode()}))
  self.r={'contract':'FOCURVE_USER_INSTALL_1','id':self.p.name,'schema':'focurve_user_'+self.p.name,'origin':'https://localhost:18447','extensionId':eid,'callback':'chrome-extension://'+eid+'/popup/popup.html','config':{'webPort':18447,'mysqlPort':18448},'runtimes':{'mysql':str(self.p/'runtimes/mysql')},'controllerPID':111}
  self.live={222};self.process_change=False;self.listeners=[];self.command=[];self.queries=[];self.result={'schema':self.r['schema'],'port':18448,'datadir':str(self.p/'database'),'globalTZ':'+00:00','sessionTZ':'+00:00','engines':3,'counts':{'activeSessions':0,'locks':0,'unresolvedReceipts':0}}
  (self.p/'mysql-process.json').write_text(json.dumps({'ProcessId':222}))
  self.core=types.SimpleNamespace(CONTRACT='FOCURVE_USER_INSTALL_1',child=lambda root,i:root/i,installations=lambda:self.root,read=h.read,run=self.native_run,verify_installed_payload=lambda p,r:None,verify_process=self.verify_process,process_identity=lambda p:{'pid':p,'created':'fixture','exe':'python'})
  self.runtime=WindowsRuntime(self.core)
 def tearDown(self):self.temp.cleanup()
 def verify_process(self,p,n):
  if self.process_change:raise RuntimeError('PID reused')
  return {'ProcessId':222,'CommandLine':'mysqld --defaults-file='+str(self.p/'mysql.ini')}
 def native_run(self,args,**kw):
  if str(args[0]).endswith('mysql.exe'):
   self.command=[str(x) for x in args];self.queries.append(kw['input']);return types.SimpleNamespace(stdout=json.dumps(self.result))
  script=args[-1]
  if 'Get-NetTCPConnection' in script:return types.SimpleNamespace(stdout=json.dumps(self.listeners))
  if 'Get-Process' in script:
   pid=int(script.split('-Id ')[1].split(' ')[0]);return types.SimpleNamespace(stdout='True' if pid in self.live else 'False')
  raise AssertionError('Unexpected native operation')
 def probe(self):return self.runtime.observe_database(self.p,self.r,h.binding(self.p,self.r),'nonce',None)
 def test_current_owned_read_only_db_snapshot(self):
  r=self.probe();self.assertEqual(r['counts'],self.result['counts']);self.assertTrue(r['readOnlyTransaction']);self.assertIn('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY',self.queries[0]);self.assertIn('ISOLATION LEVEL REPEATABLE READ',self.queries[0]);self.assertEqual(self.queries[0].count('COMMIT;'),1);self.assertTrue(any(x.startswith('--database=focurve_user_') for x in self.command));self.assertFalse(any('password=' in x.lower() for x in self.command));self.assertEqual((self.p/'root-client.ini').read_text(),'fixture credential not read')
 def test_database_offline_does_not_start_service(self):
  self.live.clear()
  with self.assertRaisesRegex(h.RecoveryError,'DATABASE_OFFLINE'):self.probe()
  self.assertEqual(self.queries,[])
 def test_server_present_rejects(self):
  (self.p/'server-process.json').write_text(json.dumps({'ProcessId':222}))
  with self.assertRaisesRegex(h.RecoveryError,'SERVER_STILL_RUNNING'):self.probe()
  self.assertEqual(self.queries,[])
 def test_foreign_port_rejects(self):
  self.listeners=[{'LocalPort':18448,'OwningProcess':999}]
  with self.assertRaisesRegex(h.RecoveryError,'SERVICE_OR_PORT_CONFLICT'):self.probe()
  self.assertEqual(self.queries,[])
 def test_pid_reuse_rejects(self):
  self.process_change=True
  with self.assertRaisesRegex(h.RecoveryError,'PROCESS_IDENTITY_CHANGED'):self.probe()
 def test_operating_schema_rejects_before_query(self):
  self.r['schema']='production'
  with self.assertRaisesRegex(h.RecoveryError,'DATABASE_SCOPE_MISMATCH'):self.probe()
  self.assertEqual(self.queries,[])
 def test_query_response_foreign_schema_rejects(self):
  self.result['schema']='other'
  with self.assertRaisesRegex(h.RecoveryError,'DATABASE_SCOPE_MISMATCH'):self.probe()
 def test_query_response_foreign_datadir_rejects(self):
  self.result['datadir']=str(self.root/'operating-db')
  with self.assertRaisesRegex(h.RecoveryError,'DATABASE_SCOPE_MISMATCH'):self.probe()
 def test_nontransactional_or_missing_table_rejects(self):
  self.result['engines']=2
  with self.assertRaisesRegex(h.RecoveryError,'DATABASE_SCHEMA_OR_TIMEZONE'):self.probe()
 def test_wrong_extension_id_rejects(self):
  self.r['extensionId']='a'*32;self.r['callback']='chrome-extension://'+'a'*32+'/popup/popup.html'
  with self.assertRaisesRegex(h.RecoveryError,'EXTENSION_ID_MISMATCH'):self.probe()
 def test_no_provider_never_calls_another_browser_tool(self):
  with self.assertRaisesRegex(h.RecoveryError,'OFFICIAL_LOCAL_OBSERVER_UNAVAILABLE'):self.runtime.require_observer()
  self.assertEqual(self.queries,[])
 def test_json_report_is_not_provider(self):
  self.runtime.observer={'gate':'CLEAR_LOCAL_ONLY'}
  with self.assertRaisesRegex(h.RecoveryError,'OFFICIAL_LOCAL_OBSERVER_UNAVAILABLE'):self.runtime.require_observer()
 def test_policy_denial_not_retried(self):
  class Observer:
   def __init__(self):self.calls=0
   def require_permission(self,*args):return False
   def collect_local(self,*args):self.calls+=1;raise AssertionError('must not execute')
  o=Observer();self.runtime.observer=o
  with self.assertRaisesRegex(h.RecoveryError,'BROWSER_POLICY_NOT_VERIFIED'):self.runtime.observe_local(self.p,self.r,h.binding(self.p,self.r),'nonce',types.SimpleNamespace(not_after_utc='future'))
  self.assertEqual(o.calls,0)
 def test_full_cdp_setting_not_implicit_legacy_observer_permission(self):
  o=types.SimpleNamespace(require_permission=lambda capability,b:capability=='local_safety_read_only',collect_local=lambda *a:None);self.runtime.observer=o
  with self.assertRaisesRegex(h.RecoveryError,'BROWSER_POLICY_NOT_VERIFIED'):self.runtime.require_launch_permission(h.binding(self.p,self.r))
 def test_sql_contains_no_business_mutation_or_known_failure_success(self):
  for token in ['DELETE ','UPDATE ','INSERT ','ALTER ','DROP ','CREATE ','TRUNCATE ']:self.assertNotIn(token,DATABASE_SQL.upper())
  self.assertIn("status <> 'ACCEPTED'",DATABASE_SQL);self.assertIn('status IS NULL',DATABASE_SQL);self.assertIn('execution_status IS NULL',DATABASE_SQL)

class InstallerRegressionTests(unittest.TestCase):
 def setUp(self):
  spec=importlib.util.spec_from_file_location('hold_installer_contract',CODE/'install_core.py');self.c=importlib.util.module_from_spec(spec);sys.modules[spec.name]=self.c;spec.loader.exec_module(self.c);self.temp=tempfile.TemporaryDirectory();self.p=pathlib.Path(self.temp.name);(self.p/'app/extension').mkdir(parents=True)
 def tearDown(self):self.temp.cleanup()
 def test_fixed_launch_deadline_never_extends_approval(self):
  end=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=4);r={'origin':'https://localhost:18447','extensionId':'a'*32,'payload':[{'path':'app/extension/release-config.js'},{'path':'app/extension/launch-context.json'}]};d=self.c.prepare_launch_configuration(self.p,r,60,end.isoformat());self.assertLessEqual(datetime.datetime.fromisoformat(d),end)
 def test_expired_launch_does_not_remove_stop_markers_or_write_context(self):
  (self.p/'admission.closed').write_text('keep');r={}
  with self.assertRaisesRegex(self.c.InstallError,'INSUFFICIENT_TIME'):self.c.prepare_launch_configuration(self.p,r,60,(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=1)).isoformat())
  self.assertEqual((self.p/'admission.closed').read_text(),'keep');self.assertFalse((self.p/'app/extension/release-config.js').exists())
 def test_future_pre_server_failures_get_typed_evidence_not_session_repair(self):
  r={'id':'a'*32,'launchId':'b'*32}
  with patch.object(self.c,'live_identity',side_effect=self.c.subprocess.TimeoutExpired('safe',1)):
   with self.assertRaisesRegex(self.c.InstallError,'EXTENSION_LIVE_IDENTITY_UNCONFIRMED'):self.c.pre_server_live_identity(self.p,r)
  v=h.read(self.p/'first-start-failure.json');self.assertEqual(v['phase'],'PRE_SERVER_START');self.assertFalse(v['focusStartPerformed']);self.assertEqual(v['code'],'EXTENSION_IDENTITY_UNCONFIRMED')
 def test_existing_first_failure_never_overwritten(self):
  (self.p/'first-start-failure.json').write_text('{"original":"keep"}');r={'id':'a'*32,'launchId':'b'*32}
  with self.assertRaisesRegex(h.RecoveryError,'FIRST_FAILURE_ALREADY_PRESERVED'):h.record_failure(self.p,r,'EXTENSION_NOT_REGISTERED')
  self.assertEqual(h.read(self.p/'first-start-failure.json'),{'original':'keep'})

if __name__=='__main__':unittest.main()
