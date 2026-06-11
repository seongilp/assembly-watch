<script setup lang="ts">
import type { VoteRecord } from "#shared/types";
import { normalizeParty } from "~/lib/party";
import { voteStyle, resultFill } from "~/lib/format";
import { groupLabelOf, groupRank, GROUP_UNKNOWN, type GroupDim } from "~/lib/member-group";

const props = defineProps<{ records: VoteRecord[]; dim: GroupDim }>();
const partyColor = usePartyColor();

const RESULT_ORDER = ["찬성", "반대", "기권", "불참"] as const;
function resultKey(r: string): (typeof RESULT_ORDER)[number] {
  if (r.includes("찬성")) return "찬성";
  if (r.includes("반대")) return "반대";
  if (r.includes("기권")) return "기권";
  return "불참";
}

interface GroupStat {
  label: string;
  total: number;
  yes: number;
  no: number;
  blank: number;
  absent: number;
  members: VoteRecord[];
}

const NOW_YEAR = new Date().getFullYear();

const groups = computed<GroupStat[]>(() => {
  const map: Record<string, GroupStat> = {};
  for (const r of props.records) {
    const label = groupLabelOf(r, props.dim, NOW_YEAR);
    const s = (map[label] ??= { label, total: 0, yes: 0, no: 0, blank: 0, absent: 0, members: [] });
    s.total++;
    s.members.push(r);
    const k = resultKey(r.result);
    if (k === "찬성") s.yes++;
    else if (k === "반대") s.no++;
    else if (k === "기권") s.blank++;
    else s.absent++;
  }
  for (const s of Object.values(map)) {
    // 와플이 색깔별로 모이도록 결과순 정렬
    s.members.sort(
      (a, b) => RESULT_ORDER.indexOf(resultKey(a.result)) - RESULT_ORDER.indexOf(resultKey(b.result)),
    );
  }
  return Object.values(map).sort((a, b) => {
    const ra = groupRank(a.label, props.dim);
    const rb = groupRank(b.label, props.dim);
    if (ra !== rb) return ra - rb;
    return b.total - a.total; // 성씨/거주지: 인원수 내림차순
  });
});

// 성씨처럼 그룹이 많은 차원은 소그룹을 "기타"로 묶지 않고 그대로 두되, 1명짜리가 많으면 접기
const MANY_DIMS: GroupDim[] = ["surname", "home"];
const expanded = ref(false);
const visibleGroups = computed(() => {
  if (!MANY_DIMS.includes(props.dim) || expanded.value) return groups.value;
  const major = groups.value.filter((g) => g.total >= 3 || g.label === GROUP_UNKNOWN);
  return major.length ? major : groups.value;
});
const hiddenCount = computed(() => groups.value.length - visibleGroups.value.length);

const selected = ref<string | null>(null);
const selectedStat = computed(() => groups.value.find((g) => g.label === selected.value) ?? null);

watch(
  () => props.dim,
  () => {
    selected.value = null;
    expanded.value = false;
  },
);
</script>

<template>
  <div>
    <!-- 범례 -->
    <div class="flex items-center justify-end gap-3 mb-3 text-[12px] font-semibold">
      <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#3182F6" />찬성</span>
      <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#F04452" />반대</span>
      <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#FF9500" />기권</span>
      <span class="inline-flex items-center gap-1 text-toss-gray-600"><span class="size-2.5 rounded-sm" style="background:#B0B8C1" />불참</span>
    </div>

    <!-- 와플 타일: 의원 1명 = 네모 1개, 결과별 색 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <button
        v-for="s in visibleGroups"
        :key="s.label"
        class="text-left rounded-2xl bg-card card-shadow p-4 transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
        :class="selected === s.label ? 'ring-2 ring-toss-blue' : ''"
        @click="selected = selected === s.label ? null : s.label"
      >
        <div class="flex items-baseline justify-between mb-2">
          <span class="text-[15px] font-bold text-toss-gray-900">{{ s.label }}</span>
          <span class="text-[12px] text-toss-gray-400">{{ s.total }}명</span>
        </div>
        <div class="flex flex-wrap gap-[3px] mb-2.5">
          <span
            v-for="(m, i) in s.members"
            :key="i"
            class="size-[11px] rounded-[3px]"
            :style="{ backgroundColor: resultFill(m.result) }"
            :title="`${m.name} · ${m.result}`"
          />
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-bold">
          <span v-if="s.yes" style="color:#3182F6">찬 {{ s.yes }}</span>
          <span v-if="s.no" style="color:#F04452">반 {{ s.no }}</span>
          <span v-if="s.blank" style="color:#FF9500">기권 {{ s.blank }}</span>
          <span v-if="s.absent" style="color:#8B95A1">불참 {{ s.absent }}</span>
        </div>
      </button>
    </div>

    <button
      v-if="hiddenCount > 0"
      class="mt-3 w-full rounded-xl bg-toss-gray-100 py-2.5 text-[13px] font-bold text-toss-gray-600 hover:bg-toss-gray-200 transition-colors"
      @click="expanded = true"
    >
      소수 그룹 {{ hiddenCount }}개 더 보기
    </button>

    <!-- 선택 그룹 상세 -->
    <div class="mt-5">
      <div v-if="!selectedStat" class="text-center text-[13px] text-toss-gray-400 py-6">
        카드를 선택하면 해당 그룹 의원들의 표결을 볼 수 있습니다.
      </div>
      <div v-else class="rounded-2xl bg-card card-shadow p-5">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="text-[16px] font-bold text-toss-gray-900">
            {{ selectedStat.label }}
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
        <p v-if="dim === 'home'" class="mt-3 text-[11px] text-toss-gray-400">
          ※ 거주지는 재산 신고 주택 소재지 기준(여러 채면 첫 신고 구). 신고 내역 없는 의원은 "정보 없음".
        </p>
      </div>
    </div>
  </div>
</template>
