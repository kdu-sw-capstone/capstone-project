import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCsrf,
  refreshCsrf,
  request,
  socialAuthorizationPath,
} from "./api";

afterEach(() => {
  clearCsrf();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function json(value: unknown, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
describe("API 재전송 계약 (HTTP 모의 검증)", () => {
  it("미설정 소셜 제공자는 화면 이동 전에 오류로 전달한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/csrf")
          ? json({ csrf_token: "test-only" })
          : json({ error: { code: "PROVIDER_UNAVAILABLE" } }, 503),
      ),
    );
    await expect(
      socialAuthorizationPath("google", "login"),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
  });
  it("외부 redirect를 fetch로 따라가지 않고 원래 authorize 경로로 이동한다", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith("/csrf")
        ? json({ csrf_token: "test-only" })
        : ({ type: "opaqueredirect" } as Response),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(socialAuthorizationPath("kakao", "link")).resolves.toBe(
      "/api/v1/auth/social/kakao/authorize?mode=link&return_path=%2F",
    );
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/kakao/authorize"),
      { credentials: "same-origin", redirect: "manual" },
    );
  });
  it("422는 같은 입력을 자동 재전송하지 않는다", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith("/csrf")
        ? json({ csrf_token: "test-only" })
        : json({ error: { code: "VALIDATION_FAILED", retryable: false } }, 422),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      request("/sites", "POST", {}, { key: "test-request" }),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/sites")),
    ).toHaveLength(1);
  });
  it("단회 인증 소비는 통신 오류여도 자동 재전송하지 않는다", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", fetch);
    await expect(
      request(
        "/auth/email/verify",
        "POST",
        { token: "test-only" },
        { challenge: true },
      ),
    ).rejects.toThrow("offline");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("재시도 가능한503은 Retry-After를 지키고 동일 키·본문으로 재전송한다", async () => {
    const posts: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/csrf")) return json({ csrf_token: "test-only" });
        posts.push(init!);
        return posts.length === 1
          ? json(
              { error: { code: "TEMPORARY_FAILURE", retryable: true } },
              503,
              { "Retry-After": "2" },
            )
          : json({ site_id: "1" }, 201);
      }),
    );
    await refreshCsrf();
    vi.useFakeTimers();
    const result = request(
      "/sites",
      "POST",
      { url: "example.org" },
      { key: "test-request" },
    );
    await vi.advanceTimersByTimeAsync(1900);
    expect(posts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toEqual({ site_id: "1" });
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual(posts[1]);
  });
});
  it("동시 CSRF 준비 요청은 한 세션으로 합친다", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const first = refreshCsrf(), second = refreshCsrf();
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(json({ csrf_token: "shared-session-only" }));
    await expect(Promise.all([first, second])).resolves.toEqual(["shared-session-only", "shared-session-only"]);
  });
  it("필터에서 거절된 CSRF 요청만 새 토큰으로 한 번 복구하며 본문과 키를 유지한다", async () => {
    let csrfCount = 0, postCount = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/csrf")) return json({ csrf_token: `session-${++csrfCount}` });
      return ++postCount === 1 ? json({error:{code:"CSRF_OR_ORIGIN_INVALID"}},403) : new Response(null,{status:202});
    });
    vi.stubGlobal("fetch",fetch);
    await request("/auth/email/verification-requests","POST",{email:"test@example.invalid"},{key:"unchanged-key"});
    const posts=fetch.mock.calls.filter(([url])=>!url.endsWith("/csrf"));
    expect(posts).toHaveLength(2);
    const calls=vi.mocked(globalThis.fetch).mock.calls.filter(([url])=>!String(url).endsWith("/csrf"));
    expect(calls[0][1]?.body).toEqual(calls[1][1]?.body);
    expect((calls[1][1]?.headers as Record<string,string>)["Idempotency-Key"]).toBe("unchanged-key");
    expect(csrfCount).toBe(2);
  });
  it("Origin 실패가 계속되면 두 번째 거절을 전달하고 보호를 우회하지 않는다",async()=>{
    const fetch=vi.fn(async(url:string)=>url.endsWith("/csrf")?json({csrf_token:"valid"}):json({error:{code:"CSRF_OR_ORIGIN_INVALID"}},403));
    vi.stubGlobal("fetch",fetch);
    await expect(request("/auth/login","POST",{email:"x@example.invalid"})).rejects.toMatchObject({status:403,code:"CSRF_OR_ORIGIN_INVALID"});
    expect(fetch.mock.calls.filter(([url])=>!url.endsWith("/csrf"))).toHaveLength(2);
  });
  it("단회 인증 링크 소비는 실패해도 자동 재전송하지 않는다",async()=>{
    const fetch=vi.fn(async()=>json({error:{code:"CSRF_OR_ORIGIN_INVALID"}},403));vi.stubGlobal("fetch",fetch);
    await expect(request("/auth/email/verify","POST",{token:"test-only"},{challenge:true})).rejects.toMatchObject({status:403});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
