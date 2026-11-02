"""Installed product Native Messaging registration or normal stopped renewal.
No browser observation, CDP, session recovery or focus admission.
"""
import argparse,datetime,hashlib,importlib.util,json,os,pathlib,re,subprocess,sys,uuid

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def native_compiler(installation,record):
 """Resolve the existing compiler helper under isolated Python, from pinned files.

 -I omits the script directory. Never fall back to another checkout or cached
 module; the temporary search path is restored before any compiler invocation.
 """
 folder=(pathlib.Path(installation)/'control/installer').resolve()
 names=['product_runtime','hold_recovery','product_hold_recovery','product_hold_patch']
 expected={row['path']:row['sha256'] for row in record['payload']}
 for name in names:
  source=folder/(name+'.py')
  if not source.is_file() or source.is_symlink() or expected.get('control/installer/'+name+'.py')!=sha(source):raise RuntimeError('NATIVE_COMPILER_SOURCE_UNCONFIRMED')
  prior=sys.modules.get(name)
  if prior is not None and pathlib.Path(getattr(prior,'__file__','')).resolve()!=source:raise RuntimeError('NATIVE_COMPILER_MODULE_SCOPE_MISMATCH')
 previous=list(sys.path)
 try:
  sys.path.insert(0,str(folder))
  module=__import__('product_hold_patch')
  for name in names:
   if pathlib.Path(sys.modules[name].__file__).resolve()!=folder/(name+'.py'):raise RuntimeError('NATIVE_COMPILER_MODULE_SCOPE_MISMATCH')
  return module.compile_native
 finally:sys.path[:]=previous

def launcher_payload(p):
 return [{'path':n,'sha256':sha(p/n)} for n in
         ['Start-FOCURVE.cmd','Stop-FOCURVE.cmd','Dashboard.url','Connect-FOCURVE.cmd'] if (p/n).is_file()]

def _need(ok,code):
 if not ok:raise RuntimeError(code)

def deadline(minutes,not_after,user_session):
 # Validate the original argument before creating any lock, record or process.
 _need(type(user_session) is bool and type(minutes) is int and
       (20<=minutes<=60 if user_session else 5<=minutes<=15),'NATIVE_SETUP_APPROVAL_REQUIRED')
 now=datetime.datetime.now(datetime.timezone.utc);end=now+datetime.timedelta(minutes=minutes)
 if not_after is not None:
  _need(type(not_after) is str and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})',not_after),'NATIVE_DEADLINE_ISO_REQUIRED')
  try:fixed=datetime.datetime.fromisoformat(not_after.replace('Z','+00:00'))
  except ValueError:raise RuntimeError('NATIVE_DEADLINE_ISO_REQUIRED') from None
  _need(fixed.tzinfo is not None,'NATIVE_DEADLINE_TIMEZONE_REQUIRED');end=min(end,fixed)
 _need(now+datetime.timedelta(minutes=15 if user_session else 4)<end,'SETUP_TIME_INSUFFICIENT')
 return end.isoformat()

def _canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode('utf-8')
def _digest(value):return hashlib.sha256(_canonical(value)).hexdigest()
def _read(p):
 _plain(p);_need(p.is_file() and p.stat().st_size<=1048576,'NATIVE_SETUP_EVIDENCE_INVALID')
 return json.loads(p.read_text(encoding='utf-8'))
def _once(p,value):
 _plain(p)
 with p.open('xb') as f:f.write(_canonical(value));f.flush();os.fsync(f.fileno())

