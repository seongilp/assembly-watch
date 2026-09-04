<script setup lang="ts">
import { List, Map as MapIcon, Trophy } from "lucide-vue-next";
import type { DiningData } from "#shared/types";
import { safeUrl } from "~/lib/safe";

const { data } = await useFetch<DiningData>("/api/dining", { key: "dining" });

const route = useRoute();
// 펀팩트 식당 랭킹에서 식당 클릭 시 ?q=가게명 으로 진입 → 검색어 프리필.
// /dining 은 프리렌더 정적 페이지라 SSR 시 query 가 비어 있으므로, 클라이언트에서 URL query 를 반영한다.
const q = ref(typeof route.query.q === "string" ? route.query.q : "");
const applyQuery = (v: unknown) => { if (typeof v === "string") q.value = v; };
onMounted(() => applyQuery(route.query.q));
watch(() => route.query.q, applyQuery);

const view = ref<"list" | "map" | "rank">("list");
const cuisine = ref<string>("전체");

// 칩 순서는 방문수 순(data.cuisine)을 따른다 — 자주 쓰는 종류가 앞에 온다.
// 목록에 실제로 존재하는 종류만 남긴다(빈 결과를 내는 칩을 만들지 않는다).
const cuisineTypes = computed(() => {
  const present = new Set((data.value?.restaurants ?? []).map((r) => r.cuisine));
  const ranked = (data.value?.cuisine ?? []).map((c) => c.type).filter((c) => present.has(c));
  const rest = [...present].filter((c) => !ranked.includes(c)).sort();
  return ["전체", ...ranked, ...rest];
});

const matches = (name: string, c: string) => {
  const term = q.value.trim();
  return (cuisine.value === "전체" || c === cuisine.value) && (!term || name.includes(term));
};

const restaurants = computed(() =>
  (data.value?.restaurants ?? []).filter((r) => matches(r.name, r.cuisine)),
);
// 지도는 좌표가 확보된 식당만 — 목록과 같은 필터를 그대로 적용한다.
const points = computed(() =>
  (data.value?.mapPoints ?? []).filter((p) => matches(p.name, p.cuisine)),
);

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

    <div class="my-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="q" placeholder="식당 검색" class="max-w-xs" />
        <div class="inline-flex rounded-lg bg-toss-gray-100 p-0.5">
          <button
            v-for="v in ([{ k: 'list', label: '목록', icon: List }, { k: 'rank', label: '랭킹', icon: Trophy }, { k: 'map', label: '지도', icon: MapIcon }] as const)"
            :key="v.k" type="button" @click="view = v.k"
            class="inline-flex items-center gap-1 rounded-md px-3 py-1 text-[13px] font-semibold transition-colors"
            :class="view === v.k ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500 hover:text-toss-gray-800'"
          >
            <component :is="v.icon" class="size-3.5" /> {{ v.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in cuisineTypes" :key="c" type="button" @click="cuisine = c"
          class="rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors"
          :class="cuisine === c ? 'bg-toss-blue text-white' : 'bg-toss-gray-100 text-toss-gray-600 hover:bg-toss-gray-200'"
        >{{ c }}</button>
      </div>
    </div>

    <DiningRanking v-if="view === 'rank'" :restaurants="restaurants" />

    <ClientOnly v-else-if="view === 'map'">
      <DiningPlaceMap :points="points" :highlight="q.trim()" />
      <template #fallback>
        <div class="w-full h-[70vh] min-h-[460px] lg:h-[78vh] lg:min-h-[640px] rounded-2xl bg-toss-gray-100" />
      </template>
    </ClientOnly>

    <div v-else class="rounded-2xl border border-toss-gray-200 bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-toss-gray-50 text-toss-gray-500">
          <tr><th class="text-left px-4 py-2">식당</th><th class="px-4 py-2">종류(추정)</th><th class="px-4 py-2">방문</th><th class="px-4 py-2">금액</th><th class="px-4 py-2">의원수</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in restaurants.slice(0, 100)" :key="r.name" class="border-t border-toss-gray-100" :class="r.name === q.trim() ? 'bg-toss-blue/10' : ''">
            <td class="px-4 py-2 font-semibold">
              <NuxtLink :to="`/dining/${r.id}`" class="hover:text-toss-blue transition-colors">{{ r.name }}</NuxtLink>
              <span v-if="r.gu" class="ml-1 text-[11px] text-toss-gray-400">{{ r.gu }}</span>
            </td>
            <td class="px-4 py-2 text-center text-toss-gray-500">{{ r.cuisine }}</td>
            <td class="px-4 py-2 text-center">{{ r.visits }}</td>
            <td class="px-4 py-2 text-right">{{ won(r.amount) }}원</td>
            <td class="px-4 py-2 text-center">{{ r.members }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-[11px] text-toss-gray-400">
      자료: <a v-if="safeUrl(data?.source.url)" :href="safeUrl(data?.source.url)" target="_blank" rel="noopener" class="font-semibold hover:text-toss-blue">{{ data?.source.name }}</a>
      · {{ data?.basis }} · 음식종류는 가게명·업종 기반 추정입니다.
      <template v-if="view === 'map'">지도는 주소가 확인된 식당({{ data?.coverage.addrYears.at(0) }}~{{ data?.coverage.addrYears.at(-1) }})만 표시됩니다.</template>
    </p>
  </div>
</template>
