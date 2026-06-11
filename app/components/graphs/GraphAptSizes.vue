<script setup lang="ts">
import { Ruler } from "lucide-vue-next";
import type { WealthData } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ data: WealthData }>();
const maxCount = computed(() => Math.max(...props.data.apt.buckets.map((b) => b.count), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Ruler class="size-4 text-toss-blue" /> 의원 아파트는 몇 평?
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      소유 아파트 {{ data.apt.total }}채 전용·공급면적 기준 분포 · 평균
      <b class="text-toss-gray-700">{{ data.apt.avgPyeong }}평</b>
    </p>

    <!-- 평형 히스토그램 (막대 높이는 px — %는 부모 높이 auto 라 붕괴) -->
    <div class="mt-4 flex items-end gap-2">
      <div v-for="b in data.apt.buckets" :key="b.label" class="flex-1 flex flex-col items-center justify-end gap-1">
        <span class="text-[11px] font-extrabold tabular-nums text-toss-blue">{{ b.count }}</span>
        <div
          class="w-full rounded-t-md bg-gradient-to-t from-toss-blue to-[#7C3AED]"
          :style="{ height: Math.max((b.count / maxCount) * 96, 4) + 'px' }"
        />
        <span class="text-[10px] text-toss-gray-400 whitespace-nowrap">{{ b.label }}</span>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-4">
      <div>
        <p class="text-[12px] font-bold text-[#7C3AED] mb-2">가장 넓은 집 🏰</p>
        <ul class="space-y-1.5">
          <li v-for="a in data.apt.largest" :key="a.id + a.m2">
            <NuxtLink :to="`/members/${a.id}`" class="flex items-center gap-2 hover:opacity-80">
              <MemberAvatar :id="a.id" :name="a.name" :party="a.party" :size="28" />
              <div class="min-w-0">
                <p class="text-[13px] font-semibold text-toss-gray-800 truncate leading-tight">{{ a.name }}</p>
                <p class="text-[10px] text-toss-gray-400 truncate">{{ a.gu }}</p>
              </div>
              <span class="text-[12px] font-extrabold tabular-nums text-[#7C3AED] ml-auto shrink-0">{{ a.pyeong }}평</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div>
        <p class="text-[12px] font-bold text-toss-gray-500 mb-2">가장 작은 집 🏠</p>
        <ul class="space-y-1.5">
          <li v-for="a in data.apt.smallest" :key="a.id + a.m2">
            <NuxtLink :to="`/members/${a.id}`" class="flex items-center gap-2 hover:opacity-80">
              <MemberAvatar :id="a.id" :name="a.name" :party="a.party" :size="28" />
              <div class="min-w-0">
                <p class="text-[13px] font-semibold text-toss-gray-800 truncate leading-tight">{{ a.name }}</p>
                <p class="text-[10px] text-toss-gray-400 truncate">{{ a.gu }}</p>
              </div>
              <span class="text-[12px] font-extrabold tabular-nums text-toss-gray-600 ml-auto shrink-0">{{ a.pyeong }}평</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
    <p class="mt-3 text-[11px] text-toss-gray-400">※ 신고서 명세의 건물 면적(㎡) 기준, 1평=3.3058㎡ 환산. 다주택자는 집마다 표시될 수 있어요.</p>
  </section>
</template>
