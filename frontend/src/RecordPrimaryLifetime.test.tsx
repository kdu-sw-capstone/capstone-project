import {StrictMode} from "react";
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import Records from './BehaviorRecords';
import {request,ApiError} from './api';
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),request:vi.fn()}));
const item={event_id:'e1',session_id:'s1',occurred_at:'2026-11-01T01:00:00.000Z',target_host:'valid.example',target_key:'SITE:valid.example',event_type:'RECORDED_ACCESS',target_access_index:1,is_repeat:false,quality:'PARTIAL'};
const show=()=>render(<Records initialHost='' initialRange={{from:'',to:''}} settings={()=>{}}/>);
function defer(){let resolve!:(v:any)=>void,reject!:(e:any)=>void;const promise=new Promise<any>((r,j)=>{resolve=r;reject=j;});return {resolve,reject,promise};}
afterEach(()=>vi.mocked(request).mockReset());
it('independent obsolete primary GET401 after navigation must not expire the new view',async()=>{
 const pending=defer(),expired=vi.fn();window.addEventListener('focurve:authentication-expired',expired);
 try{vi.mocked(request).mockImplementation(()=>pending.promise);const view=show();await waitFor(()=>expect(request).toHaveBeenCalled());view.unmount();vi.mocked(request).mockImplementation(async path=>path.startsWith('/access-events?')?{items:[item],next_cursor:null}:path.startsWith('/statistics')?{quality:'PARTIAL'}:{items:[],next_cursor:null});show();await screen.findByRole('button',{name:/valid.example.*상세/});await act(async()=>pending.reject(new ApiError('UNAUTHENTICATED',401)));expect(expired).not.toHaveBeenCalled();}finally{window.removeEventListener('focurve:authentication-expired',expired);}
});
it('independent obsolete auxiliary401 after unmount is consumed',async()=>{
 const pending=defer(),expired=vi.fn();window.addEventListener('focurve:authentication-expired',expired);
 try{vi.mocked(request).mockImplementation(async path=>path.startsWith('/access-events?')?{items:[item],next_cursor:null}:pending.promise);const view=show();await screen.findByRole('button',{name:/valid.example.*상세/});await waitFor(()=>expect(vi.mocked(request).mock.calls).toHaveLength(3));view.unmount();vi.mocked(request).mockImplementation(async path=>path.startsWith('/access-events?')?{items:[item],next_cursor:null}:path.startsWith('/statistics')?{quality:'PARTIAL'}:{items:[],next_cursor:null});show();await screen.findByRole('button',{name:/valid.example.*상세/});await act(async()=>pending.reject(new ApiError('UNAUTHENTICATED',401)));expect(expired).not.toHaveBeenCalled();}finally{window.removeEventListener('focurve:authentication-expired',expired);}
});
it('independent current primary401 still expires authentication and cannot display a successful empty list',async()=>{
 const expired=vi.fn();window.addEventListener('focurve:authentication-expired',expired);
 try{vi.mocked(request).mockRejectedValue(new ApiError('UNAUTHENTICATED',401));show();await screen.findByRole('alert');expect(expired).toHaveBeenCalledTimes(1);expect(screen.queryByText('조회된 접근 기록이 없습니다.')).not.toBeInTheDocument();}finally{window.removeEventListener('focurve:authentication-expired',expired);}
});
it('independent auxiliary delays preserve record detail interaction and edited filter without writes',async()=>{
 const pending=defer();vi.mocked(request).mockImplementation(async path=>path.startsWith('/access-events?')?{items:[item],next_cursor:null}:path==='/access-events/e1'?item:pending.promise);show();fireEvent.click(await screen.findByRole('button',{name:/valid.example.*상세/}));await screen.findByText('발생 당시 적용 정책');fireEvent.click(screen.getByRole('button',{name:'기록 목록으로'}));fireEvent.change(screen.getByLabelText('대상 도메인'),{target:{value:'next.example'}});expect(screen.getByRole('button',{name:'조회'})).toBeEnabled();expect(screen.getByLabelText('대상 도메인')).toHaveValue('next.example');expect(screen.getByText(/아래는 이전 조회 결과/)).toBeInTheDocument();expect(vi.mocked(request).mock.calls.every(c=>!c[1]||c[1]==='GET')).toBe(true);
});
it('independent A-B-A auxiliary responses cannot overwrite current PARTIAL or sessions',async()=>{
 const old=defer(),middle=defer();let scope=0;
 vi.mocked(request).mockImplementation(async path=>{if(path.startsWith('/access-events?')){scope++;return {items:[item],next_cursor:null};}return scope===1?old.promise:scope===2?middle.promise:path.startsWith('/statistics')?{quality:'PARTIAL'}:{items:[],next_cursor:null};});show();await screen.findByRole('button',{name:/valid.example.*상세/});await waitFor(()=>expect(vi.mocked(request).mock.calls).toHaveLength(3));
 for(const host of ['b.example','']){fireEvent.change(screen.getByLabelText('대상 도메인'),{target:{value:host}});fireEvent.click(screen.getByRole('button',{name:'조회'}));await waitFor(()=>expect(screen.getByRole('button',{name:'조회'})).toBeEnabled());}
 await waitFor(()=>expect(document.querySelector('.collection-status')).toHaveTextContent('일부 수집'));
 await act(async()=>{middle.resolve({quality:'COMPLETE',items:[],next_cursor:null});old.resolve({quality:'NO_DATA',items:[],next_cursor:null});});expect(document.querySelector('.collection-status')).toHaveTextContent('일부 수집');expect(screen.getByRole('button',{name:/valid.example.*상세/})).toBeInTheDocument();
});



