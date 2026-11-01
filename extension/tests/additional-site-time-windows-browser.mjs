// Actual Chromium module/JSON/Intl arithmetic only. No MV3, DNR or trusted clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('Chromium resolves window boundaries, fold and quota deferral without granting ALLOW',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({status:path==='/'?200:404,contentType:'text/html',body:'<!doctype html><title>Window arithmetic</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async()=>{
   const {evaluateSiteTimeWindows:evaluate}=await import('/extension/src/additional-site-time-windows.js');
   const policy=windows=>({kind:'SITE_TIME',policy_id:crypto.randomUUID(),version:1,site_id:null,scope:{host:'example.test',include_subdomains:true},enabled:true,tracking_scope:'BROWSER_ALWAYS',daily_limit_ms:null,windows});
   const once={window_id:crypto.randomUUID(),kind:'BLOCK_WINDOW',enabled:true,when:{recurrence:'ONCE',start_at:'2026-11-02T10:00:00.000Z',end_at:'2026-11-02T11:00:00.000Z'}};
   const run=(policies,nowAt,host='example.test')=>evaluate({policies,host,nowAt});
   const p=policy([once]),fold=policy([{window_id:crypto.randomUUID(),kind:'BLOCK_WINDOW',enabled:true,when:{recurrence:'WEEKLY',weekdays:[7],start_local:'01:30',end_local:'01:45',end_day_offset:0,timezone:'America/New_York',dst_gap:'SKIP',dst_overlap:'EARLIER_ONCE'}}]);
   const child=policy([{...once,window_id:crypto.randomUUID(),kind:'ALLOW_WINDOW'}]);child.scope.host='child.example.test';
   const quota=policy([]);quota.daily_limit_ms=60000;const q=run([quota],'2026-11-02T10:30:00.000Z');
   return {start:run([p],'2026-11-02T10:00:00.000Z').decision,end:run([p],'2026-11-02T11:00:00.000Z').decision,foldFirst:run([fold],'2026-11-01T05:35:00.000Z').decision,foldSecond:run([fold],'2026-11-01T06:35:00.000Z').decision,parent:run([p,child],'2026-11-02T10:30:00.000Z','child.example.test').reasons,quota:q.requires_quota_evaluation,allow:Object.hasOwn(q,'allowed')};
  });assert.deepEqual(result,{start:'WINDOW_BLOCK_REQUIRED',end:'NO_WINDOW_BLOCK',foldFirst:'WINDOW_BLOCK_REQUIRED',foldSecond:'NO_WINDOW_BLOCK',parent:['BLOCK_WINDOW'],quota:true,allow:false});
 }finally{await browser.close();}
});
