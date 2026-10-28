"""Prepare a pinned, bounded HOLD-only update outside the installation.

Never applies a patch, changes HOLD, registers a host or starts a process in
the installation. The existing Native Host registration and Chrome are reused.
"""
import datetime,hashlib,json,os,pathlib,re,subprocess,tempfile,uuid
from product_hold_recovery import CONTRACT,classify,state_digest,lock_identity,validate_preserved_cause,ready_identity
from hold_recovery import encoded,digest,atomic_write,put_once,safe_path

FILES={
 'control/installer/readonly-worker.js':'distribution/installer/readonly-worker.js',
 'control/installer/product_user_session.py':'distribution/installer/product_user_session.py',
 'control/installer/product_hold_patch.py':'distribution/installer/product_hold_patch.py',
 'control/installer/product_hold_recovery.py':'distribution/installer/product_hold_recovery.py',
 'control/installer/hold_recovery.py':'distribution/installer/hold_recovery.py',
 'control/installer/product_runtime_entry.py':'distribution/installer/product_runtime_entry.py',
 'control/installer/install_core.py':'distribution/installer/install_core.py',
 'control/installer/native_setup.py':'distribution/installer/native_setup.py',
 'control/installer/session_update.py':'distribution/installer/session_update.py',
 'control/native/NativeLinkHost.cs':'distribution/native/NativeLinkHost.cs',
 'app/extension/native-link/hold.js':'extension/native-link/hold.js',
 'app/extension/native-link/index.html':'extension/native-link/index.html',
 'app/extension/native-link/theme.js':'extension/native-link/theme.js',
 'app/extension/native-link/probe.js':'extension/native-link/probe.js',
 'app/extension/native-link/client.js':'extension/native-link/client.js',
 'app/extension/native-link/ui.js':'extension/native-link/ui.js',
 'app/extension/native-link/session.js':'extension/native-link/session.js',
}

def compile_native(source, build, destination, log):
    """Legacy Windows csc cannot create Win32 resource temp files at long paths.

    Compile the same pinned sources in an owned short temporary directory, then
    copy only the resulting executable. Never change host LongPaths policy.
    """
    compiler=pathlib.Path(os.environ['WINDIR'])/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    with tempfile.TemporaryDirectory(prefix='fc-native-') as temporary:
        directory=pathlib.Path(temporary).resolve()
        if not directory.is_relative_to(pathlib.Path(tempfile.gettempdir()).resolve()):
            raise RuntimeError('PRODUCT_HOLD_BUILD_TEMP_SCOPE')
        for original,name in [(source,'NativeLinkHost.cs'),(build,'NativeLinkBuild.cs')]:
            (directory/name).write_bytes(pathlib.Path(original).read_bytes())
        result=subprocess.run([str(compiler),'/nologo','/target:exe','/main:NativeLinkHost',
            '/reference:System.Management.dll','/reference:System.Web.Extensions.dll',
            '/out:'+str(directory/'FOCURVE.NativeLink.exe'),str(directory/'NativeLinkHost.cs'),
            str(directory/'NativeLinkBuild.cs')],capture_output=True)
        pathlib.Path(log).write_bytes(result.stdout+result.stderr)
        if result.returncode==0:pathlib.Path(destination).write_bytes((directory/'FOCURVE.NativeLink.exe').read_bytes())
        return result.returncode

def compile_helper(java, source, destination, log):
    compiler=pathlib.Path(java).with_name('javac.exe' if pathlib.Path(java).suffix.lower()=='.exe' else 'javac')
    with tempfile.TemporaryDirectory(prefix='fc-helper-') as temporary:
        directory=pathlib.Path(temporary).resolve()
        if not directory.is_relative_to(pathlib.Path(tempfile.gettempdir()).resolve()):
            raise RuntimeError('PRODUCT_HOLD_BUILD_TEMP_SCOPE')
        file=directory/'InstallTools.java';file.write_bytes(pathlib.Path(source).read_bytes())
        result=subprocess.run([str(compiler),'-proc:none','--release','21','-d',str(directory),str(file)],capture_output=True)
        pathlib.Path(log).write_bytes(result.stdout+result.stderr)
        if result.returncode==0:pathlib.Path(destination).write_bytes((directory/'InstallTools.class').read_bytes())
        return result.returncode

