<script setup lang="ts">
import { ArrowLeft, Landmark, FileText, Download, ExternalLink, ChevronDown } from "lucide-vue-next";
import type { CommitteeDetail } from "#shared/types";
import { formatDate } from "~/lib/format";

const route = useRoute();
const deptCd = computed(() => String(route.params.deptCd));

const { data, pending } = await useFetch<CommitteeDetail>(
  `/api/committees/${deptCd.value}`,
  { key: `committee-${deptCd.value}` },
);

const tab = ref<"schedule" | "minutes">("schedule");
const openAgenda = ref<Set<number>>(new Set());
const toggle = (i: number) => {
  const s = new Set(openAgenda.value);
  s.has(i) ? s.delete(i) : s.add(i);
  openAgenda.value = s;
};

// 회의록 요약 인라인 펼침 (온디맨드 로드)
import type { MinuteSummary } from "#shared/types";
const openSummary = ref<Set<string>>(new Set());
const summaries = ref<Record<string, MinuteSummary | "loading" | "error">>({});
async function toggleSummary(id: string) {
  if (!id) return;
  const s = new Set(openSummary.value);
  if (s.has(id)) {
    s.delete(id);
    openSummary.value = s;
    return;
  }
  s.add(id);
  openSummary.value = s;
  if (!summaries.value[id]) {
    summaries.value = { ...summaries.value, [id]: "loading" };
    try {
      const d = await $fetch<MinuteSummary>(`/api/minute/${id}`);
      summaries.value = { ...summaries.value, [id]: d };
    } catch {
      summaries.value = { ...summaries.value, [id]: "error" };
    }
  }
}

useHead({ title: () => `${data.value?.committee?.name ?? "위원회"} · 의정감시` });
</script>

