const output=document.querySelector('#result');
const panel=document.createElement('section');
panel.setAttribute('aria-label','시험 상태 결과');
panel.style.cssText='clear:both;border:1px solid #aaa;padding:8px;margin:8px 0';
const copy=document.createElement('button');copy.type='button';copy.textContent='상태 복사';
const notice=document.createElement('span');notice.setAttribute('role','status');notice.style.marginLeft='8px';
output.before(panel);panel.append(copy,notice,output);panel.hidden=true;
let latest=0;
copy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(output.textContent);notice.textContent='복사 완료';}
  catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents(output);selection.removeAllRanges();selection.addRange(range);notice.textContent='내용을 선택했어요. Ctrl+C로 복사하세요.';}
});
document.querySelectorAll('button[data-type]').forEach(button=>button.addEventListener('click',async()=>{
  const request=++latest;
  button.insertAdjacentElement('afterend',panel);panel.hidden=false;notice.textContent='';copy.disabled=true;
  output.textContent='상태 확인 중…';
  const report={testOnly:true,action:button.dataset.type,checked_at:new Date().toISOString()};
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id)throw Error('ACTIVE_TAB_NOT_FOUND');
    const message={type:button.dataset.type};
    if(message.type==='TEST_KEYWORD_APPLY')message.term=document.querySelector('#keyword-term').value;
    const response=await chrome.tabs.sendMessage(tab.id,message);
    if(response===undefined)throw Error('EMPTY_CONTENT_RESPONSE');
    report.response=response;
  }catch(error){report.error=error.message;report.hint='Instagram 또는 YouTube 탭에서 페이지를 새로고침한 뒤 다시 적용하세요.';}
  if(request!==latest)return;
  output.textContent=JSON.stringify(report,null,2);copy.disabled=false;
}));
