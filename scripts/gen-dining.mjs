#!/usr/bin/env node
/**
 * 정치자금 식당 지출 베이크 → server/assets/dining.json
 * 원천: OhmyNews/KA-money (오마이뉴스·경향신문·뉴스타파, 2012~2024, 선거자금 제외). 출처표시 필수.
 * 입력: KA_MONEY_DIR(기본 ./.cache/ka-money) 의 *_KAPF*.xlsx
 * 주의: gen:data 비포함 — 수동 `pnpm gen:dining` 후 dining.json 커밋.
 */
import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const XLSX = createRequire(import.meta.url)("xlsx");
import { mapColumns, isFoodRow, parseAmount, normalizeMerchant, inferCuisine, guOf, aggregate } from "./lib/dining.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.env.KA_MONEY_DIR || join(root, ".cache/ka-money");
const OUT = join(root, "server/assets/dining.json");
const OUT_DETAILS = join(root, "server/assets/dining-details.json");
const OUT_MEMBERS = join(root, "server/assets/dining-members.json");
const SOURCE = { name: "오마이뉴스·경향신문·뉴스타파", url: "https://omn.kr/187rv" };

// gen-graph-data.mjs 와 동일 기준 유지(2020=쥐). 불일치 시 펀팩트 띠 분석이 어긋남.
const ZODIAC = ["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"];
const zodiacOf = (birth) => { const y = parseInt(String(birth).slice(0, 4), 10); return Number.isFinite(y) ? ZODIAC[(((y - 2020) % 12) + 12) % 12] : null; };
const NOW_YEAR = new Date().getFullYear();
const ageBucket = (birth) => { const y = parseInt(String(birth).slice(0, 4), 10); if (!Number.isFinite(y)) return null; const a = NOW_YEAR - y; return `${Math.floor(a / 10) * 10}대`; };
// wealth.json 전수 데이터로 버킷팅. 라벨/임계값은 펀팩트 그래프와 동일하게 유지.
// 재산(억): wealth.members[].total, 평수: wealth.apt.byMember[id].
const wealthBucket = (eok) => {
  if (eok == null) return null;
  if (eok < 10) return "10억 미만";
  if (eok < 30) return "10~30억";
  if (eok < 50) return "30~50억";
  if (eok < 100) return "50~100억";
  return "100억 이상";
};
const pyeongBucket = (p) => {
  if (p == null) return null;
  if (p < 20) return "20평 미만";
  if (p < 30) return "20평대";
  if (p < 40) return "30평대";
  if (p < 50) return "40평대";
  if (p < 60) return "50평대";
  return "60평 이상";
};

function buildMemberIndex() {
  const members = JSON.parse(readFileSync(join(root, "server/assets/members.json"), "utf8"));
  const arr = Array.isArray(members) ? members : members.rows ?? Object.values(members);
  const wealth = existsSync(join(root, "server/assets/wealth.json")) ? JSON.parse(readFileSync(join(root, "server/assets/wealth.json"), "utf8")) : { members: [], apt: { byMember: {} } };
  const totalById = new Map((wealth.members || []).map((m) => [m.id, m.total]));  // 재산 전수(279명)
  const pyeongById = new Map(Object.entries(wealth.apt?.byMember || {}));          // 평수 전수(197명)
  const nameCount = {};
  for (const m of arr) nameCount[m.name] = (nameCount[m.name] || 0) + 1;
  const idx = new Map();
  for (const m of arr) {
    if (nameCount[m.name] !== 1) continue; // 동명이인 제외
    idx.set(m.name, {
      id: m.id, name: m.name, party: (m.party || "").split("/")[0]?.trim() || "무소속", origin: m.origin,
      ageBucket: ageBucket(m.birth), gender: m.sex || null, zodiac: zodiacOf(m.birth),
      wealthBucket: wealthBucket(totalById.get(m.id)), pyeongBucket: pyeongBucket(pyeongById.get(m.id)),
    });
  }
  return idx;
}

// 셀에서 연도 추출. cellDates:true 면 Date, 아니면 'YYYY...' 문자열. 누락/비현실(<2000)이면 파일연도 fallback.
function yearOf(cell, fileYear) {
  let y = null;
  if (cell instanceof Date) y = cell.getFullYear();
  else { const n = parseInt(String(cell ?? "").slice(0, 4), 10); if (Number.isFinite(n)) y = n; }
  return (y && y >= 2000) ? y : fileYear;
}

function readRows(file, fileYear) {
  const wb = XLSX.readFile(join(DIR, file), { cellDates: true });
  const ws = wb.Sheets["Data"] || wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!grid.length) return [];
  const col = mapColumns(grid[0]);
  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const category = r[col.category];
    if (!isFoodRow(category)) continue;
    const merchant = normalizeMerchant(r[col.merchant]);
    if (!merchant) continue;
    const addr = col.address >= 0 ? r[col.address] : null;
    out.push({
      member: String(r[col.member] || "").trim(),
      party: String(r[col.party] || "").trim(),
      origin: String(r[col.region] || "").trim(),
      amount: parseAmount(r[col.amount]),
      merchant,
      cuisine: inferCuisine(merchant, col.biz >= 0 ? r[col.biz] : null),
      category: String(category).trim(),
      gu: col.address >= 0 ? guOf(addr) : null,
      addr: addr ? String(addr).trim() : null, // 지오코딩용 대표주소(주소 컬럼 없으면 null)
      year: col.date >= 0 ? yearOf(r[col.date], fileYear) : fileYear, // 연도별 추이용
    });
  }
  return out;
}

