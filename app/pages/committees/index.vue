<script setup lang="ts">
import { Landmark, Users } from "lucide-vue-next";
import type { Committee } from "#shared/types";

const { data, pending, error } = await useFetch<{
  rows: Committee[];
  totalCount: number;
}>("/api/committees");

// 주요 위원회 구분만 추려 그룹핑 (위원 정원이 있는 실제 위원회 우선)
const groups = computed(() => {
  const map = new Map<string, Committee[]>();
  for (const c of data.value?.rows ?? []) {
    if (!c.name) continue;
    const key = c.div || "기타";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  const order = ["상임위원회", "특별위원회", "상설특별위원회"];
  return [...map.entries()].sort(
    (a, b) =>
      (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99),
  );
});

useHead({ title: "위원회 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader
      eyebrow="제22대 국회"
      title="위원회"
      subtitle="상임·특별위원회 구성 현황"
    />

    <DataState :pending="pending" :error="error" :empty="!data?.rows?.length" :skeleton-rows="6">
      <div v-for="[div, list] in groups" :key="div" class="mb-8">
        <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-3">
          <Landmark class="size-4 text-toss-blue" />
          {{ div }}
          <span class="text-[12px] font-semibold text-toss-gray-400">{{ list.length }}</span>
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <div
            v-for="(c, i) in list"
            :key="c.name + i"
            class="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 card-shadow"
          >
            <div class="min-w-0">
              <p class="text-[15px] font-bold text-toss-gray-900 truncate">{{ c.name }}</p>
              <p v-if="c.limit" class="mt-0.5 inline-flex items-center gap-1 text-[12px] text-toss-gray-500">
                <Users class="size-3.5" /> 정원 {{ c.limit }}명
              </p>
            </div>
            <div
              v-if="c.limit"
              class="grid place-items-center size-11 shrink-0 rounded-xl bg-toss-blue-light text-toss-blue-dark font-extrabold text-[16px] tabular-nums"
            >
              {{ c.limit }}
            </div>
          </div>
        </div>
      </div>
    </DataState>
  </div>
</template>
