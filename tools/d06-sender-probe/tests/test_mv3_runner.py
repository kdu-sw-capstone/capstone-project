"""Generated fixture routing regression; mocked Chrome metadata, NOT actual MV3."""
import importlib.util, json, subprocess, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('sender_runner',Path(__file__).with_name('mv3_runner.py'))
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class ControllerRouting(unittest.TestCase):
    def route(self,sender,old=False):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);runner.build_fixture(folder)
            source=(folder/'worker.js').read_text()
            if old:source=source.replace("s.url!==chrome.runtime.getURL('popup.html'))", "s.url!==chrome.runtime.getURL('popup.html')||s.tab)")
            script='''const vm=require('node:vm');let listener,sends=0;
const runtime={id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,onMessage:{addListener:f=>listener=f}};
vm.runInNewContext(INPUT.source,{chrome:{runtime,tabs:{sendMessage:async()=>{sends++;return {accepted:true,effects:0};}}}});
new Promise(resolve=>listener({probe:'AUTH_EXPERIMENT_ROUTE',tabId:1,documentId:'doc',binding:{}},INPUT.sender,resolve))
.then(reply=>process.stdout.write(JSON.stringify({reply,sends})));'''
            script='const INPUT='+json.dumps(dict(source=source,sender=sender))+';'+script
            result=subprocess.run(['node','-e',script],capture_output=True,text=True,check=True)
            return json.loads(result.stdout)
    def test_controller_tab_previously_denied_and_now_routes(self):
        sender=dict(id='fixture',url='chrome-extension://fixture/popup.html',tab=dict(id=10))
        old=self.route(sender,True);self.assertEqual(old['sends'],0);self.assertTrue(old['reply']['denied'])
        fixed=self.route(sender);self.assertEqual(fixed['sends'],1);self.assertTrue(fixed['reply']['accepted'])
    def test_content_tab_still_denied(self):
        result=self.route(dict(id='fixture',url='https://www.youtube.com/',tab=dict(id=1)))
        self.assertEqual(result['sends'],0);self.assertTrue(result['reply']['denied'])
    def test_other_extension_still_denied(self):
        result=self.route(dict(id='other',url='chrome-extension://fixture/popup.html'))
        self.assertEqual(result['sends'],0)
    def test_other_extension_page_still_denied(self):
        result=self.route(dict(id='fixture',url='chrome-extension://fixture/options.html',tab=dict(id=10)))
        self.assertEqual(result['sends'],0)
    def test_failed_check_preserves_completed_count(self):
        error=runner.ExperimentFailure('receiver verdict missing',['previous check'],['denied','effects'])
        self.assertEqual(error.details['passed'],1);self.assertEqual(error.details['responseKeys'],['denied','effects'])

if __name__=='__main__':unittest.main()
