"""Temporary Git repositories and dummy outputs only; never product builds/install."""
import contextlib,hashlib,importlib.util,io,json,pathlib,re,shutil,subprocess,sys,tempfile,types,unittest,zipfile
from unittest.mock import patch

# Immutable legacy fixture from the merged integration, not moving HEAD.
# Embedded so shallow CI checkouts do not need historical Git objects.
LEGACY_SOURCE_SHA='e3a3760d43ef0f410beda5b296eb4cd85241638f'
LEGACY_SOURCE_TREE='36c595d83782388301686e8eb14814bd223f8de5'
LEGACY_SOURCE_SHA256='0a14a313c60c2087ef034da242b183e2248d31dd3c381e722a3359b24f1f6325'
LEGACY_GENERATOR_SOURCE=r'''"""Package built sources only. Never installs, trusts certificates or starts services.

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
'''

SCRIPT=pathlib.Path(__file__).resolve().parents[1]/'package-integrated-candidate.py'
spec=importlib.util.spec_from_file_location('candidate',SCRIPT)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ProvenanceTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.root=pathlib.Path(self.temp.name)/'source';self.root.mkdir()
  self.git('init','-q');self.git('config','user.name','Synthetic Fixture');self.git('config','user.email','fixture@example.invalid')
  (self.root/'source.txt').write_text('approved',encoding='utf-8')
  (self.root/'.gitignore').write_text('frontend/dist/\nruntime-server/target/\n',encoding='utf-8')
  for name in ['distribution/config.example.json','frontend/src/input.ts','runtime-server/src/Input.java','extension/scripts/input.js']:
   p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}',encoding='utf-8')
  self.git('add','.');self.git('commit','-qm','synthetic source')
  self.sha=self.git('rev-parse','HEAD');self.tree=self.git('rev-parse','HEAD^{tree}')
  self.identity={'sourceGitSHA':self.sha,'sourceGitTree':self.tree}
  self.outputs=['frontend/dist/index.html','frontend/dist/assets/main.js','runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar']
  for name in self.outputs:
   p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'dummy-not-product')
  self.receipt=pathlib.Path(self.temp.name)/'receipt.json'
  self.value={'contract':'FOCURVE_BUILD_OUTPUTS_1',**self.identity,'files':[{'source':name,'sha256':m.sha(self.root/name)} for name in self.outputs]}
  self.save_receipt()
 def git(self,*args):return subprocess.check_output(['git','-C',str(self.root),*args],stderr=subprocess.PIPE).decode().strip()
 def save_receipt(self):self.receipt.write_text(json.dumps(self.value),encoding='utf-8')
 def test_approved_sha_tree_and_exact_outputs(self):
  self.assertEqual(m.source_identity(self.root,self.sha,self.tree),self.identity)
  self.assertEqual(m.build_receipt(self.root,self.receipt,self.identity),self.value)
 def test_wrong_sha_tree_or_missing_input(self):
  for sha,tree in [('0'*40,self.tree),(self.sha,'0'*40),('',self.tree),('HEAD',self.tree)]:
   with self.subTest(sha=sha,tree=tree),self.assertRaises(SystemExit):m.source_identity(self.root,sha,tree)
 def test_dirty_tracked_staged_and_untracked(self):
  f=self.root/'source.txt';f.write_text('dirty',encoding='utf-8')
  with self.assertRaisesRegex(SystemExit,'DIRTY'):m.source_identity(self.root,self.sha,self.tree)
  self.git('add','source.txt')
  with self.assertRaisesRegex(SystemExit,'DIRTY'):m.source_identity(self.root,self.sha,self.tree)
  self.git('restore','--staged','source.txt');f.write_text('approved',encoding='utf-8')
  (self.root/'unexpected').write_text('dirty',encoding='utf-8')
  with self.assertRaisesRegex(SystemExit,'DIRTY'):m.source_identity(self.root,self.sha,self.tree)
 def test_receipt_from_other_source_rejected(self):
  self.value['sourceGitSHA']='0'*40;self.save_receipt()
  with self.assertRaisesRegex(SystemExit,'BUILD_SOURCE'):m.build_receipt(self.root,self.receipt,self.identity)
 def test_changed_missing_or_extra_output_rejected(self):
  f=self.root/self.outputs[0];f.write_bytes(b'changed')
  with self.assertRaisesRegex(SystemExit,'OUTPUT_MISMATCH'):m.build_receipt(self.root,self.receipt,self.identity)
  f.write_bytes(b'dummy-not-product');extra=self.root/'frontend/dist/extra';extra.write_bytes(b'extra')
  with self.assertRaisesRegex(SystemExit,'OUTPUT_MISMATCH'):m.build_receipt(self.root,self.receipt,self.identity)
  extra.unlink();f.unlink()
  with self.assertRaisesRegex(SystemExit,'SCOPE'):m.build_receipt(self.root,self.receipt,self.identity)
 def test_duplicate_receipt_rows_rejected(self):
  self.value['files'].append(self.value['files'][0]);self.save_receipt()
  with self.assertRaisesRegex(SystemExit,'OUTPUT_MISMATCH'):m.build_receipt(self.root,self.receipt,self.identity)
 def package(self):
  p=pathlib.Path(self.temp.name)/'package';p.mkdir()
  (p/'BUILD-INPUT-RECEIPT.json').write_bytes(self.receipt.read_bytes())
  m.write(p/'BUILD-PROVENANCE.json',{'baseGitSHA':self.sha,'sourceGitTree':self.tree,'buildReceiptSHA256':m.sha(self.receipt)})
  m.write(p/'SOURCE-BUILD-MANIFEST.json',self.identity)
  files,inputs=m.source_inventory(self.root)
  for row in files:
   target=p/row['package'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((self.root/row['source']).read_bytes())
  m.write(p/'SOURCE-BUILD-MANIFEST.json',{**self.identity,'files':files,'buildInputs':inputs})
  return p
 def test_package_binding_and_manifest_hash(self):
  p=self.package();self.assertEqual(m.verify_provenance(p,self.root),self.identity)
  manifest={'files':[{'path':f.relative_to(p).as_posix(),'sha256':m.sha(f)} for f in p.rglob('*') if f.is_file()]}
  for row in manifest['files']:self.assertEqual(m.sha(p/row['path']),row['sha256'])
  value={**self.identity,'sourceGitTree':'0'*40};m.write(p/'SOURCE-BUILD-MANIFEST.json',value)
  with self.assertRaisesRegex(SystemExit,'BINDING'):m.verify_provenance(p,self.root)
 def test_package_receipt_tampering_rejected(self):
  p=self.package();(p/'BUILD-INPUT-RECEIPT.json').write_text('{}',encoding='utf-8')
  with self.assertRaisesRegex(SystemExit,'BINDING'):m.verify_provenance(p,self.root)
 def test_synthetic_packaging_old_sha_failure_then_new_binding_and_cancel(self):
  # No compiler, product build, installation or real runtime binary is executed.
  repository=SCRIPT.parents[1]
  shutil.copytree(repository/'distribution/installer',self.root/'distribution/installer',ignore=shutil.ignore_patterns('__pycache__'))
  for folder in ['distribution/launch','distribution/docs','distribution/native','scripts']:(self.root/folder).mkdir(parents=True,exist_ok=True)
  (self.root/'distribution/native/NativeLinkHost.cs').write_text('dummy',encoding='utf-8')
  (self.root/'distribution/config.example.json').write_text('{}',encoding='utf-8')
  for name in re.findall("'app/extension/([^']+)'",SCRIPT.read_text(encoding='utf-8')):
   p=self.root/'extension'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}' if name.endswith('.json') else 'dummy',encoding='utf-8')
  for name in ['manifest.json','native-link/probe.js','native-link/hold.js','native-link/client.js','native-link/ui.js','native-link/theme.js']:
   p=self.root/'extension'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('dummy',encoding='utf-8')
  (self.root/'extension/preserved-end-context.json').write_text('{"contract":"PRESERVED_END_DISABLED_1"}',encoding='utf-8')
  shutil.copyfile(SCRIPT,self.root/'scripts/package-integrated-candidate.py')
  web=self.root/'frontend/dist';(web/'index.html').write_text('<script src="/assets/main.js"></script>',encoding='utf-8')
  (web/'assets/main.js').write_text('cgepjnmlhilhabjfmneplddlhmconpjb NR01_1,DP01_1,ND01_1',encoding='utf-8')
  sys.path.insert(0,str(SCRIPT.parent));self.addCleanup(lambda:sys.path.remove(str(SCRIPT.parent)))
  import build_user_web
  build_user_web.write_build_contract(web)
  with zipfile.ZipFile(self.root/self.outputs[-1],'w') as jar:jar.writestr('BOOT-INF/classes/kr/ac/kdu/focurve/PreservedEndScope.class',b'dummy')
  self.git('add','.');self.git('commit','-qm','synthetic packaging inputs')
  self.sha=self.git('rev-parse','HEAD');self.tree=self.git('rev-parse','HEAD^{tree}');self.identity={'sourceGitSHA':self.sha,'sourceGitTree':self.tree}
  files=[p for p in web.rglob('*') if p.is_file()]+[self.root/self.outputs[-1]]
  self.value={'contract':'FOCURVE_BUILD_OUTPUTS_1',**self.identity,'files':[{'source':p.relative_to(self.root).as_posix(),'sha256':m.sha(p)} for p in files]};self.save_receipt()
  runtime=pathlib.Path(self.temp.name)/'runtime'
  for name in ['java.exe','javac.exe']:
   p=runtime/'vendor/java/bin'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'dummy')
  m.write(runtime/'MANIFEST.json',{'files':[{'path':p.relative_to(runtime).as_posix(),'sha256':m.sha(p)} for p in runtime.rglob('*') if p.is_file()]})
  def compile_dummy(java,source,target,log):target.write_bytes(bytes.fromhex('cafebabe')+b'productHoldSafety');log.write_bytes(b'');return 0
  helper=types.SimpleNamespace(compile_helper=compile_dummy)
  self.assertEqual(hashlib.sha256(LEGACY_GENERATOR_SOURCE.encode('utf-8')).hexdigest(),LEGACY_SOURCE_SHA256)
  old_text=LEGACY_GENERATOR_SOURCE
  old=types.ModuleType('old_candidate')
  old.__file__=str(SCRIPT);exec(compile(old_text,str(SCRIPT),'exec'),old.__dict__)
  for builder,label in [(old,'before'),(m,'after')]:
   out=pathlib.Path(self.temp.name)/label
   argv=['candidate','--runtime-package',str(runtime),'--output',str(out)]
   if label=='after':argv+=['--approved-source-sha',self.sha,'--approved-source-tree',self.tree,'--build-receipt',str(self.receipt)]
   with patch.object(builder,'ROOT',self.root),patch.object(sys,'argv',argv),patch.dict(sys.modules,{'product_hold_patch':helper}),contextlib.redirect_stdout(io.StringIO()):builder.main()
   provenance=json.loads((out/'BUILD-PROVENANCE.json').read_text(encoding='utf-8'))
   if label=='before':self.assertNotEqual(provenance['baseGitSHA'],self.sha)
   else:
    self.assertEqual(provenance['baseGitSHA'],self.sha);self.assertEqual(provenance['sourceGitTree'],self.tree)
    verify=SCRIPT.parent/'verify-integrated-package.py';ns={'__name__':'synthetic_verifier','__file__':str(self.root/'scripts/verify-integrated-package.py')}
    exec(compile(verify.read_text(encoding='utf-8'),str(verify),'exec'),ns)
    with patch.object(sys,'argv',['verify',str(out)]),contextlib.redirect_stdout(io.StringIO()) as capture:ns['main']()
    result=json.loads(capture.getvalue());self.assertEqual(result['cancelledInstallCLIDryRun'],'PASS_NO_INSTALL_CALLED');self.assertFalse(result['actualInstallation'])
    # Original independent P2: only delivered ZIP manifest changes; directory stays trusted.
    archive=out.parent/(out.name+'.zip')
    with zipfile.ZipFile(archive) as z:entries=[(name,z.read(name)) for name in z.namelist()]
    with zipfile.ZipFile(archive,'w') as z:
     for name,data in entries:z.writestr(name,b'{}' if name=='MANIFEST.json' else data)
    with patch.object(sys,'argv',['verify',str(out)]),self.assertRaisesRegex(SystemExit,'ARCHIVE_MANIFEST_MISMATCH'):ns['main']()