<template>
  <div>
    <NuxtLink
      to="/committees"
      class="inline-flex items-center gap-1 text-[13px] font-semibold text-toss-gray-500 hover:text-toss-blue mb-5"
    >
      <ArrowLeft class="size-4" /> 위원회 목록
    </NuxtLink>

    <div v-if="!data?.committee && !pending" class="rounded-2xl bg-card card-shadow p-10 text-center">
      <p class="text-toss-gray-500">위원회 정보를 찾을 수 없습니다.</p>
    </div>

    <template v-else-if="data?.committee">
      <section class="rounded-2xl bg-card card-shadow p-6 sm:p-7 mb-4">
        <div class="flex items-center gap-3">
          <div class="grid place-items-center size-12 rounded-2xl bg-toss-blue-light text-toss-blue-dark shrink-0">
            <Landmark class="size-6" />
          </div>
          <div>
            <h1 class="text-[22px] font-extrabold text-toss-gray-900">{{ data.committee.name }}</h1>
            <p class="text-[13px] text-toss-gray-500">
              {{ data.committee.div }}<template v-if="data.committee.limit"> · 정원 {{ data.committee.limit }}명</template>
            </p>
          </div>
        </div>
      </section>

      <!-- 탭 -->
      <div class="inline-flex rounded-2xl bg-toss-gray-100 p-1 mb-4">
        <button
          class="rounded-xl px-5 py-2 text-[14px] font-bold transition-all"
          :class="tab === 'schedule' ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
          @click="tab = 'schedule'"
        >
          회의 일정 <span class="text-toss-gray-400">{{ data.schedule.length }}</span>
        </button>
        <button
          class="rounded-xl px-5 py-2 text-[14px] font-bold transition-all"
          :class="tab === 'minutes' ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
          @click="tab = 'minutes'"
        >
          회의록 <span class="text-toss-gray-400">{{ data.minutes.length }}</span>
        </button>
      </div>

      <!-- 일정 -->
      <div v-if="tab === 'schedule'">
        <DataState :empty="!data.schedule.length" empty-text="등록된 회의 일정이 없습니다.">
          <ul class="space-y-2.5">
            <li v-for="(m, i) in data.schedule" :key="i" class="rounded-2xl bg-card card-shadow p-4 sm:p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-[11px] font-bold text-toss-blue bg-toss-blue-light rounded-md px-1.5 py-0.5">{{ m.title }}</span>
                    <span class="text-[12px] text-toss-gray-400">{{ formatDate(m.date) }}<template v-if="m.time"> · {{ m.time }}</template></span>
                  </div>
                  <p v-if="m.sess" class="text-[12px] text-toss-gray-500">{{ m.sess }}</p>
                </div>
                <a v-if="m.link" :href="m.link" target="_blank" class="shrink-0 text-toss-gray-300 hover:text-toss-blue"><ExternalLink class="size-4" /></a>
              </div>
              <button
                v-if="m.agenda.length"
                class="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-toss-gray-500 hover:text-toss-blue"
                @click="toggle(i)"
              >
                안건 {{ m.agenda.length }}건
                <ChevronDown class="size-3.5 transition-transform" :class="openAgenda.has(i) ? 'rotate-180' : ''" />
              </button>
              <ol v-if="openAgenda.has(i)" class="mt-2 space-y-1 border-t border-toss-gray-100 pt-2">
                <li v-for="(a, j) in m.agenda" :key="j" class="text-[12.5px] text-toss-gray-600 leading-relaxed">{{ a }}</li>
              </ol>
            </li>
          </ul>
        </DataState>
      </div>

      <!-- 회의록 -->
      <div v-else>
        <DataState :empty="!data.minutes.length" empty-text="등록된 회의록이 없습니다.">
          <ul class="space-y-2">
            <li v-for="(m, i) in data.minutes" :key="i" class="rounded-2xl bg-card card-shadow p-4">
              <div class="flex items-center gap-3">
                <div class="grid place-items-center size-10 shrink-0 rounded-xl bg-toss-gray-100 text-toss-gray-500">
                  <FileText class="size-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[14px] font-semibold text-toss-gray-800 line-clamp-1">{{ m.title }}</p>
                  <p class="text-[12px] text-toss-gray-400">{{ formatDate(m.date) }}</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    v-if="m.id"
                    class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition-colors"
                    :class="openSummary.has(m.id) ? 'bg-toss-blue text-white' : 'bg-toss-gray-100 text-toss-gray-600 hover:bg-toss-gray-200'"
                    @click="toggleSummary(m.id)"
                  >
                    <FileText class="size-3.5" /> 요약
                    <ChevronDown class="size-3.5 transition-transform" :class="openSummary.has(m.id) ? 'rotate-180' : ''" />
                  </button>
                  <a v-if="m.pdf" :href="m.pdf" target="_blank" class="inline-flex items-center gap-1 rounded-lg bg-toss-blue-light px-2.5 py-1.5 text-[12px] font-bold text-toss-blue-dark hover:opacity-80">
                    <Download class="size-3.5" /> PDF
                  </a>
                </div>
              </div>

              <!-- 요약 인라인 펼침 -->
              <div v-if="openSummary.has(m.id)" class="mt-3 border-t border-toss-gray-100 pt-3">
                <p v-if="summaries[m.id] === 'loading'" class="text-[13px] text-toss-gray-400">요약 불러오는 중…</p>
                <p v-else-if="summaries[m.id] === 'error'" class="text-[13px] text-toss-gray-400">
                  요약을 불러오지 못했습니다. <a :href="m.summary" target="_blank" class="text-toss-blue font-semibold">원문 보기</a>
                </p>
                <template v-else-if="summaries[m.id]">
                  <div v-if="(summaries[m.id] as any).agenda?.length" class="mb-3">
                    <p class="text-[12px] font-bold text-toss-gray-500 mb-1.5">상정 안건 {{ (summaries[m.id] as any).agenda.length }}</p>
                    <ol class="space-y-1">
                      <li v-for="(a, j) in (summaries[m.id] as any).agenda" :key="j" class="text-[13px] text-toss-gray-700 leading-relaxed">{{ a }}</li>
                    </ol>
                  </div>
                  <div v-if="(summaries[m.id] as any).speakers?.length">
                    <p class="text-[12px] font-bold text-toss-gray-500 mb-1.5">발언·참석 위원 {{ (summaries[m.id] as any).speakers.length }}</p>
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
        </DataState>
      </div>
    </template>

    <div v-else class="space-y-4">
      <Skeleton class="h-28 w-full rounded-2xl bg-toss-gray-100" />
      <Skeleton class="h-64 w-full rounded-2xl bg-toss-gray-100" />
    </div>
  </div>
</template>
