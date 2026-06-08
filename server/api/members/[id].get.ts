import type { Bill, Member, MemberVote, MemberDetail } from "#shared/types";
import photos from "../../assets/member-photos.json";
import details from "../../assets/member-details.json";
import members from "../../assets/members.json";

const PHOTOS = photos as Record<string, string>;
const DETAILS = details as Record<
  string,
  { bills: Bill[]; votes: MemberVote[]; votesScanned: number }
>;
// 베이크된 의원 인적사항(라이브 API 대체) — id → Member
const MEMBERS_BY_ID: Record<string, Omit<Member, "photo">> = {};
for (const m of members as Omit<Member, "photo">[]) MEMBERS_BY_ID[m.id] = m;

/**
 * 의원 상세 통합: 인적사항 + 대표발의 법안 + 최근 본회의 표결 이력
 * 발의·표결은 빌드타임 정적 베이크(member-details.json) → 런타임 무거운 호출 0.
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

    const base = MEMBERS_BY_ID[id];
    if (!base) return empty;
    const member: Member = { ...base, photo: PHOTOS[id] ?? "" };

    const d = DETAILS[id] ?? { bills: [], votes: [], votesScanned: 0 };
    return {
      member,
      bills: d.bills,
      votes: d.votes,
      votesScanned: d.votesScanned,
    };
  },
  {
    maxAge: 60 * 60 * 6,
    name: "member-detail",
    getKey: (event) => getRouterParam(event, "id") ?? "none",
  },
);
