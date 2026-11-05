"""Isolated trusted control launcher. No activation or GitHub writes.
Root policy must be supplied by the independently approved administrative environment,
not from candidate checkout, CLI candidate inputs or generated receipt.
"""
import sys
sys.dont_write_bytecode=True
import argparse,hashlib,json,os,pathlib,subprocess,tempfile,urllib.request
REPO='kdu-sw-capstone/capstone-project'; REPO_ID=1318294980
class Rejected(ValueError):pass
def need(v,code):
 if not v:raise Rejected(code)
def digest(b):return hashlib.sha256(b).hexdigest()
def sha(v):return isinstance(v,str) and len(v)==40 and all(c in '0123456789abcdef' for c in v)
def h64(v):return isinstance(v,str) and len(v)==64 and all(c in '0123456789abcdef' for c in v)
def git(p,*args):return subprocess.check_output(['git','--no-optional-locks','-c','core.longpaths=true','-C',str(p),*args],stderr=subprocess.PIPE)
def principal(root,user):return root['principal_groups'].get(str(user),'user:'+str(user))
def reviews(root,pr,rows,groups,control=False):
 need((pr['state']=='closed' and pr.get('merged') is True) if control else (pr['state']=='open' and not pr.get('merged')),'REVIEW_PR_LIFECYCLE_INVALID')
 need(pr['head']['repo']['id']==REPO_ID,'FOREIGN_HEAD_REPOSITORY')
 author=principal(root,pr['user']['id']);latest={}
 # COMMENTED is not an approval or a dismissal. Preserve prior effective state;
 # DISMISSED / CHANGES_REQUESTED replace it. Never count a prior-head approval.
 for r in sorted(rows,key=lambda r:(r.get('submitted_at') or '',r['id'])):
  if r['state'] in ('APPROVED','DISMISSED','CHANGES_REQUESTED'):latest[r['user']['id']]=r
 need(not any(r['state']=='CHANGES_REQUESTED' for r in latest.values()),'CHANGES_REQUESTED')
 valid={}
 for uid,r in latest.items():
  if r['state']=='APPROVED' and r['commit_id']==pr['head']['sha'] and principal(root,uid)!=author:
   valid[uid]=r
 def choose(n,used):
  if n==len(groups):return True
  for uid in root['review_groups'][groups[n]]:
   person=principal(root,uid)
   if uid in valid and person not in used and choose(n+1,used|{person}):return True
  return False
 need(choose(0,set()),'EXACT_NONAUTHOR_APPROVAL_MISSING')
 return sorted(r['id'] for r in valid.values())
