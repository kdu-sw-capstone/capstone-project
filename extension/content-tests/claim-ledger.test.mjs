import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaimLedger } from '../content/claim-ledger.mjs';

function fixture() {
  const values = new Map([['display', ['grid', '']], ['filter', ['brightness(.8)', '']]]);
  let denied = null, silent = null;
  const document = { defaultView: { getComputedStyle: e => ({ display: e.style.getPropertyValue('display'), filter: e.style.getPropertyValue('filter') || 'none' }) } };
  const element = { ownerDocument: document, inert: false, isConnected: true, style: {
    getPropertyValue: name => values.get(name)?.[0] ?? '',
    getPropertyPriority: name => values.get(name)?.[1] ?? '',
    setProperty(name, value, priority = '') {
      if (name === denied) throw Error('fixture setter denied');
      if (name !== silent) values.set(name, [value, priority]);
    },
    removeProperty(name) { if (name === denied) throw Error('fixture setter denied'); if (name !== silent) values.delete(name); },
  } };
  return { document, element, ledger: new ClaimLedger(document), deny: name => denied = name, ignore: name => silent = name };
}

test('shared node stays hidden until the final independent owner releases', () => {
  const { ledger, element } = fixture();
  assert.equal(ledger.hide('focus:comments', element), true);
  assert.equal(ledger.hide('runtime:gate', element), true);
  assert.equal(ledger.release('focus:comments').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'none');
  assert.equal(element.inert, true);
  assert.equal(ledger.inspect('runtime:gate').remaining_targets, 1);
  assert.equal(ledger.release('runtime:gate').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'grid');
  assert.equal(element.inert, false);
});

test('reentrant release during a guarded property write stays pending and cannot lose the next property obligation',()=>{
  const {ledger,element}=fixture();let allowed=true,inner;
  const set=element.style.setProperty.bind(element.style);
  element.style.setProperty=(n,v,p)=>{set(n,v,p);if(n==='display'&&v==='none'){allowed=false;inner=ledger.release('own');}};
  assert.equal(ledger.hide('own',element,()=>allowed),false);
  assert.equal(inner.restored,false);assert.equal(inner.cleanup_pending,true);
  assert.equal(element.inert,false);assert.equal(ledger.inspect('own').remaining_targets,1);
  assert.equal(ledger.release('own').restored,true);assert.equal(ledger.inspect().remaining_targets,0);
  assert.equal(element.style.getPropertyValue('display'),'grid');
});

test('grayscale composes with page filter and two owners without accumulating', () => {
  const { ledger, element } = fixture();
  for (let i = 0; i < 3; i++) assert.equal(ledger.grayscale('focus:gray', element), true);
  ledger.grayscale('second:gray', element);
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8) grayscale(1)');
  ledger.release('focus:gray');
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8) grayscale(1)');
  ledger.release('second:gray');
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8)');
});

test('page edits survive release with and without an intermediate rescan', () => {
  for (const rescan of [false, true]) {
    const { ledger, element } = fixture();
    ledger.hide('focus:hide', element);
    element.style.setProperty('display', 'flex', 'important'); element.inert = false;
    if (rescan) ledger.hide('focus:hide', element);
    assert.equal(ledger.release('focus:hide').restored, true);
    assert.equal(element.style.getPropertyValue('display'), 'flex');
    assert.equal(element.style.getPropertyPriority('display'), 'important');
    assert.equal(element.inert, false);
  }
});

test('removing one owner reconciles a page edit and preserves it for final release', () => {
  const { ledger, element } = fixture();
  ledger.hide('A', element); ledger.hide('B', element);
  element.style.setProperty('display', 'flex'); element.inert = false;
  ledger.release('A');
  assert.equal(element.style.getPropertyValue('display'), 'none');
  assert.equal(element.inert, true);
  ledger.release('B');
  assert.equal(element.style.getPropertyValue('display'), 'flex');
  assert.equal(element.inert, false);
});

test('hide and filter resources can be independently released on the same node', () => {
  const { ledger, element } = fixture();
  ledger.hide('hide', element); ledger.grayscale('gray', element);
  ledger.release('hide');
  assert.equal(element.style.getPropertyValue('display'), 'grid');
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8) grayscale(1)');
  ledger.release('gray');
  assert.equal(ledger.inspect().remaining_targets, 0);
});

test('a failed restore remains owned and can be retried', () => {
  const { ledger, element, deny } = fixture();
  ledger.hide('owner', element); deny('display');
  const failed = ledger.release('owner');
  assert.equal(failed.restored, false); assert.equal(failed.remaining_targets, 1);
  assert.equal(failed.error_count, 1);
  deny(null);
  assert.equal(ledger.release('owner').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'grid');
});

test('silent setter failure and detached nodes do not discard unresolved cleanup', () => {
  const { ledger, element, ignore } = fixture();
  ledger.hide('owner', element); element.isConnected = false; ignore('display');
  assert.equal(ledger.release('owner').restored, false);
  assert.equal(ledger.inspect('owner').remaining_targets, 1);
  ignore(null);
  assert.equal(ledger.release('owner').restored, true);
});

