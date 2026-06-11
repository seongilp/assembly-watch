#!/usr/bin/env node
/**
 * 의원 아바타를 빌드타임에 webp로 구워 public/m/{MONA_CD}.webp 로 저장.
 * - 원본(NAAS_PIC)을 wsrv.nl로 한 번만 리사이즈/ webp 변환 → 우리 엣지(cf=HIT)에서 직배.
 * - 런타임 서드파티(wsrv) 호출 제거 → 전 페이지 아바타 즉시 표시.
 * 키는 MONA_CD(=member id). 원본 URL 베이스네임이 랜덤 해시라 id로 직접 매핑한다.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public/m");
const SIZE = 200; // 상세 84px + retina 커버
const CONCURRENCY = 12;

function load(name) {
  try {
    return JSON.parse(readFileSync(join(root, "server/assets", name), "utf8"));
  } catch {
    return {};
  }
}

function wsrv(url) {
  const enc = encodeURIComponent(url);
  return `https://wsrv.nl/?url=${enc}&w=${SIZE}&h=${SIZE}&fit=cover&a=top&output=webp&q=80`;
}

async function main() {
  const photos = load("member-photos.json"); // NAAS_CD/MONA_CD → url
  const details = load("member-details.json"); // MONA_CD → {...}
  // 현직 의원(상세 데이터 보유) 우선, 없으면 photos 전체
  const ids = Object.keys(details).length ? Object.keys(details) : Object.keys(photos);
  const targets = ids
    .map((id) => ({ id, url: photos[id] }))
    .filter((t) => t.url && /^https?:\/\//.test(t.url));

  if (!targets.length) {
    console.warn("[gen-avatars] 대상 없음 — 스킵");
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });

  let ok = 0;
  let fail = 0;
  let idx = 0;
  let skip = 0;
  async function fetchOne(url) {
    const res = await fetch(wsrv(url), {
      headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error("too small");
    return buf;
  }
  // wsrv 가 못 다루는 케이스(초대형 원본 PNG 등) → 원본 직접 받아 sharp 로컬 변환.
  // sharp 는 의존성에 없음(CI pnpm 빌드스크립트 정책 충돌) — 필요 시 `pnpm add -D sharp` 후 베이크.
  async function directOne(url) {
    const sharp = (await import("sharp")).default;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } });
    if (!res.ok) throw new Error(`origin HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return sharp(buf).resize(SIZE, SIZE, { fit: "cover", position: "top" }).webp({ quality: 80 }).toBuffer();
  }
  async function worker() {
    while (idx < targets.length) {
      const t = targets[idx++];
      const dest = join(OUT_DIR, `${t.id}.webp`);
      if (existsSync(dest)) {
        skip++;
        continue;
      } // 이미 구운 건 스킵(증분)
      try {
        let buf;
        try {
          buf = await fetchOne(t.url);
        } catch {
          try {
            buf = await fetchOne(t.url); // 1회 재시도
          } catch {
            buf = await directOne(t.url); // 최후: 원본 직접 + sharp
          }
        }
        writeFileSync(dest, buf);
        ok++;
      } catch {
        fail++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[gen-avatars] ${ok}장 신규, ${skip}장 스킵, 실패 ${fail} → public/m/`);
}

main().catch((e) => {
  console.warn("[gen-avatars] 실패:", e.message);
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
});
