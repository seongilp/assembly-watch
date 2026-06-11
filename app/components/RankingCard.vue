<script setup lang="ts">
import { Crown, type LucideIcon } from "lucide-vue-next";
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
    crown?: string; // 1위 칭호 (예: "불참왕")
  }>(),
  { metric: "count", unit: "", accent: "#3182F6", limit: 10, crown: "" },
);

// 공동 순위(competition ranking): 동일 수치면 같은 순위, 다음 순위는 인원수만큼 건너뜀 (1,1,1,4…)
const list = computed(() => {
  let rank = 0;
  let prev: number | undefined;
  return props.items.slice(0, props.limit).map((m, i) => {
    const v = props.metric === "rate" ? (m.rate ?? 0) : (m.count ?? 0);
    if (prev === undefined || v !== prev) {
      rank = i + 1;
      prev = v;
    }
    return { m, rank };
  });
});
const medal = (rank: number) =>
  ["#FFB400", "#9AA3AE", "#CD7F32"][rank - 1] ?? "transparent";

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
      <li v-for="{ m, rank } in list" :key="m.id">
        <NuxtLink
          :to="`/members/${m.id}`"
          class="group flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-toss-gray-50 transition-colors"
        >
          <span
            class="w-5 text-center text-[13px] font-extrabold tabular-nums shrink-0"
            :style="{ color: rank <= 3 ? medal(rank) : 'var(--toss-gray-400)' }"
          >{{ rank }}</span>
          <div class="relative shrink-0">
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :photo="m.photo" :size="36" />
            <Crown
              v-if="crown && rank === 1"
              class="absolute -top-2 -right-1.5 size-4 rotate-12 fill-[#FFB400] text-[#FFB400] drop-shadow"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-1.5 text-[14px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">
              {{ m.name }}
              <span v-if="crown && rank === 1" class="shrink-0 rounded-full bg-[#FFB400]/15 px-1.5 py-0.5 text-[10px] font-extrabold text-[#C98A00]">👑 {{ crown }}</span>
            </p>
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
