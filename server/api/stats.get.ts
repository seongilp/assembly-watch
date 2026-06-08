import stats from "../assets/stats.json";

/** 대시보드 핵심 통계 — 베이크된 스냅샷(빌드 시점, 라이브 API 없음) */
export default defineCachedEventHandler(async () => stats, {
  maxAge: 60 * 30,
  name: "stats",
  getKey: () => "all",
});
