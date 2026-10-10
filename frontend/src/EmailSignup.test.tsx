import {beforeEach,describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import EmailSignup from './EmailSignup';
import {ApiError} from './api';
const api=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('./api',async importOriginal=>({...await importOriginal<typeof import('./api')>(),request:api.request}));
const expiry=()=>new Date(Date.now()+600000).toISOString();
beforeEach(()=>{cleanup();sessionStorage.clear();api.request.mockReset();});

it('첫 요청의 시간당 제한을 분·초로 안내하고 입력창을 만들지 않는다',async()=>{
 api.request.mockRejectedValueOnce(new ApiError('RATE_LIMITED',429,true,3540));render(<EmailSignup terms={null}/>);
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));
 expect(await screen.findByRole('status')).toHaveTextContent('59분 0초 후');expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'인증번호 받기'})).toBeDisabled();
});
it('한도에 도달한 성공 응답도 긴 재발송 대기를 표시한다',async()=>{
 api.request.mockResolvedValueOnce({request_id:'fixture',expires_at:expiry(),resend_after_seconds:3540});render(<EmailSignup terms={null}/>);
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));
 expect(await screen.findByRole('button',{name:/재발송 59분 0초 후/})).toBeDisabled();expect(screen.getByLabelText('인증번호')).toBeInTheDocument();
});
it('번호 확인IP 제한이 긴 발송 제한을 덮어쓰지 않는다',async()=>{
 api.request.mockResolvedValueOnce({request_id:'fixture',expires_at:expiry(),resend_after_seconds:3540}).mockRejectedValueOnce(new ApiError('RATE_LIMITED',429,true,30));render(<EmailSignup terms={null}/>);
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));fireEvent.change(await screen.findByLabelText('인증번호'),{target:{value:'001234'}});fireEvent.click(screen.getByRole('button',{name:'확인'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('0분 30초 후 인증번호를 다시 확인');expect(screen.getByRole('button',{name:/재발송 59분 0초 후/})).toBeDisabled();
});
it('남은1초를60초로 늘리지 않고 제한이 끝나면 다시 요청할 수 있다',async()=>{
 vi.useFakeTimers();try {
 api.request.mockRejectedValueOnce(new ApiError('RATE_LIMITED',429,true,1));render(<EmailSignup terms={null}/>);
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));
 await act(async()=>{await Promise.resolve();});expect(screen.getByRole('status')).toHaveTextContent('0분 1초 후');expect(screen.getByRole('button',{name:'인증번호 받기'})).toBeDisabled();
 await act(async()=>{vi.advanceTimersByTime(1000);});expect(screen.getByRole('button',{name:'인증번호 받기'})).toBeEnabled();expect(screen.queryByRole('status')).not.toBeInTheDocument();
 } finally {vi.useRealTimers();}
});
describe('이메일 가입 인증번호',()=>{
 it('검증 전 가입을 막고 Mailpit 링크를 표시하지 않는다',()=>{render(<EmailSignup terms={null}/>);expect(screen.getByRole('button',{name:'회원가입'})).toBeDisabled();expect(screen.queryByRole('link',{name:/Mailpit/})).not.toBeInTheDocument();});
 it('요청·확인 후 가입 증명을 보내고 완료 화면으로 전환한다',async()=>{
  api.request.mockResolvedValueOnce({request_id:'fixture',expires_at:expiry(),resend_after_seconds:60}).mockResolvedValueOnce({verification_proof:'synthetic-proof',proof_expires_at:expiry()}).mockResolvedValueOnce({status:'ACTIVE'});
  render(<EmailSignup terms={null}/>);fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));
  fireEvent.change(await screen.findByLabelText('인증번호'),{target:{value:'001 234'}});fireEvent.keyDown(screen.getByLabelText('인증번호'),{key:'Enter'});await screen.findByText('✓ 이메일 인증 완료');
  fireEvent.change(screen.getByLabelText('표시명'),{target:{value:'테스트'}});fireEvent.change(screen.getByLabelText('비밀번호',{exact:true}),{target:{value:'synthetic-test-password'}});fireEvent.change(screen.getByLabelText('비밀번호 확인'),{target:{value:'synthetic-test-password'}});
  fireEvent.click(screen.getByRole('button',{name:'회원가입'}));await screen.findByRole('heading',{name:'가입 완료'});expect(api.request.mock.calls[2][2]).toMatchObject({email:'test@example.invalid',verification_proof:'synthetic-proof'});await waitFor(()=>expect(sessionStorage.getItem('focurve:email-signup-code')).not.toContain('synthetic-proof'));
 });
 it('번호 오입력 오류에서 다른 입력을 보존하고 중복 발송을 방지한다',async()=>{
  let resolve!: (v:unknown)=>void;api.request.mockImplementationOnce(()=>new Promise(r=>resolve=r));render(<EmailSignup terms={null}/>);
  fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.change(screen.getByLabelText('표시명'),{target:{value:'보존'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));fireEvent.click(screen.getByRole('button',{name:'발송 중…'}));expect(api.request).toHaveBeenCalledTimes(1);
  resolve({request_id:'fixture',expires_at:expiry(),resend_after_seconds:60});await screen.findByLabelText('인증번호');fireEvent.change(screen.getByLabelText('인증번호'),{target:{value:'12345'}});fireEvent.click(screen.getByRole('button',{name:'확인'}));expect(await screen.findByRole('alert')).toHaveTextContent('숫자 6자리');expect(screen.getByLabelText('표시명')).toHaveValue('보존');expect(api.request).toHaveBeenCalledTimes(1);
 });
 it('새로고침 복원 시 만료 안내를 표시하고 번호 확인을 막는다',()=>{
  sessionStorage.setItem('focurve:email-signup-code',JSON.stringify({schema:2,email:'test@example.invalid',request_id:'fixture',expires_at:new Date(Date.now()-1000).toISOString()}));render(<EmailSignup terms={null}/>);
  expect(screen.getByLabelText('이메일')).toHaveValue('test@example.invalid');expect(screen.getByRole('button',{name:'확인'})).toBeDisabled();expect(screen.getByText(/인증번호가 만료/)).toBeInTheDocument();expect(screen.getByLabelText('비밀번호',{exact:true})).toHaveValue('');
 });
});

