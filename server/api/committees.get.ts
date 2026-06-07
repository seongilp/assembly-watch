import type { CommitteeListItem } from "#shared/types";
import committees from "../assets/committees.json";

const LIST = committees as CommitteeListItem[];

/** 위원회 현황 (빌드타임 베이크 — 상임위는 최근 회의록 포함) */
export default defineEventHandler(
  (): { rows: CommitteeListItem[]; totalCount: number } => ({
    rows: LIST,
    totalCount: LIST.length,
  }),
);
