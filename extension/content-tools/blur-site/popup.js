const out=document.querySelector('#result'),status=document.querySelector('#status');
let preparing=false,stateEpoch=0,stateTimer;
async function restoreModelState(){
  const epoch=++stateEpoch;
  try{const response=await chrome.runtime.sendMessage({target:'BLUR_BACKGROUND',type:'MODEL_STATE'});if(epoch!==stateEpoch||preparing)return;
    const state=response?.result;if(!state)throw Error('MODEL_STATE_UNAVAILABLE');
    document.querySelector('#apply').disabled=state.ready!==true;
    document.querySelector('#prepare').disabled=state.loading===true;
    if(state.ready===true)status.textContent='모델 준비 상태를 재사용합니다. 현재 페이지에 바로 적용하세요.';
    else if(state.loading===true){status.textContent='기존 모델 준비가 진행 중입니다…';stateTimer=setTimeout(restoreModelState,500);}
    else status.textContent='아직 준비된 모델이 없습니다. 모델 준비를 한 번 눌러 주세요.';
  }catch{if(epoch===stateEpoch&&!preparing){document.querySelector('#apply').disabled=true;document.querySelector('#prepare').disabled=false;status.textContent='모델 상태를 확인하지 못했습니다. 준비 버튼으로 다시 확인하세요.';}}
}
document.querySelector('#prepare').onclick=async()=>{
  if(preparing)return;preparing=true;stateEpoch++;clearTimeout(stateTimer);document.querySelector('#prepare').disabled=true;document.querySelector('#apply').disabled=true;status.textContent='모델 준비 중…';
  try{const r=await chrome.runtime.sendMessage({target:'BLUR_BACKGROUND',type:'PREPARE'});if(!r?.result?.ready)throw Error(r?.error??'MODEL_NOT_READY');document.querySelector('#apply').disabled=false;status.textContent='준비 완료. 현재 사이트에서 적용하세요.';}catch(e){status.textContent='실패: '+e.message;}finally{preparing=false;document.querySelector('#prepare').disabled=false;}
};
restoreModelState();
for(const [id,type] of [['apply','APPLY'],['release','RELEASE'],['state','STATE'],['retry','RETRY'],['select','SELECT_IMAGE'],['selected','SELECTED_STATE']])document.querySelector('#'+id).onclick=async()=>{
  try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const result=await chrome.tabs.sendMessage(tab.id,{target:'BLUR_CONTENT',type},{frameId:0});out.textContent=JSON.stringify(result,null,2);if(type==='SELECT_IMAGE'){status.textContent='팝업 바깥을 눌러 닫고, 확인할 썸네일을 한 번 클릭하세요. 해당 이미지 결과창이 뜹니다.';return;}status.textContent=result.error?'오류: '+result.error:'요청 완료. 분석 중이면 잠시 후 상태 확인을 누르세요.';}catch{status.textContent='일반 HTTP·HTTPS 웹페이지를 열고 탭을 새로고침해 주세요. Chrome 내부 화면은 지원하지 않습니다.';}
};
document.querySelector('#copy').onclick=async()=>{await navigator.clipboard.writeText(out.textContent);status.textContent='상태 복사 완료';};
