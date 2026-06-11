<script setup lang="ts">
import { Map as MapIcon, X } from "lucide-vue-next";
import type { WealthData } from "#shared/types";
import { normalizeParty, partyColor } from "~/lib/party";

// 의원 부동산(본인·배우자 주택) 시군구 분포 — 축소: 채수 버블 / 확대: 보유 의원 얼굴(의원 지도와 동일 UX).
// 좌표·구별 명단은 빌드타임 베이크(homesMap). 개인정보 고려로 위치는 시군구 중심점까지만(동·아파트 핀 없음).
const props = defineProps<{ data: WealthData }>();

type GuItem = WealthData["homesMap"][number];

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
const active = ref<GuItem | null>(null);
const router = useRouter();
let kakao: any = null;
let map: any = null;
let overlays: any[] = [];

const FACE_LEVEL = 9; // 이보다 확대되면 얼굴 마커
const maxCount = Math.max(...props.data.homesMap.map((h) => h.count), 1);

function clearOverlays() {
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
}

function bubbleHtml(gu: string, count: number, isActive: boolean) {
  const t = count / maxCount;
  const size = Math.round(34 + t * 38);
  const hot = t > 0.6 ? "#F04452" : t > 0.3 ? "#FF9500" : "#3182F6";
  const ring = isActive ? "3px solid #191F28" : "2px solid #fff";
  return `
    <div style="cursor:pointer;width:${size}px;height:${size}px;border-radius:50%;
                background:${hot};opacity:.9;border:${ring};
                box-shadow:0 2px 8px rgba(0,0,0,.3);display:grid;place-items:center;
                color:#fff;font-family:Pretendard,sans-serif;text-align:center;line-height:1.05;">
      <div>
        <div style="font-size:${Math.max(10, Math.round(size * 0.21))}px;font-weight:800;">${count}</div>
        <div style="font-size:9px;font-weight:600;opacity:.95;">${gu.split(" ").pop()}</div>
      </div>
    </div>`;
}

function faceHtml(m: { id: string; name: string; party: string }, gu: string) {
  const initial = (m.name || "").slice(0, 1);
  const color = partyColor(m.party);
  return `
    <div title="${m.name} · ${gu}" style="cursor:pointer;position:relative;
                width:36px;height:36px;border-radius:50%;background:${color};border:2px solid ${color};
                box-shadow:0 1px 5px rgba(0,0,0,.35);overflow:hidden;display:grid;place-items:center;
                color:#fff;font:700 14px Pretendard,sans-serif;">
      <span style="position:absolute;">${initial}</span>
      <img src="/m/${m.id}.webp" alt="${m.name}"
           style="position:relative;width:100%;height:100%;object-fit:cover;object-position:top;display:block;"
           onerror="this.remove()" />
    </div>`;
}

function px(lat: number, lng: number) {
  try {
    const p = map.getProjection().containerPointFromCoords(new kakao.maps.LatLng(lat, lng));
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}
function coord(x: number, y: number) {
  return map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(x, y));
}

// 겹침 분산 (KakaoMemberMap 의 declutter 축약판) — 오프셋을 좌표에 반영해 히트영역 일치
function declutter(nodes: { x: number; y: number; ox: number; oy: number }[], w: number, h: number, pad: number) {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!;
        const dx = b.x + b.ox - (a.x + a.ox);
        const dy = b.y + b.oy - (a.y + a.oy);
        const ox = w + pad - Math.abs(dx);
        const oy = h + pad - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox <= oy) {
            const s = ((dx < 0 ? -1 : 1) * ox) / 2;
            a.ox -= s; b.ox += s;
          } else {
            const s = ((dy < 0 ? -1 : 1) * oy) / 2;
            a.oy -= s; b.oy += s;
          }
        }
      }
    }
    if (!moved) break;
  }
}

function add(el: HTMLElement, pos: any, z: number) {
  const o = new kakao.maps.CustomOverlay({
    position: pos,
    content: el,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: z,
    clickable: true, // 없으면 클릭이 지도로 통과
  });
  o.setMap(map);
  overlays.push(o);
}

