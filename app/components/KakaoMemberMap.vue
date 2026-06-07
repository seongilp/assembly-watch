<script setup lang="ts">
import { REGION_CENTROID } from "~/lib/region";

interface Seg {
  color: string;
  count: number;
}
interface RegionStat {
  region: string;
  total: number;
  segs: Seg[];
  top: string;
}
interface MemberPt {
  id: string;
  name: string;
  party: string;
  color: string;
  lat: number;
  lng: number;
}

const props = defineProps<{
  regions: RegionStat[];
  members: MemberPt[]; // 좌표 있는 의원(상세 마커용)
  selected: string | null;
}>();
const emit = defineEmits<{
  select: [region: string];
  member: [id: string];
  error: [];
}>();

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null;
let map: any = null;
let overlays: any[] = [];

const DETAIL_LEVEL = 10; // 이보다 확대(작은 level)면 의원 얼굴 마커

function clearOverlays() {
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
}

// ── 시도 버블 HTML ──────────────────────────────
function bubbleHtml(s: RegionStat, active: boolean, ox: number, oy: number) {
  const seg = (g: Seg) =>
    g.count > 0
      ? `<span style="width:${((g.count / s.total) * 100).toFixed(1)}%;background:${g.color};display:inline-block;height:100%;"></span>`
      : "";
  const ring = active ? "border:2px solid #3182F6;" : "border:1px solid rgba(0,0,0,.08);";
  return `
    <div style="cursor:pointer;transform:translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px));min-width:78px;
                background:#fff;${ring}border-radius:10px;padding:5px 7px;
                box-shadow:0 2px 8px rgba(0,0,0,.25);font-family:Pretendard,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:3px;">
        <span style="font-size:12px;font-weight:800;color:#191F28;">${s.region}</span>
        <span style="font-size:10px;font-weight:700;color:#8B95A1;">${s.total}</span>
      </div>
      <div style="display:flex;width:100%;height:7px;border-radius:9999px;overflow:hidden;background:#F2F4F6;">
        ${s.segs.map(seg).join("")}
      </div>
    </div>`;
}

// ── 의원 얼굴 마커 HTML ─────────────────────────
function faceHtml(m: MemberPt) {
  return `
    <div title="${m.name}" style="cursor:pointer;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;
                background:${m.color};border:2px solid ${m.color};box-shadow:0 1px 5px rgba(0,0,0,.35);overflow:hidden;">
      <img src="/m/${m.id}.webp" alt="${m.name}" loading="lazy"
           style="width:100%;height:100%;object-fit:cover;object-position:top;display:block;"
           onerror="this.style.display='none'" />
    </div>`;
}

// 픽셀 좌표(컨테이너 기준)
function px(lat: number, lng: number): { x: number; y: number } | null {
  try {
    const p = map.getProjection().containerPointFromCoords(new kakao.maps.LatLng(lat, lng));
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}

// 사각형 충돌 회피: 겹치면 최소겹침 축으로 밀어냄
function declutter(nodes: any[], w: number, h: number, pad: number) {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x + b.ox - (a.x + a.ox);
        const dy = b.y + b.oy - (a.y + a.oy);
        const ox = w + pad - Math.abs(dx);
        const oy = h + pad - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox <= oy) {
            const s = ((dx < 0 ? -1 : 1) * ox) / 2;
            a.ox -= s;
            b.ox += s;
          } else {
            const s = ((dy < 0 ? -1 : 1) * oy) / 2;
            a.oy -= s;
            b.oy += s;
          }
        }
      }
    }
    if (!moved) break;
  }
}

function renderBubbles() {
  const nodes: any[] = [];
  for (const s of props.regions) {
    const c = REGION_CENTROID[s.region];
    if (!c) continue;
    const p = px(c.lat, c.lng);
    if (!p) continue;
    nodes.push({ s, c, x: p.x, y: p.y, ox: 0, oy: 0 });
  }
  declutter(nodes, 84, 44, 6);
  for (const n of nodes) {
    const el = document.createElement("div");
    el.innerHTML = bubbleHtml(n.s, n.s.region === props.selected, Math.round(n.ox), Math.round(n.oy));
    el.addEventListener("click", () => emit("select", n.s.region));
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(n.c.lat, n.c.lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: n.s.region === props.selected ? 10 : 1,
    });
    overlay.setMap(map);
    overlays.push(overlay);
    // 오프셋이 크면 실제 위치 점 표시
    if (Math.hypot(n.ox, n.oy) > 22) {
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:7px;height:7px;border-radius:50%;background:#3182F6;border:2px solid #fff;transform:translate(-50%,-50%);box-shadow:0 0 2px rgba(0,0,0,.4);";
      const d = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(n.c.lat, n.c.lng),
        content: dot,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 0,
      });
      d.setMap(map);
      overlays.push(d);
    }
  }
}

function renderMarkers() {
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  const latMargin = (ne.getLat() - sw.getLat()) * 0.1;
  const lngMargin = (ne.getLng() - sw.getLng()) * 0.1;
  const nodes: any[] = [];
  for (const m of props.members) {
    if (
      m.lat < sw.getLat() - latMargin ||
      m.lat > ne.getLat() + latMargin ||
      m.lng < sw.getLng() - lngMargin ||
      m.lng > ne.getLng() + lngMargin
    )
      continue;
    const p = px(m.lat, m.lng);
    if (!p) continue;
    nodes.push({ m, x: p.x, y: p.y, ox: 0, oy: 0 });
  }
  declutter(nodes, 38, 38, 3);
  for (const n of nodes) {
    const el = document.createElement("div");
    el.style.cssText = `transform:translate(${Math.round(n.ox)}px, ${Math.round(n.oy)}px);`;
    el.innerHTML = faceHtml(n.m);
    el.addEventListener("click", () => emit("member", n.m.id));
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(n.m.lat, n.m.lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 1,
    });
    overlay.setMap(map);
    overlays.push(overlay);
  }
}

function render() {
  if (!kakao || !map) return;
  clearOverlays();
  const level = map.getLevel();
  if (level <= DETAIL_LEVEL && props.members.length) renderMarkers();
  else renderBubbles();
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
    kakao.maps.event.addListener(map, "idle", render);
    status.value = "ready";
    render();
  } catch {
    status.value = "error";
    emit("error");
  }
});

watch(() => [props.regions, props.members, props.selected], render, { deep: true });
onBeforeUnmount(clearOverlays);
</script>

<template>
  <div class="relative">
    <div ref="mapEl" class="w-full h-[640px] lg:h-[760px] rounded-2xl overflow-hidden bg-toss-gray-100" />
    <div
      v-if="status === 'ready'"
      class="absolute left-3 top-3 z-10 rounded-lg bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-toss-gray-500 card-shadow pointer-events-none"
    >
      확대하면 의원 얼굴로 표시
    </div>
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
