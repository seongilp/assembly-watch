<script setup lang="ts">
import { FileText, FileX, UserX, ThumbsUp, ThumbsDown, MinusCircle, CalendarX, Award, Sparkles } from "lucide-vue-next";
import type { Insights, VoteInsights } from "#shared/types";

const { data } = await useFetch<Insights>("/api/insights");
const { data: vi } = await useFetch<VoteInsights>("/api/vote-insights", { key: "vote-insights" });

useHead({ title: "펀팩트 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회 · 재미로 보는"
      title="의정활동 펀팩트"
      :subtitle="`대표발의는 전체 기준, 표결 항목은 최근 본회의 ${data?.voteBills ?? 0}회 기준`"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RankingCard
        title="최다선 의원"
        :icon="Award"
        :items="data?.terms ?? []"
        unit="선"
        accent="#7C3AED"
      />
      <RankingCard
        title="가장 많이 발의한 의원"
        :icon="FileText"
        :items="data?.proposed ?? []"
        unit="건"
        accent="#3182F6"
        crown="발의왕"
      />
      <RankingCard
        title="가장 적게 발의한 의원"
        :icon="FileX"
        :items="data?.leastProposed ?? []"
        unit="건"
        accent="#8B95A1"
      />
      <RankingCard
        title="가장 많이 불참한 의원"
        :icon="UserX"
        :items="data?.absent ?? []"
        unit="회"
        accent="#8B95A1"
        crown="불참왕"
      />
      <RankingCard
        title="가장 많이 찬성한 의원"
        :icon="ThumbsUp"
        :items="data?.yes ?? []"
        unit="회"
        accent="#3182F6"
        crown="찬성왕"
      />
      <RankingCard
        title="가장 많이 반대한 의원"
        :icon="ThumbsDown"
        :items="data?.no ?? []"
        unit="회"
        accent="#F04452"
        crown="반대왕"
      />
      <RankingCard
        title="가장 많이 기권한 의원"
        :icon="MinusCircle"
        :items="data?.blank ?? []"
        unit="회"
        accent="#FF9500"
        crown="기권왕"
      />
      <RankingCard
        title="출석률(투표 참여) 낮은 의원"
        :icon="CalendarX"
        :items="data?.attendanceLow ?? []"
        metric="rate"
        accent="#D63A45"
        crown="결석왕"
      />
      <RankingCard
        title="소신왕 (당론과 다르게 투표)"
        :icon="Sparkles"
        :items="vi?.rebel ?? []"
        unit="회"
        accent="#7C3AED"
        crown="소신왕"
      />
    </div>

    <VoteExtraPanel v-if="vi" :data="vi" class="mt-4" />

    <p class="mt-6 text-center text-[12px] text-toss-gray-400">
      ※ 표결 통계는 최근 본회의 표결을 표본으로 한 참고용 수치입니다. 발의는 대표발의 기준.
    </p>
  </div>
</template>
