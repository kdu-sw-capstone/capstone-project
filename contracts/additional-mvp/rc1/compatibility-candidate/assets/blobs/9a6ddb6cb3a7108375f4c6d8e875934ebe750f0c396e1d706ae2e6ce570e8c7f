import { matchesHost } from './keyword.mjs';

// A trusted catalog adapter supplies matchCatalog(host); fetching, checksum,
// frozen version and last-valid-version preservation remain Core responsibilities.
export function inspectAdultDomain(host, policy, matchCatalog) {
  if (!policy.enabled || matchesHost(host,policy.exceptions)) return {blocked:false,status:'SUPPORTED'};
  if (typeof matchCatalog !== 'function') return {blocked:false,status:'FAILED'};
  try {
    const listed = matchCatalog(host);
    if (typeof listed !== 'boolean') return {blocked:false,status:'FAILED'};
    return {blocked:listed || matchesHost(host,policy.custom_hosts),status:'SUPPORTED'};
  } catch { return {blocked:false,status:'FAILED'}; }
}
