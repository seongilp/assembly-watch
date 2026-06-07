import type { Bill, MemberVote, MemberDetail } from "#shared/types";
import type { RollCallResponse } from "../votes/[billId].get";

/**
 * 의원 상세 통합: 인적사항 + 대표발의 법안 + 최근 본회의 표결 이력
 * 서버에서 한 번에 조립 → 클라이언트 하이드레이션 불일치 방지.
 * GET /api/members/:id   (id = MONA_CD)
 */
export default defineCachedEventHandler(
  async (event): Promise<MemberDetail> => {
    const id = getRouterParam(event, "id");
    const empty: MemberDetail = {
      member: null,
      bills: [],
      votes: [],
      votesScanned: 0,
    };
    if (!id) return empty;

    // 1) 의원 찾기 + 사진 보강
    const mRes = await fetchAssembly(API.MEMBERS, { pSize: 350 });
    const member = mRes.rows.map(mapMember).find((m) => m.id === id);
    if (!member) return empty;
    const photos = await $fetch<Record<string, string>>(
      "/api/member-photos",
    ).catch(() => ({}));
    member.photo = photos[member.id] ?? "";

    // 2) 대표발의 법안 + 최근 표결 이력 병렬 조립
    const [bills, votes] = await Promise.all([
      loadBills(member.name),
      loadVotes(member.name),
    ]);

    return {
      member,
      bills,
      votes: votes.rows,
      votesScanned: votes.scanned,
    };
  },
  {
    maxAge: 60 * 30,
    name: "member-detail",
    getKey: (event) => getRouterParam(event, "id") ?? "none",
  },
);

/** 대표발의 법안 (이름 기준 매칭) */
async function loadBills(name: string): Promise<Bill[]> {
  const res = await fetchAssembly(API.BILLS_PROPOSED, {
    AGE,
    pIndex: 1,
    pSize: 1000,
  });
  return res.rows.map(mapProposedBill).filter((b) => b.proposer.startsWith(name));
}

/** 최근 본회의 표결 이력 — 표결 명단(KV 캐시 공유)에서 본인 표결 추출 */
async function loadVotes(
  name: string,
): Promise<{ rows: MemberVote[]; scanned: number }> {
  const list = await fetchAssembly(API.VOTES_PLENARY, { AGE, pSize: 60 });
  const bills = list.rows
    .map(mapVoteSummary)
    .filter((v) => v.total != null)
    .slice(0, 15);

  const results = await Promise.all(
    bills.map(async (b): Promise<MemberVote | null> => {
      try {
        const rc = await $fetch<RollCallResponse>(`/api/votes/${b.billId}`);
        const rec = rc.rows.find((r) => r.name === name);
        if (!rec) return null;
        return {
          billId: b.billId,
          billName: b.billName,
          date: b.procDt,
          result: rec.result,
          procResult: b.procResult,
        };
      } catch {
        return null;
      }
    }),
  );

  return {
    rows: results.filter((r): r is MemberVote => r !== null),
    scanned: bills.length,
  };
}
