import {readFileSync} from 'node:fs';
import {afterEach, expect, it, vi} from 'vitest';
import {waitFor} from '@testing-library/react';
const directory=process.cwd()+'/../extension/member-ui/';
const html=readFileSync(directory+'popup.html','utf8');
const script=readFileSync(directory+'user.js','utf8');
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function mount({ready=true,held=false,invalid=false,running=false}={}){
 document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'').replace(/<script[\s\S]*?<\/script>/g,'');
 const act=vi.fn(),close=vi.fn(),set=vi.fn(async()=>{});
 const state={phase:'LINKED',guest_start_allowed:false,error:null};
 vi.stubGlobal('FOCURVE_DEPLOYMENT',{launchId:'synthetic-launch',launchDeadlineUTC:new Date(Date.now()+3600000).toISOString()});
 vi.stubGlobal('FocurveDeploymentBinding',{config:()=>{if(invalid)throw Error('MISSING');return {web_origin:'https://localhost:18447',server_url:'https://localhost:18447/api/v1'};},stateMatches:()=>true});
 vi.stubGlobal('chrome',{storage:{local:{get:async()=>({focurve_user_ui_hold:held?{unconfirmed:true}:null,focurve_installation_ready_launch:ready?'synthetic-launch':null}),set,remove:vi.fn()},onChanged:{addListener:vi.fn()}},runtime:{sendMessage:vi.fn()}});
 vi.stubGlobal('FocurveUserPopup',{controller:(options:{onChange:(v:object)=>void})=>{
  act.mockImplementation(async()=>{options.onChange({headline:running?'집중 진행 중':'집중 세션을 시작하세요',detail:'현재 설치 확인됨',linked:true,state,ready,busy:false,running,canStart:ready&&!running,canEnd:ready&&running,canConnect:false,canClaim:false,canManage:ready});return false;});
  return {act,held:()=>held,close,view:()=>({busy:false,canStart:ready&&!running,canEnd:ready&&running})};
 }});
 Function(script)();await new Promise(resolve=>setTimeout(resolve,0));return {act,set};
}
it('renders branded links to the exact authenticated Web views without starting a session',async()=>{
 const {act}=await mount();await waitFor(()=>expect(document.querySelector('#account-badge')?.textContent).toBe('회원 연결됨'));
 expect(document.querySelector('#focus-web')?.getAttribute('href')).toBe('https://localhost:18447/?view=sessions');
 expect(document.querySelector('#sites-web')?.getAttribute('href')).toBe('https://localhost:18447/?view=sites');
 expect(document.querySelectorAll('input[type=url],pre,textarea')).toHaveLength(0);
 expect(act.mock.calls.map(args=>args[0])).toEqual(['STATE']);expect((document.querySelector('#start') as HTMLButtonElement).disabled).toBe(false);
});
it('shows pending deployment as pending and does not offer START',async()=>{
 await mount({ready:false});expect(document.querySelector('#headline')?.textContent).toBe('프로그램을 준비하고 있어요');expect((document.querySelector('#start') as HTMLButtonElement).disabled).toBe(true);
});
it('preserves an uncertain operation and sends no repeated STATE, START or END',async()=>{
 const {act}=await mount({held:true});expect(document.querySelector('#headline')?.textContent).toBe('이전 작업의 확인이 필요해요');expect(act).not.toHaveBeenCalled();expect((document.querySelector('#start') as HTMLButtonElement).disabled).toBe(true);
});
it('keeps missing deployment links disabled and presents a friendly error',async()=>{
 const {act}=await mount({invalid:true});expect(document.querySelector('#headline')?.textContent).toBe('설치 설정을 확인해 주세요');expect(document.querySelector('#sites-web')?.getAttribute('aria-disabled')).toBe('true');expect(act).not.toHaveBeenCalled();
});
it('only offers END after observed RUNNING, and supports a local theme choice',async()=>{
 const {set}=await mount({running:true});expect((document.querySelector('#end') as HTMLButtonElement).hidden).toBe(false);expect((document.querySelector('#start') as HTMLButtonElement).hidden).toBe(true);
 const theme=document.querySelector('#theme') as HTMLSelectElement;theme.value='dark';theme.dispatchEvent(new Event('change'));await waitFor(()=>expect(set).toHaveBeenCalledWith({focurve_ui_theme:'dark'}));expect(document.documentElement.dataset.theme).toBe('dark');
});
