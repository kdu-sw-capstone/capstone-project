(() => {
  const panel = document.getElementById('member-execution-panel');
  const info = document.getElementById('member-execution-status');
  const check = document.getElementById('member-execution-check');
  const end = document.getElementById('member-execution-end');
  let sessionId = null;
  const labels = { IDLE: '진행 중인 회원 집중이 없습니다. Web에서 시작할 수 있습니다.',
    RUNNING: '회원 집중 정책 적용 확인 완료', RECOVERY_REQUIRED: '실행 복구 확인이 필요합니다. 자동 재적용은 보류했습니다.',
    UNCONFIRMED: '실행 또는 Server 응답 미확인 · 종료·해제 상태를 다시 확인해주세요.',
    RELEASED: '회원 집중 종료 · 해제 확인 완료', UNLINKED: '회원 계정 연결부터 확인해주세요.' };
  async function run(type) {
    check.disabled = end.disabled = true;
    try {
      const request_id = crypto.randomUUID();
      const result = await chrome.runtime.sendMessage({ type, request_id, payload: { session_id: sessionId } });
      if (result?.request_id !== request_id || result.status !== 'OK' || !labels[result.data?.status]) throw new Error('Unconfirmed');
      sessionId = result.data.session_id; info.textContent = labels[result.data.status] + (result.data.access_error === 'ACCESS_DELIVERY_STORAGE_UNCONFIRMED' ? ' · 기록 전송 저장 오류: 저장 공간 확인 후 전송 재확인' : result.data.access_error ? ' · 행동 기록 수집/전송 미확인' : result.data.access_pending ? ' · 행동 기록 전송 대기' : '');
      end.hidden = !sessionId || result.data.status === 'RELEASED';
    } catch { info.textContent = labels.UNCONFIRMED; }
    finally { check.disabled = false; end.disabled = !sessionId; }
  }
  check.addEventListener('click', () => run('DEV_MEMBER_EXECUTION_STATE'));
  end.addEventListener('click', () => {
    if (confirm('회원 집중을 종료하고 사이트 제한을 해제할까요?')) run('DEV_MEMBER_EXECUTION_END');
  });
  window.addEventListener('focurve-member-state', event => {
    panel.hidden = !event.detail.linked;
    if (!panel.hidden) run('DEV_MEMBER_EXECUTION_STATE');
  });
})();
