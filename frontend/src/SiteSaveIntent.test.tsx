import {afterEach,it,expect,vi} from 'vitest';import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import MemberApp from './MemberApp';import {clearCsrf} from './api';
const saved={site_id:'1',canonical_host:'youtube.com',display_name:'S0 YouTube',include_subdomains:true,purpose:'GENERAL',access_policy:'ALLOW',version:1,feature_policies:[{feature_code:'YOUTUBE_SHORTS',enabled:true}]};
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it.each(['feature','subdomains','purpose','name','host'])('matching response/readback with changed %s cannot erase user intent (HTTP mock)',async mode=>{
 let writes=0,written=false;const altered={...saved,...(mode==='feature'?{feature_policies:[]}:mode==='subdomains'?{include_subdomains:false}:mode==='purpose'?{purpose:'FOCUS'}:mode==='host'?{canonical_host:'other.example'}:{display_name:'Different'})};
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/auth/csrf'))return reply({csrf_token:'synthetic'});
  if(url.endsWith('/auth/me'))return reply({user_id:'1',display_name:'Independent',providers:['GOOGLE']});
  if(url.endsWith('/extension-installations'))return reply([]);
  if(url.endsWith('/dashboard'))return reply({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  if(url==='/api/v1/sites'&&init?.method==='POST'){writes++;written=true;return reply(altered,201);}
  if(url.startsWith('/api/v1/sites'))return reply({items:written?[altered]:[],next_cursor:null});
  return reply({error:{code:'UNAVAILABLE'}},503);
 }));
 render(<MemberApp/>);fireEvent.click(await screen.findByRole('button',{name:'사이트 관리'}));await screen.findByText('등록된 사이트가 없습니다.');
 fireEvent.change(screen.getByLabelText('URL 또는 도메인'),{target:{value:'https://youtube.com'}});fireEvent.change(screen.getByLabelText('사이트 이름',{exact:true}),{target:{value:'S0 YouTube'}});fireEvent.change(screen.getByLabelText('목적',{exact:true}),{target:{value:'GENERAL'}});fireEvent.click(screen.getByLabelText('YouTube Shorts 제한',{exact:true}));fireEvent.click(screen.getByRole('button',{name:'저장'}));
 await screen.findByRole('alert');expect(screen.queryByText(/^설정을 저장했습니다/)).not.toBeInTheDocument();
 expect(screen.getByLabelText('URL 또는 도메인')).toHaveValue('https://youtube.com');expect(screen.getByLabelText('사이트 이름',{exact:true})).toHaveValue('S0 YouTube');expect(writes).toBe(1);
});
