"""Native-host-only transition for a proven pre-service local-check HOLD.

No credential refresh, server startup, browser debugger or focus admission.
The original failure and lock are retained; a fresh grant is required per attempt.
"""
import configparser, datetime, hashlib, json, os, pathlib, re, uuid
from product_runtime import RuntimeProbe, RuntimeFailure, need
from hold_recovery import atomic_write, encoded, digest, put_once, safe_path

CONTRACT = 'FOCURVE_PRODUCT_HOLD_TRANSITION_1'
STATE = 'PRODUCT_RECOVERED_FOCUS_LOCKED'

def lock_identity(path):
    value=pathlib.Path(path).stat()
    return {'inode':value.st_ino,'createdNs':value.st_ctime_ns,'size':value.st_size}

def ready_identity(path):
    value=pathlib.Path(path).stat()
    return {'inode':value.st_ino,'createdNs':value.st_ctime_ns,'modifiedNs':value.st_mtime_ns,'size':value.st_size}

def state_digest(record):
    # A separately approved payload update changes only payload hashes. Pin all
    # other metadata; do not create a circular grant/binding/payload hash.
    return hashlib.sha256(encoded({k:v for k,v in record.items() if k!='payload'})).hexdigest()

def classify(record, failure):
    need(record.get('status')=='PRODUCT_HOLD_PRESERVED', 'NOT_PRODUCT_LOCAL_HOLD')
    if failure.get('code')=='PRODUCT_CHANNEL_CLOSED':
        need(failure.get('stage')=='EXTENSION_OPEN_PREPARED' and
             failure.get('exceptionType')=='RuntimeError' and failure.get('preserved') is True and
             failure.get('transport')=={'closed':True,'reason':'PRODUCT_CHANNEL_CLOSED'} and
             failure.get('stopReason') is None,'PRODUCT_HOLD_CHANNEL_CAUSE_UNCONFIRMED')
        return 'PRODUCT_CHANNEL_CLOSED'
    need(failure.get('code')=='PRODUCT_LOCAL_NOT_CLEAR' and
         failure.get('stage')=='EXTENSION_CHECK_LOCAL' and
         failure.get('exceptionType')=='RuntimeFailure' and failure.get('preserved') is True,
         'PRODUCT_HOLD_CAUSE_NOT_SUPPORTED')
    need(failure.get('transport')=={'closed':False,'reason':None} and
         failure.get('stopReason') is None, 'PRODUCT_HOLD_CAUSE_UNCONFIRMED')
    return 'PRODUCT_LOCAL_NOT_CLEAR'


def validate_channel_cause(core,p,record,g,failure):
    # A stage label alone cannot prove that READY was ever acknowledged.
    for name,key in [('product-runtime-first-failure.json','failureSHA256'),
                     ('product-runtime.lock','originalLockSHA256'),('admission.ready','readySHA256')]:
        need(digest(p/name)==g.get(key),'PRODUCT_HOLD_CHANNEL_EVIDENCE_MISMATCH')
    need((p/'product-runtime.lock').stat().st_size==0,'PRODUCT_HOLD_CHANNEL_LOCK_UNCONFIRMED')
    need(ready_identity(p/'admission.ready')==g.get('readyIdentity'),'PRODUCT_HOLD_CHANNEL_READY_CHANGED')
    ready=core.read(p/'admission.ready')
    need(ready=={'launchId':record.get('launchId')} and
         re.fullmatch('[a-f0-9]{32}',record.get('launchId','')),
         'PRODUCT_HOLD_CHANNEL_READY_UNCONFIRMED')
    cause=p/g['causeRuntimePath'];old_binding=p/g['failedBindingPath'];old_grant=p/g['failedGrantPath']
    for file,key in [(cause,'causeRuntimeSHA256'),(old_binding,'failedBindingSHA256'),(old_grant,'failedGrantSHA256')]:
        need(file.resolve().is_relative_to((p/'control').resolve()) and digest(file)==g[key],
             'PRODUCT_HOLD_CHANNEL_ORIGINAL_UNCONFIRMED')
    source=cause.read_text(encoding='utf-8-sig')
    need("r['status']='PRODUCT_RUNNING_USER_SESSION'" in source and
         "self.stop_reason=self.await_stop()" in source and "'admission.ready'" in source,
         'PRODUCT_HOLD_CHANNEL_RUNTIME_UNCONFIRMED')
    old=core.read(old_binding);grant=core.read(old_grant)
    need(old.get('contract')=='FOCURVE_NATIVE_BINDING_1' and
         all(old.get(k)==v for k,v in {'installationId':record['id'],'extensionId':record['extensionId'],
                                      'profile':str(p/'profile')}.items()) and
         grant.get('contract')=='FOCURVE_USER_SESSION_GRANT_1' and
         grant.get('scope')=='USER_UI_SERVICES_AND_SAFE_STOP' and
         all(grant.get(k)==old.get(k) for k in ['installationId','extensionId','verificationId','notAfterUTC']),
         'PRODUCT_HOLD_CHANNEL_SCOPE_UNCONFIRMED')
    failed=datetime.datetime.fromisoformat(failure['atUTC'])
    approved=datetime.datetime.fromisoformat(grant['approvedAtUTC'])
    end=datetime.datetime.fromisoformat(old['notAfterUTC'])
    launch_end=datetime.datetime.fromisoformat(record['launchDeadlineUTC'])
    ready_at=datetime.datetime.fromtimestamp((p/'admission.ready').stat().st_mtime,datetime.timezone.utc)
    need(all(x.tzinfo is not None for x in [failed,approved,end,launch_end]) and
         approved<=ready_at<=failed<launch_end<=end and
         (p/'admission.closed').stat().st_mtime>=ready_at.timestamp(),
         'PRODUCT_HOLD_CHANNEL_TIMELINE_UNCONFIRMED')


