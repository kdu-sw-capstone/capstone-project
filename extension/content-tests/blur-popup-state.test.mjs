import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
test('popup reuses actual model readiness across reopening without another preparation',{timeout:30000},async t=>{
  const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});t.after(()=>browser.close());
  const page=await browser.newPage();let ready=false,prepareCalls=0;
  await page.exposeFunction('modelMessage',async message=>{
    if(message.type==='MODEL_STATE')return {result:{ready,loading:false,closed:false}};
    if(message.type==='PREPARE'){prepareCalls++;ready=true;return {result:{ready:true}};}
    throw Error('UNEXPECTED_REQUEST');
  });
  await page.addInitScript(()=>{globalThis.chrome={runtime:{sendMessage:message=>modelMessage(message)}};});
  await page.route('**/*',async route=>{const name=new URL(route.request().url()).pathname.endsWith('.js')?'popup.js':'popup.html';await route.fulfill({contentType:name.endsWith('.js')?'text/javascript':'text/html',body:await readFile(new URL('../content-tools/blur-site/'+name,import.meta.url))});});
  await page.goto('https://fixture.test/popup.html');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('아직 준비된'));
  assert.equal(await page.locator('#apply').isEnabled(),false);assert.equal(prepareCalls,0);
  await page.locator('#prepare').click();await page.waitForFunction(()=>!document.querySelector('#apply').disabled);assert.equal(prepareCalls,1);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#apply').disabled);assert.equal(prepareCalls,1);
  ready=false;await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('아직 준비된'));assert.equal(await page.locator('#apply').isEnabled(),false);assert.equal(prepareCalls,1);
});
