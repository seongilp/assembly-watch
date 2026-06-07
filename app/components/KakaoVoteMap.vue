<script setup lang="ts">
import { REGION_CENTROID } from "~/lib/region";

interface RegionStat {
  region: string;
  total: number;
  rate: number;
}

const props = defineProps<{
  regions: RegionStat[];
  selected: string | null;
}>();
const emit = defineEmits<{ select: [region: string]; error: [] }>();

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null;
let map: any = null;
const overlays = new Map<string, any>();

function badgeHtml(s: RegionStat, active: boolean) {
  const alpha = 0.45 + 0.55 * s.rate;
  const bg = `rgba(49,130,246,${alpha.toFixed(2)})`;
  const ring = active ? "box-shadow:0 0 0 3px #1b64da;" : "box-shadow:0 2px 6px rgba(0,0,0,.25);";
  return `
    <div style="cursor:pointer;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;
                gap:1px;padding:5px 9px;border-radius:9999px;background:${bg};${ring}
                color:#fff;font-weight:800;font-family:Pretendard,sans-serif;white-space:nowrap;">
      <span style="font-size:12px;line-height:1;">${s.region}</span>
      <span style="font-size:10px;line-height:1;opacity:.92;">${Math.round(s.rate * 100)}% · ${s.total}</span>
    </div>`;
}

function render() {
  if (!kakao || !map) return;
  overlays.forEach((o) => o.setMap(null));
  overlays.clear();
  for (const s of props.regions) {
    const c = REGION_CENTROID[s.region];
    if (!c) continue;
    const el = document.createElement("div");
    el.innerHTML = badgeHtml(s, s.region === props.selected);
    el.addEventListener("click", () => emit("select", s.region));
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(c.lat, c.lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: s.region === props.selected ? 10 : 1,
    });
    overlay.setMap(map);
    overlays.set(s.region, overlay);
  }
}

onMounted(async () => {
  try {
    kakao = await useKakaoLoader();
    if (!mapEl.value) return;
    map = new kakao.maps.Map(mapEl.value, {
      center: new kakao.maps.LatLng(36.3, 127.8),
      level: 13,
      draggable: true,
    });
    map.addControl(
      new kakao.maps.ZoomControl(),
      kakao.maps.ControlPosition.RIGHT,
    );
    status.value = "ready";
    render();
  } catch (e) {
    status.value = "error";
    emit("error");
  }
});

watch(() => [props.regions, props.selected], render, { deep: true });
onBeforeUnmount(() => overlays.forEach((o) => o.setMap(null)));
</script>

<template>
  <div class="relative">
    <div
      ref="mapEl"
      class="w-full h-[460px] rounded-2xl overflow-hidden bg-toss-gray-100"
    />
    <div
      v-if="status === 'loading'"
      class="absolute inset-0 grid place-items-center rounded-2xl bg-toss-gray-100 text-[13px] text-toss-gray-400"
    >
      지도를 불러오는 중…
    </div>
    <div
      v-else-if="status === 'error'"
      class="absolute inset-0 grid place-items-center rounded-2xl bg-toss-gray-100 text-center px-6"
    >
      <p class="text-[13px] text-toss-gray-500">
        지도를 불러오지 못했습니다.<br />타일 보기로 전환합니다.
      </p>
    </div>
  </div>
</template>
