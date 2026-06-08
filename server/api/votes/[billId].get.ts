import type { VoteRecord } from "#shared/types";
import photos from "../../assets/member-photos.json";
import votedata from "../../assets/votedata.json";

const PHOTOS = photos as Record<string, string>;

// 베이크된 표결 매트릭스(283건×300명). 코드: Y=찬성 N=반대 B=기권 A=불참 -=무기록(비현직)
interface BakedBill {
  id: string;
  no: string;
  name: string;
  date: string;
  procResult: string;
  committee: string;
  y: number;
  n: number;
  b: number;
  total: number;
}
interface BakedMember {
  id: string;
  name: string;
  party: string;
  origin: string;
  photo: string;
}
const VD = votedata as {
  bills: BakedBill[];
  members: BakedMember[];
  matrix: Record<string, string>;
};
const BILL_INDEX: Record<string, number> = {};
VD.bills.forEach((b, i) => {
  BILL_INDEX[b.id] = i;
});
const CODE: Record<string, "찬성" | "반대" | "기권" | "불참"> = {
  Y: "찬성",
  N: "반대",
  B: "기권",
  A: "불참",
};

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
 * 베이크된 votedata.json 으로 per-bill 명단 재구성.
 * 라이브 API 와 1:1 일치(검증 완료). 매트릭스에 없는 의안이면 null → 라이브 폴백.
 */
function fromBaked(billId: string): RollCallResponse | null {
  const idx = BILL_INDEX[billId];
  if (idx == null) return null;
  const b = VD.bills[idx]!;
  const rows: VoteRecord[] = [];
  const tally = { 찬성: 0, 반대: 0, 기권: 0, 불참: 0 };
  for (const m of VD.members) {
    const code = VD.matrix[m.id]?.[idx];
    if (!code || code === "-") continue; // 무기록(해당 시점 비현직) 제외
    const result = CODE[code] ?? "불참";
    rows.push({
      name: m.name,
      party: m.party,
      origin: m.origin,
      result,
      date: b.date,
      id: m.id,
      photo: PHOTOS[m.id] ?? "",
    });
    tally[result]++;
  }
  const bill: RollCallBill = {
    billId,
    billNo: b.no,
    billName: b.name,
    lawTitle: "",
    committee: b.committee,
    procResult: b.procResult,
    date: b.date,
  };
  return { bill, rows, totalCount: rows.length, tally };
}

/** 베이크에 없는 의안: 라이브 API 폴백 (기존 로직) */
async function fromLive(billId: string): Promise<RollCallResponse> {
  const [res, mRes] = await Promise.all([
    fetchAssembly(API.VOTES_ROLLCALL, { AGE, BILL_ID: billId, pIndex: 1, pSize: 320 }),
    fetchAssembly(API.MEMBERS, { pSize: 350 }),
  ]);
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
}

/**
 * 특정 의안의 의원별 표결 명단 + 집계 + 의안 메타
 * GET /api/votes/:billId — 베이크 우선(빌드타임 라이브 API 호출 제거), 없으면 라이브.
 */
export default defineCachedEventHandler(
  async (event): Promise<RollCallResponse> => {
    const billId = getRouterParam(event, "billId");
    if (!billId) {
      throw createError({ statusCode: 400, statusMessage: "billId 필요" });
    }
    return fromBaked(billId) ?? (await fromLive(billId));
  },
  {
    maxAge: 60 * 60,
    name: "vote-rollcall",
    getKey: (event) => getRouterParam(event, "billId") ?? "none",
  },
);
