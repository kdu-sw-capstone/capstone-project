import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import ThemeSettings from './ThemeSettings';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('SETTING-02: Web 로컬 화면 모드', () => {
  it('AC-SETTING-02-01: 첫 방문 라이트, 변경 즉시 전체 문서에 적용', () => {
    render(<ThemeSettings />);
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByRole('button', {name:'다크'}));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('focurve.preferences.theme')).toBe('dark');
  });
  it('AC-SETTING-02-02: 저장 실패에도 현 화면 적용하고 실패 안내', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied');
    });
    render(<ThemeSettings />);
    fireEvent.click(screen.getByRole('button', {name:'다크'}));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다');
  });
  it('AC-SETTING-02-03: 다시 마운트해 복구하고 다른 저장 자료 보존', () => {
    localStorage.setItem('other-account-data', 'preserve');
    const view = render(<ThemeSettings />);
    fireEvent.click(screen.getByRole('button', {name:'다크'}));
    view.unmount();
    render(<ThemeSettings />);
    expect(screen.getByRole('button', {name:'다크'})).toHaveAttribute('aria-pressed','true');
    expect(localStorage.getItem('other-account-data')).toBe('preserve');
  });
  it('저장 자료가 없거나 읽을 수 없어도 라이트로 실행', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied');
    });
    render(<ThemeSettings />);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
