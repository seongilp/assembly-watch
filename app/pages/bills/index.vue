<script setup lang="ts">
import { Search, ExternalLink, ChevronLeft, ChevronRight } from "lucide-vue-next";
import type { Bill } from "#shared/types";
import { formatDate } from "~/lib/format";

const route = useRoute();
const router = useRouter();

// 최근 의안(계류/처리 각 300)을 1회 로드(프리렌더 페이로드) → 탭/검색/페이지 전부 클라이언트
const { data, pending, error } = await useFetch<{ pending: Bill[]; processed: Bill[] }>(
  "/api/bills-recent",
  { key: "bills-recent" },
);

const type = ref<"pending" | "processed">("pending");
const search = ref("");
const page = ref(1);
const size = 20;

onMounted(() => {
  if (route.query.type === "processed") type.value = "processed";
});
watch([type, search], () => (page.value = 1));
watch(type, () =>
  router.replace({ query: { ...route.query, type: type.value } }),
);

const all = computed<Bill[]>(() =>
  type.value === "processed" ? (data.value?.processed ?? []) : (data.value?.pending ?? []),
);
const filtered = computed(() => {
  const q = search.value.trim();
  if (!q) return all.value;
  return all.value.filter((b) => b.name.includes(q) || b.proposer.includes(q));
});
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size)));
const shown = computed(() =>
  filtered.value.slice((page.value - 1) * size, page.value * size),
);

useHead({ title: "의안 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회"
      title="의안"
      subtitle="최근 발의된 법률안의 계류·처리 현황 (각 최근 300건)"
    />

    <div class="inline-flex rounded-2xl bg-toss-gray-100 p-1 mb-4">
      <button
        v-for="t in (['pending', 'processed'] as const)"
        :key="t"
        class="rounded-xl px-5 py-2 text-[14px] font-bold transition-all"
        :class="type === t ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
        @click="type = t"
      >
        {{ t === "pending" ? "계류 의안" : "처리 의안" }}
      </button>
    </div>

    <div class="relative mb-5">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-toss-gray-400" />
      <input
        v-model="search"
        type="text"
        placeholder="의안명, 발의자 검색"
        class="w-full h-12 rounded-2xl border-0 bg-card pl-11 pr-4 text-[15px] card-shadow focus:outline-none focus:ring-2 focus:ring-toss-blue/40"
      />
    </div>

    <DataState :pending="pending" :error="error" :empty="!filtered.length" empty-text="조건에 맞는 의안이 없습니다." :skeleton-rows="8">
      <p class="mb-3 text-[13px] text-toss-gray-500"><b class="text-toss-gray-900">{{ filtered.length }}</b>건</p>
      <ul class="space-y-2.5">
        <li v-for="b in shown" :key="b.id" class="rounded-2xl bg-card card-shadow p-4 sm:p-5 transition-colors hover:bg-toss-gray-50">
          <a :href="b.link" target="_blank" class="group block">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[12px] font-semibold text-toss-gray-400">#{{ b.no }}</span>
                  <ResultBadge v-if="b.procResult" :text="b.procResult" size="sm" />
                </div>
                <p class="text-[15px] font-bold text-toss-gray-900 group-hover:text-toss-blue line-clamp-2">{{ b.name }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-toss-gray-500">
                  <span>{{ b.proposer }}</span>
                  <span class="text-toss-gray-300">·</span>
                  <span>발의 {{ formatDate(b.proposeDt) }}</span>
                  <template v-if="b.committee">
                    <span class="text-toss-gray-300">·</span>
                    <span>{{ b.committee }}</span>
                  </template>
                </div>
              </div>
              <ExternalLink class="size-4 shrink-0 text-toss-gray-300 group-hover:text-toss-blue" />
            </div>
          </a>
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
