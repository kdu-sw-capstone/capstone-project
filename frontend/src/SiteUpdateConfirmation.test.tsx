import {afterEach,it,expect,vi} from 'vitest';import {render,screen,fireEvent,cleanup} from '@testing-library/react';import MemberApp from './MemberApp';import {clearCsrf} from './api';
const old={site_id:'1',canonical_host:'youtube.com',display_name:'Old Site',include_subdomains:true,purpose:'GENERAL',access_policy:'ALLOW',version:3,feature_policies:[{feature_code:'YOUTUBE_SHORTS',enabled:true}]};const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it.each(['stale-version','wrong-id','confirmed'])('%s PATCH confirms same resource and an advanced revision (HTTP mock)',async mode=>{
 let written=false,writes=0;const saved={...old,display_name:'Updated Site',version:mode==='stale-version'?3:4,site_id:mode==='wrong-id'?'2':'1'};
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/auth/csrf'))return reply({csrf_token:'synthetic'});if(url.endsWith('/auth/me'))return reply({user_id:'1',display_name:'Independent',providers:[]});if(url.endsWith('/extension-installations'))return reply([]);if(url.endsWith('/dashboard'))return reply({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  if(url==='/api/v1/sites/1'&&init?.method==='PATCH'){writes++;written=true;return reply(saved);}
  if(url==='/api/v1/sites')return reply({items:written?[saved]:[old],next_cursor:null});return reply({error:{code:'UNAVAILABLE'}},503);
 }));
 render(<MemberApp/>);fireEvent.click(await screen.findByRole('button',{name:'사이트 관리'}));await screen.findByText('Old Site');fireEvent.click(screen.getByRole('button',{name:'수정'}));fireEvent.change(screen.getByLabelText('사이트 이름',{exact:true}),{target:{value:'Updated Site'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));
 if(mode==='confirmed'){await screen.findByText(/^설정을 저장했습니다/);expect(screen.getByLabelText('사이트 이름',{exact:true})).toHaveValue('');}else{await screen.findByRole('alert');expect(screen.queryByText(/^설정을 저장했습니다/)).not.toBeInTheDocument();expect(screen.getByLabelText('사이트 이름',{exact:true})).toHaveValue('Updated Site');}expect(writes).toBe(1);
});
