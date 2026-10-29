
'use strict';
const button=document.querySelector('#connect-native'),status=document.querySelector('#native-status');
const client=FocurveNativeLink.create({config:globalThis.FOCURVE_NATIVE_LINK_CONFIG,extensionId:chrome.runtime.id,now:()=>Date.now(),nonce:()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join(''),send:(host,message)=>new Promise((resolve,reject)=>chrome.runtime.sendNativeMessage(host,message,reply=>{if(chrome.runtime.lastError)reject(Error('NATIVE_CONNECTION_UNAVAILABLE'));else resolve(reply);}))});
const show=(state,message)=>{status.dataset.state=state;status.textContent=message;};
const preflight=()=>{
 const state=client.inspect();button.disabled=!state.canConnect;
 if(state.state==='SCOPE_EXPIRED')show('EXPIRED','실행 승인 시간이 끝났습니다. 서비스는 시작하지 않았습니다. 새 실행 승인이 필요합니다.');
 else if(!state.canConnect)show('SETUP_REQUIRED','이 설치의 연결 설정을 확인하지 못했습니다. 기존 데이터는 보존했습니다. 프로그램 실행 안내에서 연결 설정을 확인해 주세요.');
 return state.canConnect;
};
preflight();
button.addEventListener('click',async event=>{
 if(!event.isTrusted||button.disabled||!preflight())return;
 button.disabled=true;show('CONNECTING','Windows 프로그램에 연결하고 있어요.');
 try{await client.connect();show('CONNECTED','Windows 프로그램 연결 완료. 서비스는 아직 시작하지 않았습니다.');}
 catch(error){
  if(error?.message==='NATIVE_LINK_SCOPE_EXPIRED'){show('EXPIRED','실행 승인 시간이 끝났습니다. 서비스는 시작하지 않았습니다. 새 실행 승인이 필요합니다.');return;}
  show('UNCONFIRMED',error?.message==='NATIVE_LINK_TIMEOUT'?'Windows 프로그램의 응답을 확인하지 못했습니다. 다시 누르지 말고 이 화면과 실행 기록을 보존해 주세요.':'Windows 프로그램과의 연결을 확인하지 못했습니다. 현재 전용 Chrome과 실행 승인 정보의 확인이 필요합니다. 재설치하거나 권한을 바꾸지 마세요.');
  return;
 }
 button.disabled=false;
});
