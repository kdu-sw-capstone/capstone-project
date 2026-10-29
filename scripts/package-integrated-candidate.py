"""Package built sources only. Never installs, trusts certificates or starts services.

Runtime binaries must come from an explicitly supplied previously verified package;
Only vendor/ entries are copied and checked against the public Manifest.
InstallTools is compiled from this checkout with the verified Java 21 toolchain.
The output is a review candidate, never proof of actual Chrome acceptance.
"""
import argparse,datetime,hashlib,json,pathlib,shutil,sys,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--runtime-package',required=True,type=pathlib.Path);parser.add_argument('--output',required=True,type=pathlib.Path);parser.add_argument('--version',default='0.1.25-integrated-user-lifecycle');args=parser.parse_args()
 import re
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
 import re
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
 shutil.copytree(ROOT/'extension',out/'app/extension',ignore=shutil.ignore_patterns('node_modules','tests','scripts','content-tests','content-tools','.chrome-harness','.gitignore','package*.json','README*.md'))
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
 for source_dir,target_dir in [('frontend/dist','app/web'),('extension','app/extension'),('distribution/installer','installer'),('distribution/native','native'),('distribution/launch','launch'),('distribution/docs','docs')]:
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
 write(out/'SOURCE-BUILD-MANIFEST.json',{'contract':'FOCURVE_SOURCE_PACKAGE_PARITY_1','scope':'UNBOUND_ACCEPTANCE_CANDIDATE_NOT_ACTUAL_INSTALLATION','files':parity,'buildInputs':build_inputs,'actualAcceptance':False})
 write(out/'BUILD-PROVENANCE.json',{'version':args.version,'baseGitSHA':'90ad32be5d282f3b44c917a29e156dffc5e29187','sourceBuildManifestSHA256':sha(out/'SOURCE-BUILD-MANIFEST.json'),'runtimeManifestSHA256':sha(source/'MANIFEST.json'),'status':'REVIEW_CANDIDATE_REAL_CHROME_ACCEPTANCE_PENDING','primaryServer':'runtime-server','legacyDevelopServerIncluded':False,'actualInstallationExecuted':False,'physicalAudio':'PENDING','existingProfiles':'NOT_CHANGED','nativeUserMode':'EXPLICIT_BOUNDED_GRANT','normalStoppedRenewal':'IMPLEMENTED_REAL_CHROME_PENDING','HOLDRecovery':False,'productHoldTransitionImplemented':True,'productHoldTransitionActual':'NOT_VERIFIED','helperBuiltFromCurrentSource':True})
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
