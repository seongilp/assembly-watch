<script setup lang="ts">
import type { VoteInsights } from "#shared/types";
import { formatDate } from "~/lib/format";

defineProps<{ data: VoteInsights }>();
const partyClr = usePartyColor();
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- 정당 결속도 -->
    <section class="rounded-2xl bg-card card-shadow p-5">
      <h2 class="text-[15px] font-bold text-toss-gray-900 mb-1">정당 결속도</h2>
      <p class="text-[12px] text-toss-gray-400 mb-4">찬반이 한 방향으로 모일수록 높음 (Rice 지수)</p>
      <div class="space-y-3">
        <div v-for="p in data.partyUnity" :key="p.party">
          <div class="flex items-baseline justify-between mb-1">
            <span class="inline-flex items-center gap-1.5 text-[13px] font-bold" :style="{ color: partyClr(p.party) }">
              <span class="size-2.5 rounded-full" :style="{ backgroundColor: partyClr(p.party) }" />{{ p.party }}
              <span class="text-[11px] font-medium text-toss-gray-400">{{ p.seats }}석</span>
            </span>
            <span class="text-[14px] font-extrabold tabular-nums" :style="{ color: partyClr(p.party) }">{{ (p.unity * 100).toFixed(0) }}%</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-toss-gray-100">
            <div class="h-full rounded-full" :style="{ width: p.unity * 100 + '%', backgroundColor: partyClr(p.party) }" />
          </div>
        </div>
      </div>
    </section>

    <!-- 박빙 표결 + 만장일치 -->
    <section class="rounded-2xl bg-card card-shadow p-5">
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="text-[15px] font-bold text-toss-gray-900">가장 치열했던 표결</h2>
        <span class="text-[12px] text-toss-gray-400">전체 {{ data.billCount }}건 중 만장일치 <b class="text-toss-blue">{{ data.unanimous.count }}</b>건</span>
      </div>
      <ul class="divide-y divide-toss-gray-100">
        <li v-for="b in data.close" :key="b.id">
          <NuxtLink :to="`/votes/${b.id}`" class="group flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0">
              <p class="text-[13px] font-semibold text-toss-gray-800 group-hover:text-toss-blue line-clamp-1">{{ b.name }}</p>
              <p class="text-[11px] text-toss-gray-400">{{ formatDate(b.date) }}</p>
            </div>
            <div class="shrink-0 flex items-center gap-2 text-[12px] font-extrabold tabular-nums">
              <span style="color:#3182F6">{{ b.y }}</span>
              <span class="text-toss-gray-300">:</span>
              <span style="color:#F04452">{{ b.n }}</span>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
