import type { Bill } from "#shared/types";

/**
 * 특정 의원의 대표발의 법률안 (이름 기준 매칭)
 * GET /api/member-bills?name=홍길동
 * 발의법률안 목록을 최신순으로 가져와 PROPOSER 가 해당 이름으로 시작하는 건만 필터.
 */
export default defineCachedEventHandler(
  async (event): Promise<{ rows: Bill[]; matched: number }> => {
    const name = String(getQuery(event).name ?? "").trim();
    if (!name) return { rows: [], matched: 0 };

    const res = await fetchAssembly(API.BILLS_PROPOSED, {
      AGE,
      pIndex: 1,
      pSize: 1000,
    });
    const rows = res.rows
      .map(mapProposedBill)
      .filter((b) => b.proposer.startsWith(name));
    return { rows, matched: rows.length };
  },
  {
    maxAge: 60 * 60,
    name: "member-bills",
    getKey: (event) => String(getQuery(event).name ?? ""),
  },
);
