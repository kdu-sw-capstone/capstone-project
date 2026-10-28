"""Product UI lifecycle. No focus commands, browser debugger or agent endpoint.

The user keeps the product window open and operates the ordinary popup/web UI.
Loss of that channel preserves the installation; it does not END or recover it.
"""
import datetime,os
from product_runtime import RuntimeProbe,RuntimeFailure,need
import record_snapshot

def stop_preserving_channel_hold(core,installation,output,deadline,record_sha256,failure_sha256,approve=False):
 """Explicit owner-approved service-only stop. Never END, cleanup or resume.

 Current local uncertainty is preserved, not accepted as CLEAR. This operation
 is deliberately not called automatically by the disconnected UI/Native Host.
 """
 from hold_recovery import safe_path,digest,encoded,put_once
 from product_hold_recovery import classify
 p=safe_path(installation);out=safe_path(output);end=datetime.datetime.fromisoformat(deadline)
 now=datetime.datetime.now(datetime.timezone.utc)
 need(approve is True,'CHANNEL_SERVICE_STOP_APPROVAL_REQUIRED')
 need(end.tzinfo is not None and now<end<=now+datetime.timedelta(minutes=10),'CHANNEL_SERVICE_STOP_DEADLINE_INVALID')
 need(not out.exists() and not out.is_relative_to(p),'CHANNEL_SERVICE_STOP_OUTSIDE_EVIDENCE_REQUIRED')
 r=core.read(p/'installation.json');failure=core.read(p/'product-runtime-first-failure.json')
 need(core.child(core.installations(),r['id'])==p and
      classify(r,failure)=='PRODUCT_CHANNEL_CLOSED' and
      digest(p/'installation.json')==record_sha256 and
      digest(p/'product-runtime-first-failure.json')==failure_sha256 and
      (p/'admission.closed').is_file(),'CHANNEL_SERVICE_STOP_CAUSE_OR_SCOPE_UNCONFIRMED')
 core.verify_installed_payload(p,r)
 import configparser,pathlib
 db=configparser.ConfigParser(interpolation=None);db.read(p/'mysql.ini',encoding='utf-8-sig')
 client=configparser.ConfigParser(interpolation=None);client.read(p/'root-client.ini',encoding='utf-8-sig')
 need(r['schema']=='focurve_user_'+r['id'] and
      safe_path(db['mysqld']['datadir'])==safe_path(p/'database') and
      safe_path(db['mysqld']['basedir'])==safe_path(r['runtimes']['mysql']) and
      db['mysqld']['port']==str(r['config']['mysqlPort']) and db['mysqld']['bind-address']=='127.0.0.1' and
      client['client']['port']==str(r['config']['mysqlPort']) and client['client']['host']=='127.0.0.1' and
      client['client']['user']=='root','CHANNEL_DATABASE_PATH_UNCONFIRMED')
 original={n:(p/n).read_bytes() for n in ['installation.json','product-runtime-first-failure.json',
           'product-runtime.lock','admission.closed','admission.ready','secrets.dpapi','mysql.ini','root-client.ini']}
 def budget():need(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=30)<end,'CHANNEL_SERVICE_STOP_EXPIRED')
 alive={}
 for name in ['server','mysql']:
  budget()
  try:core.verify_process(p,name);alive[name]=True
  except core.InstallError as error:
   if str(error)!='OWNED_PROCESS_NOT_PRESENT':raise
   alive[name]=False
 # Verify both owners before issuing even the first shutdown request.
 lock=p/'stop.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_BINARY',0))
 owner=encoded({'pid':os.getpid(),'deadline':deadline,'evidence':str(out)})
 os.write(fd,owner);os.fsync(fd)
 out.mkdir(parents=True)
 result={'scope':'OWNED_SERVICES_ONLY_UNKNOWN_PRESERVED','startedUTC':now.isoformat(),
         'originallyAlive':alive.copy(),'localClear':False,'START_END_Cleanup':False}
 try:
  if alive['server']:
   budget();secret=core.unprotect((p/'secrets.dpapi').read_bytes())
   core.verify_process(p,'server')
   code,body=core.http(p,r,'/api/v1/install/lifecycle-quiesce',b'{}',{'X-FOCURVE-Installation-Key':secret['lifecycleKey']})
   need(code==200 and __import__('json').loads(body).get('quiesced') is True,'CHANNEL_SERVER_DRAIN_UNCONFIRMED')
   budget();core.verify_process(p,'server');code,_=core.http(p,r,'/actuator/shutdown',b'{}')
   need(code==200,'CHANNEL_SERVER_STOP_UNCONFIRMED');core.await_exit(core.read(p/'server-process.json')['ProcessId'])
   result['serverGracefulExitVerified']=True
  if alive['mysql']:
   budget();core.verify_process(p,'mysql')
   first=record_snapshot.capture(core,p,r,before_query=budget)
   second=record_snapshot.capture(core,p,r,before_query=budget)
   need(record_snapshot.same(first,second),'CHANNEL_DATABASE_NOT_STABLE')
   put_once(out/'preserved-record-digests.json',encoded(first))
   budget();core.shutdown_mysql(p,r);core.await_exit(core.read(p/'mysql-process.json')['ProcessId'])
   result['mysqlGracefulExitVerified']=True
  for port in [r['config']['webPort'],r['config']['mysqlPort']]:core.port_available(port)
  need(all((p/n).read_bytes()==data for n,data in original.items()),'CHANNEL_PRESERVED_EVIDENCE_CHANGED')
  result.update(state='OWNED_SERVICES_STOPPED_HOLD_UNCHANGED',
                priorShutdownWasNormal=False,finishedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat())
  # "Originally absent" is not evidence about how the previous process exited.
  put_once(out/'result.json',encoded(result))
  need(lock.read_bytes()==owner,'CHANNEL_SERVICE_STOP_LOCK_CHANGED')
  os.close(fd);fd=None;lock.unlink();return result
 except Exception as error:
  import re
  code=str(error);code=code if re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code) else 'CHANNEL_SERVICE_STOP_UNCONFIRMED'
  put_once(out/'failure.json',encoded({'code':code,'automaticRetry':False,'holdChanged':False}));raise
 finally:
  if fd is not None:os.close(fd)


