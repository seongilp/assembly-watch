// dining.mjs — KA-money 파싱·집계 유틸리티
// 헤더 라벨 → 표준 키. 라벨 변형을 정규식으로 흡수, 없으면 -1.
const find = (header, re) => header.findIndex((h) => re.test(String(h || "").replace(/\s/g, "")));

export function mapColumns(header) {
  const incomeIdx = find(header, /^수입$/);
  // "지출" 계열: 리치파일엔 수입/지출 둘 다 있어 '지출'을 우선 선택
  const amount = (() => {
    const exact = find(header, /^지출(액|금회)?$/);
    return exact;
  })();
  return {
    member: find(header, /^의원명$/),
    party: find(header, /^당$/),
    region: find(header, /^지역명$/),
    date: find(header, /^연월일$/),
    desc: find(header, /^내역$/),
    amount,
    merchant: find(header, /^(성명(-법인단체명)?|사용처)$/),
    category: find(header, /^분류$/),
    address: find(header, /^주소$/),
    biz: find(header, /^업종$/),
  };
}

export const FOOD_CATEGORIES = new Set([
  "간담회_식대", "사무실_식대비", "언론_기자식대등", "간담회_다과",
]);

export const isFoodRow = (category) => FOOD_CATEGORIES.has(String(category || "").trim());

export function parseAmount(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : 0;
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
