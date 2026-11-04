import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {access,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let built=true;try{await access(new URL('../build/blur-model/manifest.json',import.meta.url));}catch{built=false;}
// Explicit opt-in artifact smoke. A missing model is NOT real-model validation.
test('packaged InceptionV3 → MobileNetV2 real inference: local pixels, hashes, repeated cleanup',{skip:!built,timeout:180000},async t=>{
  const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader'],...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});t.after(()=>browser.close());
  const context=await browser.newContext(),page=await context.newPage(),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());requests.push({origin:url.origin,method:request.method(),path:url.pathname});
    if(url.origin!=='http://127.0.0.1:4178'||request.method()!=='GET'){await route.abort();return;}
    try{const bytes=await readFile(new URL('..'+url.pathname,import.meta.url));await route.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':/\.(js|mjs)$/.test(url.pathname)?'text/javascript':url.pathname.endsWith('.json')?'application/json':'application/octet-stream',body:bytes});}
    catch{await route.fulfill({status:404,body:'Not found'});}
  });
  await page.goto('http://127.0.0.1:4178/content-tools/blur-real.html');console.log('real-model smoke: loading verified local model files');await page.locator('#load').click();
  await page.waitForFunction(()=>!document.querySelector('#apply').disabled||document.querySelector('#status').textContent.includes('실패'),{},{timeout:120000});
  assert.equal(await page.locator('#apply').isEnabled(),true,await page.locator('#status').textContent());
  await page.evaluate(async()=>{const {LocalBlurClassifier}=await import('/content/blur-classifier.mjs');const classify=LocalBlurClassifier.prototype.classify;
    LocalBlurClassifier.prototype.classify=async function(...args){try{return await classify.apply(this,args);}catch(e){window.syntheticModelError=e.message;throw e;}};});
  const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,100,80);return c.toDataURL().split(',')[1];}),'base64');
  await page.locator('#files').setInputFiles({name:'synthetic-pixels.png',mimeType:'image/png',buffer:image});await page.locator('#apply').click();
  await page.waitForFunction(()=>{const r=JSON.parse(document.querySelector('#result').textContent);return r.results.length===1||r.session?.counts.FAILED>0;},{},{timeout:60000});
  let report=JSON.parse(await page.locator('#result').textContent());const modelError=await page.evaluate(()=>window.syntheticModelError??null);console.log(JSON.stringify({first_result:report,errors,modelError}));assert.equal(report.results.length,1,JSON.stringify({report,modelError}));assert.equal(report.realModel,true);assert.equal(report.results[0].stages.length,2);
  assert.deepEqual(report.results[0].stages.map(s=>s.model),['inception_v3','mobilenet_v2']);
  for(const s of report.results[0].stages){assert.equal(Object.keys(s.scores).length,5);assert.ok(Math.abs(Object.values(s.scores).reduce((a,b)=>a+b,0)-1)<0.02);}
  await page.locator('#images select').selectOption(report.results[0].verdict);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#result').textContent).evaluation.labeled===1);
  assert.equal(JSON.parse(await page.locator('#result').textContent()).evaluation.accuracy,1);
  await page.locator('#images select').selectOption('');
  assert.equal(JSON.parse(await page.locator('#result').textContent()).evaluation.accuracy,null);
  const before=report.results[0].num_tensors;
  await page.locator('#release').click();assert.equal(await page.locator('[data-focurve-ui="blur"]').count(),0);
  await page.locator('#apply').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#result').textContent).results.length===1,{},{timeout:60000});
  report=JSON.parse(await page.locator('#result').textContent());assert.equal(report.results[0].num_tensors,before);
  await page.locator('#release').click();assert.equal(await page.locator('[data-focurve-ui="blur"]').count(),0);
  assert.deepEqual(errors,[]);assert.equal(requests.every(r=>r.origin==='http://127.0.0.1:4178'&&r.method==='GET'),true);
  console.log(JSON.stringify({real_model_smoke:true,backend:report.results[0].backend,stages:report.results[0].stages,tensors:before,network_uploads:0,accuracy_evaluation:'NOT_RUN'}));
  for(const corrupt of ['manifest.json','inception_v3.bin']){
    const badContext=await browser.newContext(),bad=await badContext.newPage();
    await badContext.route('**/*',async route=>{const url=new URL(route.request().url());
      if(url.origin!=='http://127.0.0.1:4178'){await route.abort();return;}
      let bytes=await readFile(new URL('..'+url.pathname,import.meta.url));
      if(url.pathname.endsWith('/'+corrupt)){bytes=Buffer.from(bytes);bytes[0]^=1;}
      await route.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':/\.(js|mjs)$/.test(url.pathname)?'text/javascript':url.pathname.endsWith('.json')?'application/json':'application/octet-stream',body:bytes});
    });
    await bad.goto('http://127.0.0.1:4178/content-tools/blur-real.html');await bad.locator('#load').click();
    await bad.waitForFunction(()=>document.querySelector('#status').textContent.includes('실패'),{},{timeout:30000});
    assert.equal(await bad.locator('#apply').isEnabled(),false);
    assert.match(await bad.locator('#status').textContent(),corrupt==='manifest.json'?/PROFILE_HASH_MISMATCH/:/MODEL_HASH_MISMATCH/);
    await badContext.close();
  }
});
