<script setup lang="ts">
import type { VoteStats } from "#shared/types";
import { formatNumber } from "~/lib/format";

const { data } = useFetch<VoteStats>("/api/vote-stats", { key: "vote-stats" });

const COLORS = { 찬성: "#3182F6", 반대: "#F04452", 기권: "#FF9500", 불참: "#B0B8C1" };
const RESULTS = ["찬성", "반대", "기권", "불참"] as const;
const partyClr = usePartyColor();
const open = ref(false);
</script>

<template>
  <div v-if="data?.parties?.length" class="mb-5 rounded-2xl bg-card card-shadow p-5">
    <button class="flex w-full items-center justify-between gap-2" @click="open = !open">
      <div class="text-left">
        <h2 class="text-[15px] font-bold text-toss-gray-900">정당별 누적 표결 통계</h2>
        <p class="text-[12px] text-toss-gray-400">최근 {{ data.bills }}건 본회의 표결 합산 · 찬/반/기권/불참</p>
      </div>
      <span class="shrink-0 text-[12px] font-bold text-toss-blue">{{ open ? "접기" : "펼치기" }}</span>
    </button>

    <div class="mt-2 flex items-center gap-3 text-[11px] font-semibold">
      <span v-for="r in RESULTS" :key="r" class="inline-flex items-center gap-1 text-toss-gray-500">
        <span class="size-2.5 rounded-sm" :style="{ backgroundColor: COLORS[r] }" />{{ r }}
      </span>
    </div>

    <div v-show="open" class="mt-4 space-y-3">
      <div v-for="p in data.parties" :key="p.party">
        <div class="flex items-baseline justify-between mb-1">
          <span class="inline-flex items-center gap-1.5 text-[13px] font-bold" :style="{ color: partyClr(p.party) }">
            <span class="size-2.5 rounded-full" :style="{ backgroundColor: partyClr(p.party) }" />{{ p.party }}
          </span>
          <span class="text-[11px] text-toss-gray-400">표결 {{ formatNumber(p.total) }}</span>
        </div>
        <div class="flex h-3 w-full overflow-hidden rounded-full bg-toss-gray-100">
          <div
            v-for="r in RESULTS"
            :key="r"
            class="h-full"
            :style="{ width: (p[r] / p.total) * 100 + '%', backgroundColor: COLORS[r] }"
            :title="`${r} ${p[r]}`"
          />
        </div>
        <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold tabular-nums">
          <span v-for="r in RESULTS" :key="r" v-show="p[r] > 0" :style="{ color: COLORS[r] }">
            {{ r }} {{ formatNumber(p[r]) }}
            <span class="text-toss-gray-400 font-semibold">({{ ((p[r] / p.total) * 100).toFixed(0) }}%)</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
