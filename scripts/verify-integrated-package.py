"""Read-only package verification + cancelled CLI dry-run; no install/service calls."""
import argparse,contextlib,hashlib,importlib.util,io,json,pathlib,re,sys,zipfile
def canonical_path(name):
 if not isinstance(name,str) or not name or '\\' in name or ':' in name or any(part in ('','.','..') or part.rstrip(' .')!=part for part in name.split('/')):raise SystemExit('ARCHIVE_PATH_INVALID')
 return name

def unique_object(pairs):
 value={}
 for key,item in pairs:
  if key in value:raise SystemExit('MANIFEST_DUPLICATE_KEY')
  value[key]=item
 return value

def verify_archive(root,manifest):
 """Bind ZIP to the already source-validated directory, including its root manifest."""
 raw=(root/'MANIFEST.json').read_bytes()
 trusted=json.loads(raw.decode('utf-8'),object_pairs_hook=unique_object)
 if trusted!=manifest or set(trusted)!={'version','count','files'} or not isinstance(trusted['version'],str) or type(trusted['count']) is not int or not isinstance(trusted['files'],list) or trusted['count']!=len(trusted['files']):raise SystemExit('MANIFEST_STRUCTURE_INVALID')
 names=[]
 for row in trusted['files']:
  if not isinstance(row,dict) or set(row)!={'path','sha256','bytes'} or not isinstance(row['sha256'],str) or not re.fullmatch('[0-9a-f]{64}',row['sha256']) or type(row['bytes']) is not int or row['bytes']<0:raise SystemExit('MANIFEST_STRUCTURE_INVALID')
  names.append(canonical_path(row['path']))
 expected={'MANIFEST.json',*names}
 if len({name.casefold() for name in expected})!=len(names)+1:raise SystemExit('MANIFEST_PATH_COLLISION')
 archive=root.parent/(root.name+'.zip')
 if not archive.is_file():raise SystemExit('VERSIONED_ARCHIVE_PATH_MISMATCH')
 with zipfile.ZipFile(archive) as z:
  entries=z.infolist();paths=[canonical_path(info.filename) for info in entries]
  if len({name.casefold() for name in paths})!=len(paths):raise SystemExit('ARCHIVE_DUPLICATE_PATH')
  if set(paths)!=expected:raise SystemExit('ARCHIVE_FILE_SET_MISMATCH')
  if z.read('MANIFEST.json')!=raw:raise SystemExit('ARCHIVE_MANIFEST_MISMATCH')
  for row in trusted['files']:
   data=z.read(row['path'])
   if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:raise SystemExit('ARCHIVE_HASH_MISMATCH')
 return expected

