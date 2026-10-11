"""Isolated MV3 transport experiment; generated fixture, no product code or real YouTube DOM."""
from pathlib import Path
import argparse, json, platform, tempfile, sys

ROOT = Path(__file__).resolve().parents[1]

class ExperimentFailure(Exception):
    def __init__(self, check, completed, response_keys=None):
        self.details={'failedCheck':check,'checks':list(completed),'passed':len(completed)}
        if response_keys is not None:self.details['responseKeys']=response_keys

def policy_blocked():
    if sys.platform == 'win32':
        import winreg
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for vendor in ('Google\\Chrome', 'Chromium'):
                try:
                    with winreg.OpenKey(hive, 'Software\\Policies\\'+vendor+'\\ExtensionInstallBlocklist') as key:
                        i=0
                        while True:
                            try:
                                _, value, _ = winreg.EnumValue(key,i); i+=1
                                if value == '*': return True
                            except OSError: break
                except OSError: pass
    elif sys.platform.startswith('linux'):
        for base in ('/etc/chromium/policies/managed','/etc/opt/chrome/policies/managed'):
            for path in Path(base).glob('*.json'):
                if '*' in json.loads(path.read_text()).get('ExtensionInstallBlocklist',[]): return True
    else:
        return True  # Policy discovery not implemented outside Windows/Linux.
    return False

def build_fixture(folder):
    folder.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'manifest.json').read_text())
    manifest['name']='FOCURVE isolated sender authorization experiment'
    (folder/'manifest.json').write_text(json.dumps(manifest))
    (folder/'popup.html').write_text('<!doctype html><title>Isolated controller</title>')
    policy=(ROOT/'tests/sender-policy-candidate.mjs').read_text().replace('export function','function')
    (folder/'policy.js').write_text(policy)
    (folder/'receiver.js').write_text('''
if (!globalThis.senderTest) {
 globalThis.senderTest={instance:crypto.randomUUID(),binding:null};
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.probe!=='AUTH_EXPERIMENT')return;
  reply({accepted:acceptsWorker(sender,chrome.runtime)&&matchesBinding(message.binding,globalThis.senderTest.binding),
   effects:0,instance:globalThis.senderTest.instance,
   sender:{sameExtension:sender.id===chrome.runtime.id,exactWorkerURL:sender.url===chrome.runtime.getURL('worker.js'),
    exactPopupURL:sender.url===chrome.runtime.getURL('popup.html'),hasTab:Object.hasOwn(sender,'tab')}});
 });
}
''')
    (folder/'worker.js').write_text('''
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m?.probe!=='AUTH_EXPERIMENT_ROUTE')return;
 // The isolated controller is an extension TAB, not an action popup.
 // Only this fixture's exact controller URL can trigger routing. No product change.
 if(s.id!==chrome.runtime.id||s.url!==chrome.runtime.getURL('popup.html')){reply({denied:true,effects:0});return;}
 chrome.tabs.sendMessage(m.tabId,{probe:'AUTH_EXPERIMENT',binding:m.binding},{documentId:m.documentId})
  .then(reply).catch(()=>reply({transportError:true,effects:0}));return true;
});
''')

