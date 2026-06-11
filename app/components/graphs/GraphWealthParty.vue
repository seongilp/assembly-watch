<script setup lang="ts">
import { Landmark } from "lucide-vue-next";
import type { WealthData } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ data: WealthData }>();
const maxMed = computed(() => Math.max(...props.data.byParty.map((p) => p.median), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Landmark class="size-4 text-toss-blue" /> 정당별 재산
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">중앙값 기준 (평균은 초고액 자산가 1명에 크게 흔들려요).</p>

    <ul class="mt-4 space-y-3">
      <li v-for="p in data.byParty" :key="p.party">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[13px] font-bold text-toss-gray-800">{{ p.party }} <span class="text-[11px] font-normal text-toss-gray-400">{{ p.count }}명</span></span>
          <span class="text-[13px] font-extrabold tabular-nums" :style="{ color: partyColor(p.party) }">
            {{ p.median }}억 <span class="text-[11px] font-semibold text-toss-gray-400">평균 {{ p.avg }}억</span>
          </span>
        </div>
        <div class="h-2.5 rounded-full bg-toss-gray-100 overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: (p.median / maxMed * 100) + '%', background: partyColor(p.party) }" />
        </div>
      </li>
    </ul>
  </section>
</template>
