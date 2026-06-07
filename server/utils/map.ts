/** 국회 API raw row → 앱 타입 매퍼 (Nitro 서버 전용, 자동 import) */
import type {
  Member,
  Bill,
  VoteSummary,
  VoteRecord,
  Committee,
  ScheduleItem,
} from "#shared/types";

const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const n = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);

export function mapMember(r: Record<string, unknown>): Member {
  return {
    id: s(r.MONA_CD),
    name: s(r.HG_NM),
    hanja: s(r.HJ_NM),
    eng: s(r.ENG_NM),
    party: s(r.POLY_NM),
    origin: s(r.ORIG_NM),
    electType: s(r.ELECT_GBN_NM),
    committee: s(r.CMIT_NM),
    committees: s(r.CMITS),
    reelection: s(r.REELE_GBN_NM),
    sex: s(r.SEX_GBN_NM),
    units: s(r.UNITS),
    job: s(r.JOB_RES_NM),
    tel: s(r.TEL_NO),
    email: s(r.E_MAIL),
    homepage: s(r.HOMEPAGE),
    birth: s(r.BTH_DATE),
    staff: s(r.STAFF),
    secretary: s(r.SECRETARY),
    photo: "", // ALLNAMEMBER(NAAS_PIC) 로 별도 보강
  };
}

export function mapPendingBill(r: Record<string, unknown>): Bill {
  return {
    id: s(r.BILL_ID),
    no: s(r.BILL_NO),
    name: s(r.BILL_NAME),
    proposer: s(r.PROPOSER),
    proposerKind: s(r.PROPOSER_KIND),
    proposeDt: s(r.PROPOSE_DT),
    committee: s(r.CURR_COMMITTEE),
    procResult: "",
    procDt: "",
    link: s(r.LINK_URL),
    status: "pending",
  };
}

export function mapProcessedBill(r: Record<string, unknown>): Bill {
  return {
    id: s(r.BILL_ID),
    no: s(r.BILL_NO),
    name: s(r.BILL_NAME),
    proposer: s(r.PROPOSER),
    proposerKind: s(r.PROPOSER_KIND),
    proposeDt: s(r.PROPOSE_DT),
    committee: s(r.CURR_COMMITTEE),
    procResult: s(r.PROC_RESULT_CD),
    procDt: s(r.PROC_DT),
    link: s(r.LINK_URL),
    status: "processed",
  };
}

export function mapProposedBill(r: Record<string, unknown>): Bill {
  return {
    id: s(r.BILL_ID),
    no: s(r.BILL_NO),
    name: s(r.BILL_NAME),
    proposer: s(r.PROPOSER),
    proposerKind: "의원",
    proposeDt: s(r.PROPOSE_DT),
    committee: s(r.COMMITTEE),
    procResult: s(r.PROC_RESULT),
    procDt: "",
    link: s(r.DETAIL_LINK),
    status: s(r.PROC_RESULT) ? "processed" : "pending",
  };
}

export function mapVoteSummary(r: Record<string, unknown>): VoteSummary {
  return {
    billId: s(r.BILL_ID),
    billNo: s(r.BILL_NO),
    billName: s(r.BILL_NM),
    billKind: s(r.BILL_KIND),
    proposer: s(r.PROPOSER),
    committee: s(r.COMMITTEE_NM),
    procResult: s(r.PROC_RESULT_CD),
    procDt: s(r.RGS_PROC_DT),
    yes: n(r.YES_TCNT),
    no: n(r.NO_TCNT),
    blank: n(r.BLANK_TCNT),
    total: n(r.VOTE_TCNT),
    link: s(r.LINK_URL),
  };
}

export function mapVoteRecord(r: Record<string, unknown>): VoteRecord {
  return {
    name: s(r.HG_NM),
    party: s(r.POLY_NM),
    origin: s(r.ORIG_NM),
    result: s(r.RESULT_VOTE_MOD),
    date: s(r.VOTE_DATE),
  };
}

export function mapCommittee(r: Record<string, unknown>): Committee {
  return {
    name: s(r.COMMITTEE_NAME),
    div: s(r.CMT_DIV_NM),
    deptCd: s(r.HR_DEPT_CD),
    limit: n(r.LIMIT_CNT),
    current: n(r.CURR_CNT),
  };
}

export function mapSchedule(r: Record<string, unknown>): ScheduleItem {
  return {
    kind: s(r.SCH_KIND),
    content: s(r.SCH_CN),
    date: s(r.SCH_DT),
    time: s(r.SCH_TM),
    committee: s(r.CMIT_NM),
    place: s(r.EV_PLC),
    host: s(r.EV_INST_NM),
    confDiv: s(r.CONF_DIV),
  };
}
