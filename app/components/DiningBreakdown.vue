<script setup lang="ts">
import type { DiningBreakdownRow } from "#shared/types";
const props = withDefaults(defineProps<{ title: string; rows: DiningBreakdownRow[]; denom?: string; countUnit?: string }>(), { countUnit: "명" });
const won = (n: number) => n.toLocaleString("ko-KR");

// 음식종류 → 이모지 (단골 식당 종류 시각화)
const CUISINE_EMOJI: Record<string, string> = {
  한식: "🍚", 중식: "🥟", 일식: "🍣", 양식: "🍝", "고기·구이": "🥩",
  "분식·면": "🍜", "카페·음료": "☕", 주점: "🍻", 구내식당: "🍱", 기타: "🍽️",
};
const emoji = (c: string) => CUISINE_EMOJI[c] ?? "🍽️";

const stats = computed(() => {
  const vals = props.rows.map((r) => r.avgMeal);
  const min = Math.min(...vals), max = Math.max(...vals);
  return { min, max, span: Math.max(1, max - min) };
});
// 평균 식대를 0~1 로 정규화 → 색·막대 길이에 반영(차이가 눈에 보이게)
const norm = (v: number) => (v - stats.value.min) / stats.value.span;
// 파랑(저렴)→빨강(비쌈) RGB 보간 — 값이 클수록 뜨겁게
function heat(v: number) {
  const x = norm(v);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * x);
  return `rgb(${mix(0x31, 0xf0)},${mix(0x82, 0x44)},${mix(0xf6, 0x52)})`;
}
const barW = (v: number) => 30 + norm(v) * 70; // 30%~100% — 차이 강조
const topKey = computed(() => (props.rows.length ? props.rows.reduce((a, b) => (b.avgMeal > a.avgMeal ? b : a)).key : ""));
</script>

<template>
  <div class="self-start rounded-2xl border border-toss-gray-200 bg-card p-5">
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="font-bold text-toss-gray-900">{{ title }}</h3>
      <span v-if="denom" class="text-[11px] text-toss-gray-400">{{ denom }}</span>
    </div>
    <ul class="space-y-2.5">
      <li v-for="r in rows" :key="r.key" class="text-sm">
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-semibold whitespace-nowrap">
            <span v-if="r.key === topKey" title="이 그룹이 가장 비싸게 먹어요">👑 </span>{{ r.key }}
            <span class="text-toss-gray-400 font-normal">({{ r.n.toLocaleString() }}{{ countUnit }})</span>
          </span>
          <span class="text-toss-gray-500 text-right shrink-0">
            <span class="font-bold tabular-nums" :style="{ color: heat(r.avgMeal) }">{{ won(r.avgMeal) }}원</span><template v-if="r.topCuisine"> · {{ emoji(r.topCuisine) }} {{ r.topCuisine }}</template><span v-if="r.topRestaurant" class="text-toss-gray-400"> · 단골 {{ r.topRestaurant }}</span>
          </span>
        </div>
        <div class="mt-1.5 h-2.5 rounded-full bg-toss-gray-100 overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: `${barW(r.avgMeal)}%`, backgroundColor: heat(r.avgMeal) }" />
        </div>
      </li>
    </ul>
  </div>
</template>
