// Node-only HTTP regression dependency. This is NOT the product deployment provider.
// The real HTTPS localhost provider is covered by release-binding regressions.
// Existing Server HTTP tests use a disposable loopback endpoint and synthetic auth.
export function bindHttpFixture(fixture) {
  if (!globalThis.process?.versions?.node || globalThis.chrome) throw Error('HTTP_FIXTURE_ONLY');
  const api = new URL(fixture.base_url), web = new URL(fixture.web_origin);
  for (const url of [api, web]) {
    if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.username || url.password || url.search || url.hash) throw Error('INVALID_HTTP_FIXTURE_ORIGIN');
  }
  if (api.pathname !== '/api/v1' || web.href !== web.origin + '/') throw Error('INVALID_HTTP_FIXTURE_PATH');
  const pinned = Object.freeze({server_url: fixture.base_url, web_origin: fixture.web_origin});
  globalThis.FocurveDeploymentBinding = Object.freeze({assertInput(input) {
    if (input?.server_url !== pinned.server_url || input?.web_origin !== pinned.web_origin) throw Error('RELEASE_API_MISMATCH');
    return pinned;
  }});
}
