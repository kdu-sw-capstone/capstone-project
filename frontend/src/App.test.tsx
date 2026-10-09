import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

describe('개발 환경 상태 확인', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), {
            status: 401,
          })
      )
    );
  });
  it('실제 서버 확인 전에는 성공으로 표시하지 않는다', () => {
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('확인 전');
  });
  it('정상 응답을 받은 뒤 상태를 표시한다 (HTTP 모의 검증)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/api/v1')
          ? new Response(
              JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }),
              { status: 401 }
            )
          : { ok: true, json: async () => ({ status: 'UP' }) }
      )
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '서버 상태 확인' }));
    expect(await screen.findByText('정상')).toBeInTheDocument();
  });
  it.each([
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve({ ok: false }),
    () => Promise.resolve({ ok: true, json: async () => ({ status: 'DOWN' }) }),
  ])(
    '통신·서버 실패를 정상으로 표시하지 않는다 (HTTP 모의 검증)',
    async (request) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url.startsWith('/api/v1')
            ? new Response(
                JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }),
                { status: 401 }
              )
            : request()
        )
      );
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: '서버 상태 확인' }));
      expect(await screen.findByText(/연결 실패/)).toBeInTheDocument();
    }
  );
});
