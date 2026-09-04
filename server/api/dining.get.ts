import dining from "../assets/dining.json";
import type { DiningData } from "#shared/types";

/** 정치자금 식당 지출 (OhmyNews KA-money 2012~2024 — 빌드 베이크) */
export default defineEventHandler((): DiningData => dining as unknown as DiningData);