def authorize(root,trust,f):
 need(root.get('enabled') is True and trust.get('enabled') is True,'NOT_ACTIVATED')
 need(root['repository']==trust['repository']==REPO and root['repository_id']==trust['repository_id']==REPO_ID,'REPOSITORY_MISMATCH')
 need(f['workflow_sha']==root['workflow_sha'] and sha(root['workflow_sha']),'CONTROL_WORKFLOW_SHA_MISMATCH')
 need(f['workflow_ref']=='refs/heads/develop' and trust['control_ref']==f['workflow_ref'],'UNTRUSTED_WORKFLOW_REF')
 need(f['actor_id'] in root['operators'],'OPERATOR_NOT_AUTHORIZED')
 need(f['administrator_ids'] and root['admin_id'] in f['administrator_ids'],'ADMINISTRATOR_NOT_CONFIRMED')
 need(f['environment_verified'] is True and f['control_protection_verified'] is True,'CONTROL_TRUST_SETTINGS_UNVERIFIED')
 need(sha(root['control_sha']) and f['control_sha']==root['control_sha'] and f['control_tree']==root['control_tree'],'CONTROL_CHECKOUT_MISMATCH')
 need(f['control_in_develop'] is True,'CONTROL_NOT_IN_PROTECTED_DEVELOP')
 need(trust['candidate_sha'] not in (root['control_sha'],root['workflow_sha']),'CONTROL_CANDIDATE_ROLE_CONFUSION')
 need(trust['base_review']=='CURRENT_BASE_REVIEWED','BASE_REVIEW_REQUIRED')
 need(sha(trust['candidate_sha']) and f['candidate_sha']==trust['candidate_sha'],'CANDIDATE_SHA_MISMATCH')
 need(f['candidate_tree']==trust['candidate_tree'] and f['candidate_parents']==[trust['candidate_parent']],'CANDIDATE_TREE_PARENT_MISMATCH')
 need(f['integration_sha']==trust['candidate_parent']==trust['observed_integration'],'CURRENT_BASE_MISMATCH')
 need(trust['tool_manifest_sha256']==root['tool_manifest_sha256'] and h64(root['tool_manifest_sha256']),'TOOL_PIN_NOT_EXTERNAL')
 need(f['candidate_pr']['number']==trust['candidate_pr'] and f['candidate_pr']['head']['sha']==trust['candidate_sha'] and f['candidate_pr']['base']['sha']==trust['candidate_parent'],'CANDIDATE_PR_BINDING_MISMATCH')
 need(f['control_pr']['number']==root['control_pr'] and f['control_pr']['head']['sha']==root['control_sha'],'CONTROL_PR_BINDING_MISMATCH')
 need(f['candidate_threads_resolved'] and f['control_threads_resolved'],'UNRESOLVED_REVIEW_THREAD')
 candidate=reviews(root,f['candidate_pr'],f['candidate_reviews'],['core'])
 control=reviews(root,f['control_pr'],f['control_reviews'],['core'],control=True)
 return {'candidateReviews':candidate,'controlReviews':control}
def tool_files(candidate,trust):
 root=pathlib.Path(candidate).resolve();package=root/trust['tool_path'];need(package.resolve().is_relative_to(root),'TOOL_PATH_ESCAPE')
 need(not package.is_symlink() and not (hasattr(package,'is_junction') and package.is_junction()),'TOOL_LINK_REJECTED')
 raw=(package/'tooling-manifest.json').read_bytes();need(digest(raw)==trust['tool_manifest_sha256'],'TOOL_MANIFEST_PIN_MISMATCH');m=json.loads(raw)
 expected=set(m['files'])|{'tooling-manifest.json'};actual=set()
 for p in package.rglob('*'):
  need(not p.is_symlink() and not (hasattr(p,'is_junction') and p.is_junction()),'TOOL_LINK_REJECTED')
  if p.is_file():actual.add(p.relative_to(package).as_posix())
 need(actual==expected,'TOOL_FILE_SET_MISMATCH')
 for name,wanted in m['files'].items():
  p=package/name;need(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts,'TOOL_PATH_ESCAPE')
  need(digest(p.read_bytes())==wanted,'TOOL_FILE_HASH_MISMATCH')
 need('explicit_checker.py' in m['files'] and 'legacy_compatibility_candidate.py' in m['files'],'ENTRY_NOT_PINNED')
 return package,m
def bind_checkout(candidate,trust):
 p=pathlib.Path(candidate).resolve()
 need(git(p,'rev-parse','HEAD').decode().strip()==trust['candidate_sha'],'LIVE_HEAD_MISMATCH')
 need(git(p,'rev-parse','HEAD^{tree}').decode().strip()==trust['candidate_tree'],'LIVE_TREE_MISMATCH')
 raw=git(p,'cat-file','-p','HEAD').decode().splitlines();need([x.split()[1] for x in raw if x.startswith('parent ')]==[trust['candidate_parent']],'LIVE_PARENT_MISMATCH')
 need(not git(p,'diff','--name-only','HEAD','--').strip(),'DIRTY_CHECKOUT')
 need(not git(p,'ls-files','--others','--exclude-standard').strip(),'UNTRACKED_CHECKOUT')
 return p
