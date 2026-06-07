<script setup lang="ts">
import { normalizeParty } from "~/lib/party";

const props = withDefaults(
  defineProps<{ party: string; dot?: boolean; size?: "sm" | "md" }>(),
  { dot: true, size: "md" },
);
const partyColor = usePartyColor();
const name = computed(() => normalizeParty(props.party));
const color = computed(() => partyColor(props.party));
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap"
    :class="size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'"
    :style="{ color, backgroundColor: color + '14' }"
  >
    <span
      v-if="dot"
      class="rounded-full"
      :class="size === 'sm' ? 'size-1.5' : 'size-2'"
      :style="{ backgroundColor: color }"
    />
    {{ name }}
  </span>
</template>
