"""Replay eleven Core/Content review counterexamples against an immutable prior Git object.
No checkout, installed browser, DB or product code mutation. Failures are expected evidence.
"""
import argparse,json,os,subprocess,sys,uuid
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('--baseline',default='bf62f1520ac06e5d507c54b8f06d93fdd4553ef3');a=p.parse_args()
    if a.baseline!='bf62f1520ac06e5d507c54b8f06d93fdd4553ef3':raise SystemExit('Only the reviewed baseline is supported')
    root=Path(__file__).resolve().parents[4];package=Path(__file__).resolve().parents[1]
    dest=root/'.local'/('review-before-'+uuid.uuid4().hex)/'rc1';(dest/'tests').mkdir(parents=True)
    for rel in ['schema.json','api.json','examples.json','wire-fixtures.json','tests/reference_model.py','tests/test_contract.py']:
        source='contracts/additional-mvp/rc1/'+rel
        blob=subprocess.run(['git','show',a.baseline+':'+source],cwd=root,capture_output=True,check=True).stdout
        (dest/rel).write_bytes(blob)
    (dest/'tests/test_core_review.py').write_bytes((package/'tests/test_core_review.py').read_bytes())
    (dest/'tests/test_content_review.py').write_bytes((package/'tests/test_content_review.py').read_bytes())
    harness='''import json,unittest,test_contract,test_core_review,test_content_review
def flatten(s):
 for t in s:
  if isinstance(t,unittest.TestSuite):yield from flatten(t)
  else:yield t.id()
suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(test_core_review.CoreCounterexamples),unittest.defaultTestLoader.loadTestsFromTestCase(test_content_review.ContentCounterexamples)])
result=unittest.TextTestRunner(verbosity=2).run(suite)
report={'run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'unexpected_success':result.wasSuccessful(),'cases':[{'id':t.id(),'result':'FAIL'} for t,_ in result.failures]+[{'id':t.id(),'result':'ERROR'} for t,_ in result.errors],'baseline_135_ids':list(flatten(unittest.defaultTestLoader.loadTestsFromModule(test_contract)))}
open('result.json','w',encoding='utf8').write(json.dumps(report,indent=2))
'''
    env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
    r=subprocess.run([sys.executable,'-c',harness],cwd=dest/'tests',capture_output=True,encoding='utf8',env=env)
    (dest/'before.log').write_text(r.stdout+r.stderr,encoding='utf8')
    if r.returncode:raise SystemExit('Replay harness failed; inspect private log')
    report=json.loads((dest/'tests/result.json').read_text('utf8'))
    if (report['run'],report['failures'],report['errors'])!=(11,10,1) or len(report['baseline_135_ids'])!=135:
        raise SystemExit('Baseline counterexample results changed; inspect evidence')
    (root/'.local/core-review-before-result.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('Baseline bf62f15 reproduced: 11 cases -> 10 FAIL + 1 ERROR (expected defects, not PASS); original regression IDs135 recorded.')
if __name__=='__main__':main()