def prepare(core,instance,source,output,owner_user_id,executor_id,end,approve=False,preflight_rejection_sha256=None):
    core.require(approve is True,'PRODUCT_HOLD_PATCH_APPROVAL_REQUIRED')
    now=datetime.datetime.now(datetime.timezone.utc)
    core.require(end.tzinfo is not None and now+datetime.timedelta(minutes=5)<end<=now+datetime.timedelta(minutes=20),
                 'PRODUCT_HOLD_PATCH_WINDOW_INVALID')
    p=pathlib.Path(instance).resolve();src=pathlib.Path(source).resolve();out=pathlib.Path(output).resolve()
    core.require(not out.exists() and not out.is_relative_to(p),'PRODUCT_HOLD_OUTSIDE_STAGE_REQUIRED')
    r=core.read(p/'installation.json');failure=core.read(p/'product-runtime-first-failure.json');cause=classify(r,failure)
    core.require(core.child(core.installations(),r['id'])==p,'PRODUCT_HOLD_INSTALLATION_MISMATCH')
    core.verify_installed_payload(p,r)
    core.require(type(owner_user_id) is int and owner_user_id>0 and str(uuid.UUID(executor_id))==executor_id,
                 'PRODUCT_HOLD_MEMBER_IDENTITY_REQUIRED')
    template=None;peer=None
    if (p/'control/native-link/product-hold-grant.json').exists():
        _,binding,template=scope_eligible(core,p,preflight_rejection_sha256)
        peer,_=current_chrome(core,p,r,binding)
        core.require(template.get('binding',{}).get('ownerUserId')==owner_user_id and
                     template['binding'].get('executorId')==executor_id,'PRODUCT_HOLD_MEMBER_IDENTITY_MISMATCH')
    else:
        core.verify_process(p,'chrome')
        binding=core.read(p/'control/native-link/binding.json')
        if cause=='PRODUCT_CHANNEL_CLOSED':peer,_=current_chrome(core,p,r,binding)
    original_record=digest(p/'installation.json');op=uuid.uuid4().hex
    stage=out/'patch';stage.mkdir(parents=True)
    for target,rel in FILES.items():
        dest=stage/target;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((src/rel).read_bytes())
    evidence=stage/'control/product-hold-evidence'/op;evidence.mkdir(parents=True)
    # A later grant is not the binding that accompanied the original failure.
    # Reuse only the original, verified evidence; never relabel current metadata.
    original_runtime=p/(template['causeRuntimePath'] if template else 'control/installer/'+('product_user_session.py' if cause=='PRODUCT_CHANNEL_CLOSED' else 'product_runtime.py'))
    old_binding=p/(template['failedBindingPath'] if template else 'control/native-link/binding.json')
    old_grant=p/(template['failedGrantPath'] if template else 'control/native-link/grant.json')
    (evidence/'runtime.py').write_bytes(original_runtime.read_bytes())
    (evidence/'binding.json').write_bytes(old_binding.read_bytes())
    (evidence/'grant.json').write_bytes(old_grant.read_bytes())
    grant={'contract':CONTRACT,'operationId':op,'binding':{
        'installationId':r['id'],'extensionId':r['extensionId'],'profile':str(p/'profile'),
        'origin':r['origin'],'callback':r['callback'],'schema':r['schema'],
        'ownerUserId':owner_user_id,'executorId':executor_id},
        'recordStateSHA256':state_digest(r),'failureSHA256':digest(p/'product-runtime-first-failure.json'),
        'originalLockSHA256':digest(p/'product-runtime.lock'),
        'originalLockIdentity':lock_identity(p/'product-runtime.lock'),
        'mysqlConfigSHA256':digest(p/'mysql.ini'),'rootClientSHA256':digest(p/'root-client.ini'),
        'causeRuntimePath':(evidence/'runtime.py').relative_to(stage).as_posix(),
        'causeRuntimeSHA256':digest(original_runtime),
        'failedBindingPath':(evidence/'binding.json').relative_to(stage).as_posix(),
        'failedBindingSHA256':digest(old_binding),'notBeforeUTC':now.isoformat(),'notAfterUTC':end.isoformat()}
    if cause=='PRODUCT_CHANNEL_CLOSED':grant.update(readySHA256=digest(p/'admission.ready'),readyIdentity=ready_identity(p/'admission.ready'))
    grant.update(failedGrantPath=(evidence/'grant.json').relative_to(stage).as_posix(),
                 failedGrantSHA256=digest(evidence/'grant.json'))
    native=stage/'control/native-link';native.mkdir(parents=True,exist_ok=True)
    # New evidence paths live in the staged control tree until apply; the full
    # preserved-cause validation runs inside the pinned Native transition.
    (native/'product-hold-grant.json').write_bytes(encoded(grant))
    core.require(binding['installationId']==r['id'] and binding['extensionId']==r['extensionId'] and
                 binding['profile']==str(p/'profile'),'PRODUCT_HOLD_NATIVE_BINDING_MISMATCH')
    binding.update(notAfterUTC=end.isoformat(),allowProductHoldRecovery=True,allowUserSession=False,allowRuntimeProbe=True)
    if peer is not None:
        binding.update(chromePID=peer['ProcessId'],chromeCreatedMs=int(re.search(r'Date\((\d+)\)',peer['CreationDate']).group(1)),
                       chromeExecutable=peer['ExecutablePath'])
        (stage/'chrome-process.json').write_bytes(encoded(peer))
    # All imported modules and the original cause evidence are hash-pinned.
    required=['control/installer/product_runtime.py','control/installer/product_native_protocol.py',
              'control/installer/product_user_session.py','control/installer/record_snapshot.py',
              pathlib.Path(r['runtimes']['python']).relative_to(p).as_posix()]
    names=set(required)|{n for n in FILES if n.startswith('control/')}
    names.update(x.relative_to(stage).as_posix() for x in evidence.iterdir())
    names.add('control/native-link/product-hold-grant.json')
    binding['runtimeFiles']={n:digest(stage/n if (stage/n).exists() else p/n) for n in names}
    (native/'binding.json').write_bytes(encoded(binding))
    build=out/'NativeLinkBuild.cs';build.write_text('internal static class NativeLinkBuild { internal const string BindingSHA256="'+digest(native/'binding.json')+'"; }',encoding='utf8')
    core.require(compile_native(stage/'control/native/NativeLinkHost.cs',build,
        native/'FOCURVE.NativeLink.exe',out/'native-build.log')==0,'PRODUCT_HOLD_NATIVE_BUILD_FAILED')
    tools=stage/'tools';tools.mkdir()
    core.require(compile_helper(r['runtimes']['java'],src/'distribution/installer/InstallTools.java',
        tools/'InstallTools.class',out/'helper-build.log')==0,'PRODUCT_HOLD_HELPER_BUILD_FAILED')
    config=stage/'app/extension/native-link/config.js'
    config.write_text('globalThis.FOCURVE_NATIVE_LINK_CONFIG=Object.freeze('+json.dumps({
        'contract':'FOCURVE_NATIVE_LINK_CONFIG_1','installationId':r['id'],'extensionId':r['extensionId'],'host':r['nativeLink']['hostName'],
        'notAfterUTC':end.isoformat(),'productHoldRecoveryEnabled':True,'userSessionEnabled':False})+');\n',encoding='utf8')
    rows=[]
    for f in sorted(stage.rglob('*')):
        if f.is_file():
            rel=f.relative_to(stage).as_posix();rows.append({'path':rel,'candidateSHA256':digest(f),
              'originalSHA256':digest(p/rel) if (p/rel).is_file() else None})
    core.require(digest(p/'installation.json')==original_record,'PRODUCT_HOLD_TARGET_CHANGED_DURING_PREPARE')
    plan={'contract':'FOCURVE_PRODUCT_HOLD_PATCH_1','installationId':r['id'],'extensionId':r['extensionId'],
          'operationId':op,'expectedRecordSHA256':original_record,'notAfterUTC':end.isoformat(),'files':rows,
          'requiresUserExtensionReload':True,'startsServices':False,'changesHold':False,'START_END':False,
          'backupRequiredBeforeApply':True,'restoreOnlyBeforeRuntimeAndIfCurrentCandidateHashesMatch':True}
    if peer is not None:plan.update(chromeRebind=True,newChrome=peer)
    if preflight_rejection_sha256 is not None:plan['preflightRejectionSHA256']=preflight_rejection_sha256
    (out/'PATCH-PREVIEW.json').write_bytes(encoded(plan));return plan