class CompletenessTests(unittest.TestCase):
 setUp=ProvenanceTests.setUp
 git=ProvenanceTests.git
 save_receipt=ProvenanceTests.save_receipt
 package=ProvenanceTests.package
 # Keep the original nine tests separate; this class runs only new cases.
 def tamper(self,change):
  package=self.package();path=package/'SOURCE-BUILD-MANIFEST.json'
  value=json.loads(path.read_text(encoding='utf-8'));change(value);m.write(path,value)
  provenance=package/'BUILD-PROVENANCE.json';data=json.loads(provenance.read_text(encoding='utf-8'));data['sourceBuildManifestSHA256']=m.sha(path);m.write(provenance,data)
  with self.assertRaisesRegex(SystemExit,'INVENTORY_MISMATCH'):m.verify_provenance(package,self.root)
 def test_empty_inventory_previous_failure(self):self.tamper(lambda v:v.update(files=[],buildInputs=[]))
 def test_missing_source(self):self.tamper(lambda v:v['files'].pop())
 def test_missing_build_input(self):self.tamper(lambda v:v['buildInputs'].pop())
 def test_duplicate_source(self):self.tamper(lambda v:v['files'].append(dict(v['files'][0])))
 def test_extra_source(self):self.tamper(lambda v:v['files'].append({'source':'source.txt','package':'extra.txt','sha256':m.sha(self.root/'source.txt')}))
 def test_same_hash_different_source_mapping(self):self.tamper(lambda v:v['files'][0].update(source='source.txt'))
 def test_path_normalization_alias(self):self.tamper(lambda v:v['files'][0].update(package='./'+v['files'][0]['package']))
 def test_same_content_other_origin(self):self.tamper(lambda v:v['buildInputs'][0].update(source='extension/scripts/input.js'))


class ArchiveManifestTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)/'dummy';self.root.mkdir()
  spec=importlib.util.spec_from_file_location('archive_verifier',SCRIPT.parent/'verify-integrated-package.py');self.v=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.v)
  self.data=b'dummy-not-product';self.manifest={'version':'fixture','count':1,'files':[{'path':'payload/file','bytes':len(self.data),'sha256':hashlib.sha256(self.data).hexdigest()}]}
  m.write(self.root/'MANIFEST.json',self.manifest);self.raw=(self.root/'MANIFEST.json').read_bytes();self.archive=self.root.parent/(self.root.name+'.zip')
 def zip(self,raw=None,extra=(),data=None):
  import warnings
  with warnings.catch_warnings():
   warnings.simplefilter('ignore',UserWarning)
   with zipfile.ZipFile(self.archive,'w') as z:
    z.writestr('MANIFEST.json',self.raw if raw is None else raw);z.writestr('payload/file',self.data if data is None else data)
    for name,value in extra:z.writestr(name,value)
 def test_normal_manifest_and_complete_zip(self):
  self.zip();self.assertEqual(self.v.verify_archive(self.root,self.manifest),{'MANIFEST.json','payload/file'})
 def test_changed_manifest_fields_or_missing_fields_rejected(self):
  for value in [{},{'version':'fixture'},{**self.manifest,'version':'different'},{**self.manifest,'files':[]},{**self.manifest,'extra':True}]:
   with self.subTest(value=value):
    self.zip(json.dumps(value).encode())
    with self.assertRaisesRegex(SystemExit,'ARCHIVE_MANIFEST_MISMATCH'):self.v.verify_archive(self.root,self.manifest)
 def test_duplicate_manifest_or_payload_rejected(self):
  for name,data in [('MANIFEST.json',self.raw),('payload/file',self.data)]:
   with self.subTest(name=name):
    self.zip(extra=[(name,data)])
    with self.assertRaisesRegex(SystemExit,'ARCHIVE_DUPLICATE_PATH'):self.v.verify_archive(self.root,self.manifest)
 def test_path_aliases_rejected(self):
  for alias in ['./payload/file','payload/../payload/file','payload\\file','PAYLOAD/file','payload/file.']:
   with self.subTest(alias=alias):
    self.zip(extra=[(alias,self.data)])
    with self.assertRaises(SystemExit):self.v.verify_archive(self.root,self.manifest)
 def test_recalculated_zip_hash_does_not_authorize_tampering(self):
  self.zip(data=b'altered');self.assertEqual(len(m.sha(self.archive)),64)
  with self.assertRaisesRegex(SystemExit,'ARCHIVE_HASH_MISMATCH'):self.v.verify_archive(self.root,self.manifest)
 def test_external_manifest_structure_must_be_valid(self):
  for value in [{k:v for k,v in self.manifest.items() if k!='count'},{**self.manifest,'count':2}]:
   with self.subTest(value=value):
    m.write(self.root/'MANIFEST.json',value);self.zip((self.root/'MANIFEST.json').read_bytes())
    with self.assertRaisesRegex(SystemExit,'MANIFEST_STRUCTURE_INVALID'):self.v.verify_archive(self.root,value)
 def test_duplicate_manifest_json_keys_rejected(self):
  raw=self.raw.replace(b'"version": "fixture"',b'"version": "fixture", "version": "fixture"');self.assertNotEqual(raw,self.raw)
  (self.root/'MANIFEST.json').write_bytes(raw);self.zip(raw)
  with self.assertRaisesRegex(SystemExit,'MANIFEST_DUPLICATE_KEY'):self.v.verify_archive(self.root,self.manifest)

if __name__=='__main__':unittest.main()
