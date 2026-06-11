#!/usr/bin/env node
/**
 * 국회의원 재산 베이크 → server/assets/wealth.json
 * 원천: 정보공개센터(오픈와치)가 국회공보 PDF(2025 정기재산변동신고, 2024.12.31 기준)를
 *       정제해 공개한 구글시트. 출처표시 필수 — UI 에 "자료: 정보공개센터·국회공보" 노출.
 *       https://github.com/opengirok/congress_asset_disclosure
 * 탭: 총괄(성명·종전·현재·증감) / 재산구분별(토지·건물 등 소계) / 상세(소재지 명세)
 * 의원 매칭은 이름 기준(직위=국회의장·부의장·의원 행만). 동명이인은 제외(박지원 2명).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/wealth.json");
const SHEET = "182m4MFFj4Ho2cICo3PGy8RyxHZ3vwNklyo5yM4M5M4Q";
const GID = { total: "1237345243", byKind: "1348326949", detail: "1164580719" };
const BASIS = "2025년 정기재산변동신고 (2024.12.31 기준)";

// RFC4180 호환 간이 CSV 파서 (따옴표 안 콤마/줄바꿈 처리)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some((x) => x.trim())) rows.push(row); }
  return rows;
}

const num = (v) => {
  const n = parseInt(String(v ?? "").replace(/[",\s]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const isMp = (pos) => /국회(부?의장|의원)/.test(String(pos || ""));
// 천원 → 억원 (소수1)
const eok = (thousand) => Math.round(thousand / 1e4) / 10;

const SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const SIDO_ALIAS = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천",
  광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
  경기도: "경기", 강원특별자치도: "강원", 강원도: "강원", 충청북도: "충북", 충청남도: "충남",
  전북특별자치도: "전북", 전라북도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남",
  제주특별자치도: "제주",
};
function sidoOf(addr) {
  const a = String(addr || "").trim();
  for (const [full, s] of Object.entries(SIDO_ALIAS)) if (a.startsWith(full)) return s;
  for (const s of SIDO) if (a.startsWith(s)) return s;
  return null;
}
// "서울특별시 강남구 ..." → "서울 강남구"
function guOf(addr) {
  const s = sidoOf(addr);
  if (!s) return null;
  const rest = String(addr).replace(/^\S+\s*/, "");
  const m = rest.match(/^(\S+?[시군구])/);
  return m ? `${s} ${m[1]}` : s;
}
function regionOfOrigin(origin) {
  const o = String(origin || "").trim();
  if (!o || o.includes("비례")) return null;
  for (const s of SIDO) if (o.startsWith(s)) return s;
  return null;
}