def apply(core,instance,output,approve=False):
    """Separate explicit patch approval; does not execute recovery or services."""
    core.require(approve is True,'PRODUCT_HOLD_APPLY_APPROVAL_REQUIRED')
    p=safe_path(instance);out=safe_path(output);plan=core.read(out/'PATCH-PREVIEW.json')
    core.require(plan.get('contract')=='FOCURVE_PRODUCT_HOLD_PATCH_1','PRODUCT_HOLD_PATCH_CONTRACT')
    r=core.read(p/'installation.json');classify(r,core.read(p/'product-runtime-first-failure.json'))
    core.require(core.child(core.installations(),r['id'])==p and r.get('contract')==core.CONTRACT,
                 'PRODUCT_HOLD_INSTALLATION_MISMATCH')
    core.require(plan['installationId']==r['id'] and plan['extensionId']==r['extensionId'] and
                 digest(p/'installation.json')==plan['expectedRecordSHA256'],'PRODUCT_HOLD_PATCH_TARGET_CHANGED')
    end=datetime.datetime.fromisoformat(plan['notAfterUTC'])
    core.require(end.tzinfo is not None and datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=3)<end,
                 'PRODUCT_HOLD_APPLY_WINDOW_EXPIRED')
    op=plan['operationId'];core.require(str(uuid.UUID(hex=op)).replace('-','')==op,'PRODUCT_HOLD_PATCH_OPERATION')
    generated={'control/native-link/binding.json','control/native-link/product-hold-grant.json',
               'control/native-link/FOCURVE.NativeLink.exe','app/extension/native-link/config.js',
               'tools/InstallTools.class','control/product-hold-evidence/'+op+'/runtime.py',
               'control/product-hold-evidence/'+op+'/binding.json','control/product-hold-evidence/'+op+'/grant.json'}
    if plan.get('chromeRebind') is True:generated.add('chrome-process.json')
    core.require(len(plan['files'])==len(FILES)+len(generated) and
                 {row['path'] for row in plan['files']}==set(FILES)|generated,'PRODUCT_HOLD_PATCH_FILE_SCOPE')
    core.verify_installed_payload(p,r)
    from product_hold_recovery import ProductHoldRecovery
    if plan.get('chromeRebind') is True:
        if (p/'control/native-link/product-hold-grant.json').exists():
            _,binding,_=scope_eligible(core,p,plan.get('preflightRejectionSHA256'))
        else:
            core.require(classify(r,core.read(p/'product-runtime-first-failure.json'))=='PRODUCT_CHANNEL_CLOSED',
                         'PRODUCT_HOLD_FIRST_REBIND_CAUSE_UNCONFIRMED')
            binding=core.read(p/'control/native-link/binding.json')
        peer,_=current_chrome(core,p,r,binding)
        core.require(peer==plan.get('newChrome'),'PRODUCT_HOLD_PATCH_CHROME_CHANGED')
    else:
        probe=ProductHoldRecovery(core,p,end.isoformat(),None);probe.r=r;probe.prior_owners()
    core.require(not any((p/n).exists() for n in ['STOP','start.lock','stop.lock','product-hold-transition.lock',
                  'auth-recovery-runtime.lock']),'PRODUCT_HOLD_PATCH_OTHER_OPERATION')
    for row in plan['files']:
        stage=safe_path(out/'patch'/row['path']);target=safe_path(p/row['path'])
        core.require(stage.is_relative_to(out/'patch') and target.is_relative_to(p) and
                     digest(stage)==row['candidateSHA256'] and
                     (digest(target) if target.is_file() else None)==row['originalSHA256'],
                     'PRODUCT_HOLD_PATCH_FILE_CHANGED')
    lock=p/'product-update.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_BINARY',0));complete=False
    try:
        core.require(digest(p/'installation.json')==plan['expectedRecordSHA256'],'PRODUCT_HOLD_PATCH_TARGET_CHANGED')
        contents={}
        for row in plan['files']:
            staged=safe_path(out/'patch'/row['path']);target=safe_path(p/row['path'])
            raw=staged.read_bytes()
            core.require(staged.is_relative_to(out/'patch') and target.is_relative_to(p) and
                         hashlib.sha256(raw).hexdigest()==row['candidateSHA256'] and
                         (digest(target) if target.is_file() else None)==row['originalSHA256'],
                         'PRODUCT_HOLD_PATCH_FILE_CHANGED')
            contents[row['path']]=raw
        backup=out/'original-backup';backup.mkdir()
        for rel in [*(row['path'] for row in plan['files']),'installation.json','control/MANIFEST.json']:
            if (p/rel).is_file():
                dest=backup/rel;dest.parent.mkdir(parents=True,exist_ok=True);put_once(dest,(p/rel).read_bytes())
        for row in plan['files']:
            dest=p/row['path'];dest.parent.mkdir(parents=True,exist_ok=True)
            atomic_write(dest,contents[row['path']])
        hashes={row['path']:row['sha256'] for row in r['payload']}
        hashes.update({row['path']:row['candidateSHA256'] for row in plan['files'] if row['path']!='chrome-process.json'})
        manifest={'version':'0.1.25-product-hold-transition','files':[
            {'path':name[len('control/'):],'sha256':sha} for name,sha in sorted(hashes.items())
            if name.startswith('control/') and name!='control/MANIFEST.json']}
        atomic_write(p/'control/MANIFEST.json',encoded(manifest));hashes['control/MANIFEST.json']=digest(p/'control/MANIFEST.json')
        updated={**r,'payload':[{'path':name,'sha256':sha} for name,sha in sorted(hashes.items())]}
        core.require(state_digest(updated)==state_digest(r),'PRODUCT_HOLD_STATE_MUST_NOT_CHANGE_ON_PATCH')
        atomic_write(p/'installation.json',encoded(updated));core.verify_installed_payload(p,updated)
        if plan.get('chromeRebind') is True:core.verify_process(p,'chrome')
        put_once(out/'APPLY-RESULT.json',encoded({'state':'APPLIED_HOLD_UNCHANGED','operationId':op,
            'extensionReloadRequired':True,'servicesStarted':False,'holdTransitionExecuted':False}))
        complete=True
    finally:
        os.close(fd)
        if complete:lock.unlink()

