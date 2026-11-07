import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import GuestImports from './GuestImports';
import {clearCsrf} from './api';
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function setup(firstStatus:number,malformed=false){
 const id=crypto.randomUUID(),batch=crypto.randomUUID(),executor=crypto.randomUUID();let exactCalls=0,failCurrent=false;
 const manifest={format_version:'1.0',owner_user_id:'42',executor_id:executor,items:[{source_item_id:id,source_hash:'a'.repeat(64),type:'SITE',label:'review.invalid'}]};
 const pending={batch_id:batch,status:'PROCESSING',created_at:'2026-11-07T00:00:00.000Z',items:[{source_item_id:id,status:'PENDING',error_code:null}]};
 const send=vi.fn((_id:string,b:{type:string},cb:(v:unknown)=>void)=>cb(b.type.endsWith('LIST')?manifest:{batch_id:batch}));
 const fetch=vi.fn(async(url:string)=>{
  if(url.endsWith(batch)){exactCalls++;if(exactCalls===1&&malformed)return json({...pending,items:[]});return exactCalls===1&&firstStatus!==200?json({error:{code:'READ_UNCONFIRMED'}},firstStatus):failCurrent?json({error:{code:'UNAUTHENTICATED'}},401):json(pending);}
  return json({items:[pending],next_cursor:null});
 });
 vi.stubEnv('VITE_EXTENSION_ID','a'.repeat(32));vi.stubGlobal('chrome',{runtime:{sendMessage:send}});vi.stubGlobal('fetch',fetch);
 return {batch,fetch,send,expire:()=>{failCurrent=true;}};
}
async function submit(){fireEvent.click(screen.getByRole('button',{name:'가져올 자료 확인'}));fireEvent.click(await screen.findByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'선택한 자료 가져오기'}));await waitFor(()=>expect(screen.getByRole('button',{name:'처리 결과 새로고침'})).toBeEnabled());}
it('known batch remains fenced if its initial exact GET fails and list still reports it PENDING',async()=>{
 const f=setup(503);render(<GuestImports owner="42"/>);await submit();await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'선택한 자료 가져오기'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'처리 결과 새로고침'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'처리 결과 새로고침'})).toBeEnabled());
 expect(screen.getByRole('checkbox')).toBeChecked();expect(f.send).toHaveBeenCalledTimes(2);
 expect(screen.getByRole('button',{name:'선택한 자료 가져오기'})).toBeDisabled();
 expect(f.fetch.mock.calls.filter(c=>c[0].endsWith(f.batch))).toHaveLength(2);
});
it('current exact pending read 401 expires auth and cannot consume a following history success',async()=>{
 const f=setup(200),expired=vi.fn();window.addEventListener('focurve:authentication-expired',expired);
 try{render(<GuestImports owner="42"/>);await submit();const before=f.fetch.mock.calls.length;f.expire();
  fireEvent.click(screen.getByRole('button',{name:'처리 결과 새로고침'}));await screen.findByRole('alert');
  expect(expired).toHaveBeenCalledOnce();expect(f.fetch).toHaveBeenCalledTimes(before+1);
  expect(screen.getByRole('checkbox')).toBeChecked();expect(screen.getByRole('button',{name:'선택한 자료 가져오기'})).toBeDisabled();expect(f.send).toHaveBeenCalledTimes(2);
 }finally{window.removeEventListener('focurve:authentication-expired',expired);}
});

it('malformed first exact result preserves known batch and requires its later terminal result before unlock',async()=>{
 const f=setup(200,true);render(<GuestImports owner="42"/>);await submit();await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'처리 결과 새로고침'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'처리 결과 새로고침'})).toBeEnabled());
 expect(f.fetch.mock.calls.filter(c=>c[0].endsWith(f.batch))).toHaveLength(2);
 expect(screen.getByRole('button',{name:'선택한 자료 가져오기'})).toBeDisabled();expect(screen.getByRole('checkbox')).toBeChecked();expect(f.send).toHaveBeenCalledTimes(2);
});
