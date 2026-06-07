import type { Member } from "#shared/types";

/** 현직 국회의원 전체 (캐시 6시간) */
export default defineCachedEventHandler(
  async (): Promise<{ rows: Member[]; totalCount: number }> => {
    const [res, photos] = await Promise.all([
      fetchAssembly(API.MEMBERS, { pIndex: 1, pSize: 350 }),
      $fetch<Record<string, string>>("/api/member-photos").catch(() => ({})),
    ]);
    const rows = res.rows
      .map(mapMember)
      .map((m) => ({ ...m, photo: photos[m.id] ?? "" }));
    return { rows, totalCount: res.totalCount };
  },
  { maxAge: 60 * 60 * 6, name: "members", getKey: () => "all" },
);
