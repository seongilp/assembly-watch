/** 대시보드 핵심 통계 (캐시 30분) */
export default defineCachedEventHandler(
  async () => {
    const [members, pending, processed, votes] = await Promise.all([
      fetchAssembly(API.MEMBERS, { pSize: 1 }),
      fetchAssembly(API.BILLS_PENDING, { pSize: 1 }),
      fetchAssembly(API.BILLS_PROCESSED, { pSize: 1, AGE }),
      fetchAssembly(API.VOTES_PLENARY, { pSize: 1, AGE }),
    ]);
    return {
      age: AGE,
      members: members.totalCount,
      billsPending: pending.totalCount,
      billsProcessed: processed.totalCount,
      votes: votes.totalCount,
      updatedAt: new Date().toISOString(),
    };
  },
  { maxAge: 60 * 30, name: "stats", getKey: () => "all" },
);
