import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyBlurStages} from '../content/blur-verdict.mjs';
const scores = (Sexy = 0, Porn = 0, Hentai = 0) => ({Drawing:0, Hentai, Neutral:1-Sexy-Porn-Hentai, Porn, Sexy});
test('reported Sexy example is covered; reported neutral example stays visible', () => {
  assert.equal(classifyBlurStages([{scores:scores(.9605989456,.0292180013,.0005429643)}, {scores:scores(.9989763498,.0005497397,.0000047537)}]), 'SENSITIVE');
  assert.equal(classifyBlurStages([{scores:scores(.0000269938,.0004308805,.0005909103)}, {scores:scores(.0000128773,.0002218342,.001273302)}]), 'SAFE');
});
test('precision candidate requires both models; threshold boundary and existing categories', () => {
  for (const value of [scores(.75),scores(0,.75),scores(0,0,.75)]) {
    assert.equal(classifyBlurStages([{scores:value},{scores:value}]),'SENSITIVE');
    assert.equal(classifyBlurStages([{scores:scores()},{scores:value}]),'SAFE');
    assert.equal(classifyBlurStages([{scores:value},{scores:scores()}]),'SAFE');
  }
  assert.equal(classifyBlurStages([{scores:scores(.9)},{scores:scores(.7499)}]),'SAFE');
});
test('missing or invalid model output cannot turn into SAFE', () => {
  for (const stages of [[], [{scores:scores()}], [{scores:{}},{scores:scores()}], [{scores:{...scores(),Sexy:NaN}},{scores:scores()}]]) {
    assert.throws(()=>classifyBlurStages(stages),/INVALID_MODEL_OUTPUT/);
  }
});
test('mixed categories still combine, but both models must independently meet 75 percent',()=>{
  assert.equal(classifyBlurStages([{scores:scores(.4,.4)},{scores:scores(.4,.3,.1)}]),'SENSITIVE');
  assert.equal(classifyBlurStages([{scores:scores(.26,.25)},{scores:scores()}]),'SAFE');
  assert.equal(classifyBlurStages([{scores:scores()},{scores:scores(.2,.2,.1)}]),'SAFE');
  assert.equal(classifyBlurStages([{scores:scores(.1,.1,.1)},{scores:scores(.05,.1,.1)}]),'SAFE');
});
test('reported normal concert and daily-life thumbnail scores no longer trigger automatic blur',()=>{
  const concert=[scores(.009197069332003593,.688762366771698,.005757075268775225),scores(.013253819197416306,.48798373341560364,.014570719562470913)];
  const daily=[scores(.011893962509930134,.6849272847175598,.006042840424925089),scores(.06965985149145126,.3801833391189575,.006209621671587229)];
  for(const pair of [concert,daily]){
    assert.equal(pair.some(s=>s.Porn+s.Hentai+s.Sexy>=.5),true);
    assert.equal(classifyBlurStages(pair.map(scores=>({scores}))),'SAFE');
  }
});
