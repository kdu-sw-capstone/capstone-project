import {BlurSession} from '../content/blur-session.mjs';
const hash='b'.repeat(64),profile={id:'TEST_ONLY_BLUR_PROFILE',sha256:hash,level:'HIGH'};
const images=document.querySelector('#images'),output=document.querySelector('#result');
let first=null,other=null,recovered=false,sequence=0;
function picture(label,color){const c=document.createElement('canvas');c.width=440;c.height=360;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,440,360);x.fillStyle='white';x.font='bold 35px sans-serif';x.fillText(label,30,100);x.fillRect(30,160,140,100);x.fillStyle='#222';x.fillRect(250,160,140,100);return c.toDataURL();}
function add(kind,label,color){const article=document.createElement('article'),title=document.createElement('p'),image=document.createElement('img');title.textContent=label;image.alt=label;image.dataset.fixture=kind;image.src=picture(label,color);article.append(title,image);images.append(article);return image;}
add('safe','정상 이미지','#198169');const sensitive=add('sensitive','민감 모의','#cc5030');add('fail','실패 모의','#4066bb');
const make=()=>new BlurSession(document,{profile,canApply:()=>true,classify:async(canvas,{profile})=>{
  // Classification is a fixture keyed by canvas pixels, never a product model.
  const [r,g,b]=canvas.getContext('2d').getImageData(0,0,1,1).data;
  if(b>r&&b>g&&!recovered)throw Error('MOCK_MODEL_FAILURE');
  return {verdict:r>g&&r>b?'SENSITIVE':'SAFE',profile_sha256:profile.sha256};
}});
function report(action){output.textContent=JSON.stringify({testOnly:true,realModel:false,coreConnected:false,action,first:first?.inspect()??null,other:other?.inspect()??null},null,2);}
document.querySelector('#apply').onclick=()=>{if(!first){first=make();first.start();}report('APPLY');};
document.querySelector('#release').onclick=()=>{const a=first?.release(),b=other?.release();if(!a||a.restored)first=null;if(!b||b.restored)other=null;report('RELEASE');};
document.querySelector('#replace').onclick=()=>{sensitive.src=picture('교체 '+ ++sequence,'#dd6020');report('REPLACE');};
document.querySelector('#add').onclick=()=>{add('sensitive','새 이미지 '+ ++sequence,'#c94020');report('ADD');};
document.querySelector('#other').onclick=()=>{if(!other){other=make();other.start();}report('OTHER_OWNER');};
document.querySelector('#own-release').onclick=()=>{if(first?.release().restored)first=null;report('RELEASE_FIRST');};
document.querySelector('#retry').onclick=()=>{recovered=true;first?.retry();other?.retry();report('RETRY');};
document.querySelector('#state').onclick=()=>report('STATE');
document.querySelector('#copy').onclick=async()=>{report('COPY');try{await navigator.clipboard.writeText(output.textContent);}catch{const range=document.createRange();range.selectNodeContents(output);getSelection().removeAllRanges();getSelection().addRange(range);}};
report('READY');
