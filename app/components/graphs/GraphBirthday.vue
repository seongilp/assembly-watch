<script setup lang="ts">
import type { GraphData } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();

// KST 기준 오늘/이번 주 생일 (클라이언트 시각)
const now = new Date(Date.now() + 9 * 3600 * 1000);
const mdOf = (d: Date) => d.toISOString().slice(5, 10);
const today = mdOf(now);
const week = new Set(
  Array.from({ length: 7 }, (_, i) => mdOf(new Date(now.getTime() + i * 86400000))),
);

const todayList = computed(() => props.data.birthdays.filter((b) => b.md === today));
const weekList = computed(() =>
  props.data.birthdays
    .filter((b) => b.md !== today && week.has(b.md))
    .sort((a, b) => a.md.localeCompare(b.md)),
);
</script>

<template>
  <section
    v-if="todayList.length || weekList.length"
    class="rounded-2xl bg-gradient-to-r from-[#FFB400]/10 to-[#EC4899]/10 card-shadow p-6"
  >
    <h2 class="text-[15px] font-bold text-toss-gray-900">🎂 생일 축하해요</h2>
    <div v-if="todayList.length" class="mt-3">
      <p class="text-[12px] font-bold text-[#C98A00] mb-2">오늘 생일</p>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="m in todayList"
          :key="m.id"
          :to="`/members/${m.id}`"
          class="flex items-center gap-2 rounded-xl bg-card px-3 py-2 card-shadow hover:scale-[1.02] transition-transform"
        >
          <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="36" />
          <div>
            <p class="text-[13px] font-bold text-toss-gray-900">{{ m.name }} 🎉</p>
            <p class="text-[11px] text-toss-gray-400">{{ normalizeParty(m.party) }}</p>
          </div>
        </NuxtLink>
      </div>
    </div>
    <div v-if="weekList.length" class="mt-3">
      <p class="text-[12px] font-bold text-toss-gray-500 mb-2">이번 주 생일</p>
      <div class="flex flex-wrap gap-1.5">
        <NuxtLink
          v-for="m in weekList"
          :key="m.id"
          :to="`/members/${m.id}`"
          :title="`${m.name} · ${m.md.replace('-', '/')}`"
          class="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 card-shadow hover:scale-105 transition-transform"
        >
          <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="22" />
          <span class="text-[12px] font-semibold text-toss-gray-700">{{ m.name }}</span>
          <span class="text-[11px] text-toss-gray-400">{{ +m.md.slice(3) }}일</span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
