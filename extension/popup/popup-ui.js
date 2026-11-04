/* UI presentation: existing popup.js and Core own operations and storage. */
(() => {
 const $=id=>document.getElementById(id);
 let page='current', previousStatus=null, preparing=false, currentHost=null, currentSite=null, customDuration=false, settingsReturn='current';
 const terminal=status=>['ENDED','INTERRUPTED','START_FAILED'].includes(status);
 function navigate(next){
  if(!['current','focus','sites','access','result','settings'].includes(next))return;
  if(next==='settings'&&page!=='settings')settingsReturn=page;
  page=next;for(const section of document.querySelectorAll('.page'))section.hidden=section.id!==`${next}-page`;
  $('main-tabs').hidden=false;
  for(const button of $('main-tabs').querySelectorAll('[data-page]')){if(button.dataset.page===next)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  $('page-title').textContent=({current:'현재 사이트',focus:'집중 관리',sites:$('site-editor').hidden?'사이트 관리':editTarget?'사이트 설정 변경':'사이트 추가',access:'로컬 기록',result:'집중 결과',settings:'설정'})[next];
  $('page-subtitle').textContent=window.FocurveMemberUI?.memberMode?'보존된 비회원 자료':'이 브라우저에 저장';
  $('page-title').focus({preventScroll:true});
  if(next==='access')refreshAccess.click();
 }
 function editor(open){if(open&&page!=='sites')navigate('sites');$('site-editor').hidden=!open;$('site-list-panel').hidden=open;$('site-search').parentElement.hidden=true;$('reload-sites').hidden=open;syncChoices();if(page==='sites')$('page-title').textContent=open?(editTarget?'사이트 설정 변경':'사이트 추가'):'사이트 관리';}
 function summary(){if(!sitesVerified&&!focusSession){$('policy-summary').textContent='사이트 설정 조회 결과 미확인. 사이트 관리에서 다시 확인해주세요.';return;}const items=focusVerified&&focusSession&&!terminal(focusSession.status)?focusSession.snapshot?.sites:siteItems; if(!Array.isArray(items)){$('policy-summary').textContent='세션 정책을 확인하지 못했습니다.';return;} const counts={BLOCK:0,ALLOW:0,RECORD:0};for(const s of items)if(Object.hasOwn(counts,s.access_policy))counts[s.access_policy]++;$('policy-summary').textContent=`${items===siteItems?'적용할 설정':'현재 세션의 고정된 설정'}\n사이트 차단 ${counts.BLOCK}개 · 허용 ${counts.ALLOW}개 · 기록 ${counts.RECORD}개\n설정 변경은 다음 세션부터 적용됩니다.`;}
 function renderSites(){const term=$('site-search').value.trim().toLowerCase();[...siteList.children].forEach((row,i)=>{const s=siteItems[i];row.hidden=Boolean(s&&term&&!`${s.display_name} ${s.canonical_host}`.toLowerCase().includes(term));});$('site-count').hidden=sitesVerified;$('site-count').textContent=!sitesVerified?'사이트 목록을 확인하고 있습니다…':siteItems.length?`저장된 사이트 ${siteItems.length}개`:'등록된 사이트가 없습니다. 사이트를 추가해주세요.';summary();renderCurrent();}
 function renderRecords(){const ok=accessData&&(accessData.query||accessData.session_id===focusSession?.session_id);$('recent-result').textContent=ok&&accessData.quarantined_count?`기존 이벤트 ${accessData.quarantined_count}건의 계약 오류 확인 필요 · 원본 보존`:ok?`수집 상태: 부분 확인 · 전체 수집 미확인\n${accessData.producer_evidence?`Root FEATURE 출처 확인 ${accessData.producer_evidence.root_feature.verified_events}건 · 기타 출처 미확인\n`:''}${accessData.query?'선택 조건의 비회원 ':''}접근 ${accessData.total_access}회 · 반복 ${accessData.repeat_access}회\n${accessData.items.slice(0,3).map(e=>`${e.payload.target_host} · ${e.event_type==='BLOCKED_FEATURE_ACCESS'?'Shorts 제한':e.event_type==='BLOCKED_SITE_ACCESS'?'차단':'기록'}`).join('\n')||'저장된 접근 기록이 없습니다.'}`:'기록 조회 결과 미확인. 로컬 기록에서 다시 확인해주세요.';}
 function renderFocus(){
  const status=focusSession?.status, active=focusSession&&!terminal(status), running=focusVerified&&!focusBusy&&status==='RUNNING';
  const member=Boolean(window.FocurveMemberUI?.memberMode);
  $('refresh-focus').hidden=focusVerified&&status!=='UNKNOWN';
  $('focus-page').setAttribute('aria-labelledby',member?'member-focus-title':'focus-title');
  $('member-focus-guide').hidden=!member;$('guest-focus-controls').hidden=member&&!active;
  $('guest-sites-note').textContent=member?'보존된 비회원 설정입니다. 회원 집중 설정은 Web에서 관리합니다.':'이 브라우저의 비회원 설정입니다.';
  if(page==='focus')$('page-subtitle').textContent=member?'보존된 비회원 자료':'이 브라우저에 저장';
  $('main-tabs').setAttribute('aria-label',member?'회원 실행 및 비회원 자료 관리':'비회원 관리');
  $('focus-countdown').hidden=!running;$('duration-label').hidden=Boolean(active)||focusBusy||!customDuration;$('focus-presets').hidden=Boolean(active)||focusBusy;$('focus-ready-time').hidden=Boolean(active)||focusBusy;for(const button of $('focus-presets').querySelectorAll('button'))button.disabled=Boolean(active)||focusBusy;syncDuration();startFocus.hidden=Boolean(active)||focusBusy;startFocus.disabled=!focusVerified||focusBusy||Boolean(active)||Boolean(window.FocurveMemberUI?.blocked);
  $('request-end').hidden=!focusVerified||status!=='RUNNING'||focusBusy;$('request-end').textContent=status==='UNKNOWN'?'세션 종료·해제 요청':['RUNNING','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(status)?'세션 종료':'차단 해제 다시 확인';endFocus.disabled=!focusVerified||focusBusy||status!=='RUNNING';$('request-end').disabled=endFocus.disabled;
  $('focus-title').hidden=focusVerified&&!active&&!focusBusy;$('focus-title').textContent=!focusVerified?'실제 상태를 확인해주세요':focusBusy?'처리 결과 확인 중':running?'집중 진행 중':active?(status==='EFFECT_VERIFYING'?'새 제어 대상 확인 중':status==='NATIVE_VERIFYING'?'문서·복원 확인 중':focusStates[status]||'결과 확인 필요'):'집중 세션을 시작하세요';
  $('focus-description').textContent=running?'시작할 때 저장된 정책으로 집중하고 있습니다.':!focusVerified?'상태 다시 확인 후 집중을 시작할 수 있습니다.':focusBusy?'정책 적용·해제 확인이 끝날 때까지 기다려주세요.':'확장 적용 확인 후 집중이 시작됩니다.';
  $('focus-feedback').textContent=!focusVerified?'집중 시작 전에 실제 상태를 다시 확인해주세요.':focusBusy?'정책 적용·해제 결과 확인 중…':status==='UNKNOWN'?'집중 상태가 아직 확인되지 않았습니다. 실제 적용·해제 상태를 다시 확인해주세요.':status==='START_FAILED'&&!preparing?'집중 시작 실패 · 차단 해제 확인 완료':status==='INTERRUPTED'&&!preparing?'집중 중단 · 차단 해제 확인 완료':'';
  if(focusActionError)$('focus-feedback').textContent+=($('focus-feedback').textContent?'\n':'')+focusActionError;
  if(running){const seconds=Math.max(0,Math.ceil((Date.parse(focusSession.planned_end_at)-Date.now())/1000));$('focus-countdown').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;if(seconds===0)$('focus-description').textContent='집중 시간이 끝났습니다. 실제 차단 해제를 확인하고 있습니다.';}
  if(focusVerified&&!focusBusy&&terminal(status)&&!preparing&&['RUNNING','ENDING','UNKNOWN'].includes(previousStatus)&&page==='focus'){
   navigate('result');$('result-title').textContent=status==='ENDED'?'집중 결과가 저장되었습니다':status==='INTERRUPTED'?'집중이 중단되었습니다':'집중 시작에 실패했습니다';const ms=focusSession.active_duration_ms;$('session-summary').textContent=`${Number.isFinite(ms)?`확인된 집중 시간 ${Math.floor(ms/60000)}분 ${Math.floor(ms/1000)%60}초`:'집중 시간 미확인'}\n차단 해제 확인 완료`;refreshAccess.click();renderRecords();
  }
  if(focusVerified&&!focusBusy)previousStatus=status;summary();
 }
 window.FocurvePopupUI={editor,renderSites,renderFocus,renderRecords,syncChoices,sitesFailed:()=>{$('site-count').hidden=false;$('site-count').textContent='사이트 목록 조회 실패 · 다시 확인해 주세요.';},openSites:()=>navigate('sites')};
 document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
 $('add-site').addEventListener('click',()=>{stopEditing();editor(true);$('site-url').focus();});$('site-search').addEventListener('input',renderSites);
 $('request-end').addEventListener('click',()=>{if(!endFocus.disabled)$('end-dialog').showModal();});$('continue-focus').addEventListener('click',()=>$('end-dialog').close());endFocus.addEventListener('click',()=>$('end-dialog').close());
 startFocus.addEventListener('click',()=>{preparing=false;});$('next-session').addEventListener('click',()=>{preparing=true;navigate('focus');renderFocus();});
 function radioKeyboard(group){group.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;const buttons=[...group.querySelectorAll('[role=radio]')].filter(button=>!button.disabled);if(!buttons.length)return;event.preventDefault();let index=buttons.indexOf(document.activeElement);index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+buttons.length)%buttons.length;buttons[index].click();buttons[index].focus();});}
 function syncChoices(){
  for(const button of $('purpose-choices').querySelectorAll('button')){const selected=button.dataset.value===purpose.value;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;button.disabled=siteBusy;}
  const selectedValue=policy.value,group=$('policy-choices');group.replaceChildren();
  for(const option of policy.options){const button=document.createElement('button');button.type='button';button.setAttribute('role','radio');button.dataset.value=option.value;button.textContent=option.value==='RECORD'?'허용하고 기록':option.textContent;const selected=option.value===selectedValue;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;button.disabled=siteBusy;button.onclick=()=>{if(siteBusy)return;policy.value=option.value;policy.dispatchEvent(new Event('change',{bubbles:true}));syncChoices();};group.append(button);}
 }
 for(const button of $('purpose-choices').querySelectorAll('button'))button.onclick=()=>{if(siteBusy)return;purpose.value=button.dataset.value;purpose.dispatchEvent(new Event('change',{bubbles:true}));syncChoices();};
 for(const group of [$('purpose-choices'),$('policy-choices'),$('focus-presets')])radioKeyboard(group);
 function syncDuration(){const minutes=Number(focusMinutes.value);$('focus-ready-time').textContent=Number.isInteger(minutes)&&minutes>=1&&minutes<=180?String(minutes).padStart(2,'0')+':00':'—:—';for(const button of $('focus-presets').querySelectorAll('button')){const selected=customDuration?button.dataset.minutes==='custom':button.dataset.minutes===focusMinutes.value;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;}}
 for(const button of $('focus-presets').querySelectorAll('button'))button.onclick=()=>{if(button.disabled)return;customDuration=button.dataset.minutes==='custom';if(!customDuration){focusMinutes.value=button.dataset.minutes;focusMinutes.dispatchEvent(new Event('input',{bubbles:true}));}$('duration-label').hidden=!customDuration;syncDuration();if(customDuration)focusMinutes.focus();};
 focusMinutes.addEventListener('input',syncDuration);
 function renderCurrent(){
  if(!currentHost){$('quick-add-site').disabled=true;$('choose-site-policy').disabled=true;return;}
  currentSite=sitesVerified?FocurveHostPolicy.select(siteItems,'https://'+currentHost):null;
  $('current-domain').textContent=currentHost;$('current-domain').title=currentHost;$('current-domain').classList.toggle('long-domain',currentHost.length>24);
  $('current-policy').textContent=!sitesVerified?'등록 상태 확인 필요':currentSite?`등록됨 · ${labels[currentSite.purpose]} · ${labels[currentSite.access_policy]} 설정`:'미등록 사이트';
  $('quick-add-site').disabled=!sitesVerified||siteBusy;$('choose-site-policy').disabled=!sitesVerified||siteBusy;
  $('quick-add-site').textContent=currentSite?'사이트 설정 변경':'차단할 사이트로 추가';$('choose-site-policy').hidden=Boolean(currentSite);
  $('current-guidance').textContent=currentSite?'변경한 설정은 다음 집중부터 적용돼요.':'집중할 때 차단할 사이트로 등록해요.';
 }
 async function loadCurrent(){try{const tabs=await chrome.tabs.query({active:true,currentWindow:true}),tab=tabs[0];currentHost=FocurveHostPolicy.normalize(tab?.url);if(currentHost&&(!currentHost.includes('.')||currentHost.endsWith('.localhost')||/^[0-9.]+$/.test(currentHost)))currentHost=null;if(!currentHost){$('current-domain').textContent='지원하지 않는 페이지';$('current-policy').textContent='일반 웹사이트에서 팝업을 열어 주세요.';return;}const icon=$('current-favicon');try{const url=new URL(tab.favIconUrl);if(['http:','https:'].includes(url.protocol)){icon.src=url.href;icon.hidden=false;$('current-icon-fallback').hidden=true;}}catch{}renderCurrent();}catch{$('current-domain').textContent='사이트 조회 실패';$('current-policy').textContent='활성 탭을 확인하지 못했어요. 팝업을 다시 열어 주세요.';}}
 $('current-favicon').addEventListener('error',()=>{$('current-favicon').hidden=true;$('current-icon-fallback').hidden=false;});
 for(const id of ['quick-add-site','choose-site-policy'])$(id).onclick=()=>{if($(id).disabled)return;if(currentSite){startEditing(currentSite);return;}stopEditing();$('site-url').value=currentHost;purpose.value='DISTRACTION';updatePolicyOptions('BLOCK');editor(true);$('site-url').focus();};
 $('open-settings').onclick=()=>navigate(page==='settings'?settingsReturn:'settings');
 $('open-member').addEventListener('click',()=>{sessionStorage.setItem('focurve_member_settings','1');});
 $('preferences').append($('policy-summary'));
 // Existing Shorts controls keep their controller and move into the scrolling form body.
 const actions=document.createElement('div');actions.className='form-actions';actions.append($('cancel-edit'),$('save-site'));siteForm.append(actions);const formBody=siteForm.querySelector('.form-body');formBody.append($('site-subdomains').parentElement);for(const node of [...siteForm.children])if(node.matches('.checkbox,#a1-shorts-help'))formBody.append(node);
 const theme=$('theme-mode');function applyTheme(){const selected=theme.value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme.value;document.documentElement.dataset.theme=selected;for(const image of document.querySelectorAll('img[data-icon]'))image.src='assets/'+selected+'-'+image.dataset.icon+'.svg';}
 theme.addEventListener('change',()=>{applyTheme();chrome.storage.local.set({focurve_ui_theme:theme.value}).catch(()=>{$('ui-notice').textContent='화면 모드 저장 실패. 다시 선택해주세요.';});});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme.value==='system')applyTheme();});chrome.storage.local.get('focurve_ui_theme').then(data=>{if(['system','dark','light'].includes(data.focurve_ui_theme))theme.value=data.focurve_ui_theme;applyTheme();}).catch(applyTheme);
 applyTheme();navigate('current');syncChoices();void loadCurrent();renderSites();renderFocus();setInterval(()=>{if(focusVerified&&focusSession?.status==='RUNNING'&&!focusBusy)renderFocus();},1000);setInterval(()=>{if(!focusBusy)refreshFocusState().catch(()=>{focusResult.textContent='상태 확인 실패. 상태 다시 확인을 눌러주세요.';});},15000);
})();
