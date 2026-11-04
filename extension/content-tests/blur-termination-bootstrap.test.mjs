import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
// Only imports/runtime transport are substituted; execute the real TEST caller.
async function fixture(){let listener,instance;class Session{active=true;pending=true;constructor(){instance=this;}start(){}scan(){}inspect(){return {active:this.active,cleanup_pending:this.pending};}release(){this.active=false;return {restored:true,cleanup_pending:this.pending};}}
 const runtime={id:'fixture',getURL:p=>'fixture:///'+p,onMessage:{addListener:fn=>listener=fn}};
 const context=vm.createContext({chrome:{runtime},document:{addEventListener(){}},addEventListener(){},performance:{now:()=>0},setTimeout,clearTimeout,
 fixtureModules:[{BlurSession:Session},{profile:{}},{imageKey:()=>''}]});
 const raw=await readFile(new URL('../content-tools/blur-site/bootstrap.js',import.meta.url),'utf8');
 const source=raw.replace(/^const ready=Promise\.all\(.*$/m,'const ready=Promise.resolve(globalThis.fixtureModules);');assert.notEqual(source,raw);
 new vm.Script(source).runInContext(context);
 const call=type=>new Promise(resolve=>listener({target:'BLUR_CONTENT',type},{id:'fixture',url:'fixture:///popup.html'},resolve));
 return {call,get instance(){return instance;}};}
test('TEST receiver retains session for query/retry when DOM restored but continuation remains',async()=>{const h=await fixture();await h.call('APPLY');
 assert.equal((await h.call('RELEASE')).released.cleanup_pending,true);
 assert.equal((await h.call('STATE')).session.cleanup_pending,true);
 assert.equal((await h.call('APPLY')).error,'OLD_SCOPE_CLEANUP_REQUIRED');
 h.instance.pending=false;assert.equal((await h.call('RELEASE')).released.cleanup_pending,false);assert.equal((await h.call('STATE')).session,null);});
test('TEST receiver still drops a fully completed local session',async()=>{const h=await fixture();await h.call('APPLY');h.instance.pending=false;await h.call('RELEASE');assert.equal((await h.call('STATE')).session,null);});
