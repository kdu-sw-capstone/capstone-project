// 기존 설정 DB는 그대로 두고 실행 데이터만 새 DB v1에 원자 저장합니다.
const SessionDB = (() => {
 const stores = ['metadata','sessions','journal','events','intervals','outbox'];
 function open() { return new Promise((resolve,reject)=>{
  const r=indexedDB.open('focurve-execution',1);
  r.onupgradeneeded=()=>{ for(const s of stores) r.result.createObjectStore(s,{keyPath:s==='metadata'?'key':s==='sessions'||s==='journal'?['owner_key','session_id']:s==='events'?['owner_key','event_id']:s==='intervals'?['owner_key','interval_id']:['owner_key','item_id']}); };
  r.onerror=()=>reject(new Error('LOCAL_STORAGE_UNAVAILABLE')); r.onblocked=()=>reject(new Error('LOCAL_STORAGE_BLOCKED')); r.onsuccess=()=>resolve(r.result);
 }); }
 async function transact(mode, work) { const db=await open();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode);let result;
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(new Error('LOCAL_STORAGE_UNAVAILABLE'));
  try{work(tx,value=>{result=value;});}catch(e){tx.abort();}
 });}finally{db.close();} }
 function load(key="current"){return transact('readonly',(tx,done)=>{
  const r=tx.objectStore('metadata').get(key);r.onsuccess=()=>{
   if(!r.result){done(null);return;}const s=tx.objectStore('sessions').get([r.result.owner_key,r.result.session_id]);
   s.onsuccess=()=>{if(!s.result){tx.abort();return;}const j=tx.objectStore('journal').get([s.result.owner_key,s.result.session_id]);j.onsuccess=()=>{if(!j.result){tx.abort();return;}done({session:s.result,journal:j.result});};};
  };
 });}
 function save(state,event=null){return transact('readwrite',(tx,done)=>{
  const s=state.session; tx.objectStore('sessions').put(s);tx.objectStore('journal').put(state.journal);
  tx.objectStore('metadata').put({key:'start:'+s.start_request_id,owner_key:s.owner_key,session_id:s.session_id});
  tx.objectStore('metadata').put({key:'current',owner_key:s.owner_key,session_id:s.session_id});
  if(state.interval)tx.objectStore('intervals').put(state.interval);
  if(event)tx.objectStore('events').put(event);
  done(state);
 });}
 // 현 단계에는 guest 기록만 있습니다. 미확인/활성 세션은 만료하지 않습니다.
 function expire(){return transact('readwrite',(tx,done)=>{
  const r=tx.objectStore('sessions').openCursor();r.onsuccess=()=>{const c=r.result;if(!c){done(null);return;}
   const s=c.value;if(s.owner_key.startsWith('GUEST:')&&s.expires_at&&Date.parse(s.expires_at)<=Date.now()&&['ENDED','INTERRUPTED','START_FAILED'].includes(s.status)){
    c.delete();tx.objectStore('metadata').delete('start:'+s.start_request_id);tx.objectStore('journal').delete([s.owner_key,s.session_id]);
    for(const name of ['events','intervals']){const children=tx.objectStore(name).openCursor();children.onsuccess=()=>{const child=children.result;if(child){if(child.value.owner_key===s.owner_key&&child.value.session_id===s.session_id)child.delete();child.continue();}};}
    const current=tx.objectStore('metadata').get('current');current.onsuccess=()=>{if(current.result?.session_id===s.session_id&&current.result.owner_key===s.owner_key)tx.objectStore('metadata').delete('current');};
   }c.continue();
  };
 });}
 return Object.freeze({transaction:transact,load,byRequest:id=>load("start:"+id),save,expire});
})();
