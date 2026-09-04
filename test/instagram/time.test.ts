import { describe, it, expect } from "vitest";
import { todayKST } from "../../server/utils/instagram/time";

describe("todayKST", () => {
  it("UTC 자정 직전(16:30Z)이면 KST 다음날", () => {
    expect(todayKST(new Date("2026-06-14T16:30:00Z"))).toBe("2026-06-15");
  });
  it("UTC 14:00Z 면 KST 같은날 23시", () => {
    expect(todayKST(new Date("2026-06-14T14:00:00Z"))).toBe("2026-06-14");
  });
  it("UTC 00:00Z(=KST 09:00) cron 시각이면 같은 날", () => {
    expect(todayKST(new Date("2026-06-15T00:00:00Z"))).toBe("2026-06-15");
  });
});
