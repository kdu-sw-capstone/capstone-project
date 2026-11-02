import test from 'node:test';
import assert from 'node:assert/strict';
import {describeImage,imageKey} from '../content-tools/blur-site/diagnostics.mjs';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const image={currentSrc:'https://private.test/photo?token=secret',src:'private',srcset:'',sizes:'',naturalWidth:100,naturalHeight:80},profile={sha256:'b'.repeat(64)};
const stage=(model,sexy)=>({model,scores:{Drawing:0,Hentai:0,Neutral:1-sexy,Porn:0,Sexy:sexy}});
test('selected-image diagnosis identifies single-model disagreement without exposing source URL',()=>{
  const r=describeImage(image,{index:7,key:imageKey(image),result:{verdict:'SAFE',stages:[stage('inception_v3',.8),stage('mobilenet_v2',.1)]}},profile);
  assert.equal(r.image_index,7);assert.equal(r.verdict,'SAFE');assert.equal(r.previous_rule_verdict,'SENSITIVE');assert.equal(r.threshold,.75);assert.equal(r.experimental_profile,true);assert.equal(r.stages[0].sensitive_sum,.8);assert.equal(JSON.stringify(r).includes('private'),false);assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('failure, pending and stale image results never masquerade as completed sensitive prediction',()=>{
  assert.equal(describeImage(image,null,profile,{status:'FAILED',failure_reason:'IMAGE_FETCH_FAILED'}).status,'FAILED');
  assert.equal(describeImage(image,null,profile,{status:'PENDING'}).status,'PENDING');
  assert.equal(describeImage(image,{index:1,key:'old'},profile).status,'STALE_IMAGE_RESULT');
});
test('click selection maps the actual covered thumbnail, preserves blur, and release clears diagnosis',{timeout:30000},async t=>{
  const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});t.after(()=>browser.close());const page=await browser.newPage();
  await page.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(path==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});return;}
    await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../build/blur-site-harness'+path,import.meta.url))});});
  await page.goto('https://fixture.test/');await page.evaluate(()=>{
    window.modelCalls=0;globalThis.chrome={runtime:{id:'fixture',getURL:path=>location.origin+'/'+path,onMessage:{addListener:fn=>window.listener=fn},sendMessage:async()=>{
      const {profile}=await import('/model/profile.mjs'),n=++modelCalls;const stage=(model,sexy)=>({model,scores:{Drawing:0,Hentai:0,Neutral:1-sexy,Porn:0,Sexy:sexy}});
      return {result:{verdict:'SENSITIVE',profile_sha256:profile.sha256,stages:[stage('inception_v3',n===1?.8:.95),stage('mobilenet_v2',n===1?.85:.96)]}};
    }}};
  });
  await page.addScriptTag({content:await readFile(new URL('../content-tools/blur-site/bootstrap.js',import.meta.url),'utf8')});
  await page.evaluate(async()=>{for(let n=0;n<2;n++){const c=document.createElement('canvas');c.width=100;c.height=80;c.getContext('2d').fillRect(n,0,50,50);const img=document.createElement('img');img.id='image'+n;img.src=c.toDataURL();img.style.margin='30px';document.body.append(img);await img.decode();}});
  const call=type=>page.evaluate(type=>new Promise(resolve=>listener({target:'BLUR_CONTENT',type},{id:'fixture',url:location.origin+'/popup.html'},resolve)),type);
  await call('APPLY');await page.waitForFunction(()=>modelCalls===2&&[...document.querySelectorAll('[data-focurve-ui="blur"]')].every(e=>e.textContent.startsWith('가려진')));
  for(const [id,expected]of [['image0',1],['image1',2]]){
    await call('SELECT_IMAGE');const box=await page.locator('#'+id).boundingBox();await page.mouse.click(box.x+20,box.y+20);
    await page.waitForFunction(()=>document.querySelector('[data-focurve-ui="blur-diagnosis"]'));
    const info=(await call('SELECTED_STATE')).selected_image;assert.equal(info.image_index,expected);assert.equal(info.stages[0].sensitive_sum,expected===1?.8:.95);
    assert.equal(await page.locator('[data-focurve-ui="blur-diagnosis"]').count(),1);
    assert.equal(await page.locator('[data-focurve-ui="blur"]').first().isVisible(),true);
  }
  await call('RELEASE');assert.equal(await page.locator('[data-focurve-ui="blur-diagnosis"]').count(),0);assert.equal(await page.locator('[data-focurve-ui="blur"]').count(),0);
});
