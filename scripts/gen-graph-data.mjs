#!/usr/bin/env node
/**
 * 펀팩트 "데이터 그래프"용 베이크.
 *  입력: server/assets/votedata.json (표결 매트릭스) + members.json (birth/sex/선수 등)
 *  출력: server/assets/graph-data.json
 *
 * 외부 API 를 치지 않고 이미 베이크된 JSON 만 가공한다(빌드 의존성 없음).
 * 좌표(정치 지형도)는 표결 유사도 기반 force-directed 레이아웃을 빌드타임에 1회 계산해
 * 런타임은 정적 SVG 만 그린다.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = (p) => join(root, "server/assets", p);
const read = (p) => JSON.parse(readFileSync(A(p), "utf8"));

const vd = read("votedata.json"); // { bills, members, matrix }
const membersRaw = (() => {
  const m = read("members.json");
  return Array.isArray(m) ? m : m.rows ?? Object.values(m);
})();

const NOW_YEAR = 2026;
const meta = new Map(); // id -> { birth, sex, reelection, electType, committee, units, origin }
for (const m of membersRaw) {
  meta.set(m.id, m);
}

// 시도 추출 ("경기 용인시정" → "경기", "비례대표" → "비례대표")
const SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
function regionOf(origin) {
  const o = String(origin || "").trim();
  if (!o || o.includes("비례")) return "비례대표";
  for (const s of SIDO) if (o.startsWith(s)) return s;
  // "강원특별자치도" 등 변형
  const head = o.split(/\s+/)[0] || "";
  for (const s of SIDO) if (head.startsWith(s)) return s;
  return "기타";
}

const ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
function zodiacOf(year) {
  // 2020=쥐 기준: (year-2020) mod 12 → 0=쥐
  return ZODIAC[((((year - 2020) % 12) + 12) % 12)];
}

// 복성(두 글자 성씨) — 한국 흔한 것만
const DOUBLE_SURNAMES = ["남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방"];
function surnameOf(name) {
  const n = String(name || "").trim();
  for (const d of DOUBLE_SURNAMES) if (n.startsWith(d)) return d;
  return n.slice(0, 1);
}

const members = vd.members; // {id,name,party,origin,photo}
const matrix = vd.matrix;
const byId = new Map(members.map((m) => [m.id, m]));

// ── 표결 유사도 ──────────────────────────────
const VOTE = new Set(["Y", "N", "B"]);
function sim(a, b) {
  let agree = 0, common = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) {
    const x = a[i], y = b[i];
    if (VOTE.has(x) && VOTE.has(y)) {
      common++;
      if (x === y) agree++;
    }
  }
  return common >= 15 ? { rate: agree / common, common } : null;
}

const ids = members.filter((m) => matrix[m.id]).map((m) => m.id);
const N = ids.length;
const idx = new Map(ids.map((id, i) => [id, i]));

// 쌍별 유사도 (상삼각). 단짝/앙숙 + 이웃 추출에 사용.
const neighbors = Array.from({ length: N }, () => []); // [{j, rate}]
const allPairs = []; // {i,j,rate,common} common>=30 (단짝/앙숙 후보)
for (let i = 0; i < N; i++) {
  const a = matrix[ids[i]];
  for (let j = i + 1; j < N; j++) {
    const r = sim(a, matrix[ids[j]]);
    if (!r) continue;
    neighbors[i].push({ j, rate: r.rate });
    neighbors[j].push({ i: i, j: i, rate: r.rate });
    if (r.common >= 30) allPairs.push({ i, j, rate: r.rate, common: r.common });
  }
}
// 각 노드 top-8 이웃만 스프링으로
const K = 8;
const springs = []; // {i,j,w}
for (let i = 0; i < N; i++) {
  const ns = neighbors[i].map((e) => ({ j: e.j === i ? e.i ?? e.j : e.j, rate: e.rate }));
  // neighbors 저장이 비대칭이라 재구성: 위에서 j>i 만 정상. 간단히 재계산.
}

// neighbors 재구성 (대칭, 정확)
const nb = Array.from({ length: N }, () => []);
for (let i = 0; i < N; i++) {
  const a = matrix[ids[i]];
  for (let j = i + 1; j < N; j++) {
    const r = sim(a, matrix[ids[j]]);
    if (!r) continue;
    nb[i].push({ j, rate: r.rate });
    nb[j].push({ j: i, rate: r.rate });
  }
}
const springSet = new Set();
for (let i = 0; i < N; i++) {
  nb[i].sort((x, y) => y.rate - x.rate);
  for (const e of nb[i].slice(0, K)) {
    const a = Math.min(i, e.j), b = Math.max(i, e.j);
    const key = a * 100000 + b;
    if (springSet.has(key)) continue;
    springSet.add(key);
    springs.push({ i: a, j: b, w: e.rate });
  }
}

// ── force-directed 레이아웃 ─────────────────────
// 결정론적 의사난수 (재현성)
let seed = 1337;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

// 정당별 초기 각도 시드 (수렴 가속 + 정당 군집 강화)
const parties = [...new Set(ids.map((id) => byId.get(id).party))];
const partyAngle = new Map(parties.map((p, k) => [p, (k / parties.length) * Math.PI * 2]));
const px = new Float64Array(N);
const py = new Float64Array(N);
for (let i = 0; i < N; i++) {
  const ang = partyAngle.get(byId.get(ids[i]).party) + (rnd() - 0.5) * 0.8;
  const rad = 200 + rnd() * 120;
  px[i] = Math.cos(ang) * rad;
  py[i] = Math.sin(ang) * rad;
}

const ITER = 400;
const REP = 9000; // 척력 계수
const SPRING_LEN = 30; // 스프링 이상 길이
const SPRING_K = 0.04; // 스프링 강성 (유사도로 가중)
const GRAVITY = 0.012; // 중심 인력
for (let it = 0; it < ITER; it++) {
  const cool = 1 - it / ITER; // 점점 작게
  const step = 0.85 * cool + 0.05;
  const fx = new Float64Array(N);
  const fy = new Float64Array(N);
  // 척력 (모든 쌍)
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let dx = px[i] - px[j];
      let dy = py[i] - py[j];
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 0.25; }
      const f = REP / d2;
      const d = Math.sqrt(d2);
      fx[i] += (dx / d) * f; fy[i] += (dy / d) * f;
      fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f;
    }
  }
  // 스프링 인력 (이웃, 유사도 가중)
  for (const s of springs) {
    const i = s.i, j = s.j;
    const dx = px[j] - px[i];
    const dy = py[j] - py[i];
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const f = SPRING_K * s.w * (d - SPRING_LEN);
    fx[i] += (dx / d) * f; fy[i] += (dy / d) * f;
    fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f;
  }
  // 중심 인력
  for (let i = 0; i < N; i++) {
    fx[i] -= px[i] * GRAVITY;
    fy[i] -= py[i] * GRAVITY;
  }
  // 적용 (속도 클램프)
  for (let i = 0; i < N; i++) {
    let vx = fx[i] * step, vy = fy[i] * step;
    const v = Math.hypot(vx, vy);
    const cap = 30;
    if (v > cap) { vx = (vx / v) * cap; vy = (vy / v) * cap; }
    px[i] += vx; py[i] += vy;
  }
}
// 0..1000 정규화
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (let i = 0; i < N; i++) {
  minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]);
  minY = Math.min(minY, py[i]); maxY = Math.max(maxY, py[i]);
}
const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
const PAD = 40;
const nodes = ids.map((id, i) => {
  const m = byId.get(id);
  const mt = meta.get(id) || {};
  const byr = mt.birth ? parseInt(String(mt.birth).slice(0, 4), 10) : null;
  return {
    id,
    name: m.name,
    party: m.party,
    region: regionOf(m.origin),
    x: Math.round((PAD + ((px[i] - minX) / spanX) * (1000 - 2 * PAD)) * 10) / 10,
    y: Math.round((PAD + ((py[i] - minY) / spanY) * (1000 - 2 * PAD)) * 10) / 10,
    age: byr ? NOW_YEAR - byr : null,
  };
});

// ── 단짝 / 앙숙 ──────────────────────────────
const labeledPairs = allPairs.map((p) => ({
  a: byId.get(ids[p.i]),
  b: byId.get(ids[p.j]),
  rate: Math.round(p.rate * 1000) / 10,
  common: p.common,
}));
const bestSorted = [...labeledPairs].sort((x, y) => y.rate - x.rate);
const worstSorted = [...labeledPairs].sort((x, y) => x.rate - y.rate);
const slim = (p) => ({
  a: { id: p.a.id, name: p.a.name, party: p.a.party },
  b: { id: p.b.id, name: p.b.name, party: p.b.party },
  rate: p.rate,
  common: p.common,
});
const bestPairs = bestSorted.slice(0, 10).map(slim);
const worstPairs = worstSorted.slice(0, 10).map(slim);
// 교차당 단짝(다른 정당인데 가장 비슷) — 재미 요소
const crossBest = bestSorted.filter((p) => p.a.party !== p.b.party).slice(0, 8).map(slim);

// ── 프로필 집계 (전체 300명: members.json 기준) ──
// 표결 매트릭스에 없는 의원도 프로필 통계엔 포함되도록 members.json 사용.
const allProfiles = membersRaw.map((m) => {
  const byr = m.birth ? parseInt(String(m.birth).slice(0, 4), 10) : null;
  return {
    id: m.id,
    name: m.name,
    party: (m.party || "").split("/")[0]?.trim() || "무소속",
    sex: m.sex || "",
    region: regionOf(m.origin),
    electType: m.electType || "",
    reelection: m.reelection || "",
    age: byr ? NOW_YEAR - byr : null,
    birthYear: byr,
  };
});

// ── 그룹 통계 enrichment (띠·별자리·성씨·평수 그룹별 집단 특성) ──
// 의원별 재산·아파트 평수·대표발의·표결 집계를 id 로 묶어 그룹 평균을 낸다.
const profileById = new Map(allProfiles.map((p) => [p.id, p]));
const wealthData = (() => {
  try { return read("wealth.json"); } catch { return {}; }
})();
const wealthById = new Map((wealthData.members || []).map((m) => [m.id, m.total]));
const pyeongById = new Map(Object.entries(wealthData.apt?.byMember || {}));
const detailsData = (() => {
  try { return read("member-details.json"); } catch { return {}; }
})();
const tallyData = (() => {
  try { return read("member-tally.json"); } catch { return {}; }
})();
const round1 = (x) => Math.round(x * 10) / 10;
const avgOf = (ids, fn) => {
  const xs = ids.map(fn).filter((v) => v != null && Number.isFinite(v));
  return xs.length ? round1(xs.reduce((s, v) => s + v, 0) / xs.length) : null;
};
// 그룹(의원 id 배열) → 집단 특성 9종
function statOf(ids) {
  if (!ids.length) return null;
  // 정당 분포 (내림차순, 약칭은 클라에서 처리)
  const pc = {};
  for (const id of ids) {
    const p = profileById.get(id);
    if (p) pc[p.party] = (pc[p.party] || 0) + 1;
  }
  const parties = Object.entries(pc).map(([party, count]) => ({ party, count })).sort((a, b) => b.count - a.count);
  const women = ids.filter((id) => profileById.get(id)?.sex === "여").length;
  const known = ids.filter((id) => { const s = profileById.get(id)?.sex; return s === "남" || s === "여"; }).length;
  return {
    n: ids.length,
    parties,
    avgWealth: avgOf(ids, (id) => wealthById.get(id)),
    avgAge: avgOf(ids, (id) => profileById.get(id)?.age),
    womenPct: known ? Math.round((women / known) * 100) : null,
    avgPyeong: avgOf(ids, (id) => pyeongById.get(id)),
    avgPropose: avgOf(ids, (id) => detailsData[id]?.proposeCount),
    avgAttend: avgOf(ids, (id) => { const t = tallyData[id]; return t ? t.total - t.a : null; }),
    avgYes: avgOf(ids, (id) => tallyData[id]?.y),
    avgAbsent: avgOf(ids, (id) => tallyData[id]?.a),
  };
}

// 세대(나이) — 스웜용 전체 + 통계
const ageList = allProfiles
  .filter((p) => p.age != null)
  .map((p) => ({ id: p.id, name: p.name, party: p.party, age: p.age }))
  .sort((a, b) => a.age - b.age);
const ageBuckets = {};
for (const p of ageList) {
  const d = Math.floor(p.age / 10) * 10;
  ageBuckets[d] = (ageBuckets[d] || 0) + 1;
}
const ageStats = {
  list: ageList,
  buckets: Object.entries(ageBuckets).map(([d, c]) => ({ decade: +d, count: c })).sort((a, b) => a.decade - b.decade),
  avg: Math.round((ageList.reduce((s, p) => s + p.age, 0) / ageList.length) * 10) / 10,
  youngest: ageList.slice(0, 5),
  oldest: ageList.slice(-5).reverse(),
};

// 정당별 평균 연령 (젊은 당 vs 노장 당)
const partyAgeAgg = {};
for (const p of allProfiles) {
  if (p.age == null) continue;
  const a = (partyAgeAgg[p.party] = partyAgeAgg[p.party] || { sum: 0, cnt: 0 });
  a.sum += p.age; a.cnt++;
}
const partyAge = Object.entries(partyAgeAgg)
  .map(([party, a]) => ({ party, avg: Math.round((a.sum / a.cnt) * 10) / 10, count: a.cnt }))
  .filter((x) => x.count >= 2)
  .sort((a, b) => a.avg - b.avg);

// 세대별(연령대) 정당 구성 — "2030은 어느 당? 6070은?"
const decadeAgg = {};
for (const p of allProfiles) {
  if (p.age == null) continue;
  const d = Math.floor(p.age / 10) * 10;
  const g = (decadeAgg[d] = decadeAgg[d] || { total: 0, parties: {} });
  g.total++;
  g.parties[p.party] = (g.parties[p.party] || 0) + 1;
}
const generations = Object.entries(decadeAgg)
  .map(([decade, g]) => ({
    decade: +decade,
    total: g.total,
    parties: Object.entries(g.parties).map(([party, count]) => ({ party, count })).sort((a, b) => b.count - a.count),
  }))
  .sort((a, b) => a.decade - b.decade);

// 성별 — 전체 + 정당별
const genderTotal = { 남: 0, 여: 0 };
const genderByParty = {};
for (const p of allProfiles) {
  if (p.sex === "남") genderTotal.남++;
  else if (p.sex === "여") genderTotal.여++;
  const g = (genderByParty[p.party] = genderByParty[p.party] || { 남: 0, 여: 0, total: 0 });
  if (p.sex === "남") g.남++; else if (p.sex === "여") g.여++;
  g.total++;
}
const women = allProfiles.filter((p) => p.sex === "여").map((p) => ({ id: p.id, name: p.name, party: p.party }));
const avgAgeOf = (sex) => {
  const xs = allProfiles.filter((p) => p.sex === sex && p.age != null).map((p) => p.age);
  return xs.length ? Math.round((xs.reduce((s, a) => s + a, 0) / xs.length) * 10) / 10 : null;
};
const genderStats = {
  total: genderTotal,
  ageAvg: { 남: avgAgeOf("남"), 여: avgAgeOf("여") },
  byParty: Object.entries(genderByParty)
    .map(([party, g]) => ({ party, ...g, womenRate: Math.round((g.여 / g.total) * 1000) / 10 }))
    .filter((x) => x.total >= 2)
    .sort((a, b) => b.total - a.total),
  women,
};

// 선수(초선/재선...) 분포
const TERM_ORDER = ["초선", "재선", "3선", "4선", "5선", "6선", "7선", "8선", "9선"];
const termCount = {};
for (const p of allProfiles) {
  const t = p.reelection || "기타";
  termCount[t] = (termCount[t] || 0) + 1;
}
const termStats = {
  buckets: TERM_ORDER.filter((t) => termCount[t]).map((t) => ({ term: t, count: termCount[t] })),
  // 최다선(선수 가장 높은) 의원들
  veterans: allProfiles
    .map((p) => ({ ...p, lvl: TERM_ORDER.indexOf(p.reelection) }))
    .filter((p) => p.lvl >= 0)
    .sort((a, b) => b.lvl - a.lvl)
    .slice(0, 8)
    .map((p) => ({ id: p.id, name: p.name, party: p.party, reelection: p.reelection })),
};

// 띠(12지)
const zodiacCount = {};
const zodiacMembers = {};
for (const p of allProfiles) {
  if (!p.birthYear) continue;
  const z = zodiacOf(p.birthYear);
  zodiacCount[z] = (zodiacCount[z] || 0) + 1;
  (zodiacMembers[z] = zodiacMembers[z] || []).push({ id: p.id, name: p.name, party: p.party });
}
const zodiacStats = ZODIAC.map((z) => ({
  zodiac: z,
  count: zodiacCount[z] || 0,
  members: (zodiacMembers[z] || []).slice(0, 12),
  stats: statOf((zodiacMembers[z] || []).map((m) => m.id)),
}));

// 성씨 톱
const surnameCount = {};
const surnameMembers = {};
for (const p of allProfiles) {
  const s = surnameOf(p.name);
  surnameCount[s] = (surnameCount[s] || 0) + 1;
  (surnameMembers[s] = surnameMembers[s] || []).push({ id: p.id, name: p.name, party: p.party });
}
const surnameStats = Object.entries(surnameCount)
  .map(([surname, count]) => ({ surname, count, members: surnameMembers[surname].slice(0, 12), stats: statOf(surnameMembers[surname].map((m) => m.id)) }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 12);

// 지역 세력도 (시도별 의원 수 + 정당 구성)
const regionAgg = {};
for (const p of allProfiles) {
  if (p.region === "비례대표") continue;
  const r = (regionAgg[p.region] = regionAgg[p.region] || { total: 0, parties: {} });
  r.total++;
  r.parties[p.party] = (r.parties[p.party] || 0) + 1;
}
const regionStats = Object.entries(regionAgg)
  .map(([region, r]) => ({
    region,
    total: r.total,
    parties: Object.entries(r.parties).map(([party, c]) => ({ party, count: c })).sort((a, b) => b.count - a.count),
    top: Object.entries(r.parties).sort((a, b) => b[1] - a[1])[0][0],
  }))
  .sort((a, b) => b.total - a.total);

// ── 별자리 분포 ──
const SIGNS = [
  { sign: "물병자리", emoji: "♒", from: [1, 20], to: [2, 18] },
  { sign: "물고기자리", emoji: "♓", from: [2, 19], to: [3, 20] },
  { sign: "양자리", emoji: "♈", from: [3, 21], to: [4, 19] },
  { sign: "황소자리", emoji: "♉", from: [4, 20], to: [5, 20] },
  { sign: "쌍둥이자리", emoji: "♊", from: [5, 21], to: [6, 21] },
  { sign: "게자리", emoji: "♋", from: [6, 22], to: [7, 22] },
  { sign: "사자자리", emoji: "♌", from: [7, 23], to: [8, 22] },
  { sign: "처녀자리", emoji: "♍", from: [8, 23], to: [9, 23] },
  { sign: "천칭자리", emoji: "♎", from: [9, 24], to: [10, 22] },
  { sign: "전갈자리", emoji: "♏", from: [10, 23], to: [11, 22] },
  { sign: "사수자리", emoji: "♐", from: [11, 23], to: [12, 24] },
  { sign: "염소자리", emoji: "♑", from: [12, 25], to: [1, 19] },
];
function signOf(mo, d) {
  for (const s of SIGNS) {
    const [fm, fd] = s.from, [tm, td] = s.to;
    if (fm <= tm ? ((mo === fm && d >= fd) || (mo === tm && d <= td) || (mo > fm && mo < tm)) : (mo === fm && d >= fd) || (mo === tm && d <= td) || mo > fm || mo < tm)
      return s.sign;
  }
  return null;
}
const signAgg = {};
const signMembers = {};
for (const m of membersRaw) {
  const md = String(m.birth || "").match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!md) continue;
  const sg = signOf(+md[1], +md[2]);
  if (!sg) continue;
  signAgg[sg] = (signAgg[sg] || 0) + 1;
  (signMembers[sg] = signMembers[sg] || []).push({ id: m.id, name: m.name, party: (m.party || "").split("/")[0]?.trim() || "무소속" });
}
const starsigns = SIGNS.map((s) => ({
  sign: s.sign, emoji: s.emoji, count: signAgg[s.sign] || 0, members: (signMembers[s.sign] || []).slice(0, 10),
  stats: statOf((signMembers[s.sign] || []).map((m) => m.id)),
}));

// ── 생일 (월-일만 베이크 → 클라가 오늘과 매칭) ──
const birthdays = membersRaw
  .map((m) => {
    const md = String(m.birth || "").match(/^\d{4}-(\d{2}-\d{2})/);
    return md ? { id: m.id, name: m.name, party: (m.party || "").split("/")[0]?.trim() || "무소속", md: md[1] } : null;
  })
  .filter(Boolean);

// ── 가결률 (실속왕/공갈왕) — member-details 의 대표발의(최근 최대 30건) 처리결과 기준 ──
const details = read("member-details.json");
const PASS = /원안가결|수정가결/;
const REFLECT = /원안가결|수정가결|대안반영폐기|수정안반영폐기/;
const passList = [];
for (const m of membersRaw) {
  const bills = details[m.id]?.bills ?? [];
  if (bills.length < 10) continue; // 표본 최소 10건
  const reflected = bills.filter((b) => REFLECT.test(b.procResult || "")).length;
  const passed = bills.filter((b) => PASS.test(b.procResult || "")).length;
  passList.push({
    id: m.id, name: m.name, party: (m.party || "").split("/")[0]?.trim() || "무소속", origin: m.origin, photo: "",
    rate: Math.round((reflected / bills.length) * 1000) / 1000,
    count: bills.length, passed, reflected,
  });
}
const passRate = {
  best: [...passList].sort((a, b) => b.rate - a.rate || b.reflected - a.reflected).slice(0, 50),
  worst: [...passList].sort((a, b) => a.rate - b.rate || b.count - a.count).slice(0, 50),
  sample: "최근 대표발의 최대 30건 기준 · 반영=가결+대안반영",
};

// ── 박빙의 순간 (가장 표가 갈린 안건의 의원별 찬/반) ──
// votedata.bills 순서 = matrix 컬럼 순서. 찬-반 격차가 가장 작은(둘 다 충분한) 안건 선택.
const billsArr = vd.bills;
let closeIdx = -1, closeScore = Infinity;
for (let i = 0; i < billsArr.length; i++) {
  const b = billsArr[i];
  if (b.y + b.n < 50) continue; // 표가 충분히 갈린 안건만
  const margin = Math.abs(b.y - b.n);
  if (margin < closeScore) { closeScore = margin; closeIdx = i; }
}
let closeBill = null;
if (closeIdx >= 0) {
  const b = billsArr[closeIdx];
  const yes = [], no = [], blank = [];
  for (const m of members) {
    const c = matrix[m.id]?.[closeIdx];
    const mini = { id: m.id, name: m.name, party: m.party };
    if (c === "Y") yes.push(mini);
    else if (c === "N") no.push(mini);
    else if (c === "B") blank.push(mini);
  }
  closeBill = {
    name: b.name, no: b.no, date: b.date, committee: b.committee, procResult: b.procResult,
    y: b.y, n: b.n, b: b.b, yes, no, blank,
  };
}

// 정당별 의석 (지형도 범례용)
const partySeats = {};
for (const p of allProfiles) partySeats[p.party] = (partySeats[p.party] || 0) + 1;
const partyList = Object.entries(partySeats).map(([party, seats]) => ({ party, seats })).sort((a, b) => b.seats - a.seats);

const out = {
  generatedAt: null,
  nodeCount: N,
  voteBills: vd.bills.length,
  parties: partyList,
  map: { nodes },
  bestPairs,
  worstPairs,
  crossBest,
  age: ageStats,
  gender: genderStats,
  terms: termStats,
  zodiac: zodiacStats,
  surnames: surnameStats,
  regions: regionStats,
  closeBill,
  partyAge,
  generations,
  starsigns,
  birthdays,
  passRate,
};

writeFileSync(A("graph-data.json"), JSON.stringify(out));
console.log(
  `[gen-graph-data] 지형도 ${N}노드/${springs.length}엣지 · 단짝 ${bestPairs.length} · 나이 ${ageList.length}(평균 ${ageStats.avg}) · 여성 ${women.length} · 띠 ${ZODIAC.length} · 성씨 ${surnameStats.length} · 지역 ${regionStats.length}`,
);