class GitHub:
 def __init__(self,token):self.token=token
 def request(self,path,body=None):
  need(path.startswith('/repos/'+REPO+'/') or path=='/graphql','API_PATH_NOT_ALLOWED')
  data=None if body is None else json.dumps(body).encode()
  req=urllib.request.Request('https://api.github.com'+path,data=data,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'focurve-trusted-legacy-checker'})
  with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)
 def get(self,p):return self.request('/repos/'+REPO+'/'+p)
 def pages(self,p):
  out=[]
  for n in range(1,21):
   data=self.get(p+('' if '?' not in p else '&')+('?' if '?' not in p else '')+f'per_page=100&page={n}')
   need(isinstance(data,list),'API_PAGE_INVALID');out.extend(data)
   if len(data)<100:return out
  raise Rejected('API_PAGE_LIMIT')
 def resolved(self,pr):
  q='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}pageInfo{hasNextPage}}}}}'
  r=self.request('/graphql',{'query':q,'variables':{'owner':'kdu-sw-capstone','name':'capstone-project','number':pr}});need(not r.get('errors'),'REVIEW_API_UNCONFIRMED');t=r['data']['repository']['pullRequest']['reviewThreads'];need(not t['pageInfo']['hasNextPage'],'REVIEW_THREAD_LIMIT');return all(x['isResolved'] for x in t['nodes'])
 def facts(self,root,trust):
  cp=self.get('pulls/'+str(root['control_pr']));p=self.get('pulls/'+str(trust['candidate_pr']));cc=self.get('commits/'+root['control_sha']);c=self.get('commits/'+trust['candidate_sha']);develop=self.get('branches/develop');rules=self.get('rules/branches/develop');env=self.get('environments/'+root['environment_name']);collabs=self.pages('collaborators')
  protections=[x.get('parameters',{}) for x in rules if x['type']=='pull_request'];protected=develop.get('protected') is True and any(x.get('required_approving_review_count',0)>=1 and x.get('dismiss_stale_reviews_on_push') and x.get('required_review_thread_resolution') for x in protections)
  environment=any(x['type']=='required_reviewers' and x.get('prevent_self_review') is True and any(v.get('type')=='User' and v.get('reviewer',{}).get('id')==root['admin_id'] for v in x.get('reviewers',[])) for x in env.get('protection_rules',[]))
  # Exact control HEAD may be merged to develop, but its PR head review remains the source.
  compare=self.get('compare/'+root['control_sha']+'...'+develop['commit']['sha']);in_develop=compare['status'] in ('identical','ahead')
  f={'workflow_sha':os.environ['GITHUB_WORKFLOW_SHA'],'workflow_ref':os.environ['GITHUB_REF'],'actor_id':int(os.environ['GITHUB_ACTOR_ID']),'administrator_ids':[x['id'] for x in collabs if x.get('permissions',{}).get('admin')],'environment_verified':environment and env.get('deployment_branch_policy',{}).get('protected_branches') is True,'control_protection_verified':protected,'control_sha':cc['sha'],'control_tree':cc['commit']['tree']['sha'],'control_in_develop':in_develop,'candidate_sha':c['sha'],'candidate_tree':c['commit']['tree']['sha'],'candidate_parents':[x['sha'] for x in c['parents']],'integration_sha':self.get('branches/integration%2Fadditional-mvp-20261029')['commit']['sha'],'candidate_pr':p,'control_pr':cp,'candidate_reviews':self.pages('pulls/'+str(p['number'])+'/reviews'),'control_reviews':self.pages('pulls/'+str(cp['number'])+'/reviews'),'candidate_threads_resolved':self.resolved(p['number']),'control_threads_resolved':self.resolved(cp['number'])}
  return f
