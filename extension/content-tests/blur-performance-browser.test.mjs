import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
test('scroll bursts coalesce scans and unchanged overlays avoid style mutations',{timeout:30000},async t=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});t.after(()=>browser.close());
  async function measure(before=false){const page=await browser.newPage();
    await page.route('**/*',async route=>{const pathname=new URL(route.request().url()).pathname;
      await route.fulfill({contentType:pathname.endsWith('.mjs')?'text/javascript':'text/html',body:pathname.endsWith('.mjs')?await readFile(new URL(before?'../build/blur-session-before-performance.mjs':'../content/blur-session.mjs',import.meta.url)):'<!doctype html><body></body>'});});
    await page.goto('https://fixture.test/');
    await page.evaluate(async()=>{const {BlurSession}=await import('/session.mjs');const c=document.createElement('canvas');c.width=100;c.height=80;const src=c.toDataURL();
      for(let i=0;i<40;i++){const img=document.createElement('img');img.src=src;document.body.append(img);await img.decode();}
      const profile={id:'TEST',sha256:'b'.repeat(64),level:'HIGH'};window.session=new BlurSession(document,{profile,canApply:()=>true,classify:async()=>({verdict:'SAFE',profile_sha256:profile.sha256})});session.start();});
    await page.waitForFunction(()=>session.inspect().counts.SAFE===40);await page.waitForTimeout(300);
    const metrics=await page.evaluate(async()=>{let scans=0,mutations=0;const original=document.querySelectorAll.bind(document);
      document.querySelectorAll=selector=>{if(selector==='img')scans++;return original(selector);};
      const observer=new MutationObserver(records=>{mutations+=records.filter(r=>r.target.matches?.('[data-focurve-ui="blur"]')).length;});observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['style']});
      for(let round=0;round<10;round++){for(let i=0;i<10;i++)dispatchEvent(new Event('scroll'));await new Promise(resolve=>setTimeout(resolve,8));}
      await new Promise(resolve=>setTimeout(resolve,350));observer.disconnect();const result={all_scans:scans,overlay_style_mutations:mutations};session.release();return result;});await page.close();return metrics;
  }
  const after=await measure();assert.ok(after.all_scans<=4,JSON.stringify(after));assert.equal(after.overlay_style_mutations,0);
  let baseline=null;try{await access(new URL('../build/blur-session-before-performance.mjs',import.meta.url));baseline=await measure(true);}catch{}
  console.log(JSON.stringify({dom_scroll_burst:{before:baseline,after},real_site_performance:'NOT_RUN'}));
});