SCOPE_FILES={'control/native-link/binding.json','control/native-link/product-hold-grant.json',
             'control/native-link/FOCURVE.NativeLink.exe','app/extension/native-link/config.js','chrome-process.json'}

def observation_quiet(core,p):
    """No background process may race a temporary entry replacement/restoration."""
    rows=json.loads(core.run(['powershell.exe','-NoProfile','-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress'],text=True).stdout or '[]')
    rows=rows if isinstance(rows,list) else [rows]
    me=next((x for x in rows if x['ProcessId']==os.getpid()),None)
    core.require(me is not None,'PRODUCT_OBSERVATION_CONTROLLER_UNCONFIRMED')
    allowed={os.getpid(),me['ParentProcessId']}
    for row in rows:
        if str(p).lower() in ((row.get('ExecutablePath') or '')+' '+(row.get('CommandLine') or '')).lower():
            core.require(row['ProcessId'] in allowed,'PRODUCT_OBSERVATION_PROCESS_PRESENT')

def prepare_observation_boot(core,instance,source,output,end):
    """Stage the existing inert Worker and inert restored UI documents only.

    No installation writes, launch, registration, authentication or DB action.
    All ordinary pages except the existing direct-read safety/control documents
    are replaced temporarily so restoring an old popup cannot mutate Storage.
    """
    p=safe_path(instance);src=safe_path(source);out=safe_path(output)
    r=core.read(p/'installation.json')
    core.require(core.child(core.installations(),r['id'])==p and
                 classify(r,core.read(p/'product-runtime-first-failure.json'))=='PRODUCT_CHANNEL_CLOSED',
                 'PRODUCT_OBSERVATION_CAUSE_UNCONFIRMED')
    core.require(not out.exists() and not out.is_relative_to(p),'PRODUCT_OBSERVATION_OUTSIDE_STAGE_REQUIRED')
    now=datetime.datetime.now(datetime.timezone.utc)
    core.require(end.tzinfo is not None and now<end<=now+datetime.timedelta(minutes=15),
                 'PRODUCT_OBSERVATION_WINDOW_INVALID')
    core.verify_installed_payload(p,r);observation_quiet(core,p)
    # Profiles that explicitly restore external tabs are not a read-only boot.
    preferences=core.read(p/'profile/Default/Preferences')
    core.require(preferences.get('profile',{}).get('exit_type')=='Normal' and
                 preferences.get('session',{}).get('restore_on_startup',5)==5 and
                 not preferences.get('session',{}).get('startup_urls'),
                 'PRODUCT_OBSERVATION_PROFILE_RESTORE_UNCONFIRMED')
    templates=[src/'distribution/installer/readonly-worker.js',src/'installer/readonly-worker.js',src/'control/installer/readonly-worker.js']
    template=next((x for x in templates if x.is_file()),None)
    core.require(template is not None,'PRODUCT_OBSERVATION_ENTRY_REQUIRED')
    worker=template.read_bytes()
    core.require(hashlib.sha256(worker).hexdigest()=='601c8adcd7fdfef8b20254aff0a8ee14e1c628e2b5c48314817d4a99e1647133','PRODUCT_OBSERVATION_ENTRY_UNCONFIRMED')
    inert=b'<!doctype html><meta charset="utf-8"><title>FOCURVE observation only</title><p>FOCURVE read-only observation. Services and focus are closed.</p>'
    operation=uuid.uuid4().hex
    entry='app/extension/background/observation-'+operation+'.js'
    manifest=core.read(p/'app/extension/manifest.json')
    core.require(manifest.get('manifest_version')==3 and manifest.get('background',{}).get('service_worker')=='background/service-worker.js',
                 'PRODUCT_OBSERVATION_MANIFEST_UNCONFIRMED')
    manifest={**manifest,'background':{**manifest['background'],'service_worker':entry.removeprefix('app/extension/')}}
    candidates={'app/extension/background/service-worker.js':worker,entry:worker,
                'app/extension/manifest.json':encoded(manifest)}
    for page in (p/'app/extension').rglob('*.html'):
        rel=page.relative_to(p).as_posix()
        if rel not in ['app/extension/safety/index.html','app/extension/native-link/index.html']:
            candidates[rel]=inert
    out.mkdir(parents=True)
    for name,data in candidates.items():
        backups=[('patch',data)]+([('original',(p/name).read_bytes())] if (p/name).is_file() else [])
        for folder,raw in backups:
            target=out/folder/name;target.parent.mkdir(parents=True,exist_ok=True);put_once(target,raw)
    plan={'contract':'FOCURVE_CHANNEL_OBSERVATION_BOOT_1','operationId':operation,
        'installationId':r['id'],'extensionId':r['extensionId'],'profile':str(p/'profile'),
        'recordStateSHA256':state_digest(r),'expectedRecordSHA256':digest(p/'installation.json'),
        'notBeforeUTC':now.isoformat(),'notAfterUTC':end.isoformat(),
        'failureSHA256':digest(p/'product-runtime-first-failure.json'),
        'files':[{'path':n,'originalSHA256':digest(p/n) if (p/n).is_file() else None,'candidateSHA256':hashlib.sha256(data).hexdigest()}
                 for n,data in sorted(candidates.items())],
        'approved':False,'servicesStarted':False,'normalProductInitialized':False,
        'chromeInternalFilesImmutable':False,'actualChromeVerified':False}
    put_once(out/'OBSERVATION-PLAN.json',encoded(plan));return plan

