"""Replay nine RC2 cross-check counterexamples against immutable 4309b26.
Failure entries include subtests; nine distinct methods, never add counts together.
No checkout, product code, external worktree, profile or database mutation.
"""
from pathlib import Path
import subprocess,sys,os,json,uuid,shutil
root=Path(__file__).resolve().parents[4];pkg=root/'contracts/additional-mvp/rc1';dest=root/'.local'/('rc2-cross-before-'+uuid.uuid4().hex)/'rc1';(dest/'tests').mkdir(parents=True)
for rel in ('schema.json','api.json','examples.json','wire-fixtures.json','content-review-fixtures.json','feature-registry.json','traceability.json','tests/reference_model.py','tests/review_reference.py','tests/test_core_review.py'):
 (dest/rel).write_bytes(subprocess.run(['git','show','4309b2674a26782f4fc318477b38ce10fa2c4bc7:contracts/additional-mvp/rc1/'+rel],check=True,capture_output=True).stdout)
shutil.copyfile(pkg/'tests/test_rc2_cross.py',dest/'tests/test_rc2_cross.py')
script="""import unittest,json,test_rc2_cross
s=unittest.defaultTestLoader.loadTestsFromTestCase(test_rc2_cross.CrossCounterexamples)
r=unittest.TextTestRunner(verbosity=2).run(s)
f=[t.id().split(' (')[0] for t,_ in r.failures]+[t.id().split(' (')[0] for t,_ in r.errors]
json.dump({'baseline':'4309b2674a26782f4fc318477b38ce10fa2c4bc7','tests':r.testsRun,'failure_entries':len(r.failures),'error_entries':len(r.errors),'failing_methods':sorted(set(f)),'subtest_entries_are_not_extra_tests':True},open('result.json','w'),indent=2)
"""
r=subprocess.run([sys.executable,'-c',script],cwd=dest/'tests',capture_output=True,text=True,encoding='utf8',env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'));(dest/'before.log').write_text(r.stdout+r.stderr,encoding='utf8');assert r.returncode==0
report=json.loads((dest/'tests/result.json').read_text('utf8'));assert report['tests']==len(report['failing_methods'])==9,report
(root/'.local/rc2-cross-before-result.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report,indent=2))
