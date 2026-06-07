<script setup lang="ts">
import { Search, List, Map as MapIcon, Crown } from "lucide-vue-next";
import type { MemberListItem, Insights } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const { data, pending, error } = useFetch<{
  rows: MemberListItem[];
  totalCount: number;
}>("/api/members");

// 불참왕/기권왕/발의왕 (펀팩트 1위)
const { data: insights } = useFetch<Insights>("/api/insights", { key: "insights" });
const crownOf = computed(() => {
  const m: Record<string, string> = {};
  const a = insights.value;
  if (a?.absent?.[0]?.id) m[a.absent[0].id] = "불참왕";
  if (a?.blank?.[0]?.id) m[a.blank[0].id] = "기권왕";
  if (a?.proposed?.[0]?.id) m[a.proposed[0].id] = "발의왕";
  return m;
});

const search = ref("");
const party = ref<string>("전체");
const view = ref<"list" | "region">("list");

const parties = computed(() => {
  const counts = new Map<string, number>();
  for (const m of data.value?.rows ?? []) {
    const p = normalizeParty(m.party);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
});

const filtered = computed(() => {
  const q = search.value.trim();
  return (data.value?.rows ?? []).filter((m) => {
    if (party.value !== "전체" && normalizeParty(m.party) !== party.value)
      return false;
    if (q && !(m.name.includes(q) || m.origin.includes(q) || m.committee.includes(q)))
      return false;
    return true;
  });
});

useHead({ title: "국회의원 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회"
      title="국회의원"
      :subtitle="`현직 의원 ${data?.totalCount ?? 0}명 · 이름·지역구·위원회로 검색`"
    />

    <!-- 검색 + 필터 -->
    <div class="mb-5 space-y-3">
      <div class="relative">
        <Search
          class="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-toss-gray-400"
        />
        <input
          v-model="search"
          type="text"
          placeholder="의원 이름, 지역구, 위원회 검색"
          class="w-full h-12 rounded-2xl border-0 bg-card pl-11 pr-4 text-[15px] text-toss-gray-900 placeholder:text-toss-gray-400 card-shadow focus:outline-none focus:ring-2 focus:ring-toss-blue/40"
        />
      </div>

      <div class="flex items-center gap-2">
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
          <button
            v-for="p in ['전체', ...parties]"
            :key="p"
            class="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
            :class="
              party === p
                ? 'bg-foreground text-background'
                : 'bg-card text-toss-gray-600 hover:bg-toss-gray-100 card-shadow'
            "
            @click="party = p"
          >
            {{ p }}
          </button>
        </div>
        <div class="shrink-0 inline-flex rounded-xl bg-toss-gray-100 p-0.5">
          <button
            v-for="v in (['list', 'region'] as const)"
            :key="v"
            class="grid place-items-center size-8 rounded-lg transition-all"
            :class="view === v ? 'bg-card text-toss-blue card-shadow' : 'text-toss-gray-400'"
            :aria-label="v === 'list' ? '목록 보기' : '지역 보기'"
            @click="view = v"
          >
            <List v-if="v === 'list'" class="size-[18px]" />
            <MapIcon v-else class="size-[18px]" />
          </button>
        </div>
      </div>
    </div>

    <DataState
      :pending="pending"
      :error="error"
      :empty="!filtered.length"
      empty-text="조건에 맞는 의원이 없습니다."
      :skeleton-rows="8"
    >
      <p class="mb-3 text-[13px] text-toss-gray-500">
        총 <b class="text-toss-gray-900">{{ filtered.length }}</b>명
      </p>

      <!-- 지역 보기 -->
      <MemberByRegion v-if="view === 'region'" :members="filtered" />

      <!-- 목록 보기 (전체 렌더) -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <NuxtLink
          v-for="m in filtered"
          :key="m.id"
          :to="`/members/${m.id}`"
          class="group flex items-center gap-3.5 rounded-2xl bg-card p-4 card-shadow transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
        >
          <div class="relative shrink-0">
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :photo="m.photo" :size="48" />
            <Crown
              v-if="crownOf[m.id]"
              class="absolute -top-2 -right-1.5 size-4 rotate-12 fill-[#FFB400] text-[#FFB400] drop-shadow"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="text-[15px] font-bold text-toss-gray-900 group-hover:text-toss-blue">
                {{ m.name }}
              </p>
              <span class="text-[12px] text-toss-gray-400">{{ m.reelection }}</span>
              <span v-if="crownOf[m.id]" class="rounded-full bg-[#FFB400]/15 px-1.5 py-0.5 text-[10px] font-extrabold text-[#C98A00]">👑 {{ crownOf[m.id] }}</span>
            </div>
            <p class="mt-0.5 text-[13px] text-toss-gray-500 truncate">
              {{ m.origin || m.electType }}
            </p>
            <div v-if="m.tally?.total" class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold tabular-nums">
              <span v-if="m.tally.y" style="color:#3182F6">찬 {{ m.tally.y }}</span>
              <span v-if="m.tally.n" style="color:#F04452">반 {{ m.tally.n }}</span>
              <span v-if="m.tally.b" style="color:#FF9500">기권 {{ m.tally.b }}</span>
              <span v-if="m.tally.a" style="color:#8B95A1">불참 {{ m.tally.a }}</span>
            </div>
          </div>
          <PartyBadge :party="m.party" size="sm" :dot="false" />
        </NuxtLink>
      </div>
    </DataState>
  </div>
</template>
