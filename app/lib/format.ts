/** 날짜/숫자/표결 포맷 헬퍼 */

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

/** "YYYYMMDD" 또는 "YYYY-MM-DD" → "YYYY.MM.DD" */
export function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (d.length < 8) return raw;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

/** "YYYYMMDD HHMMSS" → "YYYY.MM.DD HH:MM" */
export function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const m = raw.match(/(\d{4})(\d{2})(\d{2})\s*(\d{2})?(\d{2})?/);
  if (!m) return formatDate(raw);
  const [, y, mo, da, h, mi] = m;
  const base = `${y}.${mo}.${da}`;
  return h && mi ? `${base} ${h}:${mi}` : base;
}

export function relativeDay(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (d.length < 8) return "";
  const date = new Date(
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00`,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff > 1) return `D-${diff}`;
  return `${-diff}일 전`;
}

/** 표결 결과 → 색상/배경 */
export function voteStyle(result: string): { fg: string; bg: string } {
  if (result.includes("찬성")) return { fg: "#1B64DA", bg: "#E8F3FF" };
  if (result.includes("반대")) return { fg: "#D63A45", bg: "#FDECEE" };
  if (result.includes("기권")) return { fg: "#8B5A00", bg: "#FFF4E0" };
  return { fg: "#6B7684", bg: "#F2F4F6" }; // 불참/기타
}

/** 의안 처리결과 → 색상/배경 */
export function procStyle(result: string): { fg: string; bg: string } {
  if (!result) return { fg: "#6B7684", bg: "#F2F4F6" };
  if (result.includes("가결") || result.includes("통과") || result.includes("원안"))
    return { fg: "#00857A", bg: "#E3F7F2" };
  if (result.includes("부결") || result.includes("폐기"))
    return { fg: "#D63A45", bg: "#FDECEE" };
  if (result.includes("철회") || result.includes("반려"))
    return { fg: "#8B95A1", bg: "#F2F4F6" };
  if (result.includes("대안"))
    return { fg: "#7C3AED", bg: "#F3ECFE" };
  return { fg: "#1B64DA", bg: "#E8F3FF" };
}

/** 발의자 문자열에서 대표발의자 이름만 추출: "홍길동의원 등 10인" → "홍길동" */
export function leadProposer(proposer: string): string {
  if (!proposer) return "";
  const m = proposer.match(/^([가-힣]{2,4})/);
  return m ? m[1]! : proposer.split(" ")[0] ?? proposer;
}
