import districts from "../assets/districts.json";

/** 선거구 좌표 맵 (빌드타임 지오코딩 베이크) — { [MONA_CD]: [lat, lng] } */
export default defineEventHandler((): Record<string, [number, number]> => {
  return districts as Record<string, [number, number]>;
});
