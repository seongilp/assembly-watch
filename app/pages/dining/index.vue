<script setup lang="ts">
import { Utensils } from "lucide-vue-next";
import type { DiningData } from "#shared/types";

const { data } = await useFetch<DiningData>("/api/dining", { key: "dining" });

const q = ref("");
const cuisine = ref<string>("전체");
const cuisineTypes = computed(() => ["전체", ...new Set((data.value?.restaurants ?? []).map((r) => r.cuisine))]);
const restaurants = computed(() => {
  const term = q.value.trim();
  return (data.value?.restaurants ?? []).filter(
    (r) => (cuisine.value === "전체" || r.cuisine === cuisine.value) && (!term || r.name.includes(term)),
  );
});
const won = (n: number) => n.toLocaleString("ko-KR");

useHead({ title: "정치자금 맛집 · 의정감시" });
useSeoMeta({
  description: "국회의원 정치자금 지출내역으로 본, 정치인이 pick한 식당 — 자료: 오마이뉴스·경향신문·뉴스타파",
  ogTitle: "정치인이 pick한 식당 — 정치자금 맛집",
  ogImage: "https://asm.zihado.com/og-insights.png",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <div>
    <PageHeader eyebrow="정치자금 지출내역" title="정치인이 pick한 식당" :subtitle="`${data?.coverage.rows.toLocaleString() ?? 0}건 식당 지출 · ${data?.years.at(0)}~${data?.years.at(-1)}`" />

    <div class="flex flex-wrap gap-2 my-4">
      <Input v-model="q" placeholder="식당 검색" class="max-w-xs" />
      <select v-model="cuisine" class="rounded-lg border border-toss-gray-200 px-3 text-sm">
        <option v-for="c in cuisineTypes" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div class="rounded-2xl border border-toss-gray-200 bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-toss-gray-50 text-toss-gray-500">
          <tr><th class="text-left px-4 py-2">식당</th><th class="px-4 py-2">종류(추정)</th><th class="px-4 py-2">방문</th><th class="px-4 py-2">금액</th><th class="px-4 py-2">의원수</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in restaurants.slice(0, 100)" :key="r.name" class="border-t border-toss-gray-100">
            <td class="px-4 py-2 font-semibold">{{ r.name }}<span v-if="r.gu" class="ml-1 text-[11px] text-toss-gray-400">{{ r.gu }}</span></td>
            <td class="px-4 py-2 text-center text-toss-gray-500">{{ r.cuisine }}</td>
            <td class="px-4 py-2 text-center">{{ r.visits }}</td>
            <td class="px-4 py-2 text-right">{{ won(r.amount) }}원</td>
            <td class="px-4 py-2 text-center">{{ r.members }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-[11px] text-toss-gray-400">
      자료: <a :href="data?.source.url" target="_blank" rel="noopener" class="font-semibold hover:text-toss-blue">{{ data?.source.name }}</a>
      · {{ data?.basis }} · 음식종류는 가게명·업종 기반 추정입니다.
    </p>
  </div>
</template>