describe('인라인 이메일 인증 상태와 가입 실패',()=>{
 async function checked(){api.request.mockResolvedValueOnce({request_id:'fixture',expires_at:expiry(),resend_after_seconds:60}).mockResolvedValueOnce({verification_proof:'synthetic-proof',proof_expires_at:expiry()});render(<EmailSignup terms={null}/>);fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));fireEvent.change(await screen.findByLabelText('인증번호'),{target:{value:'001234'}});fireEvent.click(screen.getByRole('button',{name:'확인'}));await screen.findByText('✓ 이메일 인증 완료');}
 it('인증 후 재발송·번호·안내를 접고 이메일 변경 시 증명을 제거한다',async()=>{
  await checked();expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();expect(screen.queryByText(/남은 시간|재발송|인증번호를 보냈/)).not.toBeInTheDocument();expect(screen.getByLabelText('이메일')).toHaveAttribute('readonly');
  fireEvent.click(screen.getByRole('button',{name:'이메일 변경'}));expect(screen.queryByText('✓ 이메일 인증 완료')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'회원가입'})).toBeDisabled();expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly');await waitFor(()=>expect(sessionStorage.getItem('focurve:email-signup-code')).not.toContain('synthetic-proof'));
 });
 it('발송 실패를 이메일 영역에 표시하고 기존 입력을 보존한다',async()=>{
  api.request.mockRejectedValueOnce(new ApiError('MAIL_UNAVAILABLE',503));render(<EmailSignup terms={null}/>);fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.change(screen.getByLabelText('표시명'),{target:{value:'유지'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));expect((await screen.findByRole('alert')).closest('.signup-email')).not.toBeNull();expect(screen.getByLabelText('표시명')).toHaveValue('유지');expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();
 });
 it.each(['CODE_INVALID','CODE_EXPIRED','CODE_ATTEMPTS_EXCEEDED'])('%s 오류를 해당 영역에 표시하며 인증하지 않는다',async(errorCode)=>{
  api.request.mockResolvedValueOnce({request_id:'fixture',expires_at:expiry(),resend_after_seconds:60}).mockRejectedValueOnce(new ApiError(errorCode,errorCode==='CODE_ATTEMPTS_EXCEEDED'?429:errorCode==='CODE_EXPIRED'?410:422));render(<EmailSignup terms={null}/>);fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));fireEvent.change(await screen.findByLabelText('인증번호'),{target:{value:'001234'}});fireEvent.click(screen.getByRole('button',{name:'확인'}));expect((await screen.findByRole('alert')).closest('.signup-email')).not.toBeNull();expect(screen.getByRole('button',{name:'회원가입'})).toBeDisabled();
 });
 it('가입 실패에서 인증 상태·입력·멱등 키를 보존한다',async()=>{
  await checked();api.request.mockRejectedValueOnce(new ApiError('EMAIL_IN_USE',409)).mockRejectedValueOnce(new ApiError('EMAIL_IN_USE',409));
  fireEvent.change(screen.getByLabelText('표시명'),{target:{value:'유지'}});fireEvent.change(screen.getByLabelText('비밀번호',{exact:true}),{target:{value:'synthetic-test-password'}});fireEvent.change(screen.getByLabelText('비밀번호 확인'),{target:{value:'synthetic-test-password'}});fireEvent.click(screen.getByRole('button',{name:'회원가입'}));await screen.findByRole('alert');expect(screen.getByLabelText('표시명')).toHaveValue('유지');expect(screen.getByText('✓ 이메일 인증 완료')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'회원가입'}));await waitFor(()=>expect(api.request).toHaveBeenCalledTimes(4));expect(api.request.mock.calls[2][3].key).toBe(api.request.mock.calls[3][3].key);
 });
 it('보기·숨기기가 값을 변경하지 않고 새 비밀번호 자동완성을 유지한다',()=>{
  render(<EmailSignup terms={null}/>);const password=screen.getByLabelText('비밀번호',{exact:true});fireEvent.change(password,{target:{value:'synthetic-test-password'}});fireEvent.click(screen.getByRole('button',{name:'비밀번호 보기'}));expect(password).toHaveAttribute('type','text');expect(password).toHaveValue('synthetic-test-password');fireEvent.click(screen.getByRole('button',{name:'비밀번호 숨기기'}));expect(password).toHaveAttribute('type','password');expect(password).toHaveAttribute('autocomplete','new-password');
 });
});

