import type { MemberListItem } from "#shared/types";
import photos from "../assets/member-photos.json";

const PHOTOS = photos as Record<string, string>;

/** 현직 국회의원 목록 (경량 페이로드 + 정적 사진맵, 캐시 6시간) */
export default defineCachedEventHandler(
  async (): Promise<{ rows: MemberListItem[]; totalCount: number }> => {
    const res = await fetchAssembly(API.MEMBERS, { pIndex: 1, pSize: 350 });
    const rows: MemberListItem[] = res.rows.map(mapMember).map((m) => ({
      id: m.id,
      name: m.name,
      party: m.party,
      origin: m.origin,
      electType: m.electType,
      reelection: m.reelection,
      committee: m.committee,
      photo: PHOTOS[m.id] ?? "",
    }));
    return { rows, totalCount: res.totalCount };
  },
  { maxAge: 60 * 60 * 6, name: "members", getKey: () => "all" },
);
