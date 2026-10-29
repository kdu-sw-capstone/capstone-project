"""Reproduce three API/document counterexamples on immutable reviewed RC2.
Only private .local files are created. No checkout, profile, external worktree or DB mutation.
"""
import json,os,subprocess,sys,uuid
from pathlib import Path

def main():
    root=Path(__file__).resolve().parents[4];base='8f48c3b8454c74bb1f998a8f4cdacfe65785d037'
    dest=root/'.local'/('server-review-before-'+uuid.uuid4().hex)
    package='contracts/additional-mvp/rc1/'
    for name in [package+'api.json','docs/design/additional-mvp-contracts/02_API_DB.md']:
        p=dest/name;p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(subprocess.run(['git','show',base+':'+name],cwd=root,check=True,capture_output=True).stdout)
    tests=dest/package/'tests';tests.mkdir(parents=True)
    (tests/'test_server_review.py').write_bytes((root/package/'tests/test_server_review.py').read_bytes())
    script="""import unittest,json,test_server_review
s=unittest.defaultTestLoader.loadTestsFromTestCase(test_server_review.ServerCounterexamples)
r=unittest.TextTestRunner(verbosity=2).run(s)
json.dump({'tests':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'skipped':len(r.skipped),'failed_ids':[t.id() for t,_ in r.failures]},open('result.json','w'),indent=2)
"""
    result=subprocess.run([sys.executable,'-c',script],cwd=tests,capture_output=True,text=True,encoding='utf8',env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
    (dest/'before.log').write_text(result.stdout+result.stderr,encoding='utf8')
    if result.returncode:raise SystemExit('Replay harness failure; private evidence retained')
    report=json.loads((tests/'result.json').read_text('utf8'))
    assert (report['tests'],report['failures'],report['errors'],report['skipped'])==(3,3,0,0),report
    (root/'.local/server-review-before-result.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('Reviewed RC2 API/document counterexamples: 3 FAIL reproduced, no skipped acceptance tests. Not product HTTP.')
if __name__=='__main__':main()
