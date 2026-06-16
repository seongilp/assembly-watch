import type { DiningMemberStats } from "#shared/types";
import map from "../../assets/dining-members.json";

const MEMBERS = map as Record<string, DiningMemberStats>;

// 식당 기록이 없는 의원도 200(빈 통계)을 반환 — 프리렌더가 204(빈 응답)를 에러로 처리하는 것을 회피.
// 의원 페이지는 visits===0 이면 카드를 숨긴다.
const EMPTY: DiningMemberStats = { visits: 0, amount: 0, topRestaurants: [], cuisineMix: {}, purposeMix: {}, districtRate: null };

/**
 * 의원별 정치자금 식당 지출 통계 (OhmyNews KA-money 2012~2024 — 빌드 베이크)
 * 식당 기록 없는 의원은 빈 통계(visits 0) 반환 — 의원 페이지에서 카드만 숨김.
 * 빌드타임 정적 프리렌더(300명) → 런타임 0 호출.
 * GET /api/dining-members/:id   (id = MONA_CD)
 */
export default defineEventHandler((event): DiningMemberStats => {
  const id = getRouterParam(event, "id");
  return (id && MEMBERS[id]) || EMPTY;
});
