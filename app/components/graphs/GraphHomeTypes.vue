<script setup lang="ts">
import { Building2 } from "lucide-vue-next";
import type { WealthData } from "#shared/types";

const props = defineProps<{ data: WealthData }>();

const EMOJI: Record<string, string> = {
  아파트: "🏢", 단독주택: "🏡", 오피스텔: "🏬", "연립·다세대": "🏘️", 주상복합: "🏙️",
};
const total = computed(() => props.data.homeTypes.reduce((s, t) => s + t.count, 0));
const maxCount = computed(() => Math.max(...props.data.homeTypes.map((t) => t.count), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Building2 class="size-4 text-toss-blue" /> 아파트 공화국
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">
      본인·배우자 소유 주택 {{ total }}채의 유형 (전세·임차 제외).
      {{ data.homeTypes[0] ? Math.round((data.homeTypes[0].count / total) * 100) : 0 }}%가 아파트예요.
    </p>

    <ul class="mt-4 space-y-2.5">
      <li v-for="t in data.homeTypes" :key="t.type" class="flex items-center gap-3">
        <span class="w-28 shrink-0 text-[13px] font-semibold text-toss-gray-700 text-right">
          {{ EMOJI[t.type] ?? "🏠" }} {{ t.type }}
        </span>
        <div class="flex-1">
          <div
            class="h-6 rounded-md bg-gradient-to-r from-toss-blue to-[#00B5A5] flex items-center justify-end pr-2"
            :style="{ width: Math.max((t.count / maxCount) * 100, 9) + '%' }"
          >
            <span class="text-[11px] font-extrabold text-white tabular-nums">{{ t.count }}</span>
          </div>
        </div>
        <span class="w-10 shrink-0 text-[11px] tabular-nums text-toss-gray-400">{{ Math.round((t.count / total) * 100) }}%</span>
      </li>
    </ul>
  </section>
</template>
