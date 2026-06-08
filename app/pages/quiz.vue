<script setup lang="ts">
import { ThumbsUp, ThumbsDown, MinusCircle, RotateCcw } from "lucide-vue-next";
import type { VoteData, VoteInsights } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const { data: vd } = await useFetch<VoteData>("/api/votedata", { key: "votedata" });
const { data: vi } = await useFetch<VoteInsights>("/api/vote-insights", { key: "vote-insights" });

// 퀴즈 안건 (논쟁적 10개) + bills index 매핑
const billIndex = computed(() => new Map((vd.value?.bills ?? []).map((b, i) => [b.id, i])));
const quizBills = computed(() =>
  (vi.value?.quiz ?? [])
    .map((q) => ({ ...q, idx: billIndex.value.get(q.id) ?? -1 }))
    .filter((q) => q.idx >= 0),
);

// 사용자 답: idx -> 'Y'|'N'|'B'
const answers = ref<Record<number, string>>({});
const step = ref(0);
const done = computed(() => quizBills.value.length > 0 && step.value >= quizBills.value.length);

function answer(c: string) {
  const q = quizBills.value[step.value];
  if (!q) return;
  answers.value = { ...answers.value, [q.idx]: c };
  step.value++;
}
function reset() {
  answers.value = {};
  step.value = 0;
}

const VOTE = new Set(["Y", "N", "B"]);
const result = computed(() => {
  if (!done.value || !vd.value) return null;
  const ans = answers.value;
  const idxs = Object.keys(ans).map(Number);
  const scored = vd.value.members
    .map((m) => {
      const row = vd.value!.matrix[m.id];
      if (!row) return null;
      let agree = 0, common = 0;
      for (const i of idxs) {
        const c = row[i];
        if (VOTE.has(c)) {
          common++;
          if (c === ans[i]) agree++;
        }
      }
      return common >= 3 ? { m, rate: agree / common, common } : null;
    })
    .filter(Boolean) as { m: any; rate: number; common: number }[];
  scored.sort((a, b) => b.rate - a.rate);
  return { top: scored.slice(0, 5) };
});

useHead({ title: "나와 비슷한 의원 테스트 · 의정감시" });
</script>

<template>
  <div>
    <PageHeader eyebrow="제22대 국회 · 재미로 보는" title="나와 비슷한 의원 찾기" subtitle="실제 본회의 표결 안건에 답하면, 표결 성향이 가장 비슷한 의원을 찾아드려요" />

    <ClientOnly>
      <!-- 진행 중 -->
      <div v-if="!done && quizBills.length" class="rounded-2xl bg-card card-shadow p-6 sm:p-8 max-w-2xl mx-auto">
        <div class="flex items-center justify-between mb-4 text-[13px] font-bold text-toss-gray-400">
          <span>{{ step + 1 }} / {{ quizBills.length }}</span>
          <div class="h-1.5 w-32 rounded-full bg-toss-gray-100 overflow-hidden">
            <div class="h-full bg-toss-blue transition-all" :style="{ width: ((step) / quizBills.length) * 100 + '%' }" />
          </div>
        </div>
        <p class="text-[12px] font-semibold text-toss-blue mb-1">의안 #{{ quizBills[step].no }}</p>
        <h2 class="text-[19px] font-extrabold text-toss-gray-900 leading-snug mb-6">{{ quizBills[step].name }}</h2>
        <p class="text-[14px] text-toss-gray-500 mb-4">당신의 선택은?</p>
        <div class="grid grid-cols-3 gap-2.5">
          <button class="flex flex-col items-center gap-1.5 rounded-2xl bg-toss-blue/10 py-5 text-toss-blue font-bold hover:bg-toss-blue/20 transition-colors" @click="answer('Y')">
            <ThumbsUp class="size-6" /> 찬성
          </button>
          <button class="flex flex-col items-center gap-1.5 rounded-2xl bg-toss-red/10 py-5 text-toss-red font-bold hover:bg-toss-red/20 transition-colors" @click="answer('N')">
            <ThumbsDown class="size-6" /> 반대
          </button>
          <button class="flex flex-col items-center gap-1.5 rounded-2xl bg-toss-gray-100 py-5 text-toss-gray-500 font-bold hover:bg-toss-gray-200 transition-colors" @click="answer('B')">
            <MinusCircle class="size-6" /> 기권
          </button>
        </div>
      </div>

      <!-- 결과 -->
      <div v-else-if="done && result" class="max-w-2xl mx-auto">
        <div class="rounded-2xl bg-card card-shadow p-6 sm:p-8 text-center">
          <p class="text-[13px] font-bold text-toss-blue mb-3">당신과 표결 성향이 가장 비슷한 의원</p>
          <NuxtLink v-if="result.top[0]" :to="`/members/${result.top[0].m.id}`" class="inline-flex flex-col items-center gap-2 group">
            <MemberAvatar :id="result.top[0].m.id" :name="result.top[0].m.name" :party="result.top[0].m.party" :photo="result.top[0].m.photo" :size="96" />
            <p class="text-[24px] font-extrabold text-toss-gray-900 group-hover:text-toss-blue mt-1">{{ result.top[0].m.name }}</p>
            <p class="text-[14px] text-toss-gray-500">{{ normalizeParty(result.top[0].m.party) }}<template v-if="result.top[0].m.origin"> · {{ result.top[0].m.origin }}</template></p>
            <p class="text-[28px] font-extrabold text-toss-blue">{{ (result.top[0].rate * 100).toFixed(0) }}%<span class="text-[14px] text-toss-gray-400 font-bold"> 일치</span></p>
          </NuxtLink>
        </div>

        <div class="mt-4 rounded-2xl bg-card card-shadow p-5">
          <p class="text-[13px] font-bold text-toss-gray-500 mb-3">다음으로 비슷한 의원</p>
          <ul class="space-y-1">
            <li v-for="(p, i) in result.top.slice(1)" :key="p.m.id">
              <NuxtLink :to="`/members/${p.m.id}`" class="group flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-toss-gray-50">
                <span class="w-4 text-center text-[13px] font-extrabold text-toss-gray-300">{{ i + 2 }}</span>
                <MemberAvatar :id="p.m.id" :name="p.m.name" :party="p.m.party" :photo="p.m.photo" :size="36" />
                <div class="min-w-0 flex-1">
                  <p class="text-[14px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">{{ p.m.name }}</p>
                  <p class="text-[12px] text-toss-gray-400 truncate">{{ normalizeParty(p.m.party) }}</p>
                </div>
                <span class="text-[15px] font-extrabold text-toss-blue tabular-nums">{{ (p.rate * 100).toFixed(0) }}%</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <button class="mt-4 mx-auto flex items-center gap-2 rounded-xl bg-card px-5 py-2.5 text-[14px] font-bold text-toss-gray-700 card-shadow hover:bg-toss-gray-50" @click="reset">
          <RotateCcw class="size-4" /> 다시 하기
        </button>
      </div>

      <template #fallback>
        <div class="rounded-2xl bg-toss-gray-100 h-64 grid place-items-center text-[13px] text-toss-gray-400">불러오는 중…</div>
      </template>
    </ClientOnly>
  </div>
</template>
