<script setup lang="ts">
import { CalendarDays, MapPin, Clock } from "lucide-vue-next";
import type { ScheduleItem } from "#shared/types";
import { formatDate, relativeDay } from "~/lib/format";

const upcoming = ref(true);

const { data, pending, error } = await useFetch<{ rows: ScheduleItem[] }>(
  "/api/schedule",
  { query: { upcoming: computed(() => (upcoming.value ? 1 : 0)), size: 200 } },
);

const grouped = computed(() => {
  const map = new Map<string, ScheduleItem[]>();
  for (const s of data.value?.rows ?? []) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return [...map.entries()];
});

const kindColor = (kind: string) => {
  if (kind.includes("본회의")) return "#3182F6";
  if (kind.includes("위원회")) return "#7C3AED";
  if (kind.includes("행사")) return "#00C896";
  return "#8B95A1";
};

useHead({ title: "국회 일정 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회"
      title="국회 일정"
      subtitle="본회의·위원회·국회 행사 일정"
    />

    <div class="inline-flex rounded-2xl bg-toss-gray-100 p-1 mb-5">
      <button
        class="rounded-xl px-5 py-2 text-[14px] font-bold transition-all"
        :class="upcoming ? 'bg-white text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
        @click="upcoming = true"
      >
        예정
      </button>
      <button
        class="rounded-xl px-5 py-2 text-[14px] font-bold transition-all"
        :class="!upcoming ? 'bg-white text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
        @click="upcoming = false"
      >
        전체
      </button>
    </div>

    <DataState
      :pending="pending"
      :error="error"
      :empty="!data?.rows?.length"
      empty-text="일정이 없습니다."
      :skeleton-rows="6"
    >
      <div class="relative space-y-7">
        <div v-for="[date, items] in grouped" :key="date">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="grid place-items-center size-10 rounded-xl bg-toss-blue text-white shrink-0">
              <CalendarDays class="size-5" />
            </div>
            <div>
              <p class="text-[15px] font-extrabold text-toss-gray-900">{{ formatDate(date) }}</p>
              <p class="text-[12px] font-semibold text-toss-blue">{{ relativeDay(date) }}</p>
            </div>
          </div>

          <ul class="space-y-2 pl-1">
            <li
              v-for="(s, i) in items"
              :key="i"
              class="flex gap-3 rounded-2xl bg-white p-4 card-shadow"
            >
              <span
                class="mt-1 h-full w-1 shrink-0 rounded-full"
                :style="{ backgroundColor: kindColor(s.kind) }"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="text-[11px] font-bold rounded-md px-1.5 py-0.5"
                    :style="{ color: kindColor(s.kind), backgroundColor: kindColor(s.kind) + '14' }"
                    >{{ s.kind }}</span
                  >
                  <span v-if="s.committee" class="text-[12px] text-toss-gray-400">{{ s.committee }}</span>
                </div>
                <p class="text-[14px] font-semibold text-toss-gray-800">{{ s.content }}</p>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-toss-gray-400">
                  <span v-if="s.time" class="inline-flex items-center gap-1">
                    <Clock class="size-3" />{{ s.time }}
                  </span>
                  <span v-if="s.place" class="inline-flex items-center gap-1">
                    <MapPin class="size-3" />{{ s.place }}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </DataState>
  </div>
</template>
