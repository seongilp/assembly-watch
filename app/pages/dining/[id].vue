<script setup lang="ts">
import { ChevronDown, MapPin, ArrowLeft } from "lucide-vue-next";
import type { DiningRestaurantDetail } from "#shared/types";
import { normalizeParty } from "~/lib/party";

const route = useRoute();
const id = route.params.id as string;

const { data: d, status, error } = await useFetch<DiningRestaurantDetail>(
  `/api/dining-detail/${id}`,
  { key: `dining-${id}` },
);

const won = (n: number) => n.toLocaleString("ko-KR");

const CUISINE_EMOJI: Record<string, string> = {
  한식: "🍚", 중식: "🥟", 일식: "🍣", 양식: "🍝", "고기·구이": "🥩",
  "분식·면": "🍜", "카페·음료": "☕", 주점: "🍻", 구내식당: "🍱", 기타: "🍽️",
};
const cuisineEmoji = (c: string) => CUISINE_EMOJI[c] ?? "🍽️";

// 연도별 추이 — 최대 방문수를 기준으로 정규화
const maxVisits = computed(() =>
  Math.max(1, ...(d.value?.byYear ?? []).map((y) => y.visits)),
);
const barPct = (visits: number) => Math.round((visits / maxVisits.value) * 100);

// 방문 의원 명단 — 더보기 (30명 캡)
const INITIAL_LIMIT = 30;
const expanded = ref(false);
const members = computed(() => d.value?.members ?? []);
const visibleMembers = computed(() =>
  expanded.value ? members.value : members.value.slice(0, INITIAL_LIMIT),
);
const hiddenCount = computed(() =>
  Math.max(0, members.value.length - INITIAL_LIMIT),
);

// 카카오 지도 (single pin)
const mapEl = ref<HTMLElement | null>(null);
const mapStatus = ref<"loading" | "ready" | "error">("loading");

onMounted(async () => {
  if (!d.value?.lat || !d.value?.lng) {
    mapStatus.value = "error";
    return;
  }
  try {
    const kakao: any = await useKakaoLoader();
    if (!mapEl.value) return;
    const center = new kakao.maps.LatLng(d.value.lat, d.value.lng);
    const map = new kakao.maps.Map(mapEl.value, { center, level: 3 });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

    // 레이블 핀 CustomOverlay
    const el = document.createElement("div");
    el.innerHTML = `
      <div style="
        background:#3182F6;color:#fff;
        font:700 12px Pretendard,sans-serif;
        padding:5px 10px;border-radius:999px;
        box-shadow:0 2px 8px rgba(0,0,0,.25);
        white-space:nowrap;cursor:default;
        position:relative;
      ">
        ${d.value.name}
        <span style="
          position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:7px solid #3182F6;
        "></span>
      </div>`;
    const overlay = new kakao.maps.CustomOverlay({
      position: center,
      content: el,
      yAnchor: 1.45,
      xAnchor: 0.5,
    });
    overlay.setMap(map);
    mapStatus.value = "ready";
  } catch {
    mapStatus.value = "error";
  }
});

