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
  photo?: string; // 이름 매칭으로 보강
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

export interface CommitteeMeeting {
  date: string; // MEETING_DATE
  time: string; // MEETING_TIME
  title: string; // TITLE (전체회의/소위 등)
  sess: string; // SESS (회기)
  agenda: string[]; // ANGUN (안건 목록)
  link: string; // LINK_URL2
}

export interface CommitteeMinute {
  id: string; // 회의록 id (CONF_LINK_URL 의 id)
  title: string; // TITLE
  date: string; // CONF_DATE
  pdf: string; // PDF_LINK_URL (전체 PDF)
  summary: string; // CONF_LINK_URL (type=summary, 요약 뷰어)
}

/** 회의록 요약 (요약 뷰어에서 추출) */
export interface MinuteSummary {
  title: string;
  agenda: string[]; // 상정된 안건
  speakers: string[]; // 발언/참석 위원
  hwp: string; // 한글 다운로드
  pdf: string; // PDF 다운로드
}

export interface CommitteeDetail {
  committee: { deptCd: string; name: string; div: string; limit: number | null } | null;
  schedule: CommitteeMeeting[];
  minutes: CommitteeMinute[];
}

/** 위원회 목록 항목 (상임위는 최근 회의록 포함) */
export interface CommitteeListItem {
  deptCd: string;
  name: string;
  div: string;
  limit: number | null;
  minutes?: CommitteeMinute[];
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

/** 펀팩트 랭킹 항목 */
export interface InsightMember {
  id: string;
  name: string;
  party: string;
  origin: string;
  photo: string;
  count?: number;
  rate?: number;
  total?: number;
  absent?: number;
}

export interface Insights {
  generatedAt: string | null;
  voteBills: number;
  terms: InsightMember[];
  proposed: InsightMember[];
  absent: InsightMember[];
  yes: InsightMember[];
  no: InsightMember[];
  blank: InsightMember[];
  attendanceLow: InsightMember[];
}

/** 의원 상세 통합 응답 */
export interface MemberDetail {
  member: Member | null;
  bills: Bill[];
  votes: MemberVote[];
  votesScanned: number;
}
