<script setup lang="ts">
import type { VoteAnalysisTop } from "#shared/types";
import { formatDateTime } from "~/lib/format";

defineProps<{ data: VoteAnalysisTop }>();
</script>

<template>
  <div class="space-y-4">
    <p class="text-[13px] text-toss-gray-500">
      최근 본회의 표결 <b class="text-toss-gray-900">{{ data.billCount }}</b>건을
      지역·재산·세대·선수·성별·띠·성씨 등 10개 차원으로 훑어 가장 또렷한 패턴을 골랐습니다.
      카드를 누르면 해당 표결의 전체 분석으로 이동합니다.
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <NuxtLink
        v-for="t in data.topPicks"
        :key="t.billId"
        :to="`/votes/${t.billId}`"
        class="block rounded-2xl bg-card card-shadow p-5 transition-shadow hover:ring-2 hover:ring-toss-blue/30"
      >
        <p class="mb-1 text-[12px] text-toss-gray-400">
          {{ formatDateTime(t.date) }} ·
          <span class="font-semibold text-[#3182F6]">찬 {{ t.y }}</span> ·
          <span class="font-semibold text-[#F04452]">반 {{ t.n }}</span> ·
          <span class="font-semibold text-[#FF9500]">기권 {{ t.b }}</span>
        </p>
        <p class="mb-3 line-clamp-2 text-[14px] font-bold leading-snug text-toss-gray-900">
          {{ t.billName }}
        </p>
        <VoteFactBody :fact="t.fact" />
      </NuxtLink>
    </div>

    <p class="text-[11px] text-toss-gray-400">
      ※ 재미로 보는 통계적 관찰입니다. 집단 간 차이는 정당 구성 등 다른 요인의 그림자일 수 있으며
      인과관계를 의미하지 않습니다. 찬성률은 출석(찬성+반대+기권) 기준.
    </p>
  </div>
</template>
