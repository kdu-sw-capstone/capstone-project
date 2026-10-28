// Explicit, selected completed-history transfer. Never called by login/connect.
export class MemberGuestImporter {
 constructor({db,getIdentity,send,digest,getSettings=null,now=Date.now}){Object.assign(this,{db,getIdentity,send,digest,getSettings,now});this.tail=Promise.resolve();}
 serial(work){const p=this.tail.then(work);this.tail=p.catch(()=>{});return p;}
 async read(identity,{selected=null,lease=false}={}){
  const owner='GUEST:'+identity.executor_id;
  return this.db.transaction(lease?'readwrite':'readonly',(tx,done)=>{
   const data={};let remaining=5;for(const name of ['sessions','journal','events','intervals','metadata']){
    const q=tx.objectStore(name).getAll();q.onsuccess=()=>{data[name]=q.result;if(--remaining)return;
     try{const result=[];for(const s of data.sessions){
      const held=data.metadata.find(x=>x.key==='import:lease:'+s.session_id);
      if(s.owner_key!==owner||s.executor_id!==identity.executor_id||s.status!=='ENDED'||!s.ended_at||Date.parse(s.ended_at)+30*86400000<=this.now()&&!held)continue;
      const j=data.journal.find(x=>x.owner_key===owner&&x.session_id===s.session_id),md=data.metadata;
      const a=md.find(x=>x.key==='a1:aggregate:'+s.session_id),bindings=md.filter(x=>x.record_kind==='A1_BINDING'&&x.scope.session_id===s.session_id),ids=new Set(bindings.map(x=>x.scope.binding_id));
      if(!j||j.desired!=='RELEASED'||j.observed!=='RELEASED'||s.execution_contract&&a?.session_status!=='ENDED'||a?.cleanup_pending||bindings.some(x=>x.resolution==='NONE'||x.cleanup_pending)||md.some(x=>x.record_kind==='A1_OPERATION'&&ids.has(x.binding_id)&&['IN_FLIGHT','IN_DOUBT'].includes(x.phase)))continue;
      const mark=md.find(x=>x.key==='import:mark:'+s.session_id),prior=md.find(x=>x.key==='import:lease:'+s.session_id);
      if(mark&&mark.bound_user_id!==identity.owner_user_id||prior&&prior.bound_user_id!==identity.owner_user_id)continue;
      if(selected&&!selected.includes(s.session_id))continue;
      const payload={snapshot:structuredClone(s.snapshot),session:{session_id:s.session_id,executor_id:s.executor_id,execution_status:'ENDED',record_status:s.record_status,source:'MANUAL',duration_minutes:s.duration_minutes,active_duration_ms:s.active_duration_ms,overrun_ms:s.overrun_ms,started_at:s.started_at,ended_at:s.ended_at,...(s.end_reason?{end_reason:s.end_reason}:{})},
       events:data.events.filter(x=>x.owner_key===owner&&x.session_id===s.session_id).map(x=>structuredClone(x.payload)).sort((a,b)=>a.local_seq-b.local_seq),
       intervals:data.intervals.filter(x=>x.owner_key===owner&&x.session_id===s.session_id).map(x=>Object.fromEntries(['interval_id','kind','start_at','end_at','duration_ms','quality'].map(k=>[k,x[k]]))).sort((a,b)=>a.start_at.localeCompare(b.start_at)),usage_segments:[],note:null};
      if(lease)tx.objectStore('metadata').put({key:'import:lease:'+s.session_id,owner_key:owner,session_id:s.session_id,bound_user_id:identity.owner_user_id,phase:'PENDING'});
      result.push({source_item_id:s.session_id,payload,imported:mark?.status==='SUCCEEDED',ended_at:s.ended_at});
     }if(selected&&result.length!==selected.length){tx.abort();return;}done(result);}catch{tx.abort();}
    };
   }
  });
 }
 async settingsRows(identity){
  if(!this.getSettings)return [];const original=await this.getSettings(identity);
  const rows=(original.items??[]).map(site=>({type:'SITE',source_item_id:site.site_id,label:site.canonical_host,payload:{url:site.canonical_host,display_name:site.display_name,include_subdomains:site.include_subdomains,purpose:site.purpose,access_policy:site.access_policy,feature_policies:structuredClone(site.feature_policies??[])}}));
  if(original.content_policy){const hex=await this.digest({executor:identity.executor_id,kind:'CONTENT_POLICY'});const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);const payload=structuredClone(original.content_policy);delete payload.version;rows.push({type:'CONTENT_POLICY',source_item_id:id,label:'전역 콘텐츠 설정 (회원 설정 우선)',payload});}
  const marks=await this.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result);});
  return rows.filter(x=>{const mark=marks.find(m=>m.key==='import:settings:'+x.source_item_id);return !mark||mark.bound_user_id===identity.owner_user_id;});
 }
 settingsList(){return this.serial(async()=>{const i=await this.getIdentity();return (await this.settingsRows(i)).map(({payload,...x})=>x);});}
 async webRows(identity){
  const settings=(await this.settingsRows(identity)).filter(x=>x.type==='SITE');
  const history=(await this.read(identity)).filter(x=>!x.imported).map(x=>({type:'SESSION',source_item_id:x.source_item_id,label:'종료 기록 · '+x.ended_at,payload:x.payload}));
  const marks=await this.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result);});
  const rows=[...settings.filter(x=>!marks.some(m=>m.key==='import:settings:'+x.source_item_id&&['SUCCEEDED','SKIPPED_CONFLICT'].includes(m.phase))),...history];
  if(rows.length>1000||new Set(rows.map(x=>x.source_item_id)).size!==rows.length)throw Error('IMPORT_SOURCE_LIMIT');
  return Promise.all(rows.map(async x=>({...x,source_hash:await this.digest(x.payload)})));
 }
 webList(expected){return this.serial(async()=>{
  const i=await this.getIdentity();if(i.owner_user_id!==expected)throw Error('OWNER_MISMATCH');
  let rows=await this.webRows(i);
  const marks=await this.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result);});
  // A lost acknowledgement can leave a local PENDING mark after Server persistence.
  // Query only this bearer installation; never offer remotely-completed sources again.
  const pending=rows.some(r=>marks.some(m=>m.bound_user_id===i.owner_user_id&&m.key===(r.type==='SITE'?'import:settings:':'import:lease:')+r.source_item_id&&!['SUCCEEDED','SKIPPED_CONFLICT'].includes(m.phase)));
  if(pending){const completed=new Map(),seen=new Set();let cursor=null,pages=0;
   do{if(++pages>10)throw Error('IMPORT_RESULT_LIMIT');const page=await this.send('/guest-imports?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),undefined,'GET',crypto.randomUUID());
    if(!Array.isArray(page.items)||page.items.length>100)throw Error('IMPORT_RESULT_UNCONFIRMED');
    for(const batch of page.items){if(!Array.isArray(batch.items)||batch.items.length>100)throw Error('IMPORT_RESULT_UNCONFIRMED');for(const item of batch.items)if(['SUCCEEDED','SKIPPED_CONFLICT'].includes(item.status)&&(item.status==='SKIPPED_CONFLICT'||typeof item.result_id==='string'&&item.result_id.length>0&&item.result_id.length<=64))completed.set(item.source_item_id,{...item,batch_id:batch.batch_id});}
    cursor=page.next_cursor??null;if(cursor&&(typeof cursor!=='string'||cursor.length>2048||seen.has(cursor)))throw Error('IMPORT_RESULT_UNCONFIRMED');if(cursor)seen.add(cursor);
   }while(cursor);
   if(JSON.stringify(await this.getIdentity())!==JSON.stringify(i))throw Error('OWNER_MISMATCH');
   const reconciled=rows.filter(r=>completed.has(r.source_item_id)&&marks.some(m=>m.key===(r.type==='SITE'?'import:settings:':'import:lease:')+r.source_item_id&&m.bound_user_id===i.owner_user_id&&m.source_hash===r.source_hash));
   if(reconciled.length)await this.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata');let left=reconciled.length;for(const row of reconciled){const key=(row.type==='SITE'?'import:settings:':'import:lease:')+row.source_item_id,q=md.get(key);q.onsuccess=()=>{const mark=q.result,ack=completed.get(row.source_item_id);if(mark?.bound_user_id!==i.owner_user_id||mark.source_hash!==row.source_hash){tx.abort();return;}if(row.type==='SITE')md.put({...mark,phase:ack.status,result_id:ack.result_id??null,batch_id:ack.batch_id,reconciled_after_response_loss:true});else{md.put({key:'import:mark:'+row.source_item_id,bound_user_id:i.owner_user_id,source_hash:row.source_hash,status:'SUCCEEDED',result_id:ack.result_id,batch_id:ack.batch_id,reconciled_after_response_loss:true});md.delete(key);}if(!--left)done(null);};}});
   rows=rows.filter(r=>!completed.has(r.source_item_id));
  }
  if(JSON.stringify(await this.getIdentity())!==JSON.stringify(i))throw Error('OWNER_MISMATCH');
  return{format_version:'1.0',owner_user_id:i.owner_user_id,executor_id:i.executor_id,items:rows.map(({payload,...x})=>({...x,label:x.label.slice(0,200)}))};
 });}
 webSelected(input){return this.serial(async()=>{
  const identity=await this.getIdentity();if(input.owner_user_id!==identity.owner_user_id||input.executor_id!==identity.executor_id)throw Error('OWNER_MISMATCH');
  const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
  if(!uuid(input.request_id)||!Array.isArray(input.items)||!input.items.length||input.items.length>100||new Set(input.items.map(x=>x.source_item_id)).size!==input.items.length||input.items.some(x=>!uuid(x.source_item_id)||!['SITE','SESSION'].includes(x.type)||!/^[a-f0-9]{64}$/.test(x.source_hash??'')||Object.keys(x).sort().join(',')!=='source_hash,source_item_id,type'))throw Error('INVALID_IMPORT_SELECTION');
  const current=await this.webRows(identity),rows=input.items.map(x=>current.find(r=>r.source_item_id===x.source_item_id&&r.type===x.type&&r.source_hash===x.source_hash));
  if(rows.some(x=>!x))throw Error('IMPORT_SOURCE_CHANGED');
  const assertOwner=async()=>{if(JSON.stringify(await this.getIdentity())!==JSON.stringify(identity))throw Error('OWNER_MISMATCH');};
  await assertOwner();
  // Bind only selected sources. An old pending payload/hash is never overwritten.
  await this.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata');let left=rows.length;for(const row of rows){const key=(row.type==='SITE'?'import:settings:':'import:lease:')+row.source_item_id,q=md.get(key);q.onsuccess=()=>{const old=q.result;if(old&&(old.bound_user_id!==identity.owner_user_id||old.source_hash&&old.source_hash!==row.source_hash)){tx.abort();return;}md.put({...old,key,bound_user_id:identity.owner_user_id,source_hash:row.source_hash,phase:old?.phase??'PENDING',...(row.type==='SESSION'?{owner_key:'GUEST:'+identity.executor_id,session_id:row.source_item_id}:{})});if(!--left)done(null);};}});
  await assertOwner();const batch=await this.send('/guest-imports',{source_installation_id:identity.executor_id,manifest:input.items},'POST',input.request_id);
  if(!uuid(batch.batch_id))throw Error('IMPORT_RESULT_UNCONFIRMED');
  const results=[];for(const row of rows){await assertOwner();const{label,...item}=row;let ack;
   try{ack=await this.send('/guest-imports/'+batch.batch_id+'/items/'+row.source_item_id,item,'PUT',crypto.randomUUID());}catch{throw Error('IMPORT_RESULT_UNCONFIRMED');}
   if(ack.source_item_id!==row.source_item_id||!(ack.status==='SUCCEEDED'&&ack.result_id||row.type==='SITE'&&ack.status==='SKIPPED_CONFLICT'))throw Error('IMPORT_RESULT_UNCONFIRMED');
   await assertOwner();await this.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata'),key=(row.type==='SITE'?'import:settings:':'import:lease:')+row.source_item_id,q=md.get(key);q.onsuccess=()=>{if(q.result?.bound_user_id!==identity.owner_user_id||q.result.source_hash!==row.source_hash){tx.abort();return;}if(row.type==='SITE')md.put({...q.result,phase:ack.status,result_id:ack.result_id??null,batch_id:batch.batch_id});else{md.put({key:'import:mark:'+row.source_item_id,bound_user_id:identity.owner_user_id,source_hash:row.source_hash,status:'SUCCEEDED',result_id:ack.result_id,batch_id:batch.batch_id});md.delete(key);}done(null);};});results.push(ack);
  }return{batch_id:batch.batch_id};
 });}
 settingsSelected(ids){return this.serial(async()=>{
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('INVALID_IMPORT_SELECTION');
  const identity=await this.getIdentity(),rows=(await this.settingsRows(identity)).filter(x=>ids.includes(x.source_item_id));if(rows.length!==ids.length)throw Error('IMPORT_SOURCE_NOT_ELIGIBLE');
  const assertOwner=async()=>{if(JSON.stringify(await this.getIdentity())!==JSON.stringify(identity))throw Error('OWNER_MISMATCH');};
  const items=await Promise.all(rows.map(async({label,...x})=>({...x,source_hash:await this.digest(x.payload)})));
  await assertOwner();await this.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata');let left=items.length;for(const item of items){const q=md.get('import:settings:'+item.source_item_id);q.onsuccess=()=>{if(q.result&&(q.result.bound_user_id!==identity.owner_user_id||q.result.source_hash!==item.source_hash)){tx.abort();return;}md.put({key:'import:settings:'+item.source_item_id,bound_user_id:identity.owner_user_id,source_hash:item.source_hash,phase:q.result?.phase??'PENDING'});if(!--left)done(null);};}});
  const batch=await this.send('/guest-imports',{source_installation_id:identity.executor_id,manifest:items.map(({payload,...x})=>x)},'POST',crypto.randomUUID()),results=[];
  for(const item of items){await assertOwner();const ack=await this.send('/guest-imports/'+batch.batch_id+'/items/'+item.source_item_id,item,'PUT',crypto.randomUUID());if(ack.source_item_id!==item.source_item_id||!['SUCCEEDED','SKIPPED_CONFLICT'].includes(ack.status)||ack.status==='SUCCEEDED'&&!ack.result_id)throw Error('IMPORT_RESULT_UNCONFIRMED');await assertOwner();await this.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata'),q=md.get('import:settings:'+item.source_item_id);q.onsuccess=()=>{if(q.result?.bound_user_id!==identity.owner_user_id||q.result.source_hash!==item.source_hash){tx.abort();return;}md.put({...q.result,phase:ack.status,result_id:ack.result_id??null});done(null);};});results.push(ack);}
  return {batch_id:batch.batch_id,items:results,source_preserved:true};
 });}

 list(){return this.serial(async()=>{const i=await this.getIdentity();return (await this.read(i)).map(({payload,...row})=>row);});}
 selected(ids){return this.serial(async()=>{
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(x=>typeof x!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x)))throw Error('INVALID_IMPORT_SELECTION');
  const identity=await this.getIdentity(),rows=await this.read(identity,{selected:ids,lease:true});
  if(rows.length!==ids.length)throw Error('IMPORT_SOURCE_NOT_ELIGIBLE');
  const assertOwner=async()=>{const current=await this.getIdentity();if(JSON.stringify(current)!==JSON.stringify(identity))throw Error('OWNER_MISMATCH');};
  const items=await Promise.all(rows.map(async x=>({type:'SESSION',source_item_id:x.source_item_id,source_hash:await this.digest(x.payload),payload:x.payload})));
  await assertOwner();const batch=await this.send('/guest-imports',{source_installation_id:identity.executor_id,manifest:items.map(({payload,...x})=>x)},'POST',crypto.randomUUID());
  const result=[];for(const item of items){
   await assertOwner();const ack=await this.send('/guest-imports/'+batch.batch_id+'/items/'+item.source_item_id,item,'PUT',crypto.randomUUID());
   if(ack.source_item_id!==item.source_item_id||ack.status!=='SUCCEEDED'||!ack.result_id)throw Error('IMPORT_RESULT_UNCONFIRMED');
   await assertOwner();await this.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata'),q=md.get('import:lease:'+item.source_item_id);q.onsuccess=()=>{
    if(q.result?.bound_user_id!==identity.owner_user_id){tx.abort();return;}
    md.put({key:'import:mark:'+item.source_item_id,bound_user_id:identity.owner_user_id,status:'SUCCEEDED',source_hash:item.source_hash,result_id:ack.result_id,batch_id:batch.batch_id});md.delete(q.result.key);done(null);
   };});result.push(ack);
  }return {batch_id:batch.batch_id,items:result,source_preserved:true};
 });}
}
