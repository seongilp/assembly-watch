/** 정당별 브랜드 컬러 + 헬퍼 */

interface PartyStyle {
  color: string;
  short: string;
}

const PARTY_MAP: Record<string, PartyStyle> = {
  더불어민주당: { color: "#152484", short: "민주" },
  국민의힘: { color: "#E61E2B", short: "국힘" },
  조국혁신당: { color: "#0073CF", short: "조국" },
  개혁신당: { color: "#FF7210", short: "개혁" },
  진보당: { color: "#D6001C", short: "진보" },
  기본소득당: { color: "#00B5A5", short: "기본" },
  사회민주당: { color: "#F58220", short: "사민" },
  "기후민생당": { color: "#1DA64A", short: "기후" },
  무소속: { color: "#6B7684", short: "무소속" },
};

const FALLBACK_COLORS = [
  "#3182F6",
  "#7C3AED",
  "#0EA5E9",
  "#14B8A6",
  "#F59E0B",
  "#EC4899",
];

/** 다크모드 전용 밝은 톤 (어두운 정당색 가독성 보정) */
const PARTY_DARK: Record<string, string> = {
  더불어민주당: "#5B7BF0",
  무소속: "#9AA3AE",
  진보당: "#FF4D63",
};

/** 다크 여부에 따른 정당색 */
export function partyColorMode(party: string, dark: boolean): string {
  if (dark) {
    const key = (party || "").split("/")[0]?.trim() ?? "";
    if (PARTY_DARK[key]) return PARTY_DARK[key];
  }
  return partyColor(party);
}

export function partyColor(party: string): string {
  const key = (party || "").split("/")[0]?.trim() ?? "";
  if (PARTY_MAP[key]) return PARTY_MAP[key].color;
  if (!key) return "#B0B8C1";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]!;
}

export function partyShort(party: string): string {
  const key = (party || "").split("/")[0]?.trim() ?? "";
  return PARTY_MAP[key]?.short ?? (key.slice(0, 2) || "—");
}

/** 정당명 정규화 (앞부분만) */
export function normalizeParty(party: string): string {
  return (party || "").split("/")[0]?.trim() || "무소속";
}
