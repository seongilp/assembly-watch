<script setup lang="ts">
import { Users2 } from "lucide-vue-next";
import type { GraphData } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();
const maxTotal = computed(() => Math.max(...props.data.generations.map((g) => g.total), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Users2 class="size-4 text-toss-blue" /> 세대별 의회 지형
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">연령대별 의원 수와 정당 구성. 젊은 세대는 어느 당에 많을까?</p>

    <ul class="mt-4 space-y-2.5">
      <li v-for="g in data.generations" :key="g.decade" class="flex items-center gap-3">
        <span class="w-12 shrink-0 text-[12px] font-bold text-toss-gray-700 text-right">{{ g.decade }}대</span>
        <div class="flex-1 flex h-6 overflow-hidden rounded-md bg-toss-gray-100" :style="{ maxWidth: (g.total / maxTotal * 100) + '%' }">
          <div
            v-for="p in g.parties"
            :key="p.party"
            :style="{ width: (p.count / g.total * 100) + '%', background: partyColor(p.party) }"
            :title="`${p.party} ${p.count}명`"
          />
        </div>
        <span class="w-10 shrink-0 text-[12px] font-extrabold tabular-nums text-toss-gray-500">{{ g.total }}명</span>
      </li>
    </ul>

    <div class="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
      <span v-for="p in data.parties.slice(0, 5)" :key="p.party" class="inline-flex items-center gap-1 text-[11px] text-toss-gray-500">
        <span class="size-2.5 rounded-full" :style="{ background: partyColor(p.party) }" /> {{ p.party }}
      </span>
    </div>
  </section>
</template>
