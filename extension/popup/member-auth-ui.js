(() => {
  const notice = document.getElementById('ui-notice');
  const server = document.getElementById('member-server');
  const web = document.getElementById('member-web');
  const check = document.getElementById('member-check');
  const info = document.getElementById('member-status');
  const preferences = document.getElementById('preferences');
  const ui = window.FocurveMemberUI = { blocked: true };
  let busy = false;
  const labels = { UNREGISTERED: '계정이 연결되지 않았습니다.', REGISTERED: '설치 등록 완료 · 계정 연결 가능',
    LINK_PENDING: 'Web에서 로그인·승인 후 연결 상태를 확인해주세요.', REQUEST_UNCONFIRMED: '연결 요청 응답 미확인 · 만료까지 새 실행을 보류합니다.',
    REGISTRATION_UNCONFIRMED: '설치 등록 결과 미확인 · 서버 담당자 확인이 필요합니다.',
    AUTH_RECOVERY_REQUIRED: '인증 복구가 필요합니다. Web의 설치 연결 관리에서 확인해주세요.',
    VERIFYING: '토큰을 받았으며 실제 회원 정보를 확인 중입니다.',
    LINKED: '회원 연결 확인 완료 · 회원 실행 상태를 아래에서 확인해주세요.' };
  const errors = { INVALID_CALLBACK: 'Server에 확장 주소 허용 등록이 필요합니다.',
    GUEST_SESSION_ACTIVE: '진행 중인 비회원 집중을 먼저 종료하고 차단 해제를 확인해주세요.',
    ACCOUNT_TRANSITION_ACTIVE: '기존 연결 상태부터 확인해주세요.', AUTH_SERVER_BOUND: '등록한 Server 주소를 유지해주세요.',
    INVALID_SERVER_CONFIG: 'Server·Web 주소를 확인해주세요. 외부 서버는 HTTPS가 필요합니다.',
    AUTH_RESPONSE_UNCONFIRMED: '서버 응답을 확인하지 못했습니다. 연결 상태를 다시 확인해주세요.',
    LINK_EXPIRED: '연결 요청이 만료되었거나 거절되었습니다. 필요하면 다시 연결해주세요.' };
  const errorText = code => errors[code] || '인증 또는 저장 상태 확인이 필요합니다. 서버와 연결 설정을 확인해주세요.';
  function render(data) {
    window.dispatchEvent(new CustomEvent('focurve-member-state', { detail: { linked: data?.phase === 'LINKED' } }));
    if (!data || !Object.hasOwn(labels, data.phase) || typeof data.guest_start_allowed !== 'boolean') {
      ui.blocked = true; info.textContent = '계정 연결 상태 미확인 · 상태를 다시 확인해주세요.';
    } else {
      ui.blocked = !data.guest_start_allowed || busy;
      info.textContent = labels[data.phase] + (data.error ? ' · ' + errorText(data.error) : '');
      document.getElementById('member-callback').value = data.callback_uri;
      if (!busy) { server.value = data.server_url; web.value = data.web_origin; }
      server.disabled = data.phase !== 'UNREGISTERED';
      web.disabled = !['UNREGISTERED', 'REGISTERED'].includes(data.phase);
      if (data.phase === 'LINKED') document.getElementById('page-subtitle').textContent = '회원 연결됨 · 기존 비회원 자료 보존';
    }
    document.querySelectorAll('.account-button').forEach(button => { button.disabled = busy || ui.blocked; });
    check.disabled = busy;
    window.FocurvePopupUI?.renderFocus();
  }
  async function request(type, payload) {
    const request_id = crypto.randomUUID();
    const result = await chrome.runtime.sendMessage({ type, request_id, ...(payload ? { payload } : {}) });
    if (result?.request_id !== request_id || !['OK', 'ERROR'].includes(result.status)) throw new Error('AUTH_OPERATION_FAILED');
    render(result.data);
    if (result.status !== 'OK') throw new Error(result.error?.code || 'AUTH_OPERATION_FAILED');
  }
  async function run(type, payload) {
    busy = true; ui.blocked = true; check.disabled = true;
    document.querySelectorAll('.account-button').forEach(button => { button.disabled = true; });
    window.FocurvePopupUI?.renderFocus();
    info.textContent = '계정 연결 상태를 확인하고 있습니다…';
    try { await request(type, payload); notice.textContent = ''; }
    catch (error) { notice.textContent = errorText(error.message); }
    finally { busy = false; try { await request('FOCURVE_AUTH_STATUS'); } catch { render(null); } }
  }
  document.querySelectorAll('.account-button').forEach(button => button.addEventListener('click', () => {
    preferences.open = true;
    run('FOCURVE_AUTH_BEGIN', { server_url: server.value, web_origin: web.value });
  }));
  check.addEventListener('click', () => run('FOCURVE_AUTH_POLL'));
  run('FOCURVE_AUTH_STATUS');
})();
