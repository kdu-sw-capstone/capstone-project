"""Exact frozen owning suite; invoked only after trusted launcher authorization.
No skip, fallback PASS, original lock change or GitHub result publication.
"""
import hashlib,importlib.util,io,pathlib,sys,unittest

class ContractSuiteRejected(ValueError):
 def __init__(self,report):
  super().__init__("CONTRACT_SUITE_NOT_FULL_PASS");self.report=report

def need(value,code):
 if not value:raise ValueError(code)

def exact_bridge(original,allowed,locked,frozen):
 def check(name,content,locked_sha):
  if original(name,content,locked_sha):return True
  return name in allowed and locked.get(name)==locked_sha and name in frozen and content.replace(b'\r\n',b'\n')==frozen[name].replace(b'\r\n',b'\n')
 return check

def run_frozen_contract_suite(root,frozen,verifier):
 root=pathlib.Path(root);prefix='contracts/additional-mvp/rc1/tests/';paths=sorted(p for p in frozen if p.startswith(prefix) and p[len(prefix):].startswith('test') and p.endswith('.py') and '/' not in p[len(prefix):])
 need(paths,'EMPTY_CONTRACT_SUITE')
 all_tests=[p for p in frozen if p.startswith(prefix) and pathlib.PurePosixPath(p).name.startswith('test') and p.endswith('.py')]
 need(set(paths)==set(all_tests),'UNSUPPORTED_NESTED_TEST_MODULE')
 # The trusted outer launcher already pins ALL tooling and checks the entire checkout.
 # Never load tests from a caller-supplied alternate path or silently drop a module.
 previous=list(sys.path);loaded={};suite=unittest.TestSuite();ids=[]
 try:
  sys.path.insert(0,str(root/prefix))
  for path in paths:
   name=pathlib.PurePosixPath(path).stem
   need(name not in sys.modules,'PRELOADED_CONTRACT_MODULE')
   spec=importlib.util.spec_from_file_location(name,root/path);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;loaded[name]=module
   need((root/path).read_bytes().replace(b'\r\n',b'\n')==frozen[path].replace(b'\r\n',b'\n'),'CONTRACT_BYTES_CHANGED')
   exec(compile(frozen[path],str(root/path),'exec'),module.__dict__)
   if name=='test_contract':
    module.legacy_bytes_preserved=exact_bridge(module.legacy_bytes_preserved,set(verifier.policy['integrationPaths']),verifier.lock['files'],frozen)
   selected=unittest.defaultTestLoader.loadTestsFromModule(module)
   need(selected.countTestCases()>0,'EMPTY_CONTRACT_MODULE');suite.addTests(selected)
  def collect(t):
   if isinstance(t,unittest.TestSuite):
    for item in t:collect(item)
   else:ids.append(t.id())
  collect(suite);need(len(ids)==len(set(ids)),'DUPLICATE_TEST_ID')
  stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
  need(result.testsRun==len(ids),'CONTRACT_TESTS_NOT_EXECUTED')
  if not (result.wasSuccessful() and not result.skipped and not result.expectedFailures and not result.unexpectedSuccesses):
   raise ContractSuiteRejected({'tests':result.testsRun,'fail':len(result.failures),'error':len(result.errors),'skip':len(result.skipped),'expectedFailures':len(result.expectedFailures),'log':stream.getvalue()})
  return {'tests':result.testsRun,'fail':0,'error':0,'skip':0,'testIDs':ids,'log':stream.getvalue(),'mode':'FULL_ORIGINAL_CONTRACT_SUITE_EXACT_INVERSE_BRIDGE'}
 finally:
  sys.path[:]=previous
  for name,module in loaded.items():
   if sys.modules.get(name) is module:del sys.modules[name]
