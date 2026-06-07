#!/usr/bin/env node
/**
 * 최근 의안 베이크 → server/assets/bills-recent.json { pending:[], processed:[] }
 * 의안 페이지의 탭/검색/페이지네이션을 클라이언트에서 즉시 처리(런타임 Worker 호출 제거).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/bills-recent.json");
const AGE = 22;
const N = 300;

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const s = (v) => (v == null ? "" : String(v).trim());

async function call(code, params) {
  const q = new URLSearchParams({ KEY: key(), Type: "json", pIndex: "1", pSize: String(N), ...params });
  const r = await fetch(`https://open.assembly.go.kr/portal/openapi/${code}?${q}`, {
    headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
  });
  const j = JSON.parse(await r.text());
  return j?.[code]?.[1]?.row ?? [];
}

async function main() {
  if (!key()) {
    if (!existsSync(OUT)) save({ pending: [], processed: [] });
    console.warn("[gen-bills] API_KEY 없음");
    return;
  }
  const pendingRows = await call("nwbqublzajtcqpdae", {});
  const processedRows = await call("nzpltgfqabtcpsmai", { AGE: String(AGE) });

  // 계류 의안 심사 단계 (날짜 필드로 진행도 산출)
  const stageOf = (r) => {
    if (s(r.LAW_PROC_DT)) return "본회의 대기";
    if (s(r.LAW_PRESENT_DT)) return "체계자구 심사";
    if (s(r.CMT_PROC_DT)) return "위원회 의결";
    if (s(r.CMT_PRESENT_DT)) return "위원회 심사";
    if (s(r.COMMITTEE_DT)) return "위원회 회부";
    return "접수";
  };
  const pending = pendingRows.map((r) => ({
    id: s(r.BILL_ID), no: s(r.BILL_NO), name: s(r.BILL_NAME),
    proposer: s(r.PROPOSER), proposerKind: s(r.PROPOSER_KIND),
    proposeDt: s(r.PROPOSE_DT), committee: s(r.CURR_COMMITTEE),
    procResult: "", procDt: "", link: s(r.LINK_URL), status: "pending",
    stage: stageOf(r),
  }));
  const processed = processedRows.map((r) => ({
    id: s(r.BILL_ID), no: s(r.BILL_NO), name: s(r.BILL_NAME),
    proposer: s(r.PROPOSER), proposerKind: s(r.PROPOSER_KIND),
    proposeDt: s(r.PROPOSE_DT), committee: s(r.CURR_COMMITTEE),
    procResult: s(r.PROC_RESULT_CD), procDt: s(r.PROC_DT), link: s(r.LINK_URL), status: "processed",
  }));

  save({ pending, processed });
  console.log(`[gen-bills] 계류 ${pending.length} · 처리 ${processed.length} 베이크`);
}

function save(o) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(o));
}

main().catch((e) => {
  console.warn("[gen-bills] 실패:", e.message);
  if (!existsSync(OUT)) save({ pending: [], processed: [] });
});
