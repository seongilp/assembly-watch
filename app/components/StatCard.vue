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

const accentMap = {
  blue: { bg: "bg-toss-blue-light", fg: "text-toss-blue" },
  green: { bg: "bg-[#E3F7F2]", fg: "text-toss-green" },
  amber: { bg: "bg-[#FFF4E0]", fg: "text-toss-amber" },
  red: { bg: "bg-[#FDECEE]", fg: "text-toss-red" },
  violet: { bg: "bg-[#F3ECFE]", fg: "text-[#7C3AED]" },
} as const;

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
        class="grid place-items-center size-9 rounded-xl"
        :class="accentMap[accent].bg"
      >
        <component :is="icon" class="size-[18px]" :class="accentMap[accent].fg" />
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
