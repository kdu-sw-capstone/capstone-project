"""User-owned installation. Importing this module never installs or starts anything."""
from __future__ import annotations
import argparse,base64,ctypes,datetime,hashlib,json,os,pathlib,re,secrets,shutil,socket,ssl,subprocess,sys,time,urllib.request,uuid,zipfile

ROOT=pathlib.Path(__file__).resolve().parent.parent
CONTRACT='FOCURVE_USER_INSTALL_1'
NO_WINDOW=getattr(subprocess,'CREATE_NO_WINDOW',0)
class InstallError(RuntimeError):pass
def base_env():return {k:v for k,v in os.environ.items() if not k.upper().startswith(('MEMBER_','MAIL_','AUTH_','SPRING_','DB_','SMTP_','GOOGLE_','KAKAO_','FOCURVE_','SNAPSHOT_','MYSQL_')) and k.upper() not in ['JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','_JAVA_OPTIONS','CLASSPATH','NODE_OPTIONS','PYTHONPATH','PYTHONHOME','PSMODULEPATH']}

def validate_link_key(secret):
 try:valid=type(secret.get('linkKey')) is str and len(base64.b64decode(secret['linkKey'],validate=True))==32
 except (ValueError,TypeError):valid=False
 require(valid,'INSTALL_LINK_KEY_CONFIGURATION_INVALID')

def normalize_new_smtp_password(mail,value):
 # Only freshly entered values. Never rewrite an existing protected credential.
 if str(mail.get('host','')).strip().lower()=='smtp.gmail.com':
  require(type(value) is str,'GMAIL_APP_PASSWORD_FORMAT_INVALID')
  value=value.replace(' ','')
  require(bool(re.fullmatch('[a-zA-Z]{16}',value)),'GMAIL_APP_PASSWORD_FORMAT_INVALID')
 else:require(type(value) is str and bool(value),'SMTP_PASSWORD_REQUIRED')
 return value

def prompt_new_smtp_password(mail):
 import getpass,warnings
 prompt='Gmail 16자리 앱 비밀번호 (Google 로그인 비밀번호 아님, 입력은 보이지 않습니다): ' if str(mail.get('host','')).strip().lower()=='smtp.gmail.com' else 'SMTP 비밀번호 (입력은 보이지 않습니다): '
 try:
  with warnings.catch_warnings():
   # Refuse Python's visible-input fallback when no protected terminal exists.
   warnings.simplefilter('error',getpass.GetPassWarning)
   value=getpass.getpass(prompt)
 except getpass.GetPassWarning:raise InstallError('HIDDEN_PASSWORD_TERMINAL_REQUIRED') from None
 return normalize_new_smtp_password(mail,value)

def fresh_install_secrets():
 result={k:secrets.token_urlsafe(36) for k in ['dbPassword','rootPassword','pfxPassword','lifecycleKey']}
 result['linkKey']=base64.b64encode(secrets.token_bytes(32)).decode('ascii')
 validate_link_key(result)
 return result
def require(ok,code):
 if not ok:raise InstallError(code)
def read(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,data):
 p=pathlib.Path(p);tmp=p.with_name(p.name+'.tmp-'+secrets.token_hex(4));tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');os.replace(tmp,p)
def run(args,**kw):
 if kw.get('env') is None:kw['env']=base_env()
 # Read bytes first so a native Windows error cannot crash a UTF-8 reader thread.
 text=kw.pop('text',False);encoding=kw.pop('encoding',None)
 if isinstance(kw.get('input'),str):kw['input']=kw['input'].encode(encoding or 'utf-8')
 show_window=kw.pop('show_window',False);require(type(show_window) is bool,'COMMAND_WINDOW_SCOPE_INVALID')
 flags=getattr(subprocess,'CREATE_NEW_CONSOLE',0) if show_window else NO_WINDOW
 result=subprocess.run([str(a) for a in args],check=False,timeout=kw.pop('timeout',30),creationflags=flags,capture_output=True,**kw)
 if text:
  def decode(value):
   choices=[encoding] if encoding else ['utf-8-sig']+(['cp'+str(ctypes.windll.kernel32.GetACP()),'cp'+str(ctypes.windll.kernel32.GetOEMCP())] if os.name=='nt' else [])
   for candidate in dict.fromkeys(choices):
    try:return value.decode(candidate,errors='strict')
    except UnicodeError:continue
   raise InstallError('COMMAND_OUTPUT_ENCODING_UNCONFIRMED')
  result.stdout=decode(result.stdout);result.stderr=decode(result.stderr)
 if result.returncode:raise subprocess.CalledProcessError(result.returncode,result.args,output=result.stdout,stderr=result.stderr)
 return result
def canonical_config(c):
 require(c.get('contract')==CONTRACT,'CONFIGURATION_VERSION_MISMATCH')
 for key in ['webPort','mysqlPort']:
  require(type(c.get(key)) is int and 1024<=c[key]<=65535,'PORT_CONFIGURATION_INVALID')
 require(c['webPort']!=c['mysqlPort'],'PORT_COLLISION')
 require(c.get('browserMode') in ['regular_manual','testing_bundled'],'BROWSER_INSTALLATION_MODE_REQUIRED')
 require(c.get('externalOAuth')=={'googleEnabled':False,'kakaoEnabled':False},'EXTERNAL_AUTH_NOT_CONFIGURED_OR_APPROVED')
 m=c.get('mail',{});require(type(m.get('enabled')) is bool,'MAIL_CONFIGURATION_INVALID')
 if m['enabled']:
  require(bool(m.get('host')) and bool(m.get('from')) and bool(m.get('username')),'MAIL_CONFIGURATION_INCOMPLETE')
  if m['host'].strip().lower()=='smtp.gmail.com':require(bool(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',m['username'])),'GMAIL_FULL_ADDRESS_USERNAME_REQUIRED')
  require(type(m.get('port')) is int and 1<=m['port']<=65535 and bool(m.get('tls'))!=bool(m.get('ssl')),'MAIL_SECURE_TRANSPORT_REQUIRED')
 require(not any(k.lower() in ['password','token','secret'] for k in m),'USE_PROTECTED_SECRET_INPUT')
 return c
def child(root,name):
 require(bool(re.fullmatch('[a-f0-9]{32}',name)),'INSTALLATION_ID_INVALID')
 root=pathlib.Path(root).resolve();p=root/name
 require(p.parent==root,'PATH_OUTSIDE_INSTALLATIONS')
 for part in [p,*p.parents]:require(not part.is_symlink() and not (hasattr(part,'is_junction') and part.is_junction()),'PATH_ALIAS_DENIED')
 return p
def installations():
 require(os.name=='nt' and bool(os.environ.get('LOCALAPPDATA')),'WINDOWS_USER_ENVIRONMENT_REQUIRED')
 return pathlib.Path(os.environ['LOCALAPPDATA'])/'FOCURVE'/'R4'/'installations'
def verify_package(root=ROOT):
 manifest=read(root/'MANIFEST.json');expected={x['path']:x['sha256'] for x in manifest['files']}
 actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name not in ['MANIFEST.json','PACKAGE-SHA256.txt'] and '__pycache__' not in p.parts}
 require(set(expected)==actual,'PACKAGE_FILE_SET_MISMATCH')
 for name,h in expected.items():
  p=root/pathlib.PurePosixPath(name);require(p.resolve().is_relative_to(root.resolve()) and sha(p)==h,'PACKAGE_HASH_MISMATCH')
 return manifest
def port_available(port):
 try:
  with socket.socket() as s:s.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1) if hasattr(socket,'SO_EXCLUSIVEADDRUSE') else None;s.bind(('127.0.0.1',port))
 except OSError:raise InstallError('PORT_IN_USE_NO_AUTOMATIC_PORT_CHANGE') from None
def protect(data):
 require(os.name=='nt','WINDOWS_SECRET_STORE_REQUIRED')
 class Blob(ctypes.Structure):_fields_=[('size',ctypes.c_uint32),('data',ctypes.POINTER(ctypes.c_ubyte))]
 raw=json.dumps(data).encode();buf=(ctypes.c_ubyte*len(raw)).from_buffer_copy(raw);source=Blob(len(raw),buf);target=Blob()
 crypt=ctypes.windll.crypt32.CryptProtectData;crypt.argtypes=[ctypes.POINTER(Blob),ctypes.c_wchar_p,ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_uint32,ctypes.POINTER(Blob)];crypt.restype=ctypes.c_int
 free=ctypes.windll.kernel32.LocalFree;free.argtypes=[ctypes.c_void_p];free.restype=ctypes.c_void_p
 require(crypt(ctypes.byref(source),'FOCURVE installation',None,None,None,1,ctypes.byref(target)),'SECRET_PROTECTION_FAILED')
 try:return ctypes.string_at(target.data,target.size)
 finally:ctypes.windll.kernel32.LocalFree(target.data)
def unprotect(data):
 require(os.name=='nt','WINDOWS_SECRET_STORE_REQUIRED')
 class Blob(ctypes.Structure):_fields_=[('size',ctypes.c_uint32),('data',ctypes.POINTER(ctypes.c_ubyte))]
 buf=(ctypes.c_ubyte*len(data)).from_buffer_copy(data);source=Blob(len(data),buf);target=Blob()
 crypt=ctypes.windll.crypt32.CryptUnprotectData;crypt.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_uint32,ctypes.POINTER(Blob)];crypt.restype=ctypes.c_int
 free=ctypes.windll.kernel32.LocalFree;free.argtypes=[ctypes.c_void_p];free.restype=ctypes.c_void_p
 require(crypt(ctypes.byref(source),None,None,None,None,1,ctypes.byref(target)),'CURRENT_USER_SECRET_UNAVAILABLE')
 try:return json.loads(ctypes.string_at(target.data,target.size))
 finally:ctypes.windll.kernel32.LocalFree(target.data)
