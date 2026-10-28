import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import MemberApp from './MemberApp';import {clearCsrf} from './api';
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
async function form(){const writes:unknown[]=[];const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/auth/csrf'))return reply({csrf_token:'mock-only'});
  if(url.endsWith('/auth/me'))return reply({user_id:'1',display_name:'Synthetic',providers:['EMAIL']});
  if(url.endsWith('/extension-installations'))return reply([]);
  if(url.endsWith('/dashboard'))return reply({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  if(url==='/api/v1/sites'&&init?.method==='POST'){writes.push(init.body);return reply({error:{code:'VALIDATION_FAILED'}},422);}
  if(url.startsWith('/api/v1/sites'))return reply({items:[],next_cursor:null,has_more:false});
  return reply({error:{code:'PROVIDER_UNAVAILABLE'}},503);
 }));render(<MemberApp/>);fireEvent.click(await screen.findByRole('button',{name:'사이트 관리'}));await screen.findByText('등록된 사이트가 없습니다.');fireEvent.change(screen.getByLabelText('URL 또는 도메인'),{target:{value:'youtube.com'}});return {input:screen.getByLabelText('사이트 이름',{exact:true}) as HTMLInputElement,writes};
}
it('native input admits 100 code points including surrogate pairs (HTTP mock, no save)',async()=>{const {input,writes}=await form();fireEvent.change(input,{target:{value:'😀'.repeat(100)}});expect(input.maxLength===-1||input.maxLength>=200).toBe(true);expect(input.checkValidity()).toBe(true);expect(writes).toHaveLength(0);});
it.each(['a'.repeat(101),'😀'.repeat(101),'   ','\ud800','\udc00'])('invalid display name keeps input and prevents programmatic submit without HTTP write',async name=>{const {input,writes}=await form();fireEvent.change(input,{target:{value:name}});expect(input.checkValidity()).toBe(false);fireEvent.submit(input.closest('form')!);await screen.findByRole('alert');expect(writes).toHaveLength(0);expect(input.value).toBe(name);});
it('fixing the name clears stale native validation without an extra submission',async()=>{const {input,writes}=await form();fireEvent.change(input,{target:{value:'a'.repeat(101)}});expect(input.checkValidity()).toBe(false);fireEvent.change(input,{target:{value:'😀'.repeat(51)}});expect(input.checkValidity()).toBe(true);expect(writes).toHaveLength(0);});
