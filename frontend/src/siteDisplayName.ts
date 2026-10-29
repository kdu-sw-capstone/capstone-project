/** Same Unicode code point contract as Server and frozen Snapshot validation. */
export function siteDisplayNameError(value: string): string {
  if (!value.trim()) return "사이트 이름을 입력해 주세요.";
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
    return "사이트 이름에 올바르지 않은 문자가 있습니다.";
  }
  return [...value].length > 100 ? "사이트 이름은 100자 이하로 입력해 주세요." : "";
}
