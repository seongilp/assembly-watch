import type { Bill } from "#shared/types";
import data from "../assets/bills-recent.json";

/** 최근 의안(계류/처리 각 300건) — 빌드타임 정적 베이크 */
export default defineEventHandler(
  (): { pending: Bill[]; processed: Bill[] } =>
    data as { pending: Bill[]; processed: Bill[] },
);
