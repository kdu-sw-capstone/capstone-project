"""Explicit isolated owning-checker adapter. No default checker/CI activation.
Caller must pin tooling manifest SHA out-of-band. A PASS grants no exception authority.
"""
import sys
sys.dont_write_bytecode = True
import argparse, ast, hashlib, importlib.util, io, json, os, pathlib, subprocess, unittest, zipfile
SOURCE_COMMIT = 'bcf9cc129c718c6d2df73141d06137ae91be11e6'
SOURCE_TREE = '709d19a87ebf7cf727dd8ca1bbdd0a527fcf76f7'
PROFILE = 'integration111-checkout-proposal'
TOOL_PATH = 'contracts/additional-mvp/rc1/compatibility-candidate'
OWNER = 'contracts/additional-mvp/rc1/tests/test_contract.py'
class CheckoutRejected(ValueError): pass
def need(ok, code):
    if not ok: raise CheckoutRejected(code)
def sha(value): return hashlib.sha256(value).hexdigest()
def plain(p):
    need(not any(x.is_symlink() or (hasattr(x,'is_junction') and x.is_junction()) for x in [p,*p.parents]),'CHECKOUT_PATH_ALIAS')
def git(root,*args):
    return subprocess.check_output(['git','--no-optional-locks','-c','core.longpaths=true','-C',str(root),*args],stderr=subprocess.PIPE)
def verify_tooling(package, expected):
    raw=(package/'tooling-manifest.json').read_bytes()
    need(sha(raw)==expected,'EXTERNAL_TOOLING_PIN_MISMATCH')
    data=json.loads(raw);need(data['sourceCommit']==SOURCE_COMMIT and data['sourceTree']==SOURCE_TREE,'TOOLING_SOURCE_BINDING')
    expected_files=set(data['files'])|{'tooling-manifest.json'}
    actual=set()
    for p in package.rglob('*'):
        plain(p)
        if p.is_file():actual.add(p.relative_to(package).as_posix())
    need(actual==expected_files,'TOOLING_FILE_SET_CHANGED')
    for path,h in data['files'].items():need(sha((package/path).read_bytes())==h,'TOOLING_BYTES_CHANGED')
    return data,raw

