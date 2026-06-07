import type { VoteSummary, Paged } from "#shared/types";

/**
 * 본회의 표결 목록 (의안별 요약)
 *  ?page=1&size=20
 *  ?votedOnly=1  → 실제 표결 집계가 있는 안건만
 *  ?dissent=1    → 반대표가 1표 이상인 안건만 (쟁점 표결)
 *  ?q=검색어     → 의안명·발의자·위원회로 필터
 *
 *  검색/반대필터 시에는 최근 300건 범위에서 조회 후 필터링.
 */
export default defineCachedEventHandler(
  async (event): Promise<Paged<VoteSummary>> => {
    const query = getQuery(event);
    const q = String(query.q ?? "").trim();
    const votedOnly = String(query.votedOnly ?? "") === "1";
    const dissent = String(query.dissent ?? "") === "1";
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(query.size) || 20));

    // 검색 또는 반대필터: 넓은 범위를 받아 필터링한 결과를 그대로 반환
    if (q || dissent) {
      const res = await fetchAssembly(API.VOTES_PLENARY, {
        pIndex: 1,
        pSize: 300,
        AGE,
      });
      let rows = res.rows.map(mapVoteSummary);
      if (votedOnly) rows = rows.filter((v) => v.total != null);
      if (dissent) rows = rows.filter((v) => (v.no ?? 0) > 0);
      if (q)
        rows = rows.filter(
          (v) =>
            v.billName.includes(q) ||
            v.proposer.includes(q) ||
            v.committee.includes(q),
        );
      return { rows, totalCount: rows.length, page: 1, size: rows.length };
    }

    const res = await fetchAssembly(API.VOTES_PLENARY, {
      pIndex: page,
      pSize: size,
      AGE,
    });
    let rows = res.rows.map(mapVoteSummary);
    if (votedOnly) rows = rows.filter((v) => v.total != null);
    return { rows, totalCount: res.totalCount, page, size };
  },
  {
    maxAge: 60 * 10,
    name: "votes",
    getKey: (event) => {
      const q = getQuery(event);
      return `${q.page ?? 1}:${q.size ?? 20}:${q.votedOnly ?? ""}:${q.dissent ?? ""}:${q.q ?? ""}`;
    },
  },
);
