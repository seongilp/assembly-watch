<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import type { GroupStats, GroupBadge } from "#shared/types";
import { partyColor, partyShort } from "~/lib/party";

const props = defineProps<{
  stats: GroupStats | null;
  badges?: GroupBadge[];
  accent?: string; // 막대/강조색 (기본 토스 블루)
}>();

// 극단값 뱃지 메타 (쏠림은 정당별로 따로 처리)
const BADGE_META: Record<string, { icon: string; text: string; color: string }> = {
  wealth: { icon: "💰", text: "재산 1위", color: "#F59E0B" },
  old: { icon: "👴", text: "최고령", color: "#A16207" },
  young: { icon: "👶", text: "최연소", color: "#3182F6" },
  women: { icon: "👩", text: "여풍 1위", color: "#EC4899" },
  propose: { icon: "📜", text: "발의왕", color: "#8B5CF6" },
  attend: { icon: "🙋", text: "출석왕", color: "#10B981" },
};
const pills = computed(() =>
  (props.badges ?? []).map((b) =>
    b.type === "skew"
      ? { key: "skew-" + b.party, icon: "", text: partyShort(b.party) + " 쏠림", color: partyColor(b.party) }
      : { key: b.type, ...BADGE_META[b.type] },
  ).filter((p) => p.text),
);

const open = ref(false);
const accent = computed(() => props.accent || "#3182F6");

// 정당 분포 100% 스택바 세그먼트 + 범례(상위 3)
const segments = computed(() =>
  (props.stats?.parties ?? []).map((p) => ({
    party: p.party,
    count: p.count,
    color: partyColor(p.party),
    pct: props.stats ? (p.count / props.stats.n) * 100 : 0,
  })),
);
const topParties = computed(() => segments.value.slice(0, 3));

// 펼침 패널 보조 지표 (있는 것만)
const extras = computed(() => {
  const s = props.stats;
  if (!s) return [];
  return [
    { icon: "🏠", label: "평균 평수", value: s.avgPyeong, unit: "평" },
    { icon: "📜", label: "평균 발의", value: s.avgPropose, unit: "건" },
    { icon: "🙋", label: "평균 참석", value: s.avgAttend, unit: "표" },
    { icon: "✅", label: "평균 찬성", value: s.avgYes, unit: "표" },
    { icon: "🚫", label: "평균 불참", value: s.avgAbsent, unit: "표" },
  ].filter((x) => x.value != null);
});

const fmt = (v: number | null | undefined) => (v == null ? "—" : v);
</script>

<template>
  <div v-if="stats" class="mt-2 pt-2 border-t border-toss-gray-200/70">
    <!-- 극단값/쏠림 뱃지 -->
    <div v-if="pills.length" class="mb-1.5 flex flex-wrap gap-1">
      <span
        v-for="p in pills"
        :key="p.key"
        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
        :style="{ color: p.color, background: p.color + '1f' }"
      >
        <span v-if="p.icon">{{ p.icon }}</span>{{ p.text }}
      </span>
    </div>

    <!-- 상시 노출: 핵심 3종 (재산·나이·여성) + 펼침 토글 -->
    <button
      type="button"
      class="w-full flex items-center justify-between gap-1 text-[11px] text-toss-gray-600"
      @click="open = !open"
    >
      <span class="flex items-center gap-1.5 tabular-nums">
        <span title="평균 재산">💰 {{ fmt(stats.avgWealth) }}<span class="text-toss-gray-400">억</span></span>
        <span class="text-toss-gray-300">·</span>
        <span title="평균 나이">🎂 {{ fmt(stats.avgAge) }}<span class="text-toss-gray-400">세</span></span>
        <span class="text-toss-gray-300">·</span>
        <span title="여성 비율">♀ {{ fmt(stats.womenPct) }}<span class="text-toss-gray-400">%</span></span>
      </span>
      <ChevronDown class="size-3.5 shrink-0 text-toss-gray-400 transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <!-- 펼침: 정당 분포 + 발의·참석·찬성·불참·평수 -->
    <div v-if="open" class="mt-2.5 space-y-2.5">
      <div>
        <div class="flex h-2 rounded-full overflow-hidden bg-toss-gray-200">
          <div
            v-for="seg in segments"
            :key="seg.party"
            :style="{ width: seg.pct + '%', background: seg.color }"
            :title="`${seg.party} ${seg.count}명`"
          />
        </div>
        <div class="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-toss-gray-500">
          <span v-for="p in topParties" :key="p.party" class="flex items-center gap-1">
            <span class="size-2 rounded-full" :style="{ background: p.color }" />
            <span class="font-semibold text-toss-gray-700">{{ partyShort(p.party) }}</span>
            <span class="tabular-nums">{{ p.count }}</span>
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1">
        <div v-for="e in extras" :key="e.label" class="flex items-center justify-between text-[11px]">
          <span class="text-toss-gray-500">{{ e.icon }} {{ e.label }}</span>
          <span class="font-bold tabular-nums" :style="{ color: accent }">{{ e.value }}<span class="text-toss-gray-400 font-normal">{{ e.unit }}</span></span>
        </div>
      </div>
    </div>
  </div>
</template>
