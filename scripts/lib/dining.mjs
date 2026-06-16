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

export function normalizeMerchant(v) {
  let s = String(v ?? "").trim();
  if (!s) return "";
  s = s.replace(/\([^)]*\)/g, "");                       // (국회의사당) 등 괄호 제거
  // 지역명 + 점 형태의 지점 접미사 제거 (서여의도점, 국회점 등)
  s = s.replace(/(?:서울|여의도|국회|강남|홍대|신촌|명동|종로|광화문|마포|용산|서여의도)[가-힣]*점$/u, "");
  return s.replace(/\s+/g, "").trim();
}

const CUISINE_RULES = [
  ["구내식당", /구내식당/],
  ["카페·음료", /카페|커피|음료|스타벅스|투썸|이디야|파리바게|베이커리|제과/],
  ["고기·구이", /갈비|숯불|구이|삼겹|곱창|족발|한우|불고기/],
  ["일식", /일식|스시|초밥|돈카츠|라멘|우동|이자카야/],
  ["중식", /중식|중화|짜장|마라|반점|루\b/],
  ["양식", /양식|파스타|피자|스테이크|레스토랑|이탈리/],
  ["분식·면", /분식|국수|냉면|칼국수|김밥/],
  ["주점", /주점|호프|포차|맥주|와인|바\b/],
  ["한식", /한식|국밥|백반|찌개|한정식|식당|음식점|음식업|요식|외식/],
];

// 업종(biz) 우선, 없으면 가게명. 매칭 없으면 "기타".
export function inferCuisine(merchant, biz) {
  const hay = `${String(biz || "")} ${String(merchant || "")}`;
  for (const [label, re] of CUISINE_RULES) if (re.test(hay)) return label;
  return "기타";
}

const SIDO = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const SIDO_ALIAS = {
  서울특별시:"서울", 부산광역시:"부산", 대구광역시:"대구", 인천광역시:"인천", 광주광역시:"광주",
  대전광역시:"대전", 울산광역시:"울산", 세종특별자치시:"세종", 경기도:"경기",
  강원특별자치도:"강원", 강원도:"강원", 충청북도:"충북", 충청남도:"충남",
  전북특별자치도:"전북", 전라북도:"전북", 전라남도:"전남", 경상북도:"경북", 경상남도:"경남", 제주특별자치도:"제주",
};
function sidoOf(addr) {
  const a = String(addr || "").trim();
  for (const [full, s] of Object.entries(SIDO_ALIAS)) if (a.startsWith(full)) return s;
  for (const s of SIDO) if (a.startsWith(s)) return s;
  return null;
}
export function guOf(addr) {
  const s = sidoOf(addr);
  if (!s) return null;
  let rest = String(addr).trim();
  for (const full of Object.keys(SIDO_ALIAS)) if (rest.startsWith(full)) { rest = rest.slice(full.length); break; }
  for (const sd of SIDO) if (rest.startsWith(sd)) { rest = rest.slice(sd.length); break; }
  const m = rest.match(/^\s*([가-힣]+?[시군구])/);
  return m ? `${s} ${m[1]}` : null;
}
export function originGu(origin) {
  const o = String(origin || "").trim();
  if (!o || o.includes("비례")) return null;
  const s = SIDO.find((sd) => o.startsWith(sd));
  if (!s) return null;
  const rest = o.slice(s.length);
  const m = rest.match(/^\s*([가-힣]+?[시군구])/);
  return m ? `${s} ${m[1]}` : null;
}
export const inOwnDistrict = (restaurantGu, memberGu) =>
  !!restaurantGu && !!memberGu && restaurantGu === memberGu;
