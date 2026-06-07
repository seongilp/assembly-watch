#!/usr/bin/env node
/**
 * 위원회 목록 베이크 → server/assets/committees.json
 * 프리렌더 라우트(/committees/[deptCd]) 구성 + 상세 엔드포인트에서 위원회 메타 조회용.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/committees.json");

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const s = (v) => (v == null ? "" : String(v).trim());

async function main() {
  const KEY = key();
  if (!KEY) {
    if (!existsSync(OUT)) save([]);
    console.warn("[gen-committees] API_KEY 없음");
    return;
  }
  const res = await fetch(
    `https://open.assembly.go.kr/portal/openapi/nxrvzonlafugpqjuh?KEY=${KEY}&Type=json&pSize=400`,
    { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
  );
  const j = JSON.parse(await res.text());
  const rows = j?.nxrvzonlafugpqjuh?.[1]?.row ?? [];
  const seen = new Set();
  const list = [];
  for (const r of rows) {
    const deptCd = s(r.HR_DEPT_CD);
    const name = s(r.COMMITTEE_NAME);
    if (!deptCd || !name || seen.has(deptCd)) continue;
    seen.add(deptCd);
    list.push({ deptCd, name, div: s(r.CMT_DIV_NM), limit: r.LIMIT_CNT ?? null });
  }
  save(list);
  console.log(`[gen-committees] ${list.length}개 위원회 베이크 (상임 ${list.filter((c) => c.div === "상임위원회").length})`);
}

function save(list) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(list));
}

main().catch((e) => {
  console.warn("[gen-committees] 실패:", e.message);
  if (!existsSync(OUT)) save([]);
});
