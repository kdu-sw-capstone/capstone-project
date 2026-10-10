import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./UiLayout";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Sidebar 조회 생명주기 (HTTP 모의)", () => {
  it("화면 이탈 시 진행 중 조회와 연결 변경 listener를 취소한다", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const view = render(<Sidebar tab="dashboard" onSelect={vi.fn()} />);
    expect(fetch).toHaveBeenCalledTimes(1);
    const signal = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal;
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify([]), { status: 200 })); });
    window.dispatchEvent(new Event("focurve:connection-changed"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("이탈 시 대기 중 재시도를 취소하여 다음 화면의 fetch에 유입하지 않는다", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const first = vi.fn(async () => { throw new TypeError("synthetic offline"); });
    vi.stubGlobal("fetch", first);
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<Sidebar tab="dashboard" onSelect={vi.fn()} />); });
    expect(first).toHaveBeenCalledTimes(1);
    view.unmount();
    const next = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", next);
    await act(async () => { await vi.advanceTimersByTimeAsync(80000); });
    expect(next).not.toHaveBeenCalled();
  });
});
