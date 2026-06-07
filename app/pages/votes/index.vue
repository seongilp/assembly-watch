<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as Arrow,
  Search,
} from "lucide-vue-next";
import type { VoteSummary, Paged } from "#shared/types";
import { formatDate } from "~/lib/format";

const page = ref(1);
const votedOnly = ref(true);
const search = ref("");
const size = 20;

watch(votedOnly, () => (page.value = 1));

const debounced = useDebounceFn(() => {
  page.value = 1;
}, 350);

const { data, pending, error } = await useFetch<Paged<VoteSummary>>("/api/votes", {
  query: {
    page,
    size,
    votedOnly: computed(() => (votedOnly.value ? 1 : 0)),
    q: search,
  },
});

const searching = computed(() => search.value.trim().length > 0);
const totalPages = computed(() =>
  searching.value
    ? 1
    : Math.min(50, Math.ceil((data.value?.totalCount ?? 0) / size)),
);

useHead({ title: "본회의 표결 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회"
      title="본회의 표결"
      subtitle="본회의에 부의된 안건의 찬반 결과 — 클릭하면 의원별 표결 명단을 확인합니다."
    />

    <div class="mb-5 space-y-3">
      <div class="relative">
        <Search
          class="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-toss-gray-400"
        />
        <input
          v-model="search"
          type="text"
          placeholder="의안명, 발의자, 위원회 검색"
          class="w-full h-12 rounded-2xl border-0 bg-white pl-11 pr-4 text-[15px] card-shadow focus:outline-none focus:ring-2 focus:ring-toss-blue/40"
          @input="debounced"
        />
      </div>

      <label
        class="inline-flex items-center gap-2 cursor-pointer select-none rounded-full bg-white px-3.5 py-2 card-shadow"
      >
        <input
          v-model="votedOnly"
          type="checkbox"
          class="size-4 rounded accent-toss-blue"
        />
        <span class="text-[13px] font-semibold text-toss-gray-600"
          >표결 집계가 있는 안건만</span
        >
      </label>
    </div>

    <p v-if="searching" class="mb-3 text-[13px] text-toss-gray-500">
      검색 결과 <b class="text-toss-gray-900">{{ data?.rows?.length ?? 0 }}</b>건
      <span class="text-toss-gray-400">· 최근 300건 범위</span>
    </p>

    <DataState
      :pending="pending"
      :error="error"
      :empty="!data?.rows?.length"
      :skeleton-rows="8"
    >
      <ul class="space-y-2.5">
        <li v-for="v in data?.rows" :key="v.billId">
          <NuxtLink
            :to="`/votes/${v.billId}`"
            class="group block rounded-2xl bg-white card-shadow p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
          >
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[12px] font-semibold text-toss-gray-400">#{{ v.billNo }}</span>
                  <span
                    v-if="v.billKind"
                    class="text-[11px] font-medium text-toss-gray-500 bg-toss-gray-100 rounded px-1.5 py-0.5"
                    >{{ v.billKind }}</span
                  >
                  <ResultBadge :text="v.procResult" size="sm" />
                </div>
                <p class="text-[15px] font-bold text-toss-gray-900 group-hover:text-toss-blue line-clamp-2">
                  {{ v.billName }}
                </p>
                <p class="mt-1 text-[12px] text-toss-gray-400">
                  {{ formatDate(v.procDt) }}
                  <template v-if="v.committee"> · {{ v.committee }}</template>
                </p>
              </div>
              <Arrow class="size-5 shrink-0 text-toss-gray-300 group-hover:text-toss-blue" />
            </div>
            <VoteResultBar :yes="v.yes" :no="v.no" :blank="v.blank" />
          </NuxtLink>
        </li>
      </ul>

      <div v-if="totalPages > 1" class="mt-6 flex items-center justify-center gap-2">
        <button
          class="grid place-items-center size-10 rounded-xl bg-white card-shadow text-toss-gray-600 disabled:opacity-40"
          :disabled="page <= 1"
          @click="page--"
        >
          <ChevronLeft class="size-5" />
        </button>
        <span class="px-4 text-[14px] font-semibold text-toss-gray-700 tabular-nums">
          {{ page }} / {{ totalPages }}
        </span>
        <button
          class="grid place-items-center size-10 rounded-xl bg-white card-shadow text-toss-gray-600 disabled:opacity-40"
          :disabled="page >= totalPages"
          @click="page++"
        >
          <ChevronRight class="size-5" />
        </button>
      </div>
    </DataState>
  </div>
</template>