def observation_scope(core,p,out):
    plan=core.read(out/'OBSERVATION-PLAN.json');r=core.read(p/'installation.json')
    core.require(plan.get('contract')=='FOCURVE_CHANNEL_OBSERVATION_BOOT_1' and
                 core.child(core.installations(),r['id'])==p and
                 r['id']==plan['installationId'] and r['extensionId']==plan['extensionId'] and
                 str(p/'profile')==plan['profile'] and
                 digest(p/'product-runtime-first-failure.json')==plan['failureSHA256'],
                 'PRODUCT_OBSERVATION_IDENTITY_OR_EVIDENCE_CHANGED')
    core.require(re.fullmatch('[a-f0-9]{32}',plan.get('operationId','')) and
                 len(plan['files'])==len({x['path'] for x in plan['files']}) and
                 any(x['path']=='app/extension/background/service-worker.js' for x in plan['files']),
                 'PRODUCT_OBSERVATION_PLAN_SHAPE')
    start=datetime.datetime.fromisoformat(plan['notBeforeUTC']);end=datetime.datetime.fromisoformat(plan['notAfterUTC'])
    core.require(start.tzinfo is not None and end.tzinfo is not None and
                 datetime.timedelta(0)<end-start<=datetime.timedelta(minutes=15),'PRODUCT_OBSERVATION_DEADLINE_INVALID')
    for row in plan['files']:
        name=row['path'];f=safe_path(p/name)
        core.require(f.is_relative_to(p/'app/extension') and
                     (name in ['app/extension/background/service-worker.js','app/extension/manifest.json',
                               'app/extension/background/observation-'+plan['operationId']+'.js'] or name.endswith('.html')) and
                     name not in ['app/extension/safety/index.html','app/extension/native-link/index.html'],
                     'PRODUCT_OBSERVATION_FILE_SCOPE')
    return plan,r

def apply_observation_boot(core,instance,output,approve=False):
    core.require(approve is True,'PRODUCT_OBSERVATION_APPLY_APPROVAL_REQUIRED')
    p=safe_path(instance);out=safe_path(output);plan,r=observation_scope(core,p,out)
    end=datetime.datetime.fromisoformat(plan['notAfterUTC'])
    core.require(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=2)<end and
                 state_digest(r)==plan['recordStateSHA256'] and digest(p/'installation.json')==plan['expectedRecordSHA256'],
                 'PRODUCT_OBSERVATION_SCOPE_EXPIRED_OR_CHANGED')
    core.verify_installed_payload(p,r);observation_quiet(core,p)
    for row in plan['files']:
        core.require((digest(p/row['path']) if (p/row['path']).is_file() else None)==row['originalSHA256'] and
                     (digest(out/'original'/row['path']) if (out/'original'/row['path']).is_file() else None)==row['originalSHA256'] and
                     digest(out/'patch'/row['path'])==row['candidateSHA256'],
                     'PRODUCT_OBSERVATION_PAYLOAD_CHANGED')
    lock=p/'product-observation.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_BINARY',0))
    try:
        os.write(fd,encoded({'operationId':plan['operationId']}));os.fsync(fd)
        put_once(out/'installation.original.json',encoded(r))
        for row in plan['files']:atomic_write(p/row['path'],(out/'patch'/row['path']).read_bytes())
        hashes={x['path']:x['sha256'] for x in r['payload']}
        hashes.update({x['path']:x['candidateSHA256'] for x in plan['files']})
        updated={**r,'payload':[{'path':n,'sha256':v} for n,v in sorted(hashes.items())]}
        core.require(state_digest(updated)==state_digest(r),'PRODUCT_OBSERVATION_HOLD_MUST_NOT_CHANGE')
        atomic_write(p/'installation.json',encoded(updated));core.verify_installed_payload(p,updated)
        put_once(out/'APPLIED.json',encoded({'operationId':plan['operationId'],'notAfterUTC':plan['notAfterUTC'],'planSHA256':digest(out/'OBSERVATION-PLAN.json')}))
    finally:os.close(fd)

def launch_observation_boot(core,instance,output,approve=False):
    core.require(approve is True,'PRODUCT_OBSERVATION_LAUNCH_APPROVAL_REQUIRED')
    p=safe_path(instance);out=safe_path(output);plan,r=observation_scope(core,p,out)
    core.require(core.read(out/'APPLIED.json')['operationId']==plan['operationId'] and
                 core.read(out/'APPLIED.json')['planSHA256']==digest(out/'OBSERVATION-PLAN.json') and
                 core.read(p/'product-observation.lock')=={'operationId':plan['operationId']} and
                 not (out/'LAUNCHED.json').exists() and
                 datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=2)<datetime.datetime.fromisoformat(plan['notAfterUTC']),
                 'PRODUCT_OBSERVATION_NOT_APPLIED_OR_EXPIRED')
    core.verify_installed_payload(p,r);observation_quiet(core,p)
    for row in plan['files']:core.require(digest(p/row['path'])==row['candidateSHA256'],'PRODUCT_OBSERVATION_ENTRY_CHANGED')
    # A one-shot marker is written before spawn: an ambiguous launch cannot retry.
    put_once(out/'LAUNCHED.json',encoded({'operationId':plan['operationId'],'state':'REQUESTED_NO_AUTOMATIC_RETRY'}))
    args=core.browser_arguments(p,r);args[-1]='chrome-extension://'+r['extensionId']+'/safety/index.html'
    core.require(not any('remote-debugging' in str(x) for x in args),'PRODUCT_OBSERVATION_DEBUGGER_FORBIDDEN')
    core.spawn_owned(args,p,'chrome')
    return {'state':'OBSERVATION_ONLY_CHROME_REQUESTED','servicesStarted':False,'START_END':False,
            'windowDisplayVerified':False,'notAfterUTC':plan['notAfterUTC']}

