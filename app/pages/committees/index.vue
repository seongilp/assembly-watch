<script setup lang="ts">
import { Landmark, ChevronRight, ChevronDown, FileText, Download, ExternalLink } from "lucide-vue-next";
import type { CommitteeListItem, MinuteSummary } from "#shared/types";
import { formatDate } from "~/lib/format";

const { data, pending, error } = await useFetch<{ rows: CommitteeListItem[] }>(
  "/api/committees",
  { key: "committees" },
);

const standing = computed(() =>
  (data.value?.rows ?? []).filter((c) => c.div === "상임위원회"),
);
const special = computed(() =>
  (data.value?.rows ?? []).filter((c) => c.div !== "상임위원회" && c.deptCd),
);

// 회의록 요약 인라인 펼침 (온디맨드 로드, 호버 시 프리페치)
const openSummary = ref<Set<string>>(new Set());
const summaries = ref<Record<string, MinuteSummary | "loading" | "error">>({});
async function loadSummary(id: string) {
  if (!id || summaries.value[id]) return;
  summaries.value = { ...summaries.value, [id]: "loading" };
  try {
    const d = await $fetch<MinuteSummary>(`/api/minute/${id}`);
    summaries.value = { ...summaries.value, [id]: d };
  } catch {
    summaries.value = { ...summaries.value, [id]: "error" };
  }
}
function toggleSummary(id: string) {
  if (!id) return;
  const s = new Set(openSummary.value);
  s.has(id) ? s.delete(id) : s.add(id);
  openSummary.value = s;
  if (s.has(id)) loadSummary(id);
}