async function dl(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv&gid=${gid}`;
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`sheet HTTP ${r.status}`);
  return parseCsv(await r.text());
}

async function main() {
  const membersRaw = (() => {
    const m = JSON.parse(readFileSync(join(root, "server/assets/members.json"), "utf8"));
    return Array.isArray(m) ? m : m.rows ?? Object.values(m);
  })();
  const nameCount = {};
  for (const m of membersRaw) nameCount[m.name] = (nameCount[m.name] || 0) + 1;
  const byName = new Map(membersRaw.filter((m) => nameCount[m.name] === 1).map((m) => [m.name, m]));
  const party = (p) => (p || "").split("/")[0]?.trim() || "무소속";

  let totalRows, kindRows, detailRows;
  try {
    [totalRows, kindRows, detailRows] = await Promise.all([dl(GID.total), dl(GID.byKind), dl(GID.detail)]);
  } catch (e) {
    console.warn("[gen-wealth] 시트 다운로드 실패:", e.message, existsSync(OUT) ? "— 기존 베이크 유지" : "");
    if (!existsSync(OUT)) save({ basis: BASIS, members: [], byParty: [], realEstate: [], delta: [], homesTop: [], homesMap: [], betrayal: [] });
    return;
  }

  // ── 총괄: No,구분,소속,직위,성명,종전,증가,감소,현재,증감,가액변동 ──
  const rows = [];
  for (const r of totalRows.slice(1)) {
    if (!isMp(r[3])) continue;
    const m = byName.get(String(r[4] || "").trim());
    if (!m) continue; // 동명이인·퇴직 등
    rows.push({
      id: m.id, name: m.name, party: party(m.party), origin: m.origin,
      total: eok(num(r[8])), prev: eok(num(r[5])), delta: eok(num(r[9])),
    });
  }
  rows.sort((a, b) => b.total - a.total);

  // 정당 평균/중앙값
  const pAgg = {};
  for (const r of rows) (pAgg[r.party] = pAgg[r.party] || []).push(r.total);
  const byParty = Object.entries(pAgg)
    .filter(([, v]) => v.length >= 2)
    .map(([p, v]) => {
      const sorted = [...v].sort((a, b) => a - b);
      const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      return { party: p, avg: Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10, median: Math.round(mid * 10) / 10, count: v.length };
    })
    .sort((a, b) => b.median - a.median);

  // ── 재산구분별: 토지+건물 = 부동산 ──
  const reMap = new Map(); // name -> 천원
  for (const r of kindRows.slice(1)) {
    if (!isMp(r[3])) continue;
    const kind = String(r[5] || "").trim();
    if (kind !== "토지" && kind !== "건물") continue;
    const nm = String(r[4] || "").trim();
    reMap.set(nm, (reMap.get(nm) || 0) + num(r[9]));
  }
  const realEstate = [...reMap.entries()]
    .map(([nm, v]) => {
      const m = byName.get(nm);
      return m ? { id: m.id, name: m.name, party: party(m.party), origin: m.origin, total: eok(v) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  // ── 상세: 주택(아파트 등) 소재지 → 동네 TOP + 배신왕 ──
  // 컬럼: NO,구분,소속,직위,이름,재산구분,관계,종류,명세,종전,증가,...,현재,사유
  const HOME = /아파트|주택|오피스텔|연립|다세대|빌라/;
  const homes = new Map(); // name -> [{sido, gu}]
  const guCount = {};
  const guMembers = {}; // gu -> [{id,name,party}]
  for (const r of detailRows.slice(1)) {
    if (!isMp(r[3])) continue;
    if (String(r[5] || "").trim() !== "건물") continue;
    const rel = String(r[6] || "").trim();
    if (rel !== "본인" && rel !== "배우자") continue;
    if (!HOME.test(String(r[7] || ""))) continue;
    const spec = String(r[8] || "");
    if (/전세|임차/.test(String(r[7] || ""))) continue; // 소유만 (전세권 제외)
    const sido = sidoOf(spec);
    if (!sido) continue;
    const nm = String(r[4] || "").trim();
    const gu = guOf(spec) || sido;
    if (!homes.has(nm)) homes.set(nm, []);
    homes.get(nm).push({ sido, gu });
    guCount[gu] = (guCount[gu] || 0) + 1;
    // 지도 버블 클릭용: 구별 보유 의원 명단 (중복 보유는 1회만)
    const gm = byName.get(nm);
    if (gm) {
      const arr = (guMembers[gu] = guMembers[gu] || []);
      if (!arr.some((x) => x.id === gm.id))
        arr.push({ id: gm.id, name: gm.name, party: party(gm.party) });
    }
  }
  const homesTop = Object.entries(guCount)
    .map(([gu, count]) => ({ gu, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 지도용: 시군구 전체를 카카오 REST 지오코딩(빌드 1회) → 좌표 베이크
  const restKey = (() => {
    if (process.env.KAKAO_REST_KEY) return process.env.KAKAO_REST_KEY;
    try {
      return readFileSync(join(root, ".env"), "utf8").match(/^KAKAO_REST_KEY=(.+)$/m)?.[1]?.trim() ?? "";
    } catch { return ""; }
  })();
  const homesMap = [];
  if (restKey) {
    const entries = Object.entries(guCount).sort((a, b) => b[1] - a[1]);
    for (const [gu, count] of entries) {
      try {
        const r = await fetch(
          `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(gu)}`,
          { headers: { Authorization: `KakaoAK ${restKey}` } },
        );
        const doc = (await r.json())?.documents?.[0];
        if (doc) homesMap.push({ gu, count, lat: +doc.y, lng: +doc.x, members: guMembers[gu] ?? [] });
      } catch { /* 좌표 실패 건은 지도에서 생략 */ }
      await new Promise((res) => setTimeout(res, 60)); // rate limit 여유
    }
  } else {
    console.warn("[gen-wealth] KAKAO_REST_KEY 없음 — 지도 좌표 생략");
  }

  // 배신왕: 지역구 의원인데 본인·배우자 소유 주택이 지역구 시도엔 없고 다른 시도에만 있는 경우
  const betrayal = [];
  for (const m of membersRaw) {
    if (nameCount[m.name] > 1) continue;
    const reg = regionOfOrigin(m.origin);
    if (!reg) continue; // 비례 제외
    const hs = homes.get(m.name);
    if (!hs || !hs.length) continue; // 무주택은 배신 아님
    if (hs.some((h) => h.sido === reg)) continue; // 지역구에 집 있음
    betrayal.push({
      id: m.id, name: m.name, party: party(m.party), origin: m.origin,
      homes: [...new Set(hs.map((h) => h.gu))],
    });
  }
  // 서울(특히 강남3구)에 집 있는 순으로 앞에
  const gangnam = /강남|서초|송파/;
  betrayal.sort((a, b) => {
    const ag = a.homes.some((h) => gangnam.test(h)) ? 2 : a.homes.some((h) => h.startsWith("서울")) ? 1 : 0;
    const bg = b.homes.some((h) => gangnam.test(h)) ? 2 : b.homes.some((h) => h.startsWith("서울")) ? 1 : 0;
    return bg - ag;
  });

  const delta = [...rows].sort((a, b) => b.delta - a.delta);
  save({
    basis: BASIS,
    members: rows,
    byParty,
    realEstate: realEstate.slice(0, 50),
    delta: delta.slice(0, 20),
    deltaLow: delta.slice(-10).reverse(),
    homesTop,
    homesMap,
    betrayal,
  });
  console.log(
    `[gen-wealth] 의원 ${rows.length} · 부동산 ${realEstate.length} · 주택보유 ${homes.size} · 동네TOP ${homesTop.length} · 배신왕 ${betrayal.length}`,
  );
}

function save(obj) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(obj));
}

main().catch((e) => console.warn("[gen-wealth] 실패:", e.message));
