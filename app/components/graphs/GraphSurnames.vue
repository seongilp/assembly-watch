<script setup lang="ts">
import { Users } from "lucide-vue-next";
import type { GraphData } from "#shared/types";

const props = defineProps<{ data: GraphData }>();
const maxCount = computed(() => Math.max(...props.data.surnames.map((s) => s.count), 1));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <Users class="size-4 text-toss-blue" /> 의원 성씨 TOP
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">국회에 가장 많은 성씨는? (전체 300명 기준)</p>

    <ul class="mt-4 space-y-2.5">
      <li v-for="s in data.surnames" :key="s.surname" class="flex items-center gap-3">
        <span class="w-8 shrink-0 text-center text-[15px] font-extrabold text-toss-gray-900">{{ s.surname }}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <div class="h-2 rounded-full bg-toss-blue/80" :style="{ width: (s.count / maxCount * 100) + '%' }" />
            <span class="text-[12px] font-extrabold tabular-nums text-toss-blue shrink-0">{{ s.count }}명</span>
          </div>
          <div class="flex flex-wrap gap-0.5">
            <NuxtLink
              v-for="m in s.members.slice(0, 10)"
              :key="m.id"
              :to="`/members/${m.id}`"
              :title="`${m.name} · ${m.party}`"
              class="hover:scale-110 transition-transform"
            >
              <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :size="22" />
            </NuxtLink>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
