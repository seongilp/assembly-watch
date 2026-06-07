/** 선거구(ORIG_NM) → 시도 추출 + 지역 메타 */

const SIDO = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];

/** "경기 용인시정" → "경기", "비례대표" → "비례" */
export function regionOf(origin: string): string {
  const o = (origin || "").trim();
  if (!o) return "기타";
  if (o.includes("비례")) return "비례";
  const head = o.split(/\s+/)[0] ?? "";
  for (const s of SIDO) {
    if (head.startsWith(s) || o.startsWith(s)) return s;
  }
  // "강원특별자치도", "전북특별자치도" 등 대응
  const alias: Record<string, string> = {
    강원특별자치도: "강원",
    전북특별자치도: "전북",
    제주특별자치도: "제주",
    세종특별자치시: "세종",
  };
  return alias[head] ?? head.slice(0, 2);
}

/** 표시 순서 (수도권→지방, 비례/기타는 뒤) */
export const REGION_ORDER = [
  ...SIDO,
  "비례",
  "기타",
];

export function regionRank(region: string): number {
  const i = REGION_ORDER.indexOf(region);
  return i === -1 ? 999 : i;
}

/**
 * 타일 카토그램용 좌표 (행,열) — 대한민국 시도 대략적 지리 배치.
 * 그리드 8행 x 7열.
 */
export const REGION_TILE: Record<string, { r: number; c: number }> = {
  강원: { r: 1, c: 5 },
  서울: { r: 2, c: 3 },
  경기: { r: 2, c: 4 },
  인천: { r: 2, c: 2 },
  충북: { r: 3, c: 4 },
  경북: { r: 3, c: 5 },
  세종: { r: 4, c: 3 },
  대전: { r: 4, c: 4 },
  충남: { r: 4, c: 2 },
  대구: { r: 4, c: 5 },
  전북: { r: 5, c: 3 },
  경남: { r: 5, c: 5 },
  울산: { r: 4, c: 6 },
  광주: { r: 6, c: 2 },
  전남: { r: 6, c: 3 },
  부산: { r: 6, c: 5 },
  제주: { r: 7, c: 2 },
  비례: { r: 7, c: 6 },
  기타: { r: 8, c: 6 },
};
