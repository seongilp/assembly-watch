#!/usr/bin/env node
/**
 * 최근 본회의 표결(집계 있는 건) 정당별 누적 통계 베이크 → server/assets/vote-stats.json
 *   { bills, parties: [{ party, 찬성, 반대, 기권, 불참, total }] }
 * 정당별 찬/반/기권/불참 합계 + 그래프용. 빌드 1회 집계(런타임 부하 0, cf=HIT).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/vote-stats.json");
const PLENARY = "nwbpacrgavhjryiph";
const ROLLCALL = "nojepdqqaweusdfbi";

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const s = (v) => (v == null ? "" : String(v).trim());
const normParty = (p) => (s(p).split("/")[0]?.trim() || "무소속");

async function call(code, params) {
  const q = new URLSearchParams({ KEY: key(), Type: "json", pIndex: "1", pSize: "300", ...params });
  const r = await fetch(`https://open.assembly.go.kr/portal/openapi/${code}?${q}`, {
    headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
  });
  const j = JSON.parse(await r.text());
  return j?.[code]?.[1]?.row ?? [];
}

function resultKey(r) {
  if (r.includes("찬성")) return "찬성";
  if (r.includes("반대")) return "반대";
  if (r.includes("기권")) return "기권";
  return "불참";
}

async function main() {
  if (!key()) {
    if (!existsSync(OUT)) save({ bills: 0, parties: [] });
    console.warn("[gen-vote-stats] API_KEY 없음");
    return;
  }
  const rows = await call(PLENARY, { AGE: "22" });
  const voted = rows.filter((r) => s(r.VOTE_TCNT) || s(r.YES_TCNT) || s(r.NO_TCNT));
  const billIds = voted.map((r) => s(r.BILL_ID)).filter(Boolean);

  const parties = new Map(); // party → {찬성,반대,기권,불참}
  let done = 0;
  // 동시성 제한
  const CONC = 8;
  let idx = 0;
  async function worker() {
    while (idx < billIds.length) {
      const id = billIds[idx++];
      try {
        const rc = await call(ROLLCALL, { AGE: "22", BILL_ID: id });
        for (const m of rc) {
          const p = normParty(m.POLY_NM);
          if (!parties.has(p)) parties.set(p, { 찬성: 0, 반대: 0, 기권: 0, 불참: 0 });
          parties.get(p)[resultKey(s(m.RESULT_VOTE_MOD))]++;
        }
        done++;
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  const out = {
    bills: done,
    parties: [...parties.entries()]
      .map(([party, t]) => ({ party, ...t, total: t.찬성 + t.반대 + t.기권 + t.불참 }))
      .sort((a, b) => b.total - a.total),
  };
  save(out);
  console.log(`[gen-vote-stats] ${done}건 집계, 정당 ${out.parties.length}개`);
}

function save(o) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(o));
}

main().catch((e) => {
  console.warn("[gen-vote-stats] 실패:", e.message);
  if (!existsSync(OUT)) save({ bills: 0, parties: [] });
});
