import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {ShortsControl} from '../content/shorts.mjs';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
import {ClaimLedger} from '../content/claim-ledger.mjs';
import {EndCardsSession as ContentSessionAdapter} from './fixtures/yt08-port/endcards.mjs';
function fixture(){
 const dom=new JSDOM('<!doctype html><ytd-watch-flexy video-id="v"><div id="movie_player"><a class="ytp-suggestion-link" href="/shorts/a" style="display:grid">Shorts</a><a id="normal" href="/watch?v=other">Normal</a></div></ytd-watch-flexy>',{url:'https://www.youtube.com/watch?v=v'});
 const d=dom.window.document;Object.defineProperty(dom.window.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 const ledger=new ClaimLedger(d),shorts=new ShortsControl(d,{ledger});
 const endcards=new ContentSessionAdapter(d,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),features:[{feature_id:'YT-08',enabled:true,required:true}],isCurrent:()=>true});
 return {dom,d,ledger,shorts,endcards,node:d.querySelector('.ytp-suggestion-link')};
}
for(const order of ['SHORTS_FIRST','YT08_FIRST'])test('same shared ledger: '+order+' keeps remaining owner then restores original',()=>{
 const f=fixture();try{
 if(order==='SHORTS_FIRST'){assert.equal(f.shorts.apply().status,'SUPPORTED');f.endcards.start();f.shorts.release();assert.equal(f.shorts.changes.size,0);}else{f.endcards.start();f.shorts.apply();f.endcards.release();assert.equal(f.shorts.changes.size,1);}
 assert.equal(f.node.style.display,'none');assert.equal(f.node.inert,true);
 f.shorts.release();f.endcards.release();assert.equal(f.node.style.display,'grid');assert.equal(f.node.inert,false);assert.equal(f.ledger.inspect().remaining_targets,0);
 assert.equal(f.d.querySelector('#normal').style.display,'');
 }finally{f.shorts.release();f.endcards.release();f.dom.window.close();}
});
test('A0 forwards exact ledger, preserves plan shape and own debt count',async()=>{
 const f=fixture(),effect=new A0ShortsEffect(f.d,{ledger:f.ledger,preserveOnFailure:true});try{
 const plans=[];await effect.start(async p=>plans.push(structuredClone(p)));f.endcards.start();
 assert.deepEqual(Object.keys(plans[0][0]).sort(),['display','inert','node_id','priority']);assert.equal(effect.control.changes.size,1);
 const r=await effect.release();assert.equal(r.owned_changes_restored,true);assert.equal(r.remaining_owned_changes,0);assert.equal(f.node.style.display,'none');
 f.endcards.release();assert.equal(f.node.style.display,'grid');assert.equal(f.ledger.inspect().remaining_targets,0);
 }finally{await effect.release();f.endcards.release();f.dom.window.close();}
});
test('invalid ledger fails closed rather than silently creating separate ownership',()=>{const f=fixture();try{assert.throws(()=>new ShortsControl(f.d,{ledger:{}}),/SHARED_LEDGER_REQUIRED/);}finally{f.dom.window.close();}});

test('partial property write keeps own debt and cleanup retry preserves other owner',()=>{
 const f=fixture();let deny=true;const real=f.node.style.setProperty.bind(f.node.style);
 try{f.node.style.setProperty=(...a)=>{if(deny&&a[0]==='display')throw Error('SYNTHETIC_SETTER');real(...a);};
 assert.equal(f.shorts.apply().status,'FAILED');assert.equal(f.shorts.changes.size,1);
 deny=false;f.endcards.start();assert(f.shorts.release());assert.equal(f.shorts.changes.size,0);assert.equal(f.node.style.display,'none');
 f.endcards.release();assert.equal(f.node.style.display,'grid');assert.equal(f.ledger.inspect().remaining_targets,0);
 }finally{deny=false;f.shorts.release();f.endcards.release();f.dom.window.close();}
});
test('two Shorts instances sharing ledger release only their own claim',()=>{
 const f=fixture(),second=new ShortsControl(f.d,{ledger:f.ledger});try{f.shorts.apply();second.apply();assert(f.shorts.release());assert.equal(f.node.style.display,'none');assert.equal(second.changes.size,1);assert(second.release());assert.equal(f.node.style.display,'grid');assert.equal(f.node.inert,false);}finally{second.release();f.shorts.release();f.dom.window.close();}
});
