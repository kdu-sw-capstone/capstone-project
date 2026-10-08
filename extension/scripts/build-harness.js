import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
// Separate unpacked extension: test fixture state is never a member API response.
mkdirSync('.chrome-harness', { recursive: true });
cpSync('src', '.chrome-harness/src', { recursive: true });
cpSync('tests/chrome', '.chrome-harness', { recursive: true });
writeFileSync('.chrome-harness/manifest.json', JSON.stringify({
  manifest_version: 3, name: 'FOCURVE EXT-02 검증 전용', version: '0.1.0',
  minimum_chrome_version: '120',
  description: '모의 Core 문맥·실제 DNR/탭/IndexedDB 검증. 제품 세션 또는 회원 연동 아님.',
  action: { default_popup: 'launcher.html' },
  permissions: ['declarativeNetRequest', 'tabs'],
  host_permissions: ['http://*/*', 'https://*/*'],
  web_accessible_resources: [{ resources: ['blocked/index.html'], matches: ['http://*/*', 'https://*/*'] }],
}, null, 2));
console.log('Harness built: .chrome-harness/manifest.json (test only, no product build).');
