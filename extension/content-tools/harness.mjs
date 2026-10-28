import { ContentController } from '../content/controller.mjs';
const result = document.querySelector('#result');
const controller = new ContentController(document, values => result.textContent = JSON.stringify(values, null, 2));
document.querySelector('#start').onclick = () => {
  controller.release();
  document.querySelector('#fixture').textContent = '일반 콘텐츠';
  controller.start({ keywords: { enabled: true, exceptions: [], rules: [{text:'검증대상',scopes:['BODY']}] } });
};
document.querySelector('#change').onclick = () => {
  document.querySelector('#fixture').textContent = '검증대상';
  // Harness-only timer: restore access to the test controls. Product has no timer bypass.
  setTimeout(() => { const released = controller.release(); result.textContent = '합성 검증 자동 해제: ' + released; }, 3000);
};
document.querySelector('#release').onclick = () => { result.textContent = '해제: ' + controller.release(); };
