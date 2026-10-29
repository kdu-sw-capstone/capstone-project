import {afterEach,it,expect,vi} from 'vitest';import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';import MemberApp from './MemberApp';import {clearCsrf} from './api';
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});let release:(()=>void)|undefined;
afterEach(()=>{release?.();release=undefined;cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it('pending save locks current intent, then failed response unlocks the preserved input (HTTP mock)',async()=>{
 let writes=0;vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/auth/csrf'))return reply({csrf_token:'synthetic'});if(url.endsWith('/auth/me'))return reply({user_id:'1',display_name:'Independent',providers:[]});if(url.endsWith('/extension-installations'))return reply([]);if(url.endsWith('/dashboard'))return reply({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  if(url==='/api/v1/sites'&&init?.method==='POST'){writes++;return new Promise<Response>(resolve=>{release=()=>resolve(reply({error:{code:'UNAVAILABLE'}},503));});}
  if(url==='/api/v1/sites')return reply({items:[],next_cursor:null});return reply({error:{code:'UNAVAILABLE'}},503);
 }));
 render(<MemberApp/>);fireEvent.click(await screen.findByRole('button',{name:'사이트 관리'}));await screen.findByText('등록된 사이트가 없습니다.');fireEvent.change(screen.getByLabelText('URL 또는 도메인'),{target:{value:'https://youtube.com'}});fireEvent.change(screen.getByLabelText('사이트 이름',{exact:true}),{target:{value:'Keep this intent'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));
 await waitFor(()=>expect(screen.getByLabelText('URL 또는 도메인')).toBeDisabled());for(const label of ['사이트 이름','하위 도메인 포함','목적','접근 정책','YouTube Shorts 제한'])expect(screen.getByLabelText(label,{exact:true})).toBeDisabled();
 release?.();await screen.findByRole('alert');expect(screen.getByLabelText('URL 또는 도메인')).toBeEnabled();expect(screen.getByLabelText('사이트 이름',{exact:true})).toHaveValue('Keep this intent');expect(writes).toBe(1);
});
