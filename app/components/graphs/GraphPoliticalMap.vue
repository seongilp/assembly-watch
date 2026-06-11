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
      <svg viewBox="0 0 1000 1000" class="w-full aspect-square rounded-xl bg-toss-gray-50">
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
      <div
        v-else-if="active"
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
