// dining.mjs — KA-money 파싱·집계 유틸리티
// 헤더 라벨 → 표준 키. 라벨 변형을 정규식으로 흡수, 없으면 -1.
const find = (header, re) => header.findIndex((h) => re.test(String(h || "").replace(/\s/g, "")));

export function mapColumns(header) {
  return {
    member: find(header, /^의원명$/),
    party: find(header, /^당$/),
    region: find(header, /^지역명$/),
    date: find(header, /^연월일$/),
    desc: find(header, /^내역$/),
    // "지출" 계열: 리치파일엔 수입/지출 둘 다 있어 '지출'(액/금회) 을 우선 선택
    amount: find(header, /^지출(액|금회)?$/),
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

// 지점 접미사로 흔히 쓰이는 지역/랜드마크 토큰. '...<지역>점' 형태일 때만 떼어낸다.
const BRANCH_TOKENS = "서여의도|여의도|국회|서울|강남|홍대|신촌|명동|종로|광화문|마포|용산";
const BRANCH_RE = new RegExp(`(?:${BRANCH_TOKENS})점$`, "u");

// 가게명 정규화. 괄호 보조설명을 제거하고, '<지역>점'(예: 서여의도점) 지점 태그만 떼어낸다.
// 주의(C1): '돈까스전문점'·'직영점'·'본점' 처럼 지역 토큰이 아닌 '...점'은 정상 상호이므로 보존
// (이전 그리디 정규식은 이름 전체를 삼켜 readRows 의 `if (!merchant) continue` 에서 행을 통째로 잃었음).
// 어떤 경우에도 빈 문자열을 반환하지 않는다(빈 결과 시 원본 유지).
export function normalizeMerchant(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  let s = raw.replace(/\([^)]*\)/g, "").trim();          // (국회의사당) 등 괄호 제거
  const stripped = s.replace(BRANCH_RE, "");             // '<지역>점' 태그만 제거(이름 자체는 절대 삼키지 않음)
  if (stripped && stripped !== s) s = stripped;
  s = s.replace(/\s+/g, "").trim();
  return s || raw.replace(/\s+/g, "").trim();            // 절대 빈 문자열 반환 금지
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

// EXACT-KEY 상쇄(I1): 정정·반환으로 생긴 음수 행을 (member|merchant|금액) 가 정확히 일치하는
// 양수 행 1건과만 1:1로 상쇄한다.
//  - 음수 행 자체는 절대 집계에 포함하지 않는다(`amount <= 0` 스킵).
//  - 고아 음수(매칭되는 양수가 없음) → 그냥 폐기(양수 집계에 영향 없음).
//  - 부분 환불(금액이 양수와 다름) → EXACT-KEY 가 안 맞으므로 상쇄되지 않고, 원 양수 행은 그대로 남는다.
//  - 서로 다른 양수 행의 방문 수(visits)는 그대로 보존된다.
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
    if (neg.get(k) > 0) { neg.set(k, neg.get(k) - 1); continue; } // 동일 금액 양수 1건과 상쇄
    out.push(r);
  }
  return out;
}

// 커밋되는 산출물의 안정성을 위해 동점 시 name/key/type 기준 결정적 2차 정렬(M2).
const labelOf = (x) => String(x.name ?? x.key ?? x.type ?? "");
const topN = (arr, key, n) =>
  [...arr]
    .sort((a, b) => (b[key] - a[key]) || labelOf(a).localeCompare(labelOf(b)))
    .slice(0, n);

