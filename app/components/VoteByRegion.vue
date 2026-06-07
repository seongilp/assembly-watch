<script setup lang="ts">
import type { VoteRecord } from "#shared/types";
import { regionOf, REGION_TILE, regionRank } from "~/lib/region";
import { normalizeParty, partyColor } from "~/lib/party";
import { voteStyle } from "~/lib/format";

const props = defineProps<{ records: VoteRecord[] }>();

interface RegionStat {
  region: string;
  total: number;
  yes: number;
  no: number;
  blank: number;
  absent: number;
  rate: number; // 찬성률 (투표 참여 대비)
  members: VoteRecord[];
}

const stats = computed<Record<string, RegionStat>>(() => {
  const map: Record<string, RegionStat> = {};
  for (const r of props.records) {
    const reg = regionOf(r.origin);
    if (!map[reg])
      map[reg] = {
        region: reg,
        total: 0,
        yes: 0,
        no: 0,
        blank: 0,
        absent: 0,
        rate: 0,
        members: [],
      };
    const s = map[reg];
    s.total++;
    s.members.push(r);
    if (r.result.includes("찬성")) s.yes++;
    else if (r.result.includes("반대")) s.no++;
    else if (r.result.includes("기권")) s.blank++;
    else s.absent++;
  }
  for (const s of Object.values(map)) {
    const voted = s.yes + s.no + s.blank;
    s.rate = voted ? s.yes / voted : 0;
  }
  return map;
});

const tiles = computed(() =>
  Object.values(stats.value).sort(
    (a, b) => regionRank(a.region) - regionRank(b.region),
  ),
);

const selected = ref<string | null>(null);
const selectedStat = computed(() =>
  selected.value ? stats.value[selected.value] : null,
);

function tileStyle(s: RegionStat) {
  const pos = REGION_TILE[s.region];
  const alpha = 0.16 + 0.84 * s.rate; // 찬성률 높을수록 진한 블루
  return {
    gridRow: pos ? String(pos.r) : "auto",
    gridColumn: pos ? String(pos.c) : "auto",
    backgroundColor: `rgba(49, 130, 246, ${alpha.toFixed(3)})`,
    color: alpha > 0.55 ? "#fff" : "var(--toss-gray-800)",
  };
}
</script>

<template>
  <div>
    <!-- 범례 -->
    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <p class="text-[13px] text-toss-gray-500">
        시도별 찬성률 — 진할수록 찬성 비율이 높습니다. 타일을 누르면 해당 지역 의원을 봅니다.
      </p>
      <div class="flex items-center gap-1.5 text-[11px] text-toss-gray-400">
        <span>낮음</span>
        <span class="h-2.5 w-24 rounded-full" style="background: linear-gradient(90deg, rgba(49,130,246,0.16), rgba(49,130,246,1))" />
        <span>높음</span>
      </div>
    </div>

    <!-- 타일 카토그램 -->
    <div
      class="grid gap-1.5 sm:gap-2"
      style="grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: 1fr"
    >
      <button
        v-for="s in tiles"
        :key="s.region"
        class="aspect-square rounded-xl p-1.5 flex flex-col items-center justify-center transition-all hover:scale-[1.05] hover:ring-2 hover:ring-toss-blue/40"
        :class="selected === s.region ? 'ring-2 ring-toss-blue' : ''"
        :style="tileStyle(s)"
        @click="selected = selected === s.region ? null : s.region"
      >
        <span class="text-[12px] sm:text-[13px] font-extrabold leading-none">{{ s.region }}</span>
        <span class="mt-1 text-[10px] sm:text-[11px] font-bold opacity-90 tabular-nums"
          >{{ Math.round(s.rate * 100) }}%</span
        >
        <span class="text-[9px] sm:text-[10px] opacity-75">{{ s.total }}명</span>
      </button>
    </div>

    <!-- 선택 지역 상세 -->
    <div class="mt-5">
      <div v-if="!selectedStat" class="text-center text-[13px] text-toss-gray-400 py-6">
        지역 타일을 선택하면 해당 지역구 의원들의 표결을 볼 수 있습니다.
      </div>
      <div v-else class="rounded-2xl bg-card card-shadow p-5">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="text-[16px] font-bold text-toss-gray-900">
            {{ selectedStat.region }}
            <span class="text-[13px] font-medium text-toss-gray-400">{{ selectedStat.total }}명</span>
          </h3>
          <div class="flex items-center gap-3 text-[12px] font-bold">
            <span style="color:#3182F6">찬성 {{ selectedStat.yes }}</span>
            <span style="color:#F04452">반대 {{ selectedStat.no }}</span>
            <span style="color:#FF9500">기권 {{ selectedStat.blank }}</span>
            <span style="color:#B0B8C1">불참 {{ selectedStat.absent }}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="(m, i) in selectedStat.members"
            :key="m.name + i"
            class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold"
            :style="{ color: voteStyle(m.result).fg, backgroundColor: voteStyle(m.result).bg }"
          >
            <span class="size-1.5 rounded-full" :style="{ backgroundColor: partyColor(m.party) }" />
            {{ m.name }}
            <span class="text-[10px] opacity-70">{{ normalizeParty(m.party) }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
