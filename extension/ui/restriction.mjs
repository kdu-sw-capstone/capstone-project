// Shared presentation only. No policy, authority, state transition or storage writes.
export const restrictionStyles = `
:host,.fc-restriction{color-scheme:light;font:14px/1.5 'Noto Sans KR','Noto Sans CJK KR',sans-serif;color:#102a43}
.fc-restriction{box-sizing:border-box;background:#f7fbff;min-height:100vh;padding:64px;display:flex;flex-direction:column;gap:28px}
.fc-restriction *{box-sizing:border-box}.fc-restriction p,.fc-restriction h1{margin:0}
.fc-brand{font-size:26px;font-weight:700;line-height:1.5}.fc-context,.fc-title{font-size:18px;font-weight:700;line-height:1.5}
.fc-card{width:100%;max-width:1100px;display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:20px;border:1px solid #dcebfa;border-radius:16px;background:#ffffff}
.fc-copy,.fc-help{font-size:14px;color:#4f7195}.fc-reason{font-size:22px;line-height:1.5}.fc-time{font-size:30px;font-weight:700;line-height:1.5}
.fc-button{display:flex;align-items:center;justify-content:center;width:460px;max-width:100%;min-height:40px;padding:8px 16px;border:1px solid #dcebfa;border-radius:8px;background:#edf6ff;color:#102a43;font:500 14px/20px 'Noto Sans KR',sans-serif;text-decoration:none;cursor:pointer}
.fc-primary{color:#ffffff;background:#1a73e8;border-color:#1a73e8;box-shadow:0 4px 14px #1a73e833}.fc-button:hover{border-color:#155fc0}.fc-primary:hover{background:#155fc0}.fc-button:focus-visible{outline:3px solid #155fc0;outline-offset:3px}
.fc-shorts .fc-button{width:480px}
@media(max-width:700px){.fc-restriction{padding:24px;gap:24px}.fc-reason{font-size:18px}.fc-time{font-size:24px}}
`;
export function createShortsNotice(document){
 const host=document.createElement('aside');host.setAttribute('role','status');host.setAttribute('aria-label','FOCURVE Shorts 제한');host.dataset.focurveRestriction='shorts';
 host.style.cssText='position:fixed;inset:0;z-index:2147483647;overflow:auto;pointer-events:auto;display:block';
 const root=host.attachShadow?host.attachShadow({mode:'open'}):host;
 const style=document.createElement('style');style.textContent=restrictionStyles;root.append(style);
 const main=document.createElement('section');main.className='fc-restriction fc-shorts';
 const brand=document.createElement('p');brand.className='fc-brand';brand.textContent='FOCURVE';
 const context=document.createElement('p');context.className='fc-context';context.textContent='YouTube · 상단 검색 / 왼쪽 메뉴 / 일반 영상 이용 가능';
 const card=document.createElement('div');card.className='fc-card';
 const title=document.createElement('p');title.className='fc-title';title.textContent='이번 세션에서는 Shorts를 제한합니다';
 const copy=document.createElement('p');copy.className='fc-copy';copy.textContent='이번 세션에서는 Shorts만 제한됩니다. 일반 영상은 이용할 수 있어요.';
 const home=document.createElement('a');home.className='fc-button fc-primary';home.href='https://www.youtube.com/';home.target='_blank';home.rel='noopener noreferrer';home.textContent='YouTube 일반 화면으로';
 card.append(title,copy,home);main.append(brand,context,card);root.append(main);
 host.updateRestrictionState=confirmed=>{title.textContent=confirmed?'이번 세션에서는 Shorts를 제한합니다':'Shorts 제한을 확인하지 못했습니다';copy.textContent=confirmed?'이번 세션에서는 Shorts만 제한됩니다. 일반 영상은 이용할 수 있어요.':'확장에서 집중 상태를 확인해 주세요.';};
 return host;
}
