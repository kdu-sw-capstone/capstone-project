export function imageKey(image){return JSON.stringify([image.currentSrc,image.src,image.srcset,image.sizes,image.naturalWidth,image.naturalHeight]);}
export function describeImage(image,record,profile,localState){
  const base={testOnly:true,coreConnected:false,profile_sha256:profile.sha256,
    dimensions:{width:image.naturalWidth,height:image.naturalHeight},image_index:record?.index??null,local_state:localState??null};
  if(localState&&['FAILED','PENDING','ANALYZING','NOT_TARGETED'].includes(localState.status))return {...base,status:localState.status};
  if(!record)return {...base,status:'NOT_ANALYZED'};
  if(record.key!==imageKey(image))return {...base,status:'STALE_IMAGE_RESULT'};
  const result=record.result;
  if(!result?.stages||result.stages.length!==2)return {...base,status:'RESULT_UNAVAILABLE'};
  const risks=result.stages.map(stage=>({model:stage.model,sensitive_sum:stage.scores.Porn+stage.scores.Hentai+stage.scores.Sexy,scores:stage.scores}));
  return {...base,status:'ANALYZED',verdict:result.verdict,backend:result.backend,cache_hit:result.cache_hit===true,
    rule:'SUM_PORN_HENTAI_SEXY_BOTH_MODELS',threshold:0.75,stages:risks,
    previous_rule_verdict:risks.some(stage=>stage.sensitive_sum>=.5)?'SENSITIVE':'SAFE',
    experimental_profile:true};
}
export function showImageDiagnosis(document,info){
  const host=document.createElement('aside');host.dataset.focurveUi='blur-diagnosis';
  host.style.cssText='position:fixed;right:12px;top:12px;width:370px;max-height:80vh;z-index:2147483647';
  const root=host.attachShadow({mode:'closed'}),style=document.createElement('style');
  style.textContent=':host{font:14px sans-serif}section{background:white;color:#111;border:2px solid #246;padding:12px;max-height:75vh;overflow:auto;box-shadow:0 2px 12px #555}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}button{margin:4px;padding:6px}';
  const section=document.createElement('section'),title=document.createElement('strong'),message=document.createElement('p'),output=document.createElement('pre'),copy=document.createElement('button'),close=document.createElement('button');
  title.textContent=`선택한 이미지${info.image_index?' #'+info.image_index:''} 판정`;
  message.textContent=info.status==='ANALYZED'?`현재 ${info.verdict==='SENSITIVE'?'가림':'표시'} 판정입니다. 두 모델 모두 민감 점수 합계 75% 이상일 때 가리는 오탐 완화 시험 기준입니다. 아래 결과만 복사하면 됩니다.`:info.status==='FAILED'?`민감 판정이 아니라 분석 실패로 가려진 이미지입니다. 이유: ${info.local_state.failure_reason??'확인 필요'}`:'이 이미지의 현재 분석 결과가 없습니다. 분석 완료 후 다시 선택하세요.';
  output.textContent=JSON.stringify(info,null,2);copy.textContent='이 이미지 결과 복사';close.textContent='닫기';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(output.textContent);copy.textContent='복사 완료';}catch{const range=document.createRange();range.selectNodeContents(output);const selection=document.getSelection();selection.removeAllRanges();selection.addRange(range);copy.textContent='결과를 선택했어요. Ctrl+C로 복사하세요.';}};
  const handle={element:host,release(){if(host.ownerDocument!==document)return false;try{host.remove();return !host.isConnected;}catch{return false;}}};
  close.onclick=()=>{if(!handle.release())message.textContent='안내창 정리에 실패했습니다. 블러 해제를 다시 시도하세요.';};
  section.append(title,message,copy,close,output);root.append(style,section);document.documentElement.append(host);return handle;
}