// SEO
useHead({ title: d.value ? `${d.value.name} · 정치자금 식당 · 의정감시` : "식당 상세 · 의정감시" });
useSeoMeta({
  description: d.value
    ? `${d.value.name} — 국회의원 정치자금 ${won(d.value.amount)}원, ${d.value.visits}회 방문`
    : "국회의원 정치자금 식당 상세",
  ogTitle: d.value ? `${d.value.name} · 정치자금 맛집` : "식당 상세",
  ogImage: "https://asm.zihado.com/og-insights.png",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <div>
    <!-- 뒤로가기 -->
    <NuxtLink
      to="/dining"
      class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-toss-gray-500 hover:text-toss-blue transition-colors mb-4"
    >
      <ArrowLeft class="size-4" />
      정치자금 맛집
    </NuxtLink>

    <!-- 로딩 / 에러 -->
    <div v-if="status === 'pending'" class="py-20 text-center text-toss-gray-400">불러오는 중…</div>
    <div v-else-if="error || !d" class="py-20 text-center text-toss-gray-400">식당 정보를 찾을 수 없습니다.</div>

    <template v-else>
      <!-- 헤더 -->
      <PageHeader
        eyebrow="정치자금 지출내역"
        :title="`${cuisineEmoji(d.cuisine)} ${d.name}`"
        :subtitle="`${d.cuisine} · ${d.gu ?? ''} · ${d.rank}위 · 방문 ${d.visits.toLocaleString()}회 · ${won(d.amount)}원`"
      />

      <!-- 지도 -->
      <ClientOnly>
        <section v-if="d.lat && d.lng" class="rounded-2xl bg-card card-shadow p-5 mb-4">
          <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-3">
            <MapPin class="size-4 text-toss-blue" /> 위치
          </h2>
          <div class="relative">
            <div
              ref="mapEl"
              class="w-full h-[280px] rounded-xl overflow-hidden bg-toss-gray-100"
            />
            <p
              v-if="mapStatus === 'error'"
              class="absolute inset-0 grid place-items-center text-toss-gray-400 text-sm"
            >지도를 불러오지 못했습니다</p>
          </div>
        </section>
        <section v-else class="rounded-2xl border border-toss-gray-200 bg-card p-5 mb-4 text-[13px] text-toss-gray-400">
          위치 정보 없음 (주소가 있는 2023~2024 지출만 지도 표시)
        </section>
      </ClientOnly>

      <!-- 연도별 추이 -->
      <section v-if="d.byYear.length" class="rounded-2xl bg-card card-shadow p-5 mb-4">
        <h2 class="text-[15px] font-bold text-toss-gray-900 mb-4">연도별 방문 추이</h2>
        <div class="flex items-end gap-2 h-[120px]">
          <div
            v-for="y in d.byYear"
            :key="y.year"
            class="flex flex-col items-center gap-1 flex-1 min-w-0"
          >
            <span class="text-[11px] font-bold text-toss-blue tabular-nums">{{ y.visits }}</span>
            <div
              class="w-full rounded-t-md bg-toss-blue/80 transition-all"
              :style="{ height: `${Math.max(4, barPct(y.visits) * 0.8)}px` }"
            />
            <span class="text-[10px] text-toss-gray-400">{{ y.year }}</span>
          </div>
        </div>
      </section>

      <!-- 방문 의원 명단 -->
      <section class="rounded-2xl bg-card card-shadow p-5 mb-4">
        <h2 class="text-[15px] font-bold text-toss-gray-900 mb-4">
          방문 의원 명단
          <span class="ml-1 text-[13px] font-normal text-toss-gray-400">({{ members.length }}명)</span>
        </h2>
        <ol class="space-y-1">
          <li
            v-for="(m, i) in visibleMembers"
            :key="`${m.name}-${i}`"
            class="flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-toss-gray-50 transition-colors"
          >
            <span
              class="w-5 text-center text-[12px] font-extrabold tabular-nums shrink-0 text-toss-gray-400"
            >{{ i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5 text-[14px] font-bold text-toss-gray-900 truncate">
                <NuxtLink
                  v-if="m.id"
                  :to="`/members/${m.id}`"
                  class="hover:text-toss-blue transition-colors"
                >{{ m.name }}</NuxtLink>
                <span v-else class="text-toss-gray-700">{{ m.name }}</span>
                <span
                  v-if="!m.id"
                  class="shrink-0 text-[10px] font-normal text-toss-gray-400"
                >(전직/미매칭)</span>
              </p>
              <p class="text-[12px] text-toss-gray-400 truncate">
                {{ normalizeParty(m.party) }}
              </p>
            </div>
            <span class="text-[13px] text-toss-gray-500 shrink-0 text-right tabular-nums">
              {{ m.visits }}회 · {{ won(m.amount) }}원
            </span>
          </li>
        </ol>
        <button
          v-if="hiddenCount > 0"
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-toss-gray-50 py-2 text-[13px] font-semibold text-toss-gray-500 hover:bg-toss-gray-100 transition-colors"
          @click="expanded = !expanded"
        >
          {{ expanded ? "접기" : `더보기 (${hiddenCount}명)` }}
          <ChevronDown class="size-4 transition-transform" :class="expanded ? 'rotate-180' : ''" />
        </button>
      </section>

      <!-- 출처 -->
      <p class="mt-4 text-[11px] text-toss-gray-400">
        자료: 오마이뉴스·경향신문·뉴스타파 · 음식종류는 가게명·업종 기반 추정입니다.
      </p>
    </template>
  </div>
</template>
