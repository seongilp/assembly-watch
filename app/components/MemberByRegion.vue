<script setup lang="ts">
import type { MemberListItem } from "#shared/types";
import { regionOf, regionRank } from "~/lib/region";
import { normalizeParty, partyColor } from "~/lib/party";

const props = defineProps<{ members: MemberListItem[] }>();
const partyClr = usePartyColor();

// 선거구 좌표(빌드 베이크) — 지도 확대 시 의원 얼굴 마커용
const { data: coords } = useFetch<Record<string, [number, number]>>(
  "/api/districts",
  { key: "districts", lazy: true },
);
const memberPts = computed(() =>
  props.members
    .map((m) => {
      const c = coords.value?.[m.id];
      return c
        ? {
            id: m.id,
            name: m.name,
            party: normalizeParty(m.party),
            color: partyColor(m.party),
            lat: c[0],
            lng: c[1],
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x),
);

interface RegionStat {
  region: string;
  total: number;
  parties: { party: string; count: number }[]; // 점유율 큰 순
  members: MemberListItem[]; // 정당순 정렬
}

const stats = computed<Record<string, RegionStat>>(() => {
  const map: Record<string, RegionStat> = {};
  for (const m of props.members) {
    const reg = regionOf(m.origin);
    if (!map[reg]) map[reg] = { region: reg, total: 0, parties: [], members: [] };
    map[reg].total++;
    map[reg].members.push(m);
  }
  for (const s of Object.values(map)) {
    const counts = new Map<string, number>();
    for (const m of s.members) {
      const p = normalizeParty(m.party);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    s.parties = [...counts.entries()]
      .map(([party, count]) => ({ party, count }))
      .sort((a, b) => b.count - a.count);
    const rank = new Map(s.parties.map((p, i) => [p.party, i]));
    s.members.sort(
      (a, b) =>
        (rank.get(normalizeParty(a.party)) ?? 99) -
          (rank.get(normalizeParty(b.party)) ?? 99) ||
        a.name.localeCompare(b.name),
    );
  }
  return map;
});

const regions = computed(() =>
  Object.values(stats.value).sort(
    (a, b) => regionRank(a.region) - regionRank(b.region),
  ),
);

const mode = ref<"map" | "tile">("tile");
const selected = ref<string | null>(null);
const selectedStat = computed(() =>
  selected.value ? stats.value[selected.value] : null,
);

// Kakao 지도 오버레이용 (중심좌표 있는 시도만)
const mapRegions = computed(() =>
  regions.value
    .filter((s) => s.region !== "비례" && s.region !== "기타")
    .map((s) => ({
      region: s.region,
      total: s.total,
      segs: s.parties.map((p) => ({ color: partyColor(p.party), count: p.count })),
      top: partyColor(s.parties[0]?.party ?? ""),
    })),
);
</script>

<template>
  <div>
    <!-- 지도/타일 토글 + 상위 정당 범례 -->
    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div class="inline-flex rounded-xl bg-toss-gray-100 p-0.5">
        <button
          v-for="m in (['tile', 'map'] as const)"
          :key="m"
          class="rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all"
          :class="mode === m ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
          @click="mode = m"
        >
          {{ m === "map" ? "지도" : "타일" }}
        </button>
      </div>
      <p class="text-[12px] text-toss-gray-400">지역구 의원 기준 · 색은 정당</p>
    </div>

    <!-- Kakao 지도 오버레이 -->
    <ClientOnly v-if="mode === 'map'">
      <KakaoMemberMap
        :regions="mapRegions"
        :members="memberPts"
        :selected="selected"
        @select="(r) => (selected = selected === r ? null : r)"
        @member="(id) => navigateTo(`/members/${id}`)"
        @error="mode = 'tile'"
      />
      <template #fallback>
        <div class="h-[640px] lg:h-[760px] grid place-items-center rounded-2xl bg-toss-gray-100 text-[13px] text-toss-gray-400">
          지도 준비 중…
        </div>
      </template>
    </ClientOnly>

    <!-- 와플 타일: 의원 1명 = 네모 1개, 정당별 색 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <button
        v-for="s in regions"
        :key="s.region"
        class="text-left rounded-2xl bg-card card-shadow p-4 transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
        :class="selected === s.region ? 'ring-2 ring-toss-blue' : ''"
        @click="selected = selected === s.region ? null : s.region"
      >
        <div class="flex items-baseline justify-between mb-2">
          <span class="text-[15px] font-bold text-toss-gray-900">{{ s.region }}</span>
          <span class="text-[12px] text-toss-gray-400">{{ s.total }}명</span>
        </div>
        <!-- 와플 -->
        <div class="flex flex-wrap gap-[3px] mb-2.5">
          <span
            v-for="(m, i) in s.members"
            :key="i"
            class="size-[11px] rounded-[3px]"
            :style="{ backgroundColor: partyClr(m.party) }"
            :title="`${m.name} · ${normalizeParty(m.party)}`"
          />
        </div>
        <!-- 상위 정당 -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-bold">
          <span
            v-for="p in s.parties.slice(0, 3)"
            :key="p.party"
            class="inline-flex items-center gap-1"
            :style="{ color: partyClr(p.party) }"
          >
            <span class="size-2 rounded-sm" :style="{ backgroundColor: partyClr(p.party) }" />
            {{ p.party }} {{ p.count }}
          </span>
        </div>
      </button>
    </div>

    <!-- 선택 지역 상세 -->
    <div class="mt-5">
      <div v-if="!selectedStat" class="text-center text-[13px] text-toss-gray-400 py-6">
        {{ mode === "map" ? "지도 버블" : "지역 카드" }}을 선택하면 해당 지역 의원을 볼 수 있습니다.
      </div>
      <div v-else class="rounded-2xl bg-card card-shadow p-5">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="text-[16px] font-bold text-toss-gray-900">
            {{ selectedStat.region }}
            <span class="text-[13px] font-medium text-toss-gray-400">{{ selectedStat.total }}명</span>
          </h3>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-bold">
            <span
              v-for="p in selectedStat.parties"
              :key="p.party"
              class="inline-flex items-center gap-1"
              :style="{ color: partyClr(p.party) }"
            >
              <span class="size-2 rounded-sm" :style="{ backgroundColor: partyClr(p.party) }" />
              {{ p.party }} {{ p.count }}
            </span>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          <NuxtLink
            v-for="m in selectedStat.members"
            :key="m.id"
            :to="`/members/${m.id}`"
            class="group flex items-center gap-3 rounded-xl bg-toss-gray-50 p-2.5 transition-colors hover:bg-toss-gray-100"
          >
            <MemberAvatar :id="m.id" :name="m.name" :party="m.party" :photo="m.photo" :size="40" />
            <div class="min-w-0 flex-1">
              <p class="text-[14px] font-bold text-toss-gray-900 group-hover:text-toss-blue truncate">{{ m.name }}</p>
              <p class="text-[12px] text-toss-gray-500 truncate">{{ m.origin }}</p>
            </div>
            <PartyBadge :party="m.party" size="sm" :dot="false" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
