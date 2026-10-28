import '../background/host-policy.js';
const policy = globalThis.FocurveHostPolicy;
// This layer receives normalized snapshots; it does not edit site settings.
export function validateHost(host) {
  if (typeof host !== 'string' || host.length > 253 || host !== host.toLowerCase()
    || !host.includes('.') || /^\d+(\.\d+){3}$/.test(host)
    || host.endsWith('.localhost') || !host.split('.').every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('INVALID_SNAPSHOT_HOST');
  }
}

export function validateSites(sites, legacy = false) {
  if (!Array.isArray(sites)) throw new Error('INVALID_SNAPSHOT_SITES');
  for (const site of sites) {
    validateHost(site?.canonical_host);
    if (typeof site.include_subdomains !== 'boolean'
      || !['ALLOW', 'BLOCK', 'RECORD'].includes(site.access_policy)) {
      throw new Error('INVALID_SNAPSHOT_SITE');
    }
  }
  for (let i = 0; i < sites.length; i++) {
    for (const other of sites.slice(i + 1)) {
      const site = sites[i];
      if (site.canonical_host === other.canonical_host
        || (legacy && site.include_subdomains && other.canonical_host.endsWith(`.${site.canonical_host}`))
        || (legacy && other.include_subdomains && site.canonical_host.endsWith(`.${other.canonical_host}`))) {
        throw new Error('SNAPSHOT_SCOPE_CONFLICT');
      }
    }
  }
}

export const matchesSite = (site,raw) => policy.matches(site,raw);
export const selectSite = (sites,raw) => policy.select(sites,raw);
export const supportedSnapshot = snapshot => policy.supported(snapshot);

export function blockedUrl(baseUrl, site) {
  const url = new URL(baseUrl);
  url.searchParams.set('host', site.canonical_host);
  url.searchParams.set('reason', 'USER_SITE');
  return url.href;
}

export function buildSiteRules(sites, existing, baseUrl, legacy = false) {
  validateSites(sites, legacy);
  return policy.rules(sites,existing,site=>blockedUrl(baseUrl,site),1,legacy);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export function sameRule(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}