def user_acl(p):
 sid=run(['powershell.exe','-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).stdout.strip()
 require(bool(re.fullmatch(r'S-1-[0-9-]+',sid)),'WINDOWS_USER_IDENTITY_UNCONFIRMED')
 run(['icacls.exe',p,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'])
def runtime_paths(c):
 vendor=ROOT/'vendor';require(vendor.is_dir(),'BUNDLED_RUNTIME_REQUIRED')
 java=vendor/'java/bin/java.exe';mysql=vendor/'mysql';chrome=vendor/'chrome/chrome.exe'
 if c['browserMode']=='regular_manual':
  candidates=[pathlib.Path(os.environ[k])/'Google/Chrome/Application/chrome.exe' for k in ['ProgramFiles','ProgramFiles(x86)','LOCALAPPDATA'] if os.environ.get(k)]
  chrome=next((p for p in candidates if p.is_file()),None);require(chrome is not None,'REGULAR_CHROME_NOT_FOUND_NO_AUTOMATIC_DOWNLOAD')
  details=run(['powershell.exe','-NoProfile','-Command','(Get-Item -LiteralPath $env:FOCURVE_CHROME_EXECUTABLE).VersionInfo | Select-Object ProductName,ProductVersion | ConvertTo-Json -Compress'],text=True,env={**base_env(),'FOCURVE_CHROME_EXECUTABLE':str(chrome)}).stdout
  require(json.loads(details).get('ProductName')=='Google Chrome','REGULAR_CHROME_PRODUCT_REQUIRED')
 require(java.is_file() and (mysql/'bin/mysqld.exe').is_file() and chrome.is_file(),'RUNTIME_NOT_FOUND')
 version=run([java,'-version'],text=True);require(bool(re.search(r'version "21\.',version.stderr)),'JAVA_21_REQUIRED')
 require('8.4.8' in run([mysql/'bin/mysqld.exe','--no-defaults','--version'],text=True).stdout,'MYSQL_848_REQUIRED')
 node=vendor/'node/node.exe';require(node.is_file() and int(run([node,'--version'],text=True).stdout.strip().lstrip('v').split('.')[0])>=24,'NODE_24_REQUIRED')
 require((vendor/'python/python.exe').is_file(),'BUNDLED_PYTHON_REQUIRED')
 return {'java':str(java),'mysql':str(mysql),'chrome':str(chrome),'node':str(node),'python':str(vendor/'python/python.exe')}
def extract_server(install):
 lib=install/'server-libs';classes=install/'server-classes';lib.mkdir();classes.mkdir()
 with zipfile.ZipFile(install/'app/server/server.jar') as z:
  for row in z.infolist():
   if row.is_dir():continue
   if row.filename.startswith('BOOT-INF/lib/'):out=lib/row.filename.removeprefix('BOOT-INF/lib/')
   elif row.filename.startswith('BOOT-INF/classes/'):out=classes/row.filename.removeprefix('BOOT-INF/classes/')
   else:continue
   require(out.resolve().is_relative_to(install.resolve()),'SERVER_ARCHIVE_PATH_DENIED');out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(z.read(row))
def helper(install,record,mode,env=None):
 cp=os.pathsep.join([str(install/'tools'),str(install/'server-libs/*'),str(install/'server-classes')])
 try:return run([record['runtimes']['java'],'-cp',cp,'InstallTools',mode],env=env,text=True,timeout=90).stdout
 except (subprocess.CalledProcessError,subprocess.TimeoutExpired) as error:
  target=install/('helper-'+mode+'-first-failure.private.log')
  if not target.exists():
   data=str(error.stdout or '')+'\n'+str(error.stderr or '');target.write_text(data,encoding='utf-8')
  raise InstallError('INSTALL_HELPER_UNCONFIRMED') from None
def db_env(record,secret):
 return {**base_env(),'DB_URL':f"jdbc:mysql://127.0.0.1:{record['config']['mysqlPort']}/{record['schema']}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",'DB_USERNAME':'focurve_user','DB_PASSWORD':secret['dbPassword']}
def web_binding_source(web):
 html=web/'index.html';h=html.read_text(encoding='utf-8');asset=re.search(r'src="([^" ]+\.js)"',h)
 require(asset is not None,'WEB_ENTRY_UNCONFIRMED')
 source=web/asset[1].lstrip('/');require(source.resolve().is_relative_to(web.resolve()),'WEB_ENTRY_OUTSIDE_PACKAGE')
 text=source.read_text(encoding='utf-8');require('cgepjnmlhilhabjfmneplddlhmconpjb' in text,'WEB_EXTENSION_BINDING_SOURCE_MISMATCH')
 return html,h,asset,source,text

def bind_payload(install,record,identity):
 app=install/'app';origin=record['origin'];eid=identity['extensionId'];ext=app/'extension';m=read(ext/'manifest.json');m['key']=identity['key'];write(ext/'manifest.json',m)
 (ext/'release-config.js').write_text('globalThis.FOCURVE_DEPLOYMENT=Object.freeze('+json.dumps({'contract':'STANDALONE_API_1','api':origin+'/api/v1','origin':origin})+');\n',encoding='utf-8')
 context={'contract':'R2_DEDICATED_PROFILE_1','extensionId':eid,'profileInstance':hashlib.sha256(str((install/'profile').resolve()).encode()).hexdigest()[:32],'origin':origin}
 (ext/'safety/context.js').write_text('globalThis.FOCURVE_SAFETY_CONTEXT=Object.freeze('+json.dumps(context)+');\n',encoding='utf-8')
 html,h,asset,p,text=web_binding_source(app/'web');old='cgepjnmlhilhabjfmneplddlhmconpjb'
 new=text.replace(old,eid);name='/assets/user-'+hashlib.sha256(new.encode()).hexdigest()[:16]+'.js';(app/'web'/name.lstrip('/')).write_text(new,encoding='utf-8');html.write_text(h.replace(asset[1],name),encoding='utf-8')
 record['extensionId']=eid;record['callback']='chrome-extension://'+eid+'/popup/popup.html'
 record['payload']=[{'path':p.relative_to(install).as_posix(),'sha256':sha(p)} for folder in ['app','tools','server-libs','server-classes','runtimes','control'] for p in sorted((install/folder).rglob('*')) if p.is_file()]
 for name in ['Start-FOCURVE.cmd','Stop-FOCURVE.cmd','Dashboard.url','Connect-FOCURVE.cmd']:
  if (install/name).is_file():record['payload'].append({'path':name,'sha256':sha(install/name)})
def verify_installed_payload(p,record):
 expected={row['path']:row['sha256'] for row in record['payload']};actual={file.relative_to(p).as_posix() for folder in ['app','tools','server-libs','server-classes','runtimes','control'] for file in (p/folder).rglob('*') if file.is_file()}
 actual.update(name for name in ['Start-FOCURVE.cmd','Stop-FOCURVE.cmd','Dashboard.url','Connect-FOCURVE.cmd'] if (p/name).is_file())
 require(set(expected)==actual,'INSTALLED_FILE_SET_CHANGED')
 for name,digest in expected.items():
  file=p/name;require(file.resolve().is_relative_to(p.resolve()) and sha(file)==digest,'INSTALLED_FILE_CHANGED')
def recovery_modules():
 import importlib.util
 modules=[]
 for name in ['hold_recovery','recovery_runtime']:
  location=pathlib.Path(__file__).resolve().parent/(name+'.py')
  if name in sys.modules:
   require(pathlib.Path(sys.modules[name].__file__).resolve()==location,'RECOVERY_MODULE_SCOPE_MISMATCH');module=sys.modules[name]
  else:
   spec=importlib.util.spec_from_file_location(name,location);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module)
  modules.append(module)
 return modules

def recover_hold(p,grant=None,runtime=None,plan=False):
 h,n=recovery_modules();runtime=runtime or n.WindowsRuntime(sys.modules[__name__])
 try:return h.assess(p,runtime) if plan else h.recover(p,grant,runtime)
 except h.RecoveryError as e:raise InstallError(str(e)) from None

def pre_server_live_identity(p,record):
 try:return live_identity(p,record)
 except (subprocess.CalledProcessError,subprocess.TimeoutExpired):
  h,_=recovery_modules();h.record_failure(p,record,'EXTENSION_IDENTITY_UNCONFIRMED');write(p/'installation.json',record)
  raise InstallError('EXTENSION_LIVE_IDENTITY_UNCONFIRMED') from None
 except InstallError as e:
  if str(e)!='LIVE_INSTALLATION_BINDING_UNCONFIRMED':raise
  h,_=recovery_modules();h.record_failure(p,record,'EXTENSION_IDENTITY_UNCONFIRMED');write(p/'installation.json',record)
  raise InstallError('EXTENSION_LIVE_IDENTITY_UNCONFIRMED') from None

def owned_record(p):
 p=pathlib.Path(p).resolve();record=read(p/'installation.json');require(child(installations(),record['id'])==p and record.get('contract')==CONTRACT,'NOT_OWNED_INSTALLATION')
 require(record['status'] in ['INSTALLED','STOPPED','PRODUCT_RECOVERED_FOCUS_LOCKED'],'INSTALLATION_HOLD_NO_AUTOMATIC_RECOVERY')
 if record['status']=='PRODUCT_RECOVERED_FOCUS_LOCKED':
  from product_hold_recovery import verify_receipt
  verify_receipt(p,record)
 verify_installed_payload(p,record)
 return record
def process_identity(pid):
 require(type(pid) is int and pid>0,'INVALID_PROCESS_ID')
 text=run(['powershell.exe','-NoProfile','-Command',f'Get-CimInstance Win32_Process -Filter "ProcessId={pid}" | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json -Compress'],text=True).stdout.strip()
 require(bool(text),'OWNED_PROCESS_NOT_PRESENT');return json.loads(text)
def spawn_owned(args,install,name,env=None):
 logfile=(install/(name+'.private.log')).open('ab');p=subprocess.Popen([str(x) for x in args],env=env if env is not None else base_env(),stdout=logfile,stderr=subprocess.STDOUT,creationflags=NO_WINDOW);logfile.close()
 identity=process_identity(p.pid);require(str(install).lower() in identity['CommandLine'].lower(),'PROCESS_INSTALLATION_BINDING_MISMATCH')
 write(install/(name+'-process.json'),identity);return p
def verify_process(install,name):
 expected=read(install/(name+'-process.json'));actual=process_identity(expected['ProcessId']);require(actual==expected,'PROCESS_IDENTITY_CHANGED_NO_STOP');return actual
def sql(install,record,query):
 return run([pathlib.Path(record['runtimes']['mysql'])/'bin/mysql.exe','--defaults-file='+str(install/'root-client.ini'),'--batch','--skip-column-names'],input=query,text=True,timeout=15).stdout
def mysql_args(install,record):return [pathlib.Path(record['runtimes']['mysql'])/'bin/mysqld.exe','--defaults-file='+str(install/'mysql.ini'),'--console']
def wait_mysql(install,record,p):
 for _ in range(80):
  if record.get('launchDeadlineUTC'):require(datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(record['launchDeadlineUTC']),'LAUNCH_DEADLINE_NO_EXTENSION')
  require(p.poll() is None,'MYSQL_STOPPED_DURING_START')
  try:sql(install,record,'SELECT 1;');return
  except subprocess.CalledProcessError:time.sleep(.25)
 raise InstallError('MYSQL_START_UNCONFIRMED')
def shutdown_mysql(install,record):
 verify_process(install,'mysql');run([pathlib.Path(record['runtimes']['mysql'])/'bin/mysqladmin.exe','--defaults-file='+str(install/'root-client.ini'),'shutdown'],timeout=20)
def await_exit(pid,seconds=25):
 deadline=time.monotonic()+seconds
 while time.monotonic()<deadline:
  result=run(['powershell.exe','-NoProfile','-Command',f'[bool](Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue)'],text=True,timeout=3)
  if result.stdout.strip()=='False':return
  time.sleep(.25)
 raise InstallError('PROCESS_EXIT_UNCONFIRMED_NO_FORCE')
def provision_current_user_certificate(p,ident,env):
 print('현재 사용자용 localhost 인증서를 등록합니다. Windows 보안 경고가 나타나면 이름이 FOCURVE Local '+ident+'인지 확인해 주세요. 완료되지 않으면 설치를 중단하고 기록을 보존합니다.',flush=True)
 try:
  common=['powershell.exe','-NoProfile','-File',ROOT/'installer/certificate.ps1','-Directory',p,'-InstallationId',ident,'-ApproveCurrentUserTrust']
  created=run(common+['-Phase','Create'],env=env,text=True,timeout=90)
  expected=json.loads(created.stdout)
  require(re.fullmatch('[A-F0-9]{40}',expected.get('thumbprint','')) and expected.get('subject')=='CN=FOCURVE Local '+ident,'CERTIFICATE_CREATION_IDENTITY_UNCONFIRMED')
  # A fresh process performs the existing, owner-approved Root import. Never
  # carry the PFX password into that process or generate a second certificate.
  cert=run(common+['-Phase','Trust','-ExpectedThumbprint',expected['thumbprint']],text=True,timeout=180,show_window=True)
  require(json.loads(cert.stdout)==expected,'CERTIFICATE_TRUST_IDENTITY_UNCONFIRMED')
 except subprocess.TimeoutExpired as error:
  # Preserve the exact phase without repeating certificate generation/trust,
  # disclosing environment values or treating exported files as trusted roots.
  stderr=error.stderr or ''
  if isinstance(stderr,bytes):stderr=stderr.decode('utf8',errors='replace')
  stages=re.findall(r'FOCURVE_CERT_STAGE=([A-Z_]{1,80})',stderr)
  write(p/'first-install-failure.json',{'phase':'CURRENT_USER_CERTIFICATE_PROVISION','code':'CERTIFICATE_PROVISION_TIMEOUT','timeoutSeconds':error.timeout,'lastObservedStage':stages[-1] if stages else 'NOT_OBSERVED','publicCertificateExported':(p/'localhost.cer').is_file(),'privateCertificateExported':(p/'localhost.pfx').is_file(),'trustConfirmed':False,'status':'PRESERVED_NO_RETRY'})
  raise InstallError('CERTIFICATE_PROVISION_TIMEOUT') from None
 except subprocess.CalledProcessError as error:
  # This script never prints secrets. Keep its first native failure privately;
  # do not replay certificate creation, change execution policy or auto-clean up.
  (p/'certificate-first-failure.private.log').write_text(str(error.stdout or '')+'\n'+str(error.stderr or ''),encoding='utf-8')
  write(p/'first-install-failure.json',{'phase':'CURRENT_USER_CERTIFICATE_PROVISION','exitCode':error.returncode,'status':'PRESERVED_NO_RETRY'})
  raise InstallError('CERTIFICATE_PROVISION_UNCONFIRMED') from None
 return cert

def finish_initial_install(p,record,secret,env,certificate):
 rt=record['runtimes'];c=record['config']
 record['certificate']=certificate;(p/'localhost.pem').write_text(ssl.DER_cert_to_PEM_cert((p/'localhost.cer').read_bytes()),encoding='ascii')
 record['certificateAlias']=helper(p,record,'certificateAlias',{**env,'FOCURVE_NEW_PFX_PATH':str(p/'localhost.pfx')}).strip();require(bool(record['certificateAlias']),'CERTIFICATE_KEY_ALIAS_UNCONFIRMED')
 identity=json.loads(helper(p,record,'identity'));bind_payload(p,record,identity)
 data=p/'database';data.mkdir();mysqlhome=pathlib.Path(rt['mysql']);port=c['mysqlPort']
 (p/'mysql.ini').write_text(f'[mysqld]\nbasedir={mysqlhome.as_posix()}\ndatadir={data.as_posix()}\nport={port}\nbind-address=127.0.0.1\nmysqlx=OFF\ninnodb-buffer-pool-size=32M\nmax-connections=12\nperformance_schema=OFF\ntable_open_cache=128\ndefault-time-zone=+00:00\nlog_error={p.as_posix()}/mysql-error.private.log\n',encoding='utf-8')
 (p/'root-client.ini').write_text(f"[client]\nhost=127.0.0.1\nport={port}\nuser=root\npassword={secret['rootPassword']}\n",encoding='utf-8')
 bootstrap=p/'bootstrap.private.sql';bootstrap.write_text(f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{secret['rootPassword']}';\nCREATE DATABASE {record['schema']} CHARACTER SET utf8mb4;\nCREATE USER 'focurve_user'@'127.0.0.1' IDENTIFIED BY '{secret['dbPassword']}';\nGRANT ALL PRIVILEGES ON {record['schema']}.* TO 'focurve_user'@'127.0.0.1';\n",encoding='utf-8')
 run([mysqlhome/'bin/mysqld.exe','--defaults-file='+str(p/'mysql.ini'),'--initialize-insecure'],timeout=90)
 db=spawn_owned(mysql_args(p,record)+['--init-file='+str(bootstrap)],p,'mysql');wait_mysql(p,record,db)
 migration=helper(p,record,'migrate',db_env(record,secret));require('FRESH_SCHEMA_MIGRATED_ZERO_USERS' in migration,'SCHEMA_INITIALIZATION_UNCONFIRMED')
 safety=json.loads(helper(p,record,'safety',db_env(record,secret)));require(all(v==0 for v in safety.values()),'FRESH_DB_NOT_CLEAR')
 shutdown_mysql(p,record);db.wait(timeout=25);record['status']='INSTALLED';record['firstDatabaseSafety']=safety;write(p/'installation.json',record)
 return {'status':'INSTALLED_NOT_RUNNING','installation':str(p),'origin':record['origin'],'extensionId':record['extensionId'],'account':'NO_PRECREATED_ACCOUNT','physicalAudio':'PENDING'}

def install(c,approve=False,trust=False):
 require(approve and trust,'NEW_INSTALL_AND_CURRENT_USER_CERTIFICATE_APPROVAL_REQUIRED');canonical_config(c);verify_package()
 rt=runtime_paths(c);port_available(c['webPort']);port_available(c['mysqlPort']);web_binding_source(ROOT/'app/web')
 ident=uuid.uuid4().hex;p=child(installations(),ident);require(not p.exists(),'INSTALLATION_ALREADY_EXISTS');p.mkdir(parents=True);user_acl(p)
 record={'contract':CONTRACT,'id':ident,'status':'INSTALLING','createdAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'config':c,'runtimes':rt,'origin':'https://localhost:'+str(c['webPort']),'schema':'focurve_user_'+ident}
 write(p/'installation.json',record)
 try:
  shutil.copytree(ROOT/'app',p/'app');shutil.copytree(ROOT/'tools',p/'tools');shutil.copyfile(ROOT/'installer/observe.cjs',p/'tools/observe.cjs');extract_server(p)
  selected_chrome=rt['chrome'];shutil.copytree(ROOT/'vendor',p/'runtimes');record['runtimes']={'java':str(p/'runtimes/java/bin/java.exe'),'mysql':str(p/'runtimes/mysql'),'chrome':selected_chrome if c['browserMode']=='regular_manual' else str(p/'runtimes/chrome/chrome.exe'),'node':str(p/'runtimes/node/node.exe'),'python':str(p/'runtimes/python/python.exe')};rt=record['runtimes']
  control=p/'control';control.mkdir()
  for folder in ['installer','launch','docs','native']:
   if (ROOT/folder).is_dir():shutil.copytree(ROOT/folder,control/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
  for name in ['config.example.json','BUILD-PROVENANCE.json']:
   if (ROOT/name).is_file():shutil.copyfile(ROOT/name,control/name)
  write(control/'MANIFEST.json',{'version':'0.1.25-installed-control','files':[{'path':file.relative_to(control).as_posix(),'sha256':sha(file)} for file in sorted(control.rglob('*')) if file.is_file()]})
  for action,title in [('start','Start'),('stop','Stop')]:
   extra=' --minutes 60 --approve-launch' if action=='start' else ''
   (p/(title+'-FOCURVE.cmd')).write_text('@echo off\nchcp 65001 >nul\n"%~dp0runtimes\\python\\python.exe" -I -B -X utf8 "%~dp0control\\installer\\install_core.py" '+action+' --instance "%~dp0."'+extra+'\npause\n',encoding='ascii',newline='\r\n')
  (p/'Dashboard.url').write_text('[InternetShortcut]\nURL='+record['origin']+'/\n',encoding='ascii',newline='\r\n')
  (p/'Connect-FOCURVE.cmd').write_text('@echo off\nchcp 65001 >nul\n"%~dp0runtimes\\python\\python.exe" -I -B -X utf8 "%~dp0control\\installer\\install_core.py" connect --instance "%~dp0." --interactive --user-session --minutes 60\npause\n',encoding='ascii',newline='\r\n')
  secret=fresh_install_secrets()
  if c['mail']['enabled']:
   secret['smtpPassword']=prompt_new_smtp_password(c['mail'])
  (p/'secrets.dpapi').write_bytes(protect(secret));env={**base_env(),'FOCURVE_NEW_PFX_PASSWORD':secret['pfxPassword']}
  cert=provision_current_user_certificate(p,ident,env)
  return finish_initial_install(p,record,secret,env,json.loads(cert.stdout))
 except Exception:
  record['status']='INSTALL_FAILED_PRESERVED';write(p/'installation.json',record);raise
def complete_certificate_install(p,package,package_sha256,installation_sha256,failure_sha256,thumbprint,not_after,approve=False):
 """Complete only a never-started install stopped at the Root trust request.

 This cannot repair HOLD, auth, sessions, Chrome, Native registration or a DB.
 The existing failure stays intact; a new explicit approval is mandatory.
 """
 require(approve is True,'CERTIFICATE_INSTALL_COMPLETION_APPROVAL_REQUIRED')
 p=pathlib.Path(p).resolve();package=pathlib.Path(package).resolve()
 require(re.fullmatch('[a-f0-9]{32}',p.name) and child(installations(),p.name)==p,'CERTIFICATE_COMPLETION_NOT_OWNED')
 end=datetime.datetime.fromisoformat(not_after);now=datetime.datetime.now(datetime.timezone.utc)
 require(end.tzinfo is not None and now+datetime.timedelta(minutes=15)<end<=now+datetime.timedelta(minutes=60),'CERTIFICATE_COMPLETION_DEADLINE_INVALID')
 for value in [package_sha256,installation_sha256,failure_sha256]:require(re.fullmatch('[a-f0-9]{64}',value or ''),'CERTIFICATE_COMPLETION_PIN_REQUIRED')
 require(re.fullmatch('[A-F0-9]{40}',thumbprint or ''),'CERTIFICATE_COMPLETION_THUMBPRINT_REQUIRED')
 archive=package.parent/(package.name+'.zip')
 require(archive.is_file() and sha(archive)==package_sha256,'CERTIFICATE_COMPLETION_PACKAGE_CHANGED')
 manifest=verify_package(package)
 require(sha(p/'installation.json')==installation_sha256 and sha(p/'first-install-failure.json')==failure_sha256,'CERTIFICATE_COMPLETION_EVIDENCE_CHANGED')
 r=read(p/'installation.json');failure=read(p/'first-install-failure.json')
 require(r.get('contract')==CONTRACT and r.get('id')==p.name and r.get('status')=='INSTALL_FAILED_PRESERVED' and not r.get('extensionId') and not r.get('nativeLink') and not r.get('launchId'),'CERTIFICATE_COMPLETION_STATE_NOT_ELIGIBLE')
 require(failure.get('phase')=='CURRENT_USER_CERTIFICATE_PROVISION' and failure.get('code')=='CERTIFICATE_PROVISION_TIMEOUT' and failure.get('lastObservedStage')=='REQUEST_CURRENT_USER_ROOT_TRUST' and failure.get('status')=='PRESERVED_NO_RETRY','CERTIFICATE_COMPLETION_CAUSE_NOT_PROVEN')
 forbidden=['profile','database','mysql.ini','root-client.ini','mysql-process.json','chrome-process.json','server-process.json','native-setup.lock','control/native-link','STOP','admission.closed','admission.ready','start.lock','stop.lock','product-runtime.lock','certificate-completion.lock','certificate-completions']
 require(not any((p/name).exists() for name in forbidden),'CERTIFICATE_COMPLETION_HAS_EXISTING_RUNTIME_STATE')
 canonical_config(r['config']);require(r['schema']=='focurve_user_'+p.name and r['origin']=='https://localhost:'+str(r['config']['webPort']),'CERTIFICATE_COMPLETION_IDENTITY_MISMATCH')
 for name,relative in [('java','runtimes/java/bin/java.exe'),('mysql','runtimes/mysql'),('node','runtimes/node/node.exe'),('python','runtimes/python/python.exe')]:require(pathlib.Path(r['runtimes'][name]).resolve()==(p/relative).resolve(),'CERTIFICATE_COMPLETION_RUNTIME_PATH_MISMATCH')
 # Compare copied code/runtime bytes with the approved artifact, including the
 # narrowly approved control-file patch. Do not execute a stale control payload.
 expected_copied={}
 for row in manifest['files']:
  name=row['path'];target=None
  if name.startswith(('app/','tools/')):target=p/name
  elif name.startswith('vendor/'):target=p/'runtimes'/name[len('vendor/'):]
  elif name.startswith(('installer/','launch/','docs/','native/')) or name in ['config.example.json','BUILD-PROVENANCE.json']:target=p/'control'/name
  if target is not None:
   require(target.resolve().is_relative_to(p) and target.is_file() and not target.is_symlink() and sha(target)==row['sha256'],'CERTIFICATE_COMPLETION_PAYLOAD_MISMATCH')
   expected_copied[target.relative_to(p).as_posix()]=row['sha256']
 if (package/'installer/observe.cjs').is_file():expected_copied['tools/observe.cjs']=sha(package/'installer/observe.cjs')
 if (package/'app/server/server.jar').is_file():
  with zipfile.ZipFile(package/'app/server/server.jar') as archive:
   for entry in archive.infolist():
    if entry.is_dir():continue
    if entry.filename.startswith('BOOT-INF/lib/'):name='server-libs/'+entry.filename.removeprefix('BOOT-INF/lib/')
    elif entry.filename.startswith('BOOT-INF/classes/'):name='server-classes/'+entry.filename.removeprefix('BOOT-INF/classes/')
    else:continue
    expected_copied[name]=hashlib.sha256(archive.read(entry)).hexdigest()
 actual_copied={f.relative_to(p).as_posix() for folder in ['app','tools','runtimes','control','server-libs','server-classes'] for f in (p/folder).rglob('*') if f.is_file()}
 require(actual_copied==set(expected_copied)|{'control/MANIFEST.json'},'CERTIFICATE_COMPLETION_FILE_SET_MISMATCH')
 for name,expected in expected_copied.items():
  target=(p/name).resolve();require(target.is_relative_to(p) and target.is_file() and sha(target)==expected,'CERTIFICATE_COMPLETION_PAYLOAD_MISMATCH')
 for row in read(p/'control/MANIFEST.json')['files']:
  target=(p/'control'/row['path']).resolve();require(target.is_relative_to(p/'control') and target.is_file() and sha(target)==row['sha256'],'CERTIFICATE_COMPLETION_CONTROL_MISMATCH')
 port_available(r['config']['webPort']);port_available(r['config']['mysqlPort'])
 certificate=json.loads(run(['powershell.exe','-NoProfile','-File',p/'control/installer/certificate.ps1','-Directory',p,'-InstallationId',p.name,'-ApproveCurrentUserTrust','-Phase','Inspect','-ExpectedThumbprint',thumbprint],text=True,timeout=30).stdout)
 require(certificate=={'thumbprint':thumbprint,'store':'CurrentUser','subject':'CN=FOCURVE Local '+p.name},'CERTIFICATE_COMPLETION_TRUST_UNCONFIRMED')
 require(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=10)<end and sha(p/'installation.json')==installation_sha256 and sha(p/'first-install-failure.json')==failure_sha256,'CERTIFICATE_COMPLETION_EVIDENCE_CHANGED')
 operation=uuid.uuid4().hex;directory=p/'certificate-completions'/operation;directory.mkdir(parents=True)
 for name in ['installation.json','first-install-failure.json']:shutil.copyfile(p/name,directory/('original-'+name))
 lock=p/'certificate-completion.lock'
 try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
 except FileExistsError:raise InstallError('CERTIFICATE_COMPLETION_ALREADY_ATTEMPTED') from None
 secret_sha=sha(p/'secrets.dpapi');normal=False
 try:
  secret=unprotect((p/'secrets.dpapi').read_bytes())
  result=finish_initial_install(p,r,secret,{**base_env(),'FOCURVE_NEW_PFX_PASSWORD':secret['pfxPassword']},certificate)
  require(datetime.datetime.now(datetime.timezone.utc)<end,'CERTIFICATE_COMPLETION_DEADLINE_EXPIRED')
  require(sha(p/'secrets.dpapi')==secret_sha and sha(p/'first-install-failure.json')==failure_sha256,'CERTIFICATE_COMPLETION_PRESERVED_STATE_CHANGED')
  write(directory/'receipt.json',{'contract':'FOCURVE_CERTIFICATE_INSTALL_COMPLETION_1','operationId':operation,'installationId':p.name,'packageSHA256':package_sha256,'originalInstallationSHA256':installation_sha256,'originalFailureSHA256':failure_sha256,'certificateThumbprint':thumbprint,'state':'INSTALLED_NOT_RUNNING','credentialsUnchanged':True,'failurePreserved':True,'servicesRunning':False,'ChromeStarted':False,'START_END':False})
  normal=True;return result
 except Exception:
  r['status']='INSTALL_COMPLETION_FAILED_PRESERVED';write(p/'installation.json',r);raise
 finally:
  os.close(fd)
  if normal:os.rename(lock,directory/'completed.lock')

def close_recovery_scope(p,expected_scope_sha256):
 """Close only this explicit recovery authority before draining/stopping services.
 Preserve the scope file as evidence. Never change auth, HOLD, READY or user data.
 """
 p=pathlib.Path(p).resolve();scope=p/'auth-recovery-grant.json'
 require(scope.is_file() and not scope.is_symlink() and sha(scope)==expected_scope_sha256,'RECOVERY_SCOPE_CHANGED')
 grant=read(scope);operation=grant.get('operation_id','')
 require(grant.get('installation_id')==p.name and re.fullmatch('[a-f0-9]{32}',operation),'RECOVERY_INSTALLATION_MISMATCH')
 closed=p/('auth-recovery-grant.closed-'+operation+'.json');require(not closed.exists(),'RECOVERY_SCOPE_CLOSE_CONFLICT')
 os.rename(scope,closed);require(sha(closed)==expected_scope_sha256 and not scope.exists(),'RECOVERY_SCOPE_CLOSE_UNCONFIRMED')
 return {'scopeClosed':True,'operationId':operation,'evidenceSHA256':expected_scope_sha256,'servicesStopped':False,'holdChanged':False}

def _recovery_channel_module(p,record):
 # Reuse the installed Native compiler's hash-pinned sibling-module loader.
 # Resolving this helper never compiles or starts a Native Host.
 folder=p/'control/installer';location=folder/'native_setup.py'
 expected={r['path']:r['sha256'] for r in record['payload']}
 require(location.resolve().parent==folder.resolve() and not location.is_symlink() and expected.get('control/installer/native_setup.py')==sha(location),'RECOVERY_CHANNEL_MODULE_UNCONFIRMED')
 spec=__import__('importlib.util',fromlist=['']).spec_from_file_location('owned_channel_reauth_loader',location)
 module=__import__('importlib.util',fromlist=['']).module_from_spec(spec);spec.loader.exec_module(module)
 module.native_compiler(p,record)
 return sys.modules['product_hold_recovery']

def validate_recovery_preserved_ready(p,record,auth_grant,expected_channel_sha256):
 require(record.get('status')=='PRODUCT_HOLD_PRESERVED' and re.fullmatch('[a-f0-9]{64}',expected_channel_sha256 or ''),'RECOVERY_FOCUS_MUST_STAY_CLOSED')
 verify_installed_payload(p,record)
 path=p/'control/native-link/product-hold-grant.json'
 require(path.is_file() and not path.is_symlink() and sha(path)==expected_channel_sha256,'RECOVERY_CHANNEL_SCOPE_CHANGED')
 h=_recovery_channel_module(p,record);g=read(path);b=g.get('binding',{});native=read(p/'control/native-link/binding.json');now=datetime.datetime.now(datetime.timezone.utc)
 try:begin=datetime.datetime.fromisoformat(g['notBeforeUTC']);end=datetime.datetime.fromisoformat(g['notAfterUTC'])
 except (KeyError,TypeError,ValueError):raise InstallError('RECOVERY_CHANNEL_SCOPE_INVALID') from None
 require(begin.tzinfo is not None and end.tzinfo is not None and begin<=now<end and 0<(end-begin).total_seconds()<=1200,'RECOVERY_CHANNEL_SCOPE_EXPIRED')
 require(g.get('contract')==h.CONTRACT and g.get('recordStateSHA256')==h.state_digest(record) and native.get('runtimeFiles',{}).get('control/native-link/product-hold-grant.json')==expected_channel_sha256 and all(b.get(k)==v for k,v in {'installationId':record['id'],'extensionId':record['extensionId'],'profile':str(p/'profile'),'origin':record['origin'],'callback':record['callback'],'schema':record['schema'],'ownerUserId':int(auth_grant['owner_user_id']),'executorId':auth_grant['executor_id']}.items()),'RECOVERY_CHANNEL_OWNER_OR_RECORD_MISMATCH')
 failure=read(p/'product-runtime-first-failure.json');require(h.classify(record,failure)=='PRODUCT_CHANNEL_CLOSED','RECOVERY_CHANNEL_CAUSE_NOT_SUPPORTED')
 h.validate_preserved_cause(sys.modules[__name__],p,record,g,failure)
 require(h.lock_identity(p/'product-runtime.lock')==g.get('originalLockIdentity'),'RECOVERY_CHANNEL_LOCK_CHANGED')
 # READY is historical evidence only. admission.closed remains in force and
 # the Server admits only the separate same-owner PKCE scope, never START.

def recovery_server_env(record,secret,p,expected_scope_sha256,expected_channel_sha256=None):
 """Explicit recovery-only Server configuration after separately approved DB startup.
 Does not start any process, write HOLD/configuration, open READY or recover auth.
 The operator must provision the exact public scope file under a new bounded grant.
 """
 p=pathlib.Path(p).resolve();scope=p/'auth-recovery-grant.json'
 require(p.name==record['id'] and record['schema']=='focurve_user_'+record['id'],'RECOVERY_INSTALLATION_MISMATCH')
 require(re.fullmatch('[a-f0-9]{64}',expected_scope_sha256 or '') and scope.is_file() and not scope.is_symlink() and scope.stat().st_size<=4096 and sha(scope)==expected_scope_sha256,'RECOVERY_SCOPE_CHANGED')
 grant=read(scope);require(set(grant)=={'contract','installation_id','operation_id','executor_id','owner_user_id','origin','callback','not_before','not_after'},'RECOVERY_SCOPE_INVALID');now=datetime.datetime.now(datetime.timezone.utc)
 begin=datetime.datetime.fromisoformat(grant.get('not_before',''));end=datetime.datetime.fromisoformat(grant.get('not_after',''))
 require(begin.tzinfo is not None and end.tzinfo is not None and begin<=now<end and 0<(end-begin).total_seconds()<=1200,'RECOVERY_SCOPE_EXPIRED')
 require(grant.get('contract')=='FOCURVE_MEMBER_REAUTH_SCOPE_1' and grant.get('installation_id')==record['id'] and grant.get('origin')==record['origin'] and grant.get('callback')==record['callback'],'RECOVERY_AUTHORITY_MISMATCH')
 require(bool(re.fullmatch('[a-f0-9]{32}',grant.get('operation_id',''))) and bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',grant.get('executor_id',''))) and bool(re.fullmatch('[1-9][0-9]{0,17}',grant.get('owner_user_id',''))),'RECOVERY_IDENTITY_REQUIRED')
 require((p/'admission.closed').is_file(),'RECOVERY_FOCUS_MUST_STAY_CLOSED')
 if (p/'admission.ready').exists():validate_recovery_preserved_ready(p,record,grant,expected_channel_sha256)
 current=json.loads(helper(p,record,'safety',db_env(record,secret)))
 require(set(current)=={'activeSessions','locks','unresolvedReceipts'} and all(type(v) is int and v==0 for v in current.values()),'RECOVERY_DATABASE_NOT_CLEAR')
 require(sha(scope)==expected_scope_sha256 and datetime.datetime.now(datetime.timezone.utc)<end,'RECOVERY_SCOPE_CHANGED')
 env=server_env(record,secret,p)
 env.update({'FOCURVE_AUTH_RECOVERY_GRANT':str(scope),'FOCURVE_AUTH_RECOVERY_GRANT_SHA256':expected_scope_sha256,'MAIL_EXTERNAL_ENABLED':'false','MEMBER_MAIL_EXTERNAL_ENABLED':'false'})
 return env

def preserved_end_server_env(record,secret,p,expected_scope_sha256):
 """Explicit, bounded existing-session termination only. No process start or HOLD write.
 Current row/lock/proof verification is performed transactionally by the Server
 before local END can be admitted. Does not use a cached all-clear DB result.
 """
 p=pathlib.Path(p).resolve();scope=p/'preserved-end-grant.json'
 require(p.name==record['id'] and record['schema']=='focurve_user_'+record['id'] and record.get('status')=='PRODUCT_HOLD_PRESERVED','PRESERVED_END_INSTALLATION_MISMATCH')
 require(re.fullmatch('[a-f0-9]{64}',expected_scope_sha256 or '') and scope.is_file() and not scope.is_symlink() and scope.stat().st_size<=4096 and sha(scope)==expected_scope_sha256,'PRESERVED_END_SCOPE_CHANGED')
 g=read(scope)
 require(set(g)=={'contract','installation_id','extension_id','profile_instance','operation_id','executor_id','owner_user_id','session_id','policy_snapshot_id','base_revision','origin','callback','not_before','not_after'},'PRESERVED_END_SCOPE_INVALID')
 require(g.get('contract')=='FOCURVE_PRESERVED_END_SCOPE_1' and g.get('installation_id')==record['id'] and g.get('extension_id')==record.get('extensionId') and g.get('origin')==record['origin'] and g.get('callback')==record['callback'] and g.get('profile_instance')==hashlib.sha256(str((p/'profile').resolve()).encode()).hexdigest()[:32],'PRESERVED_END_AUTHORITY_MISMATCH')
 for key in ['executor_id','session_id','policy_snapshot_id']:require(bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',g.get(key,''))),'PRESERVED_END_SCOPE_INVALID')
 require(bool(re.fullmatch('[a-f0-9]{32}',g.get('operation_id',''))) and bool(re.fullmatch('[1-9][0-9]{0,17}',g.get('owner_user_id',''))) and type(g.get('base_revision')) is int and g['base_revision']>0,'PRESERVED_END_SCOPE_INVALID')
 begin=datetime.datetime.fromisoformat(g['not_before']);end=datetime.datetime.fromisoformat(g['not_after']);now=datetime.datetime.now(datetime.timezone.utc)
 require(begin.tzinfo is not None and end.tzinfo is not None and begin<=now<end and 0<(end-begin).total_seconds()<=1200,'PRESERVED_END_SCOPE_EXPIRED')
 require((p/'admission.closed').is_file() and not (p/'admission.closed').is_symlink(),'PRESERVED_END_CLOSED_REQUIRED')
 env=server_env(record,secret,p)
 env.update({'FOCURVE_PRESERVED_END_GRANT':str(scope),'FOCURVE_PRESERVED_END_GRANT_SHA256':expected_scope_sha256,'FOCURVE_INSTALLATION_READY':'','FOCURVE_INSTALLATION_DEADLINE':g['not_after'],'MAIL_EXTERNAL_ENABLED':'false','MEMBER_MAIL_EXTERNAL_ENABLED':'false'})
 require(sha(scope)==expected_scope_sha256 and datetime.datetime.now(datetime.timezone.utc)<end,'PRESERVED_END_SCOPE_CHANGED')
 return env

def server_env(record,secret,p):
 e=base_env()
 e.update({k:v for k,v in db_env(record,secret).items() if k in ['DB_URL','DB_USERNAME','DB_PASSWORD']});e.update({'MEMBER_ORIGIN':record['origin'],'MEMBER_PORT':str(record['config']['webPort']),'MEMBER_LINK_KEY':secret['linkKey'],'MEMBER_CALLBACKS':record['callback'],'MEMBER_KEYSTORE':str(p/'localhost.pfx'),'MEMBER_KEYSTORE_PASSWORD':secret['pfxPassword'],'MEMBER_KEY_ALIAS':record['certificateAlias'],'MEMBER_FIXTURE_ENABLED':'false','MEMBER_MAIL_TEST_SINK':'false','MAIL_MODE':'external','MAIL_EXTERNAL_ENABLED':str(record['config']['mail']['enabled']).lower(),'MEMBER_MAIL_EXTERNAL_ENABLED':str(record['config']['mail']['enabled']).lower(),'AUTH_PUBLIC_URL':record['origin'],'FOCURVE_INSTALLATION_GATE':str(p/'admission.closed'),'FOCURVE_INSTALLATION_GATE_KEY':secret['lifecycleKey'],'FOCURVE_INSTALLATION_DEADLINE':record.get('launchDeadlineUTC','')})
 # Do not inherit unreviewed process environment overrides from a developer shell.
 for k in list(e):
  if k not in os.environ:continue
  if k.startswith(('SPRING_','GOOGLE_','KAKAO_')):e.pop(k,None)
 e['FOCURVE_INSTALLATION_READY']=str(p/'admission.ready')
 m=record['config']['mail']
 if m['enabled']:
  e.update({'MAIL_HOST':m['host'],'MAIL_PORT':str(m['port']),'MAIL_FROM':m['from'],'MAIL_USERNAME':m['username'],'MAIL_PASSWORD':secret['smtpPassword'],'MAIL_TLS':str(m['tls']).lower(),'MAIL_SSL':str(m['ssl']).lower()})
  # Signup codes use the product mail adapter. The reset/verification outbox
  # uses Boot's JavaMailSender; bind both to this same protected configuration.
  e.update({'MEMBER_MAIL_FROM':m['from'],'SPRING_MAIL_HOST':m['host'],'SPRING_MAIL_PORT':str(m['port']),
            'SPRING_MAIL_USERNAME':m['username'],'SPRING_MAIL_PASSWORD':secret['smtpPassword']})
  e['SPRING_APPLICATION_JSON']=json.dumps({'spring':{'mail':{'properties':{
       'mail.smtp.auth':True,'mail.smtp.ssl.enable':m['ssl'],'mail.smtp.ssl.checkserveridentity':True,
       'mail.smtp.starttls.enable':m['tls'],'mail.smtp.starttls.required':m['tls'],
       'mail.smtp.connectiontimeout':5000,'mail.smtp.timeout':5000,'mail.smtp.writetimeout':5000}}}})
 return e
def http(p,record,path,body=None,headers=None):
 context=ssl.create_default_context(cafile=str(p/'localhost.pem'))
 req=urllib.request.Request(record['origin']+path,data=body,headers={'Content-Type':'application/json',**(headers or {})})
 with urllib.request.urlopen(req,context=context,timeout=5) as response:return response.status,response.read()
def browser_bridge():
 # Use only this installer's module; never discover an arbitrary provider.
 import importlib.util
 location=pathlib.Path(__file__).resolve().parent/'browser_bridge.py'
 spec=importlib.util.spec_from_file_location('focurve_browser_boundary',location)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 return module.BrowserBridge()

def require_browser_provider():
 try:browser_bridge().require_available()
 except RuntimeError as error:raise InstallError(str(error)) from None

def browser_request(p,record,operation):
 verify_process(p,'chrome')
 try:return browser_bridge().request(p,record,operation)
 except RuntimeError as error:raise InstallError(str(error)) from None

def observe(p,record):return browser_request(p,record,'safety')
def safety_clear(local,db):
 counts=['activeSessions','unresolvedBindings','unreleasedJournals','pendingLeases','pendingOutbox','pendingImports','transitions','rootClaims','sessionRules','dynamicRules']
 required={'R3_LOCAL_SAFETY_2':5,'R4_GUEST_LOCAL_SAFETY_1':3}.get(local.get('contract'));coverage=local.get('coverage',{})
 return (required is not None and local.get('gate')=='CLEAR_LOCAL_ONLY' and local.get('issues')==[] and all(type(local.get('counts',{}).get(k)) is int and local['counts'][k]==0 for k in counts) and all(local.get('identity',{}).get(k) is True for k in ['document','deployment','installation','profile']) and coverage.get('doubleReadStable') is True and coverage.get('schemaVersion')==1 and coverage.get('requiredDatabases')==required and type(coverage.get('observedDatabases')) is int and coverage['observedDatabases']>=required and all(type(local.get('resources',{}).get(k)) is int and local['resources'][k]==0 for k in ['openConnections','activeReadTransactions','pendingNativeCalls']) and set(db)=={'activeSessions','locks','unresolvedReceipts'} and all(type(v) is int and v==0 for v in db.values()))

def verify_ready_reply(reply,record):
 require(reply.get('ready') is True and reply.get('version')=='LAUNCH_CONTEXT_2' and reply.get('launchId')==record['launchId'] and reply.get('launchDeadlineUTC')==record['launchDeadlineUTC'],'EXTENSION_LAUNCH_CONTEXT_MISMATCH')
def _stop_verified(p,expected_launch):
 require_browser_provider()
 p=pathlib.Path(p).resolve();record=read(p/'installation.json');require(child(installations(),record['id'])==p and record.get('contract')==CONTRACT,'NOT_OWNED_INSTALLATION');require(record['status']=='RUNNING','NOT_RUNNING_OR_HELD');verify_installed_payload(p,record)
 require(record.get('launchId')==expected_launch,'OTHER_LAUNCH_ACTIVE_NO_ACTION')
 secret=unprotect((p/'secrets.dpapi').read_bytes());(p/'admission.closed').touch(exist_ok=True)
 verify_process(p,'server');code,data=http(p,record,'/api/v1/install/lifecycle-quiesce',b'{}',{'X-FOCURVE-Installation-Key':secret['lifecycleKey']});require(code==200 and json.loads(data).get('quiesced') is True,'SERVER_ADMISSION_NOT_QUIESCED')
 quiesced=browser_request(p,record,'quiesce');require(quiesced.get('quiesced') is True,'EXTENSION_ADMISSION_NOT_QUIESCED')
 local=observe(p,record);db=json.loads(helper(p,record,'safety',db_env(record,secret)))
 write(p/'last-stop-safety.json',{'local':local,'db':db})
 if not safety_clear(local,db):
  if local.get('gate')=='UNKNOWN':record['status']='STOP_HOLD_PRESERVED';write(p/'installation.json',record)
  raise InstallError('UNRESOLVED_STATE_PRESERVED_NO_END_OR_CLEANUP')
 verify_process(p,'server');code,_=http(p,record,'/actuator/shutdown',b'{}');require(code==200,'SERVER_STOP_UNCONFIRMED');await_exit(read(p/'server-process.json')['ProcessId'])
 shutdown_mysql(p,record);await_exit(read(p/'mysql-process.json')['ProcessId']);record['status']='STOPPED';write(p/'installation.json',record)
 return {'status':'STOPPED_DATA_PRESERVED','closeDedicatedBrowserYourself':True,'automaticEND':False}
def _start_verified(p,minutes,approve=False,not_after=None,recovery_runtime=None):
 require_browser_provider()
 require(approve and type(minutes) is int and 3<=minutes<=480,'NEW_INSTALLATION_LAUNCH_APPROVAL_REQUIRED');p=pathlib.Path(p).resolve();record=owned_record(p)
 if record.get('holdRecovery'):
  h,_=recovery_modules()
  require(recovery_runtime is not None,'RECOVERED_START_NEEDS_POLICY_PERMITTED_RUNTIME')
  try:
   recovery_runtime.require_launch_permission(h.binding(p,record))
   h.verify_recovered_start(p,record,not_after,datetime.datetime.now(datetime.timezone.utc),True)
  except h.RecoveryError as e:raise InstallError(str(e)) from None
 require(not (p/'hold-recovery.lock').exists(),'RECOVERY_ALREADY_ACTIVE')
 require(not (p/'STOP').exists(),'INSTALLATION_STOP_PRESENT');port_available(record['config']['webPort']);port_available(record['config']['mysqlPort'])
 if (p/'chrome-process.json').exists():
  pid=read(p/'chrome-process.json')['ProcessId'];alive=run(['powershell.exe','-NoProfile','-Command',f'[bool](Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue)'],text=True).stdout.strip();require(alive=='False','CLOSE_PREVIOUS_DEDICATED_BROWSER_FIRST')
 if record['status']=='STOPPED':require(safety_clear(**read(p/'last-stop-safety.json')),'PREVIOUS_NORMAL_STOP_NOT_VERIFIED')
 secret=unprotect((p/'secrets.dpapi').read_bytes());validate_link_key(secret);record['status']='STARTING';record['controllerPID']=os.getpid();write(p/'installation.json',record)
 try:
  verify_package()
  deadline=prepare_launch_configuration(p,record,minutes,not_after)
  first_manual=record['config']['browserMode']=='regular_manual' and not record.get('extensionInstalledConfirmed')
  if first_manual:
   start_browser(p,record,first=True);await_manual_extension(p,record);pre_server_live_identity(p,record);record['extensionInstalledConfirmed']=True;write(p/'installation.json',record)
  launch_guard(record);port_available(record['config']['mysqlPort'])
  db=spawn_owned(mysql_args(p,record),p,'mysql');wait_mysql(p,record,db)
  debt=json.loads(helper(p,record,'safety',db_env(record,secret)));require(all(type(v) is int and v==0 for v in debt.values()),'DATABASE_OBLIGATIONS_BLOCK_START')
  env=server_env(record,secret,p)
  launch_guard(record);port_available(record['config']['webPort'])
  server=spawn_owned([record['runtimes']['java'],'-Xmx384m','-jar',p/'app/server/server.jar','--spring.profiles.active=member-runtime,user-install','--member.fixture.enabled=false','--member.mail.test-sink=false','--spring.flyway.enabled=false','--management.endpoints.web.exposure.include=health,shutdown','--management.endpoint.shutdown.access=unrestricted','--server.shutdown=graceful','--spring.web.resources.static-locations=file:'+str(p/'app/web').replace('\\','/')+'/'],p,'server',env)
  for _ in range(100):
   launch_guard(record)
   require(server.poll() is None,'SERVER_EXITED_DURING_START')
   try:
    code,data=http(p,record,'/actuator/health')
    if code==200 and json.loads(data).get('status')=='UP':break
   except (OSError,ValueError):pass
   time.sleep(.3)
  else:raise InstallError('SERVER_START_UNCONFIRMED')
  launch_guard(record)
  if not first_manual:start_browser(p,record,first=False)
  live_identity(p,record)
  before_ready_local=observe(p,record);before_ready_db=json.loads(helper(p,record,'safety',db_env(record,secret)));require(safety_clear(before_ready_local,before_ready_db),'PRE_READY_OBLIGATIONS_OR_UNKNOWN')
  opened=browser_request(p,record,'ready');verify_ready_reply(opened,record)
  (p/'admission.ready').touch();require(browser_request(p,record,'openWeb').get('opened') is True,'WEB_OPEN_UNCONFIRMED')
  record['status']='RUNNING';record['launchDeadlineUTC']=deadline;write(p/'installation.json',record)
  return {'status':'RUNNING_NEW_INSTALLATION_NOT_ACCEPTED','origin':record['origin'],'installation':str(p),'launchId':record['launchId'],'deadlineUTC':record['launchDeadlineUTC'],'automaticSTART_END':False}
 except Exception:
  record['status']='START_FAILED_PRESERVED';write(p/'installation.json',record);raise
def launch_guard(record):require(datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(record['launchDeadlineUTC']),'LAUNCH_DEADLINE_NO_EXTENSION')
def prepare_launch_configuration(p,record,minutes,not_after=None):
 now=datetime.datetime.now(datetime.timezone.utc);limit=now+datetime.timedelta(minutes=minutes)
 if not_after is not None:
  try:fixed=datetime.datetime.fromisoformat(not_after)
  except (TypeError,ValueError):raise InstallError('FIXED_START_DEADLINE_REQUIRED') from None
  require(fixed.tzinfo is not None,'FIXED_START_DEADLINE_REQUIRED');limit=min(limit,fixed)
 require(limit>now+datetime.timedelta(minutes=2),'INSUFFICIENT_TIME_FOR_SAFE_START')
 # Only an installed fresh instance or a proven normal STOP reaches this point.
 # These are this product instance's admission markers, never global STOP files.
 for name in ['admission.closed','admission.ready']:
  if (p/name).exists():(p/name).unlink()
 deadline=limit.isoformat();record['launchId']=uuid.uuid4().hex
 config=p/'app/extension/release-config.js';config.write_text('globalThis.FOCURVE_DEPLOYMENT=Object.freeze('+json.dumps({'contract':'STANDALONE_API_1','api':record['origin']+'/api/v1','origin':record['origin'],'launchId':record['launchId'],'launchDeadlineUTC':deadline})+');\n',encoding='utf-8')
 context=p/'app/extension/launch-context.json';write(context,{'contract':'STANDALONE_LAUNCH_1','extensionId':record['extensionId'],'api':record['origin']+'/api/v1','origin':record['origin'],'launchId':record['launchId'],'launchDeadlineUTC':deadline})
 for row in record['payload']:
  if row['path']=='app/extension/release-config.js':row['sha256']=sha(config)
  if row['path']=='app/extension/launch-context.json':row['sha256']=sha(context)
 record['launchDeadlineUTC']=deadline;write(p/'installation.json',record);return deadline
def browser_arguments(p,record,first=False):
 args=[record['runtimes']['chrome'],'--user-data-dir='+str(p/'profile'),'--no-first-run','--no-default-browser-check']
 if record['config']['browserMode']=='testing_bundled':args+=['--disable-extensions-except='+str(p/'app/extension'),'--load-extension='+str(p/'app/extension')]
 return args+['--new-window','chrome://extensions/' if first else 'about:blank']
def start_browser(p,record,first=False):
 launch_guard(record);free=int(run(['powershell.exe','-NoProfile','-Command','[long](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory*1024'],text=True).stdout.strip());require(free>=3*1024**3,'RAM_BELOW_3_GIB_NO_BROWSER_START');spawn_owned(browser_arguments(p,record,first),p,'chrome')
def await_manual_extension(p,record):
 require(sys.stdin.isatty(),'INTERACTIVE_EXTENSION_INSTALL_APPROVAL_REQUIRED')
 print('새 FOCURVE 전용 Chrome 창에서 최초 1회만 진행하세요:')
 print('1. 확장 프로그램 화면의 개발자 모드를 켭니다.\n2. 압축해제된 확장 프로그램을 로드합니다를 누릅니다.\n3. 아래 폴더를 선택합니다:')
 print(str(p/'app/extension'));print('정책이나 보안 경고로 거절되면 우회하지 말고 Esc로 중단하세요. 완료했으면 이 창에서 Enter를 누르세요.',flush=True)
 import msvcrt
 remaining=(datetime.datetime.fromisoformat(record['launchDeadlineUTC'])-datetime.datetime.now(datetime.timezone.utc)).total_seconds()
 limit=time.monotonic()+max(0,min(300,remaining-120))
 while time.monotonic()<limit:
  if (p/'STOP').exists():raise InstallError('INSTALLATION_STOP_PRESENT')
  if msvcrt.kbhit():
   key=msvcrt.getwch()
   if key in ['\r','\n']:return
   if key=='\x1b':raise InstallError('USER_EXTENSION_INSTALL_CANCELLED')
  time.sleep(.1)
 raise InstallError('USER_EXTENSION_INSTALL_TIME_LIMIT')
def live_identity(p,record):
 observed=browser_request(p,record,'identity');require(observed.get('extensionId')==record['extensionId'] and observed.get('version')=='0.1.25' and observed.get('api')==record['origin']+'/api/v1','LIVE_INSTALLATION_BINDING_UNCONFIRMED');record['observedBrowser']=observed.get('browser')

def start(p,minutes,approve=False,not_after=None,recovery_runtime=None):
 require_browser_provider()
 require(approve and type(minutes) is int and 3<=minutes<=480,'NEW_INSTALLATION_LAUNCH_APPROVAL_REQUIRED');p=pathlib.Path(p).resolve();owned_record(p)
 try:fd=os.open(p/'start.lock',os.O_CREAT|os.O_EXCL|os.O_WRONLY)
 except FileExistsError:raise InstallError('INSTALLATION_START_OPERATION_ACTIVE') from None
 try:return _start_verified(p,minutes,approve,not_after,recovery_runtime)
 finally:os.close(fd);(p/'start.lock').unlink()
def stop(p,expected_launch=None):
 require_browser_provider()
 p=pathlib.Path(p).resolve();record=read(p/'installation.json');require(child(installations(),record['id'])==p and record.get('contract')==CONTRACT,'NOT_OWNED_INSTALLATION');require(record['status']=='RUNNING','NOT_RUNNING_OR_HELD')
 launch=record.get('launchId');require(bool(re.fullmatch('[a-f0-9]{32}',launch or '')) and (expected_launch is None or launch==expected_launch),'OTHER_LAUNCH_ACTIVE_NO_ACTION')
 try:fd=os.open(p/'stop.lock',os.O_CREAT|os.O_EXCL|os.O_WRONLY)
 except FileExistsError:raise InstallError('INSTALLATION_STOP_OPERATION_ACTIVE') from None
 try:return _stop_verified(p,launch)
 except Exception as error:
  if isinstance(error,InstallError) and str(error)=='OTHER_LAUNCH_ACTIVE_NO_ACTION':raise
  latest=read(p/'installation.json')
  if latest['status']!='STOPPED':latest['status']='STOP_HOLD_PRESERVED';write(p/'installation.json',latest)
  failure=p/'first-stop-failure.json'
  if not failure.exists():write(failure,{'status':'PRESERVED_NO_RETRY','atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'error':str(error) if isinstance(error,InstallError) else 'STOP_UNCONFIRMED'})
  raise
 finally:os.close(fd);(p/'stop.lock').unlink()
def display(result,machine=False):
 if machine:print(json.dumps(result,ensure_ascii=False),flush=True);return
 messages={'PACKAGE_VERIFIED_NOT_INSTALLED':'설치 패키지의 파일 무결성을 확인했어요. 아직 설치하지 않았습니다.','INSTALLED_NOT_RUNNING':'새 전용 설치가 준비됐어요. 아직 프로그램은 실행하지 않았습니다.','RUNNING_NEW_INSTALLATION_NOT_ACCEPTED':'FOCURVE 전용 창을 열었어요. 아직 실제 사용 수용 검증 전입니다.','STOPPED_DATA_PRESERVED':'정상 종료했고 기록을 보존했어요. FOCURVE 전용 Chrome 창만 직접 닫아 주세요.'}
 messages.update({'PRODUCT_HOLD_PRESERVED':'안전 확인이 필요한 중단 상태입니다. 기존 기록과 데이터를 보존하고 있습니다.',
                  'PRODUCT_RECOVERED_FOCUS_LOCKED':'중단 상태를 정식 처리했습니다. 서비스와 집중은 아직 시작하지 않았습니다.',
                  'PRODUCT_HOLD_SCOPE_READY':'새 제한 실행 승인을 등록했습니다. 서비스와 집중은 아직 시작하지 않았습니다.'})
 print(messages.get(result.get('status'),'설치 상태: '+str(result.get('status'))),flush=True)
 if result.get('origin'):print('웹 주소: '+result['origin'],flush=True)
 if result.get('installation'):print('설치 경로: '+result['installation'],flush=True)
 if result.get('deadlineUTC'):
  end=datetime.datetime.fromisoformat(result['deadlineUTC']).astimezone(datetime.timezone(datetime.timedelta(hours=9)));print('이번 실행 종료 예정: '+end.strftime('%Y-%m-%d %H:%M:%S KST'),flush=True)
def interactive_configuration(config):
 print('FOCURVE 신규 설치 후보 0.1.25')
 print('현재 Windows 사용자 전용 폴더에 새 프로그램·Chrome 프로필·독립 DB를 만듭니다.')
 print('기본 브라우저는 일반 Chrome의 새 전용 프로필입니다. 최초 1회 확장 로드 승인이 필요합니다. 기존 Default·Profile 2는 열지 않습니다.')
 print('localhost 인증서를 현재 사용자 신뢰 저장소에 등록합니다. 기존 Chrome·운영 DB·시스템 방화벽은 변경하지 않습니다.')
 print('이 설치는 실제 수용 검증 전 후보입니다. 아직 서비스나 집중을 시작하지 않습니다.')
 if input('이 범위의 새 설치와 인증서 등록에 동의하면 INSTALL을 입력하세요: ').strip()!='INSTALL':return None
 c=json.loads(json.dumps(config))
 if input('회원가입 이메일 발송용 SMTP 설정을 지금 입력할까요? (y/N): ').strip().lower()=='y':
  mode=input('보호 연결 방식: STARTTLS(기본) / SSL: ').strip().upper() or 'STARTTLS';require(mode in ['STARTTLS','SSL'],'MAIL_SECURE_TRANSPORT_REQUIRED')
  c['mail']={'enabled':True,'host':input('SMTP 서버 호스트: ').strip(),'port':int(input('SMTP 포트 (기본 '+('465' if mode=='SSL' else '587')+'): ').strip() or ('465' if mode=='SSL' else '587')),'from':input('발신 이메일 주소: ').strip(),'username':input('SMTP 로그인 이름 (Gmail이면 전체 이메일 주소): ').strip(),'tls':mode=='STARTTLS','ssl':mode=='SSL'}
  print('Gmail에는 Google 로그인 비밀번호가 아닌 앱 비밀번호가 필요합니다. 설치 도중 숨김 입력란에서만 입력하며 채팅이나 설정 파일에 넣지 마세요.')
 else:print('메일 발송은 비활성화합니다. 비회원 기능부터 확인할 수 있고, 회원가입 수용은 보류됩니다.')
 return canonical_config(c)

def connect_product(p,minutes,approve=False,not_after=None,user_session=False):
 # Verify the installed control payload before executing its registrar. This
 # deliberately does not configure BrowserBridge or unlock a held install.
 owned_record(p)
 import importlib.util
 location=pathlib.Path(__file__).resolve().parent/'native_setup.py'
 spec=importlib.util.spec_from_file_location('owned_product_native_setup',location)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 return module.connect(sys.modules[__name__],p,minutes,approve,not_after,user_session)
def product_status(p):
 """Read-only process/scope status. Does not infer DB or local safety."""
 target=pathlib.Path(p).resolve();record=read(target/'installation.json')
 require(child(installations(),record['id'])==target and record.get('contract')==CONTRACT,'NOT_OWNED_INSTALLATION')
 verify_installed_payload(target,record)
 result={k:record.get(k) for k in ['status','origin','id','extensionId','launchDeadlineUTC']}
 result.update(health='NOT_QUERIED',localSafety='NOT_OBSERVED',databaseSafety='NOT_OBSERVED',processes={})
 for name in ['chrome','server','mysql','hold-mysql']:
  if not (target/(name+'-process.json')).is_file():result['processes'][name]={'state':'NO_RECORD'};continue
  try:
   actual=verify_process(target,name);result['processes'][name]={'state':'OWNED_PRESENT','pid':actual['ProcessId']}
  except InstallError as error:
   result['processes'][name]={'state':'NOT_PRESENT' if str(error)=='OWNED_PROCESS_NOT_PRESENT' else 'IDENTITY_UNCONFIRMED'}
 binding=target/'control/native-link/binding.json'
 if binding.is_file():
  value=read(binding)
  try:end=datetime.datetime.fromisoformat(value['notAfterUTC'])
  except (ValueError,KeyError,TypeError):end=None
  result['nativeScope']={'notAfterUTC':value.get('notAfterUTC'),
    'state':'UNCONFIRMED' if end is None or end.tzinfo is None else 'EXPIRED' if end<=datetime.datetime.now(datetime.timezone.utc) else 'TIME_VALID_NOT_SAFETY_APPROVAL'}
 result['focusAdmission']='CLOSED' if (target/'admission.closed').is_file() and not (target/'admission.ready').exists() else 'UNCONFIRMED'
 return result

def product_hold_scope(p,minutes,approve=False,not_after=None):
 """New user-approved Native scope only; never services or HOLD transition."""
 require(approve is True and type(minutes) is int and 6<=minutes<=20,'PRODUCT_HOLD_SCOPE_APPROVAL_REQUIRED')
 require(os.name=='nt','WINDOWS_REQUIRED')
 target=pathlib.Path(p).resolve();record=read(target/'installation.json')
 require(child(installations(),record['id'])==target and record.get('contract')==CONTRACT,'NOT_OWNED_INSTALLATION')
 verify_installed_payload(target,record)
 import importlib.util
 expected={x['path']:x['sha256'] for x in record['payload']}
 require(expected.get('control/installer/install_core.py')==sha(pathlib.Path(__file__).resolve()),
         'PRODUCT_HOLD_MODULE_HASH_MISMATCH')
 module=None
 for name in ['product_runtime','hold_recovery','product_hold_recovery','product_hold_patch']:
  location=pathlib.Path(__file__).resolve().parent/(name+'.py')
  require(expected.get('control/installer/'+name+'.py')==sha(location),'PRODUCT_HOLD_MODULE_HASH_MISMATCH')
  if name in sys.modules:
   module=sys.modules[name];require(pathlib.Path(module.__file__).resolve()==location,'PRODUCT_HOLD_MODULE_SCOPE_MISMATCH')
  else:
   spec=importlib.util.spec_from_file_location(name,location);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module)
 now=datetime.datetime.now(datetime.timezone.utc);end=now+datetime.timedelta(minutes=minutes)
 if not_after is not None:
  fixed=datetime.datetime.fromisoformat(not_after);require(fixed.tzinfo is not None,'FIXED_SETUP_DEADLINE_REQUIRED');end=min(end,fixed)
 output=target.parent.parent/'native-link-renewals'/uuid.uuid4().hex
 try:
  module.prepare_scope(sys.modules[__name__],target,output,end,approve=True)
  module.apply_scope(sys.modules[__name__],target,output,approve=True)
 except RuntimeError as error:
  code=str(error);raise InstallError(code if re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code) else 'PRODUCT_HOLD_SCOPE_UNCONFIRMED') from None
 r=read(target/'installation.json')
 return {'status':'PRODUCT_HOLD_SCOPE_READY','installation':str(target),'notAfterUTC':end.isoformat(),
         'productPage':'chrome-extension://'+r['extensionId']+'/native-link/index.html',
         'servicesStarted':False,'holdChanged':False,'extensionReloadRequired':False,'pageRefreshRequired':True,'output':str(output)}

def channel_modules(instance):
 """Load only this installed, integrity-verified recovery implementation."""
 p=pathlib.Path(instance).resolve();r=read(p/'installation.json')
 require(child(installations(),r['id'])==p and r.get('contract')==CONTRACT,'CHANNEL_INSTALLATION_IDENTITY_REQUIRED')
 verify_installed_payload(p,r)
 folder=p/'control/installer';names=['product_runtime','hold_recovery','product_hold_recovery',
                                  'record_snapshot','product_user_session','product_hold_patch']
 expected={row['path']:row['sha256'] for row in r['payload']}
 for name in names:
  file=folder/(name+'.py');require(file.is_file() and not file.is_symlink() and
      expected.get('control/installer/'+name+'.py')==sha(file),'CHANNEL_MODULE_UNCONFIRMED')
  prior=sys.modules.get(name)
  require(prior is None or pathlib.Path(getattr(prior,'__file__','')).resolve()==file.resolve(),'CHANNEL_MODULE_SCOPE_MISMATCH')
 previous=list(sys.path)
 try:
  sys.path.insert(0,str(folder));modules={name:__import__(name) for name in names}
  require(all(pathlib.Path(modules[name].__file__).resolve()==(folder/(name+'.py')).resolve() for name in names),
          'CHANNEL_MODULE_SCOPE_MISMATCH')
  return modules
 finally:sys.path[:]=previous


def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['verify','install','complete-certificate-install','connect','start','stop','status','recover-hold-plan','recover-hold','renew-product-hold-scope','channel-observation-plan','channel-observation-apply','channel-observation-open','channel-observation-restore','stop-channel-services']);parser.add_argument('--config');parser.add_argument('--instance');parser.add_argument('--approve-install',action='store_true');parser.add_argument('--approve-current-user-certificate',action='store_true');parser.add_argument('--approve-launch',action='store_true');parser.add_argument('--interactive',action='store_true');parser.add_argument('--user-session',action='store_true');parser.add_argument('--minutes',type=int,default=None);parser.add_argument('--json',action='store_true');parser.add_argument('--not-after');parser.add_argument('--recovery-id');parser.add_argument('--expected-hold-sha256');parser.add_argument('--approve-hold-recovery',action='store_true');parser.add_argument('--package');parser.add_argument('--package-sha256');parser.add_argument('--expected-installation-sha256');parser.add_argument('--expected-failure-sha256');parser.add_argument('--certificate-thumbprint');parser.add_argument('--observation-directory');parser.add_argument('--approve-channel-observation',action='store_true');parser.add_argument('--approve-preserved-service-stop',action='store_true');a=parser.parse_args()
 if a.minutes is None:a.minutes=20 if a.action=='renew-product-hold-scope' else 60
 try:
  if a.action.startswith('channel-observation-') or a.action=='stop-channel-services':
   require(a.instance and a.observation_directory,'CHANNEL_OPERATION_ARGUMENTS_REQUIRED')
   if a.action!='channel-observation-plan':
    require(a.approve_preserved_service_stop if a.action=='stop-channel-services' else a.approve_channel_observation,
            'CHANNEL_OPERATION_APPROVAL_REQUIRED')
   modules=channel_modules(a.instance);core=sys.modules[__name__];module=modules['product_hold_patch']
   try:
    if a.action=='channel-observation-plan':
     require(a.package and a.not_after,'CHANNEL_OBSERVATION_SOURCE_AND_DEADLINE_REQUIRED')
     result=module.prepare_observation_boot(core,a.instance,a.package,a.observation_directory,datetime.datetime.fromisoformat(a.not_after))
    elif a.action=='channel-observation-apply':result=module.apply_observation_boot(core,a.instance,a.observation_directory,True) or {'state':'OBSERVATION_APPLIED_HOLD_UNCHANGED'}
    elif a.action=='channel-observation-open':result=module.launch_observation_boot(core,a.instance,a.observation_directory,True)
    elif a.action=='channel-observation-restore':result=module.restore_observation_boot(core,a.instance,a.observation_directory,True) or {'state':'OBSERVATION_RESTORED_NO_SERVICES'}
    else:
     require(a.not_after and a.expected_installation_sha256 and a.expected_failure_sha256,'CHANNEL_STOP_PINS_AND_DEADLINE_REQUIRED')
     result=modules['product_user_session'].stop_preserving_channel_hold(core,a.instance,a.observation_directory,a.not_after,
          a.expected_installation_sha256,a.expected_failure_sha256,True)
   except RuntimeError as error:
    code=str(error);raise InstallError(code if re.fullmatch('[A-Z][A-Z0-9_]{0,100}',code) else 'CHANNEL_OPERATION_UNCONFIRMED') from None
   result={**result,'status':result.get('state','CHANNEL_OBSERVATION_STAGED_NOT_APPLIED')}
  elif a.action=='verify':verify_package();result={'status':'PACKAGE_VERIFIED_NOT_INSTALLED'}
  elif a.action=='install':
   require(a.config is not None,'CONFIGURATION_REQUIRED');configuration=read(a.config)
   if a.interactive:
    configuration=interactive_configuration(configuration)
    if configuration is None:print('설치를 취소했습니다. 새 환경을 만들지 않았습니다.');return
    result=install(configuration,True,True)
   else:result=install(configuration,a.approve_install,a.approve_current_user_certificate)
  elif a.action=='complete-certificate-install':
   require(all([a.instance,a.package,a.package_sha256,a.expected_installation_sha256,a.expected_failure_sha256,a.certificate_thumbprint,a.not_after]),'CERTIFICATE_COMPLETION_ARGUMENTS_REQUIRED')
   result=complete_certificate_install(a.instance,a.package,a.package_sha256,a.expected_installation_sha256,a.expected_failure_sha256,a.certificate_thumbprint,a.not_after,approve=a.approve_install and a.approve_current_user_certificate)
  elif a.action=='connect':
   require(a.instance is not None,'INSTALLATION_PATH_REQUIRED')
   approved=a.approve_launch
   if a.interactive:
    print('이 새 설치의 전용 Chrome을 열고 Windows 연결을 등록합니다. 기존 프로필과 서비스는 변경하지 않습니다.')
    print('등록은 현재 사용자에 한정됩니다. 이번 실행 상한은 '+str(a.minutes)+'분이며 자동 연장하지 않습니다.')
    print('서비스 시작은 제품 화면에서 직접 누릅니다. 서비스·집중 시작/종료를 이 명령이 자동 수행하지 않습니다.' if a.user_session else '서비스 기동·종료·재기동 확인만 허용하며 집중은 잠근 상태로 유지합니다.')
    approved=input('동의하면 CONNECT를 입력하세요: ').strip()=='CONNECT'
   result=connect_product(a.instance,a.minutes,approved,a.not_after,a.user_session)
   if not a.json:
    if result.get('existingExtensionLoadRequired') is not False:
     print('새 전용 Chrome에서 압축해제된 확장 프로그램 로드로 아래 폴더를 선택하세요:')
     print(result['extensionDirectory'])
    else:print('기존 전용 설치의 확장과 데이터를 유지했습니다. 확장을 재설치하지 마세요.')
    print('로드 후 같은 창의 주소창에서 아래 제품 연결 화면을 여세요:')
    print(result['productPage'])
    print('FOCURVE 사용 영역의 서비스 시작을 한 번 누르세요. 정상 종료 완료 전까지 이 제어 탭을 열어 두세요.' if a.user_session else '서비스 기동·종료·재기동 확인을 한 번 누르고 완료될 때까지 창을 열어 두세요.')
    print('실행 종료 시각(UTC): '+result['notAfterUTC'])
  elif a.action=='renew-product-hold-scope':
   require(a.instance is not None,'INSTALLATION_PATH_REQUIRED');approved=a.approve_hold_recovery
   if a.interactive:
    print('같은 전용 Chrome과 기존 회원·기록을 유지하는 새로운 제한 실행 승인을 등록합니다.')
    print('기존 기한은 연장하지 않습니다. 서비스·인증·집중을 실행하거나 HOLD를 해제하지 않습니다.')
    print('상한은 '+str(a.minutes)+'분입니다. 이전 실패·미해소 의무가 있으면 거절합니다.')
    approved=input('이 범위에 동의하면 HOLD-SCOPE를 입력하세요: ').strip()=='HOLD-SCOPE'
    if not approved:print('실행 승인을 취소했습니다. 기존 설치와 서비스는 변경하지 않았습니다.');return
   result=product_hold_scope(a.instance,a.minutes,approved,a.not_after)
   if not a.json:
    print('확장 재설치·재로드는 필요 없습니다. 기존 제품 연결 탭을 Ctrl+Shift+R로 새로고침하세요.')
    print(result['productPage']);print('보존된 중단 상태 안전 확인을 한 번 누르고 완료 안내까지 탭을 열어 두세요.')
    print('이번 실행 종료 시각: '+datetime.datetime.fromisoformat(result['notAfterUTC']).astimezone().strftime('%Y-%m-%d %H:%M:%S %Z'))
  elif a.action in ['recover-hold-plan','recover-hold']:
   require(a.instance is not None,'INSTALLATION_PATH_REQUIRED');h,n=recovery_modules();runtime=n.WindowsRuntime(sys.modules[__name__])
   if a.action=='recover-hold-plan':result=recover_hold(a.instance,runtime=runtime,plan=True)
   else:
    require(a.approve_hold_recovery and a.not_after and a.recovery_id and a.expected_hold_sha256,'SCOPED_RECOVERY_APPROVAL_REQUIRED')
    target=read(pathlib.Path(a.instance)/'installation.json')
    grant=h.Grant(a.recovery_id,target['id'],a.expected_hold_sha256,datetime.datetime.now(datetime.timezone.utc).isoformat(),a.not_after,runtime.owner_id(),True)
    result=recover_hold(a.instance,grant,runtime)
  elif a.action=='start':
   require(a.instance is not None,'INSTALLATION_PATH_REQUIRED');result=start(a.instance,a.minutes,a.approve_launch,a.not_after);display(result,a.json)
   instance=pathlib.Path(a.instance);deadline=datetime.datetime.fromisoformat(result['deadlineUTC'])
   while datetime.datetime.now(datetime.timezone.utc)<deadline and not (instance/'STOP').exists():
    current=read(instance/'installation.json')
    if current.get('launchId')!=result['launchId'] or current['status']!='RUNNING':return
    time.sleep(1)
   if read(instance/'installation.json').get('launchId')!=result['launchId']:return
   result=stop(instance,result['launchId'])
  elif a.action=='stop':require(a.instance is not None,'INSTALLATION_PATH_REQUIRED');result=stop(a.instance)
  else:require(a.instance is not None,'INSTALLATION_PATH_REQUIRED');result=product_status(a.instance)
  display(result,a.json)
 except Exception as e:
  code=str(e) if isinstance(e,InstallError) else 'INSTALLATION_OPERATION_UNCONFIRMED'
  messages={'PORT_IN_USE_NO_AUTOMATIC_PORT_CHANGE':'선택한 포트를 다른 프로그램이 사용 중이에요. 기존 프로그램을 종료하지 않았습니다. 설치 전에 다른 고정 포트를 선택해 주세요.','PORT_COLLISION':'웹과 DB 포트가 같아요. 서로 다른 고정 포트를 지정해 주세요.','RUNTIME_NOT_FOUND':'필요한 Java·MySQL·Chrome 실행 파일을 찾지 못했어요. 설정 파일의 경로를 확인해 주세요.','CLOSE_PREVIOUS_DEDICATED_BROWSER_FIRST':'이 설치의 전용 Chrome 창이 아직 열려 있어요. 이전 정상 종료 결과를 확인하고 전용 창만 닫아 주세요.','CURRENT_USER_SECRET_UNAVAILABLE':'현재 Windows 사용자로 설치 비밀을 열 수 없어요. 다른 사용자 자료를 복사하지 마세요.','RAM_BELOW_3_GIB_NO_BROWSER_START':'사용 가능한 메모리가 3GiB 미만이라 새 Chrome을 열지 않았어요. 실행 상태와 기록을 보존했습니다.'}
  messages.update({'REGULAR_CHROME_NOT_FOUND_NO_AUTOMATIC_DOWNLOAD':'일반 Google Chrome 프로그램이 필요해요. 기존 프로필을 가져오거나 브라우저 정책을 바꾸지 않고 설치를 중단했습니다.','REGULAR_CHROME_PRODUCT_REQUIRED':'일반 사용자 모드에는 정식 Google Chrome이 필요해요. 시험용 Chrome으로 자동 전환하지 않습니다.','INTERACTIVE_EXTENSION_INSTALL_APPROVAL_REQUIRED':'최초 실행은 설치 폴더의 Start-FOCURVE.cmd 창에서 확장 로드 승인을 직접 진행해야 해요. 현재 준비 상태는 보존했습니다.','USER_EXTENSION_INSTALL_TIME_LIMIT':'최초 확장 설치 승인을 제한 시간 안에 확인하지 못했어요. 새 창과 설치 기록을 보존했습니다.','LAUNCH_DEADLINE_NO_EXTENSION':'이번 실행 기한이 끝나 후속 기동을 중단했어요. 자동으로 시간을 연장하지 않습니다.'})
  messages['GMAIL_FULL_ADDRESS_USERNAME_REQUIRED']='Gmail 로그인 이름에는 FOCURVE 같은 표시 이름이 아니라 전체 Gmail 주소를 입력해야 해요. 아직 설치하거나 비밀번호를 받지 않았습니다.'
  message=messages.get(code,'작업 결과를 확인하지 못했습니다. 재실행하거나 데이터를 삭제하지 말고 설치 기록을 보존해 주세요.')
  if a.json:print(json.dumps({'status':'HOLD_PRESERVE_DATA','error':code,'message':message},ensure_ascii=False))
  else:print(message);print('지원 문의용 코드: '+code)
  sys.exit(1)
if __name__=='__main__':main()
