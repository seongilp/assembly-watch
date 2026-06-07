<script setup lang="ts">
import { formatNumber } from "~/lib/format";

const props = defineProps<{
  yes: number | null;
  no: number | null;
  blank: number | null;
  compact?: boolean;
}>();

const segments = computed(() => [
  { label: "찬성", value: props.yes ?? 0, color: "#3182F6" },
  { label: "반대", value: props.no ?? 0, color: "#F04452" },
  { label: "기권", value: props.blank ?? 0, color: "#FF9500" },
]);
const total = computed(() => segments.value.reduce((s, x) => s + x.value, 0));
</script>

<template>
  <div v-if="total > 0">
    <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-toss-gray-100">
      <div
        v-for="s in segments"
        :key="s.label"
        class="h-full"
        :style="{ width: (s.value / total) * 100 + '%', backgroundColor: s.color }"
      />
    </div>
    <div class="mt-2 flex items-center gap-4" :class="compact ? 'text-[11px]' : 'text-[12px]'">
      <span
        v-for="s in segments"
        :key="s.label"
        class="inline-flex items-center gap-1.5 font-semibold text-toss-gray-600"
      >
        <span class="size-2 rounded-full" :style="{ backgroundColor: s.color }" />
        {{ s.label }}
        <b class="text-toss-gray-900 tabular-nums">{{ formatNumber(s.value) }}</b>
      </span>
    </div>
  </div>
  <p v-else class="text-[12px] text-toss-gray-400">표결 집계 없음</p>
</template>
