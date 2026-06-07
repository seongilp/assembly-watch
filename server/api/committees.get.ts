import type { Committee } from "#shared/types";

/** 위원회 현황 (캐시 6시간) */
export default defineCachedEventHandler(
  async (): Promise<{ rows: Committee[]; totalCount: number }> => {
    const res = await fetchAssembly(API.COMMITTEES, { pIndex: 1, pSize: 100 });
    return { rows: res.rows.map(mapCommittee), totalCount: res.totalCount };
  },
  { maxAge: 60 * 60 * 6, name: "committees", getKey: () => "all" },
);
