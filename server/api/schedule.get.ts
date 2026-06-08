import type { ScheduleItem } from "#shared/types";
import schedule from "../assets/schedule.json";

const ROWS = (schedule as ScheduleItem[]).filter((r) => r.date);

/**
 * 국회 일정 — 베이크된 스냅샷(최근 300건)에서 서빙. 라이브 API 없음.
 *  ?upcoming=1 → 오늘 이후만 날짜순, 그 외 최신순
 */
export default defineCachedEventHandler(
  async (event): Promise<{ rows: ScheduleItem[]; totalCount: number }> => {
    const query = getQuery(event);
    const size = Math.min(300, Math.max(1, Number(query.size) || 100));
    let rows: ScheduleItem[];
    if (String(query.upcoming ?? "") === "1") {
      const today = new Date().toISOString().slice(0, 10);
      rows = ROWS.filter((r) => r.date >= today).sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time),
      );
    } else {
      rows = [...ROWS].sort((a, b) => b.date.localeCompare(a.date));
    }
    return { rows: rows.slice(0, size), totalCount: ROWS.length };
  },
  {
    maxAge: 60 * 30,
    name: "schedule",
    getKey: (event) => {
      const q = getQuery(event);
      return `${q.upcoming ?? ""}:${q.size ?? 100}`;
    },
  },
);
