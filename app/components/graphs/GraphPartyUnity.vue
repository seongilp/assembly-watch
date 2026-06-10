<script setup lang="ts">
import { Link2 } from "lucide-vue-next";
import type { VoteInsights } from "#shared/types";
import { partyColor } from "~/lib/party";

const props = defineProps<{ items: VoteInsights["partyUnity"] }>();
const sorted = computed(() => [...props.items].sort((a, b) => b.unity - a.unity));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Link2 class="size-4 text-toss-blue" /> 정당 결속도
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      같은 당 의원들이 얼마나 한 방향으로 투표하는지 (Rice 지수, 100%에 가까울수록 일사불란).
    </p>

    <ul class="mt-4 space-y-3">
      <li v-for="p in sorted" :key="p.party">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[13px] font-bold text-toss-gray-800">{{ p.party }} <span class="text-[11px] font-normal text-toss-gray-400">{{ p.seats }}석</span></span>
          <span class="text-[13px] font-extrabold tabular-nums" :style="{ color: partyColor(p.party) }">{{ (p.unity * 100).toFixed(0) }}%</span>
        </div>
        <div class="h-2.5 rounded-full bg-toss-gray-100 overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: (p.unity * 100) + '%', background: partyColor(p.party) }" />
        </div>
      </li>
    </ul>
  </section>
</template>