function inView(h: GuItem) {
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return h.lat >= sw.getLat() && h.lat <= ne.getLat() && h.lng >= sw.getLng() && h.lng <= ne.getLng();
}

function renderBubbles() {
  for (const h of props.data.homesMap) {
    const el = document.createElement("div");
    el.innerHTML = bubbleHtml(h.gu, h.count, active.value?.gu === h.gu);
    el.addEventListener("click", () => {
      active.value = active.value?.gu === h.gu ? null : h;
      render();
    });
    add(el, new kakao.maps.LatLng(h.lat, h.lng), active.value?.gu === h.gu ? 1000 : h.count);
  }
}

function renderFaces() {
  // 화면 안 구들의 보유 의원을 구 중심점 주변에 분산 배치 (여러 구 보유자는 구마다 표시)
  const nodes: any[] = [];
  for (const h of props.data.homesMap) {
    if (!inView(h)) continue;
    const p = px(h.lat, h.lng);
    if (!p) continue;
    for (const m of h.members) nodes.push({ m, gu: h.gu, x: p.x, y: p.y, ox: 0, oy: 0 });
  }
  if (nodes.length > 260) return renderBubbles(); // 과밀 시 버블 폴백
  declutter(nodes, 38, 38, 3);
  for (const n of nodes) {
    const el = document.createElement("div");
    el.innerHTML = faceHtml(n.m, n.gu);
    el.addEventListener("click", () => router.push(`/members/${n.m.id}`));
    add(el, coord(n.x + n.ox, n.y + n.oy), 1);
  }
}

function render() {
  if (!kakao || !map) return;
  clearOverlays();
  if (map.getLevel() <= FACE_LEVEL) renderFaces();
  else renderBubbles();
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
      // 중심을 수도권 남부로 — 전국(level 13)도 다 보이고, 확대하면 바로 수도권 얼굴 마커가 뜬다(집 대부분 수도권)
      center: new kakao.maps.LatLng(37.0, 127.2),
      level: 13,
      draggable: true,
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    kakao.maps.event.addListener(map, "idle", render);
    render();
    status.value = "ready";
  } catch {
    status.value = "error";
  }
});
onBeforeUnmount(clearOverlays);
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <MapIcon class="size-4 text-toss-blue" /> 의원 부동산 지도
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      본인·배우자 소유 주택(아파트·주택·오피스텔 등)의 시군구 분포. 버블을 누르면 명단,
      확대하면 보유 의원 얼굴이 보여요. 위치는 시군구 중심 기준입니다.
    </p>
    <div class="mt-4 relative">
      <div ref="mapEl" class="w-full h-[460px] lg:h-[560px] rounded-xl overflow-hidden bg-toss-gray-100" />

      <!-- 안내 / 클릭한 동네 보유 의원 패널 -->
      <div
        v-if="status === 'ready' && !active"
        class="absolute left-3 top-3 z-10 rounded-lg bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-toss-gray-500 card-shadow pointer-events-none"
      >
        확대하면 보유 의원 얼굴 · 버블 클릭하면 명단
      </div>
      <div
        v-if="status === 'ready' && active"
        class="absolute left-3 top-3 z-10 w-[230px] max-h-[80%] overflow-y-auto rounded-xl bg-card/95 p-3 card-shadow"
      >
        <div class="flex items-center justify-between mb-2">
          <p class="text-[13px] font-bold text-toss-gray-900">
            🏠 {{ active.gu }} <span class="text-toss-blue">{{ active.count }}채</span>
          </p>
          <button type="button" class="text-toss-gray-400 hover:text-toss-gray-600" @click="active = null">
            <X class="size-4" />
          </button>
        </div>
        <ul class="space-y-1">
          <li v-for="m in active.members" :key="m.id">
            <NuxtLink
              :to="`/members/${m.id}`"
              class="group flex items-center gap-2 rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-toss-gray-50"
            >
              <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="26" />
              <span class="text-[13px] font-semibold text-toss-gray-800 group-hover:text-toss-blue truncate">{{ m.name }}</span>
              <span class="text-[11px] text-toss-gray-400 ml-auto shrink-0">{{ normalizeParty(m.party) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

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
