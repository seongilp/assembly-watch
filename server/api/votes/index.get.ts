import type { H3Event } from "h3";
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
/**
 * 요청 파라미터 정규화 — 핸들러와 캐시 키가 반드시 같은 로직을 공유한다.
 * 원본 쿼리를 키에 그대로 쓰면 q/page 조합 하나하나가 KV 엔트리를 무한 생성한다.
 */
function voteListParams(event: H3Event) {
  const query = getQuery(event);
  return {
    q: String(query.q ?? "").trim().slice(0, 80),
    votedOnly: String(query.votedOnly ?? "") === "1",
    dissent: String(query.dissent ?? "") === "1",
    page: Math.min(100_000, Math.max(1, Number(query.page) || 1)),
    size: Math.min(100, Math.max(1, Number(query.size) || 20)),
  };
}

export default defineCachedEventHandler(
  async (event): Promise<Paged<VoteSummary>> => {
    const { q, votedOnly, dissent, page, size } = voteListParams(event);

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
      const p = voteListParams(event);
      return `${p.page}:${p.size}:${p.votedOnly ? "1" : ""}:${p.dissent ? "1" : ""}:${p.q}`;
    },
  },
);
