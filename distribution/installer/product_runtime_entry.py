"""Native-host-only product runtime entry. No user CLI or AI observer mode."""
import datetime,hashlib,importlib.util,json,os,pathlib,queue,sys,threading
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from product_native_protocol import decode_frame,encode_frame,ProductProtocolError
from product_runtime import RuntimeProbe,RuntimeBusy
from product_user_session import UserServiceSession
from product_hold_recovery import ProductHoldRecovery
def preserve_launch_failure(installation,request,probe,failure):
 """Evidence only: retain this launch's first failure, never replace history."""
 try:
  import re
  from hold_recovery import safe_path,put_once,encoded,digest
  if request.get('operation')!='OPEN_USER_SESSION':return
  p=safe_path(installation);record=getattr(probe,'r',None)
  if not isinstance(record,dict) or record.get('id')!=p.name or request.get('installationId')!=p.name or request.get('extensionId')!=record.get('extensionId'):return
  launch=record.get('launchId','')
  if not isinstance(launch,str) or not re.fullmatch('[a-f0-9]{32}',launch):return
  directory=safe_path(p/'product-runtime-failures'/launch)
  directory.mkdir(parents=True,exist_ok=True)
  target=directory/'first-failure.json'
  value={**failure,'launchId':launch,'installationId':p.name,'extensionId':record['extensionId'],
         'evidenceOnly':True,'automaticRetry':False,
         'originalFailureSHA256':digest(p/'product-runtime-first-failure.json')}
  # The first failure of a launch is immutable. This grants no HOLD transition,
  # cleanup, retry, authentication or service authority.
  if not target.exists():put_once(target,encoded(value))
 except Exception:pass # Preserve the original rejection even if evidence I/O fails.