def exact_revision(root,expected,reviewed_binding=None,reviewed_binding_sha=None):
    head=git(root,'rev-parse','HEAD').decode().strip()
    if head==SOURCE_COMMIT:
        need(reviewed_binding is None and reviewed_binding_sha is None,'UNEXPECTED_FOLLOWUP_BINDING')
        need(git(root,'rev-parse','HEAD^{tree}').decode().strip()==SOURCE_TREE,'SOURCE_TREE_CHANGED')
        return head
    # A verifier-only successor cannot approve itself or inherit its parent approval.
    # The operator must supply an independently reviewed receipt and its SHA externally.
    need(reviewed_binding is not None and reviewed_binding_sha is not None,'NEW_HEAD_NOT_APPROVED')
    raw=pathlib.Path(reviewed_binding).read_bytes();need(sha(raw)==reviewed_binding_sha,'FOLLOWUP_EXTERNAL_PIN_MISMATCH')
    b=json.loads(raw)
    need(set(b)=={'kind','sourceCommit','sourceTree','verificationCommit','verificationTree','parents','toolingManifestSHA256','reviewReference'},'FOLLOWUP_BINDING_SCHEMA')
    need(b['kind']=='EXTERNALLY_REVIEWED_EXACT_CHECKER_COMMIT' and b['sourceCommit']==SOURCE_COMMIT and b['sourceTree']==SOURCE_TREE and b['toolingManifestSHA256']==expected,'FOLLOWUP_SOURCE_BINDING')
    need(b['verificationCommit']==head and isinstance(b['parents'],list) and len(b['parents'])==1 and all(isinstance(x,str) and len(x)==40 for x in b['parents']) and isinstance(b['reviewReference'],str) and bool(b['reviewReference']),'FOLLOWUP_EXACT_REVISION_REQUIRED')
    commit=git(root,'cat-file','-p',head).decode().splitlines()
    need([line.split()[1] for line in commit if line.startswith('parent ')]==b['parents'],'FOLLOWUP_PARENT_CHANGED')
    need(subprocess.run(['git','--no-optional-locks','-C',str(root),'merge-base','--is-ancestor',SOURCE_COMMIT,head],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0,'SOURCE_ANCESTRY_MISMATCH')
    need(next(line.split()[1] for line in commit if line.startswith('tree '))==b['verificationTree'],'FOLLOWUP_TREE_CHANGED')
    return head

def checkout_snapshot(root,package,expected,profile,reviewed_binding=None,reviewed_binding_sha=None):
    need(profile==PROFILE,'EXPLICIT_CURRENT_PROFILE_REQUIRED');root=pathlib.Path(root).resolve();plain(root)
    tools,raw=verify_tooling(package,expected)
    need(package.resolve()==root/TOOL_PATH,'CHECKOUT_TOOL_LOCATION_CHANGED')
    exact_revision(root,expected,reviewed_binding,reviewed_binding_sha)
    need(subprocess.run(['git','--no-optional-locks','-C',str(root),'diff','--cached','--quiet','HEAD','--'],stdout=subprocess.DEVNULL).returncode==0,'STAGED_CHANGES_REJECTED')
    # Git's tracked EOL classification, not arbitrary binary normalization.
    endings={}
    for record in git(root,'ls-files','--eol','-z').split(b'\0'):
        if record:
            attrs,path=record.split(b'\t',1);endings[path.decode()]=attrs.split()[0]
    archive=zipfile.ZipFile(io.BytesIO(git(root,'archive','--format=zip',SOURCE_COMMIT)))
    originals={i.filename:archive.read(i.filename) for i in archive.infolist() if not i.is_dir()}
    overlay={TOOL_PATH+'/'+p for p in tools['files']}|{TOOL_PATH+'/tooling-manifest.json'}
    actual=set()
    for folder,dirs,files in os.walk(root,followlinks=False):
        dirs[:]=[d for d in dirs if not (pathlib.Path(folder)==root and d=='.git')]
        for d in dirs:plain(pathlib.Path(folder)/d)
        for name in files:
            p=pathlib.Path(folder)/name;plain(p);actual.add(p.relative_to(root).as_posix())
    need(actual==set(originals)|overlay,'CHECKOUT_FILE_SET_CHANGED')
    frozen={}
    for path,original in originals.items():
        value=(root/path).read_bytes()
        if endings.get(path) in (b'i/lf',b'i/crlf',b'i/mixed'):
            value=value.replace(b'\r\n',b'\n');original=original.replace(b'\r\n',b'\n')
        need(value==original,'CHECKOUT_BYTES_CHANGED:'+path);frozen[path]=value
    fingerprint=sha(json.dumps({p:sha(v) for p,v in sorted(frozen.items())},sort_keys=True).encode()+raw)
    return frozen,fingerprint

def verify_current(root,package,expected,profile,reviewed_binding=None,reviewed_binding_sha=None,contract_suite=False):
    frozen,before=checkout_snapshot(root,package,expected,profile,reviewed_binding,reviewed_binding_sha)
    # No candidate module executes before operator-pinned tool verification.
    spec=importlib.util.spec_from_file_location('explicit_legacy_candidate',package/'legacy_compatibility_candidate.py')
    candidate=importlib.util.module_from_spec(spec);spec.loader.exec_module(candidate)
    v=candidate.CandidateVerifier(package);p=v.profile(profile,SOURCE_COMMIT)
    # Exact immutable commit/parent provenance, plus the separately checked live checkout.
    need(v.verify_repo(root,commit=SOURCE_COMMIT,profile=profile)['candidateVerification']=='PASS','PROFILE_VERIFICATION_FAILED')
    if contract_suite:
        suite_spec=importlib.util.spec_from_file_location('pinned_contract_suite',package/'ci_contract_suite.py')
        suite_module=importlib.util.module_from_spec(suite_spec);suite_spec.loader.exec_module(suite_module)
        report=suite_module.run_frozen_contract_suite(root,frozen,v)
        _after,after=checkout_snapshot(root,package,expected,profile,reviewed_binding,reviewed_binding_sha)
        need(before==after,'CHECKOUT_CHANGED_DURING_VERIFICATION')
        return {'verification':'PASS_ISOLATED_ONLY','sourceCommit':SOURCE_COMMIT,'sourceTree':SOURCE_TREE,'contractSuite':report,'toolingManifestSHA256':expected,'activation':False,'approval':'NOT_GRANTED','productAcceptance':'NOT_RUN'}
    # Reuse the owning original functions/tests as written; only this explicit entry
    # delegates exact accepted bytes after whole-checkout verification. No skip/fallback.
    tree=ast.parse(frozen[OWNER]);wanted={'CREATE_ADDITIONS','load','legacy_bytes_preserved'};nodes=[];methods=[]
    for node in tree.body:
        if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='CREATE_ADDITIONS' for t in node.targets):nodes.append(node)
        elif isinstance(node,ast.FunctionDef) and node.name in wanted:nodes.append(node)
        elif isinstance(node,ast.ClassDef) and node.name=='SchemaTests':
            methods=[n for n in node.body if isinstance(n,ast.FunctionDef) and n.name in {'test_legacy_bytes_preserved','test_legacy_create_allowlist_is_exact','test_revision_manifest'}]
    need(len(methods)==3,'OWNING_TEST_SET_CHANGED')
    ns={'hashlib':hashlib,'json':json,'P':pathlib.Path(root)/'contracts/additional-mvp/rc1','ROOT':pathlib.Path(root),'unittest':unittest}
    exec(compile(ast.Module(body=nodes,type_ignores=[]),OWNER,'exec'),ns);original=ns['legacy_bytes_preserved']
    allowed=set(v.policy['integrationPaths'])
    def exact_bridge(name,content,locked_sha):
        if original(name,content,locked_sha):return True
        return name in allowed and v.lock['files'].get(name)==locked_sha and content.replace(b'\r\n',b'\n')==frozen[name].replace(b'\r\n',b'\n')
    ns['legacy_bytes_preserved']=exact_bridge
    klass=ast.ClassDef(name='ExplicitOwningTests',bases=[ast.Attribute(value=ast.Name(id='unittest',ctx=ast.Load()),attr='TestCase',ctx=ast.Load())],keywords=[],body=methods,decorator_list=[])
    module=ast.fix_missing_locations(ast.Module(body=[klass],type_ignores=[]));exec(compile(module,OWNER,'exec'),ns)
    stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ns['ExplicitOwningTests']))
    need(result.wasSuccessful(),'OWNING_TEST_FAILURE:'+stream.getvalue())
    after_frozen,after=checkout_snapshot(root,package,expected,profile,reviewed_binding,reviewed_binding_sha);need(before==after,'CHECKOUT_CHANGED_DURING_VERIFICATION')
    return {'verification':'PASS_ISOLATED_ONLY','sourceCommit':SOURCE_COMMIT,'sourceTree':SOURCE_TREE,'profile':profile,'checkoutFingerprint':before,'restoredOriginalFiles':17,'ownerTests':result.testsRun,'ownerLog':stream.getvalue(),'toolingManifestSHA256':expected,'activation':False,'approval':'NOT_GRANTED','productAcceptance':'NOT_RUN'}
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--repo',required=True);a.add_argument('--profile',required=True);a.add_argument('--expected-tooling-manifest-sha256',required=True);a.add_argument('--reviewed-binding');a.add_argument('--reviewed-binding-sha256');a.add_argument('--contract-suite',action='store_true');args=a.parse_args()
    try:print(json.dumps(verify_current(pathlib.Path(args.repo),pathlib.Path(__file__).resolve().parent,args.expected_tooling_manifest_sha256,args.profile,args.reviewed_binding,args.reviewed_binding_sha256,args.contract_suite),indent=2))
    except Exception as e:print(json.dumps({'verification':'REJECTED','reason':str(e),'contractSuite':getattr(e,'report',None),'activation':False}));sys.exit(1)