useHead({ title: "위원회 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader eyebrow="제22대 국회" title="위원회" subtitle="상임위원회 회의록을 한눈에 · 특별위원회 구성 현황" />

    <DataState :pending="pending" :error="error" :empty="!data?.rows?.length" :skeleton-rows="6">
      <div class="lg:grid lg:grid-cols-[180px_1fr] lg:gap-6">
        <!-- 좌측 상임위 메뉴 -->
        <aside class="hidden lg:block">
          <nav class="sticky top-6 space-y-0.5">
            <p class="px-3 pb-2 text-[11px] font-bold text-toss-gray-400">상임위원회</p>
            <a
              v-for="c in standing"
              :key="c.deptCd"
              :href="`#c-${c.deptCd}`"
              class="block rounded-lg px-3 py-1.5 text-[13px] font-medium text-toss-gray-600 hover:bg-toss-gray-100 hover:text-toss-blue transition-colors truncate"
            >{{ c.name }}</a>
          </nav>
        </aside>

        <!-- 메인: 상임위별 최근 회의록 -->
        <div class="space-y-7 min-w-0">
          <section v-for="c in standing" :id="`c-${c.deptCd}`" :key="c.deptCd" class="scroll-mt-6">
            <div class="flex items-center justify-between gap-3 mb-3">
              <NuxtLink :to="`/committees/${c.deptCd}`" class="group flex items-center gap-2 min-w-0">
                <span class="grid place-items-center size-8 shrink-0 rounded-lg bg-toss-blue-light text-toss-blue-dark"><Landmark class="size-4" /></span>
                <h2 class="text-[16px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">{{ c.name }}</h2>
                <span v-if="c.limit" class="text-[12px] text-toss-gray-400 shrink-0">{{ c.limit }}명</span>
              </NuxtLink>
              <NuxtLink :to="`/committees/${c.deptCd}`" class="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-semibold text-toss-blue hover:text-toss-blue-dark">
                전체 <ChevronRight class="size-3.5" />
              </NuxtLink>
            </div>

            <ul v-if="c.minutes?.length" class="space-y-1.5">
              <li v-for="(m, i) in c.minutes" :key="i" class="rounded-xl bg-card card-shadow p-3">
                <div class="flex items-center gap-3">
                  <div class="grid place-items-center size-9 shrink-0 rounded-lg bg-toss-gray-100 text-toss-gray-500"><FileText class="size-4" /></div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] font-semibold text-toss-gray-800 line-clamp-1">{{ m.title }}</p>
                    <p class="text-[12px] text-toss-gray-400">{{ formatDate(m.date) }}</p>
                  </div>
                  <button
                    v-if="m.id"
                    class="shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors"
                    :class="openSummary.has(m.id) ? 'bg-toss-blue text-white' : 'bg-toss-gray-100 text-toss-gray-600 hover:bg-toss-gray-200'"
                    @mouseenter="loadSummary(m.id)"
                    @click="toggleSummary(m.id)"
                  >
                    요약 <ChevronDown class="size-3 transition-transform" :class="openSummary.has(m.id) ? 'rotate-180' : ''" />
                  </button>
                  <a v-else-if="m.summary" :href="m.summary" target="_blank" class="shrink-0 inline-flex items-center gap-1 rounded-lg bg-toss-gray-100 px-2 py-1 text-[11px] font-bold text-toss-gray-600 hover:bg-toss-gray-200">요약</a>
                  <a v-if="m.pdf" :href="m.pdf" target="_blank" class="shrink-0 inline-flex items-center gap-1 rounded-lg bg-toss-blue-light px-2 py-1 text-[11px] font-bold text-toss-blue-dark hover:opacity-80"><Download class="size-3" />PDF</a>
                </div>

                <!-- 요약 인라인 펼침 -->
                <div v-if="m.id && openSummary.has(m.id)" class="mt-3 border-t border-toss-gray-100 pt-3">
                  <p v-if="summaries[m.id] === 'loading'" class="text-[12px] text-toss-gray-400">요약 불러오는 중…</p>
                  <p v-else-if="summaries[m.id] === 'error'" class="text-[12px] text-toss-gray-400">
                    요약을 불러오지 못했습니다. <a :href="m.summary" target="_blank" class="text-toss-blue font-semibold">원문 보기</a>
                  </p>
                  <template v-else-if="summaries[m.id]">
                    <div v-if="(summaries[m.id] as any).agenda?.length" class="mb-3">
                      <p class="text-[11px] font-bold text-toss-gray-500 mb-1.5">상정 안건 {{ (summaries[m.id] as any).agenda.length }}</p>
                      <ol class="space-y-1">
                        <li v-for="(a, j) in (summaries[m.id] as any).agenda" :key="j" class="text-[12.5px] text-toss-gray-700 leading-relaxed">{{ a }}</li>
                      </ol>
                    </div>
                    <div v-if="(summaries[m.id] as any).speakers?.length">
                      <p class="text-[11px] font-bold text-toss-gray-500 mb-1.5">발언·참석 위원 {{ (summaries[m.id] as any).speakers.length }}</p>
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="(sp, j) in (summaries[m.id] as any).speakers" :key="j" class="rounded-lg bg-toss-gray-100 px-2 py-1 text-[12px] text-toss-gray-600">{{ sp }}</span>
                      </div>
                    </div>
                    <a :href="m.summary" target="_blank" class="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-toss-blue hover:text-toss-blue-dark">
                      회의록 원문 보기 <ExternalLink class="size-3.5" />
                    </a>
                  </template>
                </div>
              </li>
            </ul>
            <p v-else class="text-[13px] text-toss-gray-400 rounded-xl bg-card card-shadow p-4">최근 회의록이 없습니다. <NuxtLink :to="`/committees/${c.deptCd}`" class="text-toss-blue font-semibold">일정 보기</NuxtLink></p>
          </section>

          <!-- 특별위원회 -->
          <section>
            <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-3">
              <Landmark class="size-4 text-toss-gray-400" /> 특별위원회 <span class="text-[12px] text-toss-gray-400">{{ special.length }}</span>
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <NuxtLink
                v-for="(c, i) in special"
                :key="c.deptCd + i"
                :to="`/committees/${c.deptCd}`"
                class="group flex items-center justify-between gap-2 rounded-xl bg-card card-shadow px-4 py-3 transition-colors hover:bg-toss-gray-50"
              >
                <span class="text-[13px] font-semibold text-toss-gray-800 group-hover:text-toss-blue truncate">{{ c.name }}</span>
                <ChevronRight class="size-4 shrink-0 text-toss-gray-300 group-hover:text-toss-blue" />
              </NuxtLink>
            </div>
          </section>
        </div>
      </div>
    </DataState>
  </div>
</template>
