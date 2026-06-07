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
    const [sch, min, minPrev] = await Promise.all([
      fetchAssembly(API.COMMITTEE_SCHEDULE, {
        UNIT_CD: `1000${AGE}`,
        HR_DEPT_CD: deptCd,
        pSize: 100,
      }),
      fetchAssembly(API.COMMITTEE_MINUTES, {
        DAE_NUM: AGE,
        CONF_DATE: year,
        COMM_NAME: committee.name,
        pSize: 100,
      }),
      fetchAssembly(API.COMMITTEE_MINUTES, {
        DAE_NUM: AGE,
        CONF_DATE: year - 1,
        COMM_NAME: committee.name,
        pSize: 100,
      }),
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
          .filter(Boolean),
        link: s(r.LINK_URL2),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);

    const minutes: CommitteeMinute[] = [...min.rows, ...minPrev.rows]
      .map((r) => ({
        title: s(r.TITLE),
        date: s(r.CONF_DATE),
        pdf: s(r.PDF_LINK_URL),
        link: s(r.CONF_LINK_URL),
      }))
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
