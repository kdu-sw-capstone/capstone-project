"""Bounded metadata recovery. Never starts services, repairs sessions or grants READY.

Observations are obtained from a trusted runtime during this operation. JSON supplied
by a caller, old safety reports and an approval alone are not observation providers.
"""
from __future__ import annotations
import dataclasses,datetime,hashlib,json,os,pathlib,re,uuid

CONTRACT='FOCURVE_HOLD_RECOVERY_1'
SCOPE='RECOVER_PRE_SERVER_HOLD'
COUNTS=('activeSessions','unresolvedBindings','unreleasedJournals','pendingLeases','pendingOutbox','pendingImports','transitions','rootClaims','sessionRules','dynamicRules')
RECOVERABLE=frozenset({'EXTENSION_NOT_REGISTERED','EXTENSION_IDENTITY_UNCONFIRMED','USER_EXTENSION_INSTALL_TIME_LIMIT'})
class RecoveryError(RuntimeError):pass
def need(ok,code):
 if not ok:raise RecoveryError(code)
def digest_bytes(b):return hashlib.sha256(b).hexdigest()
def digest(p):return digest_bytes(pathlib.Path(p).read_bytes())
def encoded(v):return (json.dumps(v,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf8')
def read(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def instant(v):
 try:d=datetime.datetime.fromisoformat(v)
 except (TypeError,ValueError):raise RecoveryError('INVALID_TIME') from None
 need(d.tzinfo is not None,'INVALID_TIME');return d.astimezone(datetime.timezone.utc)
def safe_path(p):
 p=pathlib.Path(p).absolute()
 for x in [p,*p.parents]:need(not x.is_symlink() and not (hasattr(x,'is_junction') and x.is_junction()),'PATH_ALIAS_DENIED')
 return p.resolve()
def atomic_write(p,data):
 p=pathlib.Path(p);tmp=p.with_name(p.name+'.tmp-'+uuid.uuid4().hex)
 try:
  with tmp.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.replace(tmp,p)
 finally:
  if tmp.exists():tmp.unlink() # Only this operation's exact temporary file.
def put_once(p,data):
 with pathlib.Path(p).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())

@dataclasses.dataclass(frozen=True)
class Grant:
 operation_id:str
 installation_id:str
 expected_hold_sha256:str
 not_before_utc:str
 not_after_utc:str
 owner_id:str
 approved:bool=False
 scope:str=SCOPE

def binding(p,r):
 return {'installationId':r['id'],'profile':str((p/'profile').resolve()),'extensionId':r['extensionId'],'api':r['origin']+'/api/v1','origin':r['origin'],'schema':r['schema'],'callback':r['callback']}

def classify(r):
 need(r.get('status')=='ACCEPTANCE_HOLD_PRESERVED','NOT_RECOVERABLE_HOLD')
 h=r.get('hold')
 need(type(h) is dict and h.get('contract')=='FOCURVE_HOLD_CAUSE_1','HOLD_CAUSE_UNCLASSIFIED')
 need(h.get('installationId')==r.get('id') and h.get('launchId')==r.get('launchId'),'HOLD_CAUSE_IDENTITY_MISMATCH')
 need(h.get('phase')=='PRE_SERVER_START' and h.get('focusStartPerformed') is False,'UNSAFE_FAILURE_PHASE')
 need(h.get('code') in RECOVERABLE,'FAILURE_NOT_RECOVERABLE')
 return h['code']

def approve(p,r,g,now):
 need(type(g) is Grant and g.approved is True and g.scope==SCOPE,'RECOVERY_APPROVAL_REQUIRED')
 need(re.fullmatch('[a-f0-9]{32}',g.operation_id or '') and g.owner_id,'RECOVERY_OWNER_REQUIRED')
 need(g.installation_id==r.get('id') and p.name==r.get('id'),'INSTALLATION_ID_MISMATCH')
 need(re.fullmatch('[a-f0-9]{64}',g.expected_hold_sha256 or ''),'EXPECTED_HOLD_HASH_REQUIRED')
 begin,end=instant(g.not_before_utc),instant(g.not_after_utc)
 need(begin<=now<end and 0<(end-begin).total_seconds()<=3600,'RECOVERY_APPROVAL_EXPIRED_OR_INVALID')
 need(g.operation_id!=r.get('launchId'),'NEW_RECOVERY_OPERATION_REQUIRED')

def fresh(obs,kind,b,nonce,now):
 need(type(obs) is dict and obs.get('contract')==kind,'OBSERVATION_CONTRACT_UNCONFIRMED')
 allowed={'contract','binding','nonce','observedAtUTC','result'} if kind=='FOCURVE_CURRENT_LOCAL_OBSERVATION_1' else {'contract','binding','nonce','observedAtUTC','readOnlyTransaction','consistentSnapshot','counts'}
 need(set(obs)==allowed,'UNEXPECTED_OBSERVATION_FIELDS')
 need(obs.get('binding')==b and obs.get('nonce')==nonce,'OBSERVATION_IDENTITY_MISMATCH')
 seen=instant(obs.get('observedAtUTC'));need(0<=(now-seen).total_seconds()<=15,'OBSERVATION_STALE')

def local_clear(obs,b,nonce,now):
 fresh(obs,'FOCURVE_CURRENT_LOCAL_OBSERVATION_1',b,nonce,now)
 r=obs.get('result',{});cover=r.get('coverage',{})
 need(type(r) is dict and set(r)<= {'contract','gate','issues','counts','identity','coverage','resources','elapsedMs','observedAtUTC'} and {'contract','gate','issues','counts','identity','coverage','resources'}<=set(r),'UNEXPECTED_LOCAL_FIELDS')
 need(set(r.get('identity',{}))=={'document','deployment','installation','profile'} and set(cover)<= {'requiredDatabases','observedDatabases','schemaVersion','doubleReadStable','atomicAcrossDatabases'} and set(r.get('resources',{}))=={'openConnections','activeReadTransactions','pendingNativeCalls'},'UNEXPECTED_LOCAL_FIELDS')
 need('elapsedMs' not in r or type(r['elapsedMs']) is int and 0<=r['elapsedMs']<=15000,'UNEXPECTED_LOCAL_FIELDS')
 if 'observedAtUTC' in r:instant(r['observedAtUTC'])
 required={'R4_GUEST_LOCAL_SAFETY_1':3,'R3_LOCAL_SAFETY_2':5}.get(r.get('contract'))
 need(required is not None and r.get('gate')=='CLEAR_LOCAL_ONLY' and r.get('issues')==[],'LOCAL_STATE_NOT_CLEAR')
 need(set(r.get('counts',{}))==set(COUNTS) and all(type(r['counts'][k]) is int and r['counts'][k]==0 for k in COUNTS),'LOCAL_OBLIGATIONS_PRESENT_OR_UNKNOWN')
 need(all(r.get('identity',{}).get(k) is True for k in ['document','deployment','installation','profile']),'LOCAL_IDENTITY_UNCONFIRMED')
 need(cover.get('doubleReadStable') is True and cover.get('schemaVersion')==1 and cover.get('requiredDatabases')==required and type(cover.get('observedDatabases')) is int and cover['observedDatabases']>=required,'LOCAL_COVERAGE_UNCONFIRMED')
 need(all(type(r.get('resources',{}).get(k)) is int and r['resources'][k]==0 for k in ['openConnections','activeReadTransactions','pendingNativeCalls']),'LOCAL_RESOURCES_NOT_CLOSED')

def db_clear(obs,b,nonce,now):
 fresh(obs,'FOCURVE_CURRENT_DATABASE_OBSERVATION_1',b,nonce,now)
 need(obs.get('readOnlyTransaction') is True and obs.get('consistentSnapshot') is True,'DATABASE_OBSERVATION_NOT_READ_ONLY')
 c=obs.get('counts',{});need(set(c)=={'activeSessions','locks','unresolvedReceipts'} and all(type(x) is int and x==0 for x in c.values()),'DATABASE_OBLIGATIONS_PRESENT_OR_UNKNOWN')

def record_failure(p,r,code):
 """Typed only by the exact pre-server installer stage; never inferred from text."""
 need(code in RECOVERABLE,'FAILURE_NOT_RECOVERABLE')
 h={'contract':'FOCURVE_HOLD_CAUSE_1','installationId':r['id'],'launchId':r.get('launchId'),'phase':'PRE_SERVER_START','focusStartPerformed':False,'code':code}
 f=p/'first-start-failure.json'
 if f.exists():need(read(f)==h,'FIRST_FAILURE_ALREADY_PRESERVED')
 else:put_once(f,encoded(h))
 r['hold']=h

def assess(p,runtime):
 """Read-only classification; no browser, DB, lock or credential activity."""
 p=safe_path(p);r=read(p/'installation.json');runtime.verify_target(p,r)
 try:reason=classify(r)
 except RecoveryError as e:return {'status':'BLOCKED','code':str(e),'execution':False}
 return {'status':'ELIGIBLE_FOR_CURRENT_CHECKS_ONLY','cause':reason,'execution':False,'required':['scoped approval','policy-permitted current local observation','owned online database current read-only snapshot','exclusive ownership','unchanged payload/evidence','unexpired operation'],'browserPolicyCleared':False}

def recover(p,g,runtime):
 p=safe_path(p);record=safe_path(p/'installation.json');raw=record.read_bytes();r=json.loads(raw.decode('utf-8-sig'))
 runtime.verify_target(p,r);approve(p,r,g,runtime.now())
 work=safe_path(p/'hold-recovery'/g.operation_id)
 # Idempotence returns a past receipt, never a fresh safety/START permission.
 if work.exists():
  journal=read(work/'journal.json') if (work/'journal.json').exists() else {}
  need(journal.get('grant')==dataclasses.asdict(g),'RECOVERY_REQUEST_CONFLICT')
  if journal.get('phase')=='COMMITTED':
   need(digest(record)==journal.get('committedRecordSHA256'),'RECOVERY_COMMIT_CHANGED')
   return {**read(work/'receipt.json'),'replayed':True,'startAuthorized':False}
  raise RecoveryError('RECOVERY_INCOMPLETE_PRESERVED_NO_RETRY')
 need(digest_bytes(raw)==g.expected_hold_sha256,'HOLD_RECORD_CHANGED')
 cause=classify(r);runtime.require_observer() # No fallback to another driver/file.
 need(not any((p/n).exists() for n in ['STOP','start.lock','stop.lock']),'STOP_OR_OTHER_OPERATION_PRESENT')
 lock=p/'hold-recovery.lock'
 try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 except FileExistsError:raise RecoveryError('RECOVERY_ALREADY_ACTIVE') from None
 journal=None;originals={};committed=False
 try:
  os.write(fd,encoded({'operation':g.operation_id,'owner':g.owner_id}));os.fsync(fd)
  runtime.verify_payload(p,r);runtime.verify_owners(p,r)
  need(digest(record)==g.expected_hold_sha256,'HOLD_RECORD_CHANGED')
  # Archive only public, fixed-name records; never raw diagnostics or secrets.
  for name in ['installation.json','first-start-failure.json','first-stop-failure.json','hold-reason.json']:
   f=p/name
   if f.exists():safe_path(f);originals[name]=f.read_bytes()
  need('first-start-failure.json' in originals and read(p/'first-start-failure.json')==r['hold'],'FIRST_FAILURE_CAUSE_UNCONFIRMED')
  safe_path(p/'hold-recovery');work.mkdir(parents=True,exist_ok=False)
  for name,data in originals.items():put_once(work/(name+'.before'),data)
  journal={'contract':CONTRACT,'phase':'PREPARED','grant':dataclasses.asdict(g),'cause':cause,'originalHashes':{n:digest_bytes(v) for n,v in originals.items()}}
  atomic_write(work/'journal.json',encoded(journal))
  b=binding(p,r);nonce=uuid.uuid4().hex
  runtime.verify_grant_owner(g)
  local=runtime.observe_local(p,r,b,nonce,g);local_clear(local,b,nonce,runtime.now());approve(p,r,g,runtime.now())
  database=runtime.observe_database(p,r,b,nonce,g);db_clear(database,b,nonce,runtime.now())
  # Recheck only after the current DB observation; no effects were authorized.
  last=runtime.confirm_local(p,r,b,nonce,g);local_clear(last,b,nonce,runtime.now())
  runtime.verify_payload(p,r);runtime.verify_owners(p,r);runtime.verify_grant_owner(g)
  approve(p,r,g,runtime.now());db_clear(database,b,nonce,runtime.now())
  need(not any((p/n).exists() for n in ['STOP','start.lock','stop.lock']),'STOP_OR_OTHER_OPERATION_PRESENT')
  need(digest(record)==g.expected_hold_sha256,'HOLD_RECORD_CHANGED')
  need(all((p/n).read_bytes()==v for n,v in originals.items()),'FAILURE_EVIDENCE_CHANGED')
  receipt={'contract':CONTRACT,'operationId':g.operation_id,'installationId':r['id'],'cause':cause,'binding':b,'observedLocal':last,'observedDatabase':database,'recoveredAtUTC':runtime.now().isoformat(),'approvalNotAfterUTC':g.not_after_utc,'browserPolicyCleared':False,'startAuthorized':False,'replayed':False}
  put_once(work/'receipt.json',encoded(receipt))
  updated={**r,'status':'INSTALLED','holdRecovery':{'operationId':g.operation_id,'receiptSHA256':digest(work/'receipt.json'),'originalRecordSHA256':g.expected_hold_sha256,'approvalNotAfterUTC':g.not_after_utc,'startAuthorized':False}}
  # Hold cause, launch ID/deadline, credentials and every business store survive.
  data=encoded(updated);journal.update(phase='COMMITTING',committedRecordSHA256=digest_bytes(data));atomic_write(work/'journal.json',encoded(journal))
  runtime.before_commit()
  approve(p,r,g,runtime.now());need(digest(record)==g.expected_hold_sha256,'HOLD_RECORD_CHANGED')
  local_clear(last,b,nonce,runtime.now());db_clear(database,b,nonce,runtime.now())
  need(not any((p/n).exists() for n in ['STOP','start.lock','stop.lock']),'STOP_OR_OTHER_OPERATION_PRESENT')
  need(all((p/n).read_bytes()==v for n,v in originals.items()),'FAILURE_EVIDENCE_CHANGED')
  atomic_write(record,data);committed=True
  journal['phase']='COMMITTED';atomic_write(work/'journal.json',encoded(journal))
  return receipt
 except Exception as e:
  if journal is not None:
   # No rollback or automatic replay after a possibly committed metadata write.
   journal.update(phase='COMMIT_UNCONFIRMED' if committed else 'FAILED_PRESERVED',error=str(e) if isinstance(e,RecoveryError) else 'RECOVERY_OPERATION_UNCONFIRMED')
   try:atomic_write(work/'journal.json',encoded(journal))
   except OSError:pass
  if isinstance(e,RecoveryError):raise
  raise RecoveryError('RECOVERY_OPERATION_UNCONFIRMED') from None
 finally:
  os.close(fd)
  # Remove only a lock whose exact owner remains ours; never steal a stale lock.
  try:
   if read(lock)=={'operation':g.operation_id,'owner':g.owner_id}:lock.unlink()
  except (OSError,ValueError):pass

def verify_recovered_start(p,r,not_after_utc,now,policy_permitted):
 """Recovery is not START approval. Existing normal launch safety still applies."""
 ref=r.get('holdRecovery');need(type(ref) is dict,'RECOVERY_RECEIPT_REQUIRED')
 op=ref.get('operationId','');need(re.fullmatch('[a-f0-9]{32}',op),'RECOVERY_RECEIPT_INVALID')
 work=safe_path(pathlib.Path(p)/'hold-recovery'/op);j=read(safe_path(work/'journal.json'));receipt=read(safe_path(work/'receipt.json'))
 need(j.get('phase')=='COMMITTED' and digest(work/'receipt.json')==ref.get('receiptSHA256') and receipt.get('installationId')==r.get('id') and receipt.get('operationId')==op,'RECOVERY_RECEIPT_UNCONFIRMED')
 need(digest(pathlib.Path(p)/'installation.json')==j.get('committedRecordSHA256'),'RECOVERY_COMMIT_CHANGED')
 need(not_after_utc is not None and now<instant(not_after_utc)<=instant(receipt['approvalNotAfterUTC']),'FIXED_START_DEADLINE_REQUIRED')
 need(policy_permitted is True,'BROWSER_POLICY_NOT_VERIFIED')
 return True
