/** XSS 방어 헬퍼 — innerHTML 템플릿/외부 URL 바인딩용 */

/** HTML 엔티티 이스케이프(& < > " ') — attribute·텍스트 노드 모두 안전 */
export function esc(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** http(s) 절대 URL 만 통과(트림). javascript:, data: 등은 undefined — Vue 가 속성을 드롭 */
export function safeUrl(u: string | null | undefined): string | undefined {
  const t = (u ?? "").trim();
  return /^https?:\/\//i.test(t) ? t : undefined;
}
