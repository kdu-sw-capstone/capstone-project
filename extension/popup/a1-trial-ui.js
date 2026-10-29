// Presentation only. Does not activate the Worker trial or change storage.

(() => {

 const form=document.querySelector('#site-form'),label=document.createElement('label'),input=document.createElement('input'),help=document.createElement('p');

 label.className='checkbox';input.type='checkbox';input.id='a1-shorts-enabled';input.disabled=true;input.setAttribute('aria-describedby','a1-shorts-help');label.append(input,document.createTextNode('YouTube Shorts 제한'));

 help.id='a1-shorts-help';help.className='note';form.insertBefore(label,document.querySelector('#save-site'));form.insertBefore(help,document.querySelector('#save-site'));

 function broadYouTubeScope(){try{const raw=document.querySelector('#site-url')?.value?.trim()??'';return document.querySelector('#site-subdomains')?.checked===true&&new URL(/^https?:/i.test(raw)?raw:'https://'+raw).hostname.toLowerCase()==='youtube.com';}catch{return false;}}
 const ui=window.FocurveA1UI={ready:false,active:false,available:false,busy:false,

  sync(busy=ui.busy){ui.busy=busy;input.disabled=busy||!ui.ready||!ui.available;help.textContent=!ui.ready?'Shorts 설정 사용 가능 여부를 확인하고 있습니다…':!ui.available?'설정 상태를 확인하지 못했습니다. 기존 설정은 보존됩니다. 팝업을 다시 열어주세요.':input.checked&&document.querySelector('#site-policy')?.value==='BLOCK'?'현재 정책은 사이트 전체 차단입니다. Shorts만 제한하려면 분류를 일반 또는 집중으로 변경하고 허용 정책으로 저장하세요. 변경은 다음 세션부터 적용됩니다.':input.checked&&document.querySelector('#site-policy')?.value==='RECORD'?'일반 페이지는 허용하고 기록하며, Shorts는 제한 확인 후 한 번 기록합니다. 미확인·실패는 성공 기록에서 제외합니다. 변경은 다음 세션부터 적용됩니다.':input.checked&&broadYouTubeScope()?'하위 도메인 포함 정책은 accounts.youtube.com 로그인 하위 frame에도 매칭되어 집중 시작이 거절될 수 있습니다. 지원 호스트 youtube.com·www.youtube.com을 각각 하위 도메인 제외로 명시하는 설정은 별도 사용자 선택입니다. 정책을 자동 변경하지 않습니다. 변경은 다음 세션부터 적용됩니다.':'Shorts 설정만 저장하며 사이트 정책을 자동으로 바꾸지 않습니다. 일반 영상 허용 + Shorts 제한은 허용 정책에서 실행합니다. 변경은 다음 세션부터 적용됩니다.';},

  hydrate(features){input.checked=Array.isArray(features)&&features.some(f=>f.feature_code==='YOUTUBE_SHORTS'&&f.enabled);ui.sync();},

  featuresForSave(features){const original=structuredClone(features??[]);if(!ui.ready||!ui.available)return original;const found=original.find(f=>f.feature_code==='YOUTUBE_SHORTS');if(found)found.enabled=input.checked;else if(input.checked)original.push({feature_code:'YOUTUBE_SHORTS',enabled:true});return original;}

 };

 form.addEventListener?.('change',()=>ui.sync());let visibilityRevision=0;ui.sync();chrome.storage.local.get('focurve_a1_trial_ui').then(v=>{if(visibilityRevision)return;ui.ready=true;ui.available=true;ui.active=v.focurve_a1_trial_ui===true;ui.hydrate(window.FocurvePopupSettings?.features());ui.sync();}).catch(()=>{if(visibilityRevision)return;ui.ready=true;ui.available=false;ui.active=false;ui.sync();});

 chrome.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&Object.hasOwn(changes,'focurve_a1_trial_ui')){visibilityRevision++;ui.ready=true;ui.available=true;ui.active=changes.focurve_a1_trial_ui.newValue===true;ui.hydrate(window.FocurvePopupSettings?.features());ui.sync();}});

})();
