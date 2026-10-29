import test from 'node:test';
import assert from 'node:assert/strict';
import { Changes } from '../content/changes.mjs';
test('restoration failure returns false and retains original state for retry', () => {
  let value='grid',priority='',fail=false;
  const element={inert:false,style:{getPropertyValue:()=>value,getPropertyPriority:()=>priority,
    setProperty:(_,v,p)=>{ if(fail) throw Error('denied'); value=v;priority=p; }, removeProperty:()=>{value='';priority='';}},
    ownerDocument:{defaultView:{getComputedStyle:()=>({display:value})}}};
  const changes = new Changes();
  assert.equal(changes.hide(element),true);
  fail=true;
  assert.equal(changes.restore(),false);
  fail=false;
  assert.equal(changes.restore(),true);
  assert.equal(value,'grid'); assert.equal(element.inert,false);
});
