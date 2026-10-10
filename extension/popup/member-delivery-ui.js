(() => {
  const panel = document.getElementById('member-delivery-panel');
  const info = document.getElementById('member-delivery-status');
  const list = document.getElementById('member-delivery-counts');
  const check = document.getElementById('member-delivery-check');
  const retry = document.getElementById('member-delivery-recheck');
  const labels = {QUEUED:'전송 대기',IN_FLIGHT:'전송 중',RESPONSE_UNCONFIRMED:'응답 미확인',
    PENDING_DEPENDENCY:'적용 확인 대기',AUTH_REQUIRED:'인증 확인 필요',REJECTED:'전송 거절',ACKED:'서버 수신 확인',LOCAL_REVIEW_REQUIRED:'저장된 기록 확인 필요'};
  let generation = 0, operation = 0;
  async function run(type) {
    const epoch = generation, request = ++operation;
    check.disabled = retry.disabled = true;
    info.textContent = '전송 상태 확인 중…';
    let timer;
    try {
      const request_id = crypto.randomUUID();
      const response = await Promise.race([
        chrome.runtime.sendMessage({type,request_id,payload:{}}),
        new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('UNCONFIRMED')),30000); })
      ]);
      if (epoch !== generation || request !== operation) return;
      const data = response?.data;
      if (response?.request_id !== request_id || response.status !== 'OK' || !data?.counts
        || !Number.isSafeInteger(data.total) || data.total < 0
        || Object.keys(labels).some(key => !Number.isSafeInteger(data.counts[key]) || data.counts[key] < 0)
        || Object.keys(labels).reduce((sum,key) => sum + data.counts[key],0) !== data.total) throw new Error('UNCONFIRMED');
      list.replaceChildren();
      for (const [key,label] of Object.entries(labels)) {
        const term = document.createElement('dt'), value = document.createElement('dd');
        term.textContent = label; value.textContent = `${data.counts[key]}건`; list.append(term,value);
      }
      info.textContent = data.counts.LOCAL_REVIEW_REQUIRED ? '문제가 있는 원문은 보존했습니다. 정상 기록은 계속 전송하며, 확인이 필요한 기록은 자동 재전송하지 않습니다.' : data.total ? '저장된 기록의 전송 상태를 확인했습니다.' : '현재 계정의 저장된 접근 기록이 없습니다.';
    } catch {
      if (epoch === generation && request === operation) info.textContent = '전송 상태 미확인 · 계정 연결과 서버 상태를 확인해주세요. 이전 조회 값은 최신 상태가 아닐 수 있습니다.';
    } finally {
      clearTimeout(timer);
      if (epoch === generation && request === operation) check.disabled = retry.disabled = false;
    }
  }
  check.addEventListener('click',() => run('MEMBER_DELIVERY_STATE'));
  retry.addEventListener('click',() => run('MEMBER_DELIVERY_RECHECK'));
  window.addEventListener('focurve-member-state',event => {
    generation++; operation++; list.replaceChildren(); info.textContent = '전송 상태 확인 중…';
    panel.hidden = !event.detail.linked;
    if (!panel.hidden) run('MEMBER_DELIVERY_STATE');
  });
})();
