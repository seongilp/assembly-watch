import type { DiningRestaurantDetail } from "#shared/types";
import details from "../../assets/dining-details.json";

const DETAILS = details as Record<string, DiningRestaurantDetail>;

/**
 * 식당 상세: 방문 의원 명단 + 연도별 추이
 * 빌드타임 정적 베이크(dining-details.json) → 런타임 0 호출.
 * GET /api/dining/:id
 */
export default defineCachedEventHandler(
  async (event): Promise<DiningRestaurantDetail> => {
    const id = getRouterParam(event, "id");
    if (!id || !DETAILS[id]) {
      throw createError({ statusCode: 404, statusMessage: "식당을 찾을 수 없습니다" });
    }
    return DETAILS[id]!;
  },
  {
    maxAge: 60 * 60 * 24,
    name: "dining-detail",
    getKey: (event) => getRouterParam(event, "id") ?? "none",
  },
);
