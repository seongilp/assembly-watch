<script setup lang="ts">
import { voteStyle, procStyle } from "~/lib/format";

const props = withDefaults(
  defineProps<{ text: string; type?: "vote" | "proc"; size?: "sm" | "md" }>(),
  { type: "proc", size: "md" },
);
const style = computed(() =>
  props.type === "vote" ? voteStyle(props.text) : procStyle(props.text),
);
</script>

<template>
  <span
    v-if="text"
    class="inline-flex items-center rounded-lg font-bold whitespace-nowrap"
    :class="size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'"
    :style="{ color: style.fg, backgroundColor: style.bg }"
  >
    {{ text }}
  </span>
  <span v-else class="text-[12px] text-toss-gray-400">—</span>
</template>
