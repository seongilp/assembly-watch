import type { Member, MemberListItem, MemberTally } from "#shared/types";
import photos from "../assets/member-photos.json";
import tally from "../assets/member-tally.json";
import members from "../assets/members.json";

const PHOTOS = photos as Record<string, string>;
const TALLY = tally as Record<string, MemberTally>;
const MEMBERS = members as Omit<Member, "photo">[];

/** 현직 국회의원 목록 (베이크된 명단 + 정적 사진맵, 캐시 6시간) */
export default defineCachedEventHandler(
  async (): Promise<{ rows: MemberListItem[]; totalCount: number }> => {
    const rows: MemberListItem[] = MEMBERS.map((m) => ({
      id: m.id,
      name: m.name,
      party: m.party,
      origin: m.origin,
      electType: m.electType,
      reelection: m.reelection,
      committee: m.committee,
      photo: PHOTOS[m.id] ?? "",
      tally: TALLY[m.id],
    }));
    return { rows, totalCount: rows.length };
  },
  { maxAge: 60 * 60 * 6, name: "members", getKey: () => "all" },
);
