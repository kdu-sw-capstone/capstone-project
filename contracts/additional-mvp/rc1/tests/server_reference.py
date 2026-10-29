"""Server contract oracle only: no HTTP, credentials, application DB or browser access."""
import copy,json,hashlib
from dataclasses import dataclass
from threading import RLock

class Failure(ValueError):
    def __init__(self,code):self.code=code;super().__init__(code)
@dataclass(frozen=True)
class Principal:
    transport:str
    user:int|None
    executor:str|None=None
    epoch:int|None=None
    origin_ok:bool=True
    csrf_ok:bool=True
    authenticated:bool=True
@dataclass(frozen=True)
class Binding:
    id:str
    user:int
    executor:str
    epoch:int
    state:str='ACTIVE'

def authorize(actor,binding,*,current_user,current_epoch,mutation=False,historical=False,account_total=False):
    # Principal/current_* are trusted adapter inputs. Never populate them from request JSON.
    if not actor.authenticated or actor.user is None or actor.transport not in ('W','E'):raise Failure('UNAUTHENTICATED')
    if actor.transport=='W' and mutation and not(actor.origin_ok and actor.csrf_ok):raise Failure('CSRF_OR_ORIGIN')
    if actor.user!=binding.user:raise Failure('RESOURCE_NOT_FOUND')
    if account_total and actor.transport!='W':raise Failure('FORBIDDEN_ACCOUNT_SCOPE')
    if actor.transport=='E' and (actor.executor!=binding.executor or actor.epoch!=binding.epoch):raise Failure('FORBIDDEN_EXECUTOR')
    if historical and not mutation and actor.transport=='W':return True
    if current_user!=actor.user or current_epoch!=binding.epoch or binding.state!='ACTIVE':raise Failure('STALE_OWNER')
    return True

class ConfigStore:
    """Serialized transaction oracle; real InnoDB recipe tested separately in server_probe."""
    def __init__(self):self.lock=RLock();self.configs={};self.history=[];self.receipts={};self.outbox=[]
    def snapshot(self):return copy.deepcopy((self.configs,self.history,self.receipts,self.outbox))
    def write(self,actor,binding,id,expected,key,value,*,create=False,capability=True,fail_after_history=False):
        with self.lock:
            authorize(actor,binding,current_user=binding.user,current_epoch=binding.epoch,mutation=True)
            if not capability:raise Failure('CAPABILITY_NOT_VERIFIED')
            row=self.configs.get(id)
            if row and row['binding']!=binding.id:raise Failure('RESOURCE_NOT_FOUND')
            route='PUT /api/v1/amvp/configs/'+id;identity=(binding.id,route,key)
            semantic={'method':'PUT','path':route.split(' ',1)[1],'query':{},'if_none_match':'*' if create else None,'if_match':expected,'body':value}
            fingerprint=hashlib.sha256(json.dumps(semantic,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            if identity in self.receipts:
                old=self.receipts[identity]
                if old['hash']!=fingerprint:raise Failure('IDEMPOTENCY_CONFLICT')
                return copy.deepcopy(old['response'])
            if create:
                if row:raise Failure('VERSION_CONFLICT')
                if expected is not None:raise Failure('INVALID_PRECONDITION')
                version=1
            else:
                if not row:raise Failure('RESOURCE_NOT_FOUND')
                if expected is None:raise Failure('PRECONDITION_REQUIRED')
                if isinstance(expected,bool) or expected!=row['version']:raise Failure('VERSION_CONFLICT')
                if row['version']>=9007199254740991:raise Failure('VERSION_LIMIT')
                version=row['version']+1
            before=self.snapshot()
            try:
                self.configs[id]={'binding':binding.id,'version':version,'value':copy.deepcopy(value)}
                self.history.append((id,version,copy.deepcopy(value)))
                if fail_after_history:raise Failure('STORAGE_UNCONFIRMED')
                result={'version':version};self.outbox.append((binding.id,id,version))
                self.receipts[identity]={'hash':fingerprint,'response':copy.deepcopy(result)}
                return result
            except Exception:
                self.configs,self.history,self.receipts,self.outbox=before
                raise
