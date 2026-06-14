<script setup lang="ts">
import { MapPin } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();
const homes = computed(() => props.data.homes);
const maxCount = computed(() => Math.max(...homes.value.map((h) => h.count), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <MapPin class="size-4 text-toss-blue" /> 사는 동네로 보는 국회
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">의원들이 가장 많이 사는 구. 부촌엔 어느 당? (거주지 기준 상위 12개)</p>

    <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      <div v-for="h in homes" :key="h.gu" class="rounded-xl bg-toss-gray-50 p-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[13px] font-bold text-toss-gray-800 truncate">📍 {{ h.gu }}</span>
          <span class="text-[13px] font-extrabold tabular-nums text-toss-blue shrink-0">{{ h.count }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-toss-gray-200 overflow-hidden">
          <div class="h-full rounded-full bg-[#14B8A6]" :style="{ width: (h.count / maxCount * 100) + '%' }" />
        </div>
        <div class="mt-2 flex flex-wrap gap-0.5">
          <NuxtLink
            v-for="m in h.members.slice(0, 8)"
            :key="m.id"
            :to="`/members/${m.id}`"
            :title="`${m.name} · ${m.party}`"
            class="hover:scale-110 transition-transform"
          >
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="22" />
          </NuxtLink>
        </div>
        <GraphsGraphGroupStats :stats="h.stats" :badges="h.badges" accent="#14B8A6" />
      </div>
    </div>
  </section>
</template>
