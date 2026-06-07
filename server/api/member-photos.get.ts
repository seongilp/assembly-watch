/**
 * 의원 사진 매핑: MONA_CD(=NAAS_CD) → 사진 URL(NAAS_PIC)
 * 통합 의원 API(ALLNAMEMBER)에서 추출. 12시간 KV 캐시.
 */
export default defineCachedEventHandler(
  async (): Promise<Record<string, string>> => {
    // ALLNAMEMBER 는 1회 최대 1000건 → 페이지 분할 (역대 전체 ~3300)
    const pages = await Promise.all(
      [1, 2, 3, 4].map((p) =>
        fetchAssembly(API.MEMBER_ALL, { pIndex: p, pSize: 1000 }),
      ),
    );
    const map: Record<string, string> = {};
    for (const res of pages) {
      for (const r of res.rows) {
        const cd = r.NAAS_CD ? String(r.NAAS_CD) : "";
        const pic = r.NAAS_PIC ? String(r.NAAS_PIC) : "";
        if (cd && pic) map[cd] = pic;
      }
    }
    return map;
  },
  { maxAge: 60 * 60 * 12, name: "member-photos", getKey: () => "all" },
);