def main():
 p=argparse.ArgumentParser();p.add_argument('directory',type=pathlib.Path);a=p.parse_args();root=a.directory.resolve()
 spec=importlib.util.spec_from_file_location('integrated_package_validation',root/'installer/install_core.py');core=importlib.util.module_from_spec(spec);sys.modules[spec.name]=core;spec.loader.exec_module(core)
 manifest=core.verify_package(root)
 from build_user_web import verify_build_contract
 verify_build_contract(root/'app/web')
 required=['tools/InstallTools.class','installer/install_core.py','installer/observe.cjs','installer/certificate.ps1','config.example.json','app/server/server.jar','app/web/index.html','app/extension/manifest.json','installer/native_setup.py','installer/product_runtime.py','installer/product_runtime_entry.py','installer/product_native_protocol.py','installer/product_user_session.py','installer/record_snapshot.py','installer/session_update.py','native/NativeLinkHost.cs','app/extension/native-link/index.html','app/extension/native-link/probe.js','app/extension/native-link/session.js']
 for name in required:
  if not (root/name).is_file():raise SystemExit('INSTALL_REQUIRED_FILE_MISSING: '+name)
 parity_path=root/'SOURCE-BUILD-MANIFEST.json'
 if json.loads((root/'app/extension/preserved-end-context.json').read_text(encoding='utf8'))!={'contract':'PRESERVED_END_DISABLED_1'}:raise SystemExit('UNBOUND_PACKAGE_CONTAINS_END_AUTHORITY')
 for file in ['integration/preserved-end.js','integration/preserved-end-runtime.js','native-link/preserved-end.js']:
  if not (root/'app/extension'/file).is_file():raise SystemExit('PRESERVED_END_PRODUCT_CONNECTION_MISSING')
 with zipfile.ZipFile(root/'app/server/server.jar') as server:
  if 'BOOT-INF/classes/kr/ac/kdu/focurve/PreservedEndScope.class' not in server.namelist():raise SystemExit('PRESERVED_END_SERVER_CLASS_MISSING')
 if not parity_path.is_file():raise SystemExit('SOURCE_BUILD_MANIFEST_REQUIRED')
 parity=json.loads(parity_path.read_text(encoding='utf8'));provenance=json.loads((root/'BUILD-PROVENANCE.json').read_text(encoding='utf8'))
 if parity.get('contract')!='FOCURVE_SOURCE_PACKAGE_PARITY_1' or parity.get('actualAcceptance') is not False or provenance.get('sourceBuildManifestSHA256')!=hashlib.sha256(parity_path.read_bytes()).hexdigest():raise SystemExit('SOURCE_BUILD_MANIFEST_UNCONFIRMED')
 checkout=pathlib.Path(__file__).resolve().parents[1]
 spec=importlib.util.spec_from_file_location('package_provenance',checkout/'scripts/package-integrated-candidate.py')
 binding=importlib.util.module_from_spec(spec);spec.loader.exec_module(binding)
 binding.verify_provenance(root,checkout)
 for row in parity['files']:
  original=(checkout/row['source']).resolve();copied=(root/row['package']).resolve()
  if not original.is_relative_to(checkout) or not copied.is_relative_to(root) or not original.is_file() or not copied.is_file() or hashlib.sha256(original.read_bytes()).hexdigest()!=row['sha256'] or hashlib.sha256(copied.read_bytes()).hexdigest()!=row['sha256']:raise SystemExit('SOURCE_PACKAGE_PARITY_CHANGED')
 for row in parity['buildInputs']:
  original=(checkout/row['source']).resolve()
  if not original.is_relative_to(checkout) or not original.is_file() or hashlib.sha256(original.read_bytes()).hexdigest()!=row['sha256']:raise SystemExit('BUILD_INPUT_CHANGED_AFTER_PACKAGE')
 required.append('app/web/BUILD-CONTRACT.json')
 required.extend(['installer/product_hold_recovery.py','installer/product_hold_patch.py','installer/hold_recovery.py',
                  'app/extension/native-link/hold.js','app/extension/native-link/client.js','app/extension/native-link/ui.js',
                  'app/extension/native-link/theme.js','INSTALL-HELPER-PROVENANCE.json'])
 for name in required:
  if not (root/name).is_file():raise SystemExit('INSTALL_REQUIRED_FILE_MISSING: '+name)
 if (root/'tools/InstallTools.class').read_bytes()[:4]!=bytes.fromhex('cafebabe'):raise SystemExit('INSTALL_HELPER_NOT_JAVA_BYTECODE')
 helper=(root/'tools/InstallTools.class').read_bytes()
 if b'productHoldSafety' not in helper:raise SystemExit('INSTALL_HELPER_PRODUCT_HOLD_MODE_MISSING')
 provenance=json.loads((root/'INSTALL-HELPER-PROVENANCE.json').read_text(encoding='utf8'))
 if provenance.get('classSHA256')!=hashlib.sha256(helper).hexdigest() or provenance.get('javaRelease')!=21:raise SystemExit('INSTALL_HELPER_PROVENANCE_MISMATCH')
 cmd=(root/'Install-FOCURVE.cmd').read_text(encoding='ascii')
 if 'install --config "%~dp0config.example.json" --interactive' not in cmd:raise SystemExit('INSTALL_COMMAND_CONFIGURATION_MISSING')
 # Use the same arguments, but return cancellation before the install function.
 core.interactive_configuration=lambda config:None
 core.install=lambda *args,**kwargs:(_ for _ in ()).throw(AssertionError('INSTALL_MUST_NOT_RUN'))
 original=sys.argv;output=io.StringIO()
 try:
  sys.argv=['install_core.py','install','--config',str(root/'config.example.json'),'--interactive']
  with contextlib.redirect_stdout(output):core.main()
 finally:sys.argv=original
 if '설치를 취소했습니다' not in output.getvalue():raise SystemExit('CANCELLED_CLI_DRY_RUN_FAILED')
 archive=root.parent/(root.name+'.zip')
 expected=verify_archive(root,manifest)
 print(json.dumps({'manifestFilesVerified':len(manifest['files']),'archiveFilesVerified':len(expected),'sourcePackageFilesVerified':len(parity['files']),'buildInputsVerified':len(parity['buildInputs']),'versionedArchiveName':archive.name,'cancelledInstallCLIDryRun':'PASS_NO_INSTALL_CALLED','installRequiredFilesVerified':len(required),'installHelperBytecode':'PASS','actualInstallation':False,'servicesStarted':False,'archiveSHA256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
if __name__=='__main__':main()
