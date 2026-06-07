<script setup lang="ts">
import type { LucideIcon } from "lucide-vue-next";
import { formatNumber } from "~/lib/format";

const props = withDefaults(
  defineProps<{
    label: string;
    value: number | string | null;
    icon: LucideIcon;
    suffix?: string;
    accent?: "blue" | "green" | "amber" | "red" | "violet";
    to?: string;
    loading?: boolean;
  }>(),
  { accent: "blue" },
);

// 단일 hex 로 통일 — 라이트/다크 모두 일관 (accent 색 반투명 배경 + accent 색 아이콘)
const ACCENT: Record<string, string> = {
  blue: "#3182F6",
  green: "#00C896",
  amber: "#FF9500",
  red: "#F04452",
  violet: "#7C3AED",
};
const accentColor = computed(() => ACCENT[props.accent] ?? ACCENT.blue);

const display = computed(() =>
  typeof props.value === "number" ? formatNumber(props.value) : props.value,
);
const NuxtLink = resolveComponent("NuxtLink");
const tag = computed(() => (props.to ? NuxtLink : "div"));
</script>

<template>
  <component
    :is="tag"
    :to="to"
    class="group block rounded-2xl bg-card p-5 card-shadow transition-all duration-200"
    :class="to ? 'hover:-translate-y-0.5 hover:card-shadow-hover cursor-pointer' : ''"
  >
    <div class="flex items-start justify-between">
      <span class="text-[13px] font-semibold text-toss-gray-500">{{ label }}</span>
      <div
        class="grid place-items-center size-9 rounded-xl bg-toss-gray-100 text-toss-gray-500"
      >
        <component :is="icon" class="size-[18px]" />
      </div>
    </div>
    <div class="mt-3 flex items-baseline gap-1">
      <Skeleton v-if="loading" class="h-8 w-20 rounded-md" />
      <template v-else>
        <span class="text-[28px] font-extrabold text-toss-gray-900 tabular-nums">
          {{ display ?? "—" }}
        </span>
        <span v-if="suffix" class="text-[14px] font-semibold text-toss-gray-400">{{
          suffix
        }}</span>
      </template>
    </div>
  </component>
</template>
