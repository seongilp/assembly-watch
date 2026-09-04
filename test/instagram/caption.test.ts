import { describe, it, expect } from "vitest";
import { buildCaption } from "../../server/utils/instagram/caption";
import type { PostSpec } from "../../server/utils/instagram/catalog";

const spec: PostSpec = {
  slug: "terms", category: "terms", headline: "최다선 의원 TOP 5",
  subtitle: "22대 국회 · 당선 횟수 기준", hashtags: ["다선", "중진의원"],
  items: [
    { name: "송영길", party: "더불어민주당", value: 6, unit: "선" },
    { name: "조경태", party: "국민의힘", value: 6, unit: "선" },
    { name: "주호영", party: "국민의힘", value: 6, unit: "선" },
    { name: "권성동", party: "국민의힘", value: 5, unit: "선" },
  ],
};

describe("buildCaption", () => {
  it("헤드라인·상위3명·사이트·해시태그를 포함", () => {
    const cap = buildCaption(spec);
    expect(cap).toContain("최다선 의원 TOP 5");
    expect(cap).toContain("송영길");
    expect(cap).toContain("주호영");
    expect(cap).not.toContain("권성동"); // top3 만
    expect(cap).toContain("asm.zihado.com");
    expect(cap).toContain("#국회");
    expect(cap).toContain("#다선");
  });
  it("undefined/NaN 누출 없음", () => {
    expect(buildCaption(spec)).not.toMatch(/undefined|NaN/);
  });
});
