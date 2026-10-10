import { useLayoutEffect, useState } from 'react';

import MemberApp from './MemberApp';

export default function App() {
  useLayoutEffect(() => { try { document.documentElement.dataset.theme = localStorage.getItem("focurve.preferences.theme") === "dark" ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; } }, []);
  const [status, setStatus] = useState('확인 전');
  const [checking, setChecking] = useState(false);
  async function checkServer() {
    setChecking(true);
    setStatus('확인 중');
    try {
      const response = await fetch('/actuator/health');
      if (!response.ok) throw new Error('Health request failed');
      const health: { status?: string } = await response.json();
      if (health.status !== 'UP') throw new Error('Server is not ready');
      setStatus('정상');
    } catch {
      setStatus('연결 실패 — 서버와 데이터베이스 실행 상태를 확인하세요.');
    } finally {
      setChecking(false);
    }
  }
  return <main><MemberApp />{import.meta.env.DEV && <details className="development-tools"><summary>개발 진단 도구</summary>
    <h1>FOCURVE 개발 준비</h1>
    <p>Web·Server·Database 개발 기반 확인 화면입니다. 제품 기능을 개발 중이며 실제 Extension 통합 검증은 별도로 진행합니다.</p>
    <button onClick={checkServer} disabled={checking}>서버 상태 확인</button>
    <p role="status" aria-live="polite">{status}</p>


  </details>}</main>;
}
