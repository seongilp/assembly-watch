#!/usr/bin/env node
/**
 * 대시보드/일정/표결목록 스냅샷 베이크 → server/assets/{stats,schedule,votes-list}.json
 * 프리렌더가 라이브 API 없이 정적 데이터로 빌드되도록(CI 자동배포). 빌드 1회 fetch.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGE = "22";
const CODE = {
  MEMBERS: "nwvrqwxyaytdsfvhu",
  BILLS_PENDING: "nwbqublzajtcqpdae",
  BILLS_PROCESSED: "nzpltgfqabtcpsmai",
  VOTES_PLENARY: "nwbpacrgavhjryiph",
  SCHEDULE: "ALLSCHEDULE",
};

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const s = (v) => (v == null ? "" : String(v).trim());
const n = (v) => {
  const x = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : null;
};
const save = (name, data) =>
  writeFileSync(join(root, "server/assets", name), JSON.stringify(data));

async function call(code, params = {}) {
  const q = new URLSearchParams({ KEY: key(), Type: "json", pIndex: "1", pSize: "100", ...params });
  const r = await fetch(`https://open.assembly.go.kr/portal/openapi/${code}?${q}`, {
    headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
  });
  const j = JSON.parse(await r.text());
  return {
    rows: j?.[code]?.[1]?.row ?? [],
    total: Number(j?.[code]?.[0]?.head?.[0]?.list_total_count) || 0,
  };
}

const mapVoteSummary = (r) => ({
  billId: s(r.BILL_ID),
  billNo: s(r.BILL_NO),
  billName: s(r.BILL_NM),
  billKind: s(r.BILL_KIND),
  proposer: s(r.PROPOSER),
  committee: s(r.COMMITTEE_NM),
  procResult: s(r.PROC_RESULT_CD),
  procDt: s(r.RGS_PROC_DT),
  yes: n(r.YES_TCNT),
  no: n(r.NO_TCNT),
  blank: n(r.BLANK_TCNT),
  total: n(r.VOTE_TCNT),
  link: s(r.LINK_URL),
});
const mapSchedule = (r) => ({
  kind: s(r.SCH_KIND),
  content: s(r.SCH_CN),
  date: s(r.SCH_DT),
  time: s(r.SCH_TM),
  committee: s(r.CMIT_NM),
  place: s(r.EV_PLC),
  host: s(r.EV_INST_NM),
  confDiv: s(r.CONF_DIV),
});

async function main() {
  if (!key()) {
    console.warn("[gen-snapshots] API_KEY 없음 — 기존 스냅샷 유지");
    return;
  }

  // 1) stats — 각 totalCount
  const [m, bp, bpr, v] = await Promise.all([
    call(CODE.MEMBERS, { pSize: "1" }),
    call(CODE.BILLS_PENDING, { pSize: "1" }),
    call(CODE.BILLS_PROCESSED, { pSize: "1", AGE }),
    call(CODE.VOTES_PLENARY, { pSize: "1", AGE }),
  ]);
  save("stats.json", {
    age: Number(AGE),
    members: m.total,
    billsPending: bp.total,
    billsProcessed: bpr.total,
    votes: v.total,
    updatedAt: new Date().toISOString(),
  });
  console.log(`[gen-snapshots] stats: ${m.total}명 ${v.total}표결`);

  // 2) schedule — 최근 300
  const sched = await call(CODE.SCHEDULE, { pSize: "300" });
  save("schedule.json", sched.rows.map(mapSchedule).filter((r) => r.date));
  console.log(`[gen-snapshots] schedule: ${sched.rows.length}건`);

  // 3) votes-list — 전체(페이징)
  const all = [];
  for (let page = 1; page <= 30; page++) {
    const res = await call(CODE.VOTES_PLENARY, { pIndex: String(page), pSize: "100", AGE });
    all.push(...res.rows.map(mapVoteSummary));
    if (all.length >= res.total || res.rows.length === 0) break;
  }
  save("votes-list.json", all);
  console.log(`[gen-snapshots] votes-list: ${all.length}건`);
}

main();
