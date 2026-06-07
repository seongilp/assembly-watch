import type {
  CommitteeDetail,
  CommitteeMeeting,
  CommitteeMinute,
} from "#shared/types";
import committees from "../../assets/committees.json";

const LIST = committees as {
  deptCd: string;
  name: string;
  div: string;
  limit: number | null;
}[];

const s = (v: unknown) => (v == null ? "" : String(v).trim());

/**
 * 위원회 상세: 회의 일정(안건) + 회의록(PDF/원문 링크)
 * GET /api/committees/:deptCd
 */
export default defineCachedEventHandler(
  async (event): Promise<CommitteeDetail> => {
    const deptCd = getRouterParam(event, "deptCd");
    const committee = LIST.find((c) => c.deptCd === deptCd) ?? null;
    if (!committee || !deptCd) {
      return { committee: null, schedule: [], minutes: [] };
    }

    const year = new Date().getFullYear();
    // 개별 호출 실패가 전체 502 로 번지지 않도록 방어 (빈 배열 폴백)
    const safe = (p: Promise<{ rows: Record<string, unknown>[] }>) =>
      p.catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const [sch, min, minPrev] = await Promise.all([
      safe(fetchAssembly(API.COMMITTEE_SCHEDULE, { UNIT_CD: `1000${AGE}`, HR_DEPT_CD: deptCd, pSize: 60 })),
      safe(fetchAssembly(API.COMMITTEE_MINUTES, { DAE_NUM: AGE, CONF_DATE: year, COMM_NAME: committee.name, pSize: 80 })),
      safe(fetchAssembly(API.COMMITTEE_MINUTES, { DAE_NUM: AGE, CONF_DATE: year - 1, COMM_NAME: committee.name, pSize: 80 })),
    ]);

    const schedule: CommitteeMeeting[] = sch.rows
      .map((r) => ({
        date: s(r.MEETING_DATE),
        time: s(r.MEETING_TIME),
        title: s(r.TITLE),
        sess: s(r.SESS),
        agenda: s(r.ANGUN)
          .split(/<br\s*\/?>/i)
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 25),
        link: s(r.LINK_URL2),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);

    // 회의록은 안건 수만큼 행이 중복 → CONF_ID(없으면 제목)로 1회의=1행 dedupe
    const seenConf = new Set<string>();
    const minutes: CommitteeMinute[] = [...min.rows, ...minPrev.rows]
      .map((r) => ({
        id: s(r.CONF_LINK_URL).match(/id=(\d+)/)?.[1] ?? "",
        title: s(r.TITLE),
        date: s(r.CONF_DATE),
        pdf: s(r.PDF_LINK_URL),
        summary: s(r.CONF_LINK_URL), // type=summary 요약 뷰어
        vod: s(r.VOD_LINK_URL),
        _key: s(r.CONF_ID) || s(r.TITLE) + s(r.CONF_DATE),
      }))
      .filter((m) => {
        if (seenConf.has(m._key)) return false;
        seenConf.add(m._key);
        return true;
      })
      .map(({ _key, ...m }) => m)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);

    return { committee, schedule, minutes };
  },
  {
    maxAge: 60 * 60 * 6,
    name: "committee-detail",
    getKey: (event) => getRouterParam(event, "deptCd") ?? "none",
  },
);
