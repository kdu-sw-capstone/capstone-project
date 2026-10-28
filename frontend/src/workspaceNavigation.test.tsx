import {afterEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor, cleanup} from '@testing-library/react';
import {requestedWorkspaceView, workspaceViews} from './workspaceNavigation';
import MemberApp from './MemberApp';
import {clearCsrf} from './api';
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
describe('Extension → authenticated Web screen contract',()=>{
 it('accepts only one allowlisted view, never arbitrary navigation or an action',()=>{
  for(const view of workspaceViews)expect(requestedWorkspaceView('?view='+view)).toBe(view);
  for(const query of ['?view=javascript:alert(1)','?view=START','?view=https://other.invalid','?view=sites&view=sessions','?view=',''])expect(requestedWorkspaceView(query)).toBe('dashboard');
 });
 it('opens the requested site screen only after the current member is confirmed',async()=>{
  window.history.replaceState(null,'','/?view=sites');const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
   const url=String(input);calls.push(url);
   const body=url.endsWith('/auth/me')?{user_id:'1',display_name:'통합 시험',email:'fixture@example.invalid',providers:['EMAIL']}:
    url.includes('/extension-installations')?[]:url.includes('/sites')?{items:[],next_cursor:null,has_more:false}:{};
   return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  }));
  render(<MemberApp/>);await screen.findByRole('heading',{name:'사이트 관리'});await screen.findByText('등록된 사이트가 없습니다.');
  expect(calls.some(x=>x.includes('/sites'))).toBe(true);expect(calls.some(x=>x.includes('/sessions'))).toBe(false);
 });
 it('does not reveal member screens or send a focus request when not authenticated',async()=>{
  window.history.replaceState(null,'','/?view=sessions');const fetch=vi.fn(async()=>new Response(JSON.stringify({error:{code:'AUTH_REQUIRED'}}),{status:401,headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch);
  render(<MemberApp/>);await waitFor(()=>expect(fetch).toHaveBeenCalled());expect(screen.queryByRole('button',{name:'집중 시작'})).not.toBeInTheDocument();
  expect(fetch.mock.calls.every((args:unknown[])=>!String(args[0]).includes('/sessions'))).toBe(true);
 });
});
