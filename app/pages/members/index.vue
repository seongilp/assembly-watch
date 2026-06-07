<script setup lang="ts">
import { Search, Users } from "lucide-vue-next";
import type { Member } from "#shared/types";
import { normalizeParty, partyColor } from "~/lib/party";

const { data, pending, error } = useFetch<{ rows: Member[]; totalCount: number }>(
  "/api/members",
);

const search = ref("");
const party = ref<string>("전체");

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

      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
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
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <NuxtLink
          v-for="m in filtered"
          :key="m.id"
          :to="`/members/${m.id}`"
          class="group flex items-center gap-3.5 rounded-2xl bg-card p-4 card-shadow transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
        >
          <MemberAvatar :name="m.name" :party="m.party" :photo="m.photo" :size="48" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-[15px] font-bold text-toss-gray-900 group-hover:text-toss-blue">
                {{ m.name }}
              </p>
              <span class="text-[12px] text-toss-gray-400">{{ m.reelection }}</span>
            </div>
            <p class="mt-0.5 text-[13px] text-toss-gray-500 truncate">
              {{ m.origin || m.electType }}
            </p>
          </div>
          <PartyBadge :party="m.party" size="sm" :dot="false" />
        </NuxtLink>
      </div>
    </DataState>
  </div>
</template>
