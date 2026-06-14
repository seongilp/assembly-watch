<script setup lang="ts">
import { Lightbulb } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();
const items = computed(() => props.data.discoveries ?? []);
</script>

<template>
  <section v-if="items.length" class="rounded-2xl bg-gradient-to-br from-toss-blue/[0.07] to-[#7C3AED]/[0.07] card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Lightbulb class="size-4 text-toss-blue" /> 이런 게 보이네요
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">띠·별자리·성씨·평수·재산·동네를 가로질러 찾은 발견들.</p>

    <ul class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <li
        v-for="(d, i) in items"
        :key="i"
        class="flex items-start gap-2.5 rounded-xl bg-card/70 p-3"
      >
        <span class="text-[18px] leading-none shrink-0">{{ d.icon }}</span>
        <span class="text-[13px] font-medium text-toss-gray-700 leading-snug">{{ d.text }}</span>
      </li>
    </ul>
  </section>
</template>
