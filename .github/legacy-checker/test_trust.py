import sys
sys.dont_write_bytecode=True
import unittest,copy,json,tempfile,pathlib
from unittest.mock import patch
import launcher as l

def fixture():
 r=dict(enabled=True,repository=l.REPO,repository_id=l.REPO_ID,workflow_sha='a'*40,control_sha='b'*40,control_tree='c'*40,operators=[10],admin_id=20,tool_manifest_sha256='d'*64,control_pr=1,review_groups={'core':[30],'trust':[40]},principal_groups={'50':'author','51':'author'})
 t=dict(enabled=True,repository=l.REPO,repository_id=l.REPO_ID,control_ref='refs/heads/develop',base_review='CURRENT_BASE_REVIEWED',candidate_sha='e'*40,candidate_tree='f'*40,candidate_parent='1'*40,observed_integration='1'*40,source_commit='1'*40,tool_manifest_sha256='d'*64,candidate_pr=2)
 def pr(n,sha,control=False):return dict(number=n,state='closed' if control else 'open',merged=control,user={'id':50},head={'sha':sha,'repo':{'id':l.REPO_ID}},base={'sha':'1'*40})
 def review(uid,sha,n):return dict(id=n,user={'id':uid},state='APPROVED',commit_id=sha,submitted_at=str(n))
 f=dict(workflow_sha='a'*40,workflow_ref='refs/heads/develop',actor_id=10,administrator_ids=[20],environment_verified=True,control_protection_verified=True,control_sha='b'*40,control_tree='c'*40,control_in_develop=True,source_in_candidate=True,candidate_sha='e'*40,candidate_tree='f'*40,candidate_parents=['1'*40],integration_sha='1'*40,candidate_pr=pr(2,'e'*40),control_pr=pr(1,'b'*40,True),candidate_reviews=[review(30,'e'*40,1)],control_reviews=[review(30,'b'*40,2),review(40,'b'*40,3)],candidate_threads_resolved=True,control_threads_resolved=True)
 return r,t,f
class Tests(unittest.TestCase):
 def test_positive(self):
  r,t,f=fixture();r['review_groups']={'core':[30]};f['control_reviews']=f['control_reviews'][:1]
  l.authorize(r,t,f)
 def test_control_exact_nonauthor(self):
  for kind in ['missing','stale','dismissed','alias']:
   with self.subTest(kind=kind):
    r,t,f=fixture();f['control_reviews']=f['control_reviews'][:1]
    if kind=='missing':f['control_reviews']=[]
    if kind=='stale':f['control_reviews'][0]['commit_id']='0'*40
    if kind=='dismissed':f['control_reviews'][0]['state']='DISMISSED'
    if kind=='alias':
     r['review_groups']['core']=[51];f['control_reviews'][0]['user']['id']=51
    with self.assertRaises(l.Rejected):l.authorize(r,t,f)
 def test_rejections(self):
  cases=[('missing',lambda r,t,f:f.update(candidate_reviews=[])),('revoked',lambda r,t,f:f['candidate_reviews'][0].update(state='DISMISSED')),('stale',lambda r,t,f:f['candidate_reviews'][0].update(commit_id='0'*40)),('wrong-user',lambda r,t,f:f['candidate_reviews'][0]['user'].update(id=99)),('self-alias',lambda r,t,f:(r['review_groups'].update(core=[51]),f['candidate_reviews'][0]['user'].update(id=51))),('control-mix',lambda r,t,f:t.update(candidate_sha='b'*40)),('workflow',lambda r,t,f:f.update(workflow_sha='0'*40)),('base-drift',lambda r,t,f:f.update(integration_sha='2'*40)),('unprotected',lambda r,t,f:f.update(control_protection_verified=False)),('environment',lambda r,t,f:f.update(environment_verified=False)),('pin',lambda r,t,f:r.update(tool_manifest_sha256='0'*64)),('threads',lambda r,t,f:f.update(candidate_threads_resolved=False)),('author-control',lambda r,t,f:f['control_reviews'][0]['user'].update(id=50)),('unmerged-control',lambda r,t,f:f['control_pr'].update(state='open',merged=False)),('disabled',lambda r,t,f:r.update(enabled=False))]
  for name,mutate in cases:
   with self.subTest(name=name):
    r,t,f=fixture();mutate(r,t,f)
    with self.assertRaises(l.Rejected):l.authorize(r,t,f)
 def test_wrong_checkout(self):
  with patch.object(l,'git',return_value=b'wrong'):
   with self.assertRaises(l.Rejected):l.bind_checkout('.',fixture()[1])
 def test_tool_bytes(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'tool';p.mkdir()
   files={'explicit_checker.py':b'NEVER EXECUTE','legacy_compatibility_candidate.py':b'fixture'}
   for name,data in files.items():(p/name).write_bytes(data)
   raw=json.dumps({'files':{n:l.digest(b) for n,b in files.items()}}).encode();(p/'tooling-manifest.json').write_bytes(raw)
   t={'tool_path':'tool','tool_manifest_sha256':l.digest(raw)}
   l.tool_files(d,t)
   (p/'explicit_checker.py').write_bytes(b'altered')
   with self.assertRaises(l.Rejected):l.tool_files(d,t)
 def test_actual_proposal_disabled(self):
  root={'enabled':False};trust={'enabled':False}
  with self.assertRaises(l.Rejected):l.authorize(root,trust,{})
if __name__=='__main__':unittest.main(verbosity=2)