def _sid(core):
 value=core.run(['powershell.exe','-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).stdout.strip()
 _need(re.fullmatch(r'S-1-\d+(?:-\d+)+',value),'NATIVE_SETUP_SID_UNCONFIRMED');return value

def _owner_sid(core,p):
 value=core.run(['powershell.exe','-NoProfile','-Command','(Get-Acl -LiteralPath $env:FOCURVE_CHECK_PATH).GetOwner([System.Security.Principal.SecurityIdentifier]).Value'],text=True,env={**core.base_env(),'FOCURVE_CHECK_PATH':str(p)}).stdout.strip()
 return value

def _plain(p):
 _need(not any(x.is_symlink() or (hasattr(x,'is_junction') and x.is_junction()) for x in [p,*p.parents]),'NATIVE_SETUP_PATH_ALIAS')
def _file(p):
 _plain(p);st=p.stat();_need(p.is_file(),'NATIVE_SETUP_FILE_REQUIRED')
 return {'sha256':sha(p),'device':st.st_dev,'inode':st.st_ino,'createdNS':getattr(st,'st_birthtime_ns',st.st_ctime_ns),'bytes':st.st_size}

def _snapshot(core,p):
 _plain(p);r=core.owned_record(p);sid=_sid(core)
 _need(_owner_sid(core,p)==sid,'NATIVE_SETUP_OWNER_MISMATCH')
 return r,{'installationId':r['id'],'extensionId':r.get('extensionId'),'sid':sid,
           'installationFile':_file(p/'installation.json'),'payloadSHA256':_digest(r.get('payload'))}

def _registry_absent(p,record):
 import winreg
 key='Software\\Google\\Chrome\\NativeMessagingHosts\\com.focurve.install_'+record['id']
 for view in [winreg.KEY_WOW64_32KEY,winreg.KEY_WOW64_64KEY]:
  try:
   with winreg.OpenKey(winreg.HKEY_CURRENT_USER,key,0,winreg.KEY_READ|view):pass
  except FileNotFoundError:continue
  raise RuntimeError('NATIVE_SETUP_REGISTRATION_PRESENT')

def _idle(core,p,record,attempt):
 _need(record['status']=='INSTALLED' and not any(record.get(k) for k in ['nativeLink','launchId','launchDeadlineUTC','holdRecovery','productHoldRecovery']),'NATIVE_SETUP_NOT_PRE_EFFECT')
 for name in ['profile','manual-setup-scope.json','chrome-process.json','server-process.json','control/native-link','native-setup-staging','STOP','admission.closed','admission.ready','product-runtime.lock','start.lock','stop.lock','product-update.lock','hold-recovery.lock']:
  _need(not (p/name).exists(),'NATIVE_SETUP_EFFECT_OR_OBLIGATION_PRESENT')
 _need(not pathlib.Path(attempt['staging']).exists(),'NATIVE_SETUP_STAGING_PRESENT')
 _registry_absent(p,record)
 # Do not initialize/query a DB or accept historic zero counts as current clearance.
 # An exclusively available DB port + no live installation process is required;
 # inability to establish either fact is a rejection, not an automatic shutdown.
 for port in [record['config']['webPort'],record['config']['mysqlPort']]:core.port_available(port)
 found=core.run(['powershell.exe','-NoProfile','-Command',"@(Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('chrome.exe','java.exe','mysqld.exe','python.exe') -and $_.ProcessId -ne [int]$env:FOCURVE_CHECK_PID -and $_.CommandLine -like ('*'+$env:FOCURVE_CHECK_PATH+'*')}).Count"],text=True,env={**core.base_env(),'FOCURVE_CHECK_PATH':str(p),'FOCURVE_CHECK_PID':str(os.getpid())}).stdout.strip()
 _need(found=='0','NATIVE_SETUP_PROCESS_PRESENT_OR_UNKNOWN')

def _actor(core):
 actor=core.process_identity(os.getpid())
 _need(actor.get('ProcessId')==os.getpid() and bool(actor.get('CreationDate')) and bool(actor.get('ExecutablePath')),'NATIVE_SETUP_ACTOR_UNCONFIRMED')
 return actor

class _DatabaseLease:
 # Read-only Windows handles with sharing disabled. Held throughout resume,
 # preventing a cooperative or external DB process from opening these files.
 def __init__(self,p):self.p=p;self.handles=[];self.live=False;self.fingerprint=[]
 def __enter__(self):
  import ctypes
  _need(os.name=='nt','NATIVE_SETUP_DATABASE_LOCK_PROOF_UNAVAILABLE')
  data=self.p/'database';_plain(data);_need(data.is_dir(),'NATIVE_SETUP_DATABASE_REQUIRED')
  kernel=ctypes.WinDLL('kernel32',use_last_error=True)
  kernel.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p]
  kernel.CreateFileW.restype=ctypes.c_void_p;kernel.CloseHandle.argtypes=[ctypes.c_void_p]
  self.kernel=kernel
  try:
   for f in sorted(data.rglob('*')):
    _plain(f)
    if not f.is_file():continue
    handle=kernel.CreateFileW(str(f),0x80000000,0,None,3,0x00200000,None)
    _need(handle not in [None,ctypes.c_void_p(-1).value],'NATIVE_SETUP_DATABASE_LOCKED_OR_UNKNOWN')
    self.handles.append(handle);st=f.stat();self.fingerprint.append([f.relative_to(data).as_posix(),st.st_size,st.st_mtime_ns,st.st_ino])
   _need(bool(self.handles),'NATIVE_SETUP_DATABASE_REQUIRED');self.live=True;return self
  except BaseException:self.__exit__();raise
 def validate(self):
  _need(self.live,'NATIVE_SETUP_DATABASE_LEASE_LOST')
  current=[]
  for f in sorted((self.p/'database').rglob('*')):
   _plain(f)
   if f.is_file():
    st=f.stat();current.append([f.relative_to(self.p/'database').as_posix(),st.st_size,st.st_mtime_ns,st.st_ino])
  _need(current==self.fingerprint,'NATIVE_SETUP_DATABASE_CHANGED')
 def __exit__(self,*exc):
  for h in reversed(self.handles):self.kernel.CloseHandle(h)
  self.handles=[];self.live=False

def _process_absent(core,pid):
 try:core.process_identity(pid)
 except core.InstallError as e:
  _need(str(e)=='OWNED_PROCESS_NOT_PRESENT','NATIVE_SETUP_PRIOR_PROCESS_UNKNOWN');return
 raise RuntimeError('NATIVE_SETUP_PRIOR_PROCESS_PRESENT')

class _LockCustody:
 """Pin the approved file, not merely its pathname. Windows only, fail closed.
 DELETE access plus no write/delete sharing prevents replacement during issuance.
 Rename/disposition operate on that same handle without an unlock window.
 """
 def __init__(self,path,expected):self.path=path;self.expected=expected;self.fd=None
 def __enter__(self):
  import ctypes,msvcrt
  _need(os.name=='nt','NATIVE_SETUP_LOCK_CUSTODY_UNAVAILABLE');_plain(self.path)
  k=ctypes.WinDLL('kernel32',use_last_error=True)
  k.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p];k.CreateFileW.restype=ctypes.c_void_p
  k.CloseHandle.argtypes=[ctypes.c_void_p]
  k.SetFileInformationByHandle.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p,ctypes.c_uint32];k.SetFileInformationByHandle.restype=ctypes.c_int
  h=k.CreateFileW(str(self.path),0x80000000|0x00010000,1,None,3,0x00200000,None)
  _need(h not in [None,ctypes.c_void_p(-1).value],'NATIVE_SETUP_LOCK_CUSTODY_UNCONFIRMED')
  try:self.fd=msvcrt.open_osfhandle(h,os.O_RDONLY|os.O_BINARY)
  except BaseException:k.CloseHandle(h);raise
  self.kernel=k;self.handle=h
  try:self.check();return self
  except BaseException:os.close(self.fd);self.fd=None;raise
 def check(self):
  _need(self.fd is not None,'NATIVE_SETUP_LOCK_CUSTODY_LOST');_plain(self.path)
  st=os.fstat(self.fd);current=self.path.stat()
  _need((st.st_dev,st.st_ino)==(current.st_dev,current.st_ino),'NATIVE_SETUP_LOCK_IDENTITY_CHANGED')
  os.lseek(self.fd,0,os.SEEK_SET);raw=b''
  while True:
   part=os.read(self.fd,65536)
   if not part:break
   raw+=part;_need(len(raw)<=1048576,'NATIVE_SETUP_LOCK_CHANGED')
  identity={'sha256':hashlib.sha256(raw).hexdigest(),'device':st.st_dev,'inode':st.st_ino,'createdNS':getattr(st,'st_birthtime_ns',st.st_ctime_ns),'bytes':st.st_size}
  _need(identity==self.expected,'NATIVE_SETUP_LOCK_CHANGED')
 def archive(self,target):
  import ctypes
  self.check();_plain(target);_need(not target.exists(),'NATIVE_SETUP_ARCHIVE_COLLISION')
  class Rename(ctypes.Structure):
   _fields_=[('replace',ctypes.c_ubyte),('root',ctypes.c_void_p),('length',ctypes.c_uint32),('name',ctypes.c_wchar*1)]
  raw=str(target.absolute()).encode('utf-16-le');size=ctypes.sizeof(Rename)+len(raw)
  buffer=ctypes.create_string_buffer(max(size,ctypes.sizeof(Rename)));info=ctypes.cast(buffer,ctypes.POINTER(Rename)).contents
  info.replace=0;info.root=None;info.length=len(raw);ctypes.memmove(ctypes.addressof(buffer)+Rename.name.offset,raw,len(raw))
  _need(bool(self.kernel.SetFileInformationByHandle(self.handle,3,buffer,size)),'NATIVE_SETUP_ARCHIVE_UNCONFIRMED')
  self.path=target;self.check()
 def remove(self):
  import ctypes
  self.check();flag=ctypes.c_int(1)
  _need(bool(self.kernel.SetFileInformationByHandle(self.handle,4,ctypes.byref(flag),ctypes.sizeof(flag))),'NATIVE_SETUP_LOCK_CLEANUP_UNCONFIRMED')
 def __exit__(self,kind,error,tb):
  if self.fd is not None:os.close(self.fd);self.fd=None
  if isinstance(error,OSError):raise RuntimeError('NATIVE_SETUP_LOCK_CUSTODY_UNCONFIRMED') from error

