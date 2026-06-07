import type { ScheduleItem } from "#shared/types";

/**
 * 국회 일정
 *  ?upcoming=1 → 오늘 이후 일정만, 날짜순 정렬
 *  ?size=  (기본 100)
 */
export default defineCachedEventHandler(
  async (event): Promise<{ rows: ScheduleItem[]; totalCount: number }> => {
    const query = getQuery(event);
    const size = Math.min(300, Math.max(1, Number(query.size) || 100));
    const res = await fetchAssembly(API.SCHEDULE, { pIndex: 1, pSize: size });
    let rows = res.rows.map(mapSchedule).filter((r) => r.date);

    if (String(query.upcoming ?? "") === "1") {
      const today = new Date().toISOString().slice(0, 10);
      rows = rows
        .filter((r) => r.date >= today)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    } else {
      rows = rows.sort((a, b) => b.date.localeCompare(a.date));
    }
    return { rows, totalCount: res.totalCount };
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
