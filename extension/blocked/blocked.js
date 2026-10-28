import { restrictionStyles } from '../ui/restriction.mjs';
const style=document.createElement('style');style.textContent=restrictionStyles;document.head.append(style);
const host = new URLSearchParams(location.search).get('host');
document.querySelector('#target').textContent = host ? `${host} 접근이 제한되었습니다.` : '등록한 차단 대상 사이트의 접근이 제한되었습니다.';
