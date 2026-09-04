import { describe, it, expect } from "vitest";
import { buildCatalog } from "../../server/utils/instagram/catalog";
import type { Insights } from "#shared/types";

const member = (name: string, party: string, count: number) => ({
  id: name, name, party, origin: "x", photo: "", count,
});
const sample = {
  generatedAt: "2026-06-14T00:00:00Z", voteBills: 60,
  terms: [member("송영길", "더불어민주당", 6), member("조경태", "국민의힘", 6)],
  proposed: [member("윤준병", "더불어민주당", 305)],
  leastProposed: [], absent: [member("송언석", "국민의힘", 60)],
  yes: [member("이재강", "더불어민주당", 50)],
  no: [member("손솔", "진보당", 20)],
  blank: [member("손솔", "진보당", 12)],
  attendanceLow: [{ ...member("a", "국민의힘", 0), rate: 71.2 }],
} as unknown as Insights;

describe("buildCatalog", () => {
  it("덱 항목마다 top5 이하 items 를 가진 PostSpec 생성", () => {
    const specs = buildCatalog(sample);
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) {
      expect(s.slug).toBeTruthy();
      expect(s.headline).toBeTruthy();
      expect(s.items.length).toBeGreaterThan(0);
      expect(s.items.length).toBeLessThanOrEqual(5);
      for (const it of s.items) expect(typeof it.value).toBe("number");
    }
  });
  it("정당명을 정규화한다", () => {
    const terms = buildCatalog(sample).find((s) => s.slug === "terms")!;
    expect(terms.items[0]!.party).toBe("더불어민주당");
  });
  it("빈 배열 카테고리는 제외", () => {
    const slugs = buildCatalog(sample).map((s) => s.slug);
    expect(slugs).not.toContain("leastProposed");
  });
});
