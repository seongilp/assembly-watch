import type { Bill, Paged } from "#shared/types";

/**
 * 의안 목록
 *  ?type=pending|processed (기본 pending)
 *  ?page=1&size=20
 *  ?q=검색어 (의안명 부분일치, 해당 페이지 내)
 */
export default defineCachedEventHandler(
  async (event): Promise<Paged<Bill>> => {
    const query = getQuery(event);
    const type = query.type === "processed" ? "processed" : "pending";
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(query.size) || 20));

    const isProcessed = type === "processed";
    const res = await fetchAssembly(
      isProcessed ? API.BILLS_PROCESSED : API.BILLS_PENDING,
      isProcessed
        ? { pIndex: page, pSize: size, AGE }
        : { pIndex: page, pSize: size },
    );

    let rows = res.rows.map(isProcessed ? mapProcessedBill : mapPendingBill);
    const q = String(query.q ?? "").trim();
    if (q) rows = rows.filter((b) => b.name.includes(q) || b.proposer.includes(q));

    return { rows, totalCount: res.totalCount, page, size };
  },
  {
    maxAge: 60 * 10,
    name: "bills",
    getKey: (event) => {
      const q = getQuery(event);
      return `${q.type ?? "pending"}:${q.page ?? 1}:${q.size ?? 20}:${q.q ?? ""}`;
    },
  },
);
