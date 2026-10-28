(() => {
  const panel = document.getElementById('member-delivery-panel');
  const info = document.getElementById('member-delivery-status');
  const list = document.getElementById('member-delivery-counts');
  const check = document.getElementById('member-delivery-check');
  const retry = document.getElementById('member-delivery-recheck');
  const wait = document.getElementById('member-delivery-wait');
  const labels = {QUEUED:'전송 대기',IN_FLIGHT:'전송 중',RESPONSE_UNCONFIRMED:'응답 미확인',
    PENDING_DEPENDENCY:'적용 확인 대기',AUTH_REQUIRED:'인증 확인 필요',REJECTED:'전송 거절',ACKED:'서버 수신 확인',LOCAL_REVIEW_REQUIRED:'저장된 기록 확인 필요'};
  let generation = 0, operation = 0, busy = false, schedule = null, waitingTimer;
  function renderWait() {
    clearTimeout(waitingTimer);
    if (!schedule || panel.hidden) {wait.hidden = true;retry.disabled = busy;return;}
    const remaining = schedule.next_retry_at === null ? 0 : Math.max(0,Math.ceil((schedule.next_retry_at-Date.now())/1000));
    retry.disabled = busy || remaining > 0;
    wait.hidden = schedule.next_retry_at === null;
    if (remaining > 0) {
      const serverWait = schedule.retry_after_at > Date.now();
      wait.textContent = `${serverWait ? '서버 요청에 따라' : '재시도 간격에 따라'} 대기 중 · 약 ${remaining}초 후 재확인할 수 있습니다.`;
      waitingTimer = setTimeout(renderWait,1000);
    } else if (!wait.hidden) wait.textContent = '재확인 가능한 시간이 되었습니다. 전송 재확인을 누르거나 자동 확인을 기다려주세요.';
  }
  async function run(type) {
    const epoch = generation, request = ++operation;
    busy = true;check.disabled = retry.disabled = true;
    info.textContent = '전송 상태 확인 중…';
    let timer;
    try {
      const request_id = crypto.randomUUID();
      const response = await Promise.race([
        chrome.runtime.sendMessage({type,request_id,payload:{}}),
        new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('UNCONFIRMED')),30000); })
      ]);
      if (epoch !== generation || request !== operation) return;
      if (response?.request_id === request_id && response.status === 'ERROR'
        && response.error?.code === 'DELIVERY_STORAGE_UNAVAILABLE') throw new Error('DELIVERY_STORAGE_UNAVAILABLE');
      const data = response?.data;
      if (response?.request_id !== request_id || response.status !== 'OK' || !data?.counts
        || !Number.isSafeInteger(data.retry_after_at) || data.retry_after_at < 0
        || data.next_retry_at !== null && (!Number.isSafeInteger(data.next_retry_at) || data.next_retry_at < 0)
        || !Number.isSafeInteger(data.total) || data.total < 0
        || Object.keys(labels).some(key => !Number.isSafeInteger(data.counts[key]) || data.counts[key] < 0)
        || Object.keys(labels).reduce((sum,key) => sum + data.counts[key],0) !== data.total) throw new Error('UNCONFIRMED');
      schedule = {retry_after_at:data.retry_after_at,next_retry_at:data.next_retry_at};
      list.replaceChildren();
      for (const [key,label] of Object.entries(labels)) {
        const term = document.createElement('dt'), value = document.createElement('dd');
        term.textContent = label; value.textContent = `${data.counts[key]}건`; list.append(term,value);
      }
      info.textContent = data.counts.LOCAL_REVIEW_REQUIRED ? '문제가 있는 원문은 보존했습니다. 정상 기록은 계속 전송하며, 확인이 필요한 기록은 자동 재전송하지 않습니다.' : data.total ? '저장된 기록의 전송 상태를 확인했습니다.' : '현재 계정의 저장된 접근 기록이 없습니다.';
    } catch (error) {
      if (epoch === generation && request === operation) {schedule = null;info.textContent = error.message === 'DELIVERY_STORAGE_UNAVAILABLE'
        ? '로컬 저장소를 확인하지 못했습니다. 자료를 초기화하지 말고 저장 공간을 확인한 뒤 전송 재확인을 눌러주세요. 저장된 원문은 임의 삭제하지 않습니다.'
        : '전송 상태 미확인 · 계정 연결과 서버 상태를 확인해주세요. 이전 조회 값은 최신 상태가 아닐 수 있습니다.';}
    } finally {
      clearTimeout(timer);
      if (epoch === generation && request === operation) {busy = false;check.disabled = false;renderWait();}
    }
  }
  check.addEventListener('click',() => run('MEMBER_DELIVERY_STATE'));
  retry.addEventListener('click',() => {renderWait();if (!retry.disabled) run('MEMBER_DELIVERY_RECHECK');});
  window.addEventListener('focurve-member-state',event => {
    generation++; operation++; busy = false;schedule = null;clearTimeout(waitingTimer);wait.hidden = true;wait.textContent = '';list.replaceChildren(); info.textContent = '전송 상태 확인 중…';
    panel.hidden = !event.detail.linked;
    if (!panel.hidden) run('MEMBER_DELIVERY_STATE');
  });
})();
