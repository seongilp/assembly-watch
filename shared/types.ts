/** 앱 전역 공유 타입 (server + client) */

export interface Member {
  id: string; // MONA_CD
  name: string; // HG_NM
  hanja: string; // HJ_NM
  eng: string; // ENG_NM
  party: string; // POLY_NM
  origin: string; // ORIG_NM (선거구)
  electType: string; // ELECT_GBN_NM (지역구/비례)
  committee: string; // CMIT_NM (대표 위원회)
  committees: string; // CMITS
  reelection: string; // REELE_GBN_NM (초선/재선...)
  sex: string; // SEX_GBN_NM
  units: string; // UNITS (당선 대수)
  job: string; // JOB_RES_NM (직책)
  tel: string; // TEL_NO
  email: string; // E_MAIL
  homepage: string; // HOMEPAGE
  birth: string; // BTH_DATE
  staff: string; // STAFF
  secretary: string; // SECRETARY
  photo: string; // NAAS_PIC (ALLNAMEMBER 에서 보강)
}

/** 목록용 경량 의원 (리스트/대시보드/검색 — 페이로드 절감) */
export interface MemberListItem {
  id: string;
  name: string;
  party: string;
  origin: string;
  electType: string;
  reelection: string;
  committee: string;
  photo: string;
}

export interface Bill {
  id: string; // BILL_ID
  no: string; // BILL_NO
  name: string; // BILL_NAME
  proposer: string; // PROPOSER
  proposerKind: string; // PROPOSER_KIND
  proposeDt: string; // PROPOSE_DT
  committee: string; // CURR_COMMITTEE / COMMITTEE
  procResult: string; // PROC_RESULT_CD
  procDt: string; // PROC_DT
  link: string; // LINK_URL / DETAIL_LINK
  status: "pending" | "processed";
}

export interface VoteSummary {
  billId: string; // BILL_ID
  billNo: string; // BILL_NO
  billName: string; // BILL_NM
  billKind: string; // BILL_KIND
  proposer: string; // PROPOSER
  committee: string; // COMMITTEE_NM
  procResult: string; // PROC_RESULT_CD
  procDt: string; // RGS_PROC_DT
  yes: number | null; // YES_TCNT
  no: number | null; // NO_TCNT
  blank: number | null; // BLANK_TCNT
  total: number | null; // VOTE_TCNT
  link: string; // LINK_URL
}

export interface VoteRecord {
  name: string; // HG_NM
  party: string; // POLY_NM
  origin: string; // ORIG_NM
  result: string; // RESULT_VOTE_MOD (찬성/반대/기권/불참)
  date: string; // VOTE_DATE
}

export interface Committee {
  name: string; // COMMITTEE_NAME
  div: string; // CMT_DIV_NM
  deptCd: string; // HR_DEPT_CD
  limit: number | null; // LIMIT_CNT
  current: number | null; // CURR_CNT
}

export interface ScheduleItem {
  kind: string; // SCH_KIND
  content: string; // SCH_CN
  date: string; // SCH_DT
  time: string; // SCH_TM
  committee: string; // CMIT_NM
  place: string; // EV_PLC
  host: string; // EV_INST_NM
  confDiv: string; // CONF_DIV
}

export interface Paged<T> {
  rows: T[];
  totalCount: number;
  page: number;
  size: number;
}

/** 의원의 최근 본회의 표결 1건 */
export interface MemberVote {
  billId: string;
  billName: string;
  date: string;
  result: string; // 찬성/반대/기권/불참
  procResult: string;
}

/** 의원 상세 통합 응답 */
export interface MemberDetail {
  member: Member | null;
  bills: Bill[];
  votes: MemberVote[];
  votesScanned: number;
}
