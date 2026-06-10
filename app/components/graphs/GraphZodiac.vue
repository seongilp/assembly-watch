<script setup lang="ts">
import { Sparkles } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();

const EMOJI: Record<string, string> = {
  쥐: "🐭", 소: "🐮", 호랑이: "🐯", 토끼: "🐰", 용: "🐲", 뱀: "🐍",
  말: "🐴", 양: "🐑", 원숭이: "🐵", 닭: "🐔", 개: "🐶", 돼지: "🐷",
};
const maxCount = computed(() => Math.max(...props.data.zodiac.map((z) => z.count), 1));
const sorted = computed(() => [...props.data.zodiac].sort((a, b) => b.count - a.count));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Sparkles class="size-4 text-toss-blue" /> 띠로 보는 국회
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">의원들의 십이지 분포. 가장 많은 띠는?</p>

    <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      <div
        v-for="z in sorted"
        :key="z.zodiac"
        class="rounded-xl bg-toss-gray-50 p-3"
      >
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[13px] font-bold text-toss-gray-800">{{ EMOJI[z.zodiac] }} {{ z.zodiac }}띠</span>
          <span class="text-[13px] font-extrabold tabular-nums text-toss-blue">{{ z.count }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-toss-gray-200 overflow-hidden">
          <div class="h-full rounded-full bg-toss-blue" :style="{ width: (z.count / maxCount * 100) + '%' }" />
        </div>
        <div class="mt-2 flex flex-wrap gap-0.5">
          <NuxtLink
            v-for="m in z.members.slice(0, 8)"
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
