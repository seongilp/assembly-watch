<script setup lang="ts">
import { MapPinned } from "lucide-vue-next";
import type { GraphData } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();
const maxTotal = computed(() => Math.max(...props.data.regions.map((r) => r.total), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <MapPinned class="size-4 text-toss-blue" /> 지역 세력도
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">시·도별 지역구 의석과 정당 구성 (비례대표 제외).</p>

    <ul class="mt-4 space-y-2">
      <li v-for="r in data.regions" :key="r.region" class="flex items-center gap-3">
        <span class="w-9 shrink-0 text-[12px] font-bold text-toss-gray-700 text-right">{{ r.region }}</span>
        <div class="flex-1 flex h-6 overflow-hidden rounded-md bg-toss-gray-100" :style="{ maxWidth: (r.total / maxTotal * 100) + '%' }">
          <div
            v-for="p in r.parties"
            :key="p.party"
            :style="{ width: (p.count / r.total * 100) + '%', background: partyColor(p.party) }"
            :title="`${p.party} ${p.count}석`"
          />
        </div>
        <span class="w-10 shrink-0 text-[12px] font-extrabold tabular-nums text-toss-gray-500">{{ r.total }}석</span>
      </li>
    </ul>

    <div class="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
      <span v-for="p in data.parties.slice(0, 5)" :key="p.party" class="inline-flex items-center gap-1 text-[11px] text-toss-gray-500">
        <span class="size-2.5 rounded-full" :style="{ background: partyColor(p.party) }" /> {{ p.party }}
      </span>
    </div>
  </section>
</template>
