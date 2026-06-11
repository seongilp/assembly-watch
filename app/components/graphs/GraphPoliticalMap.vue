<script setup lang="ts">
import { Orbit } from "lucide-vue-next";
import type { GraphData, GraphNode } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();

// hover 는 미리보기, click 은 고정(pin) — 모바일에서 탭 즉시 이동 방지.
// 프로필 이동은 좌상단 카드(링크)를 눌렀을 때만.
const hovered = ref<GraphNode | null>(null);
const pinned = ref<GraphNode | null>(null);
const active = computed(() => pinned.value ?? hovered.value);

// 범례 정당 토글 (클릭 시 해당 정당만 강조)
const onlyParty = ref<string | null>(null);
function dim(n: GraphNode) {
  return onlyParty.value != null && n.party !== onlyParty.value;
}

function pick(n: GraphNode) {
  pinned.value = pinned.value?.id === n.id ? null : n;
}

// ── 줌/팬 (마우스 휠 + 모바일 핀치 + 드래그) — viewBox 조작 ──
const svgEl = ref<SVGSVGElement | null>(null);
const vb = ref({ x: 0, y: 0, w: 1000 }); // h는 w와 동일(정방형)
const viewBox = computed(() => `${vb.value.x} ${vb.value.y} ${vb.value.w} ${vb.value.w}`);
const zoomed = computed(() => vb.value.w < 999);

