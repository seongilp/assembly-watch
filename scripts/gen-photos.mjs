#!/usr/bin/env node
/**
 * 빌드타임 의원 사진 맵 생성: ALLNAMEMBER(NAAS_CD→NAAS_PIC) → server/assets/member-photos.json
 * 런타임에 무거운 ALLNAMEMBER(4페이지) 호출을 없애 /api/members 502 + 지연을 제거한다.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/member-photos.json");

function apiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    const env = readFileSync(join(root, ".env"), "utf8");
    return env.match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

async function main() {
  const KEY = apiKey();
  if (!KEY) {
    console.warn("[gen-photos] API_KEY 없음 — 기존 JSON 유지");
    if (!existsSync(OUT)) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, "{}");
    }
    return;
  }
  const base = "https://open.assembly.go.kr/portal/openapi/ALLNAMEMBER";
  const map = {};
  for (const p of [1, 2, 3, 4]) {
    const url = `${base}?KEY=${KEY}&Type=json&pIndex=${p}&pSize=1000`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } });
    const json = JSON.parse(await res.text());
    const rows = json?.ALLNAMEMBER?.[1]?.row ?? [];
    for (const r of rows) {
      if (r.NAAS_CD && r.NAAS_PIC) map[String(r.NAAS_CD)] = String(r.NAAS_PIC);
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(map));
  console.log(`[gen-photos] ${Object.keys(map).length}명 사진 맵 생성 → ${OUT}`);
}

main().catch((e) => {
  console.warn("[gen-photos] 실패(빈 맵 유지):", e.message);
  if (!existsSync(OUT)) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, "{}");
  }
});
