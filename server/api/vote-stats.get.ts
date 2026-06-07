import type { VoteStats } from "#shared/types";
import stats from "../assets/vote-stats.json";

/** 정당별 누적 표결 통계 (빌드 베이크) */
export default defineEventHandler((): VoteStats => stats as VoteStats);
