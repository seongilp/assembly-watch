import type { VoteRecord } from "#shared/types";

/** 표결 명단 그룹 보기 차원 (재산/나이/성씨/별자리/거주지/선수/글자수) */
export type GroupDim = "wealth" | "age" | "surname" | "starsign" | "home" | "terms" | "namelen";

const UNKNOWN = "정보 없음";

// ── 재산 구간 (신고가액 억원) ──
const WEALTH_BANDS = ["100억 이상", "50~100억", "30~50억", "20~30억", "10~20억", "10억 미만"] as const;
function wealthBand(w: number | null | undefined): string {
  if (w == null) return UNKNOWN;
  if (w >= 100) return "100억 이상";
  if (w >= 50) return "50~100억";
  if (w >= 30) return "30~50억";
  if (w >= 20) return "20~30억";
  if (w >= 10) return "10~20억";
  return "10억 미만";
}

// ── 나이대 ──
const AGE_BANDS = ["40대 이하", "50대", "60대", "70대 이상"] as const;
function ageBand(birth: string | undefined, nowYear: number): string {
  const y = Number(String(birth ?? "").slice(0, 4));
  if (!y) return UNKNOWN;
  const age = nowYear - y;
  if (age < 50) return "40대 이하";
  if (age < 60) return "50대";
  if (age < 70) return "60대";
  return "70대 이상";
}

// ── 성씨 (복성 처리) ──
const DOUBLE_SURNAMES = ["남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방"];
export function surnameOf(name: string): string {
  const n = String(name || "").trim();
  for (const d of DOUBLE_SURNAMES) if (n.startsWith(d)) return d;
  return n.slice(0, 1) || UNKNOWN;
}

// ── 별자리 (gen-graph-data.mjs 와 동일 경계) ──
const SIGNS = [
  { sign: "물병자리", emoji: "♒", from: [1, 20], to: [2, 18] },
  { sign: "물고기자리", emoji: "♓", from: [2, 19], to: [3, 20] },
  { sign: "양자리", emoji: "♈", from: [3, 21], to: [4, 19] },
  { sign: "황소자리", emoji: "♉", from: [4, 20], to: [5, 20] },
  { sign: "쌍둥이자리", emoji: "♊", from: [5, 21], to: [6, 21] },
  { sign: "게자리", emoji: "♋", from: [6, 22], to: [7, 22] },
  { sign: "사자자리", emoji: "♌", from: [7, 23], to: [8, 22] },
  { sign: "처녀자리", emoji: "♍", from: [8, 23], to: [9, 23] },
  { sign: "천칭자리", emoji: "♎", from: [9, 24], to: [10, 22] },
  { sign: "전갈자리", emoji: "♏", from: [10, 23], to: [11, 22] },
  { sign: "사수자리", emoji: "♐", from: [11, 23], to: [12, 24] },
  { sign: "염소자리", emoji: "♑", from: [12, 25], to: [1, 19] },
] as const;
function starsignOf(birth: string | undefined): string {
  const m = String(birth ?? "").match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return UNKNOWN;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  for (const s of SIGNS) {
    const [fm, fd] = s.from;
    const [tm, td] = s.to;
    const hit =
      fm <= tm
        ? (mo === fm && d >= fd) || (mo === tm && d <= td) || (mo > fm && mo < tm)
        : (mo === fm && d >= fd) || (mo === tm && d <= td) || mo > fm || mo < tm;
    if (hit) return `${s.emoji} ${s.sign}`;
  }
  return UNKNOWN;
}

// ── 선수(당선 횟수) — "초선"/"재선"/"3선"… 그대로, 5선 이상은 묶음 ──
function termsBand(terms: string | undefined): string {
  const t = String(terms ?? "").trim();
  if (!t) return UNKNOWN;
  if (t.includes("초선")) return "초선";
  if (t.includes("재선")) return "재선";
  const n = Number(t.match(/(\d+)선/)?.[1]);
  if (!n) return UNKNOWN;
  return n >= 5 ? "5선 이상" : `${n}선`;
}
function termsRank(label: string): number {
  if (label === "초선") return 1;
  if (label === "재선") return 2;
  if (label === "5선 이상") return 5;
  return Number(label.match(/^(\d+)선/)?.[1]) || 99;
}

/** 레코드 → 그룹 라벨 */
export function groupLabelOf(r: VoteRecord, dim: GroupDim, nowYear: number): string {
  if (dim === "wealth") return wealthBand(r.wealth);
  if (dim === "age") return ageBand(r.birth, nowYear);
  if (dim === "surname") return `${surnameOf(r.name)}씨`;
  if (dim === "starsign") return starsignOf(r.birth);
  if (dim === "terms") return termsBand(r.terms);
  if (dim === "namelen") return `이름 ${String(r.name ?? "").trim().length}글자`;
  // home: "서울 강남구" → 구 단위 그대로 (강남구 시나리오용). 미신고는 정보 없음.
  return r.home || UNKNOWN;
}

/** 그룹 정렬 순서 — 고정 순서 차원은 그 순서, 나머지는 인원수 내림차순. 정보 없음은 항상 마지막 */
export function groupRank(label: string, dim: GroupDim): number {
  if (label === UNKNOWN) return 9999;
  if (dim === "wealth") return WEALTH_BANDS.indexOf(label as (typeof WEALTH_BANDS)[number]);
  if (dim === "age") return AGE_BANDS.indexOf(label as (typeof AGE_BANDS)[number]);
  if (dim === "starsign") return SIGNS.findIndex((s) => label.includes(s.sign));
  if (dim === "terms") return termsRank(label);
  if (dim === "namelen") return Number(label.match(/(\d+)글자/)?.[1]) || 99;
  return -1; // surname/home: 인원수순(컴포넌트에서 처리)
}

export const GROUP_UNKNOWN = UNKNOWN;
