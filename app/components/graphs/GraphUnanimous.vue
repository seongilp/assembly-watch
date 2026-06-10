<script setup lang="ts">
import { CircleCheckBig } from "lucide-vue-next";

const props = defineProps<{ count: number; total: number }>();

const rate = computed(() => (props.total ? props.count / props.total : 0));
const R = 52;
const CIRC = 2 * Math.PI * R;
const dash = computed(() => `${(rate.value * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`);
const pct = computed(() => Math.round(rate.value * 100));
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
      <CircleCheckBig class="size-4 text-toss-blue" /> 만장일치 vs 표결 분열
    </h2>
    <p class="mt-1 text-[12px] text-toss-gray-400">최근 본회의 {{ total }}건 중 사실상 만장일치(반대·기권 0)로 통과된 비율.</p>

    <div class="mt-4 flex items-center gap-6">
      <svg viewBox="0 0 140 140" class="size-32 shrink-0 -rotate-90">
        <circle cx="70" cy="70" :r="R" fill="none" stroke="#E5E8EB" stroke-width="16" />
        <circle
          cx="70" cy="70" :r="R" fill="none" stroke="#3182F6" stroke-width="16"
          stroke-linecap="round" :stroke-dasharray="dash"
        />
        <text x="70" y="70" transform="rotate(90 70 70)" text-anchor="middle" dominant-baseline="central" class="fill-toss-gray-900" style="font-size:30px;font-weight:800">{{ pct }}%</text>
      </svg>
      <div class="space-y-2.5">
        <div class="flex items-center gap-2">
          <span class="size-3 rounded-full bg-[#3182F6]" />
          <span class="text-[13px] text-toss-gray-700">만장일치 통과 <b class="text-toss-gray-900">{{ count }}건</b></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="size-3 rounded-full bg-toss-gray-200" />
          <span class="text-[13px] text-toss-gray-700">표결이 갈린 안건 <b class="text-toss-gray-900">{{ total - count }}건</b></span>
        </div>
        <p class="text-[11px] text-toss-gray-400 max-w-[200px]">국회 표결 대부분은 여야 합의로 통과되고, 일부 쟁점 법안에서만 표가 갈립니다.</p>
      </div>
    </div>
  </section>
</template>
