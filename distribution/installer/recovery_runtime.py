"""Native read-only backend adapter. No browser driver, service spawn or fallback.

An application-owned, policy-permitted observer must be supplied in process. The
CLI deliberately supplies none; JSON files/flags cannot manufacture permission.
An offline DB needs separately approved DB-only preparation, not an implicit start.
"""
import base64,datetime,hashlib,json,os,pathlib,re
from hold_recovery import RecoveryError,need,safe_path,binding,digest

DATABASE_SQL="""SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;
SELECT JSON_OBJECT('schema',DATABASE(),'port',@@port,'datadir',@@datadir,
 'globalTZ',@@global.time_zone,'sessionTZ',@@session.time_zone,
 'engines',(SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()
 AND table_name IN ('focus_sessions','active_execution_locks','event_receipts') AND engine='InnoDB'),
 'counts',JSON_OBJECT(
 'activeSessions',(SELECT COUNT(*) FROM focus_sessions WHERE execution_status IS NULL OR execution_status <> 'ENDED'),
 'locks',(SELECT COUNT(*) FROM active_execution_locks),
 'unresolvedReceipts',(SELECT COUNT(*) FROM event_receipts WHERE status IS NULL OR status <> 'ACCEPTED')));
COMMIT;
"""

class WindowsRuntime:
 def __init__(self,core,observer=None):self.core=core;self.observer=observer
 def now(self):return datetime.datetime.now(datetime.timezone.utc)
 def require_observer(self):
  need(self.observer is not None and callable(getattr(self.observer,'require_permission',None)) and callable(getattr(self.observer,'collect_local',None)),'OFFICIAL_LOCAL_OBSERVER_UNAVAILABLE')
 def require_launch_permission(self,b):
  self.require_observer()
  # This specific legacy engine must be permitted, not inferred from full-CDP UI.
  need(self.observer.require_permission('installer_observe_cdp',b) is True,'BROWSER_POLICY_NOT_VERIFIED')
 def verify_target(self,p,r):
  c=self.core;need(r.get('contract')==c.CONTRACT and re.fullmatch('[a-f0-9]{32}',r.get('id','')),'INSTALLATION_ID_MISMATCH')
  need(c.child(c.installations(),r['id'])==p,'INSTALLATION_PATH_MISMATCH')
  need(r.get('schema')=='focurve_user_'+r['id'],'DATABASE_SCOPE_MISMATCH')
  conf=r.get('config',{});need(all(type(conf.get(k)) is int and 1024<=conf[k]<=65535 for k in ['webPort','mysqlPort']) and conf['webPort']!=conf['mysqlPort'],'PORT_BINDING_UNCONFIRMED')
  need(r.get('origin')=='https://localhost:'+str(conf['webPort']),'ORIGIN_MISMATCH')
  eid=r.get('extensionId','');need(re.fullmatch('[a-p]{32}',eid),'EXTENSION_ID_MISMATCH')
  need(r.get('callback')=='chrome-extension://'+eid+'/popup/popup.html','CALLBACK_MISMATCH')
  manifest=c.read(safe_path(p/'app/extension/manifest.json'))
  try:h=hashlib.sha256(base64.b64decode(manifest.get('key',''),validate=True)).hexdigest()[:32]
  except Exception:raise RecoveryError('EXTENSION_KEY_UNCONFIRMED') from None
  need(''.join(chr(ord('a')+int(x,16)) for x in h)==eid,'EXTENSION_ID_MISMATCH')
  need(safe_path(p/'profile').parent==p,'PROFILE_PATH_MISMATCH')
 def verify_payload(self,p,r):
  try:self.core.verify_installed_payload(p,r)
  except Exception:raise RecoveryError('PAYLOAD_INTEGRITY_UNCONFIRMED') from None
 def owner_id(self):
  try:value=self.core.process_identity(os.getpid())
  except Exception:raise RecoveryError('RECOVERY_OWNER_UNCONFIRMED') from None
  return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
 def verify_grant_owner(self,g):need(self.owner_id()==g.owner_id,'RECOVERY_OWNER_CHANGED')
 def alive(self,pid):
  need(type(pid) is int and pid>0,'PROCESS_IDENTITY_UNCONFIRMED')
  try:
   raw=self.core.run(['powershell.exe','-NoProfile','-Command',f'[bool](Get-Process -Id {pid} -ErrorAction SilentlyContinue)'],text=True).stdout.strip()
  except Exception:raise RecoveryError('PROCESS_OBSERVATION_UNCONFIRMED') from None
  need(raw in ['True','False'],'PROCESS_OBSERVATION_UNCONFIRMED');return raw=='True'
 def verify_owners(self,p,r):
  controller=r.get('controllerPID')
  if controller is not None:need(not self.alive(controller),'PRIOR_CONTROLLER_PRESENT')
  expected_mysql=None
  for name in ['server','chrome','mysql']:
   f=p/(name+'-process.json')
   if not f.exists():continue
   expected=self.core.read(safe_path(f))
   if not self.alive(expected['ProcessId']):continue
   try:actual=self.core.verify_process(p,name)
   except Exception:raise RecoveryError('PROCESS_IDENTITY_CHANGED') from None
   need(name!='server','SERVER_STILL_RUNNING')
   if name=='mysql':expected_mysql=actual['ProcessId']
   if name=='chrome':need('--user-data-dir='+str(p/'profile') in actual.get('CommandLine',''),'PROFILE_PROCESS_MISMATCH')
  # Exact ports only; no network connection to a possibly foreign/operating DB.
  ports=','.join(str(r['config'][k]) for k in ['webPort','mysqlPort'])
  script=f'@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {{$_.LocalPort -in @({ports})}} | Select-Object LocalPort,OwningProcess) | ConvertTo-Json -Compress'
  try:
   text=self.core.run(['powershell.exe','-NoProfile','-Command',script],text=True).stdout.strip();rows=json.loads(text) if text else []
  except Exception:raise RecoveryError('PORT_OBSERVATION_UNCONFIRMED') from None
  if type(rows) is dict:rows=[rows]
  for x in rows:need(x['LocalPort']==r['config']['mysqlPort'] and x['OwningProcess']==expected_mysql,'SERVICE_OR_PORT_CONFLICT')
 def _local(self,p,r,b,nonce,g):
  self.require_observer();need(self.observer.require_permission('local_safety_read_only',b) is True,'BROWSER_POLICY_NOT_VERIFIED')
  # A fresh call into the permitted provider, never a pasted/cached JSON report.
  return self.observer.collect_local(b,nonce,g.not_after_utc)
 observe_local=_local
 confirm_local=_local
 def observe_database(self,p,r,b,nonce,g):
  self.verify_target(p,r);self.verify_owners(p,r)
  f=p/'mysql-process.json';need(f.is_file(),'DATABASE_OFFLINE_REQUIRES_SCOPED_PREPARATION')
  expected=self.core.read(f);need(self.alive(expected['ProcessId']),'DATABASE_OFFLINE_REQUIRES_SCOPED_PREPARATION')
  try:self.core.verify_process(p,'mysql')
  except Exception:raise RecoveryError('DATABASE_PROCESS_UNCONFIRMED') from None
  client=safe_path(pathlib.Path(r['runtimes']['mysql'])/'bin/mysql.exe');need(client.is_relative_to(p/'runtimes'),'DATABASE_CLIENT_SCOPE_MISMATCH')
  config=safe_path(p/'root-client.ini');need(config.parent==p,'DATABASE_CLIENT_SCOPE_MISMATCH')
  # mysql reads only this installation's credential file; Python never reads,
  # copies, decrypts or prints it. No password appears in arguments or reports.
  args=[client,'--defaults-file='+str(config),'--protocol=TCP','--host=127.0.0.1','--port='+str(r['config']['mysqlPort']),'--database='+r['schema'],'--batch','--raw','--skip-column-names','--connect-timeout=3']
  try:
   out=self.core.run(args,input=DATABASE_SQL,text=True,timeout=10).stdout.strip();need(len(out)<8192,'DATABASE_RESPONSE_TOO_LARGE');v=json.loads(out)
  except Exception:raise RecoveryError('DATABASE_QUERY_UNCONFIRMED') from None
  need(v.get('schema')==r['schema'] and v.get('port')==r['config']['mysqlPort'] and safe_path(v.get('datadir',''))==safe_path(p/'database'),'DATABASE_SCOPE_MISMATCH')
  need(v.get('globalTZ')=='+00:00' and v.get('sessionTZ')=='+00:00' and v.get('engines')==3,'DATABASE_SCHEMA_OR_TIMEZONE_UNCONFIRMED')
  return {'contract':'FOCURVE_CURRENT_DATABASE_OBSERVATION_1','binding':b,'nonce':nonce,'observedAtUTC':self.now().isoformat(),'readOnlyTransaction':True,'consistentSnapshot':True,'counts':v.get('counts')}
 def before_commit(self):pass