def validate_preserved_cause(core, p, record, g, failure):
    if classify(record,failure)=='PRODUCT_CHANNEL_CLOSED':
        return validate_channel_cause(core,p,record,g,failure)
    need(digest(p/'product-runtime-first-failure.json')==g['failureSHA256'] and
         (p/'product-runtime.lock').stat().st_size==0 and
         digest(p/'product-runtime.lock')==g['originalLockSHA256'], 'PRODUCT_HOLD_EVIDENCE_MISMATCH')
    # The exact reviewed original runtime is preserved inside the approved
    # payload. The grant pins it; an error label alone cannot prove phase.
    cause=p/g['causeRuntimePath']
    need(cause.resolve().is_relative_to((p/'control').resolve()) and
         digest(cause)==g['causeRuntimeSHA256'], 'PRODUCT_HOLD_CAUSE_RUNTIME_UNCONFIRMED')
    source=cause.read_text(encoding='utf-8-sig')
    need('self.r=r;self.local_clear();self.secret=' in source and
         source.index('self.r=r;self.local_clear();self.secret=')<source.index('c.prepare_launch_configuration(')<source.index("self.stage='MYSQL_PREPARE'"),
         'PRODUCT_HOLD_PRE_SERVICE_PHASE_UNCONFIRMED')
    # CHECK_LOCAL also occurs after service start in the legacy runtime.
    # Never infer the first-check phase from its reused stage label alone.
    old_binding=p/g['failedBindingPath']
    need(old_binding.resolve().is_relative_to((p/'control').resolve()) and
         digest(old_binding)==g['failedBindingSHA256'],'PRODUCT_HOLD_FAILED_SCOPE_UNCONFIRMED')
    old=core.read(old_binding)
    old_grant=p/g['failedGrantPath']
    need(old_grant.resolve().is_relative_to((p/'control').resolve()) and
         digest(old_grant)==g['failedGrantSHA256'],'PRODUCT_HOLD_FAILED_SCOPE_UNCONFIRMED')
    original_grant=core.read(old_grant)
    failed_at=datetime.datetime.fromisoformat(failure['atUTC'])
    previous_end=datetime.datetime.fromisoformat(record['launchDeadlineUTC'])
    failed_end=datetime.datetime.fromisoformat(old['notAfterUTC'])
    approved_at=datetime.datetime.fromisoformat(original_grant['approvedAtUTC'])
    need(all(x.tzinfo is not None for x in [failed_at,previous_end,failed_end,approved_at]) and
         original_grant.get('contract')=='FOCURVE_USER_SESSION_GRANT_1' and
         original_grant.get('scope')=='USER_UI_SERVICES_AND_SAFE_STOP' and
         original_grant.get('installationId')==record['id'] and
         original_grant.get('extensionId')==record['extensionId'] and
         original_grant.get('verificationId')==old.get('verificationId') and
         original_grant.get('notAfterUTC')==old.get('notAfterUTC') and
         old.get('contract')=='FOCURVE_NATIVE_BINDING_1' and
         old.get('installationId')==record['id'] and old.get('extensionId')==record['extensionId'] and
         old.get('profile')==str(p/'profile') and previous_end<approved_at<=failed_at and
         failed_at+datetime.timedelta(seconds=23)<failed_end,
         'PRODUCT_HOLD_PRE_SERVICE_PHASE_UNCONFIRMED')

