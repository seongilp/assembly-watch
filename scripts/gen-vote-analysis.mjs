#!/usr/bin/env node
/**
 * "표결의 발견" 베이크 — 표결별 집단 특성 분석.
 *  입력: votedata.json(매트릭스) + members.json(인적사항) + wealth.json(재산)
 *  출력: server/assets/vote-analysis.json
 *    ├─ byBill: { [billId]: VoteFact[] }  의안당 상위 4개 팩트
 *    └─ topPicks: 전역 점수 상위 12 (의안당 1개 · 차원당 최대 3개)
 *
 * 외부 API 를 치지 않는다(빌드 의존성 없음). 통계 기준은 docs/superpowers/specs/
 * 2026-06-12-vote-discoveries-design.md 참고.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = (p) => join(root, "server/assets", p);
const read = (p) => JSON.parse(readFileSync(A(p), "utf8"));

const vd = read("votedata.json"); // { bills, members, matrix }
const membersRaw = (() => {
  const m = read("members.json");
  return Array.isArray(m) ? m : (m.rows ?? Object.values(m));
})();
const wealth = (() => {
  try {
    return read("wealth.json");
  } catch {
    return { members: [] };
  }
})();

const NOW_YEAR = 2026;

// ── 의원 프로필 구성 ──────────────────────────────────────────────
const SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const BLOC = {
  서울: "수도권", 경기: "수도권", 인천: "수도권",
  대전: "충청", 세종: "충청", 충북: "충청", 충남: "충청",
  광주: "호남", 전북: "호남", 전남: "호남",
  부산: "영남", 대구: "영남", 울산: "영남", 경북: "영남", 경남: "영남",
  강원: "강원·제주", 제주: "강원·제주",
};
function sidoOf(origin) {
  const o = String(origin || "").trim();
  if (!o || o.includes("비례")) return null;
  for (const s of SIDO) if (o.startsWith(s)) return s;
  const head = o.split(/\s+/)[0] || "";
  for (const s of SIDO) if (head.startsWith(s)) return s;
  return null;
}

const ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
const zodiacOf = (year) => ZODIAC[(((year - 2020) % 12) + 12) % 12];

const DOUBLE_SURNAMES = ["남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방"];
function surnameOf(name) {
  const n = String(name || "").trim();
  for (const d of DOUBLE_SURNAMES) if (n.startsWith(d)) return d;
  return n.slice(0, 1);
}

function genOf(birthYear) {
  if (!birthYear) return null;
  const age = NOW_YEAR - birthYear;
  if (age < 50) return "40대 이하";
  if (age < 60) return "50대";
  if (age < 70) return "60대";
  return "70대 이상";
}
function termsOf(reelection) {
  const r = String(reelection || "");
  if (r.includes("초선")) return "초선";
  if (r.includes("재선")) return "재선";
  return r ? "3선 이상" : null;
}

const metaById = new Map(membersRaw.map((m) => [m.id, m]));
const wealthById = new Map((wealth.members ?? []).map((w) => [w.id, w.total]));

// 재산 4분위 경계 (재산 데이터 있는 의원 기준)
const wealthSorted = [...wealthById.values()].sort((a, b) => a - b);
const qAt = (q) => wealthSorted[Math.min(wealthSorted.length - 1, Math.floor(wealthSorted.length * q))] ?? 0;
const [Q1, Q2, Q3, P90] = [qAt(0.25), qAt(0.5), qAt(0.75), qAt(0.9)];
function wealthQ(total) {
  if (total == null) return null;
  if (total < Q1) return "하위 25%";
  if (total < Q2) return "중하위";
  if (total < Q3) return "중상위";
  return "상위 25%";
}

const profiles = vd.members.map((m) => {
  const meta = metaById.get(m.id) ?? {};
  const birthYear = Number(String(meta.birth || "").slice(0, 4)) || null;
  const sido = sidoOf(m.origin);
  const total = wealthById.get(m.id) ?? null;
  return {
    id: m.id,
    name: m.name,
    party: m.party,
    bloc: sido ? BLOC[sido] : null, // null = 비례
    capital: sido ? (BLOC[sido] === "수도권" ? "수도권" : "비수도권") : null,
    elect: sido ? "지역구" : "비례대표",
    gen: genOf(birthYear),
    age: birthYear ? NOW_YEAR - birthYear : null,
    terms: termsOf(meta.reelection),
    sex: meta.sex === "남" || meta.sex === "여" ? meta.sex : null,
    zodiac: birthYear ? zodiacOf(birthYear) : null,
    surname: surnameOf(m.name),
    wealth: total,
    wealthQ: wealthQ(total),
    wealthTop: total == null ? null : total >= P90 ? "상위 10%" : "나머지 90%",
  };
});

// 성씨: 전체 10명 이상만 분석 대상
const surnameCount = {};
for (const p of profiles) surnameCount[p.surname] = (surnameCount[p.surname] || 0) + 1;
const BIG_SURNAMES = new Set(Object.keys(surnameCount).filter((s2) => surnameCount[s2] >= 10));
for (const p of profiles) if (!BIG_SURNAMES.has(p.surname)) p.surname = null;

// ── 분석 차원 정의 ────────────────────────────────────────────────
// key: 프로필 필드, ordered: 라벨 정렬(차트용), fun: 재미 차원(완화 기준 + 점수 감산)
const DIMS = [
  { dim: "bloc", key: "bloc", label: "권역", order: ["수도권", "충청", "호남", "영남", "강원·제주"], suffix: " 지역구 의원" },
  { dim: "capital", key: "capital", label: "수도권", order: ["수도권", "비수도권"], suffix: " 지역구 의원" },
  { dim: "wealth", key: "wealthQ", label: "재산", order: ["하위 25%", "중하위", "중상위", "상위 25%"], suffix: " 의원", partyControl: true },
  { dim: "wealthTop", key: "wealthTop", label: "재산 상위 10%", order: ["상위 10%", "나머지 90%"], suffix: " 의원", partyControl: true },
  { dim: "gen", key: "gen", label: "세대", order: ["40대 이하", "50대", "60대", "70대 이상"], suffix: " 의원", partyControl: true },
  { dim: "terms", key: "terms", label: "선수", order: ["초선", "재선", "3선 이상"], suffix: " 의원", partyControl: true },
  { dim: "sex", key: "sex", label: "성별", order: ["남", "여"], suffix: "성 의원" },
  { dim: "elect", key: "elect", label: "선출 방식", order: ["지역구", "비례대표"], suffix: " 의원" },
  { dim: "zodiac", key: "zodiac", label: "띠", order: ZODIAC, suffix: "띠", fun: true },
  { dim: "surname", key: "surname", label: "성씨", order: null, suffix: "씨", fun: true },
];

const TITLES = {
  bloc: "지역이 갈랐다",
  capital: "수도권 vs 지방",
  wealth: "재산이 갈랐다",
  wealthTop: "최상위 재산가의 선택",
  gen: "세대가 갈랐다",
  terms: "선수(選數)가 갈랐다",
  sex: "성별이 갈랐다",
  elect: "지역구 vs 비례",
  zodiac: "띠의 비밀",
  surname: "성씨의 비밀",
  absent: "불참의 무게",
  boycott: "집단 불참",
  split: "당내 균열",
  sweep: "전원 일치 그룹",
};

const pct = (x) => Math.round(x * 100);
const fmt억 = (v) => (v >= 100 ? `${Math.round(v)}억` : `${Math.round(v * 10) / 10}억`);
// 받침 유무로 은/는 선택 ("의원" → 은, "비례대표" → 는)
const eunNeun = (w) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? "은" : "는";
};

// ── 의안별 팩트 생성 ──────────────────────────────────────────────
const byBill = {};
const allFacts = []; // topPicks 후보 { billIdx, fact }

for (let bi = 0; bi < vd.bills.length; bi++) {
  const bill = vd.bills[bi];
  // 이 의안의 의원별 코드 (무기록 제외)
  const votes = []; // { profile, code }
  for (const p of profiles) {
    const code = vd.matrix[p.id]?.[bi];
    if (code && code !== "-") votes.push({ p, code });
  }
  if (votes.length < 50) continue;

  const attendees = votes.filter((v) => v.code !== "A");
  const overallRate = attendees.length ? attendees.filter((v) => v.code === "Y").length / attendees.length : 0;
  const contested = overallRate >= 0.2 && overallRate <= 0.8;
  const facts = [];

  // 1) 그룹 차원 팩트
  for (const D of DIMS) {
    const groups = {}; // label -> {Y,N,B,A}
    for (const { p, code } of votes) {
      const g = p[D.key];
      if (g == null) continue;
      (groups[g] = groups[g] || { Y: 0, N: 0, B: 0, A: 0 })[code]++;
    }
    const minN = D.fun ? 8 : 10;
    const stats = Object.entries(groups)
      .map(([label, t]) => {
        const att = t.Y + t.N + t.B;
        return { label, ...t, att, rate: att ? t.Y / att : 0 };
      })
      .filter((g) => g.att >= minN);
    if (stats.length < 2) continue;

    const hi = stats.reduce((a, b) => (b.rate > a.rate ? b : a));
    const lo = stats.reduce((a, b) => (b.rate < a.rate ? b : a));
    const gap = hi.rate - lo.rate;

    // 전원 일치 팩트 (fun 차원 위주의 강한 패턴) — 논쟁적 의안에서만 의미
    const sweep = D.fun && contested ? stats.find((g) => g.att >= 8 && (g.rate === 1 || g.rate === 0)) : null;

    const minGap = D.fun ? 0.3 : 0.2;
    if (gap < minGap && !sweep) continue;

    const small = Math.min(hi.att, lo.att);
    let score = gap * Math.sqrt(small) * (D.fun ? 0.6 : 1);
    let text;
    const gLabel = (g) => `${g.label}${D.suffix}`;

    if (sweep) {
      const verb = sweep.rate === 1 ? "전원 찬성" : "전원 반대·기권";
      text = `${gLabel(sweep)} ${sweep.att}명 ${verb}했습니다. 전체 찬성률은 ${pct(overallRate)}%였습니다.`;
      score = Math.max(score, 0.9 * Math.sqrt(sweep.att));
    } else {
      const loL = gLabel(lo);
      text = `${gLabel(hi)}의 찬성률은 ${pct(hi.rate)}%, ${loL}${eunNeun(loL)} ${pct(lo.rate)}%에 그쳤습니다.`;
    }

    // 정당 통제: 거대 정당 내부에서도 같은 방향 격차가 유지되는지
    if (D.partyControl && !sweep) {
      const bigParties = {};
      for (const { p, code } of votes) {
        if (code === "A" || p[D.key] == null) continue;
        (bigParties[p.party] = bigParties[p.party] || []).push({ g: p[D.key], code });
      }
      for (const [party, rows] of Object.entries(bigParties)) {
        if (rows.length < 40) continue;
        const agg = {};
        for (const r of rows) {
          (agg[r.g] = agg[r.g] || { y: 0, n: 0 }).n++;
          if (r.code === "Y") agg[r.g].y++;
        }
        const hiIn = agg[hi.label];
        const loIn = agg[lo.label];
        if (!hiIn || !loIn || hiIn.n < 8 || loIn.n < 8) continue;
        const inGap = hiIn.y / hiIn.n - loIn.y / loIn.n;
        if (inGap >= 0.15) {
          text += ` 같은 ${party} 안에서도 ${pct(inGap)}%p 차이가 났습니다.`;
          score *= 1.3;
          break;
        }
      }
    }

    facts.push({
      dim: D.dim,
      title: TITLES[D.dim],
      text,
      fun: D.fun || undefined,
      score: Math.round(score * 100) / 100,
      groups: stats
        .sort((a, b) => (D.order ? D.order.indexOf(a.label) - D.order.indexOf(b.label) : b.att - a.att))
        .map((g) => ({ label: gLabel(g), yes: g.Y, no: g.N, blank: g.B, absent: g.A, rate: pct(g.rate) })),
    });
  }

  // 2) 정당 집단 불참 감지 (의원 10+ 정당이 80%+ 불참) — 불참 프로필보다 먼저.
  //    보이콧 정당 의원은 불참 프로필에서 제외해야 "불참자 재산 N배" 같은
  //    팩트가 보이콧의 그림자 효과(정당별 재산 차이)를 재탕하지 않는다.
  const partyVotes = {};
  for (const { p, code } of votes) (partyVotes[p.party] = partyVotes[p.party] || []).push(code);
  const boycottParties = new Set();
  for (const [party, codes] of Object.entries(partyVotes)) {
    if (codes.length < 10) continue;
    const abs = codes.filter((c) => c === "A").length;
    if (abs / codes.length >= 0.8) {
      boycottParties.add(party);
      facts.push({
        dim: "boycott",
        title: TITLES.boycott,
        text: `${party} 의원 ${codes.length}명 중 ${abs}명(${pct(abs / codes.length)}%)이 표결에 불참했습니다.`,
        score: Math.round(Math.sqrt(abs) * 90) / 100,
      });
    }
  }

  // 3) 불참 프로필 (보이콧 정당 제외)
  const absent = votes.filter((v) => v.code === "A" && !boycottParties.has(v.p.party));
  if (absent.length >= 15 && attendees.length >= 30) {
    const avg = (arr, f) => {
      const xs = arr.map(f).filter((x) => x != null);
      return xs.length >= 10 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const wAbs = avg(absent, (v) => v.p.wealth);
    const wAtt = avg(attendees, (v) => v.p.wealth);
    if (wAbs != null && wAtt != null && (wAbs >= wAtt * 1.8 || wAbs <= wAtt * 0.55)) {
      const ratio = Math.round((wAbs / wAtt) * 10) / 10;
      facts.push({
        dim: "absent",
        title: TITLES.absent,
        text: `불참 의원 ${absent.length}명의 평균 재산(${fmt억(wAbs)})은 출석 의원(${fmt억(wAtt)})의 ${ratio}배입니다.`,
        score: Math.round(Math.abs(Math.log2(ratio)) * Math.sqrt(absent.length) * 60) / 100,
      });
    }
    const aAbs = avg(absent, (v) => v.p.age);
    const aAtt = avg(attendees, (v) => v.p.age);
    if (aAbs != null && aAtt != null && Math.abs(aAbs - aAtt) >= 4) {
      const diff = Math.round(Math.abs(aAbs - aAtt) * 10) / 10;
      facts.push({
        dim: "absent",
        title: TITLES.absent,
        text: `불참 의원의 평균 나이(${Math.round(aAbs)}세)가 출석 의원(${Math.round(aAtt)}세)보다 ${diff}살 ${aAbs > aAtt ? "많습니다" : "적습니다"}.`,
        score: Math.round((diff / 10) * Math.sqrt(absent.length) * 70) / 100,
      });
    }
  }

  // 4) 당내 균열 (정당 출석 20+ 중 소수파 20%+) — 소수파 실명 노출
  for (const [party, codes] of Object.entries(partyVotes)) {
    void codes;
    const rows = votes.filter((v) => v.p.party === party && v.code !== "A");
    if (rows.length < 20) continue;
    const y = rows.filter((v) => v.code === "Y").length;
    const minorityIsYes = y < rows.length / 2;
    const minority = rows.filter((v) => (minorityIsYes ? v.code === "Y" : v.code !== "Y"));
    const share = minority.length / rows.length;
    if (share < 0.2 || share > 0.5 || minority.length < 5) continue;
    const names = minority.slice(0, 3).map((v) => v.p.name).join("·");
    const more = minority.length > 3 ? ` 등 ${minority.length}명` : "";
    facts.push({
      dim: "split",
      title: TITLES.split,
      text: `${party}이 갈렸습니다. ${rows.length}명 중 ${minority.length}명(${pct(share)}%)이 ${minorityIsYes ? "찬성" : "반대·기권"}으로 당내 다수와 다른 표를 던졌습니다 — ${names}${more}.`,
      score: Math.round(share * Math.sqrt(minority.length) * 140) / 100,
      rebels: minority.slice(0, 6).map((v) => ({ id: v.p.id, name: v.p.name, party })),
    });
  }

  facts.sort((a, b) => b.score - a.score);
  // 의안당 상위 4개 — 단, fun(띠·성씨) 팩트가 있으면 1개는 보장해서 재미를 잃지 않는다
  let top = facts.slice(0, 4);
  const bestFun = facts.find((f) => f.fun);
  if (bestFun && !top.includes(bestFun)) top = [...top.slice(0, 3), bestFun];
  if (top.length) {
    byBill[bill.id] = top;
    for (const f of top) allFacts.push({ bi, fact: f });
  }
}

// ── 전역 톱픽 (의안당 1개 · 차원당 최대 3개) ──────────────────────
allFacts.sort((a, b) => b.fact.score - a.fact.score);
const seenBill = new Set();
const dimCount = {};
// 불참·보이콧은 의안마다 반복되는 패턴이라 톱픽에선 1개씩만, 나머지는 2개까지
const DIM_CAP = { absent: 1, boycott: 1 };
const topPicks = [];
for (const { bi, fact } of allFacts) {
  const bill = vd.bills[bi];
  if (seenBill.has(bill.id)) continue;
  if ((dimCount[fact.dim] ?? 0) >= (DIM_CAP[fact.dim] ?? 2)) continue;
  seenBill.add(bill.id);
  dimCount[fact.dim] = (dimCount[fact.dim] ?? 0) + 1;
  topPicks.push({
    billId: bill.id,
    billNo: bill.no,
    billName: bill.name,
    date: bill.date,
    y: bill.y,
    n: bill.n,
    b: bill.b,
    fact,
  });
  if (topPicks.length >= 12) break;
}

const out = { generatedAt: null, billCount: vd.bills.length, analyzed: Object.keys(byBill).length, byBill, topPicks };
writeFileSync(A("vote-analysis.json"), JSON.stringify(out));

const dimTally = {};
for (const fs of Object.values(byBill)) for (const f of fs) dimTally[f.dim] = (dimTally[f.dim] ?? 0) + 1;
console.log(
  `[gen-vote-analysis] 의안 ${vd.bills.length}건 중 ${Object.keys(byBill).length}건에서 팩트 발견 · 톱픽 ${topPicks.length} · 차원별:`,
  JSON.stringify(dimTally),
);