class _Guard:
 def __init__(self,p):self.p=p/'native-setup.guard'
 def __enter__(self):
  _plain(self.p)
  try:self.fd=os.open(self.p,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
  except FileExistsError:raise RuntimeError('NATIVE_SETUP_GUARD_PRESENT') from None
  return self
 def __exit__(self,*exc):
  os.close(self.fd)
  # Ordinary failures retain their attempt lock. A crashed guard also remains.
  self.p.unlink()

def _connect_locked(core,p,minutes,end,user_session,expected_binding=None,effect_guard=lambda:None):
 r,binding=_snapshot(core,p)
 _need(expected_binding is None or binding==expected_binding,'NATIVE_RESUME_TARGET_CHANGED')
 renewal=user_session and r['status'] in ['INSTALLED','STOPPED','PRODUCT_RECOVERED_FOCUS_LOCKED'] and bool(r.get('nativeLink'))
 _need((renewal or (r['status']=='INSTALLED' and not r.get('nativeLink'))) and not (p/'STOP').exists(),'FRESH_INSTALL_ONLY_NO_HOLD_OR_REUSE')
 lock=p/'native-setup.lock'
 _need(not lock.exists(),'NATIVE_SETUP_ALREADY_ACTIVE_OR_PRESERVED')
 aid=uuid.uuid4().hex;folder=p/'native-setup-attempts'/aid
 _plain(folder);folder.mkdir(parents=True,exist_ok=False)
 attempt={'contract':'FOCURVE_NATIVE_ATTEMPT_1','attemptId':aid,**binding,'pid':os.getpid(),'actor':_actor(core),'mode':'RENEWAL' if renewal else 'FRESH',
          'staging':str(p.parent.parent/'native-link-setups'/aid),'notAfterUTC':end,'userSession':user_session}
 _once(folder/'attempt.json',attempt)
 _once(lock,{'attemptId':aid,'attemptSHA256':sha(folder/'attempt.json'),'sid':binding['sid']})
 lock_identity=_file(lock)
 def effect():
  effect_guard()
  if expected_binding is not None:
   current,current_binding=_snapshot(core,p)
   _need(current_binding==expected_binding,'NATIVE_RESUME_TARGET_CHANGED')
   _idle(core,p,current,attempt)
  _once(folder/'effect-started.json',{'attemptId':aid,'phase':'EFFECT_STARTED'})
 try:
  with _LockCustody(lock,lock_identity) as custody:
   if renewal:effect();result=_renew_stopped(core,p,minutes,True,end,user_session)
   else:result=_connect_fresh(core,p,minutes,True,end,user_session,before_effect=effect,staging=attempt['staging'])
   custody.check()
   _once(folder/'completed.json',{'attemptId':aid,'phase':'COMPLETED'})
   custody.remove();return result
 except Exception as error:
  code=str(error);code=code if re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code) else 'PRE_EFFECT_OPERATION_FAILED'
  phase='EFFECT_UNCONFIRMED' if (folder/'effect-started.json').exists() else 'PRE_EFFECT_FAILED'
  _once(folder/'failure.json',{'phase':phase,'attemptId':aid,'attemptSHA256':sha(folder/'attempt.json'),
        'lock':lock_identity,'binding':binding,'code':code})
  raise

