"""Temporary Git repositories and dummy outputs only; never product builds/install."""
import contextlib,hashlib,importlib.util,io,json,pathlib,re,shutil,subprocess,sys,tempfile,types,unittest,zipfile
from unittest.mock import patch

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
  old_text=subprocess.check_output(['git','show','HEAD:scripts/package-integrated-candidate.py'],cwd=repository).decode('utf-8')
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


if __name__=='__main__':unittest.main()
