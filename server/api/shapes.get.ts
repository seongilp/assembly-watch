import shapes from "../assets/district-shapes.json";

interface Shapes {
  codes: Record<string, { name: string; rings: [number, number][][] }>;
  members: Record<string, string[]>;
}

/** 선거구(시군구) 경계 폴리곤 — 클릭 시 지도 오버레이용 (빌드 베이크) */
export default defineEventHandler((): Shapes => shapes as Shapes);
