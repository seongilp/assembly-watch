<script setup lang="ts">
import { ArrowLeft, ExternalLink, Search } from "lucide-vue-next";
import { normalizeParty } from "~/lib/party";
import { formatDateTime, voteStyle } from "~/lib/format";

const partyColor = usePartyColor();

const route = useRoute();
const billId = computed(() => String(route.params.billId));

const { data, pending, error } = await useFetch(`/api/votes/${billId.value}`);

const view = ref<"list" | "party" | "region">("list");
const VIEWS = [
  { key: "list", label: "명단" },
  { key: "party", label: "정당별" },
  { key: "region", label: "지역별" },
] as const;

const resultFilter = ref<string>("전체");
const partyFilter = ref<string>("전체");
const search = ref("");

const RESULTS = ["전체", "찬성", "반대", "기권", "불참"];

const parties = computed(() => {
  const set = new Set<string>();
  for (const r of data.value?.rows ?? []) set.add(normalizeParty(r.party));
  return [...set];
});

const filtered = computed(() => {
  const q = search.value.trim();
  return (data.value?.rows ?? []).filter((r) => {
    if (resultFilter.value !== "전체" && !r.result.includes(resultFilter.value))
      return false;
    if (partyFilter.value !== "전체" && normalizeParty(r.party) !== partyFilter.value)
      return false;
    if (q && !r.name.includes(q)) return false;
    return true;
  });
});

const tallyItems = computed(() => {
  const t = data.value?.tally;
  if (!t) return [];
  return [
    { label: "찬성", value: t.찬성, color: "#3182F6" },
    { label: "반대", value: t.반대, color: "#F04452" },
    { label: "기권", value: t.기권, color: "#FF9500" },
    { label: "불참", value: t.불참, color: "#B0B8C1" },
  ];
});

useHead({ title: () => `${data.value?.bill?.billName ?? "표결"} · 의정감시` });
</script>

<template>
  <div>
    <NuxtLink
      to="/votes"
      class="inline-flex items-center gap-1 text-[13px] font-semibold text-toss-gray-500 hover:text-toss-blue mb-5"
    >
      <ArrowLeft class="size-4" /> 본회의 표결 목록
    </NuxtLink>

    <DataState :pending="pending" :error="error" :empty="!data?.rows?.length"
      empty-text="이 안건의 의원별 표결 데이터가 없습니다." :skeleton-rows="6">
      <!-- 의안 헤더 -->
      <section class="rounded-2xl bg-card card-shadow p-6 sm:p-7 mb-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-[12px] font-semibold text-toss-gray-400">
                #{{ data?.bill?.billNo }}
              </span>
              <ResultBadge v-if="data?.bill?.procResult" :text="data.bill.procResult" size="sm" />
            </div>
            <h1 class="text-[19px] sm:text-[22px] font-extrabold text-toss-gray-900 leading-snug">
              {{ data?.bill?.billName }}
            </h1>
            <p class="mt-2 text-[13px] text-toss-gray-500">
              {{ formatDateTime(data?.bill?.date) }}
              <template v-if="data?.bill?.committee"> · {{ data.bill.committee }}</template>
            </p>
          </div>
          <a
            v-if="billId"
            :href="`https://likms.assembly.go.kr/bill/billDetail.do?billId=${billId}`"
            target="_blank"
            class="hidden sm:inline-flex items-center gap-1 rounded-xl bg-toss-gray-50 px-3 py-2 text-[12px] font-semibold text-toss-gray-600 hover:bg-toss-gray-100 shrink-0"
          >
            의안원문 <ExternalLink class="size-3.5" />
          </a>
        </div>

        <!-- 집계 -->
        <div class="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
          <div
            v-for="t in tallyItems"
            :key="t.label"
            class="rounded-xl bg-toss-gray-50 p-3 text-center"
          >
            <p class="text-[12px] font-semibold text-toss-gray-500">{{ t.label }}</p>
            <p class="mt-0.5 text-[22px] sm:text-[26px] font-extrabold tabular-nums" :style="{ color: t.color }">
              {{ t.value }}
            </p>
          </div>
        </div>
      </section>

      <!-- 뷰 전환 -->
      <div class="inline-flex rounded-2xl bg-toss-gray-100 p-1 mb-4">
        <button
          v-for="v in VIEWS"
          :key="v.key"
          class="rounded-xl px-4 sm:px-5 py-2 text-[14px] font-bold transition-all"
          :class="view === v.key ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
          @click="view = v.key"
        >
          {{ v.label }}
        </button>
      </div>

      <!-- 정당별 -->
      <VoteByParty v-if="view === 'party'" :records="data?.rows ?? []" />

      <!-- 지역별 -->
      <VoteByRegion v-else-if="view === 'region'" :records="data?.rows ?? []" />

      <!-- 명단 -->
      <template v-else>
      <!-- 필터 -->
      <div class="space-y-3 mb-4">
        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="r in RESULTS"
            :key="r"
            class="rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors"
            :style="
              resultFilter === r && r !== '전체'
                ? { color: '#fff', backgroundColor: voteStyle(r).fg }
                : {}
            "
            :class="
              resultFilter === r
                ? r === '전체'
                  ? 'bg-foreground text-background'
                  : ''
                : 'bg-card text-toss-gray-600 hover:bg-toss-gray-100 card-shadow'
            "
            @click="resultFilter = r"
          >
            {{ r }}
          </button>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-[16px] text-toss-gray-400" />
            <input
              v-model="search"
              placeholder="의원 이름 검색"
              class="w-full h-11 rounded-xl border-0 bg-card pl-10 pr-3 text-[14px] card-shadow focus:outline-none focus:ring-2 focus:ring-toss-blue/40"
            />
          </div>
          <select
            v-model="partyFilter"
            class="h-11 rounded-xl border-0 bg-card px-3 text-[14px] font-medium text-toss-gray-700 card-shadow focus:outline-none focus:ring-2 focus:ring-toss-blue/40"
          >
            <option>전체</option>
            <option v-for="p in parties" :key="p">{{ p }}</option>
          </select>
        </div>
      </div>

      <p class="mb-3 text-[13px] text-toss-gray-500">
        <b class="text-toss-gray-900">{{ filtered.length }}</b>명
      </p>

      <!-- 명단 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div
          v-for="(r, i) in filtered"
          :key="r.name + i"
          class="flex items-center gap-3 rounded-xl bg-card px-4 py-3 card-shadow"
        >
          <div
            class="grid place-items-center size-9 shrink-0 rounded-full text-white text-[13px] font-bold"
            :style="{ backgroundColor: partyColor(r.party) }"
          >
            {{ r.name.slice(0, 1) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[14px] font-bold text-toss-gray-900">{{ r.name }}</p>
            <p class="text-[12px] text-toss-gray-400 truncate">
              {{ normalizeParty(r.party) }}<template v-if="r.origin"> · {{ r.origin }}</template>
            </p>
          </div>
          <span
            class="rounded-lg px-2.5 py-1 text-[12px] font-bold shrink-0"
            :style="{ color: voteStyle(r.result).fg, backgroundColor: voteStyle(r.result).bg }"
          >
            {{ r.result }}
          </span>
        </div>
      </div>
      </template>
    </DataState>
  </div>
</template>
