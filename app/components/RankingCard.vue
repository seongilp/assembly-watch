<script setup lang="ts">
import type { LucideIcon } from "lucide-vue-next";
import type { InsightMember } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = withDefaults(
  defineProps<{
    title: string;
    icon: LucideIcon;
    items: InsightMember[];
    metric?: "count" | "rate";
    unit?: string;
    accent?: string; // hex
    limit?: number;
  }>(),
  { metric: "count", unit: "", accent: "#3182F6", limit: 10 },
);

const list = computed(() => props.items.slice(0, props.limit));
const medal = (i: number) =>
  ["#FFB400", "#9AA3AE", "#CD7F32"][i] ?? "transparent";

function valueOf(m: InsightMember) {
  if (props.metric === "rate") return `${Math.round((m.rate ?? 0) * 100)}%`;
  return `${m.count ?? 0}${props.unit}`;
}
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-5">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-4">
      <span class="grid place-items-center size-7 rounded-lg" :style="{ backgroundColor: accent + '1A', color: accent }">
        <component :is="icon" class="size-4" />
      </span>
      {{ title }}
    </h2>
    <ol class="space-y-1">
      <li v-for="(m, i) in list" :key="m.id">
        <NuxtLink
          :to="`/members/${m.id}`"
          class="group flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-toss-gray-50 transition-colors"
        >
          <span
            class="w-5 text-center text-[13px] font-extrabold tabular-nums shrink-0"
            :style="{ color: i < 3 ? medal(i) : 'var(--toss-gray-400)' }"
          >{{ i + 1 }}</span>
          <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :photo="m.photo" :size="36" />
          <div class="min-w-0 flex-1">
            <p class="text-[14px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">{{ m.name }}</p>
            <p class="text-[12px] text-toss-gray-400 truncate">
              {{ normalizeParty(m.party) }}<template v-if="m.origin"> · {{ m.origin }}</template>
            </p>
          </div>
          <span class="text-[16px] font-extrabold tabular-nums shrink-0" :style="{ color: accent }">
            {{ valueOf(m) }}
          </span>
        </NuxtLink>
      </li>
    </ol>
  </section>
</template>
