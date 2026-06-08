import type { VoteData } from "#shared/types";
import data from "../assets/votedata.json";

/** 표결 매트릭스 (퀴즈·표결쌍둥이 클라 계산용, 빌드 베이크) */
export default defineEventHandler((): VoteData => data as VoteData);
