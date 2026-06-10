<script setup lang="ts">
import { PersonStanding } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();

const total = computed(() => props.data.gender.total.남 + props.data.gender.total.여);
const womenRate = computed(() => Math.round((props.data.gender.total.여 / total.value) * 1000) / 10);
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <VenusAndMars class="size-4 text-toss-blue" /> 여의도 성비
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      전체 {{ total }}명 중 여성 <b class="text-[#EC4899]">{{ data.gender.total.여 }}명</b> ({{ womenRate }}%) · 남성 {{ data.gender.total.남 }}명
    </p>

    <!-- 전체 비율 바 -->
    <div class="mt-4 flex h-8 w-full overflow-hidden rounded-lg text-[12px] font-bold text-white">
      <div class="flex items-center justify-center bg-[#3182F6]" :style="{ width: (100 - womenRate) + '%' }">남 {{ data.gender.total.남 }}</div>
      <div class="flex items-center justify-center bg-[#EC4899]" :style="{ width: womenRate + '%' }">여 {{ data.gender.total.여 }}</div>
    </div>

    <!-- 성별 평균 나이 -->
    <div v-if="data.gender.ageAvg.남 && data.gender.ageAvg.여" class="mt-4 flex gap-3">
      <div class="flex-1 rounded-xl bg-[#3182F6]/10 p-3 text-center">
        <p class="text-[11px] font-semibold text-[#3182F6]">남성 평균</p>
        <p class="text-[18px] font-extrabold text-[#3182F6] tabular-nums">{{ data.gender.ageAvg.남 }}세</p>
      </div>
      <div class="flex-1 rounded-xl bg-[#EC4899]/10 p-3 text-center">
        <p class="text-[11px] font-semibold text-[#EC4899]">여성 평균</p>
        <p class="text-[18px] font-extrabold text-[#EC4899] tabular-nums">{{ data.gender.ageAvg.여 }}세</p>
      </div>
    </div>

    <!-- 정당별 여성 비율 -->
    <div class="mt-5 space-y-2.5">
      <div v-for="p in data.gender.byParty" :key="p.party" class="flex items-center gap-3">
        <span class="w-24 shrink-0 text-[12px] font-semibold text-toss-gray-600 truncate text-right">{{ p.party }}</span>
        <div class="flex-1 flex h-5 overflow-hidden rounded-md bg-toss-gray-100">
          <div class="bg-[#3182F6]/70" :style="{ width: (p.남 / p.total * 100) + '%' }" />
          <div class="bg-[#EC4899]" :style="{ width: (p.여 / p.total * 100) + '%' }" />
        </div>
        <span class="w-14 shrink-0 text-[11px] tabular-nums text-toss-gray-400">여 {{ p.womenRate }}%</span>
      </div>
    </div>

    <!-- 여성 의원 얼굴 -->
    <p class="mt-5 mb-2 text-[12px] font-bold text-[#EC4899]">여성 의원 {{ data.gender.women.length }}명</p>
    <div class="flex flex-wrap gap-1">
      <NuxtLink
        v-for="m in data.gender.women"
        :key="m.id"
        :to="`/members/${m.id}`"
        :title="`${m.name} · ${m.party}`"
        class="hover:scale-110 transition-transform"
      >
        <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="30" />
      </NuxtLink>
    </div>
  </section>
</template>
