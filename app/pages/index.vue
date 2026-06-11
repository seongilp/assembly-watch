<script setup lang="ts">
import {
  Users,
  FileText,
  CheckCircle2,
  Vote,
  ChevronRight,
  CalendarDays,
  MapPin,
} from "lucide-vue-next";
import type { MemberListItem, VoteSummary, ScheduleItem } from "#shared/types";
import { normalizeParty } from "~/lib/party";
import { formatDate, formatNumber, relativeDay } from "~/lib/format";

const { data: stats, pending: statsPending } = useFetch("/api/stats");
const { data: members } = useFetch<{ rows: MemberListItem[] }>("/api/members");
const { data: votes, pending: votesPending } = useFetch<{ rows: VoteSummary[] }>(
  "/api/votes",
  { query: { size: 6, votedOnly: 1 } },
);
const { data: schedule, pending: schedulePending } = useFetch<{
  rows: ScheduleItem[];
}>("/api/schedule", { query: { upcoming: 1, size: 6 } });

const partyDist = computed(() => {
  const counts = new Map<string, number>();
  for (const m of members.value?.rows ?? []) {
    const p = normalizeParty(m.party);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].map(([party, count]) => ({ party, count }));
});

// 날짜/상대시간은 클라이언트에서만 계산 → 프리렌더 하이드레이션 안전
const mounted = useMounted();
const updatedLabel = computed(() => {
  if (!mounted.value || !stats.value?.updatedAt) return "";
  return new Date(stats.value.updatedAt).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회 · 의정활동 모니터"
      title="국회는 지금 무엇을 하고 있나요?"
      subtitle="열린국회정보 공식 데이터로 의원·의안·표결을 실시간으로 추적합니다."
    >
      <template #actions>
        <span
          v-if="updatedLabel"
          class="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[12px] font-medium text-toss-gray-500 card-shadow"
        >
          <span class="size-1.5 rounded-full bg-toss-green animate-pulse" />
          데이터 {{ updatedLabel }} 기준
        </span>
      </template>
    </PageHeader>

    <!-- 핵심 지표 -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard
        label="현직 국회의원"
        :value="stats?.members ?? null"
        suffix="명"
        :icon="Users"
        accent="blue"
        to="/members"
        :loading="statsPending"
      />
      <StatCard
        label="계류 의안"
        :value="stats?.billsPending ?? null"
        suffix="건"
        :icon="FileText"
        accent="amber"
        to="/bills"
        :loading="statsPending"
      />
      <StatCard
        label="처리 의안"
        :value="stats?.billsProcessed ?? null"
        suffix="건"
        :icon="CheckCircle2"
        accent="green"
        to="/bills?type=processed"
        :loading="statsPending"
      />
      <StatCard
        label="본회의 표결"
        :value="stats?.votes ?? null"
        suffix="건"
        :icon="Vote"
        accent="violet"
        to="/votes"
        :loading="statsPending"
      />
    </section>

    <div class="mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- 최근 본회의 표결 -->
      <section class="lg:col-span-2 rounded-2xl bg-card card-shadow p-5 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-[16px] font-bold text-toss-gray-900">최근 본회의 표결</h2>
          <NuxtLink
            to="/votes"
            class="inline-flex items-center gap-0.5 text-[13px] font-semibold text-toss-blue hover:text-toss-blue-dark"
          >
            전체보기 <ChevronRight class="size-4" />
          </NuxtLink>
        </div>

        <DataState
          :pending="votesPending"
          :empty="!votes?.rows?.length"
          :skeleton-rows="4"
        >
          <ul class="divide-y divide-toss-gray-100">
            <li v-for="v in votes?.rows" :key="v.billId">
              <NuxtLink
                :to="`/votes/${v.billId}`"
                class="group block py-3.5 -mx-2 px-2 rounded-xl hover:bg-toss-gray-50 transition-colors"
              >
                <div class="flex items-start justify-between gap-3">
                  <p
                    class="text-[14px] font-semibold text-toss-gray-800 line-clamp-1 group-hover:text-toss-blue"
                  >
                    {{ v.billName }}
                  </p>
                  <ResultBadge :text="v.procResult" size="sm" />
                </div>
                <div class="mt-2 flex items-center gap-3">
                  <span class="text-[12px] text-toss-gray-400 shrink-0">{{
                    formatDate(v.procDt)
                  }}</span>
                  <div class="flex-1 min-w-0">
                    <VoteResultBar :yes="v.yes" :no="v.no" :blank="v.blank" compact />
                  </div>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </DataState>
      </section>

      <!-- 정당별 의석 -->
      <section class="rounded-2xl bg-card card-shadow p-5 sm:p-6">
        <h2 class="text-[16px] font-bold text-toss-gray-900 mb-1">정당별 의석</h2>
        <p class="text-[12px] text-toss-gray-400 mb-4">
          현직 의원 {{ formatNumber(stats?.members ?? null) }}명 기준
        </p>
        <PartyDistribution v-if="partyDist.length" :data="partyDist" />
        <div v-else class="space-y-2">
          <Skeleton v-for="i in 5" :key="i" class="h-5 w-full rounded bg-toss-gray-100" />
        </div>
      </section>
    </div>

    <!-- 다가오는 일정 -->
    <section class="mt-4 sm:mt-6 rounded-2xl bg-card card-shadow p-5 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[16px] font-bold text-toss-gray-900">다가오는 국회 일정</h2>
        <NuxtLink
          to="/schedule"
          class="inline-flex items-center gap-0.5 text-[13px] font-semibold text-toss-blue hover:text-toss-blue-dark"
        >
          전체보기 <ChevronRight class="size-4" />
        </NuxtLink>
      </div>

      <DataState
        :pending="schedulePending"
        :empty="!schedule?.rows?.length"
        empty-text="예정된 일정이 없습니다."
        :skeleton-rows="3"
      >
        <ul class="grid sm:grid-cols-2 gap-2.5">
          <li
            v-for="(s, i) in schedule?.rows"
            :key="i"
            class="flex gap-3 rounded-xl border border-toss-gray-100 p-3.5"
          >
            <div
              class="grid place-items-center shrink-0 size-11 rounded-xl bg-toss-blue-light text-toss-blue-dark"
            >
              <CalendarDays class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="text-[11px] font-bold text-toss-blue bg-toss-blue-light rounded-md px-1.5 py-0.5"
                  >{{ mounted ? relativeDay(s.date) || s.kind : s.kind }}</span
                >
                <span class="text-[12px] text-toss-gray-400">{{
                  formatDate(s.date)
                }}{{ s.time ? ` · ${s.time}` : "" }}</span>
              </div>
              <p class="mt-1 text-[13px] font-semibold text-toss-gray-800 line-clamp-1">
                {{ s.content }}
              </p>
              <p
                v-if="s.place"
                class="mt-0.5 inline-flex items-center gap-1 text-[12px] text-toss-gray-400"
              >
                <MapPin class="size-3" />{{ s.place }}
              </p>
            </div>
          </li>
        </ul>
      </DataState>
    </section>

    <p class="mt-8 text-center text-[12px] text-toss-gray-400">
      본 서비스는 국회 열린국회정보 Open API를 활용한 비영리 의정 모니터링 프로젝트입니다.
    </p>
  </div>
</template>
