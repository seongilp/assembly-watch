<script setup lang="ts">
import { REGION_CENTROID } from "~/lib/region";

interface RegionStat {
  region: string;
  total: number;
  yes: number;
  no: number;
  blank: number;
  absent: number;
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

const COLORS = { yes: "#3182F6", no: "#F04452", blank: "#FF9500", absent: "#B0B8C1" };

function badgeHtml(s: RegionStat, active: boolean) {
  const seg = (n: number, c: string) =>
    n > 0
      ? `<span style="width:${((n / s.total) * 100).toFixed(1)}%;background:${c};display:inline-block;height:100%;"></span>`
      : "";
  const ring = active
    ? "border:2px solid #3182F6;"
    : "border:1px solid rgba(0,0,0,.08);";
  return `
    <div style="cursor:pointer;transform:translate(-50%,-50%);min-width:78px;
                background:#fff;${ring}border-radius:10px;padding:5px 7px;
                box-shadow:0 2px 8px rgba(0,0,0,.25);font-family:Pretendard,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:3px;">
        <span style="font-size:12px;font-weight:800;color:#191F28;">${s.region}</span>
        <span style="font-size:10px;font-weight:700;color:#8B95A1;">${s.total}</span>
      </div>
      <div style="display:flex;width:100%;height:7px;border-radius:9999px;overflow:hidden;background:#F2F4F6;">
        ${seg(s.yes, COLORS.yes)}${seg(s.no, COLORS.no)}${seg(s.blank, COLORS.blank)}${seg(s.absent, COLORS.absent)}
      </div>
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
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    status.value = "ready";
    render();
  } catch {
    status.value = "error";
    emit("error");
  }
});

watch(() => [props.regions, props.selected], render, { deep: true });
onBeforeUnmount(() => overlays.forEach((o) => o.setMap(null)));
</script>

<template>
  <div class="relative">
    <div ref="mapEl" class="w-full h-[640px] lg:h-[760px] rounded-2xl overflow-hidden bg-toss-gray-100" />
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