it.each(['refresh','cursor'])('obsolete %s primary GET401 is aborted and cannot expire a newly mounted view',async(mode)=>{
 const pending=defer(),expired=vi.fn();let owner='a',reads=0;window.addEventListener('focurve:authentication-expired',expired);
 try{
  vi.mocked(request).mockImplementation(async path=>{
   if(path.startsWith('/access-events?')){if(owner==='a'&&++reads>1)return pending.promise;return {items:[item],next_cursor:owner==='a'?'more':null};}
   return path.startsWith('/statistics')?{quality:'PARTIAL'}:{items:[],next_cursor:null};
  });
  const view=show();await screen.findByRole('button',{name:/valid.example.*상세/});await waitFor(()=>expect(screen.getByRole('button',{name:'조회'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:mode==='refresh'?'조회':'이전 기록 더 보기'}));await waitFor(()=>expect(reads).toBe(2));
  const calls=vi.mocked(request).mock.calls.filter(c=>c[0].startsWith('/access-events?')),signal=calls[1][3]!.signal!;
  expect(signal.aborted).toBe(false);view.unmount();expect(signal.aborted).toBe(true);owner='b';show();await screen.findByRole('button',{name:/valid.example.*상세/});
  await act(async()=>pending.reject(new ApiError('UNAUTHENTICATED',401)));expect(expired).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:/valid.example.*상세/})).toBeInTheDocument();
 }finally{window.removeEventListener('focurve:authentication-expired',expired);}
});
it('aborts an obsolete primary success and never starts auxiliary reads for that old result',async()=>{
 const pending=defer();let current=false;vi.mocked(request).mockImplementation(async path=>path.startsWith('/access-events?')?(current?{items:[item],next_cursor:null}:pending.promise):path.startsWith('/statistics')?{quality:'PARTIAL'}:{items:[],next_cursor:null});
 const view=show();await waitFor(()=>expect(request).toHaveBeenCalledOnce());const signal=vi.mocked(request).mock.calls[0][3]!.signal!;view.unmount();expect(signal.aborted).toBe(true);
 current=true;show();await screen.findByRole('button',{name:/valid.example.*상세/});await act(async()=>pending.resolve({items:[{...item,target_host:'obsolete.example'}],next_cursor:null}));
 expect(screen.queryByRole('button',{name:/obsolete.example.*상세/})).not.toBeInTheDocument();expect(vi.mocked(request).mock.calls.filter(c=>!c[0].startsWith('/access-events?'))).toHaveLength(2);
});
it('StrictMode recreation performs one live initial record query',async()=>{
 vi.mocked(request).mockImplementation(async path=>path.startsWith('/access-events?')?{items:[item],next_cursor:null}:path.startsWith('/statistics')?{quality:'PARTIAL'}:{items:[],next_cursor:null});
 render(<StrictMode><Records initialHost='' initialRange={{from:'',to:''}} settings={()=>{}}/></StrictMode>);await screen.findByRole('button',{name:/valid.example.*상세/});expect(vi.mocked(request).mock.calls.filter(c=>c[0].startsWith('/access-events?'))).toHaveLength(1);
});