def connect(core, instance, minutes=15, approve=False, not_after=None,user_session=False):
 _need(approve is True,'NATIVE_SETUP_APPROVAL_REQUIRED');end=deadline(minutes,not_after,user_session)
 p=pathlib.Path(instance).resolve();r=core.owned_record(p)
 _need(not (p/'native-resume.pending').exists(),'NATIVE_RESUME_INCOMPLETE')
 with _Guard(p):
  # Keep the established stopped/unused-user-grant updater and its own evidence
  # contract unchanged. It is never eligible for fresh pre-effect resumption.
  if user_session and r['status'] in ['INSTALLED','STOPPED','PRODUCT_RECOVERED_FOCUS_LOCKED'] and r.get('nativeLink'):
   _need(not (p/'STOP').exists(),'FRESH_INSTALL_ONLY_NO_HOLD_OR_REUSE')
   lock=p/'native-setup.lock'
   try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
   except FileExistsError:raise RuntimeError('NATIVE_SETUP_ALREADY_ACTIVE_OR_PRESERVED') from None
   identity=_file(lock);os.close(fd)
   with _LockCustody(lock,identity) as custody:
    result=_renew_stopped(core,p,minutes,True,end,user_session)
    custody.check();custody.remove();return result
  return _connect_locked(core,p,minutes,end,user_session)

