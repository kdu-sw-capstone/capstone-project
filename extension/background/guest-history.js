// Root-only read model over the existing Guest DB. No Content message authority.
const GuestHistory=(()=>{
 const kinds=new Set(['BLOCKED_SITE_ACCESS','RECORDED_ACCESS','BLOCKED_FEATURE_ACCESS']);
 const fail=()=>{throw Error('INVALID_HISTORY_QUERY');};
 const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x)fail();return Date.parse(x+'T00:00:00+09:00');};
 function confirmedFocus(rows,sessions,selectedIds,owner,from,to){
  let total=0,known=false;
  for(const session of sessions){
   if(!selectedIds.has(session.session_id)||!Number.isInteger(session.duration_minutes)||session.duration_minutes<1||session.duration_minutes>180)continue;
   const intervals=rows.filter(i=>i.owner_key===owner&&i.session_id===session.session_id&&i.kind==='RUN'&&i.quality==='CONFIRMED'&&i.end_at).map(i=>({start:Date.parse(i.start_at),end:Date.parse(i.end_at),duration:i.duration_ms})).sort((a,b)=>a.start-b.start);
   let previous=-Infinity,valid=true;
   for(const i of intervals){if(!Number.isFinite(i.start)||!Number.isFinite(i.end)||!Number.isSafeInteger(i.duration)||i.duration<0||i.end-i.start!==i.duration||i.start<previous){valid=false;break;}previous=i.end;}
   // Invalid or overlapping legacy intervals are not invented confirmed time.
   if(!valid)continue;
   let remaining=session.duration_minutes*60000;
   for(const i of intervals){
    const duration=Math.min(remaining,i.duration),end=i.start+duration;remaining-=duration;
    // Apply the goal cap before clipping: overrun cannot move to another date.
    if(duration===0&&i.duration>0)continue;
    const begin=Math.max(i.start,from),finish=Math.min(end,to);
    if(finish>begin||duration===0&&i.start>=from&&i.start<to){known=true;total+=Math.max(0,finish-begin);}
   }
  }
  return known?total:null;
 }
 async function query(owner,raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['from_date','to_date','session_id','host','event_type','cursor','event_id'].includes(k)))fail();
  const q={from_date:raw.from_date??null,to_date:raw.to_date??null,session_id:raw.session_id??'',host:raw.host??'',event_type:raw.event_type??''};
  for(const k of ['session_id','host','event_type'])if(typeof q[k]!=='string'||q[k].length>253)fail();
  if(q.event_type&&!kinds.has(q.event_type))fail();if(q.host&&(!/^[a-z0-9.-]+$/.test(q.host)||q.host.startsWith('.')||q.host.endsWith('.')))fail();
  const from=q.from_date?day(q.from_date):-Infinity,to=q.to_date?day(q.to_date)+86400000:Infinity;
  if(q.from_date&&!q.to_date||q.to_date&&!q.from_date||from>=to||Number.isFinite(from)&&to-from>366*86400000)fail();
  const filterHash=await sha([owner.owner_key,owner.installation_id,q]);
  let cursor=null;if(raw.cursor){try{if(typeof raw.cursor!=='string'||raw.cursor.length>1024)fail();cursor=JSON.parse(atob(raw.cursor));}catch{fail();}if(cursor.v!==1||cursor.filter!==filterHash||typeof cursor.after!=='string'||Object.keys(cursor).sort().join(',')!=='after,filter,v')fail();}
  if(raw.event_id!==undefined&&(typeof raw.event_id!=='string'||raw.event_id.length>64))fail();
  const rows=await SessionDB.transaction('readonly',(tx,done)=>{const out={},names=['sessions','events','intervals','metadata'];let n=names.length;for(const name of names){const r=tx.objectStore(name).getAll();r.onsuccess=()=>{out[name]=r.result;if(--n===0)done(out);};}});
  const sessions=rows.sessions.filter(s=>s.owner_key===owner.owner_key&&s.executor_id===owner.installation_id&&(!s.expires_at||Date.parse(s.expires_at)>Date.now())),byId=new Map(sessions.map(s=>[s.session_id,s]));
  const all=[],quarantined=[],counts=new Map();
  for(const item of rows.events.filter(e=>e.owner_key===owner.owner_key&&byId.has(e.session_id)&&kinds.has(e.payload?.event_type)).sort((a,b)=>(a.payload?.payload?.access_seq??0)-(b.payload?.payload?.access_seq??0))){
   const e=structuredClone(item.payload),s=byId.get(item.session_id);
   try{FocurveMemberEvents.validate(e);if(e.session_id!==s.session_id||e.executor_id!==s.executor_id||e.policy_snapshot_id!==s.snapshot.policy_snapshot_id)throw Error('LINK');}catch{quarantined.push({event_id:item.event_id,session_id:item.session_id,code:'INVALID_EVENT_OR_SNAPSHOT_LINK'});continue;}
   const root=e.event_type==='BLOCKED_FEATURE_ACCESS'&&rows.metadata.find(d=>d.record_kind==='GUEST_FEATURE_CAPTURE'&&d.phase==='COMPLETED'&&d.owner_key===owner.owner_key&&d.session_id===e.session_id&&d.executor_id===e.executor_id&&d.event_id===e.event_id&&d.navigation_id===e.payload.navigation_id&&d.target_host===e.payload.target_host&&d.policy_host===e.payload.matched_policy_host&&d.occurred_at===e.occurred_at);
   if(root&&(root.review_required||s.status==='UNKNOWN'))Object.assign(e,{quality:'REVIEW_REQUIRED',review_required:true});
   const key=JSON.stringify([e.session_id,e.schema_version==='1.2'?e.payload.target_host:e.payload.target_key]),rank=(counts.get(key)??0)+1;counts.set(key,rank);Object.assign(e,{target_access_index:rank,repeat_count:rank-1,is_repeat:rank>1});all.push(e);
  }
  const selected=sessions.filter(s=>!q.session_id||s.session_id===q.session_id),selectedIds=new Set(selected.map(s=>s.session_id));
  const filtered=all.filter(e=>selectedIds.has(e.session_id)&&Date.parse(e.occurred_at)>=from&&Date.parse(e.occurred_at)<to&&(!q.host||e.payload.target_host===q.host)&&(!q.event_type||e.event_type===q.event_type)).sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at)||b.event_id.localeCompare(a.event_id));
  // Existing completed Root drafts are provenance evidence, never a completeness watermark.
  const feature=filtered.filter(e=>e.event_type==='BLOCKED_FEATURE_ACCESS');
  const rootVerified=feature.filter(e=>rows.metadata.some(d=>d.record_kind==='GUEST_FEATURE_CAPTURE'&&d.phase==='COMPLETED'&&d.owner_key===owner.owner_key&&d.session_id===e.session_id&&d.executor_id===e.executor_id&&d.event_id===e.event_id&&d.navigation_id===e.payload.navigation_id&&d.target_host===e.payload.target_host&&d.policy_host===e.payload.matched_policy_host&&d.occurred_at===e.occurred_at)).length;
  const producer_evidence={root_feature:{status:rootVerified?'PARTIAL':'NOT_VERIFIED',verified_events:rootVerified,completeness_proven:false},unattributed_feature:{status:'NOT_VERIFIED',events:feature.length-rootVerified},site:{status:'NOT_VERIFIED',events:filtered.length-feature.length},legacy_content:{status:'NOT_VERIFIED'},collection_complete:false};
  let offset=0;if(cursor){const i=filtered.findIndex(e=>e.event_id===cursor.after);if(i<0)fail();offset=i+1;}
  const page=filtered.slice(offset,offset+20),last=page.at(-1);const next=offset+page.length<filtered.length?btoa(JSON.stringify({v:1,filter:filterHash,after:last.event_id})):null;
  let detail=null;if(raw.event_id){const event=filtered.find(e=>e.event_id===raw.event_id);if(!event)throw Error('HISTORY_EVENT_NOT_FOUND');const s=byId.get(event.session_id);detail={event,snapshot:structuredClone(s.snapshot),session_status:s.status};}
  const confirmed=confirmedFocus(rows.intervals,sessions,selectedIds,owner.owner_key,from,to);
  return {producer_evidence,items:page,total_access:filtered.length,repeat_access:filtered.filter(e=>e.is_repeat).length,session_id:q.session_id||null,sessions:sessions.map(s=>({session_id:s.session_id,started_at:s.started_at,status:s.status})),next_cursor:next,detail,quarantined_count:quarantined.length,quarantined_items:quarantined,record_status:quarantined.length||filtered.some(e=>e.review_required)?'REVIEW_REQUIRED':'PARTIAL',collection_complete:false,confirmed_focus_ms:confirmed,focus_collection:'CONFIRMED_CLOSED_INTERVALS_ONLY_PARTIAL',query:q};
 }
 return Object.freeze({query});
})();