// --- 카카오 REST 지오코딩 (gen-wealth 패턴 재사용, 주소 캐시로 재호출 방지) ---
const GEO_CACHE = join(root, ".cache/geocode-dining.json");
function loadGeo() { try { return JSON.parse(readFileSync(GEO_CACHE, "utf8")); } catch { return {}; } }
function restKey() {
  if (process.env.KAKAO_REST_KEY) return process.env.KAKAO_REST_KEY;
  try { return readFileSync(join(root, ".env"), "utf8").match(/^KAKAO_REST_KEY=(.+)$/m)?.[1]?.trim() ?? ""; } catch { return ""; }
}
async function geocode(addr, key, cache) {
  if (cache[addr] !== undefined) return cache[addr];
  let v = null;
  try {
    const r = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`, { headers: { Authorization: `KakaoAK ${key}` } });
    const doc = (await r.json())?.documents?.[0];
    if (doc) v = { lat: +doc.y, lng: +doc.x };
  } catch { /* 네트워크 오류 → null 캐시 */ }
  cache[addr] = v;
  return v;
}
// MAP_TOP(기본 500) 식당(방문순, 주소 보유)을 한 번만 지오코딩해 merchant 이름→{lat,lng} 맵을 만든다.
// mapPoints 와 details 좌표가 같은 결과를 공유(주소 캐시로 재호출 방지, 결정적).
async function geocodeRestaurants(restaurants) {
  const key = restKey();
  if (!key) { console.warn("[gen-dining] KAKAO_REST_KEY 없음 — 좌표 생략"); return new Map(); }
  const cache = loadGeo();
  const cand = restaurants.filter((r) => r.addr).slice(0, +(process.env.MAP_TOP || 500));
  const geoByName = new Map();
  for (const r of cand) {
    const geo = await geocode(r.addr, key, cache);
    if (geo) geoByName.set(r.name, geo);
    await new Promise((res) => setTimeout(res, 60));
  }
  mkdirSync(dirname(GEO_CACHE), { recursive: true });
  writeFileSync(GEO_CACHE, JSON.stringify(cache));
  return geoByName;
}

async function main() {
  if (!existsSync(DIR)) { console.warn(`[gen-dining] ${DIR} 없음 — KA-money xlsx 를 받아 두세요. 기존 dining.json 유지.`); return; }
  const files = readdirSync(DIR).filter((f) => /_KAPF.*\.xlsx$/i.test(f));
  // 같은 연도에 리치(_수입지출) 파일이 있으면 그것만 사용(주소·업종 포함)
  const richBase = new Set(files.filter((f) => /_수입지출/.test(f)).map((f) => f.replace("_수입지출", "")));
  const use = files.filter((f) => /_수입지출/.test(f) || !richBase.has(f));
  const years = new Set();
  let rows = [];
  for (const f of use) { const y = +((f.match(/^(\d{4})/) || [])[1]); if (y) years.add(y); rows = rows.concat(readRows(f, Number.isFinite(y) ? y : null)); }

  const members = buildMemberIndex();
  const agg = aggregate(rows, members, { restaurantTop: 200 });

  // 주소 보유 식당을 한 번만 지오코딩(merchant→{lat,lng}), mapPoints/details 좌표 공유.
  const geoByName = await geocodeRestaurants(agg.restaurants);

  // mapPoints: 지오코딩 성공 식당만. 안정 id 부여(상세 페이지 링크용).
  const mapPoints = agg.restaurants
    .filter((r) => geoByName.has(r.name))
    .map((r) => { const g = geoByName.get(r.name); return { id: r.id, name: r.name, lat: g.lat, lng: g.lng, cuisine: r.cuisine, gu: r.gu, visits: r.visits, amount: r.amount, groups: r.groups }; });

  // details 에 좌표 부착(주소 지오코딩된 식당만 lat/lng, 아니면 null) → 별도 파일로 분리.
  const details = {};
  for (const [id, d] of Object.entries(agg.details)) {
    const g = geoByName.get(d.name);
    details[id] = { ...d, lat: g ? g.lat : null, lng: g ? g.lng : null };
  }

  // dining.json 경량화: restaurants 에서 groups/addr 제거(표시용 필드 + id 만 유지).
  const restaurants = agg.restaurants.map(({ groups, addr, ...keep }) => keep);

  // byMember → per-member 파일로 분리. id 있는 매칭 의원만 포함, 불필요 필드(name/party/origin/matched) 제거.
  const diningMemberMap = Object.fromEntries(
    agg.byMember
      .filter((m) => m.matched === true && m.id)
      .map(({ id, name, party, origin, matched, ...stats }) => [id, stats]),
  );

  // details(무거움) + byMember(per-member 파일로 분리)는 메인 dining.json 에 포함하지 않는다.
  const { details: _dropped, byMember: _byMember, ...aggLean } = agg;

  const out = {
    basis: "정치자금 지출보고서 2012~2024 (선거자금 제외)",
    source: SOURCE,
    generatedAt: new Date().toISOString().slice(0, 10),
    years: [...years].sort(),
    coverage: { rows: rows.length, matchedMembers: Object.keys(diningMemberMap).length, addrYears: [2023, 2024], mapPoints: mapPoints.length },
    ...aggLean,
    restaurants,
    mapPoints,
  };
  writeFileSync(OUT, JSON.stringify(out));
  writeFileSync(OUT_DETAILS, JSON.stringify(details));
  writeFileSync(OUT_MEMBERS, JSON.stringify(diningMemberMap));
  console.log(`[gen-dining] ${rows.length} 식당행 → ${restaurants.length} 식당, ${agg.byMember.length} 의원(매칭 ${Object.keys(diningMemberMap).length}), 지도점 ${mapPoints.length}, 상세 ${Object.keys(details).length}, per-member ${Object.keys(diningMemberMap).length}`);
}
main();