class UserServiceSession(RuntimeProbe):
 fence_operation='PREPARE_CLOSED'

 def checkpoint(self,phase):
  self.lifecycle_phase=phase
  self.c.write(self.p/'product-lifecycle.json',{'contract':'FOCURVE_PRODUCT_LIFECYCLE_EVIDENCE_1',
   'phase':phase,'installationId':self.r['id'],'extensionId':self.r['extensionId'],
   'launchId':self.r['launchId'],'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
   'stage':self.stage,'servicesStoppedVerified':phase=='STOPPED_VERIFIED'})

 def prepare(self):
  result=super().prepare();self.restored_record_contents=False
  after=record_snapshot.capture(self.c,self.p,self.r,before_query=lambda:self.budget(30))
  proof=self.p/'last-record-digests.json'
  if proof.exists():
   before=self.c.read(proof)
   need(record_snapshot.same(before,after),'APPLICATION_RECORD_CONTENT_CHANGED_AFTER_RESTART')
   self.restored_record_contents=any(v['rows']>0 for v in before['tables'].values())
   self.r['lastApplicationRecordRestore']={'matched':True,'nonempty':self.restored_record_contents,
                                         'scope':'DECLARED_SESSION_ACCESS_INTERVAL_FIELDS_NO_CREDENTIALS'}
   self.c.write(self.p/'installation.json',self.r)
  return result

 def before_shutdown(self):
  self.own_ready_marker()
  self.c.write(self.p/'last-record-digests.json',record_snapshot.capture(self.c,self.p,self.r,before_query=lambda:self.budget(30)))

 def own_ready_marker(self):
  marker=self.p/'admission.ready'
  need(marker.is_file() and not marker.is_symlink() and
       self.c.read(marker)=={'launchId':self.r['launchId']},'PRODUCT_READY_SCOPE_MISMATCH')
  return marker

 def after_shutdown(self):
  # This is normal lifecycle bookkeeping, after fresh local/DB checks and
  # confirmed Server/MySQL exits. Never reached from a failed/UNKNOWN stop.
  self.own_ready_marker().unlink()

 def open_services(self):
  self.budget(900)
  self.prepare()
  self.budget(900)
  r=self.r;p=self.p
  reply=self.exchange('OPEN_PREPARED',{'launchId':r['launchId'],'launchDeadlineUTC':r['launchDeadlineUTC']})
  self.c.verify_ready_reply(reply,r)
  # Publish the server's READY marker before removing its start fence.
  need((p/'admission.closed').is_file() and not (p/'admission.ready').exists(),'PRODUCT_ADMISSION_MARKERS_CHANGED')
  self.c.write(p/'admission.ready',{'launchId':r['launchId']})
  (p/'admission.closed').unlink()
  r['status']='PRODUCT_RUNNING_USER_SESSION';self.c.write(p/'installation.json',r)
  self.checkpoint('READY_ACKNOWLEDGED')
  self.channel.send({'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'SESSION_READY',
                     'result':{'origin':r['origin'],'launchId':r['launchId'],
                               'launchDeadlineUTC':r['launchDeadlineUTC'],'automaticSTART_END':False,
                               'restoredRecordContents':getattr(self,'restored_record_contents',False)}})

 def await_stop(self):
  # Leave at least four minutes for request drain, current safety and shutdown.
  while datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=6)<self.end:
   need(not (self.p/'STOP').exists(),'PRODUCT_STOP_REQUEST_REQUIRES_SAFE_HOLD')
   try:q=self.channel.read(1)
   except RuntimeError as e:
    if str(e)=='PRODUCT_NATIVE_REPLY_TIMEOUT':continue
    raise
   need(type(q) is dict and set(q)=={'contract','operation','installationId','extensionId','launchId'} and
        q['contract']=='FOCURVE_RUNTIME_PROBE_1' and q['operation']=='STOP_USER_SESSION' and
        q['installationId']==self.r['id'] and q['extensionId']==self.r['extensionId'] and
        q['launchId']==self.r['launchId'],'PRODUCT_USER_SESSION_COMMAND_REJECTED')
   return 'USER_REQUEST'
  return 'DEADLINE_RESERVE'

 def run(self):
  self.budget(900);p=self.p;lock=p/'product-runtime.lock'
  fd=self.claim_lock(lock);normal=False
  try:
   self.open_services();self.stop_reason=self.await_stop();self.checkpoint('STOP_REQUESTED')
   self.channel.send({'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'STOPPING',
                      'installationId':self.r['id'],'extensionId':self.r['extensionId'],
                      'launchId':self.r['launchId'],'reason':self.stop_reason})
   self.stop();self.checkpoint('STOPPED_VERIFIED');normal=True
   return {'state':'USER_SESSION_STOPPED','servicesRunning':False,'focusAdmission':'CLOSED',
           'automaticSTART_END':False,'normalShutdowns':1,'restartVerified':False,
           'userRecordContentsVerified':getattr(self,'restored_record_contents',False)}
  except Exception:
   if self.r is not None:
    (p/'admission.closed').touch(exist_ok=True)
    self.r['status']='PRODUCT_HOLD_PRESERVED';self.c.write(p/'installation.json',self.r)
   raise
  finally:
   os.close(fd)
   if normal:lock.unlink()