def preserve_hold_rejection(core,installation,request,probe,code):
 """Preserve a bounded preflight rejection without replacing the first failure.

 This is evidence only: no transition, process, auth or gate is changed.
 Diagnostics failure must not replace the original rejection sent to Chrome.
 """
 if request.get('operation')!='RECOVER_PRODUCT_HOLD':return
 try:
  import re
  from hold_recovery import safe_path,put_once,encoded,digest
  p=safe_path(installation);file=p/'control/native-link/product-hold-grant.json'
  grant=core.read(file);binding=core.read(p/'control/native-link/binding.json');op=grant.get('operationId','')
  if not re.fullmatch('[a-f0-9]{32}',op) or binding.get('runtimeFiles',{}).get('control/native-link/product-hold-grant.json')!=digest(file):return
  if request.get('installationId')!=p.name or request.get('extensionId')!=binding.get('extensionId'):return
  directory=safe_path(p/'product-hold-diagnostics'/op);directory.mkdir(parents=True,exist_ok=True)
  stage=getattr(probe,'stage','INITIAL');stage=stage if isinstance(stage,str) and re.fullmatch('[A-Z][A-Z0-9_]{0,80}',stage) else 'UNSPECIFIED'
  code=code if isinstance(code,str) and re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code) else 'PRODUCT_RUNTIME_UNCONFIRMED'
  if set(request)!={'contract','operation','installationId','extensionId'} or request['contract']!='FOCURVE_RUNTIME_PROBE_1':return
  request_id=hashlib.sha256(encoded(request)).hexdigest()
  reply={'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'FAILED','code':code,'operationId':op,'requestId':request_id}
  response_id=hashlib.sha256(encoded(reply)).hexdigest()
  reply['responseId']=response_id
  target=directory/'first-rejection.json'
  if not target.exists():put_once(target,encoded({'contract':'FOCURVE_PRODUCT_HOLD_REJECTION_1','operationId':op,
    'installationId':p.name,'code':code,'stage':stage,'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'requestId':request_id,'responseId':response_id,'idFormat':'SHA256_ENCODED_JSON_RESPONSE_EXCLUDES_RESPONSE_ID',
    'phase':'PREFLIGHT' if getattr(probe,'work',None) is None else 'TRANSITION',
    'originalFailureSHA256':digest(p/'product-runtime-first-failure.json'),'transitionRetried':False}))
  saved=core.read(target)
  if saved.get('requestId')==request_id and saved.get('responseId')==response_id:return reply
 except Exception:pass
class Channel:
 def __init__(self,input_stream=None,output_stream=None):
  # A daemon holding sys.stdin.buffer's lock can crash CPython during normal
  # interpreter shutdown while Chrome still owns the input pipe. Use a private
  # unbuffered duplicate; framing handles short reads explicitly.
  self.owns_input=input_stream is None
  self.input=os.fdopen(os.dup(sys.stdin.fileno()),'rb',buffering=0) if self.owns_input else input_stream
  self.output=sys.stdout.buffer if output_stream is None else output_stream
  self.messages=queue.Queue();self.closed=threading.Event();self.reason=None
  def reader():
   try:
    while True:self.messages.put(decode_frame(self.input))
   except Exception as error:
    # Record bounded protocol reasons only; never store a raw frame or exception.
    self.reason=str(error) if isinstance(error,ProductProtocolError) else 'PRODUCT_CHANNEL_READ_FAILED'
    self.closed.set();self.messages.put(None)
   finally:
    if self.owns_input:self.input.close()
  threading.Thread(target=reader,daemon=True).start()
 def transport_status(self):return {'closed':self.closed.is_set(),'reason':self.reason}
 def send(self,message):
  try:self.output.write(encode_frame(message));self.output.flush()
  except OSError:raise RuntimeError('PRODUCT_CHANNEL_WRITE_FAILED') from None
 def read(self,timeout):
  if self.closed.is_set() and self.messages.empty():raise RuntimeError(self.reason)
  try:value=self.messages.get(timeout=timeout)
  except queue.Empty:raise RuntimeError('PRODUCT_NATIVE_REPLY_TIMEOUT') from None
  if value is None:raise RuntimeError(self.reason)
  return value
 def exchange(self,message,timeout):self.send(message);return self.read(timeout)
def main():
 if os.name!='nt':raise RuntimeError('WINDOWS_REQUIRED')
 import msvcrt
 msvcrt.setmode(sys.stdin.fileno(),os.O_BINARY);msvcrt.setmode(sys.stdout.fileno(),os.O_BINARY)
 here=pathlib.Path(__file__).resolve().parent;p=here.parent.parent
 spec=importlib.util.spec_from_file_location('product_owned_install_core',here/'install_core.py');c=importlib.util.module_from_spec(spec);sys.modules[spec.name]=c;spec.loader.exec_module(c)
 record=c.read(p/'installation.json');c.require(c.child(c.installations(),record['id'])==p,'PRODUCT_INSTALLATION_PATH_MISMATCH');c.verify_installed_payload(p,record)
 parent=int(c.run(['powershell.exe','-NoProfile','-Command',f'(Get-CimInstance Win32_Process -Filter "ProcessId={os.getpid()}").ParentProcessId'],text=True).stdout.strip())
 owner=c.process_identity(parent);expected=p/'control/native-link/FOCURVE.NativeLink.exe';c.require(pathlib.Path(owner['ExecutablePath']).resolve()==expected.resolve(),'PRODUCT_NATIVE_PARENT_REQUIRED')
 c.verify_process(p,'chrome')
 binding=c.read(p/'control/native-link/binding.json');c.require(binding.get('allowRuntimeProbe') is True,'PRODUCT_RUNTIME_NOT_APPROVED')
 channel=Channel();request=channel.read(5)
 c.require(type(request) is dict and set(request)=={'contract','operation','installationId','extensionId'} and request.get('contract')=='FOCURVE_RUNTIME_PROBE_1' and request.get('operation') in ['VERIFY_RUNTIME','OPEN_USER_SESSION','RECOVER_PRODUCT_HOLD'] and request.get('installationId')==record['id'] and request.get('extensionId')==record['extensionId'],'PRODUCT_RUNTIME_COMMAND_REJECTED')
 user_session=request['operation']=='OPEN_USER_SESSION'
 c.require(not user_session or binding.get('allowUserSession') is True,'PRODUCT_USER_SESSION_NOT_APPROVED')
 recovery=request['operation']=='RECOVER_PRODUCT_HOLD'
 c.require(not recovery or binding.get('allowProductHoldRecovery') is True,'PRODUCT_HOLD_RECOVERY_NOT_APPROVED')
 probe=(ProductHoldRecovery if recovery else UserServiceSession if user_session else RuntimeProbe)(c,p,binding['notAfterUTC'],channel)
 try:
  result=probe.run();channel.send({'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'COMPLETE','result':result})
 except RuntimeBusy:
  # A second controller has acquired nothing and must not poison the first
  # session's evidence or mutate its installation status/lock.
  channel.send({'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'REJECTED',
                'code':'PRODUCT_OPERATION_ALREADY_ACTIVE'})
 except Exception as error:
  import re
  code=str(error);code=code if re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code) else 'PRODUCT_RUNTIME_UNCONFIRMED'
  failure=p/'product-runtime-first-failure.json'
  observed={'code':code,'exceptionType':type(error).__name__,'stage':getattr(probe,'stage','UNSPECIFIED'),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'preserved':True,'transport':channel.transport_status(),'stopReason':getattr(probe,'stop_reason',None),'lifecyclePhase':getattr(probe,'lifecycle_phase','UNCONFIRMED'),'launchId':(getattr(probe,'r',None) or record).get('launchId'),'shutdownVerified':getattr(probe,'lifecycle_phase',None)=='STOPPED_VERIFIED'}
  if not failure.exists():c.write(failure,observed)
  preserve_launch_failure(p,request,probe,observed)
  diagnostic=preserve_hold_rejection(c,p,request,probe,code)
  channel.send(diagnostic or {'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'FAILED','code':code})
if __name__=='__main__':
 sys.dont_write_bytecode=True
 # Only a fixed, installer-pinned source directory is imported.
 main()
