import type { VoteRecord } from "#shared/types";
import photos from "../../assets/member-photos.json";

const PHOTOS = photos as Record<string, string>;

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
    const [res, mRes] = await Promise.all([
      fetchAssembly(API.VOTES_ROLLCALL, {
        AGE,
        BILL_ID: billId,
        pIndex: 1,
        pSize: 320,
      }),
      fetchAssembly(API.MEMBERS, { pSize: 350 }),
    ]);
    // 이름 → (id, 사진) 매핑 (현직 의원 기준)
    const nameToPhoto: Record<string, string> = {};
    const nameToId: Record<string, string> = {};
    for (const m of mRes.rows.map(mapMember)) {
      nameToId[m.name] = m.id;
      const pic = PHOTOS[m.id];
      if (pic) nameToPhoto[m.name] = pic;
    }
    const rows = res.rows.map(mapVoteRecord).map((r) => ({
      ...r,
      id: nameToId[r.name] ?? "",
      photo: nameToPhoto[r.name] ?? "",
    }));

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