def resume_plan(core,instance,*,_lease=None):
 p=pathlib.Path(instance).resolve();_need(not (p/'native-resume.pending').exists(),'NATIVE_RESUME_INCOMPLETE');r,binding=_snapshot(core,p);lock=p/'native-setup.lock'
 _need(_owner_sid(core,lock)==binding['sid'],'NATIVE_SETUP_LOCK_OWNER_MISMATCH')
 info=_read(lock);aid=info.get('attemptId','');_need(re.fullmatch('[a-f0-9]{32}',aid),'NATIVE_SETUP_ATTEMPT_REQUIRED')
 folder=p/'native-setup-attempts'/aid;_plain(folder)
 _need(all(_owner_sid(core,folder/n)==binding['sid'] for n in ['attempt.json','failure.json']),'NATIVE_SETUP_EVIDENCE_OWNER_MISMATCH')
 attempt=_read(folder/'attempt.json');failure=_read(folder/'failure.json')
 _need(attempt.get('contract')=='FOCURVE_NATIVE_ATTEMPT_1' and attempt.get('mode')=='FRESH' and attempt.get('attemptId')==aid and
       info=={'attemptId':aid,'attemptSHA256':sha(folder/'attempt.json'),'sid':binding['sid']},'NATIVE_SETUP_ATTEMPT_MISMATCH')
 _need(failure.get('phase')=='PRE_EFFECT_FAILED' and failure.get('attemptId')==aid and
       failure.get('attemptSHA256')==sha(folder/'attempt.json') and failure.get('binding')==binding and
       failure.get('lock')==_file(lock),'NATIVE_SETUP_FAILURE_MISMATCH')
 _need(all(attempt.get(k)==v for k,v in binding.items()),'NATIVE_SETUP_BINDING_MISMATCH')
 _need(attempt['staging']==str(p.parent.parent/'native-link-setups'/aid),'NATIVE_SETUP_STAGING_SCOPE_MISMATCH')
 _need(not any((folder/n).exists() for n in ['effect-started.json','completed.json','resume-claimed.json','archive']),'NATIVE_SETUP_ATTEMPT_NOT_REUSABLE')
 _need(type(attempt.get('actor')) is dict and attempt['actor'].get('ProcessId')==attempt.get('pid') and bool(attempt['actor'].get('CreationDate')) and bool(attempt['actor'].get('ExecutablePath')),'NATIVE_SETUP_ACTOR_UNCONFIRMED')
 _process_absent(core,attempt['pid']);_idle(core,p,r,attempt)
 if _lease is None:
  with _DatabaseLease(p) as lease:database=list(lease.fingerprint)
 else:
  _need(_lease.live and _lease.p==p,'NATIVE_SETUP_DATABASE_LEASE_LOST');_lease.validate();database=list(_lease.fingerprint)
 return {'contract':'FOCURVE_NATIVE_RESUME_PLAN_1','installation':str(p),'binding':binding,'attemptId':aid,
         'attemptFile':_file(folder/'attempt.json'),'failureFile':_file(folder/'failure.json'),'lock':_file(lock),'databaseFiles':database}

def resume(core,instance,expected_plan_sha256,minutes,not_after,approve=False,user_session=True):
 _need(approve is True and type(not_after) is str,'NATIVE_RESUME_APPROVAL_REQUIRED');end=deadline(minutes,not_after,user_session)
 p=pathlib.Path(instance).resolve()
 with _Guard(p),_DatabaseLease(p) as lease:
  plan=resume_plan(core,p,_lease=lease);_need(re.fullmatch('[a-f0-9]{64}',expected_plan_sha256 or '') and _digest(plan)==expected_plan_sha256,'NATIVE_RESUME_PLAN_CHANGED')
  # Pin once more while holding the same gate used by normal connect().
  _need(resume_plan(core,p,_lease=lease)==plan,'NATIVE_RESUME_TARGET_CHANGED')
  folder=p/'native-setup-attempts'/plan['attemptId']
  _once(folder/'resume-claimed.json',{'planSHA256':expected_plan_sha256,'notAfterUTC':end,'sid':plan['binding']['sid']})
  _once(p/'native-resume.pending',{'attemptId':plan['attemptId'],'planSHA256':expected_plan_sha256})
  archive=folder/'archive';archive.mkdir()
  # All copying must succeed before the original lock can leave its active name.
  import shutil
  for name in ['attempt.json','failure.json']:shutil.copyfile(folder/name,archive/name)
  _need(sha(archive/'attempt.json')==plan['attemptFile']['sha256'] and sha(archive/'failure.json')==plan['failureFile']['sha256'] and _file(p/'native-setup.lock')==plan['lock'],'NATIVE_RESUME_ARCHIVE_UNCONFIRMED')
  current,binding=_snapshot(core,p);_need(binding==plan['binding'],'NATIVE_RESUME_TARGET_CHANGED')
  attempt=_read(folder/'attempt.json');_idle(core,p,current,attempt)
  with _LockCustody(p/'native-setup.lock',plan['lock']) as custody:
   custody.archive(archive/'original.lock')
   # The moved file is checked through both its handle and its new path.
   custody.check()
   _once(archive/'receipt.json',{'plan':plan,'planSHA256':expected_plan_sha256})
   result=_connect_locked(core,p,minutes,end,user_session,expected_binding=plan['binding'],effect_guard=lease.validate)
   custody.check()
   (p/'native-resume.pending').unlink();return result

