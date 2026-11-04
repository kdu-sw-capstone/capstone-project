import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {allowedImage} from '../content-tools/blur-site/image-source.mjs';
test('general HTTP/HTTPS image sources work; privileged schemes and credentials remain rejected',()=>{
  for(const value of ['https://i.ytimg.com/vi/test/hqdefault.jpg','https://example.test/a.jpg','http://localhost:4178/image.png','https://images.other.test:8443/a.webp'])assert.equal(allowedImage(value),value);
  for(const value of ['file:///C:/image.png','chrome://settings','chrome-extension://other/image.png','https://x@host.test/a','javascript:alert(1)','data:image/png,xxx'])assert.throws(()=>allowedImage(value));
});

test('site extension offscreen real model bridge downloads image, rejects caller and source, no upload',{timeout:180000},async t=>{
  const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE,args:['--enable-unsafe-swiftshader']});t.after(()=>browser.close());
  const page=await browser.newPage();const network=[];
  let png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());network.push({origin:url.origin,method:req.method()});
    if(url.origin==='https://i.ytimg.com'){await route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:png});return;}
    if(url.origin!=='http://127.0.0.1:4178'){await route.abort();return;}
    try{const bytes=await readFile(new URL('../build/blur-site-harness'+url.pathname,import.meta.url));await route.fulfill({body:bytes,contentType:/\.(js|mjs)$/.test(url.pathname)?'text/javascript':url.pathname.endsWith('.json')?'application/json':url.pathname.endsWith('.html')?'text/html':'application/octet-stream'});}catch{await route.fulfill({status:404,body:'missing'});}
  });
  await page.addInitScript(()=>{globalThis.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:fn=>{globalThis.listener=fn;}}}};});
  await page.goto('http://127.0.0.1:4178/offscreen.html');await page.waitForFunction(()=>typeof globalThis.listener==='function');
  png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=80;c.getContext('2d').fillRect(0,0,80,80);return c.toDataURL().split(',')[1];}),'base64');
  const call=(type,src,extra={})=>page.evaluate(({type,src,extra})=>new Promise(resolve=>globalThis.listener({target:'BLUR_OFFSCREEN',type,src,...extra},{id:'test-extension',url:location.origin+'/background.mjs'},resolve)),{type,src,extra});
  const prepared=await call('PREPARE');assert.equal(prepared.result.ready,true);
  const result=await call('CLASSIFY','https://i.ytimg.com/test.png');assert.ok(result.result,JSON.stringify(result));assert.equal(result.result.stages.length,2);assert.ok(['SAFE','SENSITIVE'].includes(result.result.verdict));
  assert.equal(result.result.cache_hit,false);
  const repeat=await call('CLASSIFY','https://i.ytimg.com/test.png');assert.equal(repeat.result.cache_hit,true);assert.equal(repeat.result.verdict,result.result.verdict);
  const encoded=await call('CLASSIFY',undefined,{encoded:'data:image/png;base64,'+png.toString('base64')});assert.equal(encoded.result.cache_hit,true);assert.equal(encoded.result.verdict,result.result.verdict);
  const invalidEncoded=await call('CLASSIFY',undefined,{encoded:'data:image/jpeg;base64,AAAA'});assert.equal(invalidEncoded.error,'INVALID_IMAGE');
  const pixels=await call('CLASSIFY',undefined,{width:1,height:1,pixels:[255,0,0,255]});assert.equal(pixels.result.stages.length,2);
  const invalidPixels=await call('CLASSIFY',undefined,{width:1,height:1,pixels:[-1,0,0,255]});assert.equal(invalidPixels.error,'INVALID_IMAGE');
  const bad=await call('CLASSIFY','file:///image.png');assert.equal(bad.error,'IMAGE_SOURCE_UNSUPPORTED');
  assert.equal(await page.evaluate(()=>globalThis.listener({target:'BLUR_OFFSCREEN',type:'CLASSIFY'},{id:'other',url:location.origin+'/background.mjs'},()=>{})),undefined);
  assert.equal(network.every(row=>row.method==='GET'&&['http://127.0.0.1:4178','https://i.ytimg.com'].includes(row.origin)),true);
});
