<script setup lang="ts">
import { Hourglass } from "lucide-vue-next";
import type { GraphData } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();
const minA = computed(() => Math.min(...props.data.partyAge.map((p) => p.avg)));
const maxA = computed(() => Math.max(...props.data.partyAge.map((p) => p.avg)));
// 막대 길이를 차이가 도드라지게 (min-10 ~ max 범위 매핑)
function w(avg: number) {
  const lo = minA.value - 5, hi = maxA.value;
  return Math.round(((avg - lo) / (hi - lo)) * 100);
}
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Hourglass class="size-4 text-toss-blue" /> 정당별 평균 연령
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">어느 당이 가장 젊을까? (소속 의원 평균 나이, 2명 이상 정당)</p>

    <ul class="mt-4 space-y-2.5">
      <li v-for="(p, i) in data.partyAge" :key="p.party" class="flex items-center gap-3">
        <span class="w-24 shrink-0 text-[12px] font-semibold text-toss-gray-600 truncate text-right">{{ p.party }}</span>
        <div class="flex-1">
          <div
            class="h-6 rounded-md flex items-center justify-end pr-2"
            :style="{ width: Math.max(w(p.avg), 12) + '%', background: partyColor(p.party) }"
          >
            <span class="text-[11px] font-extrabold text-white tabular-nums">{{ p.avg }}세</span>
          </div>
        </div>
        <span v-if="i === 0" class="text-[11px] font-bold text-toss-blue shrink-0">최연소</span>
        <span v-else-if="i === data.partyAge.length - 1" class="text-[11px] font-bold text-toss-gray-400 shrink-0">최고령</span>
      </li>
    </ul>
  </section>
</template>
