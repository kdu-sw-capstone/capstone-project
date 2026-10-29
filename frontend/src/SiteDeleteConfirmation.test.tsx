import {afterEach,it,expect,vi} from 'vitest';import {render,screen,fireEvent,cleanup} from '@testing-library/react';import MemberApp from './MemberApp';import {clearCsrf} from './api';
const site={site_id:'1',canonical_host:'example.org',display_name:'Delete Target',include_subdomains:true,purpose:'GENERAL',access_policy:'ALLOW',version:1,feature_policies:[]};
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it.each(['retained','read-error','list-race','confirmed'])('%s DELETE confirmation preserves truthful result (HTTP mock)',async mode=>{
 let deleted=false,writes=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/auth/csrf'))return reply({csrf_token:'synthetic'});
  if(url.endsWith('/auth/me'))return reply({user_id:'1',display_name:'Independent',providers:[]});
  if(url.endsWith('/extension-installations'))return reply([]);
  if(url.endsWith('/dashboard'))return reply({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  if(url==='/api/v1/sites/1'&&init?.method==='DELETE'){writes++;deleted=true;return new Response(null,{status:204});}
  if(url==='/api/v1/sites/1')return mode==='read-error'?reply({error:{code:'FORBIDDEN'}},403):mode==='retained'?reply(site):reply({error:{code:'NOT_FOUND'}},404);
  if(url==='/api/v1/sites')return reply({items:!deleted||['retained','list-race'].includes(mode)?[site]:[],next_cursor:null});
  return reply({error:{code:'UNAVAILABLE'}},503);
 }));
 render(<MemberApp/>);fireEvent.click(await screen.findByRole('button',{name:'사이트 관리'}));await screen.findByText('Delete Target');fireEvent.click(screen.getByRole('button',{name:'삭제'}));fireEvent.click(screen.getByRole('button',{name:'삭제 확인'}));
 if(mode==='confirmed'){await screen.findByText(/^사이트를 삭제했습니다/);expect(screen.queryByRole('region',{name:'사이트 삭제 확인'})).not.toBeInTheDocument();}
 else{await screen.findByRole('alert');expect(screen.queryByText(/^사이트를 삭제했습니다/)).not.toBeInTheDocument();expect(screen.getByRole('region',{name:'사이트 삭제 확인'})).toBeInTheDocument();}
 expect(writes).toBe(1);
});
