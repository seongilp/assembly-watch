/** UTC Date → KST(UTC+9) 기준 YYYY-MM-DD. CF 바인딩 의존성 없음(테스트 가능). */
export function todayKST(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
