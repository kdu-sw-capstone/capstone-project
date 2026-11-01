/* Popup /sites presentation adapter; successful writes require observed readback. */
(function(root){
 'use strict';
 const sameScope=(a,b)=>a&&b&&a.owner_key===b.owner_key&&a.executor_id===b.executor_id&&a.authority===b.authority;
 const valid=s=>s&&/^[1-9][0-9]*$/.test(s.site_id??'')&&Number.isSafeInteger(s.version)&&s.version>0&&typeof s.canonical_host==='string'&&typeof s.display_name==='string'&&Array.isArray(s.feature_policies)&&s.feature_policies.every(f=>f&&typeof f.feature_code==='string'&&typeof f.enabled==='boolean')&&typeof s.include_subdomains==='boolean'&&['FOCUS','DISTRACTION','GENERAL'].includes(s.purpose)&&['BLOCK','RECORD','ALLOW'].includes(s.access_policy);
 const features=s=>s.feature_policies.map(f=>f.feature_code+':'+f.enabled).sort().join('|');
 const same=(a,b)=>valid(a)&&valid(b)&&a.site_id===b.site_id&&a.version>=b.version&&['canonical_host','display_name','purpose','access_policy','include_subdomains'].every(k=>a[k]===b[k])&&features(a)===features(b);
 function host(url){const s=url.trim(),u=new URL(s.includes('://')?s:'https://'+s);return u.hostname.toLowerCase().replace(/\.$/,'');}
 function controller({send,reserve=async()=>{},confirm=async()=>{},onHold=async()=>{},onChange=()=>{},initialHold=false,initialScope=null,uuid=()=>crypto.randomUUID(),timeoutMs=12000}){
  let items=[],busy=false,held=initialHold,loaded=false,error='',scope=initialScope?{...initialScope}:null,closed=false,epoch=0,intent=null;
  const view=()=>({items:structuredClone(items),busy,held,loaded,error});
  const render=()=>{if(!closed)onChange(view());};
  async function request(action,payload,expected=scope){
   const request_id=uuid();let timer;
   try{
    const r=await Promise.race([send({type:'INDEPENDENT_MEMBER_SITES',request_id,action,payload,...(expected?{scope:expected}:{})}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('RESPONSE_UNCONFIRMED')),timeoutMs);})]);
    if(closed)throw Error('POPUP_CLOSED');
    if(r?.request_id!==request_id)throw Error('RESPONSE_UNCONFIRMED');
    if(!r.ok){const e=Error(r.error??'RESPONSE_UNCONFIRMED');e.definitive=r.definitive===true;e.status=r.status;throw e;}
    if(!r.scope||!/^MEMBER:[1-9][0-9]*$/.test(r.scope.owner_key??'')||typeof r.scope.executor_id!=='string'||typeof r.scope.authority!=='string'||expected&&!sameScope(expected,r.scope))throw Error('OWNER_MISMATCH');
    return {data:r.data,scope:r.scope};
   }finally{clearTimeout(timer);}
  }
  async function readList(expected){
   const rows=[],cursors=new Set();let cursor,observed=expected;
   do{
    const result=await request('LIST',cursor?{cursor}:{},observed);observed??=result.scope;
    const p=result.data;if(!Array.isArray(p?.items)||p.items.some(s=>!valid(s))||typeof p.has_more!=='boolean'||p.next_cursor!==null&&(typeof p.next_cursor!=='string'||!p.next_cursor||p.next_cursor.length>2048)||p.has_more!==(p.next_cursor!==null))throw Error('RESPONSE_UNCONFIRMED');
    for(const s of p.items){if(rows.some(r=>r.site_id===s.site_id))throw Error('RESPONSE_UNCONFIRMED');rows.push(s);}
    cursor=p.next_cursor;if(cursor){if(cursors.has(cursor)||cursors.size>=100)throw Error('RESPONSE_UNCONFIRMED');cursors.add(cursor);}
   }while(cursor);
   return {items:rows,scope:observed};
  }
  async function list(){
   if(busy||closed)return false;busy=true;error='';render();const generation=++epoch;
   try{const page=await readList(scope);if(generation!==epoch||closed)return false;items=page.items;scope=page.scope;loaded=true;return true;}
   catch{if(!closed){loaded=false;items=[];error='사이트 목록을 확인하지 못했어요. 다시 확인해 주세요.';}return false;}
   finally{busy=false;render();}
  }
  async function mutate(action,payload,submitted){
   if(busy||closed||held||!loaded||!scope)return false;
   busy=true;error='';render();const generation=++epoch,body=JSON.stringify({action,payload,scope});
   if(!intent||intent.body!==body)intent={body,key:uuid()};const pending=intent;let reserved=false,responded=false,savedRow;
   try{
    await reserve({requestId:pending.key,action:'SITE_'+action,scope});reserved=true;
    if(closed||generation!==epoch)return false;
    const result=await request(action,{...payload,key:pending.key});
    responded=true;
    if(action==='DELETE'){
     if(result.data?.deleted!==true||result.data.site_id!==payload.site_id)throw Error('RESPONSE_UNCONFIRMED');
     try{await request('GET',{site_id:payload.site_id});throw Error('RESPONSE_UNCONFIRMED');}catch(e){if(!(e.definitive&&e.status===404))throw e;}
    }else{
     const saved=result.data;
     if(!valid(saved)||saved.canonical_host!==host(submitted.url)||payload.site_id&&(saved.site_id!==payload.site_id||saved.version<=payload.version)||['display_name','purpose','access_policy','include_subdomains'].some(k=>saved[k]!==submitted[k])||features(saved)!==features(submitted))throw Error('RESPONSE_UNCONFIRMED');
     const observed=(await request('GET',{site_id:saved.site_id})).data;if(!same(observed,saved))throw Error('RESPONSE_UNCONFIRMED');
     savedRow=saved;
    }
    const page=await readList(scope);if(closed||generation!==epoch)return false;
    if(action==='DELETE'&&page.items.some(s=>s.site_id===payload.site_id))throw Error('RESPONSE_UNCONFIRMED');
    if(savedRow&&!same(page.items.find(s=>s.site_id===savedRow.site_id),savedRow))throw Error('RESPONSE_UNCONFIRMED');
    await confirm(pending.key);if(closed||generation!==epoch)return false;
    items=page.items;intent=null;loaded=true;return true;
   }catch(e){
    if(!closed){
     if(!reserved){held=true;} // Existing/unknown marker or failed reservation read/write: never clear or replace its evidence.
     else if(responded||!e.definitive){held=true;try{await onHold({requestId:pending.key,action:'SITE_'+action,scope});}catch{}}
     else if(reserved){try{await confirm(pending.key);}catch{held=true;}}
     error=held?'저장 결과를 확인하지 못했어요. 입력을 보존하고 같은 작업을 반복하지 마세요.':e.status===412?'다른 화면에서 설정이 바뀌었어요. 목록을 다시 확인하고 최신 항목을 선택해 주세요.':e.status===401?'계정 연결을 다시 확인해 주세요.':'저장하지 못했어요. 입력과 연결 상태를 확인해 주세요.';
    }return false;
   }finally{busy=false;render();}
  }
  function save(site,selected=null){return mutate(selected?'UPDATE':'CREATE',{site,...(selected?{site_id:selected.site_id,version:selected.version}:{})},site);}
  function remove(site){return mutate('DELETE',{site_id:site.site_id,version:site.version});}
  return Object.freeze({list,save,remove,view,observeHold(row){if(closed||busy&&row?.requestId===intent?.key)return;held=true;render();},close(){closed=true;epoch++;}});
 }
 root.FocurveMemberSites=Object.freeze({controller});if(typeof module!=='undefined')module.exports=root.FocurveMemberSites;
})(globalThis);
