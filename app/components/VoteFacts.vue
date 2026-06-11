<script setup lang="ts">
import { Telescope } from "lucide-vue-next";
import type { VoteFact } from "#shared/types";

defineProps<{ facts: VoteFact[] }>();
</script>

<template>
  <section v-if="facts.length" class="rounded-2xl bg-card card-shadow p-6 sm:p-7 mb-4">
    <div class="flex items-center gap-2 mb-1">
      <Telescope class="size-[18px] text-toss-blue" />
      <h2 class="text-[16px] font-extrabold text-toss-gray-900">이 표결의 발견</h2>
    </div>
    <p class="text-[12px] text-toss-gray-400 mb-5">
      찬성·반대·기권·불참 의원들의 집단 특성 — 재미로 보는 통계적 관찰이며 인과관계가 아닙니다.
    </p>
    <div class="space-y-5">
      <VoteFactBody v-for="(f, i) in facts" :key="f.dim + i" :fact="f" />
    </div>
  </section>
</template>