class ProductHoldRecovery(RuntimeProbe):
    def __init__(self, core, installation, deadline, channel):
        super().__init__(core, installation, deadline, channel)
        self.work=None

    def unchanged(self):
        for name in ['installation.json',*self.evidence]: safe_path(self.p/name)
        need((self.p/'installation.json').read_bytes()==self.original, 'PRODUCT_HOLD_RECORD_CHANGED')
        for name, value in self.evidence.items():
            need((self.p/name).read_bytes()==value, 'PRODUCT_HOLD_EVIDENCE_CHANGED')
        need(digest(self.p/'secrets.dpapi')==self.secret_digest,'PRODUCT_HOLD_SECRET_CHANGED')
        need(digest(self.p/'mysql.ini')==self.g['mysqlConfigSHA256'] and
             digest(self.p/'root-client.ini')==self.g['rootClientSHA256'],'PRODUCT_HOLD_DB_CONFIG_CHANGED')
        need(lock_identity(self.p/'product-runtime.lock')==self.g['originalLockIdentity'],
             'PRODUCT_HOLD_LOCK_IDENTITY_CHANGED')
        need(not any((self.p/n).exists() for n in
             ['STOP','start.lock','stop.lock','product-update.lock','auth-recovery-runtime.lock']),
             'PRODUCT_HOLD_CONFLICT_OR_STOP')
        need((self.p/'admission.closed').is_file(), 'PRODUCT_HOLD_ADMISSION_NOT_CLOSED')
        if self.cause=='PRODUCT_CHANNEL_CLOSED':
            need(digest(self.p/'admission.ready')==self.g['readySHA256'] and
                 ready_identity(self.p/'admission.ready')==self.g['readyIdentity'],'PRODUCT_HOLD_CHANNEL_READY_CHANGED')
        else:
            need(not (self.p/'admission.ready').exists(),'PRODUCT_HOLD_ADMISSION_NOT_CLOSED')

    def verified_native_launcher(self, rows, current):
        """Recognize only Chrome's exact cmd -> pinned Native Host ancestry.

        No process-name exception: unrelated shells and unknown ancestry still
        fail. Native Host itself already checks the same Chrome/extension peer.
        """
        by_pid={row['ProcessId']:row for row in rows}
        native=by_pid.get(current['ParentProcessId'])
        expected=safe_path(self.p/'control/native-link/FOCURVE.NativeLink.exe')
        if native is None or not native.get('ExecutablePath') or pathlib.Path(native['ExecutablePath']).resolve()!=expected:return set()
        launcher=by_pid.get(native['ParentProcessId'])
        if launcher is None:return set()
        windows=os.environ.get('SystemRoot') or os.environ.get('WINDIR')
        need(bool(windows),'PRODUCT_HOLD_NATIVE_ANCESTRY_UNCONFIRMED')
        cmd=safe_path(pathlib.Path(windows)/'System32/cmd.exe')
        if not launcher.get('ExecutablePath') or pathlib.Path(launcher['ExecutablePath']).resolve()!=cmd:return set()
        need(cmd.is_file(),'PRODUCT_HOLD_NATIVE_ANCESTRY_UNCONFIRMED')
        binding=self.c.read(self.p/'control/native-link/binding.json')
        from product_hold_patch import current_chrome
        chrome,_=current_chrome(self.c,self.p,self.r,binding)
        created=re.search(r'Date\((\d+)\)',chrome.get('CreationDate',''))
        need(chrome['ProcessId']==binding.get('chromePID') and created is not None and
             type(binding.get('chromeCreatedMs')) is int and abs(int(created.group(1))-binding['chromeCreatedMs'])<=1 and
             pathlib.Path(chrome['ExecutablePath']).resolve()==pathlib.Path(binding.get('chromeExecutable','')).resolve(),
             'PRODUCT_HOLD_NATIVE_ANCESTRY_UNCONFIRMED')
        need(launcher['ParentProcessId']==chrome['ProcessId'],'PRODUCT_HOLD_NATIVE_ANCESTRY_UNCONFIRMED')
        command=launcher.get('CommandLine') or '';origin='chrome-extension://'+binding['extensionId']+'/'
        need(re.search(r'(^|[\s"])'+re.escape(str(expected))+r'(?=["\s]|$)',command,re.I) is not None and
             re.search(re.escape(origin)+r'(?=["\s]|$)',command) is not None,'PRODUCT_HOLD_NATIVE_ANCESTRY_UNCONFIRMED')
        for row in [native,launcher]:
            need(isinstance(row.get('CreationDate'),str),'PRODUCT_HOLD_NATIVE_ANCESTRY_UNCONFIRMED')
            actual=self.c.process_identity(row['ProcessId'])
            need(all(actual.get(k)==row.get(k) for k in ['ProcessId','CreationDate','ExecutablePath','CommandLine']),
                 'PRODUCT_HOLD_NATIVE_ANCESTRY_CHANGED')
            owner=json.loads(self.c.run(['powershell.exe','-NoProfile','-Command',
                '(Get-CimInstance Win32_Process -Filter "ProcessId='+str(int(row['ProcessId']))+'" | Invoke-CimMethod -MethodName GetOwnerSid) | Select-Object ReturnValue,Sid | ConvertTo-Json -Compress'],text=True,timeout=5).stdout)
            need(owner.get('ReturnValue')==0 and owner.get('Sid')==binding.get('userSid'),
                 'PRODUCT_HOLD_NATIVE_OWNER_UNCONFIRMED')
        return {launcher['ProcessId']}

    def prior_owners(self):
        self.stage='OWNERSHIP_VERIFY'
        self.c.verify_process(self.p,'chrome')
        for name in ['mysql','server','reauth-mysql','reauth-server','reauth-mysql-listener','hold-mysql']:
            file=self.p/(name+'-process.json')
            if not file.exists(): continue
            try: self.c.process_identity(self.c.read(file)['ProcessId'])
            except self.c.InstallError as error:
                if str(error)!='OWNED_PROCESS_NOT_PRESENT': raise
            else: raise RuntimeFailure('PRODUCT_HOLD_PRIOR_OWNER_PRESENT')
        self.other_controllers()

    def other_controllers(self):
        # Identify all other controller processes, not just saved service PIDs.
        rows=json.loads(self.c.run(['powershell.exe','-NoProfile','-Command',
            'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json -Compress'],text=True).stdout)
        current=next((x for x in rows if x['ProcessId']==os.getpid()),None)
        need(current is not None,'PRODUCT_HOLD_OWNER_UNCONFIRMED')
        allowed={os.getpid(),current['ParentProcessId']}
        allowed.update(self.verified_native_launcher(rows,current))
        for row in rows:
            exe=(row.get('ExecutablePath') or '').lower()
            command=(row.get('CommandLine') or '').lower()
            if str(self.p).lower() not in exe+' '+command: continue
            # Preserved Chrome processes are not controllers and are never stopped.
            if pathlib.Path(exe).name=='chrome.exe': continue
            need(row['ProcessId'] in allowed,'PRODUCT_HOLD_CONFLICTING_PROCESS')

    def grant(self):
        c=self.c; p=safe_path(self.p)
        self.original=(p/'installation.json').read_bytes(); self.r=c.read(p/'installation.json')
        need(c.child(c.installations(),self.r['id'])==p and self.r.get('contract')==c.CONTRACT,
             'PRODUCT_HOLD_INSTALLATION_MISMATCH')
        c.verify_installed_payload(p,self.r)
        failure=c.read(p/'product-runtime-first-failure.json'); self.cause=classify(self.r,failure)
        b=c.read(p/'control/native-link/binding.json')
        file=p/'control/native-link/product-hold-grant.json'
        need(b.get('allowProductHoldRecovery') is True and
             b.get('runtimeFiles',{}).get('control/native-link/product-hold-grant.json')==digest(file),
             'PRODUCT_HOLD_GRANT_NOT_PINNED')
        g=c.read(file)
        need(set(g)=={'contract','operationId','binding','recordStateSHA256','failureSHA256',
              'originalLockSHA256','originalLockIdentity','causeRuntimeSHA256','causeRuntimePath','failedBindingPath',
              'failedBindingSHA256','failedGrantPath','failedGrantSHA256','mysqlConfigSHA256',
              'rootClientSHA256','notBeforeUTC','notAfterUTC'} | ({'readySHA256','readyIdentity'} if self.cause=='PRODUCT_CHANNEL_CLOSED' else set()),
              'PRODUCT_HOLD_GRANT_SHAPE')
        need(g['contract']==CONTRACT and re.fullmatch('[a-f0-9]{32}',g['operationId'] or ''),
             'PRODUCT_HOLD_GRANT_REQUIRED')
        expected={'installationId':self.r['id'],'extensionId':self.r['extensionId'],
                  'profile':str(p/'profile'),'origin':self.r['origin'],
                  'callback':self.r['callback'],'schema':self.r['schema']}
        need(set(g['binding'])==set(expected)|{'ownerUserId','executorId'} and
             all(g['binding'].get(k)==v for k,v in expected.items()) and
             type(g['binding']['ownerUserId']) is int and g['binding']['ownerUserId']>0 and
             re.fullmatch('[a-f0-9-]{36}',g['binding']['executorId'] or ''),
             'PRODUCT_HOLD_IDENTITY_MISMATCH')
        need(self.r['schema']=='focurve_user_'+self.r['id'] and
             g['recordStateSHA256']==state_digest(self.r), 'PRODUCT_HOLD_RECORD_MISMATCH')
        start=datetime.datetime.fromisoformat(g['notBeforeUTC']); end=datetime.datetime.fromisoformat(g['notAfterUTC'])
        need(start.tzinfo is not None and end.tzinfo is not None and
             start<=datetime.datetime.now(datetime.timezone.utc)<end<=self.end and
             datetime.timedelta(0)<end-start<=datetime.timedelta(minutes=20),'PRODUCT_HOLD_GRANT_EXPIRED')
        self.end=end; self.budget(180)
        validate_preserved_cause(c,p,self.r,g,failure)
        self.g=g; self.evidence={n:(p/n).read_bytes() for n in
            ['product-runtime-first-failure.json','product-runtime.lock',*(['admission.ready'] if self.cause=='PRODUCT_CHANNEL_CLOSED' else [])]}
        self.secret_digest=digest(p/'secrets.dpapi')
        ini=configparser.ConfigParser(interpolation=None);ini.read(p/'mysql.ini',encoding='utf-8-sig')
        client=configparser.ConfigParser(interpolation=None);client.read(p/'root-client.ini',encoding='utf-8-sig')
        need(ini.sections()==['mysqld'] and not ini.defaults() and
             set(ini['mysqld'])=={'basedir','datadir','port','bind-address','mysqlx','innodb-buffer-pool-size',
              'max-connections','performance_schema','table_open_cache','default-time-zone','log_error'} and
             safe_path(ini['mysqld']['datadir'])==safe_path(p/'database') and
             safe_path(ini['mysqld']['basedir'])==safe_path(self.r['runtimes']['mysql']) and
             ini['mysqld']['port']==str(self.r['config']['mysqlPort']) and
             ini['mysqld']['bind-address']=='127.0.0.1' and ini['mysqld']['mysqlx']=='OFF' and
             ini['mysqld']['default-time-zone']=='+00:00' and
             safe_path(ini['mysqld']['log_error'])==safe_path(p/'mysql-error.private.log') and
             client.sections()==['client'] and not client.defaults() and
             set(client['client'])=={'host','port','user','password'} and
             client['client']['host']=='127.0.0.1' and client['client']['user']=='root' and
             client['client']['port']==str(self.r['config']['mysqlPort']),
             'PRODUCT_HOLD_DB_PATH_OR_ADDRESS_MISMATCH')
        self.unchanged(); self.prior_owners()

    def observe(self):
        result=self.exchange('CHECK_HOLD_LOCAL')
        need(type(result) is dict and set(result)=={'local','ownerUserId','executorId'},
             'PRODUCT_HOLD_LOCAL_UNCONFIRMED')
        need(type(result['ownerUserId']) is int and result['ownerUserId']==self.g['binding']['ownerUserId'] and
             result['executorId']==self.g['binding']['executorId'],'PRODUCT_HOLD_MEMBER_MISMATCH')
        local=result['local']
        self.local_classification={'gate':local.get('gate') if type(local) is dict and local.get('gate') in ['UNKNOWN','BLOCKED','CLEAR_LOCAL_ONLY'] else 'UNKNOWN',
            'issues':[x for x in (local.get('issues',[]) if type(local) is dict and type(local.get('issues')) is list else [])
                      if type(x) is str and re.fullmatch('[A-Z][A-Z0-9_]{0,80}',x)][:8]}
        need(self.c.safety_clear(result['local'],{'activeSessions':0,'locks':0,'unresolvedReceipts':0}),
             'PRODUCT_HOLD_LOCAL_NOT_CLEAR')
        return result['local']

    def db_observe(self):
        env={**self.c.db_env(self.r,self.secret),
             'FOCURVE_HOLD_OWNER':str(self.g['binding']['ownerUserId']),
             'FOCURVE_HOLD_EXECUTOR':self.g['binding']['executorId']}
        result=json.loads(self.c.helper(self.p,self.r,'productHoldSafety',env))
        need(type(result) is dict and set(result)=={'activeSessions','locks','unresolvedReceipts','ownerMatches'} and
             all(type(result[k]) is int and result[k]==0 for k in ['activeSessions','locks','unresolvedReceipts']) and
             result['ownerMatches'] is True,
             'PRODUCT_HOLD_DATABASE_UNSAFE_OR_OWNER_MISMATCH')
        return result

    def run(self):
        self.grant(); p=self.p; c=self.c
        lock=safe_path(p/'product-hold-transition.lock')
        fd=self.claim_lock(lock)
        if os.name=='nt':
            import msvcrt
            msvcrt.setmode(fd,os.O_BINARY)
        owner=encoded({'operationId':self.g['operationId'],'pid':os.getpid()})
        os.write(fd,owner); os.fsync(fd)
        owned_lock_identity=lock_identity(lock)
        # An interrupted/failed attempt retains its unique work directory and
        # mutex. Replaying the same grant cannot restart the DB or commit.
        try:
            work=safe_path(p/'product-hold-transitions'/self.g['operationId'])
            need(not work.exists(),'PRODUCT_HOLD_DUPLICATE_OPERATION')
            work.mkdir(parents=True,exist_ok=False); self.work=work
            for name,data in self.evidence.items(): put_once(self.work/name,data)
            put_once(self.work/'installation.original.json',self.original)
            self.unchanged(); self.prior_owners(); self.observe()
            self.secret=c.unprotect((p/'secrets.dpapi').read_bytes());c.validate_link_key(self.secret)
            c.port_available(self.r['config']['mysqlPort']);c.port_available(self.r['config']['webPort'])
            # No Server/refresh/READY. Only this operation's exact MySQL owner.
            db=c.spawn_owned(c.mysql_args(p,self.r),p,'hold-mysql')
            c.wait_mysql(p,{**self.r,'launchDeadlineUTC':self.end.isoformat()},db)
            self.db_observe(); self.observe(); self.budget(60); self.unchanged()
            c.verify_process(p,'hold-mysql')
            c.run([pathlib.Path(self.r['runtimes']['mysql'])/'bin/mysqladmin.exe',
                   '--defaults-file='+str(p/'root-client.ini'),'shutdown'],timeout=20)
            c.await_exit(c.read(p/'hold-mysql-process.json')['ProcessId'])
            c.port_available(self.r['config']['mysqlPort'])
            # A fresh local check after DB shutdown is still required. Any lost
            # channel aborts, preserving HOLD, even after a successful DB read.
            self.observe(); self.budget(15); self.unchanged()
            receipt={'contract':CONTRACT,'operationId':self.g['operationId'],
              'installationId':self.r['id'],'cause':self.cause,
              'originalRecordSHA256':hashlib.sha256(self.original).hexdigest(),
              'failureSHA256':self.g['failureSHA256'],'originalLockSHA256':self.g['originalLockSHA256'],
              'binding':self.g['binding'],
              'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'focusAdmission':'CLOSED','startAuthorized':False,'servicesRunning':False,
              'freshLocalClear':True,'freshDatabaseClear':True,'sameMember':True}
            put_once(self.work/'receipt.json',encoded(receipt))
            updated={**self.r,'status':STATE,'productHoldRecovery':{
                'operationId':self.g['operationId'],'receiptSHA256':digest(self.work/'receipt.json')}}
            data=encoded(updated)
            put_once(self.work/'committed.json',encoded({'recordSHA256':hashlib.sha256(data).hexdigest()}))
            self.unchanged()
            # Archive only the exact empty, proven inactive original lock. Never
            # unlink someone else's lock. Metadata stays HOLD if commit fails.
            if self.cause=='PRODUCT_CHANNEL_CLOSED':
                os.rename(p/'admission.ready',self.work/'admission.ready.archived')
            os.rename(p/'product-runtime.lock',self.work/'product-runtime.archived.lock')
            atomic_write(p/'installation.json',data)
            need(lock.read_bytes()==owner and lock_identity(lock)==owned_lock_identity,
                 'PRODUCT_HOLD_OPERATION_LOCK_CHANGED')
            os.close(fd); fd=None
            lock.unlink()
            return {'state':STATE,'servicesRunning':False,'focusAdmission':'CLOSED','startAuthorized':False}
        except Exception as error:
            if self.work is not None and self.work.is_dir():
                target=self.work/'failure.json'
                code=str(error)
                if not re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code):code='PRODUCT_HOLD_TRANSITION_UNCONFIRMED'
                if not target.exists(): put_once(target,encoded({'state':'UNCONFIRMED_PRESERVED','code':code,
                    'stage':self.stage,'localClassification':getattr(self,'local_classification',None),'automaticRetry':False}))
            raise
        finally:
            if fd is not None: os.close(fd)

