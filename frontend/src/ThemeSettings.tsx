import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const key = 'focurve.preferences.theme';

export default function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(key) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function change(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem(key, next);
      setError('');
    } catch {
      setError(
        '현재 화면에는 적용했지만 화면 모드를 저장하지 못했습니다. 새로고침 후 유지되지 않을 수 있습니다.'
      );
    }
  }
  return (
    <section className="theme-panel" aria-labelledby="theme-heading">
      <div className="theme-description"><h2 id="theme-heading">화면 모드</h2><p>선택한 모드는 이 브라우저에 저장됩니다.</p></div>
      <div className="theme-options" role="group" aria-label="화면 모드">
        <button aria-pressed={theme === 'light'} onClick={() => change('light')}>라이트</button>
        <button aria-pressed={theme === 'dark'} onClick={() => change('dark')}>다크</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
