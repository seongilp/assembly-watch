<script setup lang="ts">
import { partyColor } from "~/lib/party";
import { formatNumber } from "~/lib/format";

const props = defineProps<{ data: { party: string; count: number }[] }>();

const total = computed(() => props.data.reduce((s, d) => s + d.count, 0));
const sorted = computed(() => [...props.data].sort((a, b) => b.count - a.count));
</script>

<template>
  <div>
    <div class="flex h-3.5 w-full overflow-hidden rounded-full bg-toss-gray-100">
      <div
        v-for="d in sorted"
        :key="d.party"
        class="h-full first:rounded-l-full last:rounded-r-full transition-all"
        :style="{
          width: total ? (d.count / total) * 100 + '%' : '0%',
          backgroundColor: partyColor(d.party),
        }"
        :title="`${d.party} ${d.count}석`"
      />
    </div>

    <ul class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
      <li
        v-for="d in sorted"
        :key="d.party"
        class="flex items-center gap-2 min-w-0"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: partyColor(d.party) }"
        />
        <span class="text-[13px] text-toss-gray-600 truncate">{{ d.party }}</span>
        <span class="ml-auto text-[13px] font-bold text-toss-gray-900 tabular-nums">
          {{ formatNumber(d.count) }}
        </span>
      </li>
    </ul>
  </div>
</template>
