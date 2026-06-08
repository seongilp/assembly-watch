<script setup lang="ts">
import type { VoteData } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ memberId: string }>();

const { data } = useFetch<VoteData>("/api/votedata", { key: "votedata", lazy: true });

const VOTE = new Set(["Y", "N", "B"]);
const pairs = computed(() => {
  const d = data.value;
  if (!d) return null;
  const me = d.matrix[props.memberId];
  if (!me) return null;
  const meById = new Map(d.members.map((m) => [m.id, m]));
  const out: { m: any; rate: number; common: number }[] = [];
  for (const other of d.members) {
    if (other.id === props.memberId) continue;
    const ov = d.matrix[other.id];
    if (!ov) continue;
    let agree = 0, common = 0;
    for (let i = 0; i < me.length; i++) {
      const a = me[i], b = ov[i];
      if (VOTE.has(a) && VOTE.has(b)) {
        common++;
        if (a === b) agree++;
      }
    }
    if (common >= 15) out.push({ m: other, rate: agree / common, common });
  }
  out.sort((a, b) => b.rate - a.rate);
  return {
    similar: out.slice(0, 5),
    different: out.slice(-5).reverse(),
  };
});
</script>

<template>
  <section v-if="pairs" class="mt-4 rounded-2xl bg-card card-shadow p-6">
    <h2 class="text-[15px] font-bold text-toss-gray-900 mb-1">표결 쌍둥이</h2>
    <p class="text-[12px] text-toss-gray-400 mb-4">본회의 표결이 가장 비슷한 / 다른 의원 (찬·반·기권 일치율)</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div>
        <p class="text-[12px] font-bold text-toss-blue mb-2">가장 비슷한</p>
        <ul class="space-y-1.5">
          <li v-for="p in pairs.similar" :key="p.m.id">
            <NuxtLink :to="`/members/${p.m.id}`" class="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 -mx-2 hover:bg-toss-gray-50">
              <MemberAvatar :id="p.m.id" :name="p.m.name" :party="p.m.party" :photo="p.m.photo" :size="32" />
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">{{ p.m.name }}</p>
                <p class="text-[11px] text-toss-gray-400 truncate">{{ normalizeParty(p.m.party) }}</p>
              </div>
              <span class="text-[14px] font-extrabold tabular-nums text-toss-blue">{{ (p.rate * 100).toFixed(0) }}%</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div>
        <p class="text-[12px] font-bold text-toss-red mb-2">가장 다른</p>
        <ul class="space-y-1.5">
          <li v-for="p in pairs.different" :key="p.m.id">
            <NuxtLink :to="`/members/${p.m.id}`" class="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 -mx-2 hover:bg-toss-gray-50">
              <MemberAvatar :id="p.m.id" :name="p.m.name" :party="p.m.party" :photo="p.m.photo" :size="32" />
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">{{ p.m.name }}</p>
                <p class="text-[11px] text-toss-gray-400 truncate">{{ normalizeParty(p.m.party) }}</p>
              </div>
              <span class="text-[14px] font-extrabold tabular-nums text-toss-red">{{ (p.rate * 100).toFixed(0) }}%</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
