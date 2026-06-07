<script setup lang="ts">
import type { VoteRecord } from "#shared/types";
import { regionOf, regionRank } from "~/lib/region";
import { normalizeParty, partyColor } from "~/lib/party";
import { voteStyle, resultFill } from "~/lib/format";

const props = defineProps<{ records: VoteRecord[] }>();

const RESULT_ORDER = ["찬성", "반대", "기권", "불참"] as const;

interface RegionStat {
  region: string;
  total: number;
  yes: number;
  no: number;
  blank: number;
  absent: number;
  rate: number;
  members: VoteRecord[]; // 결과순 정렬됨
}

function resultKey(r: string): (typeof RESULT_ORDER)[number] {
  if (r.includes("찬성")) return "찬성";
  if (r.includes("반대")) return "반대";
  if (r.includes("기권")) return "기권";
  return "불참";
}

const stats = computed<Record<string, RegionStat>>(() => {
  const map: Record<string, RegionStat> = {};
  for (const r of props.records) {
    const reg = regionOf(r.origin);
    if (!map[reg])
      map[reg] = { region: reg, total: 0, yes: 0, no: 0, blank: 0, absent: 0, rate: 0, members: [] };
    const s = map[reg];
    s.total++;
    s.members.push(r);
    const k = resultKey(r.result);
    if (k === "찬성") s.yes++;
    else if (k === "반대") s.no++;
    else if (k === "기권") s.blank++;
    else s.absent++;
  }
  for (const s of Object.values(map)) {
    const voted = s.yes + s.no + s.blank;
    s.rate = voted ? s.yes / voted : 0;
    // 와플이 색깔별로 모이도록 결과순 정렬
    s.members.sort(
      (a, b) =>
        RESULT_ORDER.indexOf(resultKey(a.result)) -
        RESULT_ORDER.indexOf(resultKey(b.result)),
    );
  }
  return map;
});

const regions = computed(() =>
  Object.values(stats.value).sort(
    (a, b) => regionRank(a.region) - regionRank(b.region),
  ),
);

const mode = ref<"map" | "tile">("map");
const selected = ref<string | null>(null);
const selectedStat = computed(() =>
  selected.value ? stats.value[selected.value] : null,
);

// Kakao 지도 오버레이용 (중심좌표 있는 시도만, 찬/반/기권/불참 포함)
const mapRegions = computed(() =>
  regions.value
    .filter((s) => s.region !== "비례" && s.region !== "기타")
    .map((s) => ({
      region: s.region,
      total: s.total,
      yes: s.yes,
      no: s.no,
      blank: s.blank,
      absent: s.absent,
    })),
);
</script>

<template>
  <div>
    <!-- 지도/타일 토글 + 범례 -->
    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div class="inline-flex rounded-xl bg-toss-gray-100 p-0.5">
        <button
          v-for="m in (['map', 'tile'] as const)"
          :key="m"
          class="rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all"
          :class="mode === m ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
          @click="mode = m"
        >
          {{ m === "map" ? "지도" : "타일" }}
        </button>
      </div>
      <div class="flex items-center gap-3 text-[12px] font-semibold">
        <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#3182F6" />찬성</span>
        <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#F04452" />반대</span>
        <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#FF9500" />기권</span>
        <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#B0B8C1" />불참</span>
      </div>
    </div>

    <!-- Kakao 지도 오버레이 -->
    <ClientOnly v-if="mode === 'map'">
      <KakaoVoteMap
        :regions="mapRegions"
        :selected="selected"
        @select="(r) => (selected = selected === r ? null : r)"
        @error="mode = 'tile'"
      />
      <template #fallback>
        <div class="h-[460px] grid place-items-center rounded-2xl bg-toss-gray-100 text-[13px] text-toss-gray-400">
          지도 준비 중…
        </div>
      </template>
    </ClientOnly>

    <!-- 와플 타일: 의원 1명 = 네모 1개, 결과별 색 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <button
        v-for="s in regions"
        :key="s.region"
        class="text-left rounded-2xl bg-card card-shadow p-4 transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
        :class="selected === s.region ? 'ring-2 ring-toss-blue' : ''"
        @click="selected = selected === s.region ? null : s.region"
      >
        <div class="flex items-baseline justify-between mb-2">
          <span class="text-[15px] font-bold text-toss-gray-900">{{ s.region }}</span>
          <span class="text-[12px] text-toss-gray-400">{{ s.total }}명</span>
        </div>
        <!-- 와플 -->
        <div class="flex flex-wrap gap-[3px] mb-2.5">
          <span
            v-for="(m, i) in s.members"
            :key="i"
            class="size-[11px] rounded-[3px]"
            :style="{ backgroundColor: resultFill(m.result) }"
            :title="`${m.name} · ${m.result}`"
          />
        </div>
        <!-- 카운트 -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-bold">
          <span v-if="s.yes" style="color:#3182F6">찬 {{ s.yes }}</span>
          <span v-if="s.no" style="color:#F04452">반 {{ s.no }}</span>
          <span v-if="s.blank" style="color:#FF9500">기권 {{ s.blank }}</span>
          <span v-if="s.absent" style="color:#8B95A1">불참 {{ s.absent }}</span>
        </div>
      </button>
    </div>

    <!-- 선택 지역 상세 -->
    <div class="mt-5">
      <div v-if="!selectedStat" class="text-center text-[13px] text-toss-gray-400 py-6">
        {{ mode === "map" ? "지도 버블" : "지역 카드" }}을 선택하면 해당 지역구 의원들의 표결을 볼 수 있습니다.
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
            <span style="color:#8B95A1">불참 {{ selectedStat.absent }}</span>
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
