// Optional owner-prepared termination scope. Loading this page performs no termination or server call.
(()=>{
 const panel=document.querySelector('#preserved-end-section'),status=document.querySelector('#preserved-end-status');let busy=false;
 async function action(name){
  if(busy)return;busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const r=await chrome.runtime.sendMessage({type:'PRODUCT_PRESERVED_END',request_id:crypto.randomUUID(),action:name});
   if(!r?.ok)throw Error(r?.error??'RESPONSE_UNCONFIRMED');
   status.textContent=r.result.operation_phase==='FAILED_PRESERVED'?'이전 종료의 결과가 미확인입니다. 재실행하지 않고 기록을 보존합니다.':r.result.server_ended_confirmed?'종료 기록과 잠금 해제를 확인했습니다. 서비스·집중 권한은 계속 잠겨 있습니다.':r.result.local_release_confirmed?'로컬 복원을 확인했습니다. 종료 기록 전송 확인이 남아 있습니다.':'종료 대상 확인 완료. 로컬 상태: '+r.result.local_status;
   if(name==='INSPECT')document.querySelector('#preserved-end-local').disabled=r.result.can_end_local!==true;
   if(r.result.local_release_confirmed&&!r.result.server_ended_confirmed)document.querySelector('#preserved-end-reconcile').disabled=false;
  }catch(e){status.textContent='종료 결과 미확인: '+e.message+' · 기존 의무와 기록을 보존합니다. 종료 버튼을 다시 누르지 마세요.';}
  finally{busy=false;}
 }
 for(const [id,name]of [['preserved-end-inspect','INSPECT'],['preserved-end-local','END_LOCAL'],['preserved-end-reconcile','RECONCILE']])document.querySelector('#'+id).addEventListener('click',e=>{if(e.isTrusted)void action(name);});
 fetch(chrome.runtime.getURL('preserved-end-context.json'),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(g=>{if(g?.contract==='FOCURVE_PRESERVED_END_SCOPE_1'&&g.extension_id===chrome.runtime.id&&Date.parse(g.not_before)<=Date.now()&&Date.now()<Date.parse(g.not_after))panel.hidden=false;}).catch(()=>{});
})();
