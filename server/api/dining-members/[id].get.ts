import type { DiningMemberStats } from "#shared/types";
import map from "../../assets/dining-members.json";

const MEMBERS = map as Record<string, DiningMemberStats>;

/**
 * 의원별 정치자금 식당 지출 통계 (OhmyNews KA-money 2012~2024 — 빌드 베이크)
 * 식당 기록 없는 의원은 null 반환(404 아님) — 의원 페이지에서 카드만 숨김.
 * 빌드타임 정적 프리렌더(300명) → 런타임 0 호출.
 * GET /api/dining-members/:id   (id = MONA_CD)
 */
export default defineEventHandler((event): DiningMemberStats | null => {
  const id = getRouterParam(event, "id");
  return id ? MEMBERS[id] ?? null : null;
});
