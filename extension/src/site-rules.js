// This layer receives normalized snapshots; it does not edit site settings.
export function validateHost(host) {
  if (typeof host !== 'string' || host.length > 253 || host !== host.toLowerCase()
    || !host.includes('.') || /^\d+(\.\d+){3}$/.test(host)
    || host.endsWith('.localhost') || !host.split('.').every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('INVALID_SNAPSHOT_HOST');
  }
}

export function validateSites(sites) {
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
        || (site.include_subdomains && other.canonical_host.endsWith(`.${site.canonical_host}`))
        || (other.include_subdomains && site.canonical_host.endsWith(`.${other.canonical_host}`))) {
        throw new Error('SNAPSHOT_SCOPE_CONFLICT');
      }
    }
  }
}

export function matchesSite(site, rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/\.$/, '');
    return ['http:', 'https:'].includes(url.protocol)
      && (host === site.canonical_host
        || (site.include_subdomains && host.endsWith(`.${site.canonical_host}`)));
  } catch { return false; }
}

export function blockedUrl(baseUrl, site) {
  const url = new URL(baseUrl);
  url.searchParams.set('host', site.canonical_host);
  url.searchParams.set('reason', 'USER_SITE');
  return url.href;
}

export function buildSiteRules(sites, existing, baseUrl) {
  validateSites(sites);
  const used = new Set(existing.map(rule => rule.id));
  let id = 1;
  return sites.filter(site => site.access_policy === 'BLOCK').map(site => {
    while (used.has(id)) id++;
    if (id > 2147483647) throw new Error('RULE_IDS_EXHAUSTED');
    used.add(id);
    const host = site.canonical_host.replaceAll('.', '\\.');
    return {
      id: id++, priority: 100,
      action: { type: 'redirect', redirect: { url: blockedUrl(baseUrl, site) } },
      condition: {
        regexFilter: `^https?://(?:[^/@]*@)?${site.include_subdomains ? '(?:[a-z0-9-]+\\.)*' : ''}${host}\\.?(?::[0-9]+)?(?:[/?#]|$)`,
        isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'],
      },
    };
  });
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
