// Independent candidate: owned session DNR closes the full-document pre-APPLY gap.
// The ordinary DOM/P1 receiver remains responsible for same-document controls.
export function shortsDocumentTarget(snapshot,policy,url,gate){
 let u;try{u=new URL(url);}catch{return null;}
 if(u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname)||!/^\/shorts(?:\/|$)/.test(u.pathname))return null;
 const site=policy.select(snapshot.sites,u.href);if(!site||site.access_policy==='BLOCK'||!site.feature_policies?.some(f=>f.feature_code==='YOUTUBE_SHORTS'&&f.enabled===true))return null;
 return gate;
}
export function shortsDocumentRules(snapshot,policy,existing,gate){
 const used=new Set(existing.map(r=>r.id)),rules=[];let next=100000;
 for(const host of ['youtube.com','www.youtube.com']){
  if(!shortsDocumentTarget(snapshot,policy,'https://'+host+'/shorts',gate))continue;
  while(used.has(next))next++;if(next>2147483647)throw Error('STORE_CAPACITY');used.add(next);
  rules.push({id:next++,priority:1000,action:{type:'redirect',redirect:{regexSubstitution:gate+'&target=\\0'}},condition:{regexFilter:'^https://'+host.replaceAll('.','[.]')+'/shorts([/?#]|$).*',isUrlFilterCaseSensitive:true,resourceTypes:['main_frame']}});
 }
 return rules;
}

export function gateState(bundle,rules,session){
 if(!bundle||bundle.a.session_id!==session)return 'UNKNOWN';
 if(['ENDED','START_FAILED'].includes(bundle.a.session_status)&&bundle.state.journal.desired==='RELEASED'&&bundle.state.journal.observed==='RELEASED'&&!bundle.a.cleanup_pending&&!bundle.bindings.some(b=>b.resolution==='NONE'||b.cleanup_pending)&&!rules.some(r=>bundle.state.journal.rules.some(owned=>owned.id===r.id)))return 'RELEASED';
 return ['UNKNOWN','ENDING'].includes(bundle.a.session_status)?'UNKNOWN':'ACTIVE';
}
