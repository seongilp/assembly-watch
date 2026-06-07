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
  origin: string; // 선거구명
  region: string; // 시도
  lat: number;
  lng: number;
}

const props = defineProps<{
  regions: RegionStat[];
  members: MemberPt[];
  selected: string | null;
}>();
const emit = defineEmits<{ select: [region: string]; error: [] }>();

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null;
let map: any = null;
let overlays: any[] = [];
let polygons: any[] = [];
const focusedId = ref<string | null>(null);

type Shapes = {
  codes: Record<string, { name: string; rings: [number, number][][] }>;
  members: Record<string, string[]>;
};
let shapes: Shapes | null = null;
let shapesLoading: Promise<void> | null = null;

const FACE_LEVEL = 12; // 이보다 확대되면(작은 level) 얼굴 마커 후보

function clearOverlays() {
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
}
function clearPolygons() {
  polygons.forEach((p) => p.setMap(null));
  polygons = [];
}

async function loadShapes() {
  if (shapes || shapesLoading) return shapesLoading;
  shapesLoading = $fetch<Shapes>("/api/shapes")
    .then((d) => {
      shapes = d;
    })
    .catch(() => {});
  return shapesLoading;
}

// 클릭한 의원의 선거구(시군구) 경계 폴리곤 오버레이
function drawPolygons(id: string) {
  clearPolygons();
  if (!shapes) return;
  const codes = shapes.members[id];
  if (!codes) return;
  const m = props.members.find((x) => x.id === id);
  const color = m?.color ?? "#3182F6";
  for (const code of codes) {
    const shp = shapes.codes[code];
    if (!shp) continue;
    for (const ring of shp.rings) {
      const path = ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
      const poly = new kakao.maps.Polygon({
        path,
        strokeWeight: 2,
        strokeColor: color,
        strokeOpacity: 0.9,
        fillColor: color,
        fillOpacity: 0.18,
      });
      poly.setMap(map);
      polygons.push(poly);
    }
  }
}

// ── 시도 버블 ──────────────────────────────
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

// ── 의원 얼굴 마커 (이니셜 폴백) ─────────────
function faceHtml(m: MemberPt, focused: boolean) {
  const initial = (m.name || "").slice(0, 1);
  const size = focused ? 46 : 36;
  const ring = focused ? "#3182F6" : m.color;
  const bw = focused ? 3 : 2;
  return `
    <div title="${m.name} · ${m.origin}" style="cursor:pointer;transform:translate(-50%,-50%);position:relative;
                width:${size}px;height:${size}px;border-radius:50%;background:${m.color};border:${bw}px solid ${ring};
                box-shadow:0 1px 5px rgba(0,0,0,.35);overflow:hidden;display:grid;place-items:center;
                color:#fff;font:700 ${Math.round(size * 0.4)}px Pretendard,sans-serif;">
      <span style="position:absolute;">${initial}</span>
      <img src="/m/${m.id}.webp" alt="${m.name}"
           style="position:relative;width:100%;height:100%;object-fit:cover;object-position:top;display:block;"
           onerror="this.remove()" />
    </div>`;
}

function px(lat: number, lng: number): { x: number; y: number } | null {
  try {
    const p = map.getProjection().containerPointFromCoords(new kakao.maps.LatLng(lat, lng));
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}

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

function membersInView(): any[] {
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  const latM = (ne.getLat() - sw.getLat()) * 0.08;
  const lngM = (ne.getLng() - sw.getLng()) * 0.08;
  const out: any[] = [];
  for (const m of props.members) {
    if (
      m.lat < sw.getLat() - latM ||
      m.lat > ne.getLat() + latM ||
      m.lng < sw.getLng() - lngM ||
      m.lng > ne.getLng() + lngM
    )
      continue;
    const p = px(m.lat, m.lng);
    if (!p) continue;
    out.push({ m, x: p.x, y: p.y, ox: 0, oy: 0 });
  }
  return out;
}

function add(content: HTMLElement, lat: number, lng: number, z: number) {
  const o = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(lat, lng),
    content,
    yAnchor: 0.5,
    xAnchor: 0.5,
    zIndex: z,
  });
  o.setMap(map);
  overlays.push(o);
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
    add(el, n.c.lat, n.c.lng, n.s.region === props.selected ? 10 : 1);
    if (Math.hypot(n.ox, n.oy) > 22) {
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:7px;height:7px;border-radius:50%;background:#3182F6;border:2px solid #fff;transform:translate(-50%,-50%);box-shadow:0 0 2px rgba(0,0,0,.4);";
      add(dot, n.c.lat, n.c.lng, 0);
    }
  }
}

function renderMarkers(nodes: any[]) {
  declutter(nodes, 40, 40, 3);
  let focused: any = null;
  for (const n of nodes) {
    const isF = n.m.id === focusedId.value;
    if (isF) focused = n;
    const el = document.createElement("div");
    el.style.cssText = `transform:translate(${Math.round(n.ox)}px, ${Math.round(n.oy)}px);`;
    el.innerHTML = faceHtml(n.m, isF);
    el.addEventListener("click", async () => {
      focusedId.value = n.m.id;
      emit("select", n.m.region);
      render();
      await loadShapes();
      if (focusedId.value === n.m.id) drawPolygons(n.m.id);
    });
    add(el, n.m.lat, n.m.lng, isF ? 20 : 1);
  }
  // 선거구 라벨은 지도 위 오버레이 대신 좌상단 배너로(마커 클릭 가림 방지)
}

const focusedMember = computed(() => props.members.find((m) => m.id === focusedId.value) ?? null);

function render() {
  if (!kakao || !map) return;
  clearOverlays();
  clearPolygons();
  const level = map.getLevel();
  // 줌인(<=10)이면 인원 많아도 얼굴(declutter로 분산), 11~12는 과밀 시 버블
  const pts = level <= FACE_LEVEL ? membersInView() : [];
  const cap = level <= 10 ? 400 : 120;
  if (pts.length && pts.length <= cap) {
    renderMarkers(pts);
    if (focusedId.value && shapes) drawPolygons(focusedId.value); // 줌/이동 후에도 유지
  } else renderBubbles();
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
onBeforeUnmount(() => {
  clearOverlays();
  clearPolygons();
});
</script>

<template>
  <div class="relative">
    <div ref="mapEl" class="w-full h-[640px] lg:h-[760px] rounded-2xl overflow-hidden bg-toss-gray-100" />
    <!-- 클릭한 의원 정보(좌상단 배너) — 마커 위를 덮지 않아 클릭 방해 없음 -->
    <NuxtLink
      v-if="status === 'ready' && focusedMember"
      :to="`/members/${focusedMember.id}`"
      class="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 card-shadow hover:bg-card"
    >
      <MemberAvatar :id="focusedMember.id" :name="focusedMember.name" :party="focusedMember.party" :photo="''" :size="32" />
      <div class="leading-tight">
        <p class="text-[13px] font-bold text-toss-gray-900">{{ focusedMember.name }} <span class="text-[11px] font-semibold" :style="{ color: focusedMember.color }">{{ focusedMember.party }}</span></p>
        <p class="text-[11px] text-toss-gray-500">{{ focusedMember.origin }}</p>
      </div>
    </NuxtLink>
    <div
      v-else-if="status === 'ready'"
      class="absolute left-3 top-3 z-10 rounded-lg bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-toss-gray-500 card-shadow pointer-events-none"
    >
      확대하면 의원 얼굴 · 클릭하면 선거구 표시
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
