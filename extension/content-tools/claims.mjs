import { ClaimLedger } from '../content/claim-ledger.mjs';
const target = document.querySelector('#target');
let ledger = new ClaimLedger(document), clicks = 0;
const active = new Set();
function publish(action, outcome) {
  document.querySelector('#action').textContent = action;
  document.querySelector('#result').textContent = JSON.stringify({
    action, outcome, active: [...active], display: getComputedStyle(target).display,
    inline_display: target.style.display, inert: target.inert, filter: target.style.filter,
    local_ledger: ledger.inspect(),
  }, null, 2);
}
function apply(claim) {
  const verified = claim === 'gray' ? ledger.grayscale(claim, target) : ledger.hide(claim, target);
  active.add(claim); publish(`${claim} 제한 적용`, { verified });
}
function release(claim) {
  const outcome = ledger.release(claim);
  if (outcome.restored) active.delete(claim);
  publish(`${claim} 제한 해제`, outcome);
}
document.querySelector('#hide-a').onclick = () => apply('A');
document.querySelector('#hide-b').onclick = () => apply('B');
document.querySelector('#release-a').onclick = () => release('A');
document.querySelector('#release-b').onclick = () => release('B');
document.querySelector('#gray').onclick = () => apply('gray');
document.querySelector('#ungray').onclick = () => release('gray');
document.querySelector('#page-change').onclick = () => {
  target.style.display = 'flex'; target.style.flexWrap = 'wrap'; target.inert = false;
  publish('페이지가 display:flex와 inert:false로 변경', null);
};
document.querySelector('#rescan').onclick = () => {
  const outcomes = [...active].map(claim => ({ claim, verified: claim === 'gray' ? ledger.grayscale(claim, target) : ledger.hide(claim, target) }));
  publish('활성 제한 재확인', outcomes);
};
document.querySelector('#reset').onclick = () => {
  const outcomes = [...active].map(claim => ledger.release(claim));
  if (outcomes.some(outcome => !outcome.restored)) { publish('복원 실패: 초기화 보류', outcomes); return; }
  ledger.suspend(); ledger = new ClaimLedger(document); active.clear();
  target.style.removeProperty('display'); target.style.removeProperty('flex-wrap');
  target.style.filter = 'brightness(.9)'; target.inert = false;
  publish('시험 상태 초기화', null);
};
document.querySelector('#target-button').onclick = () => {
  document.querySelector('#click-count').textContent = `클릭 ${++clicks}회`;
};
publish('준비됨', null);
