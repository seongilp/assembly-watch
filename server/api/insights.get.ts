import type { Insights } from "#shared/types";
import data from "../assets/insights.json";

/** 펀팩트/랭킹 (빌드타임 집계 정적 데이터) */
export default defineEventHandler((): Insights => data as Insights);
