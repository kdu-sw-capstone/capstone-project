import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url);
test('Chrome test page checks URL values only, reports errors and clears without network or page effects',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage();
    await page.route('**/*',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(!/^\/(content-tools\/keyword-url\.(html|mjs)|content\/keyword-(url|casefold)\.mjs)$/.test(path))throw Error('UNEXPECTED_NETWORK');
      await route.fulfill({contentType:path.endsWith('.html')?'text/html; charset=utf-8':'text/javascript',body:await readFile(new URL('.'+path,root))});
    });
    await page.goto('https://fixture.test/content-tools/keyword-url.html');
    await page.click('#check');assert.match(await page.textContent('#result'),/^키워드 일치/);
    await page.fill('#url','https://example.test/?gaming=no');await page.click('#check');
    assert.match(await page.textContent('#result'),/^키워드 불일치/);
    assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).display),'block');
    await page.fill('#url','https://example.test/?q=%FF');await page.click('#check');
    assert.match(await page.textContent('#result'),/^검사 불가/);
    assert.ok(!(await page.textContent('#result')).includes('example.test'));
    await page.click('#clear');assert.equal(await page.inputValue('#url'),'');
    assert.equal(await page.inputValue('#term'),'');assert.match(await page.textContent('#result'),/입력을 지웠습니다/);
  }finally{await browser.close();}
});
