"""Package built sources only. Never installs, trusts certificates or starts services.

Runtime binaries must come from an explicitly supplied previously verified package;
Only vendor/ entries are copied and checked against the public Manifest.
InstallTools is compiled from this checkout with the verified Java 21 toolchain.
The output is a review candidate, never proof of actual Chrome acceptance.
"""
import argparse,datetime,fnmatch,hashlib,json,pathlib,re,shutil,subprocess,sys,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def source_identity(root,expected_sha,expected_tree):
 """Require an exact clean approved checkout, with no fallback to HEAD."""
 def git(*args):
  try:return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.PIPE).decode('utf-8').strip()
  except subprocess.CalledProcessError:raise SystemExit('SOURCE_GIT_UNCONFIRMED') from None
 if not all(re.fullmatch('[0-9a-f]{40}',v or '') for v in [expected_sha,expected_tree]):raise SystemExit('APPROVED_SOURCE_REQUIRED')
 if pathlib.Path(git('rev-parse','--show-toplevel')).resolve()!=root.resolve():raise SystemExit('SOURCE_ROOT_MISMATCH')
 if git('rev-parse','HEAD')!=expected_sha or git('rev-parse','HEAD^{tree}')!=expected_tree:raise SystemExit('APPROVED_SOURCE_MISMATCH')
 if git('status','--porcelain','--untracked-files=all'):raise SystemExit('DIRTY_SOURCE')
 return {'sourceGitSHA':expected_sha,'sourceGitTree':expected_tree}

def build_receipt(root,path,identity):
 """Validate the separately approved build's exact output inventory.
 This binds recorded evidence; it is not a signed attestation of the builder.
 """
 value=json.loads(path.read_text(encoding='utf-8'))
 if value.get('contract')!='FOCURVE_BUILD_OUTPUTS_1' or any(value.get(k)!=v for k,v in identity.items()):raise SystemExit('BUILD_SOURCE_MISMATCH')
 web=root/'frontend/dist';jar=root/'runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar'
 files=[p for p in web.rglob('*') if p.is_file()]+[jar]
 if not (web/'index.html').is_file() or not jar.is_file() or any(p.is_symlink() or not p.resolve().is_relative_to(root.resolve()) for p in files):raise SystemExit('BUILD_OUTPUT_SCOPE_UNCONFIRMED')
 actual={p.relative_to(root).as_posix():sha(p) for p in files}
 rows=value.get('files',[])
 if not isinstance(rows,list) or any(not isinstance(r,dict) or set(r)!={'source','sha256'} for r in rows):raise SystemExit('BUILD_OUTPUT_RECEIPT_INVALID')
 expected={r['source']:r['sha256'] for r in rows}
 if len(expected)!=len(rows) or actual!=expected:raise SystemExit('BUILD_OUTPUT_MISMATCH')
 return value

PACKAGED_FOLDERS=[('frontend/dist','app/web'),('extension','app/extension'),('distribution/installer','installer'),('distribution/native','native'),('distribution/launch','launch'),('distribution/docs','docs')]
EXTENSION_IGNORES=('node_modules','tests','scripts','content-tests','content-tools','.chrome-harness','.gitignore','package*.json','README*.md')

def source_inventory(checkout):
 """Derive completeness from checkout and copy rules, never submitted rows."""
 tracked=set(subprocess.check_output(['git','-C',str(checkout),'ls-files','-z']).decode('utf-8').split('\0'))
 def checked(path,generated=False):
  relative=path.relative_to(checkout).as_posix()
  if path.is_symlink() or not path.resolve().is_relative_to(checkout.resolve()) or (not generated and relative not in tracked):raise SystemExit('SOURCE_INVENTORY_SCOPE_MISMATCH')
  return {'source':relative,'sha256':sha(path)}
 files=[]
 for source,target in PACKAGED_FOLDERS:
  folder=checkout/source
  patterns=EXTENSION_IGNORES if source=='extension' else ('__pycache__','*.pyc') if source=='distribution/installer' else ()
  for path in sorted(folder.rglob('*')):
   parts=path.relative_to(folder).parts
   if any(fnmatch.fnmatch(part,pattern) for part in parts for pattern in patterns):continue
   if path.is_symlink():raise SystemExit('SOURCE_INVENTORY_SCOPE_MISMATCH')
   if path.is_file():files.append({**checked(path,source=='frontend/dist'),'package':(pathlib.PurePosixPath(target)/path.relative_to(folder).as_posix()).as_posix()})
 for source,target,generated in [('runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar','app/server/server.jar',True),('distribution/config.example.json','config.example.json',False)]:
  files.append({**checked(checkout/source,generated),'package':target})
 inputs=[checked(path) for folder in ['frontend/src','runtime-server/src','extension/scripts'] for path in sorted((checkout/folder).rglob('*')) if path.is_file()]
 return files,inputs

