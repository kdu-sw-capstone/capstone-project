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

def connect(core, instance, minutes=15, approve=False, not_after=None,user_session=False):
 core.require(approve and type(user_session) is bool and type(minutes) is int and
              (20<=minutes<=60 if user_session else 5<=minutes<=15),'NATIVE_SETUP_APPROVAL_REQUIRED')
 p=pathlib.Path(instance).resolve();r=core.owned_record(p)
 renewal=user_session and r['status'] in ['INSTALLED','STOPPED','PRODUCT_RECOVERED_FOCUS_LOCKED'] and bool(r.get('nativeLink'))
 core.require((renewal or (r['status']=='INSTALLED' and not r.get('nativeLink'))) and not (p/'STOP').exists(),
              'FRESH_INSTALL_ONLY_NO_HOLD_OR_REUSE')
 lock=p/'native-setup.lock'
 try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
 except FileExistsError:raise RuntimeError('NATIVE_SETUP_ALREADY_ACTIVE_OR_PRESERVED') from None
 completed=False
 try:
  result=(_renew_stopped if renewal else _connect_fresh)(core,p,minutes,approve,not_after,user_session);completed=True;return result
 finally:
  os.close(fd)
  if completed:lock.unlink()

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

def _connect_fresh(core, instance, minutes=15, approve=False, not_after=None,user_session=False):
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
 # Persist the fixed grant before the only process creation. No time extension
 # is hidden in registration or a later product reconnect.
 core.write(p/'manual-setup-scope.json',{'mode':'USER_MANUAL_SETUP_ONLY','installationId':r['id'],
             'notAfterUTC':end.isoformat(),'servicesStarted':False,'focusAdmission':'CLOSED','CDP':False})
 core.spawn_owned(args,p,'chrome')
 output=p.parent.parent/'native-link-setups'/uuid.uuid4().hex
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
