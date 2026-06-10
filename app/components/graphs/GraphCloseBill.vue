<script setup lang="ts">
import { Scale } from "lucide-vue-next";
import type { GraphData } from "#shared/types";
import { formatDate } from "~/lib/format";

const props = defineProps<{ data: GraphData }>();
const b = computed(() => props.data.closeBill);
const tot = computed(() => (b.value ? b.value.y + b.value.n + b.value.b : 0));
</script>

<template>
  <section v-if="b" class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Scale class="size-4 text-toss-blue" /> 박빙의 순간
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">최근 본회의에서 표가 가장 팽팽하게 갈린 안건입니다.</p>

    <div class="mt-3 rounded-xl bg-toss-gray-50 p-3.5">
      <p class="text-[14px] font-bold text-toss-gray-900 leading-snug">{{ b.name }}</p>
      <p class="mt-1 text-[11px] text-toss-gray-400">{{ formatDate(b.date) }} · {{ b.committee }} · {{ b.procResult }}</p>
    </div>

    <!-- 찬반 게이지 -->
    <div class="mt-4 flex h-9 w-full overflow-hidden rounded-lg text-[12px] font-bold text-white">
      <div class="flex items-center justify-center bg-[#3182F6]" :style="{ width: (b.y / tot * 100) + '%' }">찬성 {{ b.y }}</div>
      <div class="flex items-center justify-center bg-[#FF9500]" :style="{ width: (b.b / tot * 100) + '%' }" :title="`기권 ${b.b}`">{{ b.b }}</div>
      <div class="flex items-center justify-center bg-[#F04452]" :style="{ width: (b.n / tot * 100) + '%' }">반대 {{ b.n }}</div>
    </div>

    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p class="text-[12px] font-bold text-[#3182F6] mb-2">찬성 {{ b.yes.length }}명</p>
        <div class="flex flex-wrap gap-0.5">
          <NuxtLink v-for="m in b.yes" :key="m.id" :to="`/members/${m.id}`" :title="`${m.name} · ${m.party}`" class="hover:scale-110 transition-transform">
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="20" />
          </NuxtLink>
        </div>
      </div>
      <div>
        <p class="text-[12px] font-bold text-[#F04452] mb-2">반대 {{ b.no.length }}명</p>
        <div class="flex flex-wrap gap-0.5">
          <NuxtLink v-for="m in b.no" :key="m.id" :to="`/members/${m.id}`" :title="`${m.name} · ${m.party}`" class="hover:scale-110 transition-transform">
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="20" />
          </NuxtLink>
        </div>
        <template v-if="b.blank.length">
          <p class="text-[12px] font-bold text-[#FF9500] mt-3 mb-2">기권 {{ b.blank.length }}명</p>
          <div class="flex flex-wrap gap-0.5">
            <NuxtLink v-for="m in b.blank" :key="m.id" :to="`/members/${m.id}`" :title="`${m.name} · ${m.party}`" class="hover:scale-110 transition-transform">
              <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="20" />
            </NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
