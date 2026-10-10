export const FEATURES = [
  ["YOUTUBE_SHORTS", "YouTube Shorts 제한", "youtube.com"],
  ["YOUTUBE_RECOMMENDATIONS", "YouTube 추천 콘텐츠 숨김", "youtube.com"],
  ["YOUTUBE_COMMENTS", "YouTube 댓글 숨김", "youtube.com"],
  ["YOUTUBE_AUTOPLAY", "YouTube 자동재생 제한", "youtube.com"],
  ["INSTAGRAM_REELS", "Instagram Reels 제한", "instagram.com"],
  ["INSTAGRAM_RECOMMENDATIONS", "Instagram 추천 피드 숨김", "instagram.com"],
] as const;

export function featureHostMatches(value: string, code: string): boolean {
  try {
    const source = value.includes("://") ? value : "https://" + value;
    // URL.port loses explicit default ports. Inspect the original authority,
    // matching the Server contract that rejects every explicit port.
    const authority = source.match(/^[^:/?#]+:\/\/([^/?#]*)/)?.[1];
    if (!authority || authority.includes(":")) return false;
    const url = new URL(source);
    const domain = FEATURES.find(f => f[0] === code)?.[2];
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return !!domain && ["http:", "https:"].includes(url.protocol)
      && !url.port && !url.username && !url.password
      && (host === domain || host.endsWith("." + domain));
  } catch { return false; }
}

export default function FeatureSettings({url, values, busy, blocked, onChange}: {
  url: string; values: Record<string, boolean>; busy: boolean; blocked: boolean;
  onChange: (code: string, enabled: boolean) => void;
}) {
  return <fieldset className="feature-settings">
    <legend>사이트 내부 기능 설정</legend>
    <p className="muted">해당 서비스의 호스트에서 설정할 수 있습니다. 저장한 변경은 다음 세션부터 적용합니다.</p>
    {FEATURES.map(([code, label]) => {
      const supported = featureHostMatches(url, code);
      const pending = code !== "YOUTUBE_SHORTS";
      return <label key={code}>
        <input type="checkbox" checked={!!values[code]}
          disabled={busy || (!supported && !values[code])}
          onChange={e => onChange(code, e.target.checked)}/>
        <span>{label}{!supported && <small> · 해당 서비스 호스트가 필요합니다</small>}
          {pending && <small> · 설정 저장 가능 / 실제 실행 미지원</small>}</span>
      </label>;
    })}
    {blocked && <p className="muted">전체 차단 정책이 내부 기능 제한보다 우선합니다.</p>}
    {FEATURES.some(([code]) => code !== "YOUTUBE_SHORTS" && values[code]) &&
      <p role="status">추가 기능이 켜져 있으면 현재 집중 시작은 제한됩니다. Core 호환 검증 전에는 해당 정책을 발급하지 않습니다.</p>}
  </fieldset>;
}
