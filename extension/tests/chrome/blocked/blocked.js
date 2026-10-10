const host = new URL(location.href).searchParams.get('host');
document.querySelector('#host').textContent = host ? `등록 대상: ${host}` : '등록 대상 확인 불가';
// Do not navigate back to a still-blocked site or create any access event here.
document.querySelector('#back').onclick = () => { location.href = chrome.runtime.getURL('runner.html'); };
