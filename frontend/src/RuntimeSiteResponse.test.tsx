import fixture from '../../contracts/fixtures/site-list.json';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import MemberApp from './MemberApp';
import {clearCsrf} from './api';
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it('renders the same owner-bound site response checked by the product Java route test',async()=>{
 window.history.replaceState(null,'','/?view=sites');
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  const url=String(input);const body=url.endsWith('/auth/me')?{user_id:'1',display_name:'통합 검증',providers:['EMAIL']}:url.endsWith('/extension-installations')?[]:fixture;
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 }));
 render(<MemberApp/>);await screen.findByText('통합 사이트');expect(screen.getByText('example.com')).toBeInTheDocument();expect(screen.getByText('허용하고 기록')).toBeInTheDocument();
 expect(screen.queryByText('집중 진행 중')).not.toBeInTheDocument();
});
