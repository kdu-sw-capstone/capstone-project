import '../../background/host-policy.js';
import { createHash } from 'node:crypto';
export function completeSite(s, owner=null) {
 const hash=createHash('sha256').update(s.canonical_host).digest('hex');
 const id=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
 const at='2026-10-10T00:00:00Z';
 return {site_id:owner===null?id:'1',version:1,created_at:at,updated_at:at,display_name:s.canonical_host,
  purpose:s.access_policy==='ALLOW'?'GENERAL':'DISTRACTION',feature_policies:[],...s};
}
export function completeSnapshot(snapshot) {
 const at='2026-10-10T00:00:00Z',owner=snapshot.owner_user_id??null;
 return {owner_user_id:owner,created_at:at,source_version:1,content_policy:FocurveHostPolicy.defaultContent(),...snapshot,
  sites:snapshot.sites.map((s,i)=>completeSite({...s,...(owner===null?{}:{site_id:s.site_id??String(i+1)})},owner))};
}
