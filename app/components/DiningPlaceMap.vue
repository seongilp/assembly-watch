<script setup lang="ts">
/**
 * 식당 목록 지도 뷰 — 목록에서 걸러진 식당을 그대로 지도에 얹는다.
 * (DiningMap 은 그룹 차원별 분해용. 이쪽은 검색·음식종류 필터와 1:1 로 붙는다.)
 */
import type { DiningMapPoint } from "#shared/types";
import { esc } from "~/lib/safe";

const props = defineProps<{ points: DiningMapPoint[]; highlight?: string }>();

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null;
let map: any = null;
let overlays: any[] = [];

const maxVisits = computed(() => Math.max(1, ...props.points.map((p) => p.visits)));

function markerHtml(p: DiningMapPoint) {
  const t = p.visits / maxVisits.value;
  const size = Math.round(20 + t * 34);
  const on = props.highlight && p.name === props.highlight;
  return `<div title="${esc(p.name)} · ${p.visits}회" style="cursor:pointer;width:${size}px;height:${size}px;
    border-radius:50%;background:${on ? "#FF3B30" : "#3182F6"};opacity:.85;border:2px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,.3);display:grid;place-items:center;color:#fff;
    font:700 ${Math.max(9, Math.round(size * 0.32))}px Pretendard,sans-serif;">${p.visits}</div>`;
}

function clear() {
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
}

/** 필터 결과가 좁아지면 그 범위로 맞춰준다(검색 한 곳이면 확대). */
function fitBounds() {
  if (!map || props.points.length === 0) return;
  const bounds = new kakao.maps.LatLngBounds();
  for (const p of props.points) bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
  map.setBounds(bounds);
  if (props.points.length === 1) map.setLevel(4);
}

function render() {
  if (!map) return;
  clear();
  for (const p of props.points) {
    const el = document.createElement("div");
    el.innerHTML = markerHtml(p);
    el.addEventListener("click", () => navigateTo(`/dining/${p.id}`));
    const ov = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(p.lat, p.lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
    });
    ov.setMap(map);
    overlays.push(ov);
  }
  fitBounds();
}

watch(() => props.points, render, { deep: false });

onMounted(async () => {
  try {
    kakao = await useKakaoLoader();
    if (!mapEl.value) return;
    // 여의도 중심 — 필터 결과가 있으면 곧바로 setBounds 로 덮인다.
    map = new kakao.maps.Map(mapEl.value, {
      center: new kakao.maps.LatLng(37.53, 126.93),
      level: 6,
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    render();
    status.value = "ready";
  } catch {
    status.value = "error";
  }
});
onBeforeUnmount(clear);
</script>

<template>
  <div class="relative">
    <div
      ref="mapEl"
      class="w-full h-[460px] lg:h-[560px] rounded-2xl overflow-hidden bg-toss-gray-100"
    />
    <p
      v-if="status === 'error'"
      class="absolute inset-0 grid place-items-center text-toss-gray-400 text-sm"
    >
      지도를 불러오지 못했습니다
    </p>
    <div
      v-else-if="status === 'ready'"
      class="absolute left-3 top-3 z-10 rounded-lg bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-toss-gray-500 card-shadow pointer-events-none"
    >
      표시 {{ points.length }}곳 · 마커 크기 = 방문수
    </div>
    <p
      v-if="status === 'ready' && points.length === 0"
      class="absolute inset-0 grid place-items-center text-toss-gray-400 text-sm"
    >
      좌표가 확인된 식당이 없습니다
    </p>
  </div>
</template>
