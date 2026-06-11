<script setup lang="ts">
import { Star } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();
const maxCount = computed(() => Math.max(...props.data.starsigns.map((s) => s.count), 1));
const sorted = computed(() => [...props.data.starsigns].sort((a, b) => b.count - a.count));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Star class="size-4 text-toss-blue" /> 별자리로 보는 국회
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">의원들의 별자리 분포. 정치인의 별자리는?</p>

    <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      <div v-for="s in sorted" :key="s.sign" class="rounded-xl bg-toss-gray-50 p-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[13px] font-bold text-toss-gray-800">{{ s.emoji }} {{ s.sign }}</span>
          <span class="text-[13px] font-extrabold tabular-nums text-toss-blue">{{ s.count }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-toss-gray-200 overflow-hidden">
          <div class="h-full rounded-full bg-[#7C3AED]" :style="{ width: (s.count / maxCount * 100) + '%' }" />
        </div>
        <div class="mt-2 flex flex-wrap gap-0.5">
          <NuxtLink
            v-for="m in s.members.slice(0, 8)"
            :key="m.id"
            :to="`/members/${m.id}`"
            :title="`${m.name} · ${m.party}`"
            class="hover:scale-110 transition-transform"
          >
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="22" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
