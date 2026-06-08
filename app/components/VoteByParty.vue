<script setup lang="ts">
import type { VoteRecord } from "#shared/types";
import { normalizeParty } from "~/lib/party";
import { voteStyle, padName } from "~/lib/format";

const props = defineProps<{ records: VoteRecord[] }>();
const partyColor = usePartyColor();

const RESULT_COLORS: Record<string, string> = {
  찬성: "#3182F6",
  반대: "#F04452",
  기권: "#FF9500",
  불참: "#B0B8C1",
};

const RESULT_ORDER = ["찬성", "반대", "기권", "불참"] as const;

interface Group {
  party: string;
  color: string;
  total: number;
  tally: { 찬성: number; 반대: number; 기권: number; 불참: number };
  members: VoteRecord[];
}

/** 정당 내 결과별 그룹 (찬/반/기권/불참) */
function byResult(members: VoteRecord[]) {
  return RESULT_ORDER.map((label) => ({
    label,
    members: members.filter((m) =>
      label === "불참"
        ? !/찬성|반대|기권/.test(m.result)
        : m.result.includes(label),
    ),
  })).filter((g) => g.members.length > 0);
}

const groups = computed<Group[]>(() => {
  const map = new Map<string, Group>();
  for (const r of props.records) {
    const p = normalizeParty(r.party);
    if (!map.has(p)) {
      map.set(p, {
        party: p,
        color: partyColor(r.party),
        total: 0,
        tally: { 찬성: 0, 반대: 0, 기권: 0, 불참: 0 },
        members: [],
      });
    }
    const g = map.get(p)!;
    g.total++;
    g.members.push(r);
    if (r.result.includes("찬성")) g.tally.찬성++;
    else if (r.result.includes("반대")) g.tally.반대++;
    else if (r.result.includes("기권")) g.tally.기권++;
    else g.tally.불참++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
});

const open = ref<Set<string>>(new Set());
const toggle = (p: string) => {
  const s = new Set(open.value);
  s.has(p) ? s.delete(p) : s.add(p);
  open.value = s;
};
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="g in groups"
      :key="g.party"
      class="rounded-2xl bg-card card-shadow overflow-hidden"
    >
      <button
        class="w-full flex items-center gap-3 p-4 text-left hover:bg-toss-gray-50 transition-colors"
        @click="toggle(g.party)"
      >
        <span class="size-3 rounded-full shrink-0" :style="{ backgroundColor: g.color }" />
        <span class="text-[15px] font-bold text-toss-gray-900">{{ g.party }}</span>
        <span class="text-[13px] text-toss-gray-400">{{ g.total }}명</span>

        <div class="ml-auto flex items-center gap-3">
          <span
            v-for="(cnt, label) in g.tally"
            :key="label"
            v-show="cnt > 0"
            class="text-[12px] font-bold tabular-nums"
            :style="{ color: RESULT_COLORS[label] }"
          >
            {{ label[0] }} {{ cnt }}
          </span>
        </div>
      </button>

      <!-- 정당 내 찬반 분포 바 -->
      <div class="px-4 pb-3">
        <div class="flex h-2 w-full overflow-hidden rounded-full bg-toss-gray-100">
          <div
            v-for="(cnt, label) in g.tally"
            :key="label"
            class="h-full"
            :style="{
              width: (cnt / g.total) * 100 + '%',
              backgroundColor: RESULT_COLORS[label],
            }"
          />
        </div>
      </div>

      <!-- 의원 명단 — 정당 내 결과별 그룹 -->
      <div v-if="open.has(g.party)" class="px-4 pb-4 space-y-3">
        <div v-for="grp in byResult(g.members)" :key="grp.label">
          <p
            class="mb-1.5 text-[12px] font-bold"
            :style="{ color: voteStyle(grp.label).fg }"
          >
            {{ grp.label }}
            <span class="text-toss-gray-400 font-semibold">{{ grp.members.length }}</span>
          </p>
          <div class="flex flex-wrap gap-1.5">
            <component
              :is="m.id ? 'NuxtLink' : 'span'"
              v-for="(m, i) in grp.members"
              :key="m.name + i"
              :to="m.id ? `/members/${m.id}` : undefined"
              class="inline-flex items-center gap-1.5 rounded-full bg-toss-gray-100 py-0.5 pl-0.5 pr-2.5 text-[12px] font-semibold text-toss-gray-700"
              :class="m.id ? 'hover:bg-toss-gray-200 transition-colors' : ''"
            >
              <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :photo="m.photo" :size="20" />
              <span class="whitespace-pre">{{ padName(m.name) }}</span>
            </component>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
