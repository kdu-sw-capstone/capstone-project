import sys
sys.dont_write_bytecode=True
import unittest,copy,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import launcher as l
from test_trust import fixture
class EnvironmentPolicyTests(unittest.TestCase):
 def setup_values(self):return {'name':'legacy-checker-review','protection_rules':[],'deployment_branch_policy':{'protected_branches':False,'custom_branch_policies':True}},[{'id':1,'name':'develop','type':'branch'}]
 def test_exact_branch_without_admin_execution_reviewer(self):
  env,rules=self.setup_values();self.assertTrue(l.exact_develop_environment(env,rules))
 def test_protected_only_is_not_a_substitute(self):
  env,rules=self.setup_values();env['deployment_branch_policy']={'protected_branches':True,'custom_branch_policies':False};self.assertFalse(l.exact_develop_environment(env,rules))
 def test_no_restriction_or_wrong_mode_denies(self):
  for mode in [None,{}, {'protected_branches':False,'custom_branch_policies':False},{'protected_branches':0,'custom_branch_policies':True},{'protected_branches':False,'custom_branch_policies':1}]:
   env,rules=self.setup_values();env['deployment_branch_policy']=mode;self.assertFalse(l.exact_develop_environment(env,rules))
 def test_tag_named_develop_is_denied(self):
  env,rules=self.setup_values();rules[0]['type']='tag';self.assertFalse(l.exact_develop_environment(env,rules))
 def test_wildcard_other_refs_and_names_denied(self):
  for name in ['develop*','*','refs/heads/develop','refs/tags/develop','refs/pull/109/merge','main','Develop','develop/','']:
   with self.subTest(name=name):
    env,rules=self.setup_values();rules[0]['name']=name;self.assertFalse(l.exact_develop_environment(env,rules))
 def test_extra_branch_or_tag_and_empty_rules_denied(self):
  for rules in [[],[{'type':'branch','name':'develop'},{'type':'branch','name':'main'}],[{'type':'branch','name':'develop'},{'type':'tag','name':'develop'}]]:
   env,_=self.setup_values();self.assertFalse(l.exact_develop_environment(env,rules))
 def test_wrong_environment_and_rule_shape_denied(self):
  env,rules=self.setup_values();env['name']='other';self.assertFalse(l.exact_develop_environment(env,rules));env,rules=self.setup_values()
  for rules in [None,{},[{}],[True],[{'name':'develop'}]]:self.assertFalse(l.exact_develop_environment(env,rules))
 def test_live_policy_endpoint_read_required(self):
  api=l.GitHub('SYNTHETIC_NOT_A_TOKEN');seen=[]
  def get(path):seen.append(path);return {'total_count':1,'branch_policies':[{'name':'develop','type':'branch'}]}
  api.get=get;rows=api.environment_branches('legacy-checker-review');self.assertEqual(rows,[{'name':'develop','type':'branch'}]);self.assertEqual(seen,['environments/legacy-checker-review/deployment-branch-policies?per_page=100&page=1'])
 def test_missing_or_incomplete_policy_response_denied(self):
  for data in [{},{'total_count':True,'branch_policies':[]},{'total_count':2,'branch_policies':[{'name':'develop','type':'branch'}]}]:
   api=l.GitHub('SYNTHETIC');api.get=lambda path,d=data:d
   with self.assertRaises(l.Rejected):api.environment_branches('legacy-checker-review')
 def test_forbidden_query_never_falls_back_to_protected_only(self):
  api=l.GitHub('SYNTHETIC')
  def get(path):raise PermissionError('403 synthetic')
  api.get=get
  with self.assertRaises(PermissionError):api.environment_branches('legacy-checker-review')
 def test_one_nonauthor_review_and_admin_pin_guards_remain(self):
  r,t,f=fixture();f['control_reviews']=f['control_reviews'][:1];r['review_groups']={'core':[30]};l.authorize(r,t,f)
  for kind in ['author-alias','stale','admin-missing','root-disabled','environment-unconfirmed']:
   with self.subTest(kind=kind):
    rr,tt,ff=copy.deepcopy((r,t,f))
    if kind=='author-alias':rr['review_groups']['core']=[51];ff['control_reviews'][0]['user']['id']=51
    if kind=='stale':ff['control_reviews'][0]['commit_id']='0'*40
    if kind=='admin-missing':ff['administrator_ids']=[]
    if kind=='root-disabled':rr['enabled']=False
    if kind=='environment-unconfirmed':ff['environment_verified']=False
    with self.assertRaises(l.Rejected):l.authorize(rr,tt,ff)
if __name__=='__main__':unittest.main(verbosity=2)
