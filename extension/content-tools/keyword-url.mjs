import {inspectKeywordUrl} from '../content/keyword-url.mjs';
const result=document.querySelector('#result');
document.querySelector('#check').onclick=()=>{
  const checked=inspectKeywordUrl(document.querySelector('#url').value,{enabled:true,match_profile:'URL_BOUNDARY_1',scope:'FOCUS_FROZEN',terms:[document.querySelector('#term').value],exceptions:[]});
  const label=checked.status==='CHECKED'?(checked.matched?'키워드 일치':'키워드 불일치'):'검사 불가 — 허용으로 판정하지 않음';
  result.textContent=label+'\n'+JSON.stringify({testOnly:true,coreConnected:false,result:checked},null,2);
};
document.querySelector('#clear').onclick=()=>{
  document.querySelector('#url').value='';document.querySelector('#term').value='';result.textContent='입력을 지웠습니다.';
};
