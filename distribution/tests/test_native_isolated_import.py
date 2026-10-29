import hashlib,json,pathlib,subprocess,sys,tempfile,unittest

SOURCE=pathlib.Path(__file__).resolve().parents[1]/'installer'
class NativeIsolatedImportTests(unittest.TestCase):
 def check_case(self,case):
  with tempfile.TemporaryDirectory() as temporary:
   root=pathlib.Path(temporary);folder=root/'control/installer';folder.mkdir(parents=True);rows=[]
   for name in ['product_runtime','hold_recovery','product_hold_recovery','product_hold_patch']:
    p=folder/(name+'.py');p.write_bytes((SOURCE/p.name).read_bytes());rows.append({'path':'control/installer/'+p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
   (root/'record.json').write_text(json.dumps({'payload':rows}),encoding='utf8')
   script="""import importlib.util,pathlib,json,sys,types
source,root,case=map(str,sys.argv[1:]);root=pathlib.Path(root)
spec=importlib.util.spec_from_file_location('isolated_native_test',pathlib.Path(source)/'native_setup.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
record=json.loads((root/'record.json').read_text())
if case=='tampered':(root/'control/installer/product_hold_patch.py').write_text('# changed')
if case=='foreign':sys.modules['product_hold_patch']=types.SimpleNamespace(__file__=str(root/'other.py'))
before=list(sys.path)
try:
 result=m.native_compiler(root,record)
 assert case=='valid' and callable(result)
except RuntimeError as error:
 assert case!='valid'
 assert str(error)==('NATIVE_COMPILER_SOURCE_UNCONFIRMED' if case=='tampered' else 'NATIVE_COMPILER_MODULE_SCOPE_MISMATCH')
assert sys.path==before
print('PASS_'+case)
"""
   q=subprocess.run([sys.executable,'-I','-B','-c',script,str(SOURCE),str(root),case],capture_output=True,text=True,timeout=20)
   self.assertEqual(q.returncode,0,q.stderr);self.assertIn('PASS_'+case,q.stdout)
 def test_isolated_python_loads_only_pinned_sibling_modules(self):self.check_case('valid')
 def test_foreign_cached_module_is_rejected(self):self.check_case('foreign')
 def test_changed_compiler_module_is_rejected(self):self.check_case('tampered')
