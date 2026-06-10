<script setup lang="ts">
import { Layers } from "lucide-vue-next";
import type { GraphData } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();

const maxCount = computed(() => Math.max(...props.data.terms.buckets.map((b) => b.count), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Layers class="size-4 text-toss-blue" /> 선수 피라미드
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">초선부터 다선까지, 국회 경력 분포.</p>

    <!-- 선수별 막대 (피라미드 느낌으로 가운데 정렬) -->
    <div class="mt-4 space-y-2">
      <div v-for="b in data.terms.buckets" :key="b.term" class="flex items-center gap-3">
        <span class="w-10 shrink-0 text-[12px] font-bold text-toss-gray-600 text-right">{{ b.term }}</span>
        <div class="flex-1">
          <div
            class="h-6 rounded-md bg-gradient-to-r from-toss-blue to-[#7C3AED] flex items-center justify-end pr-2"
            :style="{ width: Math.max((b.count / maxCount) * 100, 6) + '%' }"
          >
            <span class="text-[11px] font-extrabold text-white tabular-nums">{{ b.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 최다선 명예의 전당 -->
    <p class="mt-5 mb-2 text-[12px] font-bold text-[#7C3AED]">최다선 명예의 전당</p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <NuxtLink
        v-for="m in data.terms.veterans"
        :key="m.id"
        :to="`/members/${m.id}`"
        class="flex flex-col items-center gap-1 rounded-xl bg-toss-gray-50 p-2.5 hover:bg-toss-gray-100"
      >
        <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="44" />
        <span class="text-[12px] font-bold text-toss-gray-900 truncate max-w-full">{{ m.name }}</span>
        <span class="text-[11px] font-extrabold text-[#7C3AED]">{{ m.reelection }}</span>
        <span class="text-[10px] text-toss-gray-400 truncate max-w-full">{{ normalizeParty(m.party) }}</span>
      </NuxtLink>
    </div>
  </section>
</template>
