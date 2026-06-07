#!/usr/bin/env node
/**
 * 빌드타임 펀팩트/랭킹 집계 → server/assets/insights.json
 *  - 가장 많이 발의(대표발의)
 *  - 최근 본회의 표결 기준: 불참/찬성/반대/기권 최다, 출석(투표참여)률
 * 무거운 집계를 런타임에서 빼고 프리렌더로 즉시 제공.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/insights.json");
const PHOTOS = JSON.parse(
  existsSync(join(root, "server/assets/member-photos.json"))
    ? readFileSync(join(root, "server/assets/member-photos.json"), "utf8")
    : "{}",
);
const AGE = 22;
const BASE = "https://open.assembly.go.kr/portal/openapi";

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const KEY = key();

async function call(code, params = {}) {
  const q = new URLSearchParams({ KEY, Type: "json", pSize: "1000", ...params });
  const res = await fetch(`${BASE}/${code}?${q}`, {
    headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
  });
  const j = JSON.parse(await res.text());
  const block = j?.[code];
  if (!Array.isArray(block)) return { rows: [], total: 0 };
  return {
    rows: block[1]?.row ?? [],
    total: block[0]?.head?.[0]?.list_total_count ?? 0,
  };
}

const s = (v) => (v == null ? "" : String(v).trim());

async function main() {
  if (!KEY) {
    console.warn("[gen-insights] API_KEY 없음 — 빈 insights");
    save({ generatedAt: null, voteBills: 0, proposed: [], absent: [], yes: [], no: [], blank: [], attendance: [] });
    return;
  }

  // 1) 현직 의원 (이름·정당·선거구·MONA_CD)
  const parseTerm = (v) => {
    const t = s(v);
    if (t.includes("초선")) return 1;
    if (t.includes("재선")) return 2;
    const m = t.match(/(\d+)\s*선/);
    return m ? Number(m[1]) : 0;
  };
  const members = (await call("nwvrqwxyaytdsfvhu", { pSize: "350" })).rows.map((r) => ({
    id: s(r.MONA_CD),
    name: s(r.HG_NM),
    party: s(r.POLY_NM).split("/")[0],
    origin: s(r.ORIG_NM),
    photo: PHOTOS[s(r.MONA_CD)] ?? "",
    term: parseTerm(r.REELE_GBN_NM),
    termLabel: s(r.REELE_GBN_NM),
  }));
  const byName = new Map(members.map((m) => [m.name, m]));
  const byId = new Map(members.map((m) => [m.id, m]));

  // 2) 대표발의 (발의법률안 전체) — 수 + 의원별 법안목록
  const proposeCount = new Map();
  const proposeBills = new Map(); // id -> [bill]
  {
    const first = await call("nzmimeepazxkubdpn", { AGE: String(AGE), pIndex: "1" });
    const pages = Math.min(20, Math.ceil(first.total / 1000));
    const all = [first.rows];
    for (let p = 2; p <= pages; p++) {
      all.push((await call("nzmimeepazxkubdpn", { AGE: String(AGE), pIndex: String(p) })).rows);
    }
    for (const rows of all)
      for (const r of rows) {
        const cd = s(r.RST_MONA_CD);
        if (!cd) continue;
        proposeCount.set(cd, (proposeCount.get(cd) ?? 0) + 1);
        const arr = proposeBills.get(cd) ?? [];
        if (arr.length < 30)
          arr.push({
            id: s(r.BILL_ID),
            no: s(r.BILL_NO),
            name: s(r.BILL_NAME),
            proposer: s(r.PROPOSER),
            proposeDt: s(r.PROPOSE_DT),
            committee: s(r.COMMITTEE),
            procResult: s(r.PROC_RESULT),
            link: s(r.DETAIL_LINK),
            status: s(r.PROC_RESULT) ? "processed" : "pending",
          });
        proposeBills.set(cd, arr);
      }
  }

  // 3) 최근 표결안건(집계 있는 것) → 의원별 찬/반/기권/불참 + 의원별 표결이력
  const votedBills = (await call("nwbpacrgavhjryiph", { AGE: String(AGE), pSize: "120" })).rows
    .filter((r) => r.VOTE_TCNT != null && r.VOTE_TCNT !== "")
    .slice(0, 60)
    .map((r) => ({ billId: s(r.BILL_ID), billName: s(r.BILL_NM), procDt: s(r.RGS_PROC_DT), procResult: s(r.PROC_RESULT_CD) }))
    .filter((b) => b.billId);
  // 표결 상세 프리렌더 대상(최근 60건) 목록 저장
  writeFileSync(
    join(root, "server/assets/voted-bills.json"),
    JSON.stringify(votedBills.map((b) => b.billId)),
  );

  const tally = new Map(); // name -> {yes,no,blank,absent,total}
  const memberVotes = new Map(); // name -> [{billId,billName,date,result,procResult}]
  for (const b of votedBills) {
    const { rows } = await call("nojepdqqaweusdfbi", { AGE: String(AGE), BILL_ID: b.billId });
    for (const r of rows) {
      const nm = s(r.HG_NM);
      if (!nm) continue;
      const t = tally.get(nm) ?? { yes: 0, no: 0, blank: 0, absent: 0, total: 0 };
      const v = s(r.RESULT_VOTE_MOD);
      t.total++;
      if (v.includes("찬성")) t.yes++;
      else if (v.includes("반대")) t.no++;
      else if (v.includes("기권")) t.blank++;
      else t.absent++;
      tally.set(nm, t);
      const mv = memberVotes.get(nm) ?? [];
      if (mv.length < 15)
        mv.push({ billId: b.billId, billName: b.billName, date: b.procDt, result: v, procResult: b.procResult });
      memberVotes.set(nm, mv);
    }
  }

  // 의원별 상세(발의·표결) 정적 베이크 → 런타임 무거운 호출 제거
  const details = {};
  for (const m of members) {
    details[m.id] = {
      bills: proposeBills.get(m.id) ?? [],
      votes: memberVotes.get(m.name) ?? [],
      votesScanned: votedBills.length,
    };
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(join(root, "server/assets/member-details.json"), JSON.stringify(details));
  console.log(`[gen-insights] 의원 상세 ${Object.keys(details).length}명 베이크`);

  // 의원별 표결 집계(목록 카드용) id → {y,n,b,a,total}
  const memberTally = {};
  for (const [name, t] of tally) {
    const m = byName.get(name);
    if (m?.id) memberTally[m.id] = { y: t.yes, n: t.no, b: t.blank, a: t.absent, total: t.total };
  }
  writeFileSync(join(root, "server/assets/member-tally.json"), JSON.stringify(memberTally));

  const enrich = (name, extra) => {
    const m = byName.get(name) ?? { id: "", name, party: "", origin: "", photo: "" };
    return { ...m, ...extra };
  };

  // 랭킹 빌드
  const proposed = [...proposeCount.entries()]
    .map(([id, count]) => ({ ...(byId.get(id) ?? { id, name: "?", party: "", origin: "", photo: "" }), count }))
    .filter((x) => x.name !== "?")
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const voteList = [...tally.entries()].map(([name, t]) => ({ name, ...t }));
  const top = (sel) =>
    voteList
      .map((t) => enrich(t.name, { count: sel(t), total: t.total }))
      .filter((x) => x.id && x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

  const attendance = voteList
    .map((t) => enrich(t.name, { rate: t.total ? (t.total - t.absent) / t.total : 0, total: t.total, absent: t.absent }))
    .filter((x) => x.id && x.total >= Math.max(5, votedBills.length * 0.5));

  const terms = [...members]
    .filter((m) => m.term > 0)
    .sort((a, b) => b.term - a.term)
    .slice(0, 15)
    .map((m) => ({ ...m, count: m.term }));

  save({
    generatedAt: new Date().toISOString(),
    voteBills: votedBills.length,
    terms,
    proposed,
    absent: top((t) => t.absent),
    yes: top((t) => t.yes),
    no: top((t) => t.no),
    blank: top((t) => t.blank),
    attendanceLow: [...attendance].sort((a, b) => a.rate - b.rate).slice(0, 15),
  });
  console.log(`[gen-insights] 발의 ${proposed.length} · 표결 ${votedBills.length}건 집계 완료`);
}

function save(obj) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(obj));
}

main().catch((e) => {
  console.warn("[gen-insights] 실패:", e.message);
  if (!existsSync(OUT)) save({ generatedAt: null, voteBills: 0, proposed: [], absent: [], yes: [], no: [], blank: [], attendanceLow: [] });
});