function bucketRows(rowsByMember, members, field) {
  const acc = new Map(); // key -> {members:Set, amount, visits, cuisine:Map, rests:Map}
  for (const [name, agg] of rowsByMember) {
    const dem = members.get(name);
    if (!dem || dem[field] == null) continue;
    const key = dem[field];
    if (!acc.has(key)) acc.set(key, { members: new Set(), amount: 0, visits: 0, cuisine: new Map(), rests: new Map() });
    const a = acc.get(key);
    a.members.add(name); a.amount += agg.amount; a.visits += agg.visits;
    for (const [c, v] of agg.cuisine) a.cuisine.set(c, (a.cuisine.get(c) || 0) + v);
    for (const [m, v] of agg.rests) a.rests.set(m, (a.rests.get(m) || 0) + v); // 그룹 단골식당(I2)
  }
  return [...acc.entries()].map(([key, a]) => ({
    key, n: a.members.size,
    avgMeal: a.visits ? Math.round(a.amount / a.visits) : 0,
    topCuisine: topMapKey(a.cuisine),
    topRestaurant: topMapKey(a.rests, ""),
  })).sort((x, y) => (y.n - x.n) || String(x.key).localeCompare(String(y.key)));
}
// 빈도 최다 키. 동점 시 키 사전순으로 결정적 선택(M2). map 비면 fallback 반환.
const topMapKey = (map, fallback = "기타") =>
  [...map.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? fallback;

// 가게단위로 가장 구체적인 음식종류·주소(시군구)를 전파.
// 업종(주소)은 2023~24 행에만 있으므로, 그 가게의 모든 연도 행에 퍼뜨린다.
function resolveMerchantMeta(rows) {
  const cuisineCount = new Map(); // merchant -> Map<cuisine, count> (기타 제외)
  const guByMerchant = new Map(); // merchant -> 첫 non-null gu
  const addrByMerchant = new Map(); // merchant -> 첫 비어있지 않은 주소(지오코딩용)
  for (const r of rows) {
    if (r.cuisine && r.cuisine !== "기타") {
      if (!cuisineCount.has(r.merchant)) cuisineCount.set(r.merchant, new Map());
      const c = cuisineCount.get(r.merchant);
      c.set(r.cuisine, (c.get(r.cuisine) || 0) + 1);
    }
    if (r.gu && !guByMerchant.has(r.merchant)) guByMerchant.set(r.merchant, r.gu);
    if (r.addr && !addrByMerchant.has(r.merchant)) addrByMerchant.set(r.merchant, String(r.addr).trim());
  }
  const bestCuisine = (merchant) => {
    const c = cuisineCount.get(merchant);
    return c ? topMapKey(c) : "기타";
  };
  const knownGu = (merchant) => guByMerchant.get(merchant) ?? null;
  const knownAddr = (merchant) => addrByMerchant.get(merchant) ?? null;
  return { bestCuisine, knownGu, knownAddr };
}

// 식당별 그룹 분해: 매칭 의원의 party/age/gender/zodiac/wealth/pyeong 버킷별 방문수
function emptyGroups() { return { party: {}, age: {}, gender: {}, zodiac: {}, wealth: {}, pyeong: {} }; }
function addGroup(g, dem) {
  if (!dem) return;
  const map = { party: dem.party, age: dem.ageBucket, gender: dem.gender, zodiac: dem.zodiac, wealth: dem.wealthBucket, pyeong: dem.pyeongBucket };
  for (const [k, v] of Object.entries(map)) if (v != null) g[k][v] = (g[k][v] || 0) + 1;
}

export function aggregate(rows, members, opts = {}) {
  const RTOP = opts.restaurantTop ?? 200;
  const net = netRows(rows);
  const { bestCuisine, knownGu, knownAddr } = resolveMerchantMeta(net);

  // 식당 랭킹 (가게단위 전파된 cuisine/gu/addr 사용) + 그룹별 방문 분해(지도 필터용)
  const rest = new Map();
  for (const r of net) {
    if (!rest.has(r.merchant)) rest.set(r.merchant, { name: r.merchant, cuisine: bestCuisine(r.merchant), visits: 0, amount: 0, members: new Set(), gu: knownGu(r.merchant), addr: knownAddr(r.merchant), groups: emptyGroups() });
    const x = rest.get(r.merchant); x.visits++; x.amount += r.amount; x.members.add(r.member);
    addGroup(x.groups, members.get(r.member)); // 매칭 의원만 그룹에 반영(미매칭은 visits 만 증가)
  }
  // 방문순 정렬 후 안정 id(r0,r1,...) 부여 — topN 의 결정적 정렬(visits desc, name asc) 기준.
  const restaurants = topN([...rest.values()].map((x) => ({ ...x, members: x.members.size })), "visits", RTOP)
    .map((x, i) => ({ id: `r${i}`, ...x }));
  const idByMerchant = new Map(restaurants.map((x) => [x.name, x.id]));

  // details: 상위 restaurantTop 식당의 방문 의원 명단 + 연도별 추이(netted 행 기준).
  const detailAcc = new Map(); // merchant -> { members: Map<name,{id,name,party,visits,amount}>, byYear: Map<year,{visits,amount}> }
  for (const r of net) {
    const id = idByMerchant.get(r.merchant);
    if (!id) continue; // 상위 N 밖 식당은 detail 생략
    if (!detailAcc.has(r.merchant)) detailAcc.set(r.merchant, { members: new Map(), byYear: new Map() });
    const acc = detailAcc.get(r.merchant);
    const dem = members.get(r.member);
    if (!acc.members.has(r.member)) acc.members.set(r.member, { id: dem?.id ?? "", name: r.member, party: dem?.party ?? r.party, visits: 0, amount: 0 });
    const mm = acc.members.get(r.member); mm.visits++; mm.amount += r.amount;
    const y = Number.isFinite(r.year) ? r.year : null;
    if (y != null) {
      if (!acc.byYear.has(y)) acc.byYear.set(y, { visits: 0, amount: 0 });
      const yy = acc.byYear.get(y); yy.visits++; yy.amount += r.amount;
    }
  }
  const details = {};
  for (const x of restaurants) {
    const acc = detailAcc.get(x.name) ?? { members: new Map(), byYear: new Map() };
    details[x.id] = {
      id: x.id, name: x.name, cuisine: x.cuisine, gu: x.gu, rank: Number(x.id.slice(1)) + 1,
      visits: x.visits, amount: x.amount,
      members: [...acc.members.values()].sort((a, b) => (b.visits - a.visits) || a.name.localeCompare(b.name)),
      byYear: [...acc.byYear.entries()].map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year),
    };
  }

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
      topRestaurants: [...a.rests.entries()].sort((x, y) => (y[1] - x[1]) || String(x[0]).localeCompare(String(y[0]))).slice(0, 5).map(([name, visits]) => ({ name, visits })),
      cuisineMix: Object.fromEntries(a.cuisine), purposeMix: Object.fromEntries(a.purpose),
      districtRate: rate == null ? null : Math.round(rate * 100) / 100,
    };
  }).sort((x, y) => (y.amount - x.amount) || x.name.localeCompare(y.name));

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
    restaurants, byMember, cuisine, breakdowns, details,
    district: {
      addrCoverage: net.length ? Math.round((addrKnown / net.length) * 100) / 100 : 0,
      onlyInDistrict: dist.filter((m) => m.districtRate === 1).map(pickDist),
      neverInDistrict: dist.filter((m) => m.districtRate === 0).map(pickDist),
      proportional,
    },
  };
}
const pickDist = (m) => ({ id: m.id, name: m.name, party: m.party, origin: m.origin, rate: m.districtRate });
