import graph from "../assets/graph-data.json";
import type { GraphData } from "#shared/types";

/** 펀팩트 데이터 그래프 (정치 지형도·단짝·세대·성별·띠·성씨·지역) — 빌드 베이크 */
export default defineEventHandler((): GraphData => graph as unknown as GraphData);
