import type { H3Event } from "h3";
import type { Bill, Paged } from "#shared/types";

/**
 * 의안 목록
 *  ?type=pending|processed (기본 pending)
 *  ?page=1&size=20
 *  ?q=검색어 (의안명 부분일치, 해당 페이지 내)
 */
/**
 * 요청 파라미터 정규화 — 핸들러와 캐시 키가 반드시 같은 로직을 공유한다.
 * 원본 쿼리를 키에 그대로 쓰면 q/page 조합 하나하나가 KV 엔트리를 무한 생성한다.
 */
function listParams(event: H3Event) {
  const query = getQuery(event);
  return {
    type: query.type === "processed" ? "processed" : "pending",
    page: Math.min(100_000, Math.max(1, Number(query.page) || 1)),
    size: Math.min(100, Math.max(1, Number(query.size) || 20)),
    q: String(query.q ?? "").trim().slice(0, 80),
  };
}

export default defineCachedEventHandler(
  async (event): Promise<Paged<Bill>> => {
    const { type, page, size, q } = listParams(event);

    const isProcessed = type === "processed";
    const res = await fetchAssembly(
      isProcessed ? API.BILLS_PROCESSED : API.BILLS_PENDING,
      isProcessed
        ? { pIndex: page, pSize: size, AGE }
        : { pIndex: page, pSize: size },
    );

    let rows = res.rows.map(isProcessed ? mapProcessedBill : mapPendingBill);
    if (q) rows = rows.filter((b) => b.name.includes(q) || b.proposer.includes(q));

    return { rows, totalCount: res.totalCount, page, size };
  },
  {
    maxAge: 60 * 10,
    name: "bills",
    getKey: (event) => {
      const p = listParams(event);
      return `${p.type}:${p.page}:${p.size}:${p.q}`;
    },
  },
);