def restore_observation_boot(core,instance,output,approve=False):
    core.require(approve is True,'PRODUCT_OBSERVATION_RESTORE_APPROVAL_REQUIRED')
    p=safe_path(instance);out=safe_path(output);plan,r=observation_scope(core,p,out)
    core.require(core.read(out/'APPLIED.json')['planSHA256']==digest(out/'OBSERVATION-PLAN.json') and
                 core.read(p/'product-observation.lock')=={'operationId':plan['operationId']} and
                 r['status'] in ['PRODUCT_HOLD_PRESERVED','PRODUCT_RECOVERED_FOCUS_LOCKED'],
                 'PRODUCT_OBSERVATION_RESTORE_STATE_UNCONFIRMED')
    observation_quiet(core,p);core.verify_installed_payload(p,r)
    for row in plan['files']:
        core.require(digest(p/row['path'])==row['candidateSHA256'] and
                     (digest(out/'original'/row['path']) if (out/'original'/row['path']).is_file() else None)==row['originalSHA256'],'PRODUCT_OBSERVATION_RESTORE_CHANGED')
    hashes={x['path']:x['sha256'] for x in r['payload']}
    for row in plan['files']:
        if row['originalSHA256'] is None:
            target=safe_path(p/row['path']);archive=safe_path(out/('restored-observation-'+plan['operationId']+'.js'))
            core.require(target.is_relative_to(p/'app/extension/background') and archive.is_relative_to(out) and not archive.exists(),
                         'PRODUCT_OBSERVATION_ARCHIVE_SCOPE')
            os.rename(target,archive);hashes.pop(row['path'],None)
        else:
            atomic_write(p/row['path'],(out/'original'/row['path']).read_bytes());hashes[row['path']]=row['originalSHA256']
    updated={**r,'payload':[{'path':n,'sha256':v} for n,v in sorted(hashes.items())]}
    core.require(state_digest(updated)==state_digest(r),'PRODUCT_OBSERVATION_RESTORE_STATE_CHANGED')
    if r['status']=='PRODUCT_RECOVERED_FOCUS_LOCKED':
        from product_hold_recovery import verify_receipt
        verify_receipt(p,r)
        op=r['productHoldRecovery']['operationId'];work=p/'product-hold-transitions'/op
        put_once(work/'observation-before-restore.json',(p/'installation.json').read_bytes())
        updated['lastObservationRestore']={'contract':'FOCURVE_CHANNEL_OBSERVATION_RESTORE_1',
            'operationId':plan['operationId'],'originalRecordSHA256':digest(p/'installation.json')}

    atomic_write(p/'installation.json',encoded(updated));core.verify_installed_payload(p,updated)
    if r['status']=='PRODUCT_RECOVERED_FOCUS_LOCKED':
        put_once(work/'observation-restored.json',encoded({'recordSHA256':digest(p/'installation.json'),
            'sourceRecordSHA256':updated['lastObservationRestore']['originalRecordSHA256']}))
    put_once(out/'RESTORED.json',encoded({'operationId':plan['operationId'],'state':'RESTORED_NO_SERVICES',
                                      'holdState':r['status'],'chromeInternalFilesImmutable':False}))
    (p/'product-observation.lock').unlink()

