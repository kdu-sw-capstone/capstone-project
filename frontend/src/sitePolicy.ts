/** Host input here is canonical API data; never collapse it to a registrable domain. */
export function selectSitePolicy<T extends { canonical_host: string; include_subdomains?: boolean }>(
  sites: readonly T[], host: string,
): T | undefined {
  return sites.reduce<T | undefined>((selected, site) => {
    const matches = host === site.canonical_host ||
      (site.include_subdomains === true && host.endsWith("." + site.canonical_host));
    // Matching ancestors form a suffix chain, so the longest host is the most specific.
    return matches && (!selected || site.canonical_host.length > selected.canonical_host.length)
      ? site : selected;
  }, undefined);
}