def _renew_stopped(core,p,minutes,approve,not_after,user_session):
 """New explicit grant on a normally stopped installation, never HOLD repair.

 Reuses the existing scoped updater and its backup/ownership guards. Previous
 normal-stop evidence is eligibility only; the product checks current local/DB
 safety again before starting. No services or focus session are started here.
 """
 now=datetime.datetime.now(datetime.timezone.utc);end=now+datetime.timedelta(minutes=minutes)
 if not_after is not None:
  fixed=datetime.datetime.fromisoformat(not_after);core.require(fixed.tzinfo is not None,'FIXED_SETUP_DEADLINE_REQUIRED');end=min(end,fixed)
 location=pathlib.Path(__file__).resolve().parent/'session_update.py'
 spec=importlib.util.spec_from_file_location('owned_normal_session_update',location)
 update=importlib.util.module_from_spec(spec);spec.loader.exec_module(update)
 before=update.eligible(core,p,approve,require_chrome=False)
 # Reuse the pinned loader: isolated Python omits sibling module search paths.
 native_compiler(p,before)
 output=p.parent.parent/'native-link-renewals'/uuid.uuid4().hex
 update.prepare(core,p,p,output,end,approve=approve,source_layout='installed')
 update.apply(core,p,output,approve=approve)
 r=core.read(p/'installation.json')
 unused=before['status']=='INSTALLED'
 return {'status':'NATIVE_CONFIGURED_UNUSED_SETUP_GRANT_READY' if unused else 'NATIVE_CONFIGURED_NORMAL_STOPPED_GRANT_READY','extensionDirectory':str(p/'app/extension'),
         'productPage':'chrome-extension://'+r['extensionId']+'/native-link/index.html',
         'notAfterUTC':end.isoformat(),'servicesStarted':False,'focusAdmission':'CLOSED',
         'userSessionEnabled':True,'existingExtensionLoadRequired':unused,'newExplicitGrant':True}

def _connect_fresh(core, instance, minutes=15, approve=False, not_after=None,user_session=False,*,before_effect=lambda:None,staging=None):
 """User-invoked setup on a fresh install, with a fixed execution grant.

 Opens only the installation's normal Chrome extensions page. It never inspects
 a browser page or accepts a manual safety result as proof.
 """
 core.require(approve and type(minutes) is int and (20<=minutes<=60 if user_session else 5<=minutes<=15),'NATIVE_SETUP_APPROVAL_REQUIRED')
 p=pathlib.Path(instance).resolve();r=core.owned_record(p)
 core.require(r['status']=='INSTALLED' and not r.get('launchId') and not r.get('nativeLink') and
              not any((p/n).exists() for n in ['STOP','chrome-process.json','product-runtime.lock','start.lock','stop.lock']),
              'FRESH_INSTALL_ONLY_NO_HOLD_OR_REUSE')
 now=datetime.datetime.now(datetime.timezone.utc);end=now+datetime.timedelta(minutes=minutes)
 if not_after is not None:
  fixed=datetime.datetime.fromisoformat(not_after)
  core.require(fixed.tzinfo is not None,'FIXED_SETUP_DEADLINE_REQUIRED');end=min(end,fixed)
 core.require(now+datetime.timedelta(minutes=15 if user_session else 4)<end,'SETUP_TIME_INSUFFICIENT')
 core.require(r['config']['browserMode']=='regular_manual','MANUAL_REGULAR_CHROME_REQUIRED')
 args=core.browser_arguments(p,r,first=True)
 core.require(args[-1]=='chrome://extensions/' and not any('remote-debugging' in str(x) for x in args),
              'MANUAL_BROWSER_ONLY')
 for port in [r['config']['webPort'],r['config']['mysqlPort']]:core.port_available(port)
 free=int(core.run(['powershell.exe','-NoProfile','-Command','[long](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory*1024'],text=True).stdout.strip())
 core.require(free>=3*1024**3,'RAM_BELOW_3_GIB_NO_BROWSER_START')
 before_effect()
 # Persist the fixed grant before the only process creation. No time extension
 # is hidden in registration or a later product reconnect.
 core.write(p/'manual-setup-scope.json',{'mode':'USER_MANUAL_SETUP_ONLY','installationId':r['id'],
             'notAfterUTC':end.isoformat(),'servicesStarted':False,'focusAdmission':'CLOSED','CDP':False})
 core.spawn_owned(args,p,'chrome')
 output=pathlib.Path(staging) if staging is not None else p.parent.parent/'native-link-setups'/uuid.uuid4().hex
 main(['--instance',str(p),'--not-after',end.isoformat(),'--output',str(output),
       '--approve-native-host-registration']+(['--user-session'] if user_session else []))
 return {'status':'NATIVE_CONFIGURED_USER_EXTENSION_LOAD_REQUIRED','extensionDirectory':str(p/'app/extension'),
         'productPage':'chrome-extension://'+r['extensionId']+'/native-link/index.html',
         'notAfterUTC':end.isoformat(),'servicesStarted':False,'focusAdmission':'CLOSED','userSessionEnabled':user_session}

