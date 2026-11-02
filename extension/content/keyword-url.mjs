import {caseFoldOverrides} from './keyword-casefold.mjs';

// Local URL_BOUNDARY_1 classifier only. No page text, effects, authority,
// storage, navigation tracking or Wire/Server success is produced here.
const fail = code => { throw Error(code); };
export const foldKeyword = value => [...value.normalize('NFKC')]
  .map(c => caseFoldOverrides[c] ?? c.toLowerCase()).join('');
const alnum = c => c !== undefined && /[\p{L}\p{N}]/u.test(c);
function boundary(text, term) {
  const source = [...foldKeyword(text)], needle = [...term];
  for (let i = 0; i + needle.length <= source.length; i++) {
    if (needle.every((c, n) => source[i + n] === c)
      && !alnum(source[i - 1]) && !alnum(source[i + needle.length])) return true;
  }
  return false;
}
function host(value) {
  // WHATWG URL performs nontransitional domain-to-ASCII. Enforce STD3 label
  // syntax and policy host restrictions explicitly after that conversion.
  const h = value.replace(/\.$/, '').toLowerCase();
  if (h.length > 253 || !h.includes('.') || /^[\d.]+$/.test(h)
    || !h.split('.').every(p => p.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(p))) fail('INVALID_KEYWORD_HOST');
  return h;
}
function pieces(raw) {
  if (typeof raw !== 'string' || !raw.isWellFormed() || raw.length > 65536 || /[\u0000-\u0020\u007f\\]/u.test(raw)) fail('INVALID_KEYWORD_URL');
  if (!/^https?:\/\//i.test(raw)) fail('UNSUPPORTED_KEYWORD_URL');
  if (/%(?![a-f0-9]{2})/i.test(raw)) fail('INVALID_URL_ENCODING');
  let url; try { url = new URL(raw); } catch { fail('INVALID_KEYWORD_URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail('UNSUPPORTED_KEYWORD_URL');
  const actualHost = host(url.hostname);
  const decode = text => { try { return decodeURIComponent(text); } catch { fail('INVALID_URL_ENCODING'); } };
  // Preserve raw path (URL parsing would otherwise erase dot segments before
  // comparison). Query keys are validated for encoding but never matched.
  const tail = raw.replace(/^https?:\/\/[^/?#]*/i, '');
  const hashAt = tail.indexOf('#'), fragment = hashAt < 0 ? '' : tail.slice(hashAt + 1);
  const beforeHash = hashAt < 0 ? tail : tail.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const values = [actualHost, decode(path), decode(fragment)];
  if (queryAt >= 0) for (const pair of beforeHash.slice(queryAt + 1).split('&')) {
    const equals = pair.indexOf('=');
    decode((equals < 0 ? pair : pair.slice(0, equals)).replace(/\+/g, ' '));
    values.push(decode((equals < 0 ? '' : pair.slice(equals + 1)).replace(/\+/g, ' ')));
  }
  return {actualHost, values};
}
function config(policy) {
  const keys = ['enabled','match_profile','terms','exceptions','scope'];
  if (!policy || typeof policy !== 'object' || Object.keys(policy).length !== keys.length
    || keys.some(k => !Object.hasOwn(policy, k)) || typeof policy.enabled !== 'boolean'
    || policy.match_profile !== 'URL_BOUNDARY_1' || policy.scope !== 'FOCUS_FROZEN'
    || !Array.isArray(policy.terms) || policy.terms.length > 200
    || policy.terms.some(t => typeof t !== 'string' || !t.isWellFormed() || !t.trim() || [...t].length > 80)
    || new Set(policy.terms).size !== policy.terms.length
    || !Array.isArray(policy.exceptions) || policy.exceptions.length > 500) fail('INVALID_KEYWORD_POLICY');
  const terms = policy.terms.map(t => foldKeyword(t.trim()));
  if (new Set(terms).size !== terms.length || policy.enabled && terms.length === 0) fail('INVALID_KEYWORD_POLICY');
  const exceptions = policy.exceptions.map(e => {
    if (!e || Object.keys(e).length !== 2 || typeof e.host !== 'string' || typeof e.include_subdomains !== 'boolean') fail('INVALID_KEYWORD_POLICY');
    if (host(e.host) !== e.host) fail('INVALID_KEYWORD_POLICY');
    return {host:e.host, include_subdomains:e.include_subdomains};
  });
  if (new Set(exceptions.map(e => JSON.stringify(e))).size !== exceptions.length) fail('INVALID_KEYWORD_POLICY');
  return {enabled:policy.enabled, terms, exceptions};
}
export function inspectKeywordUrl(raw, policy) {
  const base = {local_only:true, native_verified:false, match_profile:'URL_BOUNDARY_1'};
  try {
    const frozen = config(policy);
    if (!frozen.enabled) return {...base, status:'DISABLED', matched:null};
    const {actualHost, values} = pieces(raw);
    if (frozen.exceptions.some(e => actualHost === e.host || e.include_subdomains && actualHost.endsWith('.' + e.host)))
      return {...base, status:'EXEMPT', matched:false};
    return {...base, status:'CHECKED', matched:frozen.terms.some(t => values.some(v => boundary(v, t)))};
  } catch (error) {
    // Uninspectable input is not SAFE/ALLOW. Never return raw URL or term.
    const allowed = ['INVALID_KEYWORD_URL','UNSUPPORTED_KEYWORD_URL','INVALID_URL_ENCODING','INVALID_KEYWORD_HOST','INVALID_KEYWORD_POLICY'];
    return {...base, status:'UNCONFIRMED', matched:null, reason:allowed.includes(error.message)?error.message:'KEYWORD_CHECK_FAILED'};
  }
}
