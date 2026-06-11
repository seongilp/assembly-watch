<script setup lang="ts">
import { Home, DoorOpen, ChevronDown } from "lucide-vue-next";
import type { WealthData } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ data: WealthData }>();

const maxGu = computed(() => Math.max(...props.data.homesTop.map((h) => h.count), 1));
const expanded = ref(false);
const shown = computed(() => (expanded.value ? props.data.betrayal : props.data.betrayal.slice(0, 10)));
const hidden = computed(() => Math.max(props.data.betrayal.length - 10, 0));
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- 의원들의 집은 어디에 -->
    <section class="rounded-2xl bg-card card-shadow p-6">
      <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
        <Home class="size-4 text-toss-blue" /> 의원들의 집은 어디에
      </h2>
      <p class="mt-1 text-[12px] text-toss-gray-400">본인·배우자 소유 주택(아파트 등) 소재지 TOP.</p>
      <ul class="mt-4 space-y-2">
        <li v-for="h in data.homesTop" :key="h.gu" class="flex items-center gap-3">
          <span class="w-24 shrink-0 text-[12px] font-semibold text-toss-gray-600 text-right truncate">{{ h.gu }}</span>
          <div class="flex-1">
            <div
              class="h-5 rounded-md bg-gradient-to-r from-toss-blue to-[#7C3AED] flex items-center justify-end pr-1.5"
              :style="{ width: Math.max((h.count / maxGu) * 100, 8) + '%' }"
            >
              <span class="text-[11px] font-extrabold text-white tabular-nums">{{ h.count }}</span>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- 배신왕 -->
    <section class="rounded-2xl bg-card card-shadow p-6">
      <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
        <DoorOpen class="size-4 text-[#F04452]" /> 배신왕 — 지역구엔 집이 없다
      </h2>
      <p class="mt-1 text-[12px] text-toss-gray-400">
        지역구 시·도엔 본인·배우자 소유 주택이 없고 다른 지역(주로 서울)에만 있는 의원 {{ data.betrayal.length }}명.
      </p>
      <ul class="mt-3 space-y-1.5">
        <li v-for="b in shown" :key="b.id">
          <NuxtLink :to="`/members/${b.id}`" class="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 -mx-2 hover:bg-toss-gray-50">
            <MemberAvatar :id="b.id" :name="b.name" :party="b.party" :size="32" />
            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">
                {{ b.name }} <span class="text-[11px] font-medium text-toss-gray-400">{{ normalizeParty(b.party) }}</span>
              </p>
              <p class="text-[11px] text-toss-gray-400 truncate">지역구 {{ b.origin }} → 🏠 {{ b.homes.join(", ") }}</p>
            </div>
          </NuxtLink>
        </li>
      </ul>
      <button
        v-if="hidden > 0"
        type="button"
        class="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-toss-gray-50 py-2 text-[13px] font-semibold text-toss-gray-500 hover:bg-toss-gray-100"
        @click="expanded = !expanded"
      >
        {{ expanded ? "접기" : `더보기 (${hidden}명)` }}
        <ChevronDown class="size-4 transition-transform" :class="expanded ? 'rotate-180' : ''" />
      </button>
    </section>
  </div>
</template>