def grant_fields(user_session):
 if user_session:
  return {'contract':'FOCURVE_USER_SESSION_GRANT_1','scope':'USER_UI_SERVICES_AND_SAFE_STOP',
          'focusSTART_END':False,'automaticFocusCommands':False}
 return {'contract':'FOCURVE_RUNTIME_VERIFICATION_GRANT_1','scope':'RUNTIME_PROBE_FOCUS_LOCKED','focusSTART_END':False}
def main(argv=None):
 ap=argparse.ArgumentParser();ap.add_argument('--instance',required=True,type=pathlib.Path);ap.add_argument('--not-after',required=True);ap.add_argument('--output',required=True,type=pathlib.Path);ap.add_argument('--approve-native-host-registration',action='store_true');ap.add_argument('--user-session',action='store_true');a=ap.parse_args(argv)
 need=lambda ok,code:None if ok else (_ for _ in ()).throw(RuntimeError(code))
 now=datetime.datetime.now(datetime.timezone.utc);end=datetime.datetime.fromisoformat(a.not_after)
 need(a.approve_native_host_registration and end.tzinfo is not None and now+datetime.timedelta(seconds=900 if a.user_session else 30)<end<=now+datetime.timedelta(minutes=60 if a.user_session else 15),'CURRENT_NATIVE_PROVISION_APPROVAL_REQUIRED')
 p=a.instance.resolve();o=a.output.resolve();need(not o.is_relative_to(p) and not o.exists(),'NEW_OUTSIDE_BACKUP_DIRECTORY_REQUIRED')
 spec=importlib.util.spec_from_file_location('fresh_native_core',p/'control/installer/install_core.py');c=importlib.util.module_from_spec(spec);sys.modules[spec.name]=c;spec.loader.exec_module(c);r=c.owned_record(p)
 need(r['status']=='INSTALLED' and not r.get('launchId') and not r.get('nativeLink') and not (p/'control/native-link').exists() and not (p/'product-runtime.lock').exists() and not (p/'STOP').exists(),'FRESH_INSTALL_ONLY_NO_HOLD_OR_REUSE')
 c.verify_process(p,'chrome');process=c.read(p/'chrome-process.json');need('remote-debugging' not in process['CommandLine'],'MANUAL_BROWSER_ONLY')
 c.port_available(r['config']['webPort']);c.port_available(r['config']['mysqlPort'])
 import winreg
 name='com.focurve.install_'+r['id'];key='Software\\Google\\Chrome\\NativeMessagingHosts\\'+name
 for view in [winreg.KEY_WOW64_32KEY,winreg.KEY_WOW64_64KEY]:
  try:
   old=winreg.OpenKey(winreg.HKEY_CURRENT_USER,key,0,winreg.KEY_READ|view);old.Close();raise RuntimeError('REGISTRY_COLLISION_NO_OVERWRITE')
  except FileNotFoundError:pass
 csc=pathlib.Path(os.environ['WINDIR'])/'Microsoft.NET/Framework64/v4.0.30319/csc.exe';need(csc.is_file(),'WINDOWS_NATIVE_COMPILER_REQUIRED_NO_DOWNLOAD')
 sid=c.run(['powershell.exe','-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).stdout.strip()
 compile_native=native_compiler(p,r)
 grantId=uuid.uuid4().hex;o.mkdir(parents=True);stage=o/'patch';native=stage/'control/native-link';native.mkdir(parents=True)
 grant={**grant_fields(a.user_session),'verificationId':grantId,'installationId':r['id'],'extensionId':r['extensionId'],'approvedAtUTC':now.isoformat(),'notAfterUTC':end.isoformat()};(native/'grant.json').write_text(json.dumps(grant,indent=2),encoding='utf-8')
 binding={'contract':'FOCURVE_NATIVE_BINDING_1','installationId':r['id'],'extensionId':r['extensionId'],'profile':str(p/'profile'),'chromePID':process['ProcessId'],'chromeCreatedMs':int(re.search(r'Date\((\d+)\)',process['CreationDate']).group(1)),'chromeExecutable':process['ExecutablePath'],'userSid':sid,'notAfterUTC':end.isoformat(),'allowRuntimeProbe':True,'installationPath':str(p),'pythonExecutable':r['runtimes']['python'],'verificationId':grantId}
 binding['allowUserSession']=a.user_session
 paths=['control/installer/install_core.py','control/installer/product_runtime.py','control/installer/product_hold_recovery.py','control/installer/hold_recovery.py','control/installer/product_runtime_entry.py','control/installer/product_native_protocol.py','control/installer/product_user_session.py','control/installer/record_snapshot.py',str(pathlib.Path(r['runtimes']['python']).relative_to(p)).replace('\\','/')]
 binding['runtimeFiles']={n:sha(p/n) for n in paths};binding['runtimeFiles']['control/native-link/grant.json']=sha(native/'grant.json');(native/'binding.json').write_text(json.dumps(binding,ensure_ascii=False,indent=2),encoding='utf-8')
 build=o/'NativeLinkBuild.cs';build.write_text('internal static class NativeLinkBuild { internal const string BindingSHA256="'+sha(native/'binding.json')+'"; }',encoding='utf-8')
 need(compile_native(p/'control/native/NativeLinkHost.cs',build,native/'FOCURVE.NativeLink.exe',o/'build.txt')==0,'NATIVE_BUILD_FAILED')
 negative=subprocess.run([str(native/'FOCURVE.NativeLink.exe'),'chrome-extension://'+r['extensionId']+'/'],input=b'',capture_output=True,timeout=10);need(negative.returncode!=0 and not negative.stdout and b'NATIVE_CHROME_PARENT_UNVERIFIED' in negative.stderr,'NATIVE_PARENT_GUARD_UNCONFIRMED')
 host={'name':name,'description':'FOCURVE product-owned lifecycle verification','path':str(p/'control/native-link/FOCURVE.NativeLink.exe'),'type':'stdio','allowed_origins':['chrome-extension://'+r['extensionId']+'/']};(native/'native-host.json').write_text(json.dumps(host,ensure_ascii=False,indent=2),encoding='utf-8')
 config={'contract':'FOCURVE_NATIVE_LINK_CONFIG_1','installationId':r['id'],'extensionId':r['extensionId'],'host':name,'notAfterUTC':end.isoformat(),'verificationId':grantId,'userSessionEnabled':a.user_session};cfg=stage/'app/extension/native-link/config.js';cfg.parent.mkdir(parents=True);cfg.write_text('globalThis.FOCURVE_NATIVE_LINK_CONFIG=Object.freeze('+json.dumps(config)+');\n',encoding='utf-8')
 need(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=15)<end,'PROVISION_TIME_INSUFFICIENT_NO_APPLY')
 # Compilation can take time: re-read identity, payload and STOP immediately
 # before applying. Never regenerate the expected original hashes here.
 need(c.owned_record(p)==r and not (p/'STOP').exists() and not (p/'product-runtime.lock').exists(),
      'PROVISION_TARGET_CHANGED_NO_APPLY')
 c.verify_process(p,'chrome')
 files=[f for f in stage.rglob('*') if f.is_file()];backup=o/'original-backup';backup.mkdir()
 for rel in ['app/extension/native-link/config.js','control/MANIFEST.json','installation.json']:
  b=backup/rel;b.parent.mkdir(parents=True,exist_ok=True);b.write_bytes((p/rel).read_bytes())
 def atomic(target,raw):
  tmp=target.with_name(target.name+'.native-provision-new');need(not tmp.exists(),'PROVISION_COLLISION');tmp.write_bytes(raw);os.replace(tmp,target)
 for f in files:
  target=p/f.relative_to(stage);target.parent.mkdir(parents=True,exist_ok=True);atomic(target,f.read_bytes())
 control=p/'control';cm={'version':'0.1.25-product-native-provision','files':[{'path':f.relative_to(control).as_posix(),'sha256':sha(f)} for f in sorted(control.rglob('*')) if f.is_file() and f!=control/'MANIFEST.json']};atomic(control/'MANIFEST.json',(json.dumps(cm,ensure_ascii=False,indent=2)+'\n').encode())
 r['nativeLink']={'version':'FOCURVE_NATIVE_LINK_1','capability':'HELLO_AND_RUNTIME_PROBE_FOCUS_LOCKED','notAfterUTC':end.isoformat(),'verificationId':grantId,'registryScope':'HKCU','hostName':name}
 if a.user_session:r['nativeLink']['capability']='USER_UI_SERVICES_AND_SAFE_STOP'
 r['payload']=[{'path':f.relative_to(p).as_posix(),'sha256':sha(f)} for folder in ['app','tools','server-libs','server-classes','runtimes','control'] for f in sorted((p/folder).rglob('*')) if f.is_file()]
 r['payload'].extend(launcher_payload(p))
 atomic(p/'installation.json',(json.dumps(r,ensure_ascii=False,indent=2)+'\n').encode())
 with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER,key,0,winreg.KEY_SET_VALUE|winreg.KEY_WOW64_64KEY) as k:winreg.SetValueEx(k,'',0,winreg.REG_SZ,str(p/'control/native-link/native-host.json'))
 c.verify_installed_payload(p,r)
 (o/'RESULT.json').write_text(json.dumps({'phase':'PROVISIONED_USER_EXTENSION_LOAD_REQUIRED','verificationId':grantId,'installationId':r['id'],'extensionId':r['extensionId'],'notAfterUTC':end.isoformat(),'registryScope':'HKCU_EXACT_ORIGIN_ONLY','servicesStarted':False,'START_END':False,'oldHOLDChanged':False},indent=2),encoding='utf-8')
 print(json.dumps({'phase':'PROVISIONED','extensionDirectory':str(p/'app/extension'),'notAfterUTC':end.isoformat(),'servicesStarted':False}))
if __name__=='__main__':main()