def main():
 a=argparse.ArgumentParser();a.add_argument('--control',required=True);a.add_argument('--candidate',required=True);a.add_argument('--output',required=True);args=a.parse_args()
 control=pathlib.Path(args.control).resolve();candidate=pathlib.Path(args.candidate).resolve();out=pathlib.Path(args.output).resolve();root_path=pathlib.Path(os.environ['LEGACY_EXTERNAL_ROOT']).resolve()
 need(not root_path.is_relative_to(candidate) and not root_path.is_relative_to(control),'ROOT_MUST_BE_EXTERNAL')
 need(not out.is_relative_to(candidate) and not control.is_relative_to(candidate) and not candidate.is_relative_to(control),'OUTPUT_CONTROL_MUST_BE_EXTERNAL')
 raw=root_path.read_bytes();need(digest(raw)==os.environ['LEGACY_EXTERNAL_ROOT_SHA256'],'ROOT_PIN_MISMATCH');root=json.loads(raw)
 # Root is an admin-controlled trust anchor, NOT a candidate-generated approval.
 need(root.get('enabled') is True,'NOT_ACTIVATED')
 need(digest(pathlib.Path(__file__).read_bytes())==root['launcher_sha256'],'LAUNCHER_PIN_MISMATCH')
 tr=(control/'.github/legacy-checker/trust.json').read_bytes();need(digest(tr)==root['trust_sha256'],'TRUST_PIN_MISMATCH');trust=json.loads(tr)
 need(git(control,'rev-parse','HEAD').decode().strip()==root['control_sha'],'CONTROL_LOCAL_SHA_MISMATCH')
 need(git(control,'rev-parse','HEAD^{tree}').decode().strip()==root['control_tree'],'CONTROL_LOCAL_TREE_MISMATCH')
 need(not git(control,'diff','--name-only','HEAD','--').strip(),'CONTROL_DIRTY')
 api=GitHub(os.environ['GITHUB_TOKEN']);facts=api.facts(root,trust);auth=authorize(root,trust,facts);bind_checkout(candidate,trust);package,m=tool_files(candidate,trust)
 # Re-fetch current approvals/base after file validation. Do not execute stale authorization.
 again=api.facts(root,trust);need(authorize(root,trust,again)==auth and facts==again,'AUTHORIZATION_CHANGED_BEFORE_EXEC')
 out.mkdir(parents=True,exist_ok=True)
 receipt={'kind':'EXTERNALLY_REVIEWED_EXACT_CHECKER_COMMIT','sourceCommit':m['sourceCommit'],'sourceTree':m['sourceTree'],'verificationCommit':trust['candidate_sha'],'verificationTree':trust['candidate_tree'],'parents':[trust['candidate_parent']],'toolingManifestSHA256':trust['tool_manifest_sha256'],'reviewReference':json.dumps(auth,sort_keys=True)}
 # No candidate-supplied receipt is accepted. This transient file follows actual GitHub checks.
 with tempfile.TemporaryDirectory(prefix='legacy-receipt-',dir=out) as d:
  p=pathlib.Path(d)/'reviewed-binding.json';p.write_text(json.dumps(receipt,sort_keys=True),encoding='utf-8')
  result=subprocess.run([sys.executable,'-I','-B',str(package/'explicit_checker.py'),'--repo',str(candidate),'--profile',trust['profile'],'--expected-tooling-manifest-sha256',trust['tool_manifest_sha256'],'--reviewed-binding',str(p),'--reviewed-binding-sha256',digest(p.read_bytes())],capture_output=True,timeout=120)
 final=api.facts(root,trust);need(final==again and authorize(root,trust,final)==auth,'AUTHORIZATION_CHANGED_AFTER_EXEC');bind_checkout(candidate,trust);tool_files(candidate,trust)
 need(result.returncode==0,'ISOLATED_CHECKER_REJECTED');parsed=json.loads(result.stdout);need(parsed.get('verification')=='PASS_ISOLATED_ONLY' and parsed.get('approval')=='NOT_GRANTED' and parsed.get('activation') is False,'CHECKER_RESULT_INVALID')
 record={'status':'PASS_TRUSTED_ISOLATED_VERIFICATION_ONLY','controlSHA':root['control_sha'],'workflowSHA':root['workflow_sha'],'candidateSHA':trust['candidate_sha'],'candidateTree':trust['candidate_tree'],'parents':[trust['candidate_parent']],'approvalReviewIDs':auth,'toolingManifestSHA256':trust['tool_manifest_sha256'],'activation':False,'githubResultPublished':False}
 (out/'result.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(json.dumps(record))
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'status':'REJECTED','code':'TRUSTED_VALIDATION_UNCONFIRMED','activation':False}));sys.exit(1)
