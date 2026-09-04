import type { VoteSummary, Paged } from "#shared/types";
import votesList from "../../assets/votes-list.json";

/**
 * 열린국회 API는 procDt 정렬을 보장하지 않는다 — 스냅샷을 최신순으로 한 번 정렬해 둔다.
 * (동일 일자는 의안번호 내림차순 = 사실상 최신 접수순)
 */
const ALL = [...(votesList as VoteSummary[])].sort(
  (a, b) =>
    (b.procDt ?? "").localeCompare(a.procDt ?? "") ||
    (b.billNo ?? "").localeCompare(a.billNo ?? ""),
);

/**
 * 본회의 표결 목록 — 베이크된 스냅샷(전체 의안)에서 서빙. 라이브 API 없음.
 *  ?page=&size=  페이지네이션 / ?votedOnly=1 집계있는것 / ?dissent=1 반대표있는것 / ?q= 검색
 */
export default defineCachedEventHandler(
  async (event): Promise<Paged<VoteSummary>> => {
    const query = getQuery(event);
    const q = String(query.q ?? "").trim();
    const votedOnly = String(query.votedOnly ?? "") === "1";
    const dissent = String(query.dissent ?? "") === "1";
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(query.size) || 20));

    let rows = ALL;
    // 철회/폐기 안건은 total 이 0 으로 내려온다 — null 체크만으론 걸러지지 않는다.
    if (votedOnly) rows = rows.filter((v) => (v.total ?? 0) > 0);
    if (dissent) rows = rows.filter((v) => (v.no ?? 0) > 0);
    if (q)
      rows = rows.filter(
        (v) =>
          v.billName.includes(q) ||
          v.proposer.includes(q) ||
          v.committee.includes(q),
      );

    // 검색/반대필터는 전체 결과 반환, 그 외엔 페이지네이션
    if (q || dissent) {
      return { rows, totalCount: rows.length, page: 1, size: rows.length };
    }
    const start = (page - 1) * size;
    return { rows: rows.slice(start, start + size), totalCount: rows.length, page, size };
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
