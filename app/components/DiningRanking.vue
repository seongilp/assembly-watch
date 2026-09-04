<script setup lang="ts">
/** 음식종류(분야)별 방문 TOP 10 — 표로는 안 보이는 "분야 안에서의 순위"를 드러낸다. */
import type { DiningRestaurant } from "#shared/types";

const props = defineProps<{ restaurants: DiningRestaurant[]; topN?: number }>();
const N = computed(() => props.topN ?? 10);

const EMOJI: Record<string, string> = {
  한식: "🍚", "카페·음료": "☕", "고기·구이": "🥩", 일식: "🍣", 중식: "🥢",
  양식: "🍝", "분식·면": "🍜", 구내식당: "🍱", 주점: "🍺", 기타: "🍽️",
};

/** 방문수 상위 종류부터. 각 종류 안에서는 방문수 내림차순 TOP N. */
const groups = computed(() => {
  const by = new Map<string, DiningRestaurant[]>();
  for (const r of props.restaurants) {
    if (!by.has(r.cuisine)) by.set(r.cuisine, []);
    by.get(r.cuisine)!.push(r);
  }
  return [...by.entries()]
    .map(([cuisine, list]) => {
      const rows = [...list].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
      return {
        cuisine,
        total: rows.reduce((s, r) => s + r.visits, 0),
        rows: rows.slice(0, N.value),
      };
    })
    .sort((a, b) => b.total - a.total);
});

const won = (n: number) => n.toLocaleString("ko-KR");
const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    <section
      v-for="g in groups" :key="g.cuisine"
      class="rounded-2xl bg-card card-shadow p-4"
    >
      <h3 class="flex items-baseline gap-1.5 text-[14px] font-bold text-toss-gray-900">
        <span>{{ EMOJI[g.cuisine] ?? "🍽️" }}</span>{{ g.cuisine }}
        <span class="ml-auto text-[11px] font-semibold text-toss-gray-400">
          방문 {{ won(g.total) }}회
        </span>
      </h3>

      <ol class="mt-2.5 space-y-1">
        <li v-for="(r, i) in g.rows" :key="r.id">
          <NuxtLink
            :to="`/dining/${r.id}`"
            class="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-toss-gray-50 transition-colors"
          >
            <span
              class="w-5 shrink-0 text-center text-[12px] font-bold tabular-nums"
              :class="i < 3 ? '' : 'text-toss-gray-400'"
            >{{ medal(i) }}</span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold text-toss-gray-800 group-hover:text-toss-blue">
                {{ r.name }}
              </span>
              <span class="block h-1 mt-1 rounded-full bg-toss-gray-100">
                <span
                  class="block h-full rounded-full bg-toss-blue/70"
                  :style="{ width: `${Math.max(6, (r.visits / g.rows[0].visits) * 100)}%` }"
                />
              </span>
            </span>

            <span class="shrink-0 text-right">
              <span class="block text-[12px] font-bold tabular-nums text-toss-gray-700">{{ won(r.visits) }}회</span>
              <span class="block text-[10px] tabular-nums text-toss-gray-400">{{ won(r.members) }}명</span>
            </span>
          </NuxtLink>
        </li>
      </ol>
    </section>
  </div>
</template>
