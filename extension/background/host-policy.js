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