test('new effects close on lifecycle invalidation; original cleanup remains available', () => {
  const { ledger, element } = fixture();
  ledger.hide('owner', element); ledger.suspend();
  assert.throws(() => ledger.hide('new', element), /DOCUMENT_EFFECTS_CLOSED/);
  assert.equal(ledger.release('owner').restored, true);
});

test('cross-document nodes and empty claim identities cannot mutate effects', () => {
  const { ledger, element } = fixture();
  const other = fixture();
  assert.throws(() => ledger.hide('owner', other.element), /FOREIGN_DOCUMENT/);
  assert.throws(() => ledger.hide('', element), /INVALID_CLAIM_ID/);
  assert.equal(element.style.getPropertyValue('display'), 'grid');
});

for (const fault of ['throw','readback']) {
  test(`pending restore retries original value and priority after partial setter ${fault}`, () => {
    const {ledger,element}=fixture();
    element.style.setProperty('display','grid','important');ledger.hide('A',element);
    const write=element.style.setProperty;
    element.style.setProperty=(name,value,priority)=>{
      if(name==='display'&&value==='grid'){
        write(name,'block','');if(fault==='throw')throw Error('partial restore');return;
      }
      write(name,value,priority);
    };
    const first=ledger.release('A');
    assert.equal(first.restored,false);assert.equal(first.remaining_targets,1);
    element.style.setProperty=write;
    assert.equal(ledger.release('A').restored,true);
    assert.equal(element.style.getPropertyValue('display'),'grid');
    assert.equal(element.style.getPropertyPriority('display'),'important');
  });
}

test('pending restore blocks rescan/new owner and retains its fixed goal until readback confirms', () => {
  const {ledger,element}=fixture();ledger.hide('A',element);
  const write=element.style.setProperty;
  element.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
  assert.equal(ledger.release('A').restored,false);
  assert.equal(ledger.hide('A',element),false);
  assert.equal(ledger.hide('B',element),false);
  assert.equal(ledger.inspect('B').remaining_targets,0);
  assert.equal(ledger.release('A').restored,false);
  assert.equal(ledger.inspect('A').remaining_targets,1);
  element.style.setProperty=write;ledger.suspend();
  assert.equal(ledger.release('A').restored,true);
  assert.equal(element.style.getPropertyValue('display'),'grid');
});

test('failed shared-owner reconciliation never promotes its partial write to page baseline', () => {
  for(const fault of ['throw','readback']){
    const {ledger,element}=fixture();ledger.hide('A',element);ledger.hide('B',element);
    element.style.setProperty('display','flex');
    const write=element.style.setProperty;
    element.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='none'){write(name,'block');if(fault==='throw')throw Error('partial');return;}write(name,value,priority);};
    assert.equal(ledger.release('A').restored,false);
    element.style.setProperty=write;
    assert.equal(ledger.release('A').restored,true);
    assert.equal(element.style.getPropertyValue('display'),'none');
    assert.equal(ledger.release('B').restored,true);
    assert.equal(element.style.getPropertyValue('display'),'flex');
  }
});

test('filter removal and inert partial failures preserve original cleanup goals', () => {
  const {ledger,element}=fixture();element.style.removeProperty('filter');ledger.grayscale('gray',element);
  const remove=element.style.removeProperty;
  element.style.removeProperty=name=>{element.style.setProperty(name,'blur(2px)');throw Error('partial removal');};
  assert.equal(ledger.release('gray').restored,false);
  element.style.removeProperty=remove;
  assert.equal(ledger.release('gray').restored,true);assert.equal(element.style.getPropertyValue('filter'),'');
  let inert=false,broken=false;
  Object.defineProperty(element,'inert',{get:()=>inert,set:value=>{inert=broken?'partial':value;if(broken)throw Error('partial inert');}});
  ledger.hide('hide',element);broken=true;assert.equal(ledger.release('hide').restored,false);
  broken=false;assert.equal(ledger.release('hide').restored,true);assert.equal(element.inert,false);
});

test('unconfirmed computed grayscale returns false and preserves cleanup ownership', () => {
  const { document, element, ledger } = fixture();
  document.defaultView.getComputedStyle = () => ({ filter: 'none' });
  assert.equal(ledger.grayscale('gray', element), false);
  assert.equal(ledger.inspect('gray').remaining_targets, 1);
  assert.equal(ledger.release('gray').restored, true);
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8)');
});

test('foreign document prevents both restoration and reconciliation of shared claims', () => {
  const { document, element, ledger } = fixture();
  ledger.hide('A', element); ledger.hide('B', element);
  element.ownerDocument = fixture().document;
  element.style.setProperty('display', 'flex'); element.inert = false;
  const failed = ledger.release('A');
  assert.equal(failed.restored, false);
  assert.equal(failed.error_count, 2);
  assert.equal(element.style.getPropertyValue('display'), 'flex');
  assert.equal(element.inert, false);
  assert.equal(ledger.inspect('A').remaining_properties, 2);
  // Explicitly returning to the original document makes cleanup eligible again.
  element.ownerDocument = document;
  assert.equal(ledger.release('A').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'none');
  assert.equal(ledger.release('B').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'flex');
});
