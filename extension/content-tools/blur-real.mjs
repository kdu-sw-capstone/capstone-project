import {evaluateBlurResults} from '../content/blur-evaluation.mjs';
import {BlurSession} from '../content/blur-session.mjs';
import {LocalBlurClassifier} from '../content/blur-classifier.mjs';
const status=document.querySelector('#status'),output=document.querySelector('#result'),apply=document.querySelector('#apply');
let model,profile,session,urls=[],results=[],loading=false,labels={},run=0;
function report(){output.textContent=JSON.stringify({testOnly:true,realModel:true,productActivated:false,coreConnected:false,session:session?.inspect()??null,results,evaluation:evaluateBlurResults(results,labels)},null,2);}
function release(){run++;const cleanup=session?.release();if(!cleanup||cleanup.restored)session=null;report();return !cleanup||cleanup.restored;}
document.querySelector('#load').onclick=async()=>{if(loading)return;loading=true;apply.disabled=true;status.textContent='모델 파일 검증·로딩 중… 처음에는 시간이 걸릴 수 있어요.';
  try{if(!release())throw Error('CLEANUP_REQUIRED');model?.close();({profile}=await import('../build/blur-model/profile.mjs'));
    model=new LocalBlurClassifier({baseUrl:new URL('../build/blur-model/',import.meta.url),profile});const info=await model.load();apply.disabled=false;status.textContent=`실제 모델 2개 준비 완료 (${info.backend}). 이미지를 선택하고 적용하세요.`;
  }catch(e){model?.close();model=null;status.textContent='모델 준비 실패: '+e.message;}finally{loading=false;report();}};
document.querySelector('#files').onchange=async event=>{if(!release()){status.textContent='기존 가림 정리 실패. 먼저 해제를 재시도하세요.';return;}
  document.querySelector('#images').replaceChildren();for(const url of urls)URL.revokeObjectURL(url);urls=[];results=[];labels={};
  const files=[...event.target.files].slice(0,20);for(const file of files){if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>20000000){status.textContent='일부 파일은 형식 또는 20MB 제한으로 제외됐어요.';continue;}
    const img=document.createElement('img');img.alt='로컬 시험 이미지';img.src=URL.createObjectURL(file);urls.push(img.src);const card=document.createElement('div'),label=document.createElement('select');const index=document.querySelectorAll('#images img').length+1;
    for(const [value,text]of [['','정답 선택 · 정확도 비교용'],['SAFE','일반 사진 · 보이면 정상'],['SENSITIVE','민감 사진 · 가리면 정상']]){const option=document.createElement('option');option.value=value;option.textContent=text;label.append(option);}
    label.setAttribute('aria-label',index+'번 이미지 정답');label.onchange=()=>{labels[index]=label.value;report();};card.append(img,document.createElement('br'),label);document.querySelector('#images').append(card);}
  report();};
apply.onclick=()=>{if(!model||!release())return;const currentRun=run;results=[];session=new BlurSession(document,{profile,canApply:()=>true,maxTargets:20,timeoutMs:35000,
  classify:async(canvas,args)=>{const result=await model.classify(canvas,args);if(currentRun!==run||args.signal.aborted||!args.image.isConnected)throw Error('STALE_IMAGE');const index=[...document.querySelectorAll('#images img')].indexOf(args.image)+1;const previous=results.findIndex(row=>row.index===index);const row={index,...result};if(previous<0)results.push(row);else results[previous]=row;report();return result;}});session.start();status.textContent='실제 분석 중. 분석 실패는 가림을 유지하며, 이미지 클릭으로 보기·재가림할 수 있어요.';report();};
document.querySelector('#release').onclick=()=>{release();status.textContent='블러 해제 요청 완료. 상태의 잔여 의무를 확인하세요.';};
document.querySelector('#retry').onclick=()=>{session?.retry();report();};
document.querySelector('#copy').onclick=async()=>{report();try{await navigator.clipboard.writeText(output.textContent);}catch{const range=document.createRange();range.selectNodeContents(output);getSelection().removeAllRanges();getSelection().addRange(range);}};
setInterval(()=>{if(session)report();},500);
addEventListener('pagehide',()=>{session?.release();model?.close();for(const url of urls)URL.revokeObjectURL(url);});report();