# All target pages are network-intercepted fixtures at the authorized origin.
# The browser transport is real; YouTube restriction/restoration is NOT tested.
def run(folder, profile, executable=None):
    from playwright.sync_api import sync_playwright
    checks=[]
    with sync_playwright() as pw:
        options=dict(headless=True,args=[f'--disable-extensions-except={folder}',f'--load-extension={folder}'])
        if executable: options['executable_path']=executable
        else: options['channel']='chromium'
        context=pw.chromium.launch_persistent_context(str(profile),**options)
        try:
            context.route('https://www.youtube.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body='<title>Sender fixture</title><p>Fixture only</p><iframe src="/frame"></iframe>' if '/frame' not in route.request.url else '<title>Frame fixture</title>'))
            worker=context.service_workers[0] if context.service_workers else context.wait_for_event('serviceworker',timeout=15000)
            extension_id=worker.url.split('/')[2]
            controller=context.new_page();controller.goto(f'chrome-extension://{extension_id}/popup.html')
            target=context.new_page();target.goto('https://www.youtube.com/fixture')
            target.wait_for_load_state()
            def inject():
                return controller.evaluate('''async()=>{
                 const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url==='https://www.youtube.com/fixture');
                 const frames=await chrome.webNavigation.getAllFrames({tabId:tab.id});const frame=frames.find(f=>f.frameId===0);
                 await chrome.scripting.executeScript({target:{tabId:tab.id,documentIds:[frame.documentId]},files:['policy.js','receiver.js']});
                 const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id,documentIds:[frame.documentId]},func:(ref)=>{
                  globalThis.senderTest.binding={...ref,instance:globalThis.senderTest.instance,active:true};return globalThis.senderTest.binding;
                 },args:[{tabId:tab.id,frameId:0,documentId:frame.documentId}]});return r.result;
                }''')
            def send(binding, target_doc=None, direct=False):
                return controller.evaluate('''async x=>x.direct?
                 chrome.tabs.sendMessage(x.binding.tabId,{probe:'AUTH_EXPERIMENT',binding:x.binding},{documentId:x.doc}):
                 chrome.runtime.sendMessage({probe:'AUTH_EXPERIMENT_ROUTE',tabId:x.binding.tabId,documentId:x.doc,binding:x.binding})''',dict(binding=binding,doc=target_doc or binding['documentId'],direct=direct))
            def receiver_reply(binding, target_doc=None, direct=False):
                reply=send(binding,target_doc,direct)
                if not isinstance(reply,dict) or not isinstance(reply.get('accepted'),bool):
                    keys=sorted(reply.keys()) if isinstance(reply,dict) else []
                    raise ExperimentFailure('receiver verdict missing',checks,keys)
                if reply.get('effects')!=0 or not isinstance(reply.get('sender'),dict):
                    raise ExperimentFailure('receiver evidence malformed',checks,sorted(reply.keys()))
                return reply
            def check(name,condition):
                if not condition: raise ExperimentFailure(name,checks)
                checks.append(name)
            original=inject();reply=receiver_reply(original)
            check('real Worker accepted',reply['accepted'] and reply['sender']['exactWorkerURL'] and reply['effects']==0)
            reply=receiver_reply(original,direct=True)
            check('extension controller at popup URL denied at same receiver',not reply['accepted'] and reply['sender']['exactPopupURL'] and reply['effects']==0)
            for key,value in [('instance','old-instance'),('frameId',1)]:
                changed={**original,key:value};check('mismatch '+key,not receiver_reply(changed)['accepted'])
            again=inject();check('singleton retained',again['instance']==original['instance'])
            content_reply=controller.evaluate('''async b=>{
             const [r]=await chrome.scripting.executeScript({target:{tabId:b.tabId,documentIds:[b.documentId]},func:b=>chrome.runtime.sendMessage({probe:'AUTH_EXPERIMENT_ROUTE',...b,binding:b}),args:[b]});return r.result;
            }''',original)
            check('real Content relay denied',content_reply.get('denied') is True)
            target.reload();target.wait_for_load_state();new=inject()
            check('new document and instance',new['documentId']!=original['documentId'] and new['instance']!=original['instance'])
            check('old document transport rejected',send(original).get('transportError') is True)
            check('old binding denied at new receiver',not receiver_reply(original,target_doc=new['documentId'])['accepted'])
            check('new binding accepted',receiver_reply(new)['accepted'])
            return {'status':'PASS','checks':checks,'passed':len(checks),'browser':context.browser.version,
                'platform':platform.system(),'fixtureDOM':True,'controllerIsExtensionTab':True,'effects':0,
                'notRun':['other-extension external transport','two-tab/iframe full routing','BFCache','Worker stop lifecycle','real YouTube DOM restriction/restoration']}
        finally:context.close()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--prepare-only',action='store_true')
    parser.add_argument('--executable',help='Browser executable in an extension-permitted environment; do not bypass policy')
    args=parser.parse_args()
    if not args.prepare_only and policy_blocked():
        print(json.dumps({'status':'BLOCKED','reason':'managed extension install blocklist','passed':0}));return 2
    with tempfile.TemporaryDirectory(prefix='focurve-sender-mv3-') as temp:
        root=Path(temp);build_fixture(root/'extension')
        if args.prepare_only:
            for filename in ('worker.js','receiver.js','policy.js'):
                import subprocess
                subprocess.run(['node','--check',str(root/'extension'/filename)],check=True)
            print(json.dumps({'status':'PREPARED','mv3Executed':False}));return 0
        try:
            result=run(root/'extension',root/'profile',args.executable)
        except ExperimentFailure as error:
            print(json.dumps({'status':'FAILED','errorType':'ExperimentFailure',**error.details}));return 1
        except Exception as error:
            # No raw browser errors/paths/URLs or credentials in exported report.
            import traceback
            frames=traceback.extract_tb(error.__traceback__)
            location=next((f for f in reversed(frames) if f.filename==__file__),None)
            diagnostic={'status':'FAILED','errorType':type(error).__name__,'passed':0}
            if location:diagnostic.update(line=location.lineno,function=location.name)
            if isinstance(error,KeyError) and error.args[0] in ('accepted','sender','effects','instance','documentId'):
                diagnostic['missingKey']=error.args[0]
            print(json.dumps(diagnostic));return 1
        print(json.dumps(result,ensure_ascii=False));return 0

if __name__=='__main__':raise SystemExit(main())