def verify_receipt(p, record, require_commit_identity=True):
    ref=record.get('productHoldRecovery',{}); op=ref.get('operationId','')
    need(bool(re.fullmatch('[a-f0-9]{32}',op)),'PRODUCT_HOLD_RECEIPT_REQUIRED')
    work=safe_path(pathlib.Path(p)/'product-hold-transitions'/op)
    receipt=json.loads((work/'receipt.json').read_bytes())
    committed=json.loads((work/'committed.json').read_bytes())['recordSHA256']
    update=record.get('lastProductUpdate',{})
    approved_renewal=(update.get('contract')=='FOCURVE_STOPPED_USER_SESSION_UPDATE_1' and
                      update.get('originalRecordSHA256')==committed)
    approved_observation=False
    restore=record.get('lastObservationRestore',{})
    if restore.get('contract')=='FOCURVE_CHANNEL_OBSERVATION_RESTORE_1':
        original=work/'observation-before-restore.json'
        if original.is_file() and restore.get('originalRecordSHA256')==committed==digest(original):
            prior=json.loads(original.read_bytes())
            approved_observation=({k:v for k,v in record.items() if k not in ['payload','lastObservationRestore']}==
                                  {k:v for k,v in prior.items() if k!='payload'})
    observation_commit=work/'observation-restored.json'
    if observation_commit.is_file():
        restored=json.loads(observation_commit.read_bytes())
        approved_renewal=approved_renewal or (update.get('contract')=='FOCURVE_STOPPED_USER_SESSION_UPDATE_1' and
            update.get('originalRecordSHA256')==restored.get('recordSHA256') and
            restored.get('sourceRecordSHA256')==committed and
            (work/'observation-before-restore.json').is_file() and
            digest(work/'observation-before-restore.json')==committed)
    need(digest(work/'receipt.json')==ref.get('receiptSHA256') and
         (not require_commit_identity or committed==digest(pathlib.Path(p)/'installation.json') or approved_renewal or approved_observation) and
         receipt['installationId']==record['id'] and receipt['startAuthorized'] is False and
         receipt['focusAdmission']=='CLOSED' and not (work/'failure.json').exists(),
         'PRODUCT_HOLD_RECEIPT_UNCONFIRMED')
    need(receipt['originalRecordSHA256']==digest(work/'installation.original.json') and
         receipt['failureSHA256']==digest(pathlib.Path(p)/'product-runtime-first-failure.json') and
         receipt['originalLockSHA256']==digest(work/'product-runtime.archived.lock') and
         (receipt.get('cause')!='PRODUCT_CHANNEL_CLOSED' or
          (not (pathlib.Path(p)/'admission.ready').exists() and
           (work/'admission.ready.archived').read_bytes()==(work/'admission.ready').read_bytes())) and
         all(receipt['binding'][key]==record[key] for key in ['extensionId','origin','callback','schema']) and
         not (pathlib.Path(p)/'product-hold-transition.lock').exists(),
         'PRODUCT_HOLD_COMMIT_OR_EVIDENCE_UNCONFIRMED')
