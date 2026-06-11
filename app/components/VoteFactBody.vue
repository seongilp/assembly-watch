<script setup lang="ts">
import type { VoteFact } from "#shared/types";

defineProps<{ fact: VoteFact }>();
</script>

<template>
  <div>
    <div class="flex items-center gap-2">
      <p class="text-[14px] font-extrabold text-toss-gray-900">{{ fact.title }}</p>
      <span
        v-if="fact.fun"
        class="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
      >
        재미로
      </span>
    </div>
    <p class="mt-1 text-[13px] leading-relaxed text-toss-gray-600">{{ fact.text }}</p>

    <!-- 그룹별 찬성률 미니 바 -->
    <div v-if="fact.groups?.length" class="mt-2.5 space-y-1.5">
      <div v-for="g in fact.groups" :key="g.label" class="flex items-center gap-2">
        <span class="w-[108px] shrink-0 truncate text-right text-[11px] font-semibold text-toss-gray-500">
          {{ g.label }}
        </span>
        <div class="h-[14px] flex-1 overflow-hidden rounded-md bg-toss-gray-100">
          <div
            class="h-full rounded-md bg-toss-blue transition-all"
            :style="{ width: `${Math.max(g.rate, 2)}%` }"
          />
        </div>
        <span class="w-[84px] shrink-0 text-[11px] font-bold tabular-nums text-toss-gray-700">
          {{ g.rate }}%
          <span class="font-medium text-toss-gray-400">· {{ g.yes + g.no + g.blank }}명</span>
        </span>
      </div>
    </div>

    <!-- 당내 균열 소수파 명단 (카드 전체가 링크일 수 있어 중첩 앵커 방지 위해 텍스트 칩) -->
    <div v-if="fact.rebels?.length" class="mt-2 flex flex-wrap gap-1.5">
      <span
        v-for="r in fact.rebels"
        :key="r.id"
        class="rounded-full bg-toss-gray-50 px-2.5 py-1 text-[11px] font-semibold text-toss-gray-600"
      >
        {{ r.name }}
      </span>
    </div>
  </div>
</template>
