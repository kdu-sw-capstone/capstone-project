"""Reproducible unbound installation Web build; no install/services/secrets."""
import hashlib,json,os,pathlib,re,shutil,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
PLACEHOLDER='cgepjnmlhilhabjfmneplddlhmconpjb'
TRANSITIONS='NR01_1,DP01_1,ND01_1'
class BuildContractError(RuntimeError):pass
def need(ok,code):
 if not ok:raise BuildContractError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def entry(dist):
 dist=pathlib.Path(dist).resolve();html=dist/'index.html'
 match=re.search(r'src="([^" ]+\.js)"',html.read_text(encoding='utf-8'))
 need(match is not None,'WEB_ENTRY_UNCONFIRMED')
 asset=dist/match[1].lstrip('/')
 need(asset.resolve().is_relative_to(dist) and asset.is_file(),'WEB_ENTRY_SCOPE_UNCONFIRMED')
 return html,asset
def write_build_contract(dist):
 html,asset=entry(dist);text=asset.read_text(encoding='utf-8')
 need(PLACEHOLDER in text and TRANSITIONS in text,'INSTALLATION_WEB_FLAGS_MISSING')
 result={'contract':'FOCURVE_UNBOUND_WEB_BUILD_1','scope':'UNBOUND_INSTALLATION_TEMPLATE',
         'extensionPlaceholder':PLACEHOLDER,'memberTransitions':TRANSITIONS,'apiOrigin':'SAME_ORIGIN',
         'htmlSHA256':sha(html),'entryAsset':asset.relative_to(html.parent).as_posix(),'entrySHA256':sha(asset)}
 (html.parent/'BUILD-CONTRACT.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
 return result
def verify_build_contract(dist):
 dist=pathlib.Path(dist);file=dist/'BUILD-CONTRACT.json'
 need(file.is_file(),'INSTALLATION_WEB_BUILD_CONTRACT_MISSING')
 value=json.loads(file.read_text(encoding='utf-8'));html,asset=entry(dist)
 need(value.get('contract')=='FOCURVE_UNBOUND_WEB_BUILD_1' and value.get('scope')=='UNBOUND_INSTALLATION_TEMPLATE' and
      value.get('extensionPlaceholder')==PLACEHOLDER and value.get('memberTransitions')==TRANSITIONS and
      value.get('apiOrigin')=='SAME_ORIGIN','INSTALLATION_WEB_BUILD_CONTRACT_MISMATCH')
 need(value.get('htmlSHA256')==sha(html) and value.get('entrySHA256')==sha(asset) and
      value.get('entryAsset')==asset.relative_to(html.parent).as_posix(),'INSTALLATION_WEB_BUILD_CHANGED')
 text=asset.read_text(encoding='utf-8');need(PLACEHOLDER in text and TRANSITIONS in text,'INSTALLATION_WEB_FLAGS_MISSING')
 return value
def main():
 env={k:v for k,v in os.environ.items() if not k.upper().startswith('VITE_') and k.upper()!='NODE_OPTIONS'}
 env.update(VITE_EXTENSION_ID=PLACEHOLDER,VITE_MEMBER_TRANSITION_CONTRACTS=TRANSITIONS,VITE_MAIL_MODE='external')
 npm=shutil.which('npm.cmd' if os.name=='nt' else 'npm');need(npm is not None,'NPM_REQUIRED')
 subprocess.run([npm,'run','build'],cwd=ROOT/'frontend',env=env,check=True,timeout=300)
 result=write_build_contract(ROOT/'frontend/dist');verify_build_contract(ROOT/'frontend/dist')
 print(json.dumps({'status':'INSTALLATION_WEB_BUILD_VERIFIED','contract':result['contract'],'actualInstallation':False}))
if __name__=='__main__':main()
