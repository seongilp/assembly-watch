#!/usr/bin/env node
/**
 * 선거구(ORIG_NM) → 좌표 베이크: server/assets/districts.json = { [MONA_CD]: [lat, lng] }
 * 카카오 local REST 지오코딩(빌드 1회). 런타임 클라 지오코딩 제거 → 지도 상세(의원 핀) cf=HIT.
 * 키: KAKAO_REST_KEY (.env, gitignore). REST 키 없으면 스킵(빈 맵 유지).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/districts.json");
const MEMBERS = "nwvrqwxyaytdsfvhu";

function envv(name) {
  if (process.env[name]) return process.env[name];
  try {
    return readFileSync(join(root, ".env"), "utf8").match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const s = (v) => (v == null ? "" : String(v).trim());

/** "경북 구미시을" → "경북 구미시", "서울 광진구을" → "서울 광진구" */
function districtQuery(origin) {
  const o = s(origin).replace(/\s+/g, " ");
  if (!o || o.includes("비례")) return "";
  const parts = o.split(" ");
  const sido = parts[0];
  let rest = parts.slice(1).join("");
  if (!rest) return o.replace(/[갑을병정무]$/, ""); // "세종특별자치시갑" 등 단일토큰
  rest = rest.replace(/[갑을병정무]$/, "").replace(/\d+$/, "");
  let m = rest.match(/^(.+?[시군])/); // 첫 시/군 우선(복합선거구 대응)
  if (!m) m = rest.match(/^(.+?구)/); // 자치구
  return `${sido} ${m ? m[1] : rest}`;
}

async function geocode(query, KEY) {
  const h = { Authorization: `KakaoAK ${KEY}`, "User-Agent": "UijeongWatch build" };
  // 1) 주소 검색
  const a = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
    { headers: h },
  );
  const aj = await a.json();
  const ad = aj?.documents?.[0];
  if (ad?.x && ad?.y) return [Number(ad.y), Number(ad.x)];
  // 2) 키워드 폴백(시군구청)
  const k = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query + "청")}&size=1`,
    { headers: h },
  );
  const kj = await k.json();
  const kd = kj?.documents?.[0];
  if (kd?.x && kd?.y) return [Number(kd.y), Number(kd.x)];
  return null;
}

async function main() {
  const KEY = envv("KAKAO_REST_KEY");
  if (!KEY) {
    console.warn("[gen-districts] KAKAO_REST_KEY 없음 — 스킵");
    if (!existsSync(OUT)) save({});
    return;
  }
  const apiKey = envv("API_KEY");
  const res = await fetch(
    `https://open.assembly.go.kr/portal/openapi/${MEMBERS}?KEY=${apiKey}&Type=json&pIndex=1&pSize=350`,
    { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
  );
  const j = JSON.parse(await res.text());
  const rows = j?.[MEMBERS]?.[1]?.row ?? [];

  // 쿼리 단위 캐시(같은 시군구는 1회만 지오코딩)
  const cache = new Map();
  const out = {};
  for (const r of rows) {
    const id = s(r.MONA_CD);
    const q = districtQuery(r.ORIG_NM);
    if (!id || !q) continue;
    if (!cache.has(q)) {
      try {
        cache.set(q, await geocode(q, KEY));
      } catch {
        cache.set(q, null);
      }
    }
    const c = cache.get(q);
    if (c) out[id] = c;
  }
  save(out);
  console.log(
    `[gen-districts] ${Object.keys(out).length}명 좌표 (쿼리 ${cache.size}개) → districts.json`,
  );
}

function save(obj) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(obj));
}

main().catch((e) => {
  console.warn("[gen-districts] 실패:", e.message);
  if (!existsSync(OUT)) save({});
});
