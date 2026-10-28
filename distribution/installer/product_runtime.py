"""Product-owned runtime verification. Invoked only by the pinned native host.
No BrowserBridge, debugger, user account, session START/END or recovery entry point.
"""
import datetime,hashlib,json,os,pathlib,re,secrets,time,uuid
class RuntimeFailure(RuntimeError):pass
class RuntimeBusy(RuntimeFailure):pass
def need(ok,code):
 if not ok:raise RuntimeFailure(code)
class RuntimeProbe:
 fence_operation="BIND_CLOSED"
 def claim_lock(self,lock):
  try:return os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
  except FileExistsError:raise RuntimeBusy('PRODUCT_OPERATION_ALREADY_ACTIVE') from None
 def __init__(self,core,installation,deadline,channel):
  self.c=core;self.p=pathlib.Path(installation).resolve();self.end=datetime.datetime.fromisoformat(deadline);self.channel=channel;self.r=None;self.secret=None;self.stage="INITIAL"
 def budget(self,seconds=0):need(self.end.tzinfo is not None and datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)<self.end,'PRODUCT_RUNTIME_TIME_INSUFFICIENT')
 def exchange(self,operation,payload=None):
  self.budget(23);self.stage='EXTENSION_'+operation;nonce=secrets.token_hex(16);q={'contract':'FOCURVE_RUNTIME_PROBE_1','operation':operation,'nonce':nonce,'installationId':self.r['id'],'extensionId':self.r['extensionId'],'payload':payload or {}}
  r=self.channel.exchange(q,timeout=23)
  need(type(r) is dict and r.get('contract')==q['contract'] and r.get('nonce')==nonce and r.get('installationId')==q['installationId'] and r.get('extensionId')==q['extensionId'] and r.get('ok') is True,'PRODUCT_EXTENSION_REPLY_UNCONFIRMED')
  return r.get('result')
 def local_clear(self):
  local=self.exchange('CHECK_LOCAL');need(self.c.safety_clear(local,{'activeSessions':0,'locks':0,'unresolvedReceipts':0}),'PRODUCT_LOCAL_NOT_CLEAR');return local
 def database_clear(self):
  value=json.loads(self.c.helper(self.p,self.r,'safety',self.c.db_env(self.r,self.secret)));need(set(value)=={'activeSessions','locks','unresolvedReceipts'} and all(type(n) is int and n==0 for n in value.values()),'PRODUCT_DB_NOT_CLEAR');return value
 def dataset_fingerprint(self):
  # Counts only, within this installation's schema; never read user field values.
  schema=self.r.get('schema');need(schema=='focurve_user_'+self.r['id'] and bool(re.fullmatch('focurve_user_[a-f0-9]{32}',schema)),'PRODUCT_SCHEMA_BINDING_MISMATCH')
  self.stage='DATABASE_DATASET_COUNTS'
  self.budget(30)
  tables=self.c.sql(self.p,self.r,"SELECT table_name FROM information_schema.tables WHERE table_schema='"+schema+"' AND table_type='BASE TABLE' ORDER BY table_name;").splitlines()
  need(bool(tables) and all(re.fullmatch('[a-zA-Z0-9_]+',x) for x in tables),'PRODUCT_SCHEMA_UNCONFIRMED')
  counts=[]
  for name in tables:
   self.budget(30)
   counts.append((name,self.c.sql(self.p,self.r,'SELECT COUNT(*) FROM `'+schema+'`.`'+name+'`;').strip()))
  need(all(n.isdigit() for _,n in counts),'PRODUCT_DATA_COUNTS_UNCONFIRMED')
  return hashlib.sha256(json.dumps(counts,separators=(',',':')).encode()).hexdigest()
 def prepare(self):
  self.budget(120);self.stage='OWNED_PAYLOAD';c=self.c;p=self.p;r=c.owned_record(p)
  need(not r.get('holdRecovery') and not any((p/n).exists() for n in ['STOP','start.lock','stop.lock','product-update.lock']),'PRODUCT_EXISTING_OPERATION_OR_HOLD')
  if r['status']=='STOPPED':need(c.safety_clear(**c.read(p/'last-stop-safety.json')),'PRODUCT_PREVIOUS_STOP_UNVERIFIED')
  c.verify_process(p,'chrome')
  for name in ['mysql','server']:
   file=p/(name+'-process.json')
   if not file.exists():continue
   try:c.process_identity(c.read(file)['ProcessId'])
   except c.InstallError as e:
    if str(e)!='OWNED_PROCESS_NOT_PRESENT':raise
   else:raise RuntimeFailure('PRODUCT_PRIOR_SERVICE_OWNER_PRESENT')
  self.r=r;self.local_clear();self.secret=c.unprotect((p/'secrets.dpapi').read_bytes());c.validate_link_key(self.secret)
  c.port_available(r['config']['mysqlPort']);c.port_available(r['config']['webPort'])
  # New normal launch metadata, bounded by the existing non-extendable grant.
  c.prepare_launch_configuration(p,r,max(3,int((self.end-datetime.datetime.now(datetime.timezone.utc)).total_seconds()/60)),self.end.isoformat())
  (p/'admission.closed').touch(exist_ok=True);need(not (p/'admission.ready').exists(),'PRODUCT_FOCUS_GATE_NOT_CLOSED')
  r['status']='PRODUCT_STARTING';c.write(p/'installation.json',r)
  self.stage='MYSQL_PREPARE';db=c.spawn_owned(c.mysql_args(p,r),p,'mysql');c.wait_mysql(p,r,db);self.database_clear()
  self.stage='SERVER_PREPARE';server=c.spawn_owned([r['runtimes']['java'],'-Xmx384m','-jar',p/'app/server/server.jar','--spring.profiles.active=member-runtime,user-install','--member.fixture.enabled=false','--member.mail.test-sink=false','--spring.flyway.enabled=false','--management.endpoints.web.exposure.include=health,shutdown','--management.endpoint.shutdown.access=unrestricted','--server.shutdown=graceful','--spring.web.resources.static-locations=file:'+str(p/'app/web').replace('\\','/')+'/'],p,'server',c.server_env(r,self.secret,p))
  for _ in range(100):
   self.budget();need(server.poll() is None,'PRODUCT_SERVER_EXITED')
   try:
    code,body=c.http(p,r,'/actuator/health')
    if code==200 and json.loads(body).get('status')=='UP':break
   except (OSError,ValueError):pass
   time.sleep(.3)
  else:raise RuntimeFailure('PRODUCT_SERVER_HEALTH_UNCONFIRMED')
  code,web=c.http(p,r,'/');need(code==200 and b'<html' in web.lower(),'PRODUCT_WEB_NOT_AVAILABLE')
  reply=self.exchange(self.fence_operation,{'launchId':r['launchId'],'launchDeadlineUTC':r['launchDeadlineUTC']});need(type(reply) is dict and reply.get('quiesced') is True and reply.get('launchId')==r['launchId'],'PRODUCT_EXTENSION_FENCE_UNCONFIRMED')
  self.local_clear();self.database_clear();r['status']='PRODUCT_RUNNING_FOCUS_LOCKED';c.write(p/'installation.json',r)
  return self.dataset_fingerprint()
 def stop(self):
  c=self.c;p=self.p;r=self.r;need(r is not None and r.get('status') in ['PRODUCT_RUNNING_FOCUS_LOCKED','PRODUCT_RUNNING_USER_SESSION'],'PRODUCT_STOP_SCOPE_UNCONFIRMED')
  c.verify_installed_payload(p,r);(p/'admission.closed').touch(exist_ok=True)
  c.verify_process(p,'server');code,body=c.http(p,r,'/api/v1/install/lifecycle-quiesce',b'{}',{'X-FOCURVE-Installation-Key':self.secret['lifecycleKey']});need(code==200 and json.loads(body).get('quiesced') is True,'PRODUCT_SERVER_FENCE_UNCONFIRMED')
  reply=self.exchange('QUIESCE');need(type(reply) is dict and reply.get('quiesced') is True,'PRODUCT_EXTENSION_FENCE_UNCONFIRMED')
  local=self.local_clear();db=self.database_clear();c.write(p/'last-stop-safety.json',{'local':local,'db':db});self.before_shutdown()
  c.verify_process(p,'server');code,_=c.http(p,r,'/actuator/shutdown',b'{}');need(code==200,'PRODUCT_SERVER_STOP_UNCONFIRMED');c.await_exit(c.read(p/'server-process.json')['ProcessId'])
  c.shutdown_mysql(p,r);c.await_exit(c.read(p/'mysql-process.json')['ProcessId']);self.after_shutdown();r['status']='STOPPED';c.write(p/'installation.json',r)
 def before_shutdown(self):pass
 def after_shutdown(self):pass
 def run(self):
  self.budget(240);p=self.p;lock=p/'product-runtime.lock'
  fd=self.claim_lock(lock)
  normal=False
  try:
   first=self.prepare();self.stop();second=self.prepare();need(first==second,'PRODUCT_DATA_COUNTS_CHANGED_AFTER_RESTART');self.stop();normal=True
   # No local safety details are exported as a tool/CLI observation endpoint.
   return {'state':'VERIFIED_STOPPED','servicesRunning':False,'webHealth':True,'serverHealth':True,'databaseSafety':True,'localSafety':True,'normalShutdowns':2,'restart':True,'schemaAndRowCountsPreserved':True,'userRecordContentsVerified':False,'focusAdmission':'CLOSED','automaticSTART_END':False}
  except Exception:
   if self.r is not None:
    (p/'admission.closed').touch(exist_ok=True);self.r['status']='PRODUCT_HOLD_PRESERVED';self.c.write(p/'installation.json',self.r)
   raise
  finally:
   os.close(fd)
   if normal:lock.unlink()
