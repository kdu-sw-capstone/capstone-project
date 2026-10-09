const koreanTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Display the server's instant; never substitute the browser's current time. */
export default function QueryTimestamp({ value }: { value: unknown }) {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <>시각 확인 불가</>;
  return <span className="query-timestamp">
    <time dateTime={String(value)}>{koreanTime.format(date)} (한국 시간)</time>
    <details><summary>원본 시각</summary><code>{String(value)}</code></details>
  </span>;
}
