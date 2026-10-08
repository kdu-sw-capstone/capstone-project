/* UI presentation: existing popup.js and Core own operations and storage. */
(() => {
 const $=id=>document.getElementById(id);
 let page='focus', previousStatus=null, preparing=false;
 const terminal=status=>['ENDED','INTERRUPTED','START_FAILED'].includes(status);
 function navigate(next){page=next;for(const s of document.querySelectorAll('.page'))s.hidden=s.id!==`${next}-page`;$('main-tabs').hidden=next!=='focus';$('page-subtitle').textContent=next==='sites'?'비회원 · 사이트 설정':next==='access'?'비회원 · 로컬 기록':'비회원 · 이 브라우저에 저장';if(next==='access')refreshAccess.click();}
 function editor(open){$('site-editor').hidden=!open;$('site-list-panel').hidden=open;$('site-search').parentElement.hidden=open;}
 function summary(){if(!sitesVerified&&!focusSession){$('policy-summary').textContent='사이트 설정 조회 결과 미확인. 사이트 관리에서 다시 확인해주세요.';return;}const items=focusVerified&&focusSession&&!terminal(focusSession.status)?focusSession.snapshot?.sites:siteItems; if(!Array.isArray(items)){$('policy-summary').textContent='세션 정책을 확인하지 못했습니다.';return;} const counts={BLOCK:0,ALLOW:0,RECORD:0};for(const s of items)if(Object.hasOwn(counts,s.access_policy))counts[s.access_policy]++;$('policy-summary').textContent=`${items===siteItems?'적용할 설정':'현재 세션의 고정된 설정'}\n사이트 차단 ${counts.BLOCK}개 · 허용 ${counts.ALLOW}개 · 기록 ${counts.RECORD}개\n설정 변경은 다음 세션부터 적용됩니다.`;}
 function renderSites(){const term=$('site-search').value.trim().toLowerCase();[...siteList.children].forEach((row,i)=>{const s=siteItems[i];row.hidden=Boolean(s&&term&&!`${s.display_name} ${s.canonical_host}`.toLowerCase().includes(term));});$('site-count').textContent=!sitesVerified?'사이트 목록을 확인하고 있습니다…':siteItems.length?`저장된 사이트 ${siteItems.length}개`:'등록된 사이트가 없습니다. 사이트를 추가해주세요.';summary();}
 function renderRecords(){const ok=accessData&&accessData.session_id===focusSession?.session_id;$('recent-result').textContent=ok?`접근 ${accessData.total_access}회 · 반복 ${accessData.repeat_access}회\n${accessData.items.slice(0,3).map(e=>`${e.payload.target_host} · ${e.event_type==='BLOCKED_SITE_ACCESS'?'차단':'기록'}`).join('\n')||'저장된 접근 기록이 없습니다.'}`:'기록 조회 결과 미확인. 로컬 기록에서 다시 확인해주세요.';}
 function renderFocus(){
  const status=focusSession?.status, active=focusSession&&!terminal(status), running=focusVerified&&!focusBusy&&status==='RUNNING';
  $('focus-countdown').hidden=!running;$('duration-label').hidden=Boolean(active)||focusBusy;startFocus.hidden=Boolean(active)||focusBusy;startFocus.disabled=!focusVerified||focusBusy||Boolean(active);
  $('request-end').hidden=!focusVerified||!active||status==='STARTING'||focusBusy;$('request-end').textContent=status==='RUNNING'?'세션 종료':'차단 해제 다시 확인';endFocus.disabled=!focusVerified||focusBusy||!active||status==='STARTING';
  $('focus-title').textContent=!focusVerified?'실제 상태를 확인해주세요':focusBusy?'처리 결과 확인 중':running?'집중 진행 중':active?(focusStates[status]||'결과 확인 필요'):'집중 세션을 시작하세요';
  $('focus-description').textContent=running?'시작할 때 저장된 정책으로 집중하고 있습니다.':!focusVerified?'상태 다시 확인 후 집중을 시작할 수 있습니다.':focusBusy?'정책 적용·해제 확인이 끝날 때까지 기다려주세요.':'집중 시간과 적용할 설정을 확인하세요.';
  $('focus-feedback').textContent=!focusVerified?'집중 시작 전에 실제 상태를 다시 확인해주세요.':focusBusy?'정책 적용·해제 결과 확인 중…':status==='UNKNOWN'?'해제가 아직 확인되지 않았습니다. 차단 해제 다시 확인을 눌러주세요.':status==='START_FAILED'&&!preparing?'집중 시작 실패 · 차단 해제 확인 완료':status==='INTERRUPTED'&&!preparing?'집중 중단 · 차단 해제 확인 완료':'';
  if(running){const seconds=Math.max(0,Math.ceil((Date.parse(focusSession.planned_end_at)-Date.now())/1000));$('focus-countdown').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;if(seconds===0)$('focus-description').textContent='집중 시간이 끝났습니다. 실제 차단 해제를 확인하고 있습니다.';}
  if(focusVerified&&!focusBusy&&terminal(status)&&!preparing&&['RUNNING','ENDING','UNKNOWN'].includes(previousStatus)&&page==='focus'){
   navigate('result');$('result-title').textContent=status==='ENDED'?'집중 결과가 저장되었습니다':status==='INTERRUPTED'?'집중이 중단되었습니다':'집중 시작에 실패했습니다';const ms=focusSession.active_duration_ms;$('session-summary').textContent=`${Number.isFinite(ms)?`확인된 집중 시간 ${Math.floor(ms/60000)}분 ${Math.floor(ms/1000)%60}초`:'집중 시간 미확인'}\n차단 해제 확인 완료`;refreshAccess.click();renderRecords();
  }
  if(focusVerified&&!focusBusy)previousStatus=status;summary();
 }
 window.FocurvePopupUI={editor,renderSites,renderFocus,renderRecords};
 document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
 $('add-site').addEventListener('click',()=>{stopEditing();editor(true);$('site-url').focus();});$('site-search').addEventListener('input',renderSites);
 $('request-end').addEventListener('click',()=>{if(!endFocus.disabled)$('end-dialog').showModal();});$('continue-focus').addEventListener('click',()=>$('end-dialog').close());endFocus.addEventListener('click',()=>$('end-dialog').close());
 startFocus.addEventListener('click',()=>{preparing=false;});$('next-session').addEventListener('click',()=>{preparing=true;navigate('focus');renderFocus();});
 document.querySelectorAll('.account-button').forEach(b=>b.addEventListener('click',()=>{$('ui-notice').textContent='계정 연결은 별도 통합 작업이며 현재 지원하지 않습니다.';}));
 const theme=$('theme-mode');function applyTheme(){document.documentElement.dataset.theme=theme.value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme.value;}
 theme.addEventListener('change',()=>{applyTheme();chrome.storage.local.set({focurve_ui_theme:theme.value}).catch(()=>{$('ui-notice').textContent='화면 모드 저장 실패. 다시 선택해주세요.';});});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme.value==='system')applyTheme();});chrome.storage.local.get('focurve_ui_theme').then(data=>{if(['system','dark','light'].includes(data.focurve_ui_theme))theme.value=data.focurve_ui_theme;applyTheme();}).catch(applyTheme);
 applyTheme();renderSites();renderFocus();setInterval(()=>{if(focusVerified&&focusSession?.status==='RUNNING'&&!focusBusy)renderFocus();},1000);setInterval(()=>{if(!focusBusy)refreshFocusState().catch(()=>{focusResult.textContent='상태 확인 실패. 상태 다시 확인을 눌러주세요.';});},15000);
})();
