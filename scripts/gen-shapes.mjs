#!/usr/bin/env node
/**
 * 제22대 국회의원 선거구(254) 경계 폴리곤 베이크 → server/assets/district-shapes.json
 *   { codes: { [SGG_Code]: { name, rings: [[[lng,lat],...],...] } },
 *     members: { [MONA_CD]: [SGG_Code] } }
 * 행정동 dissolve 데이터라 분구 도시도 동 단위 정확. 선거구명(약칭) ↔ ORIG_NM 은
 * 양쪽에서 시·군·구 글자를 제거하면 동일해지는 성질로 매칭(세종은 갑/을 suffix 특수처리).
 * 추가로 각 선거구 폴리곤 중심을 districts.json 좌표로 덮어써 마커를 정확히 배치.
 * 소스: OhmyNews/2024_22_elec_map (통계청 행정동 dissolve, WGS84).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/district-shapes.json");
const DIST = join(root, "server/assets/districts.json");
const MEMBERS = "nwvrqwxyaytdsfvhu";
const GEO_URL =
  "https://raw.githubusercontent.com/OhmyNews/2024_22_elec_map/master/2024_22_Elec_simplify.json";

const SIDOS = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const s = (v) => (v == null ? "" : String(v).trim());
const norm = (x) => s(x).replace(/[시군구·\s]/g, "");

function envv(name) {
  if (process.env[name]) return process.env[name];
  try {
    return readFileSync(join(root, ".env"), "utf8").match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

function sidoKey(o) {
  for (const k of SIDOS) if (s(o).startsWith(k)) return k;
  return "";
}
function restOf(o) {
  o = s(o).replace(/\s+/g, " ");
  return o.includes(" ") ? o.split(" ").slice(1).join("") : o.replace(/^[가-힣]+?(특별자치시|특별자치도|특별시|광역시|도)/, "");
}
function suffixOf(o) {
  return (s(o).match(/[갑을병정무]$/) || [""])[0];
}

// 거리 데시메이션(닫힌 링 안전)
function simplifyRing(ring, minDist) {
  const r5 = (n) => Math.round(n * 1e5) / 1e5;
  const out = [];
  let last = null;
  for (const [x, y] of ring) {
    if (!last || Math.hypot(x - last[0], y - last[1]) >= minDist) {
      out.push([r5(x), r5(y)]);
      last = [x, y];
    }
  }
  if (out.length >= 3) {
    const f = out[0], l = out[out.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1]) out.push([f[0], f[1]]);
  }
  return out;
}
function outerRings(geom) {
  if (geom.type === "Polygon") return [geom.coordinates[0]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((p) => p[0]);
  return [];
}
// 가장 큰 링의 폴리곤 중심(shoelace) → [lat, lng]
function centroid(rings) {
  let big = rings[0];
  for (const r of rings) if (r.length > big.length) big = r;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < big.length - 1; i++) {
    const [x0, y0] = big[i];
    const [x1, y1] = big[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const m = big.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [m[1] / big.length, m[0] / big.length];
  }
  a *= 0.5;
  return [cy / (6 * a), cx / (6 * a)]; // [lat, lng]
}

async function main() {
  const apiKey = envv("API_KEY");
  if (!apiKey) {
    console.warn("[gen-shapes] API_KEY 없음 — 스킵");
    if (!existsSync(OUT)) save({ codes: {}, members: {} });
    return;
  }
  const geo = await (await fetch(GEO_URL)).json();
  const EPS = 0.0035;
  const bySido = {}; // sido → { byNorm: Map(normSGG→feat), bySuffix: Map(suffix→[feat]) }
  const feats = {};
  for (const f of geo.features) {
    const p = f.properties;
    const code = s(p.SGG_Code);
    const sgg = s(p.SGG);
    const rings = outerRings(f.geometry).map((r) => simplifyRing(r, EPS)).filter((r) => r.length >= 4);
    feats[code] = { code, sido: s(p.SIDO), name: sgg, rings, center: centroid(rings) };
    const b = (bySido[p.SIDO] = bySido[p.SIDO] || { byNorm: new Map(), bySuffix: new Map() });
    b.byNorm.set(norm(sgg), code);
    const suf = suffixOf(sgg);
    (b.bySuffix.get(suf) || b.bySuffix.set(suf, []).get(suf)).push(code);
  }

  const res = await fetch(
    `https://open.assembly.go.kr/portal/openapi/${MEMBERS}?KEY=${apiKey}&Type=json&pIndex=1&pSize=350`,
    { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
  );
  const j = JSON.parse(await res.text());
  const rows = j?.[MEMBERS]?.[1]?.row ?? [];

  const codes = {};
  const members = {};
  const centers = {}; // id → [lat,lng]
  let matched = 0;
  for (const r of rows) {
    const id = s(r.MONA_CD);
    const o = s(r.ORIG_NM);
    if (!id || !o || o.includes("비례")) continue;
    const sido = sidoKey(o);
    const b = bySido[sido];
    if (!b) continue;
    let code = b.byNorm.get(norm(restOf(o)));
    if (!code) {
      // 세종 등: suffix 유일 매칭
      const cand = b.bySuffix.get(suffixOf(o)) || [];
      if (cand.length === 1) code = cand[0];
    }
    if (!code) continue;
    matched++;
    members[id] = [code];
    centers[id] = feats[code].center;
    if (!codes[code]) codes[code] = { name: feats[code].name, rings: feats[code].rings };
  }

  save({ codes, members });

  // 마커 좌표를 선거구 중심으로 덮어쓰기(분구도 정확·분산)
  let dist = {};
  try {
    dist = JSON.parse(readFileSync(DIST, "utf8"));
  } catch {}
  for (const [id, c] of Object.entries(centers)) dist[id] = c;
  writeFileSync(DIST, JSON.stringify(dist));

  const sz = (JSON.stringify({ codes, members }).length / 1024).toFixed(0);
  console.log(`[gen-shapes] 선거구 ${Object.keys(codes).length}개, 의원 ${matched}명 매칭(${sz}KB) + districts 좌표 갱신`);
}

function save(obj) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(obj));
}

main().catch((e) => {
  console.warn("[gen-shapes] 실패:", e.message);
  if (!existsSync(OUT)) save({ codes: {}, members: {} });
});
