<script setup lang="ts">
import { Heart, Swords, Shuffle } from "lucide-vue-next";
import type { GraphData, GraphPair } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ data: GraphData }>();

const tabs = [
  { key: "best", label: "정치적 단짝", icon: Heart, accent: "#3182F6", desc: "표결이 가장 똑같은 콤비" },
  { key: "cross", label: "의외의 케미", icon: Shuffle, accent: "#7C3AED", desc: "다른 당인데 표결이 닮은" },
  { key: "worst", label: "앙숙", icon: Swords, accent: "#F04452", desc: "표결이 가장 엇갈린 사이" },
] as const;
const tab = ref<(typeof tabs)[number]["key"]>("best");

const list = computed<GraphPair[]>(() =>
  tab.value === "best" ? props.data.bestPairs : tab.value === "worst" ? props.data.worstPairs : props.data.crossBest,
);
const accent = computed(() => tabs.find((t) => t.key === tab.value)!.accent);
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Heart class="size-4 text-toss-blue" /> 정치적 단짝과 앙숙
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      본회의 표결 일치율(공통 표결 30회 이상) 기준.
    </p>

    <div class="mt-4 flex gap-1.5">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
        :class="tab === t.key ? 'text-white' : 'text-toss-gray-500 bg-toss-gray-50 hover:bg-toss-gray-100'"
        :style="tab === t.key ? { background: t.accent } : {}"
        @click="tab = t.key"
      >
        <component :is="t.icon" class="size-3.5" /> {{ t.label }}
      </button>
    </div>
    <p class="mt-2 text-[12px] text-toss-gray-400">{{ tabs.find((t) => t.key === tab)!.desc }}</p>

    <ul class="mt-3 space-y-2">
      <li
        v-for="(p, i) in list"
        :key="p.a.id + p.b.id"
        class="flex items-center gap-3 rounded-xl bg-toss-gray-50 px-3 py-2.5"
      >
        <span class="text-[12px] font-extrabold tabular-nums w-4 shrink-0" :style="{ color: accent }">{{ i + 1 }}</span>
        <NuxtLink :to="`/members/${p.a.id}`" class="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80">
          <MemberAvatar :id="p.a.id" :name="p.a.name" :party="p.a.party" :size="34" />
          <div class="min-w-0">
            <p class="text-[13px] font-bold text-toss-gray-900 truncate">{{ p.a.name }}</p>
            <p class="text-[11px] text-toss-gray-400 truncate">{{ normalizeParty(p.a.party) }}</p>
          </div>
        </NuxtLink>
        <div class="flex flex-col items-center shrink-0 px-1">
          <span class="text-[15px] font-extrabold tabular-nums leading-none" :style="{ color: accent }">{{ p.rate }}%</span>
          <span class="text-[10px] text-toss-gray-400 mt-0.5">공통 {{ p.common }}</span>
        </div>
        <NuxtLink :to="`/members/${p.b.id}`" class="flex items-center gap-2 min-w-0 flex-1 justify-end text-right hover:opacity-80">
          <div class="min-w-0">
            <p class="text-[13px] font-bold text-toss-gray-900 truncate">{{ p.b.name }}</p>
            <p class="text-[11px] text-toss-gray-400 truncate">{{ normalizeParty(p.b.party) }}</p>
          </div>
          <MemberAvatar :id="p.b.id" :name="p.b.name" :party="p.b.party" :size="34" />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
