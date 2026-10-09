import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import QueryTimestamp from "./QueryTimestamp";

afterEach(cleanup);
describe("query instant display", () => {
  it("uses the next Korean calendar day at the UTC boundary and retains the raw instant", () => {
    const raw = "2026-10-08T15:00:01.123456Z";
    render(<QueryTimestamp value={raw} />);
    const time = screen.getByText("2026. 10. 09. 00:00:01 (한국 시간)");
    expect(time.getAttribute("datetime")).toBe(raw);
    expect(screen.getByText(raw).closest("details")?.hasAttribute("open")).toBe(false);
  });
  it("normalizes an offset instant to Korean time", () => {
    render(<QueryTimestamp value="2026-10-08T09:30:00-04:00" />);
    expect(screen.getByText("2026. 10. 08. 22:30:00 (한국 시간)")).toBeDefined();
  });
  it("does not invent a current timestamp for an invalid response", () => {
    render(<QueryTimestamp value="invalid" />);
    expect(screen.getByText("시각 확인 불가")).toBeDefined();
    expect(document.querySelector("time")).toBeNull();
  });
});
