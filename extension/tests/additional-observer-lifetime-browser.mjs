// Optional actual IndexedDB probe; tabs/windows/idle/permissions are synthetic.
// No extension Worker or product Chrome START is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../../',import.meta.url);

test('native IndexedDB does not persist stale observer events in the new collector epoch',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage();
    await page.route('**/*',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(/^\/extension\/(src|a1|member-a1)\/[a-z-]+\.(js|mjs|json)$/.test(path))
        return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(fileURLToPath(new URL(path.slice(1),root)),'utf8')});
      return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated callback lifetime</title>'});
    });
    await page.goto('https://focurve.test/');
    const result=await page.evaluate(async()=>{
      const [{createMemberDB},{AdditionalObservationJournal},{AdditionalTimeRuntime}]=await Promise.all([
        import('/extension/member-a1/db.mjs'),import('/extension/src/additional-observation-journal.js'),import('/extension/src/additional-time-runtime.js')]);
      const event=()=>{const set=new Set();return {addListener:f=>set.add(f),removeListener:f=>set.delete(f),callbacks:()=>[...set],fire:v=>[...set].forEach(f=>f(v))};};
      const context=()=>({bootId:crypto.randomUUID(),executorId:crypto.randomUUID(),ownerBindingId:crypto.randomUUID()});
      const api={windows:{getLastFocused:async()=>({id:2,focused:true,type:'normal'}),onFocusChanged:event(),onRemoved:event()},
        tabs:{query:async()=>[{id:1,windowId:2,active:true,url:'https://example.org/'}]},
        idle:{queryState:async()=>'active',setDetectionInterval(){},onStateChanged:event()},permissions:{contains:async()=>true,onRemoved:event()}};
      for(const name of ['onActivated','onUpdated','onRemoved','onReplaced','onAttached','onDetached'])api.tabs[name]=event();
      const db=createMemberDB(indexedDB,'observer-lifetime'),journal=new AdditionalObservationJournal(db),runtime=new AdditionalTimeRuntime({journal,browser:api});
      await runtime.start(context());const oldIdle=api.idle.onStateChanged.callbacks()[0],oldTab=api.tabs.onActivated.callbacks()[0],oldRemoved=api.permissions.onRemoved.callbacks();
      await runtime.stop();api.idle.queryState=async()=>'locked';const owner=context();await runtime.start(owner);
      const before=await journal.recover();oldIdle('active');oldTab({tabId:1});for(const callback of oldRemoved)callback({permissions:['idle','tabs']});
      await new Promise(resolve=>setTimeout(resolve,0));await runtime.flush();const after=await journal.recover();
      api.idle.onStateChanged.fire('active');
      // Wait for the complete current refresh rather than timing a browser query.
      await runtime.observer.refresh('PROBE');await runtime.flush();const current=await journal.recover();
      await runtime.stop();
      const reopened=await new AdditionalObservationJournal(createMemberDB(indexedDB,'observer-lifetime')).recover();
      return {unchanged:JSON.stringify(before)===JSON.stringify(after),obligations:after.obligations.length,
        currentWorks:current.captures.some(c=>c.epoch===current.epoch&&c.boundary.status==='CANDIDATE'),
        ownerPreserved:reopened.context.ownerBindingId===owner.ownerBindingId,
        stopPreserved:reopened.captures.at(-1).boundary.reason==='STOP'};
    });
    assert.deepEqual(result,{unchanged:true,obligations:2,currentWorks:true,ownerPreserved:true,stopPreserved:true});
  }finally{await browser.close();}
});
