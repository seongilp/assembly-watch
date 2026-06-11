import wealth from "../assets/wealth.json";
import type { WealthData } from "#shared/types";

/** 의원 재산 (정보공개센터 정제 국회공보 2025 정기재산변동 — 빌드 베이크) */
export default defineEventHandler((): WealthData => wealth as unknown as WealthData);
