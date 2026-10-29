import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import MemberApp from './MemberApp';import {clearCsrf} from './api';
const saved={site_id:'1',canonical_host:'youtube.com',display_name:'S0 YouTube',include_subdomains:true,purpose:'GENERAL',access_policy:'ALLOW',version:1,feature_policies:[{feature_code:'YOUTUBE_SHORTS',enabled:true}]};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
async function setup(mode:string){let written=false,lists=0;const writes:RequestInit[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/auth/csrf'))return reply({csrf_token:'mock-only'});
  if(url.endsWith('/auth/me'))return reply({user_id:'1',display_name:'Isolated Test',providers:['GOOGLE']});
  if(url.endsWith('/extension-installations'))return reply([]);
  if(url.endsWith('/dashboard'))return reply({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  if(url==='/api/v1/sites'&&init?.method==='POST'){writes.push(init);if(mode==='reject')return reply({error:{code:'VALIDATION_FAILED'}},422);written=true;return reply(mode==='malformed'?{}:saved,201);}
  if(url==='/api/v1/sites/1')return reply(saved);
  if(url.startsWith('/api/v1/sites')){
   if(written&&mode==='read-error')return reply({error:{code:'FORBIDDEN'}},403);
   const items=!written||mode==='empty'||mode==='malformed'?[]:mode==='stale'?[{...saved,version:0}]:mode==='mismatch'?[{...saved,access_policy:'BLOCK'}]:mode==='pagination'?(lists++===0?[{...saved,site_id:'2',canonical_host:'example.org',display_name:'Other'}]:[saved]):[saved];
   return reply({items,next_cursor:written&&mode==='pagination'&&lists===1?'next':null,has_more:written&&mode==='pagination'&&lists===1});
  }return reply({error:{code:'PROVIDER_UNAVAILABLE'}},503);
 }));
 render(<MemberApp/>);fireEvent.click(await screen.findByRole('button',{name:'사이트 관리'}));await screen.findByText('등록된 사이트가 없습니다.');
 fireEvent.change(screen.getByLabelText('URL 또는 도메인'),{target:{value:'youtube.com'}});fireEvent.change(screen.getByLabelText('사이트 이름',{exact:true}),{target:{value:'S0 YouTube'}});fireEvent.change(screen.getByLabelText('목적',{exact:true}),{target:{value:'GENERAL'}});fireEvent.click(screen.getByLabelText('YouTube Shorts 제한',{exact:true}));fireEvent.click(screen.getByRole('button',{name:'저장'}));return {writes};
}
it.each(['empty','stale','mismatch','malformed'])('%s readback cannot announce success or discard input (HTTP mock)',async mode=>{
 const {writes}=await setup(mode);await screen.findByRole('alert');expect(screen.queryByText(/^설정을 저장했습니다/)).not.toBeInTheDocument();expect(screen.getByLabelText('URL 또는 도메인')).toHaveValue('youtube.com');expect(screen.getByLabelText('사이트 이름',{exact:true})).toHaveValue('S0 YouTube');expect(writes).toHaveLength(1);
});
it('matching readback confirms success (HTTP mock)',async()=>{const {writes}=await setup('match');await screen.findByText(/^설정을 저장했습니다/);expect(screen.getByLabelText('URL 또는 도메인')).toHaveValue('');expect(writes).toHaveLength(1);});
it.each(['reject','read-error'])('%s preserves input and sends only one write (HTTP mock)',async mode=>{const {writes}=await setup(mode);await screen.findByRole('alert');expect(screen.queryByText(/^설정을 저장했습니다/)).not.toBeInTheDocument();expect(screen.getByLabelText('URL 또는 도메인')).toHaveValue('youtube.com');expect(writes).toHaveLength(1);});
it('paginated list confirms by single-record read and avoids duplicate cards (HTTP mock)',async()=>{await setup('pagination');await screen.findByText(/^설정을 저장했습니다/);expect(document.querySelectorAll('.site-list li')).toHaveLength(2);fireEvent.click(screen.getByRole('button',{name:'더 보기'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'더 보기'})).not.toBeInTheDocument());expect(document.querySelectorAll('.site-list li')).toHaveLength(2);});
