<script setup lang="ts">
import type { MemberListItem } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const props = defineProps<{ speakers: string[] }>();
const partyClr = usePartyColor();

// 현직 의원 이름→멤버 매핑(사진/정당) — 캐시 공유
const { data } = useFetch<{ rows: MemberListItem[] }>("/api/members", {
  key: "members",
  lazy: true,
});
const nameMap = computed(() => {
  const m = new Map<string, MemberListItem>();
  for (const r of data.value?.rows ?? []) m.set(r.name, r);
  return m;
});

// "한병도 위원장 (전북 익산시을)" → 이름 + 멤버 + 라벨
interface Sp {
  raw: string;
  name: string;
  member: MemberListItem | null;
  party: string;
}
const parsed = computed<Sp[]>(() =>
  props.speakers.map((raw) => {
    const name = raw.trim().split(/\s|\(/)[0] ?? raw;
    const member = nameMap.value.get(name) ?? null;
    return { raw, name, member, party: member ? normalizeParty(member.party) : "비의원·정부" };
  }),
);

// 정당별 그룹 (의원 정당 먼저, 비의원 마지막)
const groups = computed(() => {
  const g = new Map<string, Sp[]>();
  for (const s of parsed.value) {
    if (!g.has(s.party)) g.set(s.party, []);
    g.get(s.party)!.push(s);
  }
  return [...g.entries()]
    .map(([party, list]) => ({ party, list }))
    .sort((a, b) =>
      a.party === "비의원·정부" ? 1 : b.party === "비의원·정부" ? -1 : b.list.length - a.list.length,
    );
});
</script>

<template>
  <div class="space-y-2.5">
    <div v-for="g in groups" :key="g.party">
      <p class="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold" :style="{ color: partyClr(g.party) }">
        <span class="size-2 rounded-sm" :style="{ backgroundColor: partyClr(g.party) }" />
        {{ g.party }} <span class="text-toss-gray-400">{{ g.list.length }}</span>
      </p>
      <div class="flex flex-wrap gap-1.5">
        <component
          :is="s.member ? 'NuxtLink' : 'span'"
          v-for="(s, i) in g.list"
          :key="i"
          :to="s.member ? `/members/${s.member.id}` : undefined"
          class="inline-flex items-center gap-1.5 rounded-full bg-toss-gray-100 py-0.5 pl-0.5 pr-2.5"
          :class="s.member ? 'hover:bg-toss-gray-200 transition-colors' : ''"
        >
          <MemberAvatar
            v-if="s.member"
            :id="s.member.id"
            :name="s.member.name"
            :party="s.member.party"
            :photo="s.member.photo"
            :size="22"
          />
          <span v-else class="grid place-items-center size-[22px] rounded-full bg-toss-gray-300 text-[10px] font-bold text-white">{{ s.name.slice(0, 1) }}</span>
          <span class="text-[12px] font-semibold text-toss-gray-700">{{ s.name }}</span>
        </component>
      </div>
    </div>
  </div>
</template>
