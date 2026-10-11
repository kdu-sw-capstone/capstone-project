// 제품 classic worker와 독립 ES module adapter가 공유하는 호스트 정책 규칙입니다.
globalThis.FocurveHostPolicy = Object.freeze({
 normalize(raw) {
  try { const u = new URL(raw); return ['http:', 'https:'].includes(u.protocol)
   ? u.hostname.toLowerCase().replace(/\.$/, '') : null; } catch { return null; }
 },
 matches(site, raw) {
  const host = this.normalize(raw);
  return host !== null && (host === site.canonical_host
   || (site.include_subdomains && host.endsWith('.' + site.canonical_host)));
 },
 sort(sites) {
  return [...sites].sort((a,b) => b.canonical_host.split('.').length-a.canonical_host.split('.').length
   || (a.canonical_host < b.canonical_host ? -1 : a.canonical_host > b.canonical_host ? 1 : 0));
 },
 select(sites, raw) { return this.sort(sites).find(site => this.matches(site, raw)); },
 supported(snapshot) {
  return snapshot?.format_version === '1.1' && snapshot.site_match_strategy == null
   || snapshot?.format_version === '1.2' && snapshot.site_match_strategy === 'MOST_SPECIFIC_HOST';
 },
 defaultContent() {
  return {version:1,keywords:{enabled:false,rules:[],exceptions:[]},
   adult_domains:{enabled:false,custom_hosts:[],exceptions:[]},
   image_blur:{enabled:false,sensitivity:'MEDIUM',strength:'MEDIUM'},usage_tracking:{enabled:false}};
 },
 validateSnapshot(s, siteOnly = false) {
  const fail=()=>{throw new Error('INVALID_SNAPSHOT');};
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
  const positive=v=>Number.isSafeInteger(v)&&v>0;
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const instant=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
  const host=v=>typeof v==='string'&&v.length<=253&&v===v.toLowerCase()&&v.includes('.')
   &&!v.endsWith('.localhost')&&!/^[0-9.]+$/.test(v)&&v.split('.').every(l=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l));
  const hostEntry=v=>keys(v,['host','include_subdomains'])&&host(v.host)&&typeof v.include_subdomains==='boolean';
  if(!keys(s,['policy_snapshot_id','format_version','site_match_strategy','owner_user_id','executor_id','created_at','source_version','sites','content_policy','catalog_version','model_profile_version'])
   ||!this.supported(s)||!uuid(s.policy_snapshot_id)||!uuid(s.executor_id)||!instant(s.created_at)||!positive(s.source_version)
   ||!Object.hasOwn(s,'owner_user_id')||s.owner_user_id!==null&&!(typeof s.owner_user_id==='string'&&/^[1-9][0-9]*$/.test(s.owner_user_id))||!Array.isArray(s.sites))fail();
  for(const field of ['catalog_version','model_profile_version'])if(Object.hasOwn(s,field)&&s[field]!==null&&(typeof s[field]!=='string'||!s[field]))fail();
  const hosts=new Set(),ids=new Set();let active=false;
  for(const site of s.sites){
   if(!keys(site,['site_id','canonical_host','display_name','include_subdomains','purpose','access_policy','feature_policies','version','created_at','updated_at','deleted_at'])
    ||!(s.owner_user_id===null?uuid(site.site_id):typeof site.site_id==='string'&&/^[1-9][0-9]*$/.test(site.site_id))
    ||!positive(site.version)||!instant(site.created_at)||!instant(site.updated_at)
    ||Object.hasOwn(site,'deleted_at')&&site.deleted_at!==null
    ||typeof site.display_name!=='string'||!site.display_name.trim()||[...site.display_name].length>100
    ||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(site.display_name)
    ||!host(site.canonical_host)||hosts.has(site.canonical_host)||ids.has(site.site_id)||typeof site.include_subdomains!=='boolean'
    ||!['FOCUS','DISTRACTION','GENERAL'].includes(site.purpose)||!(site.purpose==='DISTRACTION'?['BLOCK','RECORD'].includes(site.access_policy):site.access_policy==='ALLOW')
    ||!Array.isArray(site.feature_policies))fail();
   hosts.add(site.canonical_host);ids.add(site.site_id);const codes=new Set();
   for(const f of site.feature_policies){
    if(!keys(f,['feature_code','enabled'])||f.feature_code!=='YOUTUBE_SHORTS'||typeof f.enabled!=='boolean'||codes.has(f.feature_code)
     ||!(site.canonical_host==='youtube.com'||site.canonical_host.endsWith('.youtube.com')))fail();
    codes.add(f.feature_code);active ||= f.enabled;
   }
   if(s.format_version==='1.1'&&s.sites.some(other=>other!==site&&site.include_subdomains&&other.canonical_host.endsWith('.'+site.canonical_host)))fail();
  }
  const p=s.content_policy;
  if(!keys(p,['version','keywords','adult_domains','image_blur','usage_tracking'])||!positive(p.version))fail();
  for(const name of ['keywords','adult_domains','image_blur','usage_tracking']){
   const v=p[name],allowed=name==='keywords'?['enabled','rules','exceptions']:name==='adult_domains'?['enabled','custom_hosts','exceptions']:name==='image_blur'?['enabled','sensitivity','strength']:['enabled'];
   if(!keys(v,allowed)||typeof v.enabled!=='boolean')fail();active ||= v.enabled;
   if(name==='keywords'||name==='adult_domains'){
    const list=name==='keywords'?'rules':'custom_hosts';
    if(!Array.isArray(v[list])||!Array.isArray(v.exceptions)||!v.exceptions.every(hostEntry))fail();
    if(name==='adult_domains'&&!v.custom_hosts.every(hostEntry))fail();
    if(name==='keywords'&&!v.rules.every(r=>keys(r,['id','text','scopes'])&&typeof r.id==='string'&&r.id.length>0&&typeof r.text==='string'&&r.text.trim()&&r.text.length<=80
     &&Array.isArray(r.scopes)&&r.scopes.length>0&&r.scopes.every(x=>['TITLE','URL','BODY'].includes(x))))fail();
   }
   if(name==='image_blur'&&(!['LOW','MEDIUM','HIGH'].includes(v.sensitivity)||!['LOW','MEDIUM','HIGH'].includes(v.strength)))fail();
  }
  if(siteOnly&&active)throw new Error('FEATURE_NOT_IMPLEMENTED');
  return s;
 },
 rules(sites, existing, redirect, firstId = 1, legacy = false) {
  const used = new Set(existing.map(rule => rule.id)); let id = firstId;
  // allow는 main_frame 부모 BLOCK에 대한 예외만 생성합니다. 전역 제한의 우선순위는 별도 통합 대상입니다.
  return (legacy ? sites : this.sort(sites)).filter(site => site.access_policy === 'BLOCK' || !legacy && sites.some(parent =>
   parent.access_policy === 'BLOCK' && parent.include_subdomains
   && site.canonical_host.endsWith('.' + parent.canonical_host))).map(site => {
    while (used.has(id)) id++;
    if(id > 2147483647) throw new Error('RULE_IDS_EXHAUSTED'); used.add(id);
    const host = site.canonical_host.replaceAll('.', '\\.');
    return {id:id++, priority:legacy ? 100 : 100 + site.canonical_host.split('.').length,
     action:site.access_policy === 'BLOCK' ? {type:'redirect',redirect:{url:redirect(site)}} : {type:'allow'},
     condition:{regexFilter:`^https?://([^/@]*@)?${site.include_subdomains?'([a-z0-9-]+\\.)*':''}${host}\\.?(:[0-9]+)?([/?#]|$)`,
      isUrlFilterCaseSensitive:false,resourceTypes:['main_frame']}};
   });
 }
});
