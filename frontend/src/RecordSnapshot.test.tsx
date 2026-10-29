import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import Records from './BehaviorRecords';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('renders immutable Server snapshot rather than requiring the policy alias',async()=>{
 const e={event_id:'event',session_id:'session',occurred_at:'2026-10-21T01:00:00Z',target_host:'record.example.invalid',target_key:'SITE:record.example.invalid',event_type:'RECORDED_ACCESS',target_access_index:1,is_repeat:false,quality:'COMPLETE'};
 const json=(x:unknown)=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url.includes('/access-events?'))return json({items:[e],next_cursor:null});
  if(url.endsWith('/access-events/event'))return json({...e,snapshot:{sites:[{canonical_host:e.target_host,purpose:'DISTRACTION',access_policy:'RECORD',include_subdomains:true}]}});
  if(url.includes('/statistics'))return json({quality:'COMPLETE'});
  if(url.endsWith('/sessions/session'))return json({session_id:'session',started_at:e.occurred_at,ended_at:e.occurred_at});
  if(url.includes('/sessions?'))return json({items:[],next_cursor:null});
  throw Error(url);
 }));
 render(<Records initialHost="" initialRange={{from:'',to:''}} settings={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:/record.example.invalid.*상세/}));
 await screen.findByText(/적용 호스트: record.example.invalid/);
 expect(screen.queryByText('당시 일치하는 사이트 정책 정보가 없습니다. 전역 제한 사유는 위 차단 사유를 확인하세요.')).not.toBeInTheDocument();
});
