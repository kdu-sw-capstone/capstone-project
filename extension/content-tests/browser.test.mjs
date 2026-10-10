import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser;
before(async () => { browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) }); });
after(async () => { await browser?.close(); });

async function fixture(t, html, path = '/watch?v=test', host = 'www.youtube.com') {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (/^\/content\/[a-z-]+\.mjs$/.test(url.pathname)) {
      await route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL('..' + url.pathname, import.meta.url), 'utf8') });
    } else await route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
  });
  const page = await context.newPage();
  await page.goto('https://' + host + path);
  await page.evaluate(async () => {
    const { ContentController } = await import('/content/controller.mjs');
    window.results = []; window.controller = new ContentController(document, result => window.results.push(result));
  });
  return page;
}

test('POLICY-03: Shorts only, restore own display/inert and preserve page color', async t => {
  const page = await fixture(t, '<a href="/shorts/1" style="display:inline!important;color:red">short</a><a id="watch" href="/watch?v=1">watch</a>');
  assert.equal((await page.evaluate(() => controller.start({features:{shorts:true}})))[0].status, 'SUPPORTED');
  assert.equal(await page.locator('a').first().isVisible(), false);
  assert.equal(await page.locator('#watch').isVisible(), true);
  await page.evaluate(() => document.querySelector('a').style.color = 'blue');
  assert.equal(await page.evaluate(() => controller.release()), true);
  assert.deepEqual(await page.locator('a').first().evaluate(e => [e.style.display,e.style.getPropertyPriority('display'),e.inert,e.style.color]), ['inline','important',false,'blue']);
});
test('POLICY-03: direct player missing must fail despite matching links', async t => {
  const page = await fixture(t, '<a href="/shorts/1">short</a>', '/shorts/1');
  assert.equal((await page.evaluate(() => controller.start({features:{shorts:true}})))[0].status, 'FAILED');
});
test('POLICY-03: direct Shorts player hidden and media paused', async t => {
  const page = await fixture(t, '<ytd-shorts><video></video></ytd-shorts><header>navigation</header>', '/shorts/1');
  await page.evaluate(() => { document.querySelector('video').pause = () => window.paused = true; });
  assert.equal((await page.evaluate(() => controller.start({features:{shorts:true}})))[0].status, 'SUPPORTED');
  assert.equal(await page.evaluate(() => paused), true);
  assert.equal(await page.locator('header').isVisible(), true);
});
test('new DOM reapplied without repeated result loop, pending timer cancelled on release', async t => {
  const page = await fixture(t, '<main>watch</main>');
  await page.evaluate(() => controller.start({features:{shorts:true}}));
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend','<a href="/shorts/2">new</a>'));
  await page.waitForFunction(() => document.querySelector('a').style.display === 'none');
  const count = await page.evaluate(() => results.length);
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => results.length), count);
  await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend','<a href="/shorts/3">late</a>'); controller.release(); });
  await page.waitForTimeout(600);
  assert.equal(await page.locator('a').last().isVisible(), true);
});
test('SPA route applies and releases viewer changes', async t => {
  const page = await fixture(t, '<ytd-shorts>player</ytd-shorts>');
  await page.evaluate(() => controller.start({features:{shorts:true}}));
  assert.equal(await page.locator('ytd-shorts').isVisible(), true);
  await page.evaluate(() => history.pushState({}, '', '/shorts/1'));
  await page.waitForFunction(() => document.querySelector('ytd-shorts').style.display === 'none');
  await page.evaluate(() => history.pushState({}, '', '/watch?v=2'));
  await page.waitForFunction(() => document.querySelector('ytd-shorts').style.display !== 'none');
});
test('OPTION-01/02: hide recommendations/comments, preserve video and manual playback', async t => {
  const page = await fixture(t, '<ytd-watch-flexy><video autoplay></video><div id="related">suggestions</div><ytd-comments>comments</ytd-comments></ytd-watch-flexy>');
  await page.evaluate(() => controller.start({features:{recommendations:true,comments:true}}));
  assert.equal(await page.locator('#related').isVisible(), false);
  assert.equal(await page.locator('ytd-comments').isVisible(), false);
  assert.equal(await page.locator('video').getAttribute('autoplay'), '');
  assert.equal(await page.evaluate(() => controller.release()), true);
  assert.equal(await page.locator('#related').isVisible(), true);
});
test('unsupported host and changed DOM never report success', async t => {
  const page = await fixture(t, '<main>page</main>', '/', 'youtube.com.evil.example');
  assert.equal((await page.evaluate(() => controller.start({features:{shorts:true}})))[0].status, 'UNSUPPORTED');
});
test('BOUND-19: Core whole-site BLOCK suppresses feature control', async t => {
  const page = await fixture(t, '<a href="/shorts/1">short</a>');
  assert.deepEqual(await page.evaluate(() => controller.start({siteBlocked:true,features:{shorts:true}})), [{feature:'site',status:'UNSUPPORTED'}]);
  assert.equal(await page.locator('a').isVisible(), true);
});
test('OPTION-03: toggle next-video autoplay only and restore original preference', async t => {
  const page = await fixture(t, '<video autoplay></video><button class="ytp-autonav-toggle-button" aria-checked="true">autoplay</button>');
  await page.evaluate(() => { const e = document.querySelector('button'); e.onclick = () => e.setAttribute('aria-checked', String(e.getAttribute('aria-checked') !== 'true')); });
  assert.equal((await page.evaluate(() => controller.start({features:{autoplay:true}})))[0].status, 'SUPPORTED');
  assert.equal(await page.locator('button').getAttribute('aria-checked'), 'false');
  assert.equal(await page.locator('video').getAttribute('autoplay'), '');
  assert.equal(await page.evaluate(() => controller.release()), true);
  assert.equal(await page.locator('button').getAttribute('aria-checked'), 'true');
});
test('OPTION-03: rejected toggle is FAILED and not hammered on rescans', async t => {
  const page = await fixture(t, '<button class="ytp-autonav-toggle-button" aria-checked="true">autoplay</button>');
  await page.evaluate(() => { window.clicks=0; document.querySelector('button').onclick = () => window.clicks++; });
  assert.equal((await page.evaluate(() => controller.start({features:{autoplay:true}})))[0].status, 'FAILED');
  await page.evaluate(() => controller.scan());
  assert.equal(await page.evaluate(() => clicks), 1);
});
test('OPTION-05: Reels route restricts viewer, following feed is preserved', async t => {
  const page = await fixture(t, '<main><video></video>reel</main>', '/reels/1', 'www.instagram.com');
  assert.equal((await page.evaluate(() => controller.start({features:{reels:true}})))[0].status, 'SUPPORTED');
  assert.equal(await page.locator('main').isVisible(), false);
  await page.evaluate(() => history.pushState({}, '', '/following/'));
  await page.waitForFunction(() => document.querySelector('main').style.display !== 'none');
});
test('OPTION-09/BOUND-18: NFKC ignores input/editor/hidden text', async t => {
  const page = await fixture(t, '<input value="secret"><textarea>secret</textarea><div contenteditable>secret</div><p hidden>secret</p><div>ＳＰＯＲＴ</div>');
  await page.evaluate(async () => { window.inspect = (await import('/content/keyword.mjs')).inspectKeywords; });
  const inspect = text => page.evaluate(text => inspect(document,{enabled:true,exceptions:[],rules:[{text,scopes:['BODY']}]}), text);
  assert.equal((await inspect('secret')).blocked, false);
  assert.equal((await inspect('sport')).blocked, true);
});
test('OPTION-09: URL single decoding, title scopes and host exceptions', async t => {
  const page = await fixture(t, '<title>Music</title><p>neutral</p>', '/%73port?q=%2573port');
  const result = await page.evaluate(async () => {
    const {inspectKeywords} = await import('/content/keyword.mjs');
    const check = (text,scopes,exceptions=[]) => inspectKeywords(document,{enabled:true,exceptions,rules:[{text,scopes}]}).blocked;
    return [check('sport',['URL']),check('music',['TITLE']),check('music',['BODY']),check('music',['TITLE'],[{host:'youtube.com',include_subdomains:true}]),check('sport',['URL'],[{host:'tube.com',include_subdomains:true}])];
  });
  assert.deepEqual(result, [true,true,false,false,true]);
});
test('OPTION-09: body cap and frames mark incomplete inspection', async t => {
  const page = await fixture(t, '<p>' + 'x'.repeat(200001) + '</p><iframe></iframe>');
  assert.equal((await page.evaluate(() => controller.start({keywords:{enabled:true,exceptions:[],rules:[{text:'needle',scopes:['BODY']}]}})))[0].status, 'UNSUPPORTED');
});
test('OPTION-09: mutation blocks page; release restores without transmitting source text', async t => {
  const page = await fixture(t, '<p>neutral</p>');
  await page.evaluate(() => controller.start({keywords:{enabled:true,exceptions:[],rules:[{text:'secret',scopes:['BODY']}]}}));
  await page.evaluate(() => document.querySelector('p').textContent = 'secret');
  await page.waitForFunction(() => document.body.style.display === 'none');
  assert.equal(await page.locator('[role=alert]').isVisible(), true);
  assert.equal(await page.evaluate(() => JSON.stringify(results).includes('secret')), false);
  assert.equal(await page.evaluate(() => controller.release()), true);
  assert.equal(await page.locator('p').isVisible(), true);
  assert.equal(await page.locator('[role=alert]').count(), 0);
});
test('frozen local input and already-active guard; repeated scans are not access events', async t => {
  const page = await fixture(t, '<a href="/shorts/1">short</a>');
  await page.evaluate(() => { const options={features:{shorts:true}}; controller.start(options); options.features.shorts=false; controller.scan(); });
  assert.equal(await page.locator('a').isVisible(), false);
  assert.equal(await page.evaluate(() => { try { controller.start({}); } catch(e) { return e.message; } }), 'CONTENT_ALREADY_ACTIVE');
  assert.equal(await page.evaluate(() => JSON.stringify(results).includes('event_id')), false);
});
test('restoration preserves later page display changes', async t => {
  const page = await fixture(t, '<a href="/shorts/1">short</a>');
  await page.evaluate(() => { controller.start({features:{shorts:true}}); document.querySelector('a').style.display='flex'; controller.release(); });
  assert.equal(await page.locator('a').evaluate(e => e.style.display), 'flex');
});
test('rescan remembers a page display update as the new restoration baseline', async t => {
  const page = await fixture(t, '<a href="/shorts/1">short</a>');
  await page.evaluate(() => { controller.start({features:{shorts:true}}); document.querySelector('a').style.display='flex'; controller.scan(); controller.release(); });
  assert.equal(await page.locator('a').evaluate(e => e.style.display), 'flex');
});
test('keyword-only scope does not inspect or reject a large BODY', async t => {
  const page = await fixture(t, '<title>Music</title><p>'+'x'.repeat(200001)+'</p>');
  assert.equal((await page.evaluate(() => controller.start({keywords:{enabled:true,exceptions:[],rules:[{text:'needle',scopes:['TITLE']}]}})))[0].status, 'SUPPORTED');
});
async function blurFixture(t, classify) {
  const page = await fixture(t, '<main>images</main>');
  await page.evaluate(async classify => {
    const {ImageBlur} = await import('/content/image-blur.mjs');
    const canvas = document.createElement('canvas'); canvas.width=4;canvas.height=4;
    const image = document.createElement('img'); image.src=canvas.toDataURL(); document.body.append(image); await image.decode();
    window.blurResults=[];
    const model = classify === 'unsafe' ? async () => ({Porn:.9,Hentai:0,Sexy:0})
      : classify === 'sexy' ? async () => ({Porn:0,Hentai:0,Sexy:1}) : undefined;
    window.blur = new ImageBlur(document,model,result=>blurResults.push(result));
    blur.start({sensitivity:'MEDIUM',strength:'MEDIUM'});
  },classify);
  return page;
}
test('OPTION-11: mock classification, click reveal/reclick blur and release', async t => {
  const page=await blurFixture(t,'unsafe');
  await page.waitForFunction(()=>blurResults.some(r=>r.status==='BLURRED'));
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'blur(16px)');
  await page.locator('img').click();
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'');
  await page.locator('img').click();
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'blur(16px)');
  assert.equal(await page.evaluate(()=>blur.release()),true);
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'');
});
test('OPTION-11: absent model is FAILED shaded, never safe', async t => {
  const page=await blurFixture(t,'missing');
  await page.waitForFunction(()=>blurResults.some(r=>r.status==='FAILED'));
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'blur(16px)');
  assert.equal(await page.evaluate(()=>blurResults.some(r=>r.status==='SAFE')),false);
});
test('OPTION-11: Sexy score alone is SAFE; ordinary image clicks preserved', async t => {
  const page=await blurFixture(t,'sexy');
  await page.waitForFunction(()=>blurResults.some(r=>r.status==='SAFE'));
  await page.evaluate(()=>{document.querySelector('img').onclick=()=>window.ordinaryClick=true;});
  await page.locator('img').click();
  assert.equal(await page.evaluate(()=>ordinaryClick),true);
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'');
});
test('BOUND-10: source replacement resets reveal and runs new classification', async t => {
  const page=await blurFixture(t,'unsafe');
  await page.waitForFunction(()=>blurResults.some(r=>r.status==='BLURRED'));
  await page.locator('img').click();
  await page.evaluate(()=>{const c=document.createElement('canvas');c.width=5;c.height=5;document.querySelector('img').src=c.toDataURL();});
  await page.waitForFunction(()=>document.querySelector('img').style.filter==='blur(16px)');
  await page.waitForFunction(()=>blurResults.at(-1)?.status==='BLURRED' && blurResults.at(-1).revealed===false);
});
test('OPTION-11: in-flight classification cannot reapply blur after release', async t => {
  const page=await blurFixture(t,'unsafe');
  await page.evaluate(async ()=> {
    blur.release();
    const {ImageBlur}=await import('/content/image-blur.mjs');
    window.started=false;
    window.blur=new ImageBlur(document,()=>{ window.started=true; return new Promise(resolve=>window.finish=resolve); });
    blur.start({sensitivity:'MEDIUM',strength:'HIGH'});
  });
  await page.waitForFunction(()=>started);
  await page.evaluate(()=>{blur.release();finish({Porn:1,Hentai:1});});
  await page.waitForTimeout(100);
  assert.equal(await page.locator('img').evaluate(e=>e.style.filter),'');
});
test('OPTION-11: queue is capped at 100; only one local classification runs', async t => {
  const page=await fixture(t,'<main>queue</main>');
  await page.evaluate(async ()=>{
    const {ImageBlur}=await import('/content/image-blur.mjs');
    const c=document.createElement('canvas'); c.width=2;c.height=2;
    for(let i=0;i<102;i++){const img=document.createElement('img');img.src=c.toDataURL();document.body.append(img);await img.decode();}
    window.calls=0;window.queueResults=[];
    window.blur=new ImageBlur(document,()=>{calls++;return new Promise(()=>{});},r=>queueResults.push(r));
    blur.start({sensitivity:'MEDIUM',strength:'MEDIUM'});
  });
  await page.waitForFunction(()=>calls===1);
  assert.equal(await page.evaluate(()=>blur.queue.length),99);
  assert.equal(await page.evaluate(()=>queueResults.filter(r=>r.status==='UNANALYZED').length),2);
  await page.evaluate(()=>blur.release());
});
