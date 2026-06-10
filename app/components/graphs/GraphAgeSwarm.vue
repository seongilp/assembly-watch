<script setup lang="ts">
import { CakeSlice } from "lucide-vue-next";
import type { GraphData } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();

const ages = computed(() => props.data.age.list.map((m) => m.age));
const minA = computed(() => Math.min(...ages.value));
const maxA = computed(() => Math.max(...ages.value));

const W = 1000, H = 260, PADX = 24, PADY = 20;
// beeswarm: 나이별로 세로 적층(겹침 방지)
const dots = computed(() => {
  const span = maxA.value - minA.value || 1;
  const colCount = new Map<number, number>();
  return props.data.age.list.map((m) => {
    const x = PADX + ((m.age - minA.value) / span) * (W - 2 * PADX);
    const col = Math.round(m.age);
    const k = colCount.get(col) ?? 0;
    colCount.set(col, k + 1);
    // 중앙 기준 위아래 번갈아 적층
    const dir = k % 2 === 0 ? 1 : -1;
    const layer = Math.ceil(k / 2);
    const y = H / 2 + dir * layer * 9;
    return { ...m, x, y };
  });
});

const avgX = computed(() => {
  const span = maxA.value - minA.value || 1;
  return PADX + ((props.data.age.avg - minA.value) / span) * (W - 2 * PADX);
});
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <CakeSlice class="size-4 text-toss-blue" /> 세대 스펙트럼
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      의원 {{ data.age.list.length }}명의 나이 분포 · 평균 <b class="text-toss-gray-700">{{ data.age.avg }}세</b>. 점 하나가 의원 한 명입니다.
    </p>

    <div class="mt-4">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full rounded-xl bg-toss-gray-50">
        <!-- 평균선 -->
        <line :x1="avgX" :x2="avgX" :y1="PADY" :y2="H - PADY" stroke="#8B95A1" stroke-width="1.5" stroke-dasharray="4 4" />
        <text :x="avgX" :y="PADY - 4" text-anchor="middle" class="fill-toss-gray-400" style="font-size:13px;font-weight:700">평균 {{ data.age.avg }}</text>
        <circle
          v-for="d in dots"
          :key="d.id"
          :cx="d.x"
          :cy="d.y"
          r="4.5"
          :fill="partyColor(d.party)"
          opacity="0.8"
        />
      </svg>
      <div class="mt-1 flex justify-between text-[11px] text-toss-gray-400 px-1">
        <span>{{ minA }}세</span><span>{{ maxA }}세</span>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-4">
      <div>
        <p class="text-[12px] font-bold text-toss-blue mb-2">최연소 TOP 5</p>
        <ul class="space-y-1.5">
          <li v-for="m in data.age.youngest" :key="m.id">
            <NuxtLink :to="`/members/${m.id}`" class="flex items-center gap-2 hover:opacity-80">
              <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="28" />
              <span class="text-[13px] font-semibold text-toss-gray-800 truncate">{{ m.name }}</span>
              <span class="text-[12px] font-extrabold tabular-nums text-toss-blue ml-auto">{{ m.age }}세</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div>
        <p class="text-[12px] font-bold text-toss-gray-500 mb-2">최고령 TOP 5</p>
        <ul class="space-y-1.5">
          <li v-for="m in data.age.oldest" :key="m.id">
            <NuxtLink :to="`/members/${m.id}`" class="flex items-center gap-2 hover:opacity-80">
              <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="28" />
              <span class="text-[13px] font-semibold text-toss-gray-800 truncate">{{ m.name }}</span>
              <span class="text-[12px] font-extrabold tabular-nums text-toss-gray-600 ml-auto">{{ m.age }}세</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