function clampVb(x: number, y: number, w: number) {
  w = Math.min(1000, Math.max(120, w));
  x = Math.min(1000 - w, Math.max(0, x));
  y = Math.min(1000 - w, Math.max(0, y));
  vb.value = { x, y, w };
}
function zoomAt(px: number, py: number, factor: number) {
  // px,py: svg 좌표계 기준 점 — 그 점이 고정되도록 줌
  const { x, y, w } = vb.value;
  const nw = w * factor;
  clampVb(px - (px - x) * (nw / w), py - (py - y) * (nw / w), nw);
}
function svgPoint(clientX: number, clientY: number) {
  const r = svgEl.value!.getBoundingClientRect();
  return {
    x: vb.value.x + ((clientX - r.left) / r.width) * vb.value.w,
    y: vb.value.y + ((clientY - r.top) / r.height) * vb.value.w,
  };
}
function onWheel(e: WheelEvent) {
  const p = svgPoint(e.clientX, e.clientY);
  zoomAt(p.x, p.y, e.deltaY > 0 ? 1.15 : 0.87);
}
// 터치: 1손가락 팬(줌 상태에서만 — 평소엔 페이지 스크롤 유지), 2손가락 핀치
let touches: { x: number; y: number }[] = [];
let pinchDist = 0;
function onTouchStart(e: TouchEvent) {
  touches = [...e.touches].map((t) => ({ x: t.clientX, y: t.clientY }));
  if (touches.length === 2) pinchDist = Math.hypot(touches[0]!.x - touches[1]!.x, touches[0]!.y - touches[1]!.y);
}
function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    e.preventDefault();
    const a = e.touches[0]!, b = e.touches[1]!;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchDist > 0) {
      const mid = svgPoint((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      zoomAt(mid.x, mid.y, pinchDist / d);
    }
    pinchDist = d;
  } else if (e.touches.length === 1 && zoomed.value && touches.length === 1) {
    e.preventDefault();
    const t = e.touches[0]!;
    const r = svgEl.value!.getBoundingClientRect();
    const dx = ((t.clientX - touches[0]!.x) / r.width) * vb.value.w;
    const dy = ((t.clientY - touches[0]!.y) / r.height) * vb.value.w;
    clampVb(vb.value.x - dx, vb.value.y - dy, vb.value.w);
    touches = [{ x: t.clientX, y: t.clientY }];
  }
}
function resetZoom() {
  vb.value = { x: 0, y: 0, w: 1000 };
}
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Orbit class="size-4 text-toss-blue" /> 정치 지형도
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      본회의 표결이 비슷한 의원일수록 가깝게 배치됩니다 ({{ data.nodeCount }}명 · 최근 {{ data.voteBills }}회 표결).
      점 위에 마우스를 올리거나 탭하면 누구인지 보여요.
    </p>

    <div class="mt-4 relative">
      <svg
        ref="svgEl"
        :viewBox="viewBox"
        class="w-full aspect-square rounded-xl bg-toss-gray-50"
        style="touch-action: pan-y pinch-zoom"
        @wheel.prevent="onWheel"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
      >
        <defs>
          <clipPath id="pm-clip"><circle cx="0" cy="0" r="26" /></clipPath>
        </defs>
        <!-- 일반 노드 -->
        <circle
          v-for="n in data.map.nodes"
          :key="n.id"
          :cx="n.x"
          :cy="n.y"
          :r="active && active.id === n.id ? 9 : 6"
          :fill="partyColor(n.party)"
          :opacity="dim(n) ? 0.12 : 0.85"
          stroke="#fff"
          stroke-width="1"
          class="cursor-pointer transition-[r,opacity]"
          @mouseenter="hovered = n"
          @mouseleave="hovered = null"
          @click="pick(n)"
        />
        <!-- 활성 노드: 사진 + 이름 -->
        <g v-if="active" :transform="`translate(${active.x},${active.y})`" class="pointer-events-none">
          <circle r="28" :fill="partyColor(active.party)" stroke="#fff" stroke-width="3" />
          <image
            :href="`/m/${active.id}.webp`"
            x="-26"
            y="-26"
            width="52"
            height="52"
            clip-path="url(#pm-clip)"
            preserveAspectRatio="xMidYMin slice"
          />
        </g>
      </svg>

      <!-- 활성 의원 이름표 (좌상단) — 고정(클릭) 상태면 카드 클릭으로 프로필 이동 -->
      <NuxtLink
        v-if="active && pinned"
        :to="`/members/${active.id}`"
        class="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 card-shadow hover:bg-card"
      >
        <MemberAvatar :id="active.id" :name="active.name" :party="active.party" :size="30" />
        <div class="leading-tight">
          <p class="text-[13px] font-bold text-toss-gray-900">{{ active.name }}</p>
          <p class="text-[11px] text-toss-gray-500">
            {{ active.party }}<template v-if="active.age"> · {{ active.age }}세</template> · 프로필 보기 →
          </p>
        </div>
      </NuxtLink>
      <!-- 줌 리셋 -->
      <button
        v-if="zoomed"
        type="button"
        class="absolute right-3 top-3 rounded-lg bg-card/95 px-2.5 py-1.5 text-[12px] font-bold text-toss-gray-600 card-shadow hover:bg-card"
        @click="resetZoom"
      >
        전체 보기
      </button>
      <div
        v-if="active && !pinned"
        class="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 card-shadow pointer-events-none"
      >
        <span class="size-2.5 rounded-full" :style="{ background: partyColor(active.party) }" />
        <div class="leading-tight">
          <p class="text-[13px] font-bold text-toss-gray-900">{{ active.name }}</p>
          <p class="text-[11px] text-toss-gray-500">
            {{ active.party }}<template v-if="active.age"> · {{ active.age }}세</template>
          </p>
        </div>
      </div>
    </div>

    <!-- 정당 범례 -->
    <div class="mt-4 flex flex-wrap gap-1.5">
      <button
        v-for="p in data.parties"
        :key="p.party"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors"
        :class="onlyParty === p.party ? 'text-white' : 'text-toss-gray-600 bg-toss-gray-50 hover:bg-toss-gray-100'"
        :style="onlyParty === p.party ? { background: partyColor(p.party) } : {}"
        @click="onlyParty = onlyParty === p.party ? null : p.party"
      >
        <span class="size-2.5 rounded-full" :style="{ background: partyColor(p.party) }" />
        {{ p.party }} {{ p.seats }}
      </button>
    </div>
  </section>
</template>
