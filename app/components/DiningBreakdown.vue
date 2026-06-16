<script setup lang="ts">
import type { DiningBreakdownRow } from "#shared/types";
const props = defineProps<{ title: string; rows: DiningBreakdownRow[]; denom?: string }>();
const won = (n: number) => n.toLocaleString("ko-KR");
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.avgMeal)));
</script>

<template>
  <div class="rounded-2xl border border-toss-gray-200 bg-card p-5">
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="font-bold text-toss-gray-900">{{ title }}</h3>
      <span v-if="denom" class="text-[11px] text-toss-gray-400">{{ denom }}</span>
    </div>
    <ul class="space-y-2">
      <li v-for="r in rows" :key="r.key" class="text-sm">
        <div class="flex justify-between"><span class="font-semibold">{{ r.key }} <span class="text-toss-gray-400 font-normal">({{ r.n }}명)</span></span><span class="text-toss-gray-500">평균 {{ won(r.avgMeal) }}원 · {{ r.topCuisine }}<span v-if="r.topRestaurant" class="text-toss-gray-400"> · 단골 {{ r.topRestaurant }}</span></span></div>
        <div class="mt-1 h-2 rounded-full bg-toss-gray-100 overflow-hidden"><div class="h-full bg-toss-blue rounded-full" :style="{ width: `${Math.min(100, (r.avgMeal / max) * 100)}%` }" /></div>
      </li>
    </ul>
  </div>
</template>
