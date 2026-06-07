<script setup lang="ts">
import { ChevronLeft, ChevronRight, ChevronDown, ExternalLink, Search } from "lucide-vue-next";
import type { VoteSummary, Paged, VoteRecord } from "#shared/types";
import { formatDate } from "~/lib/format";

// 카드 펼침 → 정당별 표결(클릭 시 의원) 인앱 표시 (한 화면)
const openId = ref<string | null>(null);
const rollcall = ref<Record<string, VoteRecord[] | "loading" | "error">>({});
async function toggleVote(id: string) {
  openId.value = openId.value === id ? null : id;
  if (openId.value === id && !rollcall.value[id]) {
    rollcall.value = { ...rollcall.value, [id]: "loading" };
    try {
      const d = await $fetch<{ rows: VoteRecord[] }>(`/api/votes/${id}`);
      rollcall.value = { ...rollcall.value, [id]: d.rows };
    } catch {
      rollcall.value = { ...rollcall.value, [id]: "error" };
    }
  }
}

// 최근 300건을 1회만 로드(프리렌더 페이로드) → 필터/검색/페이지는 전부 클라이언트(즉시)
const { data, pending, error } = await useFetch<Paged<VoteSummary>>("/api/votes", {
  query: { size: 300 },
  key: "votes-all",
});

const votedOnly = ref(true);
const dissentOnly = ref(false);
const search = ref("");
const page = ref(1);
const size = 20;

watch([votedOnly, dissentOnly, search], () => (page.value = 1));

const filtered = computed(() => {
  const q = search.value.trim();
  return (data.value?.rows ?? []).filter((v) => {
    if (votedOnly.value && v.total == null) return false;
    if (dissentOnly.value && (v.no ?? 0) <= 0) return false;
    if (q && !(v.billName.includes(q) || v.proposer.includes(q) || v.committee.includes(q)))
      return false;
    return true;
  });
});
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size)));
const shown = computed(() =>
  filtered.value.slice((page.value - 1) * size, page.value * size),
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
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-toss-gray-400" />
        <input
          v-model="search"
          type="text"
          placeholder="의안명, 발의자, 위원회 검색"
          class="w-full h-12 rounded-2xl border-0 bg-card pl-11 pr-4 text-[15px] card-shadow focus:outline-none focus:ring-2 focus:ring-toss-blue/40"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none rounded-full bg-card px-3.5 py-2 card-shadow">
          <input v-model="votedOnly" type="checkbox" class="size-4 rounded accent-toss-blue" />
          <span class="text-[13px] font-semibold text-toss-gray-600">표결 집계가 있는 안건만</span>
        </label>
        <label
          class="inline-flex items-center gap-2 cursor-pointer select-none rounded-full px-3.5 py-2 card-shadow transition-colors"
          :class="dissentOnly ? 'bg-toss-red text-white' : 'bg-card text-toss-gray-600'"
        >
          <input v-model="dissentOnly" type="checkbox" class="size-4 rounded accent-toss-red" />
          <span class="text-[13px] font-semibold">반대표 있는 표결만</span>
        </label>
      </div>
    </div>

    <p class="mb-3 text-[13px] text-toss-gray-500">
      <b class="text-toss-gray-900">{{ filtered.length }}</b>건
      <span class="text-toss-gray-400">· 최근 300건 범위</span>
    </p>

    <DataState :pending="pending" :error="error" :empty="!filtered.length" empty-text="조건에 맞는 표결이 없습니다." :skeleton-rows="8">
      <ul class="space-y-2.5">
        <li v-for="v in shown" :key="v.billId" class="rounded-2xl bg-card card-shadow p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3 mb-3">
            <button class="group min-w-0 text-left flex-1" @click="toggleVote(v.billId)">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-[12px] font-semibold text-toss-gray-400">#{{ v.billNo }}</span>
                <span v-if="v.billKind" class="text-[11px] font-medium text-toss-gray-500 bg-toss-gray-100 rounded px-1.5 py-0.5">{{ v.billKind }}</span>
                <ResultBadge :text="v.procResult" size="sm" />
              </div>
              <p class="text-[15px] font-bold text-toss-gray-900 group-hover:text-toss-blue line-clamp-2">{{ v.billName }}</p>
              <p class="mt-1 inline-flex items-center gap-1 text-[12px] text-toss-gray-400">
                {{ formatDate(v.procDt) }}<template v-if="v.committee"> · {{ v.committee }}</template>
                <span class="ml-1 inline-flex items-center gap-0.5 text-toss-blue font-semibold">정당별 <ChevronDown class="size-3.5 transition-transform" :class="openId === v.billId ? 'rotate-180' : ''" /></span>
              </p>
            </button>
            <NuxtLink :to="`/votes/${v.billId}`" class="shrink-0 grid place-items-center size-8 rounded-lg text-toss-gray-300 hover:bg-toss-gray-100 hover:text-toss-blue" title="표결 상세(명단·지도)">
              <ExternalLink class="size-4" />
            </NuxtLink>
          </div>
          <button class="block w-full text-left" @click="toggleVote(v.billId)">
            <VoteResultBar :yes="v.yes" :no="v.no" :blank="v.blank" />
          </button>

          <!-- 정당별 표결 (인앱) -->
          <div v-if="openId === v.billId" class="mt-3 border-t border-toss-gray-100 pt-3">
            <p v-if="rollcall[v.billId] === 'loading'" class="text-[13px] text-toss-gray-400">표결 명단 불러오는 중…</p>
            <p v-else-if="rollcall[v.billId] === 'error' || (Array.isArray(rollcall[v.billId]) && !(rollcall[v.billId] as VoteRecord[]).length)" class="text-[13px] text-toss-gray-400">
              표결 집계가 없습니다. <NuxtLink :to="`/votes/${v.billId}`" class="text-toss-blue font-semibold">상세 보기</NuxtLink>
            </p>
            <VoteByParty v-else-if="Array.isArray(rollcall[v.billId])" :records="(rollcall[v.billId] as VoteRecord[])" />
          </div>
        </li>
      </ul>

      <div v-if="totalPages > 1" class="mt-6 flex items-center justify-center gap-2">
        <button class="grid place-items-center size-10 rounded-xl bg-card card-shadow text-toss-gray-600 disabled:opacity-40" :disabled="page <= 1" @click="page--">
          <ChevronLeft class="size-5" />
        </button>
        <span class="px-4 text-[14px] font-semibold text-toss-gray-700 tabular-nums">{{ page }} / {{ totalPages }}</span>
        <button class="grid place-items-center size-10 rounded-xl bg-card card-shadow text-toss-gray-600 disabled:opacity-40" :disabled="page >= totalPages" @click="page++">
          <ChevronRight class="size-5" />
        </button>
      </div>
    </DataState>
  </div>
</template>
