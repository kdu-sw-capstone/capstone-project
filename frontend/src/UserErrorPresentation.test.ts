import {afterEach,it,expect,vi} from 'vitest';
import {ApiError,clearCsrf,message,request} from './api';
afterEach(()=>{clearCsrf();vi.unstubAllGlobals();});
it('does not expose an unknown backend code or embedded diagnostic value',()=>{
 const text=message(new ApiError('INTERNAL_SECRET_DIAGNOSTIC_MARKER',500));expect(text).not.toContain('INTERNAL_SECRET');expect(text).toContain('입력을 유지');
});
it('retains actionable known authentication errors without showing the code',()=>{
 const text=message(new ApiError('INVALID_CREDENTIALS',401));expect(text).not.toContain('INVALID_CREDENTIALS');expect(text).toContain('비밀번호');
});

it('mail failures do not incorrectly describe password reset as signup',()=>{
 for(const code of ['MAIL_UNAVAILABLE','EMAIL_PROVIDER_NOT_CONFIGURED']){
  const text=message(new ApiError(code,503));expect(text).not.toContain('가입 성공');expect(text).toContain('메일 요청을 완료하지 못했습니다');
 }
});

it('a rejected installation start window gives timing guidance without exposing the error code',()=>{
 const text=message(new ApiError('INSTALLATION_START_WINDOW_CLOSED',409));
 expect(text).toContain('실행 기한');expect(text).toContain('거절');
 expect(text).toContain('다시 누르거나 기한을 늘리지 말고');
 expect(text).not.toContain('INSTALLATION_START_WINDOW_CLOSED');
 expect(text).not.toContain('요청을 완료하지 못했습니다');
});

it('timing guidance preserves the definitive HTTP rejection and does not replay START',async()=>{
 const fetch=vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/csrf')?{csrf_token:'test-csrf'}:{error:{code:'INSTALLATION_START_WINDOW_CLOSED',retryable:false}}),{status:url.endsWith('/csrf')?200:409,headers:{'Content-Type':'application/json'}}));
 vi.stubGlobal('fetch',fetch);clearCsrf();
 let failure:unknown;
 try{await request('/sessions','POST',{duration_minutes:3},{key:'test-start-key'});}catch(error){failure=error;}
 expect(failure).toBeInstanceOf(ApiError);expect(failure).toMatchObject({code:'INSTALLATION_START_WINDOW_CLOSED',status:409,retryable:false});
 expect(message(failure)).toContain('실행 기한');
 expect(fetch.mock.calls.filter(([url])=>url==='/api/v1/sessions')).toHaveLength(1);
});
