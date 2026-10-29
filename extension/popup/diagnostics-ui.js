// Display gate only; no privileged API or storage mutation.
(() => {document.querySelector('#developer-diagnostics').hidden=globalThis.FocurvePopupBuild?.diagnostics!==true;document.querySelector('#developer-focus-check').addEventListener('click',()=>document.querySelector('#refresh-focus').click());})();
