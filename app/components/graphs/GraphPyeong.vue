<script setup lang="ts">
import { Home } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();

const buckets = computed(() => props.data.pyeong.buckets);
const maxCount = computed(() => Math.max(...buckets.value.map((b) => b.count), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Home class="size-4 text-toss-blue" /> 평수로 보는 국회
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      소유 아파트 평수 구간별 집단 특성. 집 크면 어느 당? (본인·배우자 소유 {{ data.pyeong.total }}명 기준)
    </p>

    <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      <div v-for="b in buckets" :key="b.label" class="rounded-xl bg-toss-gray-50 p-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[13px] font-bold text-toss-gray-800">🏠 {{ b.label }}</span>
          <span class="text-[13px] font-extrabold tabular-nums text-toss-blue">{{ b.count }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-toss-gray-200 overflow-hidden">
          <div class="h-full rounded-full bg-[#0EA5E9]" :style="{ width: (b.count / maxCount * 100) + '%' }" />
        </div>
        <div class="mt-2 flex flex-wrap gap-0.5">
          <NuxtLink
            v-for="m in b.members.slice(0, 8)"
            :key="m.id"
            :to="`/members/${m.id}`"
            :title="`${m.name} · ${m.party}`"
            class="hover:scale-110 transition-transform"
          >
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="22" />
          </NuxtLink>
        </div>
        <GraphsGraphGroupStats :stats="b.stats" :badges="b.badges" accent="#0EA5E9" />
      </div>
    </div>
  </section>
</template>
