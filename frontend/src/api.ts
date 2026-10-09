export class UiError extends Error {}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public retryable = false,
    public retryAfter = 0,
  ) {
    super(code);
  }
}
let csrf: string | null = null;
let csrfPending: Promise<string> | null = null;
let csrfGeneration = 0;
export function clearCsrf() {
  csrf = null;
  csrfGeneration++;
  csrfPending = null;
}
export async function refreshCsrf(): Promise<string> {
  // One bootstrap per page: concurrent probes must share the same HttpOnly session.
  if (csrfPending) return csrfPending;
  const generation = csrfGeneration;
  const pending = (async () => {
    const response = await fetch("/api/v1/auth/csrf", { credentials: "same-origin" });
    if (!response.ok) throw new ApiError("CSRF_UNAVAILABLE", response.status);
    const result = (await response.json()) as { csrf_token: string };
    if (generation !== csrfGeneration) throw new ApiError("CSRF_UNAVAILABLE", 409);
    csrf = result.csrf_token;
    return csrf;
  })();
  csrfPending = pending;
  try { return await pending; } finally { if (csrfPending === pending) csrfPending = null; }
}
export async function socialAuthorizationPath(
  provider: string,
  mode: "login" | "link",
) {
  await refreshCsrf();
  const path = `/api/v1/auth/social/${provider}/authorize?mode=${mode}&return_path=%2F`;
  // A manual redirect never sends the browser's fetch to the external provider.
  // Keep configuration errors in this screen. A successful redirect is opaque;
  // navigation creates a fresh state and the unused probe state expires normally.
  const response = await fetch(path, {
    credentials: "same-origin",
    redirect: "manual",
  });
  if (response.type === "opaqueredirect") return path;
  let code = "PROVIDER_UNAVAILABLE";
  try {
    code = (await response.json()).error?.code ?? code;
  } catch {
    /* No secrets in errors. */
  }
  throw new ApiError(code, response.status);
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  options: {
    key?: string;
    version?: number;
    challenge?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (method !== "GET" && !options.challenge) {
    // The cookie may have rotated in another tab or expired since the last request.
    headers["X-CSRF-Token"] = await refreshCsrf();
  }
  if (options.key) headers["Idempotency-Key"] = options.key;
  if (options.version !== undefined)
    headers["If-Match"] = `"${options.version}"`;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  async function send(): Promise<T> {
    const response = await fetch("/api/v1" + path, {
      method,
      credentials: "same-origin",
      headers,
      body: payload,
      signal: options.signal,
    });
    if (!response.ok) {
      let code = "SERVER_ERROR",
        retryable = false;
      try {
        const result = await response.json();
        code = result.error?.code ?? code;
        retryable = result.error?.retryable === true;
      } catch {
        /* Preserve non-JSON errors. */
      }
      const after = Number(response.headers.get("Retry-After") ?? 0);
      throw new ApiError(
        code,
        response.status,
        retryable,
        Number.isFinite(after) ? Math.max(0, after) : 0,
      );
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  // Only reads and requests protected by a stable server idempotency key are replayed.
  const delays = [1, 2, 4, 8, 16, 30];
  let protectionRecovered = false;
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      // This exact filter rejection happens before controller work. Recover once;
      // never replay challenge consumption or bypass Origin/CSRF protection.
      if (!protectionRecovered && method !== "GET" && !options.challenge && error instanceof ApiError && error.status === 403 && error.code === "CSRF_OR_ORIGIN_INVALID") {
        protectionRecovered = true;
        headers["X-CSRF-Token"] = await refreshCsrf();
        continue;
      }
      const transient =
        !(error instanceof ApiError) ||
        (error.retryable &&
          [429, 503].includes(error.status) &&
          ![
            "MAIL_UNAVAILABLE",
            "PROVIDER_UNAVAILABLE",
            "LINK_APPROVAL_CONTRACT_UNRESOLVED",
          ].includes(error.code));
      if (
        options.signal?.aborted ||
        !(method === "GET" || options.key) ||
        options.challenge ||
        !transient ||
        attempt >= delays.length
      )
        throw error;
      const pause = Math.max(
        delays[attempt] * (0.75 + Math.random() * 0.5),
        error instanceof ApiError ? error.retryAfter : 0,
      );
      await new Promise<void>((resolve, reject) => {
        const signal = options.signal;
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", abort);
          resolve();
        }, pause * 1000);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
    }
  }
}
export function message(error: unknown) {
  if (error instanceof UiError) return error.message;
  if (!(error instanceof ApiError))
    return "통신 실패 — 입력을 보존했습니다. 같은 요청으로 다시 확인하세요.";
  const messages: Record<string, string> = {
    EMAIL_IN_USE: "이미 등록된 이메일입니다.",
    CONTACT_EMAIL_REQUIRED:"서비스 이메일 인증을 먼저 완료하세요.",
    EMAIL_ALREADY_VERIFIED:"이미 인증된 이메일이 있습니다. 상태를 새로고침하세요.",
    INVALID_IDENTITY:"소셜 제공자의 인증을 확인하지 못했습니다.",
    IDENTITY_ALREADY_LINKED:"이미 연결된 제공자 계정입니다. 기존 계정으로 로그인하거나 재인증하세요.",
    IDENTITY_MISMATCH:"현재 로그인 계정과 인증한 계정이 일치하지 않습니다.",
    REAUTHENTICATION_REQUIRED:"현재 계정을 다시 인증한 뒤 연결을 확정하세요.",
    CONSENT_REQUIRED:"계정 연결에 대한 명시적 동의가 필요합니다.",
    GUEST_SESSION_ACTIVE:"확장 프로그램의 비회원 집중을 종료하고 실제 해제를 확인한 뒤 다시 연결하세요.",
    EXECUTION_EVIDENCE_REQUIRED:"확장 프로그램의 최신 실행 상태 확인이 필요합니다. 확장 프로그램에서 연결을 다시 요청하세요.",
    LINK_EXPIRED:"연결 요청이 만료되었거나 사용되었습니다. 확장 프로그램에서 다시 요청하세요.",
    VALIDATION_FAILED: "입력 값을 확인하세요.",
    INVALID_DATE_RANGE:
      "조회 기간을 확인하세요. 시작 날짜는 종료 날짜보다 늦을 수 없고 최대 366일입니다.",
    INVALID_CREDENTIALS: "이메일 또는 비밀번호를 확인하세요.",
    EMAIL_UNVERIFIED: "이메일 인증을 먼저 완료하세요.",
    EMAIL_CODE_REQUIRED: "이메일 인증번호를 먼저 확인해 주세요. 인증한 브라우저에서 가입을 완료하세요.",
    CODE_FORMAT_INVALID: "인증번호는 숫자 6자리로 입력하세요.",
    CODE_INVALID: "인증번호가 일치하지 않습니다. 메일의 최신 번호를 확인하세요.",
    CODE_EXPIRED: "인증번호 또는 인증 완료 상태가 만료되었습니다. 새 번호를 요청하세요.",
    CODE_SUPERSEDED: "새 인증번호가 발송되어 이전 번호는 사용할 수 없습니다. 최신 번호를 입력하세요.",
    CODE_USED: "이미 사용된 인증번호입니다. 가입 결과를 확인하거나 새 번호를 요청하세요.",
    CODE_ATTEMPTS_EXCEEDED: "인증번호를 5회 잘못 입력해 사용할 수 없습니다. 새 번호를 요청하세요.",
    TOKEN_EXPIRED: "링크가 만료되었거나 올바르지 않습니다. 새 메일을 요청해 주세요.",
    CSRF_UNAVAILABLE: "요청 인증 정보를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    USED_TOKEN: "이미 사용된 인증 링크입니다.",
    VERSION_CONFLICT:
      "다른 변경이 있습니다. 최신 값과 편집 값을 확인한 뒤 다시 저장하세요.",
    SITE_SCOPE_CONFLICT: "같은 호스트의 사이트가 이미 있습니다. 기존 항목을 수정하세요. 삭제한 호스트는 새 등록으로 복원할 수 있습니다.",
    UNAUTHENTICATED: "로그인이 필요합니다.",
    CSRF_OR_ORIGIN_INVALID:
      "요청 인증에 실패했습니다. 다시 로그인하거나 화면을 새로고침하세요.",
    MAIL_UNAVAILABLE:
      "메일 서비스 설정 또는 연결을 확인하세요. 가입 성공으로 처리하지 않았습니다.",
    PROVIDER_UNAVAILABLE: "소셜 인증 설정이 없어 사용할 수 없습니다.",
    LINK_APPROVAL_CONTRACT_UNRESOLVED:
      "확장 프로그램 연결 확인 절차가 준비되지 않아 연결할 수 없습니다. 연결 완료로 처리하지 않았습니다.",
    EXECUTOR_OFFLINE: "실행할 Extension의 연결이 확인되지 않습니다.",
    SNAPSHOT_COMPATIBILITY_REQUIRED: "이 Extension의 정책 버전 호환성 검증이 필요합니다. 검증 완료 후 집중을 시작할 수 있습니다.",
    ACTIVE_SESSION_EXISTS: "이미 실행 중이거나 결과 확인 중인 세션이 있습니다.",
    ACTIVE_EXECUTION_OR_LINK:
      "실제 정책 해제와 현재 설치의 연결 종료를 먼저 확인하세요.",
    RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
    IDENTITY_CONFLICT:
      "기존 계정과 충돌합니다. 자동으로 계정을 합치지 않습니다.",
    INVALID_STATE: "소셜 인증 요청을 확인할 수 없습니다.",
  };
  return messages[error.code] ?? `요청 실패 (${error.code})`;
}