def require_inventory(actual,expected):
 if not isinstance(actual,list) or any(not isinstance(row,dict) for row in actual) or sorted(json.dumps(row,sort_keys=True) for row in actual)!=sorted(json.dumps(row,sort_keys=True) for row in expected):raise SystemExit('SOURCE_INVENTORY_MISMATCH')

def verify_provenance(package,checkout):
 provenance=json.loads((package/'BUILD-PROVENANCE.json').read_text(encoding='utf-8'))
 identity=source_identity(checkout,provenance.get('baseGitSHA'),provenance.get('sourceGitTree'))
 parity=json.loads((package/'SOURCE-BUILD-MANIFEST.json').read_text(encoding='utf-8'))
 receipt=package/'BUILD-INPUT-RECEIPT.json'
 if any(parity.get(k)!=v for k,v in identity.items()) or sha(receipt)!=provenance.get('buildReceiptSHA256'):raise SystemExit('PACKAGE_SOURCE_BINDING_MISMATCH')
 build_receipt(checkout,receipt,identity)
 files,inputs=source_inventory(checkout)
 require_inventory(parity.get('files'),files);require_inventory(parity.get('buildInputs'),inputs)
 expected={row['package'] for row in files}
 actual={path.relative_to(package).as_posix() for _,folder in PACKAGED_FOLDERS for path in (package/folder).rglob('*') if path.is_file()}|{'app/server/server.jar','config.example.json'}
 if actual!=expected:raise SystemExit('PACKAGE_INVENTORY_MISMATCH')
 for row in files:
  path=package/row['package']
  if path.is_symlink() or not path.resolve().is_relative_to(package.resolve()) or sha(path)!=row['sha256']:raise SystemExit('SOURCE_PACKAGE_PARITY_CHANGED')
 return identity

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--runtime-package',required=True,type=pathlib.Path);parser.add_argument('--output',required=True,type=pathlib.Path);parser.add_argument('--version',default='0.1.25-integrated-user-lifecycle')
 parser.add_argument('--approved-source-sha',required=True);parser.add_argument('--approved-source-tree',required=True)
 parser.add_argument('--build-receipt',required=True,type=pathlib.Path);args=parser.parse_args()
 identity=source_identity(ROOT,args.approved_source_sha,args.approved_source_tree)
 build_receipt(ROOT,args.build_receipt,identity);receipt_hash=sha(args.build_receipt)
 if not re.fullmatch(r'0\.1\.25-[a-z0-9-]+',args.version):raise SystemExit('INVALID_CANDIDATE_VERSION')
 source=args.runtime_package.resolve();out=args.output.absolute()
 if out.exists():raise SystemExit('OUTPUT_MUST_BE_NEW')
 manifest=json.loads((source/'MANIFEST.json').read_text(encoding='utf-8-sig'));vendor=[r for r in manifest['files'] if r['path'].startswith('vendor/')]
 if not vendor:raise SystemExit('VERIFIED_RUNTIME_MANIFEST_REQUIRED')
 for row in vendor:
  path=source/pathlib.PurePosixPath(row['path'])
  if not path.resolve().is_relative_to(source/'vendor') or path.is_symlink() or sha(path)!=row['sha256']:raise SystemExit('RUNTIME_HASH_OR_SCOPE_MISMATCH')
 for required in [ROOT/'frontend/dist/index.html',ROOT/'runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar']:
  if not required.is_file():raise SystemExit('BUILD_WEB_AND_RUNTIME_SERVER_FIRST')
 web=ROOT/'frontend/dist';entry=(web/'index.html').read_text(encoding='utf-8');asset=re.search(r'src="([^" ]+\.js)"',entry)
 from build_user_web import verify_build_contract
 verify_build_contract(web)
 if asset is None:raise SystemExit('WEB_ENTRY_UNCONFIRMED')
 if 'cgepjnmlhilhabjfmneplddlhmconpjb' not in (web/asset[1].lstrip('/')).read_text(encoding='utf-8'):raise SystemExit('BUILD_WEB_WITH_INSTALLATION_EXTENSION_PLACEHOLDER')
 out.mkdir(parents=True)
 (out/'tools').mkdir()
 compiler='vendor/java/bin/javac.exe'
 if compiler not in {r['path'] for r in vendor}:raise SystemExit('VERIFIED_JAVA_COMPILER_REQUIRED')
 sys.path.insert(0,str(ROOT/'distribution/installer'))
 from product_hold_patch import compile_helper
 if compile_helper(source/'vendor/java/bin/java.exe',ROOT/'distribution/installer/InstallTools.java',out/'tools/InstallTools.class',out/'INSTALL-HELPER-BUILD.log')!=0:raise SystemExit('INSTALL_HELPER_BUILD_FAILED')
 (out/'INSTALL-HELPER-BUILD.log').unlink() # Successful empty compiler output is not shipped.
 write(out/'INSTALL-HELPER-PROVENANCE.json',{'sourceSHA256':sha(ROOT/'distribution/installer/InstallTools.java'),'compilerSHA256':sha(source/compiler),'classSHA256':sha(out/'tools/InstallTools.class'),'javaRelease':21,'copiedFromOldPackage':False})
 shutil.copytree(ROOT/'frontend/dist',out/'app/web')
 shutil.copytree(ROOT/'extension',out/'app/extension',ignore=shutil.ignore_patterns(*EXTENSION_IGNORES))
 (out/'app/server').mkdir();shutil.copyfile(ROOT/'runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar',out/'app/server/server.jar')
 shutil.copytree(ROOT/'distribution/installer',out/'installer',ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
 for name in ['launch','docs']:shutil.copytree(ROOT/'distribution'/name,out/name)
 (out/'native').mkdir();shutil.copyfile(ROOT/'distribution/native/NativeLinkHost.cs',out/'native/NativeLinkHost.cs')
 shutil.copyfile(ROOT/'distribution/config.example.json',out/'config.example.json')
 # Existing launch contracts, not a new background runner or approval extension.
 (out/'Install-FOCURVE.cmd').write_text('@echo off\r\nchcp 65001 >nul\r\necho FOCURVE integrated candidate - actual acceptance pending\r\n"%~dp0vendor\\python\\python.exe" -I -B -X utf8 "%~dp0installer\\install_core.py" install --config "%~dp0config.example.json" --interactive\r\npause\r\n',encoding='ascii')
 for row in vendor:
  target=out/pathlib.PurePosixPath(row['path']);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/pathlib.PurePosixPath(row['path']),target)
  if sha(target)!=row['sha256']:raise SystemExit('COPIED_RUNTIME_HASH_MISMATCH')
 parity=[]
 for source_dir,target_dir in PACKAGED_FOLDERS:
  for target in sorted((out/target_dir).rglob('*')):
   if not target.is_file():continue
   original=ROOT/source_dir/target.relative_to(out/target_dir)
   if not original.is_file() or sha(original)!=sha(target):raise SystemExit('CURRENT_SOURCE_PACKAGE_PARITY_FAILED')
   parity.append({'source':original.relative_to(ROOT).as_posix(),'package':target.relative_to(out).as_posix(),'sha256':sha(target)})
 required_latest={'app/extension/member-ui/runtime.js','app/extension/integration/member-a1-adapter.mjs','app/extension/integration/member-a1-adapter.bundle.js','app/extension/native-link/index.html','app/extension/native-link/session.js','app/extension/integration/same-owner-recovery.js','app/extension/integration/recovery-runtime.js'}
 required_latest.update({'app/extension/integration/preserved-end.js','app/extension/integration/preserved-end-runtime.js','app/extension/native-link/preserved-end.js','app/extension/preserved-end-context.json','app/extension/safety/reader.js'})
 if not required_latest.issubset({r['package'] for r in parity}):raise SystemExit('LATEST_ACCEPTANCE_FIX_NOT_PACKAGED')
 # An unbound package never ships a live existing-session termination grant.
 if json.loads((out/'app/extension/preserved-end-context.json').read_text(encoding='utf8'))!={'contract':'PRESERVED_END_DISABLED_1'}:raise SystemExit('UNBOUND_PACKAGE_CONTAINS_END_AUTHORITY')
 if sha(ROOT/'runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar')!=sha(out/'app/server/server.jar'):raise SystemExit('CURRENT_SERVER_PACKAGE_PARITY_FAILED')
 parity.append({'source':'runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar','package':'app/server/server.jar','sha256':sha(out/'app/server/server.jar')})
 build_inputs=[{'source':p.relative_to(ROOT).as_posix(),'sha256':sha(p)} for folder in ['frontend/src','runtime-server/src','extension/scripts'] for p in sorted((ROOT/folder).rglob('*')) if p.is_file()]
 expected_files,expected_inputs=source_inventory(ROOT)
 parity.append({'source':'distribution/config.example.json','package':'config.example.json','sha256':sha(ROOT/'distribution/config.example.json')})
 require_inventory(parity,expected_files);require_inventory(build_inputs,expected_inputs)
 source_identity(ROOT,args.approved_source_sha,args.approved_source_tree)
 build_receipt(ROOT,args.build_receipt,identity)
 if sha(args.build_receipt)!=receipt_hash:raise SystemExit('BUILD_RECEIPT_CHANGED')
 shutil.copyfile(args.build_receipt,out/'BUILD-INPUT-RECEIPT.json')
 write(out/'SOURCE-BUILD-MANIFEST.json',{'contract':'FOCURVE_SOURCE_PACKAGE_PARITY_1','scope':'UNBOUND_ACCEPTANCE_CANDIDATE_NOT_ACTUAL_INSTALLATION',**identity,'files':parity,'buildInputs':build_inputs,'actualAcceptance':False})
 write(out/'BUILD-PROVENANCE.json',{'version':args.version,'baseGitSHA':identity['sourceGitSHA'],'sourceGitTree':identity['sourceGitTree'],'buildReceiptSHA256':receipt_hash,'sourceBuildManifestSHA256':sha(out/'SOURCE-BUILD-MANIFEST.json'),'runtimeManifestSHA256':sha(source/'MANIFEST.json'),'status':'REVIEW_CANDIDATE_REAL_CHROME_ACCEPTANCE_PENDING','primaryServer':'runtime-server','legacyDevelopServerIncluded':False,'actualInstallationExecuted':False,'physicalAudio':'PENDING','existingProfiles':'NOT_CHANGED','nativeUserMode':'EXPLICIT_BOUNDED_GRANT','normalStoppedRenewal':'IMPLEMENTED_REAL_CHROME_PENDING','HOLDRecovery':False,'productHoldTransitionImplemented':True,'productHoldTransitionActual':'NOT_VERIFIED','helperBuiltFromCurrentSource':True})
 verify_provenance(out,ROOT)
 files=[{'path':p.relative_to(out).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(out.rglob('*')) if p.is_file()]
 write(out/'MANIFEST.json',{'version':args.version,'count':len(files),'files':files})
 archive=out.parent/(out.name+'.zip')
 if archive.exists():raise SystemExit('ARCHIVE_MUST_BE_NEW')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
  for p in sorted(out.rglob('*')):
   if p.is_file():z.write(p,p.relative_to(out).as_posix())
 write(out.parent/'PACKAGE-RESULT.json',{'directory':str(out),'zip':str(archive),'sha256':sha(archive),'files':len(files),'actualAcceptance':False})
 print(json.dumps({'zip':str(archive),'sha256':sha(archive),'files':len(files),'actualAcceptance':False}))
if __name__=='__main__':main()
