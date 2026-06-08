import type { VoteInsights } from "#shared/types";
import data from "../assets/vote-insights.json";

/** 소신왕·정당결속도·박빙·만장일치 (빌드 베이크) */
export default defineEventHandler((): VoteInsights => data as VoteInsights);
