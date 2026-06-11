#!/usr/bin/env node
/**
 * 표결 매트릭스 + 파생 통계 베이크.
 *  - server/assets/votedata.json : { bills, members, matrix } (퀴즈/표결쌍둥이 클라 계산용)
 *  - server/assets/vote-insights.json : { rebel, partyUnity, close, unanimous } (소신왕/결속도/박빙)
 * 매트릭스 코드: Y=찬성 N=반대 B=기권 A=불참 -=무기록 (bills 순서에 정렬)
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLENARY = "nwbpacrgavhjryiph";
const ROLLCALL = "nojepdqqaweusdfbi";
const MEMBERS = "nwvrqwxyaytdsfvhu";

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const s = (v) => (v == null ? "" : String(v).trim());
const np = (p) => s(p).split("/")[0]?.trim() || "무소속";

async function call(code, params) {
  const q = new URLSearchParams({ KEY: key(), Type: "json", pIndex: "1", pSize: "300", ...params });
  const r = await fetch(`https://open.assembly.go.kr/portal/openapi/${code}?${q}`, {
    headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
  });
  const j = JSON.parse(await r.text());
  return j?.[code]?.[1]?.row ?? [];
}
const codeOf = (r) => (r.includes("찬성") ? "Y" : r.includes("반대") ? "N" : r.includes("기권") ? "B" : "A");

async function main() {
  if (!key()) {
    console.warn("[gen-votedata] API_KEY 없음");
    return;
  }
  // 1) 현직 의원
  const mrows = await call(MEMBERS, { pSize: "350" });
  const PHOTOS = (() => { try { return JSON.parse(readFileSync(join(root, "server/assets/member-photos.json"), "utf8")); } catch { return {}; } })();
  const members = mrows.map((r) => ({
    id: s(r.MONA_CD), name: s(r.HG_NM), party: np(r.POLY_NM), origin: s(r.ORIG_NM), photo: PHOTOS[s(r.MONA_CD)] ?? "",
  }));
  const byId = new Map(members.map((m) => [m.id, m]));

  // 2) 표결(집계 있는) 안건 — 최근순
  const plen = await call(PLENARY, { AGE: "22" });
  const voted = plen
    .filter((r) => s(r.VOTE_TCNT) || s(r.YES_TCNT) || s(r.NO_TCNT))
    .sort((a, b) => s(b.RGS_PROC_DT).localeCompare(s(a.RGS_PROC_DT)));

  // 3) 안건별 rollcall → matrix
  const bills = [];
  const matrix = {}; // id -> array of codes
  for (const m of members) matrix[m.id] = [];
  let idx = 0;
  let bi = 0;
  const CONC = 8;
  const results = new Array(voted.length);
  async function worker() {
    while (idx < voted.length) {
      const i = idx++;
      const b = voted[i];
      try {
        const rc = await call(ROLLCALL, { AGE: "22", BILL_ID: s(b.BILL_ID) });
        results[i] = rc;
      } catch {
        results[i] = [];
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  for (let i = 0; i < voted.length; i++) {
    const b = voted[i];
    const rc = results[i];
    if (!rc || !rc.length) continue;
    const voteByMember = new Map();
    const party = {}; // party -> {Y,N,B,A}
    let y = 0, n = 0, bl = 0;
    for (const r of rc) {
      const id = s(r.MONA_CD);
      const c = codeOf(s(r.RESULT_VOTE_MOD));
      voteByMember.set(id, c);
      const p = np(r.POLY_NM);
      (party[p] = party[p] || { Y: 0, N: 0, B: 0, A: 0 })[c]++;
      if (c === "Y") y++; else if (c === "N") n++; else if (c === "B") bl++;
    }
    bills.push({
      id: s(b.BILL_ID), no: s(b.BILL_NO), name: s(b.BILL_NM),
      date: s(b.RGS_PROC_DT), procResult: s(b.PROC_RESULT_CD), committee: s(b.COMMITTEE_NM),
      y, n, b: bl, total: y + n + bl, party,
    });
    for (const m of members) matrix[m.id].push(voteByMember.get(m.id) ?? "-");
    bi++;
  }
  // matrix array -> string
  const matrixStr = {};
  for (const m of members) matrixStr[m.id] = matrix[m.id].join("");

  save("votedata.json", { bills: bills.map(({ party, ...x }) => x), members, matrix: matrixStr });
  console.log(`[gen-votedata] 표결 ${bills.length}건 × 의원 ${members.length}명 매트릭스`);

  // ── 파생 통계 ──
  const B = bills.length;
  // A) 소신(당론 이탈) — 각 안건 정당 다수결과 다른 표(Y/N/B 중)
  const rebelCount = new Map();
  for (let i = 0; i < B; i++) {
    const party = bills[i].party;
    const maj = {}; // party -> majority code among Y/N/B
    for (const [p, t] of Object.entries(party)) {
      const arr = [["Y", t.Y], ["N", t.N], ["B", t.B]].sort((a, b) => b[1] - a[1]);
      maj[p] = arr[0][1] > 0 ? arr[0][0] : null;
    }
    for (const m of members) {
      const c = matrix[m.id][i];
      if (c === "-" || c === "A") continue;
      if (maj[m.party] && c !== maj[m.party]) rebelCount.set(m.id, (rebelCount.get(m.id) ?? 0) + 1);
    }
  }
  const rebel = [...rebelCount.entries()]
    .map(([id, count]) => ({ ...(byId.get(id) ?? { id }), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  // C) 정당 결속도 (Rice index: |Y-N|/(Y+N) 안건평균, Y/N 합 5+ 안건만)
  const partyAgg = {};
  for (const bl2 of bills) {
    for (const [p, t] of Object.entries(bl2.party)) {
      const yn = t.Y + t.N;
      if (yn < 5) continue;
      (partyAgg[p] = partyAgg[p] || { sum: 0, cnt: 0, seats: 0 }).sum += Math.abs(t.Y - t.N) / yn;
      partyAgg[p].cnt++;
    }
  }
  const seatByParty = {};
  for (const m of members) seatByParty[m.party] = (seatByParty[m.party] ?? 0) + 1;
  const partyUnity = Object.entries(partyAgg)
    .map(([party, a]) => ({ party, unity: a.cnt ? a.sum / a.cnt : 0, bills: a.cnt, seats: seatByParty[party] ?? 0 }))
    .filter((x) => x.seats >= 2)
    .sort((a, b) => b.unity - a.unity);

  // D) 박빙(찬-반 격차 작은) / 만장일치(반대 0)
  const withMargin = bills.filter((b2) => b2.n + b2.y > 0);
  const close = [...withMargin].sort((a, b) => Math.abs(a.y - a.n) - Math.abs(b.y - b.n)).slice(0, 10)
    .map((b2) => ({ id: b2.id, name: b2.name, no: b2.no, date: b2.date, y: b2.y, n: b2.n, b: b2.b }));
  const unanimousList = bills.filter((b2) => b2.n === 0 && b2.b === 0 && b2.y >= 50);
  const unanimous = { count: unanimousList.length, total: bills.length };

  // E) 퀴즈용 안건 — 반대표 많은(논쟁적) 순 10개
  const quiz = [...bills].sort((a, b) => b.n - a.n).slice(0, 10).map((b2) => ({ id: b2.id, name: b2.name, no: b2.no }));

  save("vote-insights.json", { generatedAt: null, billCount: B, rebel, partyUnity, close, unanimous, quiz });
  console.log(`[gen-votedata] 소신 ${rebel.length} · 결속도 ${partyUnity.length}정당 · 박빙 ${close.length} · 만장일치 ${unanimous.count} · 퀴즈 ${quiz.length}`);
}

function save(name, obj) {
  const out = join(root, "server/assets", name);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(obj));
}

main().catch((e) => console.warn("[gen-votedata] 실패:", e.message));
