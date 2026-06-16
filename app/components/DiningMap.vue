<script setup lang="ts">
import { Map as MapIcon } from "lucide-vue-next";
import type { DiningMapPoint, DiningGroupBreakdown } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ points: DiningMapPoint[] }>();

type Dim = keyof DiningGroupBreakdown;
const DIMS: { key: Dim; label: string }[] = [
  { key: "party", label: "정당" }, { key: "age", label: "나이대" }, { key: "gender", label: "성별" },
  { key: "zodiac", label: "띠" }, { key: "wealth", label: "재산" }, { key: "pyeong", label: "평수" },
];
const dim = ref<Dim>("party");
const value = ref<string>("전체");

// 현재 차원의 값 목록(전체 점에서 등장하는 버킷)
const values = computed(() => {
  const set = new Set<string>();
  for (const p of props.points) for (const k of Object.keys(p.groups[dim.value])) set.add(k);
  return ["전체", ...[...set].sort()];
});
watch(dim, () => (value.value = "전체"));

// 필터된 점 + 표시 카운트(전체면 visits, 값 선택 시 그 그룹 카운트)
const shown = computed(() =>
  props.points
    .map((p) => ({ p, c: value.value === "전체" ? p.visits : (p.groups[dim.value][value.value] || 0) }))
    .filter((x) => x.c > 0),
);

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null, map: any = null, overlays: any[] = [];
const maxC = computed(() => Math.max(1, ...shown.value.map((x) => x.c)));

function color(p: DiningMapPoint) {
  if (dim.value === "party" && value.value !== "전체") return partyColor(value.value);
  if (dim.value === "party") { // 전체: 최다 정당 색
    const top = Object.entries(p.groups.party).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ? partyColor(top) : "#3182F6";
  }
  return "#FF9500";
}
function markerHtml(p: DiningMapPoint, c: number) {
  const t = c / maxC.value, size = Math.round(20 + t * 34);
  return `<div title="${p.name} · ${c}회" style="cursor:pointer;width:${size}px;height:${size}px;border-radius:50%;
    background:${color(p)};opacity:.85;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3);
    display:grid;place-items:center;color:#fff;font:700 ${Math.max(9, Math.round(size * 0.32))}px Pretendard,sans-serif;">${c}</div>`;
}
function clear() { overlays.forEach((o) => o.setMap(null)); overlays = []; }
function render() {
  if (!map) return;
  clear();
  for (const { p, c } of shown.value) {
    const el = document.createElement("div");
    el.innerHTML = markerHtml(p, c);
    const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: el, yAnchor: 0.5, xAnchor: 0.5 });
    ov.setMap(map); overlays.push(ov);
  }
}
watch(shown, render);

onMounted(async () => {
  try {
    kakao = await useKakaoLoader();
    if (!mapEl.value) return;
    map = new kakao.maps.Map(mapEl.value, { center: new kakao.maps.LatLng(37.53, 126.93), level: 6 }); // 여의도 중심
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    render();
    status.value = "ready";
  } catch { status.value = "error"; }
});
onBeforeUnmount(clear);
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-5">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900"><MapIcon class="size-4 text-toss-blue" /> 정치인이 먹은 식당 지도</h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">차원과 값을 골라 어떤 그룹이 어디서 먹었는지 보세요. 주소가 확인된 식당(2023~2024)만 표시됩니다.</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <select v-model="dim" class="rounded-lg border border-toss-gray-200 px-2 py-1 text-[13px] font-semibold">
        <option v-for="d in DIMS" :key="d.key" :value="d.key">{{ d.label }}</option>
      </select>
      <div class="flex flex-wrap gap-1">
        <button v-for="v in values" :key="v" type="button" @click="value = v"
          class="rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors"
          :class="value === v ? 'bg-toss-blue text-white' : 'bg-toss-gray-100 text-toss-gray-600 hover:bg-toss-gray-200'">{{ v }}</button>
      </div>
    </div>
    <div class="mt-3 relative">
      <div ref="mapEl" class="w-full h-[460px] lg:h-[560px] rounded-xl overflow-hidden bg-toss-gray-100" />
      <p v-if="status === 'error'" class="absolute inset-0 grid place-items-center text-toss-gray-400 text-sm">지도를 불러오지 못했습니다</p>
      <div v-if="status === 'ready'" class="absolute left-3 top-3 z-10 rounded-lg bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-toss-gray-500 card-shadow pointer-events-none">표시 {{ shown.length }}곳 · 마커 크기 = 방문수</div>
    </div>
  </section>
</template>
