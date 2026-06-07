import type { VoteRecord } from "#shared/types";

interface RollCallBill {
  billId: string;
  billNo: string;
  billName: string;
  lawTitle: string;
  committee: string;
  procResult: string;
  date: string;
}

export interface RollCallResponse {
  bill: RollCallBill | null;
  rows: VoteRecord[];
  totalCount: number;
  tally: { 찬성: number; 반대: number; 기권: number; 불참: number };
}

const s = (v: unknown) => (v == null ? "" : String(v).trim());

/**
 * 특정 의안의 의원별 표결 명단 + 집계 + 의안 메타
 * GET /api/votes/:billId
 */
export default defineCachedEventHandler(
  async (event): Promise<RollCallResponse> => {
    const billId = getRouterParam(event, "billId");
    if (!billId) {
      throw createError({ statusCode: 400, statusMessage: "billId 필요" });
    }
    const res = await fetchAssembly(API.VOTES_ROLLCALL, {
      AGE,
      BILL_ID: billId,
      pIndex: 1,
      pSize: 320,
    });
    const rows = res.rows.map(mapVoteRecord);

    const tally = { 찬성: 0, 반대: 0, 기권: 0, 불참: 0 };
    for (const r of rows) {
      if (r.result.includes("찬성")) tally.찬성++;
      else if (r.result.includes("반대")) tally.반대++;
      else if (r.result.includes("기권")) tally.기권++;
      else tally.불참++;
    }

    const first = res.rows[0] as Record<string, unknown> | undefined;
    const bill: RollCallBill | null = first
      ? {
          billId,
          billNo: s(first.BILL_NO),
          billName: s(first.BILL_NAME),
          lawTitle: s(first.LAW_TITLE),
          committee: s(first.CURR_COMMITTEE),
          procResult: s(first.PROC_RESULT_CD),
          date: s(first.VOTE_DATE),
        }
      : null;

    return { bill, rows, totalCount: res.totalCount, tally };
  },
  {
    maxAge: 60 * 60,
    name: "vote-rollcall",
    getKey: (event) => getRouterParam(event, "billId") ?? "none",
  },
);