it('인증 중 버튼·Enter 중복 확인을 막고 성공하면 인증 영역을 접는다',async()=>{
 let finish!:(v:unknown)=>void;api.request.mockResolvedValueOnce({request_id:'fixture',expires_at:expiry(),resend_after_seconds:60}).mockImplementationOnce(()=>new Promise(r=>finish=r));render(<EmailSignup terms={null}/>);
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));fireEvent.change(await screen.findByLabelText('인증번호'),{target:{value:'001234'}});expect(screen.getByRole('button',{name:/재발송.*초 후/})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'확인'}));expect(screen.getByRole('button',{name:'확인 중…'})).toBeDisabled();expect(screen.queryByText('이메일 인증 중입니다.')).not.toBeInTheDocument();fireEvent.keyDown(screen.getByLabelText('인증번호'),{key:'Enter'});expect(api.request).toHaveBeenCalledTimes(2);finish({verification_proof:'synthetic-proof',proof_expires_at:expiry()});await screen.findByText('✓ 이메일 인증 완료');expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();
});

it('처음 진입과 자동완성 입력·이메일 Enter에서는 번호를 요청하지 않는다',()=>{
 render(<EmailSignup terms={null}/>);expect(screen.getByLabelText('이메일')).toHaveValue('');expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();
 fireEvent.input(screen.getByLabelText('이메일'),{target:{value:'autofill@example.invalid'}});fireEvent.keyDown(screen.getByLabelText('이메일'),{key:'Enter'});expect(api.request).not.toHaveBeenCalled();expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();
});
it('이전 형식과 검증용 주입값을 복원하지 않는다',()=>{
 sessionStorage.setItem('focurve:email-signup-code',JSON.stringify({email:'layout@example.invalid',request_id:'layout-only-no-api',expires_at:expiry()}));render(<EmailSignup terms={null}/>);expect(screen.getByLabelText('이메일')).toHaveValue('');expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();expect(api.request).not.toHaveBeenCalled();
});
it('성공한 발송만 코드 영역을 열고 같은 흐름의 새로고침은 추가 요청 없이 복원한다',async()=>{
 let finish!:(v:unknown)=>void;api.request.mockImplementationOnce(()=>new Promise(r=>finish=r));const view=render(<EmailSignup terms={null}/>);fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();finish({request_id:'fixture',expires_at:expiry(),resend_after_seconds:60});await screen.findByLabelText('인증번호');expect(screen.getByLabelText('이메일').parentElement).toHaveClass('signup-email-sent');view.unmount();render(<EmailSignup terms={null}/>);expect(screen.getByLabelText('인증번호')).toBeInTheDocument();expect(screen.getByText(/남은 시간/)).toBeInTheDocument();expect(api.request).toHaveBeenCalledTimes(1);
});
