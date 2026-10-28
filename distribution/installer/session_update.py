"""Scoped update of a normally stopped new installation. No HOLD recovery.

No registry, certificate, credential, database or browser state is changed here.
The user reloads the extension; the product then makes fresh safety checks.
"""
import datetime,hashlib,json,os,pathlib,re,subprocess,uuid

SOURCES={
 'control/installer/product_hold_patch.py':'distribution/installer/product_hold_patch.py',
 'control/installer/product_hold_recovery.py':'distribution/installer/product_hold_recovery.py',
 'control/installer/hold_recovery.py':'distribution/installer/hold_recovery.py',
 'app/extension/native-link/hold.js':'extension/native-link/hold.js',
 'app/extension/native-link/theme.js':'extension/native-link/theme.js',
 'app/extension/native-link/client.js':'extension/native-link/client.js',
 'app/extension/native-link/ui.js':'extension/native-link/ui.js',
 'control/installer/install_core.py':'distribution/installer/install_core.py',
 'control/installer/product_runtime.py':'distribution/installer/product_runtime.py',
 'control/installer/product_runtime_entry.py':'distribution/installer/product_runtime_entry.py',
 'control/installer/product_native_protocol.py':'distribution/installer/product_native_protocol.py',
 'control/installer/product_user_session.py':'distribution/installer/product_user_session.py',
 'control/installer/record_snapshot.py':'distribution/installer/record_snapshot.py',
 'control/installer/native_setup.py':'distribution/installer/native_setup.py',
 'control/installer/session_update.py':'distribution/installer/session_update.py',
 'control/native/NativeLinkHost.cs':'distribution/native/NativeLinkHost.cs',
 'app/extension/integration/user-admission.js':'extension/integration/user-admission.js',
 'app/extension/integration/product-runtime-admission.js':'extension/integration/product-runtime-admission.js',
 'app/extension/native-link/index.html':'extension/native-link/index.html',
 'app/extension/native-link/probe.js':'extension/native-link/probe.js',
 'app/extension/native-link/session.js':'extension/native-link/session.js',
 'app/extension/member-ui/user.js':'extension/member-ui/user.js',
}
GENERATED={'control/native-link/binding.json','control/native-link/grant.json',
           'control/native-link/FOCURVE.NativeLink.exe','app/extension/native-link/config.js'}

