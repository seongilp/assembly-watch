import type { VoteAnalysisTop } from "#shared/types";
import data from "../assets/vote-analysis.json";

const D = data as unknown as VoteAnalysisTop & { byBill: unknown };

/** 표결의 발견 — 전역 톱픽 (빌드 베이크, insights 발견 탭) */
export default defineEventHandler(
  (): VoteAnalysisTop => ({ billCount: D.billCount, analyzed: D.analyzed, topPicks: D.topPicks }),
);
