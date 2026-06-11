<script setup lang="ts">
import { Map as MapIcon } from "lucide-vue-next";
import type { WealthData } from "#shared/types";

// 의원 부동산(본인·배우자 주택) 시군구 분포를 카카오맵 버블로.
// 좌표는 빌드타임 지오코딩 베이크(homesMap) — 런타임 REST 호출 없음.
const props = defineProps<{ data: WealthData }>();

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null;
let map: any = null;
let overlays: any[] = [];

const maxCount = Math.max(...props.data.homesMap.map((h) => h.count), 1);

function bubbleHtml(gu: string, count: number) {
  // 채 수에 따라 크기·색 강조 (강남권이 한눈에 띄게)
  const t = count / maxCount;
  const size = Math.round(34 + t * 38);
  const hot = t > 0.6 ? "#F04452" : t > 0.3 ? "#FF9500" : "#3182F6";
  return `
    <div style="cursor:default;width:${size}px;height:${size}px;border-radius:50%;
                background:${hot};opacity:.88;border:2px solid #fff;
                box-shadow:0 2px 8px rgba(0,0,0,.3);display:grid;place-items:center;
                color:#fff;font-family:Pretendard,sans-serif;text-align:center;line-height:1.05;">
      <div>
        <div style="font-size:${Math.max(10, Math.round(size * 0.21))}px;font-weight:800;">${count}</div>
        <div style="font-size:9px;font-weight:600;opacity:.95;">${gu.split(" ").pop()}</div>
      </div>
    </div>`;
}

onMounted(async () => {
  if (!props.data.homesMap.length) {
    status.value = "error";
    return;
  }
  try {
    kakao = await useKakaoLoader();
    if (!mapEl.value) return;
    map = new kakao.maps.Map(mapEl.value, {
      center: new kakao.maps.LatLng(36.5, 127.6),
      level: 13,
      draggable: true,
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    for (const h of props.data.homesMap) {
      const el = document.createElement("div");
      el.innerHTML = bubbleHtml(h.gu, h.count);
      el.title = `${h.gu} ${h.count}채`;
      const o = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(h.lat, h.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: h.count, // 많은 동네가 위로
      });
      o.setMap(map);
      overlays.push(o);
    }
    status.value = "ready";
  } catch {
    status.value = "error";
  }
});
onBeforeUnmount(() => {
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
});
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <MapIcon class="size-4 text-toss-blue" /> 의원 부동산 지도
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      본인·배우자 소유 주택(아파트·주택·오피스텔 등)의 시군구 분포. 숫자는 채 수 — 빨강일수록 밀집.
    </p>
    <div class="mt-4 relative">
      <div ref="mapEl" class="w-full h-[460px] lg:h-[560px] rounded-xl overflow-hidden bg-toss-gray-100" />
      <div
        v-if="status === 'loading'"
        class="absolute inset-0 grid place-items-center rounded-xl bg-toss-gray-100 text-[13px] text-toss-gray-400"
      >
        지도를 불러오는 중…
      </div>
      <div
        v-else-if="status === 'error'"
        class="absolute inset-0 grid place-items-center rounded-xl bg-toss-gray-100 px-6 text-center"
      >
        <p class="text-[13px] text-toss-gray-500">지도를 불러오지 못했습니다.</p>
      </div>
    </div>
  </section>
</template>
