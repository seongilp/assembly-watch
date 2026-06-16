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

// 같은 의원·가게·금액의 음/양 쌍을 상쇄(정정·반환). 남은 양수 행만 집계.
function netRows(rows) {
  const neg = new Map();
  for (const r of rows) if (r.amount < 0) {
    const k = `${r.member}|${r.merchant}|${Math.abs(r.amount)}`;
    neg.set(k, (neg.get(k) || 0) + 1);
  }
  const out = [];
  for (const r of rows) {
    if (r.amount <= 0) continue;
    const k = `${r.member}|${r.merchant}|${r.amount}`;
    if (neg.get(k) > 0) { neg.set(k, neg.get(k) - 1); continue; } // 상쇄
    out.push(r);
  }
  return out;
}

const topN = (arr, key, n) => [...arr].sort((a, b) => b[key] - a[key]).slice(0, n);

function bucketRows(rowsByMember, members, field) {
  const acc = new Map(); // key -> {n:Set, amount, visits, cuisine:Map}
  for (const [name, agg] of rowsByMember) {
    const dem = members.get(name);
    if (!dem || dem[field] == null) continue;
    const key = dem[field];
    if (!acc.has(key)) acc.set(key, { members: new Set(), amount: 0, visits: 0, cuisine: new Map() });
    const a = acc.get(key);
    a.members.add(name); a.amount += agg.amount; a.visits += agg.visits;
    for (const [c, v] of agg.cuisine) a.cuisine.set(c, (a.cuisine.get(c) || 0) + v);
  }
  return [...acc.entries()].map(([key, a]) => ({
    key, n: a.members.size,
    avgMeal: a.visits ? Math.round(a.amount / a.visits) : 0,
    topCuisine: topMapKey(a.cuisine),
  })).sort((x, y) => y.n - x.n);
}
const topMapKey = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "기타";

// 가게단위로 가장 구체적인 음식종류·주소(시군구)를 전파.
// 업종(주소)은 2023~24 행에만 있으므로, 그 가게의 모든 연도 행에 퍼뜨린다.
function resolveMerchantMeta(rows) {
  const cuisineCount = new Map(); // merchant -> Map<cuisine, count> (기타 제외)
  const guByMerchant = new Map(); // merchant -> 첫 non-null gu
  for (const r of rows) {
    if (r.cuisine && r.cuisine !== "기타") {
      if (!cuisineCount.has(r.merchant)) cuisineCount.set(r.merchant, new Map());
      const c = cuisineCount.get(r.merchant);
      c.set(r.cuisine, (c.get(r.cuisine) || 0) + 1);
    }
    if (r.gu && !guByMerchant.has(r.merchant)) guByMerchant.set(r.merchant, r.gu);
  }
  const bestCuisine = (merchant) => {
    const c = cuisineCount.get(merchant);
    return c ? topMapKey(c) : "기타";
  };
  const knownGu = (merchant) => guByMerchant.get(merchant) ?? null;
  return { bestCuisine, knownGu };
}

export function aggregate(rows, members, opts = {}) {
  const RTOP = opts.restaurantTop ?? 200;
  const net = netRows(rows);
  const { bestCuisine, knownGu } = resolveMerchantMeta(net);

  // 식당 랭킹 (가게단위 전파된 cuisine/gu 사용)
  const rest = new Map();
  for (const r of net) {
    if (!rest.has(r.merchant)) rest.set(r.merchant, { name: r.merchant, cuisine: bestCuisine(r.merchant), visits: 0, amount: 0, members: new Set(), gu: knownGu(r.merchant) });
    const x = rest.get(r.merchant); x.visits++; x.amount += r.amount; x.members.add(r.member);
  }
  const restaurants = topN([...rest.values()].map((x) => ({ ...x, members: x.members.size })), "visits", RTOP);

  // 의원별 (가게단위 전파된 cuisine/gu 사용)
  const byName = new Map();
  for (const r of net) {
    if (!byName.has(r.member)) byName.set(r.member, { name: r.member, party: r.party, origin: r.origin, visits: 0, amount: 0, inDist: 0, distKnown: 0, cuisine: new Map(), purpose: new Map(), rests: new Map() });
    const a = byName.get(r.member);
    const cuisine = bestCuisine(r.merchant);
    const gu = knownGu(r.merchant);
    a.visits++; a.amount += r.amount;
    a.cuisine.set(cuisine, (a.cuisine.get(cuisine) || 0) + 1);
    a.purpose.set(r.category, (a.purpose.get(r.category) || 0) + 1);
    a.rests.set(r.merchant, (a.rests.get(r.merchant) || 0) + 1);
    if (gu) { a.distKnown++; if (inOwnDistrict(gu, originGu(r.origin))) a.inDist++; }
  }

  const byMember = [...byName.values()].map((a) => {
    const dem = members.get(a.name);
    const rate = a.distKnown ? a.inDist / a.distKnown : null;
    return {
      id: dem?.id ?? "", name: a.name, party: a.party, origin: a.origin, matched: !!dem,
      visits: a.visits, amount: a.amount,
      topRestaurants: [...a.rests.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([name, visits]) => ({ name, visits })),
      cuisineMix: Object.fromEntries(a.cuisine), purposeMix: Object.fromEntries(a.purpose),
      districtRate: rate == null ? null : Math.round(rate * 100) / 100,
    };
  }).sort((x, y) => y.amount - x.amount);

  // 음식종류 전체 분포 (가게단위 전파된 cuisine 사용)
  const cui = new Map();
  for (const r of net) { const t = bestCuisine(r.merchant); if (!cui.has(t)) cui.set(t, { type: t, visits: 0, amount: 0 }); const x = cui.get(t); x.visits++; x.amount += r.amount; }
  const cuisine = topN([...cui.values()], "visits", 20);

  // breakdowns (매칭 의원 기준)
  const memberAgg = byName; // name -> agg
  const breakdowns = {
    byParty: bucketRows(memberAgg, members, "party"),
    byAge: bucketRows(memberAgg, members, "ageBucket"),
    byGender: bucketRows(memberAgg, members, "gender"),
    byZodiac: bucketRows(memberAgg, members, "zodiac"),
    byWealth: bucketRows(memberAgg, members, "wealthBucket"),
    byPyeong: bucketRows(memberAgg, members, "pyeongBucket"),
  };

  // 지역구 only/never (지역구 의원 + distKnown>0)
  const dist = byMember.filter((m) => m.districtRate != null && originGu(m.origin));
  const proportional = byMember.filter((m) => !originGu(m.origin)).map((m) => ({ id: m.id, name: m.name }));
  const addrKnown = net.filter((r) => knownGu(r.merchant)).length;
  return {
    restaurants, byMember, cuisine, breakdowns,
    district: {
      addrCoverage: net.length ? Math.round((addrKnown / net.length) * 100) / 100 : 0,
      onlyInDistrict: dist.filter((m) => m.districtRate === 1).map(pickDist),
      neverInDistrict: dist.filter((m) => m.districtRate === 0).map(pickDist),
      proportional,
    },
  };
}
const pickDist = (m) => ({ id: m.id, name: m.name, party: m.party, origin: m.origin, rate: m.districtRate });