def need(ok,code):
 if not ok:raise RuntimeError(code)

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def encoded(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode('utf-8')

def unused_expired_setup(core,p,r,own_update_lock=False):
 """Eligibility evidence only; never current local/DB safety clearance."""
 need(not any(r.get(k) for k in ['launchId','launchDeadlineUTC','holdRecovery','productHoldRecovery']),
      'PRE_SERVICE_EXECUTION_OR_HOLD_PRESENT')
 blocked=['STOP','server-process.json','hold-mysql-process.json','admission.ready','admission.closed',
          'last-stop-safety.json','product-runtime.lock','start.lock','stop.lock','product-hold-transition.lock']
 if not own_update_lock:blocked.append('product-update.lock')
 need(not any((p/n).exists() for n in blocked) and not list(p.glob('*failure*')),
      'PRE_SERVICE_EXECUTION_OR_FAILURE_EVIDENCE_PRESENT')
 old=core.read(p/'control/native-link/binding.json');grant=core.read(p/'control/native-link/grant.json')
 setup=core.read(p/'manual-setup-scope.json');host=core.read(p/'control/native-link/native-host.json')
 need(old.get('contract')=='FOCURVE_NATIVE_BINDING_1' and
      grant.get('contract')=='FOCURVE_USER_SESSION_GRANT_1' and
      grant.get('scope')=='USER_UI_SERVICES_AND_SAFE_STOP' and
      setup.get('mode')=='USER_MANUAL_SETUP_ONLY' and setup.get('installationId')==r['id'] and
      setup.get('servicesStarted') is False and setup.get('focusAdmission')=='CLOSED',
      'PRE_SERVICE_SETUP_PROOF_UNCONFIRMED')
 need(all(v.get('installationId')==r['id'] and v.get('extensionId')==r['extensionId'] for v in [old,grant]) and
      old.get('profile')==str(p/'profile') and old.get('installationPath')==str(p) and
      old.get('verificationId')==grant.get('verificationId')==r['nativeLink'].get('verificationId') and
      bool(old.get('verificationId')) and old.get('allowUserSession') is True,
      'PRE_SERVICE_NATIVE_BINDING_MISMATCH')
 expiry=old.get('notAfterUTC')
 need(type(expiry) is str and expiry==grant.get('notAfterUTC')==r['nativeLink'].get('notAfterUTC'),
      'PRE_SERVICE_EXPIRY_BINDING_MISMATCH')
 try:end=datetime.datetime.fromisoformat(expiry)
 except (TypeError,ValueError):raise RuntimeError('PRE_SERVICE_EXPIRY_INVALID') from None
 need(end.tzinfo is not None and end<=datetime.datetime.now(datetime.timezone.utc),
      'PRE_SERVICE_GRANT_NOT_EXPIRED')
 need(host.get('name')==r['nativeLink']['hostName'] and host.get('type')=='stdio' and
      host.get('path')==str(p/'control/native-link/FOCURVE.NativeLink.exe') and
      host.get('allowed_origins')==['chrome-extension://'+r['extensionId']+'/'],
      'PRE_SERVICE_NATIVE_HOST_MISMATCH')
 import winreg
 registered=False;key='Software\\Google\\Chrome\\NativeMessagingHosts\\'+host['name']
 for view in [winreg.KEY_WOW64_32KEY,winreg.KEY_WOW64_64KEY]:
  try:
   with winreg.OpenKey(winreg.HKEY_CURRENT_USER,key,0,winreg.KEY_READ|view) as handle:value,kind=winreg.QueryValueEx(handle,'')
  except FileNotFoundError:continue
  need(kind==winreg.REG_SZ and value==str(p/'control/native-link/native-host.json'),
       'PRE_SERVICE_NATIVE_REGISTRATION_MISMATCH')
  registered=True
 need(registered,'PRE_SERVICE_NATIVE_REGISTRATION_MISSING')

def eligible(core,p,approve,require_chrome=True):
 need(approve is True,'USER_SESSION_UPDATE_APPROVAL_REQUIRED')
 r=core.owned_record(p)
 recovered=r['status']=='PRODUCT_RECOVERED_FOCUS_LOCKED'
 unused=r['status']=='INSTALLED' and bool(r.get('nativeLink'))
 if unused:unused_expired_setup(core,p,r)
 has_receipt=bool(r.get('productHoldRecovery'))
 if has_receipt:
  from product_hold_recovery import verify_receipt
  verify_receipt(p,r,require_commit_identity=recovered)
 need((unused or r['status'] in ['STOPPED','PRODUCT_RECOVERED_FOCUS_LOCKED']) and not r.get('holdRecovery') and r.get('nativeLink'),
      'NORMAL_STOPPED_NATIVE_INSTALLATION_REQUIRED')
 need(r['schema']=='focurve_user_'+r['id'] and r['origin']=='https://localhost:'+str(r['config']['webPort']) and
      r['callback']=='chrome-extension://'+r['extensionId']+'/popup/popup.html' and
      r['nativeLink']['hostName']=='com.focurve.install_'+r['id'],'INSTALLATION_SERVICE_BINDING_MISMATCH')
 blocked=['STOP','product-runtime.lock','start.lock','stop.lock','product-update.lock','product-hold-transition.lock']
 if not has_receipt:blocked.append('product-runtime-first-failure.json')
 need(not any((p/n).exists() for n in blocked), 'PRESERVED_OR_ACTIVE_OPERATION')
 try:core.verify_process(p,'chrome')
 except core.InstallError as e:
  if require_chrome or str(e)!='OWNED_PROCESS_NOT_PRESENT':raise
 for name in ['server','mysql']:
  f=p/(name+'-process.json')
  if not f.exists():continue
  try:core.process_identity(core.read(f)['ProcessId'])
  except core.InstallError as e:
   if str(e)!='OWNED_PROCESS_NOT_PRESENT':raise
  else:raise RuntimeError('PRIOR_SERVICE_PROCESS_PRESENT')
 if not recovered and not unused:need(core.safety_clear(**core.read(p/'last-stop-safety.json')),'PREVIOUS_NORMAL_STOP_NOT_VERIFIED')
 return r

def prepare(core,instance,source,output,end,approve=False,source_layout='checkout'):
 need(source_layout in ['checkout','installed'],'UPDATE_SOURCE_LAYOUT_INVALID')
 now=datetime.datetime.now(datetime.timezone.utc)
 need(end.tzinfo is not None and now+datetime.timedelta(minutes=20)<end<=now+datetime.timedelta(minutes=60),
      'NEW_BOUNDED_USER_SESSION_GRANT_REQUIRED')
 p=pathlib.Path(instance).resolve();source=pathlib.Path(source).resolve();o=pathlib.Path(output).resolve()
 need(source_layout!='installed' or source==p,'RENEWAL_SOURCE_MUST_BE_SAME_INSTALLATION')
 r=eligible(core,p,approve,require_chrome=False)
 need(not o.exists() and not o.is_relative_to(p),'NEW_OUTSIDE_PLAN_DIRECTORY_REQUIRED')
 core.port_available(r['config']['webPort']);core.port_available(r['config']['mysqlPort'])
 o.mkdir(parents=True);stage=o/'patch'
 for target,rel in SOURCES.items():
  src=source/(target if source_layout=='installed' else rel);need(src.is_file() and not src.is_symlink(),'UPDATE_SOURCE_MISSING')
  dest=stage/target;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(src.read_bytes())
 old=core.read(p/'control/native-link/binding.json');b=dict(old);verification=uuid.uuid4().hex
 b.update(notAfterUTC=end.isoformat(),allowRuntimeProbe=True,allowUserSession=True,allowProductHoldRecovery=False,verificationId=verification)
 need(b['installationId']==r['id'] and b['extensionId']==r['extensionId'] and b['profile']==str(p/'profile'),
      'NATIVE_BINDING_IDENTITY_MISMATCH')
 try:core.verify_process(p,'chrome')
 except core.InstallError as e:
  if str(e)!='OWNED_PROCESS_NOT_PRESENT':raise
  free=int(core.run(['powershell.exe','-NoProfile','-Command','[long](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory*1024'],text=True).stdout.strip())
  need(free>=3*1024**3,'RAM_BELOW_3_GIB_NO_BROWSER_START')
  args=core.browser_arguments(p,r,first=True)
  need(args[-1]=='chrome://extensions/' and not any('remote-debugging' in str(v) for v in args),'MANUAL_BROWSER_ONLY')
  (o/'prior-chrome-process.json').write_bytes((p/'chrome-process.json').read_bytes())
  core.spawn_owned(args,p,'chrome')
 process=core.read(p/'chrome-process.json');created=re.search(r'Date\((\d+)\)',process['CreationDate'])
 need(created is not None,'CHROME_CREATION_TIME_UNCONFIRMED')
 b.update(chromePID=process['ProcessId'],chromeCreatedMs=int(created.group(1)),chromeExecutable=process['ExecutablePath'])
 native=stage/'control/native-link';native.mkdir(parents=True)
 grant={'contract':'FOCURVE_USER_SESSION_GRANT_1','verificationId':verification,'installationId':r['id'],
        'extensionId':r['extensionId'],'approvedAtUTC':now.isoformat(),'notAfterUTC':end.isoformat(),
        'scope':'USER_UI_SERVICES_AND_SAFE_STOP','automaticFocusCommands':False,'existingHoldRecovery':False}
 (native/'grant.json').write_bytes(encoded(grant))
 runtime_names=['control/installer/install_core.py','control/installer/product_runtime.py',
                'control/installer/product_runtime_entry.py','control/installer/product_native_protocol.py',
                'control/installer/product_user_session.py','control/installer/record_snapshot.py',
                'control/installer/product_hold_recovery.py','control/installer/hold_recovery.py',
                pathlib.Path(r['runtimes']['python']).relative_to(p).as_posix()]
 b['runtimeFiles']={n:sha(stage/n if (stage/n).exists() else p/n) for n in runtime_names}
 b['runtimeFiles']['control/native-link/grant.json']=sha(native/'grant.json')
 (native/'binding.json').write_bytes(encoded(b))
 build=o/'NativeLinkBuild.cs';build.write_text('internal static class NativeLinkBuild { internal const string BindingSHA256="'+sha(native/'binding.json')+'"; }',encoding='utf-8')
 from product_hold_patch import compile_native
 need(compile_native(stage/'control/native/NativeLinkHost.cs',build,native/'FOCURVE.NativeLink.exe',o/'build.txt')==0,
      'USER_SESSION_NATIVE_BUILD_FAILED')
 negative=subprocess.run([str(native/'FOCURVE.NativeLink.exe'),'chrome-extension://'+r['extensionId']+'/'],input=b'',capture_output=True,timeout=10)
 need(negative.returncode!=0 and not negative.stdout and b'NATIVE_CHROME_PARENT_UNVERIFIED' in negative.stderr,
      'NATIVE_PARENT_GUARD_UNCONFIRMED')
 cfg=stage/'app/extension/native-link/config.js';cfg.parent.mkdir(parents=True,exist_ok=True)
 cfg.write_text('globalThis.FOCURVE_NATIVE_LINK_CONFIG=Object.freeze('+json.dumps({
     'contract':'FOCURVE_NATIVE_LINK_CONFIG_1','installationId':r['id'],'extensionId':r['extensionId'],
     'host':r['nativeLink']['hostName'],'notAfterUTC':end.isoformat(),'verificationId':verification,
     'userSessionEnabled':True})+');\n',encoding='utf-8')
 files={f.relative_to(stage).as_posix():sha(f) for f in stage.rglob('*') if f.is_file()}
 plan={'contract':'FOCURVE_STOPPED_USER_SESSION_UPDATE_1','installationId':r['id'],'extensionId':r['extensionId'],
       'expectedRecordSHA256':sha(p/'installation.json'),'notAfterUTC':end.isoformat(),
       'verificationId':verification,'files':files,'origin':r['origin'],'requiresUserExtensionReload':source_layout!='installed',
       'registryChanged':False,'credentialsChanged':False,'servicesStarted':False,'automaticSTART_END':False}
 (o/'PATCH-PREVIEW.json').write_bytes(encoded(plan));return plan

def apply(core,instance,output,approve=False):
 p=pathlib.Path(instance).resolve();o=pathlib.Path(output).resolve();plan=core.read(o/'PATCH-PREVIEW.json')
 need(plan['contract']=='FOCURVE_STOPPED_USER_SESSION_UPDATE_1','UPDATE_PLAN_CONTRACT_MISMATCH')
 r=eligible(core,p,approve)
 need(plan['installationId']==r['id'] and plan['extensionId']==r['extensionId'] and
      sha(p/'installation.json')==plan['expectedRecordSHA256'],'UPDATE_TARGET_CHANGED')
 now=datetime.datetime.now(datetime.timezone.utc);end=datetime.datetime.fromisoformat(plan['notAfterUTC'])
 need(end.tzinfo is not None and now+datetime.timedelta(minutes=15)<end<=now+datetime.timedelta(minutes=60),
      'UPDATE_WINDOW_INSUFFICIENT')
 need(set(plan['files'])==set(SOURCES)|GENERATED,'UPDATE_FILE_SCOPE_MISMATCH')
 for rel,h in plan['files'].items():
  need((o/'patch'/rel).resolve().is_relative_to(o/'patch') and sha(o/'patch'/rel)==h,'STAGED_UPDATE_CHANGED')
  target=p/rel
  need(target.resolve().is_relative_to(p) and not any(x.is_symlink() or (hasattr(x,'is_junction') and x.is_junction())
       for x in [target,*target.parents] if x.is_relative_to(p)),'UPDATE_TARGET_ALIAS_REJECTED')
 lock=p/'product-update.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);normal=False
 def atomic(dest,data):
  tmp=dest.with_name(dest.name+'.user-session-new');need(not tmp.exists(),'UPDATE_TEMP_COLLISION')
  dest.parent.mkdir(parents=True,exist_ok=True);tmp.write_bytes(data);os.replace(tmp,dest)
 try:
  need(not (p/'product-runtime.lock').exists() and not (p/'STOP').exists() and sha(p/'installation.json')==plan['expectedRecordSHA256'],
       'UPDATE_TARGET_CHANGED_AFTER_LOCK')
  if r['status']=='INSTALLED':unused_expired_setup(core,p,r,own_update_lock=True)
  core.verify_installed_payload(p,r)
  backup=o/'original-backup';backup.mkdir()
  for rel in [*plan['files'],'control/MANIFEST.json','installation.json']:
   if (p/rel).exists():
    f=backup/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes((p/rel).read_bytes())
  for rel in plan['files']:atomic(p/rel,(o/'patch'/rel).read_bytes())
  # Retain expected hashes of all untouched files; do not bless their current bytes.
  expected={x['path']:x['sha256'] for x in r['payload']};expected.update(plan['files'])
  manifest={'version':'0.1.25-user-session','files':[{'path':n[len('control/'):],'sha256':h} for n,h in sorted(expected.items()) if n.startswith('control/') and n!='control/MANIFEST.json']}
  atomic(p/'control/MANIFEST.json',encoded(manifest));expected['control/MANIFEST.json']=sha(p/'control/MANIFEST.json')
  r['payload']=[{'path':n,'sha256':h} for n,h in sorted(expected.items())]
  r['nativeLink'].update(notAfterUTC=plan['notAfterUTC'],verificationId=plan['verificationId'],capability='USER_UI_SERVICES_AND_SAFE_STOP')
  r['lastProductUpdate']={'contract':plan['contract'],'verificationId':plan['verificationId'],'originalRecordSHA256':plan['expectedRecordSHA256']}
  atomic(p/'installation.json',encoded(r));core.verify_installed_payload(p,r);normal=True
  (o/'APPLY-RESULT.json').write_bytes(encoded({'status':'APPLIED_USER_RELOAD_REQUIRED' if plan.get('requiresUserExtensionReload',True) else 'APPLIED_PRODUCT_PAGE_REOPEN_REQUIRED','installationId':r['id'],
            'extensionId':r['extensionId'],'files':plan['files'],'servicesStarted':False,'START_END':False}))
 finally:
  os.close(fd)
  if normal:lock.unlink()
