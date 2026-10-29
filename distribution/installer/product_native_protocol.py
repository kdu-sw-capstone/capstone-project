"""Product-owned Native Messaging framing/registration plan, not an AI observer.

No browser debugger, network listener, registry writes or service execution.
There is deliberately no BrowserBridge adapter, CLI state export or fallback.
"""
import dataclasses,datetime,json,pathlib,re,struct
MAX_FRAME=32768
class ProductProtocolError(RuntimeError):pass
class ProductChannelClosed(ProductProtocolError):pass
def need(ok,code):
 if not ok:raise ProductProtocolError(code)
def read_exact(stream,size):
 parts=[];remaining=size
 while remaining:
  piece=stream.read(remaining)
  if not piece:break
  parts.append(piece);remaining-=len(piece)
 return b''.join(parts)

def decode_frame(stream):
 header=read_exact(stream,4)
 if not header:raise ProductChannelClosed('PRODUCT_CHANNEL_CLOSED')
 need(len(header)==4,'NATIVE_FRAME_HEADER_INCOMPLETE')
 n=struct.unpack('=I',header)[0];need(0<n<=MAX_FRAME,'NATIVE_FRAME_SIZE_REJECTED')
 raw=read_exact(stream,n);need(len(raw)==n,'NATIVE_FRAME_BODY_INCOMPLETE')
 try:value=json.loads(raw.decode('utf-8'),object_pairs_hook=unique_pairs)
 except (ValueError,UnicodeError):raise ProductProtocolError('NATIVE_FRAME_JSON_REJECTED') from None
 need(type(value) is dict,'NATIVE_FRAME_OBJECT_REQUIRED');return value

def unique_pairs(pairs):
 d={}
 for key,value in pairs:
  if key in d:raise ValueError('duplicate key')
  d[key]=value
 return d

def encode_frame(value):
 need(type(value) is dict,'NATIVE_FRAME_OBJECT_REQUIRED')
 raw=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')
 need(0<len(raw)<=MAX_FRAME,'NATIVE_FRAME_SIZE_REJECTED');return struct.pack('=I',len(raw))+raw

def registration_plan(installation_id,extension_id,host_executable):
 need(bool(re.fullmatch('[a-f0-9]{32}',installation_id)),'INSTALLATION_ID_INVALID')
 need(bool(re.fullmatch('[a-p]{32}',extension_id)),'EXTENSION_ID_INVALID')
 host=pathlib.PureWindowsPath(host_executable)
 need(host.is_absolute() and host.suffix.lower()=='.exe','NATIVE_HOST_EXECUTABLE_REQUIRED')
 name='com.focurve.install_'+installation_id
 return {'manifest':{'name':name,'description':'FOCURVE product lifecycle','path':str(host),'type':'stdio','allowed_origins':['chrome-extension://'+extension_id+'/']},'registryScope':'HKCU','registryKey':'Software\\Google\\Chrome\\NativeMessagingHosts\\'+name,'extensionPermissionRequired':'nativeMessaging','registered':False}

@dataclasses.dataclass(frozen=True)
class Scope:
 installation_id:str
 extension_id:str
 profile_digest:str
 launch_id:str
 deadline:datetime.datetime

@dataclasses.dataclass(frozen=True)
class Peer:
 # Must be obtained from Windows process/token/creation-time and payload
 # verification, never populated from a Chrome JSON assertion.
 extension_origin:str
 installation_id:str
 profile_digest:str
 process_verified:bool
 payload_verified:bool

class ProductLifecycle:
 """In-process lifecycle contract. Native host/OS adapters not yet integrated.

The product performs checks itself. Commands contain no paths, shell, scripts,
credentials, DB queries or local-state dump. No session START/END is exposed.
 """
 def __init__(self,scope,backend,local,now,nonce):
  self.scope=scope;self.backend=backend;self.local=local;self.now=now;self.nonce=nonce
  self.phase='CLOSED';self.expected_sequence=1
 def validate(self,request,peer):
  s=self.scope
  need(type(request) is dict and set(request)=={'contract','installationId','launchId','nonce','sequence','operation'},'PRODUCT_COMMAND_SHAPE_REJECTED')
  need(request['contract']=='FOCURVE_PRODUCT_LIFECYCLE_1','PRODUCT_COMMAND_VERSION_REJECTED')
  need(peer.process_verified is True and peer.payload_verified is True,'PRODUCT_PEER_UNVERIFIED')
  need(peer.extension_origin=='chrome-extension://'+s.extension_id+'/' and peer.installation_id==s.installation_id and peer.profile_digest==s.profile_digest,'PRODUCT_PEER_BINDING_MISMATCH')
  need(request['installationId']==s.installation_id and request['launchId']==s.launch_id,'PRODUCT_LAUNCH_BINDING_MISMATCH')
  need(type(request['nonce']) is str and request['nonce']==self.nonce,'PRODUCT_NONCE_MISMATCH')
  need(type(request['sequence']) is int and request['sequence']==self.expected_sequence,'PRODUCT_REPLAY_OR_ORDER_MISMATCH')
  need(self.now().tzinfo is not None and s.deadline.tzinfo is not None and self.now()<s.deadline,'PRODUCT_DEADLINE_EXPIRED')
  need(request['operation'] in {'PREPARE_RUNTIME','STOP_RUNTIME'},'PRODUCT_OPERATION_REJECTED')
 def handle(self,request,peer):
  # Untrusted/malformed requests cannot affect a valid running lifecycle.
  self.validate(request,peer)
  op=request['operation']
  need((op=='PREPARE_RUNTIME' and self.phase=='CLOSED') or (op=='STOP_RUNTIME' and self.phase=='READY'),'PRODUCT_PHASE_MISMATCH')
  self.expected_sequence+=1
  try:
   if op=='PREPARE_RUNTIME':
    need(self.local.clear() is True,'PRODUCT_LOCAL_NOT_CLEAR')
    # Backend is bound to this installation and checks ownership, collision,
    # fresh DB obligations, health, STOP, approval and the same fixed deadline.
    self.backend.prepare(self.scope)
    need(self.backend.clear() is True,'PRODUCT_DATABASE_NOT_CLEAR')
    need(self.local.clear() is True,'PRODUCT_LOCAL_CHANGED')
    self.local.admit(self.scope)
    self.backend.admit(self.scope)
    self.phase='READY'
   else:
    # Do not END or restore a session. Fence new work, then check obligations.
    self.backend.quiesce();self.local.quiesce()
    need(self.local.clear() is True,'PRODUCT_LOCAL_NOT_CLEAR')
    need(self.backend.clear() is True,'PRODUCT_DATABASE_NOT_CLEAR')
    self.backend.stop_normal();self.phase='STOPPED'
   return {'contract':'FOCURVE_PRODUCT_LIFECYCLE_1','state':self.phase}
  except Exception:
   self.phase='HOLD_PRESERVED'
   # No rollback, END, cleanup, retry, recovery or fallback.
   raise
