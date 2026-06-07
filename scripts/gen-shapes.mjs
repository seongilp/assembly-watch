#!/usr/bin/env node
/**
 * 선거구 → 시군구 행정경계 폴리곤 베이크: server/assets/district-shapes.json
 *   { codes: { [sggCode]: { name, rings: [[[lng,lat],...],...] } },
 *     members: { [MONA_CD]: [sggCode, ...] } }
 * 의원 클릭 시 해당 지역구(시군구) 경계를 카카오 Polygon 으로 오버레이하기 위함.
 * 소스: southkorea-maps 시군구 GeoJSON(2018). RDP 단순화로 용량 절감.
 * 분구 선거구(고양시갑 등)는 정밀 경계가 없어 시 전체로 근사(베스트에포트).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/district-shapes.json");
const MEMBERS = "nwvrqwxyaytdsfvhu";
const GEO_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json";

const PREFIX = {
  서울: "11", 부산: "21", 대구: "22", 인천: "23", 광주: "24", 대전: "25",
  울산: "26", 세종: "29", 경기: "31", 강원: "32", 충북: "33", 충남: "34",
  전북: "35", 전남: "36", 경북: "37", 경남: "38", 제주: "39",
};

const s = (v) => (v == null ? "" : String(v).trim());

function envv(name) {
  if (process.env[name]) return process.env[name];
  try {
    return readFileSync(join(root, ".env"), "utf8").match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

function sidoKey(origin) {
  const o = s(origin);
  for (const k of Object.keys(PREFIX)) if (o.startsWith(k)) return k;
  return "";
}

function cleanRest(origin) {
  let o = s(origin).replace(/\s+/g, " ");
  if (o.includes(" ")) o = o.split(" ").slice(1).join("");
  else o = o.replace(/^[가-힣]+?(특별자치시|특별자치도|특별시|광역시|도)/, "");
  return o.replace(/[갑을병정무]\d*$/, "").replace(/\d+$/, "");
}

// 시도 내 GeoJSON 이름들로 greedy longest-prefix 매칭 → 구성 시군구명 목록
function matchNames(rest, sorted, all) {
  const out = new Set();
  let str = rest;
  while (str.length) {
    const m = sorted.find((n) => str.startsWith(n));
    if (!m) break;
    out.add(m);
    str = str.slice(m.length);
  }
  if (!out.size && rest) for (const n of all) if (n.startsWith(rest)) out.add(n);
  return [...out];
}

// 거리 기반 데시메이션(닫힌 링에 안전) — 최소 간격 이상일 때만 점 유지
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
    if (f[0] !== l[0] || f[1] !== l[1]) out.push([f[0], f[1]]); // 닫기
  }
  return out;
}

// MultiPolygon/Polygon 외곽 링만 추출
function outerRings(geom) {
  if (geom.type === "Polygon") return [geom.coordinates[0]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((poly) => poly[0]);
  return [];
}

async function main() {
  const apiKey = envv("API_KEY");
  if (!apiKey) {
    console.warn("[gen-shapes] API_KEY 없음 — 스킵");
    if (!existsSync(OUT)) save({ codes: {}, members: {} });
    return;
  }
  const geo = await (await fetch(GEO_URL)).json();
  const byCode = new Map();
  const namesBySido = {}; // prefix → {names:[], byName: Map(name→feature)}
  for (const f of geo.features) {
    const code = s(f.properties.code);
    const name = s(f.properties.name);
    byCode.set(code, f);
    const pre = code.slice(0, 2);
    (namesBySido[pre] = namesBySido[pre] || { names: [], byName: new Map() });
    namesBySido[pre].names.push(name);
    namesBySido[pre].byName.set(name, f);
  }
  for (const pre of Object.keys(namesBySido))
    namesBySido[pre].sorted = [...namesBySido[pre].names].sort((a, b) => b.length - a.length);

  const res = await fetch(
    `https://open.assembly.go.kr/portal/openapi/${MEMBERS}?KEY=${apiKey}&Type=json&pIndex=1&pSize=350`,
    { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
  );
  const j = JSON.parse(await res.text());
  const rows = j?.[MEMBERS]?.[1]?.row ?? [];

  const codes = {};
  const members = {};
  const EPS = 0.007; // 데시메이션 최소 간격(deg, ~700m) — 용량/형태 균형
  for (const r of rows) {
    const id = s(r.MONA_CD);
    const origin = s(r.ORIG_NM);
    if (!id || !origin || origin.includes("비례")) continue;
    const sido = sidoKey(origin);
    const pre = PREFIX[sido];
    const bucket = namesBySido[pre];
    if (!bucket) continue;
    const rest = cleanRest(origin);
    let names = rest ? matchNames(rest, bucket.sorted, bucket.names) : bucket.names.slice();
    if (!names.length) continue;
    const myCodes = [];
    for (const nm of names) {
      const f = bucket.byName.get(nm);
      if (!f) continue;
      const code = s(f.properties.code);
      myCodes.push(code);
      if (!codes[code]) {
        const rings = outerRings(f.geometry)
          .map((ring) => simplifyRing(ring, EPS))
          .filter((ring) => ring.length >= 4);
        codes[code] = { name: nm, rings };
      }
    }
    if (myCodes.length) members[id] = myCodes;
  }

  save({ codes, members });
  const sz = (JSON.stringify({ codes, members }).length / 1024).toFixed(0);
  console.log(
    `[gen-shapes] 시군구 ${Object.keys(codes).length}개 폴리곤, 의원 ${Object.keys(members).length}명 매핑 (${sz}KB)`,
  );
}

function save(obj) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(obj));
}

main().catch((e) => {
  console.warn("[gen-shapes] 실패:", e.message);
  if (!existsSync(OUT)) save({ codes: {}, members: {} });
});
