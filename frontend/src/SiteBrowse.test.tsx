import {afterEach, expect, it, vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import MemberApp from './MemberApp';
import {clearCsrf} from './api';
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it('filters and sorts loaded sites without changing policy, emitting requests or claiming all pages were searched',async()=>{
 window.history.replaceState(null,'','/?view=sites');const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  const url=String(input);calls.push(url);const site=(id:string,name:string,host:string,purpose:string)=>({site_id:id,display_name:name,canonical_host:host,purpose,access_policy:'RECORD',include_subdomains:true,version:1,feature_policies:[]});
  const body=url.endsWith('/auth/me')?{user_id:'1',display_name:'검증',providers:['EMAIL']}:
   url.endsWith('/extension-installations')?[]:{items:[site('1','Alpha','alpha.example.com','FOCUS'),site('2','Beta','beta.example.com','DISTRACTION')],next_cursor:'next-page',has_more:true};
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 }));
 render(<MemberApp/>);await screen.findByText('Alpha');const count=calls.length;
 fireEvent.change(screen.getByRole('searchbox',{name:'사이트 검색'}),{target:{value:'beta.example'}});expect(screen.queryByText('Alpha')).not.toBeInTheDocument();expect(screen.getByText('Beta')).toBeInTheDocument();
 fireEvent.click(within(screen.getByRole('group',{name:'사이트 분류 필터'})).getByRole('button',{name:'집중'}));expect(screen.getByText('검색 조건에 맞는 사이트가 없습니다.')).toBeInTheDocument();expect(screen.getByText(/더 보기로 나머지 사이트/)).toBeInTheDocument();expect(calls.length).toBe(count);
 fireEvent.change(screen.getByRole('searchbox',{name:'사이트 검색'}),{target:{value:''}});fireEvent.click(within(screen.getByRole('group',{name:'사이트 분류 필터'})).getByRole('button',{name:'전체'}));fireEvent.change(screen.getByLabelText('이름 정렬'),{target:{value:'desc'}});
 const rows=document.querySelectorAll('.site-list .site-identity strong');expect([...rows].map(row=>row.textContent)).toEqual(['Beta','Alpha']);expect(calls.length).toBe(count);
});
