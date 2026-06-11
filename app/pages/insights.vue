<script setup lang="ts">
import { FileText, FileX, UserX, ThumbsUp, ThumbsDown, MinusCircle, CalendarX, Award, Sparkles, Trophy, Network, Wallet, Building, TrendingUp, Target, MessageCircleOff } from "lucide-vue-next";
import type { Insights, VoteInsights, GraphData, WealthData, InsightMember } from "#shared/types";

const { data } = await useFetch<Insights>("/api/insights");
const { data: vi } = await useFetch<VoteInsights>("/api/vote-insights", { key: "vote-insights" });
const { data: g } = await useFetch<GraphData>("/api/graph", { key: "graph" });
const { data: w } = await useFetch<WealthData>("/api/wealth", { key: "wealth" });

const tab = ref<"fun" | "graph" | "wealth">("fun");

// 재산(억) → RankingCard(count) 매핑
const asRank = (rows?: { id: string; name: string; party: string; origin: string; total: number }[]): InsightMember[] =>
  (rows ?? []).map((r) => ({ id: r.id, name: r.name, party: r.party, origin: r.origin, photo: "", count: r.total }));
const wealthRank = computed(() => asRank(w.value?.members));
const wealthLow = computed(() => asRank([...(w.value?.members ?? [])].reverse()));
const realEstateRank = computed(() => asRank(w.value?.realEstate));
const deltaRank = computed(() =>
  (w.value?.delta ?? []).map((r) => ({ id: r.id, name: r.name, party: r.party, origin: r.origin, photo: "", count: r.delta })),
);

