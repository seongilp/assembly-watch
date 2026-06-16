<script setup lang="ts">
import type { DiningData } from "#shared/types";
const props = defineProps<{ district: DiningData["district"] }>();
</script>

<template>
  <div class="grid sm:grid-cols-2 gap-4">
    <div class="rounded-2xl border border-toss-gray-200 bg-card p-5">
      <h3 class="font-bold text-toss-gray-900 mb-1">자기 지역구에서만 먹는 의원</h3>
      <p class="text-[11px] text-toss-gray-400 mb-3">식당 주소 매칭 커버리지 {{ Math.round(props.district.addrCoverage * 100) }}% · 지역구 의원 기준</p>
      <ol class="space-y-1 text-sm">
        <li v-for="m in props.district.onlyInDistrict.slice(0, 20)" :key="m.id" class="flex justify-between"><span class="font-semibold">{{ m.name }}</span><span class="text-toss-gray-500">{{ m.party }} · {{ m.origin }}</span></li>
        <li v-if="!props.district.onlyInDistrict.length" class="text-toss-gray-400">해당 없음</li>
      </ol>
    </div>
    <div class="rounded-2xl border border-toss-gray-200 bg-card p-5">
      <h3 class="font-bold text-toss-gray-900 mb-1">지역구에서 안 먹는 의원</h3>
      <p class="text-[11px] text-toss-gray-400 mb-3">지역구 밖(주로 여의도)에서만 지출 · 비례대표 {{ props.district.proportional.length }}명 제외</p>
      <ol class="space-y-1 text-sm">
        <li v-for="m in props.district.neverInDistrict.slice(0, 20)" :key="m.id" class="flex justify-between"><span class="font-semibold">{{ m.name }}</span><span class="text-toss-gray-500">{{ m.party }} · {{ m.origin }}</span></li>
        <li v-if="!props.district.neverInDistrict.length" class="text-toss-gray-400">해당 없음</li>
      </ol>
    </div>
  </div>
</template>
