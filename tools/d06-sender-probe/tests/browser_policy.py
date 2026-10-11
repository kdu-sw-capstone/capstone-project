"""Real Chromium JS evaluation with SYNTHETIC sender/binding, not MV3 transport."""
from pathlib import Path
import json, shutil
from playwright.sync_api import sync_playwright
source=(Path(__file__).parent/'sender-policy-candidate.mjs').read_text().replace('export function','function')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'))
    page=browser.new_page()
    result=page.evaluate('''(source)=>{
      const evaluate=new Function(source+`;return {acceptsWorker,matchesBinding};`);
      const {acceptsWorker,matchesBinding}=evaluate();
      const runtime={id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p};
      const worker={id:runtime.id,url:runtime.getURL('worker.js'),origin:new URL(runtime.getURL('worker.js')).origin};
      const binding={tabId:1,frameId:0,documentId:'A',instance:'instance-A',active:true};
      const checks=[];
      function check(name,value){if(!value)throw Error(name);checks.push(name);}
      check('exact Worker candidate',acceptsWorker(worker,runtime));
      for(const path of ['popup.html','options.html','other-worker.js'])check('reject '+path,!acceptsWorker({...worker,url:runtime.getURL(path)},runtime));
      check('reject inherited sender',!acceptsWorker(Object.create(worker),runtime));
      check('reject content',!acceptsWorker({...worker,url:'https://www.youtube.com/',tab:{id:1}},runtime));
      for(const key of ['id','url','origin'])for(const value of [null,undefined,0,{},[]])check('reject sender '+key+' '+JSON.stringify(value),!acceptsWorker({...worker,[key]:value},runtime));
      check('current binding',matchesBinding(binding,binding));
      for(const [key,value] of Object.entries({tabId:2,frameId:1,documentId:'old',instance:'old'}))check('reject '+key,!matchesBinding({...binding,[key]:value},binding));
      check('frozen binding',!matchesBinding(binding,{...binding,active:false}));
      check('new document rejects previous binding',!matchesBinding(binding,{...binding,documentId:'B',instance:'instance-B'}));
      check('inherited binding',!matchesBinding(Object.create(binding),binding));
      document.body.textContent='unchanged';
      for(const sender of [{...worker,url:runtime.getURL('popup.html')},{...worker,id:'other'}]){
        const verdict=acceptsWorker(sender,runtime)&&matchesBinding(binding,binding);
        if(verdict)document.body.textContent='changed';
      }
      check('denied synthetic calls leave DOM unchanged',document.body.textContent==='unchanged');
      return {passed:checks.length,checks,syntheticSender:true,mv3Transport:false};
    }''',source)
    result['chromium']=browser.version
    print(json.dumps(result,ensure_ascii=False))
    browser.close()