useHead({ title: "펀팩트 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회 · 재미로 보는"
      title="의정활동 펀팩트"
      :subtitle="`대표발의는 전체 기준, 표결 항목은 최근 본회의 ${data?.voteBills ?? 0}회 기준`"
    />

    <!-- 🎂 생일 (탭 공통 배너) -->
    <ClientOnly>
      <GraphsGraphBirthday v-if="g" :data="g" class="mb-4" />
    </ClientOnly>

    <!-- 탭 -->
    <div class="mb-5 inline-flex rounded-xl bg-toss-gray-100 p-1">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold transition-colors"
        :class="tab === 'fun' ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
        @click="tab = 'fun'"
      >
        <Trophy class="size-4" /> 랭킹
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold transition-colors"
        :class="tab === 'graph' ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
        @click="tab = 'graph'"
      >
        <Network class="size-4" /> 데이터 그래프
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold transition-colors"
        :class="tab === 'wealth' ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
        @click="tab = 'wealth'"
      >
        <Wallet class="size-4" /> 재산
      </button>
    </div>

    <!-- 랭킹 탭 -->
    <template v-if="tab === 'fun'">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard title="최다선 의원" :icon="Award" :items="data?.terms ?? []" unit="선" accent="#7C3AED" />
        <RankingCard title="가장 많이 발의한 의원" :icon="FileText" :items="data?.proposed ?? []" unit="건" accent="#3182F6" crown="발의왕" />
        <RankingCard title="발의 실속왕 (반영률 높음)" :icon="Target" :items="g?.passRate?.best ?? []" metric="rate" accent="#00B5A5" crown="실속왕" />
        <RankingCard title="발의 공갈왕 (반영 0건)" :icon="MessageCircleOff" :items="g?.passRate?.worst ?? []" metric="rate" accent="#8B95A1" crown="공갈왕" />
        <RankingCard title="가장 적게 발의한 의원" :icon="FileX" :items="data?.leastProposed ?? []" unit="건" accent="#8B95A1" crown="잠수왕" />
        <RankingCard title="가장 많이 불참한 의원" :icon="UserX" :items="data?.absent ?? []" unit="회" accent="#8B95A1" crown="불참왕" />
        <RankingCard title="가장 많이 찬성한 의원" :icon="ThumbsUp" :items="data?.yes ?? []" unit="회" accent="#3182F6" crown="찬성왕" />
        <RankingCard title="가장 많이 반대한 의원" :icon="ThumbsDown" :items="data?.no ?? []" unit="회" accent="#F04452" crown="반대왕" />
        <RankingCard title="가장 많이 기권한 의원" :icon="MinusCircle" :items="data?.blank ?? []" unit="회" accent="#FF9500" crown="기권왕" />
        <RankingCard title="출석률(투표 참여) 낮은 의원" :icon="CalendarX" :items="data?.attendanceLow ?? []" metric="rate" accent="#D63A45" crown="결석왕" />
        <RankingCard title="소신왕 (당론과 다르게 투표)" :icon="Sparkles" :items="vi?.rebel ?? []" unit="회" accent="#7C3AED" crown="소신왕" />
      </div>
      <p class="mt-3 text-[11px] text-toss-gray-400">
        ※ 실속왕·공갈왕: {{ g?.passRate?.sample }} · 발의 10건 이상 의원 대상
      </p>
      <VoteExtraPanel v-if="vi" :data="vi" class="mt-4" />
    </template>

    <!-- 데이터 그래프 탭 -->
    <template v-else-if="tab === 'graph'">
      <div v-if="g" class="space-y-4">
        <GraphsGraphPoliticalMap :data="g" />
        <GraphsGraphPairs :data="g" />
        <GraphsGraphAgeSwarm :data="g" />
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GraphsGraphPartyAge :data="g" />
          <GraphsGraphGenerationParty :data="g" />
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GraphsGraphGender :data="g" />
          <GraphsGraphTerms :data="g" />
        </div>
        <GraphsGraphCloseBill :data="g" />
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GraphsGraphUnanimous v-if="vi" :count="vi.unanimous.count" :total="vi.unanimous.total" />
          <GraphsGraphPartyUnity v-if="vi" :items="vi.partyUnity" />
        </div>
        <GraphsGraphRegions :data="g" />
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GraphsGraphZodiac :data="g" />
          <GraphsGraphStarsigns :data="g" />
        </div>
        <GraphsGraphSurnames :data="g" />
      </div>
      <div v-else class="rounded-2xl bg-card card-shadow p-10 text-center text-toss-gray-400">
        데이터를 불러오는 중…
      </div>
    </template>

    <!-- 재산 탭 -->
    <template v-else>
      <div v-if="w?.members?.length" class="space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankingCard title="재산 랭킹" :icon="Wallet" :items="wealthRank" unit="억" accent="#C98A00" crown="재력왕" />
          <RankingCard title="재산이 가장 적은 의원" :icon="Wallet" :items="wealthLow" unit="억" accent="#8B95A1" />
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankingCard title="부동산 부자 TOP" :icon="Building" :items="realEstateRank" unit="억" accent="#7C3AED" crown="부동산왕" />
          <RankingCard title="1년 새 재산 증가 TOP" :icon="TrendingUp" :items="deltaRank" unit="억" accent="#F04452" />
        </div>
        <GraphsGraphWealthParty :data="w" />
        <GraphsGraphHomes :data="w" />
        <p class="text-[11px] text-toss-gray-400">
          ※ {{ w.basis }} · 금액은 신고가액(억원). 자료:
          <a href="https://github.com/opengirok/congress_asset_disclosure" target="_blank" class="underline hover:text-toss-blue">투명사회를 위한 정보공개센터</a>가
          국회공보 PDF를 정제해 공개한 데이터 · 원자료: 국회공보. 원본과 차이가 있을 수 있습니다.
        </p>
      </div>
      <div v-else class="rounded-2xl bg-card card-shadow p-10 text-center text-toss-gray-400">
        재산 데이터를 불러오는 중…
      </div>
    </template>

    <p class="mt-6 text-center text-[12px] text-toss-gray-400">
      ※ 표결 통계는 최근 본회의 표결을 표본으로 한 참고용 수치입니다. 발의는 대표발의 기준.
    </p>
  </div>
</template>