def current_chrome(core,p,record,binding):
    """OS-derived identity only. Never start/stop Chrome or trust a JSON PID."""
    previous=core.read(p/'chrome-process.json')
    try:core.verify_process(p,'chrome')
    except core.InstallError as error:
        if str(error)!='OWNED_PROCESS_NOT_PRESENT':raise
    rows=json.loads(core.run(['powershell.exe','-NoProfile','-Command',
        '@(Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress'],text=True).stdout or '[]')
    rows=rows if isinstance(rows,list) else [rows];matches=[]
    for row in rows:
        command=row.get('CommandLine') or ''
        arg=re.search(r'(?:^|\s)--user-data-dir=(?:"([^"]+)"|([^\s]+))',command)
        if not arg or '--type=' in command or not row.get('ExecutablePath'):continue
        if (pathlib.Path(arg.group(1) or arg.group(2)).resolve()==(p/'profile').resolve() and
            pathlib.Path(row['ExecutablePath']).resolve()==pathlib.Path(record['runtimes']['chrome']).resolve()):
            matches.append(row)
    core.require(len(matches)==1,'PRODUCT_HOLD_EXACT_CHROME_REQUIRED')
    peer=core.process_identity(matches[0]['ProcessId'])
    core.require(peer['ProcessId']==matches[0]['ProcessId'] and peer['CommandLine']==matches[0]['CommandLine'] and
                 pathlib.Path(peer['ExecutablePath']).resolve()==pathlib.Path(record['runtimes']['chrome']).resolve(),
                 'PRODUCT_HOLD_CHROME_IDENTITY_CHANGED')
    sid=core.run(['powershell.exe','-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).stdout.strip()
    owner=json.loads(core.run(['powershell.exe','-NoProfile','-Command',
        '(Get-CimInstance Win32_Process -Filter "ProcessId='+str(int(peer['ProcessId']))+'" | Invoke-CimMethod -MethodName GetOwnerSid) | Select-Object ReturnValue,Sid | ConvertTo-Json -Compress'],text=True).stdout)
    core.require(sid==binding.get('userSid') and owner.get('ReturnValue')==0 and owner.get('Sid')==sid,
                 'PRODUCT_HOLD_CHROME_OWNER_UNCONFIRMED')
    core.require(re.search(r'Date\((\d+)\)',peer['CreationDate']) is not None,'PRODUCT_HOLD_CHROME_CREATION_UNCONFIRMED')
    return peer,previous

def verify_preflight_repair(core,p,r,g,expected_sha256):
    """Explicit code-patch approval may close only this proven no-effect refusal.

    Never admits a failed transition, UNKNOWN, auth recovery or automatic renewal.
    The captured Native rejection must be pinned by its exact reviewed hash.
    """
    file=safe_path(p/'product-hold-diagnostics'/g['operationId']/'first-rejection.json')
    core.require(isinstance(expected_sha256,str) and re.fullmatch('[a-f0-9]{64}',expected_sha256) and
                 file.is_file() and digest(file)==expected_sha256,'PRODUCT_HOLD_PREVIOUS_ATTEMPT_PRESERVED')
    failure=core.read(file);at=datetime.datetime.fromisoformat(failure.get('atUTC',''))
    core.require(failure.get('contract')=='FOCURVE_PRODUCT_HOLD_REJECTION_1' and
                 failure.get('installationId')==r['id'] and failure.get('operationId')==g['operationId'] and
                 failure.get('code')=='PRODUCT_HOLD_CONFLICTING_PROCESS' and failure.get('phase')=='PREFLIGHT' and
                 failure.get('stage') in ['INITIAL','OWNERSHIP_VERIFY'] and failure.get('transitionRetried') is False and
                 failure.get('originalFailureSHA256')==g['failureSHA256'] and at.tzinfo is not None and
                 datetime.datetime.fromisoformat(g['notBeforeUTC'])<=at<datetime.datetime.fromisoformat(g['notAfterUTC']),
                 'PRODUCT_HOLD_PREFLIGHT_REPAIR_NOT_SUPPORTED')
    request={'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'RECOVER_PRODUCT_HOLD',
             'installationId':r['id'],'extensionId':r['extensionId']}
    request_id=hashlib.sha256(encoded(request)).hexdigest()
    reply={'contract':'FOCURVE_RUNTIME_PROBE_1','operation':'FAILED','code':'PRODUCT_HOLD_CONFLICTING_PROCESS',
           'operationId':g['operationId'],'requestId':request_id}
    core.require(failure.get('requestId')==request_id and
                 failure.get('responseId')==hashlib.sha256(encoded(reply)).hexdigest(),
                 'PRODUCT_HOLD_PREFLIGHT_EVIDENCE_BINDING_MISMATCH')

def scope_eligible(core,p,preflight_rejection_sha256=None):
    r=core.read(p/'installation.json');classify(r,core.read(p/'product-runtime-first-failure.json'))
    core.require(core.child(core.installations(),r['id'])==p and r.get('contract')==core.CONTRACT,
                 'PRODUCT_HOLD_INSTALLATION_MISMATCH')
    core.verify_installed_payload(p,r)
    core.require(not any((p/n).exists() for n in ['STOP','product-update.lock','start.lock','stop.lock',
                 'product-hold-transition.lock','auth-recovery-runtime.lock']), 'PRODUCT_HOLD_SCOPE_OTHER_OPERATION')
    b=core.read(p/'control/native-link/binding.json');g=core.read(p/'control/native-link/product-hold-grant.json')
    try:old_ends=[datetime.datetime.fromisoformat(x['notAfterUTC']) for x in [b,g]]
    except (KeyError,ValueError,TypeError):raise RuntimeError('PRODUCT_HOLD_PREVIOUS_SCOPE_UNCONFIRMED') from None
    core.require(all(x.tzinfo is not None and x<=datetime.datetime.now(datetime.timezone.utc) for x in old_ends),
                 'PRODUCT_HOLD_PREVIOUS_SCOPE_STILL_VALID')
    core.require(b.get('runtimeFiles',{}).get('control/native-link/product-hold-grant.json')==digest(p/'control/native-link/product-hold-grant.json') and
                 state_digest(r)==g.get('recordStateSHA256'),'PRODUCT_HOLD_SCOPE_RECORD_OR_GRANT_CHANGED')
    core.require(re.fullmatch('[a-f0-9]{32}',g.get('operationId','')) and
                 not (p/'product-hold-transitions'/g['operationId']).exists(),
                 'PRODUCT_HOLD_PREVIOUS_ATTEMPT_PRESERVED')
    rejection=p/'product-hold-diagnostics'/g['operationId']/'first-rejection.json'
    if rejection.exists():verify_preflight_repair(core,p,r,g,preflight_rejection_sha256)
    else:core.require(preflight_rejection_sha256 is None,'PRODUCT_HOLD_PREFLIGHT_REPAIR_NOT_SUPPORTED')
    core.require(g.get('contract')==CONTRACT and b.get('installationId')==r['id'] and
                 b.get('extensionId')==r['extensionId'] and b.get('profile')==str(p/'profile') and
                 b.get('installationPath')==str(p),'PRODUCT_HOLD_SCOPE_BINDING_MISMATCH')
    validate_preserved_cause(core,p,r,g,core.read(p/'product-runtime-first-failure.json'))
    core.require(lock_identity(p/'product-runtime.lock')==g['originalLockIdentity'] and
                 digest(p/'mysql.ini')==g['mysqlConfigSHA256'] and digest(p/'root-client.ini')==g['rootClientSHA256'],
                 'PRODUCT_HOLD_SCOPE_EVIDENCE_CHANGED')
    for name in ['server','mysql','reauth-server','reauth-mysql','reauth-mysql-listener','hold-mysql']:
        f=p/(name+'-process.json')
        if not f.exists():continue
        try:core.process_identity(core.read(f)['ProcessId'])
        except core.InstallError as error:
            if str(error)!='OWNED_PROCESS_NOT_PRESENT':raise
        else:raise RuntimeError('PRODUCT_HOLD_PRIOR_OWNER_PRESENT')
    core.port_available(r['config']['mysqlPort']);core.port_available(r['config']['webPort'])
    if preflight_rejection_sha256 is not None:
        from product_hold_recovery import ProductHoldRecovery
        review=ProductHoldRecovery(core,p,g['notAfterUTC'],None);review.r=r
        review.other_controllers()
    return r,b,g

def prepare_scope(core,instance,output,end,approve=False):
    """New explicit scope on unattempted HOLD; reuse code and cause evidence.

    Works after the old browser exits only if the new exact dedicated profile
    and Windows owner can be established. No process records change here.
    """
    core.require(approve is True,'PRODUCT_HOLD_SCOPE_APPROVAL_REQUIRED')
    now=datetime.datetime.now(datetime.timezone.utc)
    core.require(end.tzinfo is not None and now+datetime.timedelta(minutes=5)<end<=now+datetime.timedelta(minutes=20),
                 'PRODUCT_HOLD_SCOPE_WINDOW_INVALID')
    p=safe_path(instance);out=pathlib.Path(output).resolve()
    core.require(not out.exists() and not out.is_relative_to(p),'PRODUCT_HOLD_SCOPE_OUTSIDE_STAGE_REQUIRED')
    r,b,g=scope_eligible(core,p);peer,previous=current_chrome(core,p,r,b)
    original=digest(p/'installation.json');stage=out/'scope';stage.mkdir(parents=True)
    op=uuid.uuid4().hex;g={**g,'operationId':op,'notBeforeUTC':now.isoformat(),'notAfterUTC':end.isoformat()}
    (stage/'product-hold-grant.json').write_bytes(encoded(g))
    b={**b,'notAfterUTC':end.isoformat(),'allowProductHoldRecovery':True,'allowUserSession':False,'allowRuntimeProbe':True,
       'chromePID':peer['ProcessId'],'chromeCreatedMs':int(re.search(r'Date\((\d+)\)',peer['CreationDate']).group(1)),
       'chromeExecutable':peer['ExecutablePath'],'runtimeFiles':dict(b['runtimeFiles'])}
    b['runtimeFiles']['control/native-link/product-hold-grant.json']=digest(stage/'product-hold-grant.json')
    (stage/'binding.json').write_bytes(encoded(b))
    build=out/'NativeLinkBuild.cs';build.write_text('internal static class NativeLinkBuild { internal const string BindingSHA256="'+digest(stage/'binding.json')+'"; }',encoding='utf8')
    core.require(compile_native(p/'control/native/NativeLinkHost.cs',build,stage/'FOCURVE.NativeLink.exe',out/'native-build.log')==0,
                 'PRODUCT_HOLD_SCOPE_NATIVE_BUILD_FAILED')
    (stage/'config.js').write_text('globalThis.FOCURVE_NATIVE_LINK_CONFIG=Object.freeze('+json.dumps({
        'contract':'FOCURVE_NATIVE_LINK_CONFIG_1','installationId':r['id'],'extensionId':r['extensionId'],
        'host':r['nativeLink']['hostName'],'notAfterUTC':end.isoformat(),'productHoldRecoveryEnabled':True,'userSessionEnabled':False})+');\n',encoding='utf8')
    (stage/'chrome-process.json').write_bytes(encoded(peer))
    mapping={'control/native-link/binding.json':'binding.json','control/native-link/product-hold-grant.json':'product-hold-grant.json',
             'control/native-link/FOCURVE.NativeLink.exe':'FOCURVE.NativeLink.exe',
             'app/extension/native-link/config.js':'config.js','chrome-process.json':'chrome-process.json'}
    plan={'contract':'FOCURVE_PRODUCT_HOLD_SCOPE_UPDATE_1','operationId':op,'installationId':r['id'],
          'expectedRecordSHA256':original,'notAfterUTC':end.isoformat(),'newChrome':peer,
          'priorChrome':previous,'files':[{'path':t,'stage':s,'originalSHA256':digest(p/t),'candidateSHA256':digest(stage/s)} for t,s in mapping.items()],
          'servicesStarted':False,'holdChanged':False,'extensionReloadRequired':False,'pageRefreshRequired':True}
    core.require(digest(p/'installation.json')==original,'PRODUCT_HOLD_SCOPE_TARGET_CHANGED')
    (out/'SCOPE-PREVIEW.json').write_bytes(encoded(plan));return plan

def apply_scope(core,instance,output,approve=False):
    core.require(approve is True,'PRODUCT_HOLD_SCOPE_APPLY_APPROVAL_REQUIRED')
    p=safe_path(instance);out=safe_path(output);plan=core.read(out/'SCOPE-PREVIEW.json')
    core.require(plan.get('contract')=='FOCURVE_PRODUCT_HOLD_SCOPE_UPDATE_1' and
                 {x['path'] for x in plan['files']}==SCOPE_FILES and len(plan['files'])==len(SCOPE_FILES),
                 'PRODUCT_HOLD_SCOPE_FILE_LIST_REJECTED')
    end=datetime.datetime.fromisoformat(plan['notAfterUTC']);now=datetime.datetime.now(datetime.timezone.utc)
    core.require(end.tzinfo is not None and now+datetime.timedelta(minutes=3)<end<=now+datetime.timedelta(minutes=20),
                 'PRODUCT_HOLD_SCOPE_APPLY_EXPIRED')
    r,b,g=scope_eligible(core,p);peer,_=current_chrome(core,p,r,b)
    core.require(plan['installationId']==r['id'] and digest(p/'installation.json')==plan['expectedRecordSHA256'] and
                 peer==plan['newChrome'],'PRODUCT_HOLD_SCOPE_TARGET_OR_CHROME_CHANGED')
    for row in plan['files']:
        staged=safe_path(out/'scope'/row['stage']);target=safe_path(p/row['path'])
        core.require(staged.is_relative_to(out/'scope') and target.is_relative_to(p) and
                     digest(staged)==row['candidateSHA256'] and digest(target)==row['originalSHA256'],
                     'PRODUCT_HOLD_SCOPE_FILE_CHANGED')
    lock=p/'product-update.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_BINARY',0));done=False
    try:
        core.require(digest(p/'installation.json')==plan['expectedRecordSHA256'],'PRODUCT_HOLD_SCOPE_TARGET_CHANGED')
        contents={}
        for row in plan['files']:
            staged=safe_path(out/'scope'/row['stage']);target=safe_path(p/row['path'])
            raw=staged.read_bytes()
            core.require(staged.is_relative_to(out/'scope') and target.is_relative_to(p) and
                         hashlib.sha256(raw).hexdigest()==row['candidateSHA256'] and
                         digest(target)==row['originalSHA256'],'PRODUCT_HOLD_SCOPE_FILE_CHANGED')
            contents[row['path']]=raw
        backup=out/'original-backup';backup.mkdir()
        for n in [*(row['path'] for row in plan['files']),'installation.json','control/MANIFEST.json']:
            dest=backup/n;dest.parent.mkdir(parents=True,exist_ok=True);put_once(dest,(p/n).read_bytes())
        for row in plan['files']:atomic_write(p/row['path'],contents[row['path']])
        hashes={x['path']:x['sha256'] for x in r['payload']}
        hashes.update({x['path']:x['candidateSHA256'] for x in plan['files'] if x['path']!='chrome-process.json'})
        atomic_write(p/'control/MANIFEST.json',encoded({'version':'0.1.25-product-hold-scope','files':[
            {'path':n[len('control/'):],'sha256':v} for n,v in sorted(hashes.items()) if n.startswith('control/') and n!='control/MANIFEST.json']}))
        hashes['control/MANIFEST.json']=digest(p/'control/MANIFEST.json')
        updated={**r,'payload':[{'path':n,'sha256':v} for n,v in sorted(hashes.items())]}
        core.require(state_digest(updated)==state_digest(r),'PRODUCT_HOLD_SCOPE_MUST_NOT_CHANGE_HOLD')
        atomic_write(p/'installation.json',encoded(updated));core.verify_installed_payload(p,updated)
        core.verify_process(p,'chrome')
        put_once(out/'APPLY-RESULT.json',encoded({'state':'NEW_SCOPE_BOUND_HOLD_PRESERVED','servicesStarted':False,
            'START_END':False,'extensionReloadRequired':False,'pageRefreshRequired':True,'originalOwnerArchived':True}))
        done=True
    finally:
        os.close(fd)
        if done:lock.unlink()
