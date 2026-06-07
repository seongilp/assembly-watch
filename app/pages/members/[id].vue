<script setup lang="ts">
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  Users,
  FileText,
  ExternalLink,
  Building2,
  Vote,
  Crown,
} from "lucide-vue-next";
import type { MemberDetail, Insights } from "#shared/types";
import { partyColor } from "~/lib/party";
import { formatDate, voteStyle } from "~/lib/format";

const route = useRoute();
const id = computed(() => String(route.params.id));

// 불참왕/기권왕/발의왕 칭호 (펀팩트 1위와 일치 시) — member-detail await 보다 먼저 호출(SSR 컨텍스트 보존)
const { data: insights } = await useFetch<Insights>("/api/insights", { key: "insights" });

// 단일 엔드포인트로 member + bills + votes 통합 조회 (하이드레이션 일관성)
// 정적 URL + 명시적 key 로 SSR↔CSR payload 매칭 보장
const { data, pending } = await useFetch<MemberDetail>(
  `/api/members/${id.value}`,
  { key: `member-detail-${id.value}` },
);

const member = computed(() => data.value?.member ?? undefined);

const titles = computed(() => {
  const t: string[] = [];
  if (insights.value?.absent?.[0]?.id === id.value) t.push("불참왕");
  if (insights.value?.blank?.[0]?.id === id.value) t.push("기권왕");
  if (insights.value?.proposed?.[0]?.id === id.value) t.push("발의왕");
  return t;
});
const bills = computed(() => ({ rows: data.value?.bills ?? [] }));
const votes = computed(() => ({
  rows: data.value?.votes ?? [],
  scanned: data.value?.votesScanned ?? 0,
}));
const billsPending = pending;
const votesPending = pending;

const voteTally = computed(() => {
  const t = { 찬성: 0, 반대: 0, 기권: 0, 불참: 0 } as Record<string, number>;
  for (const v of votes.value?.rows ?? []) {
    if (v.result.includes("찬성")) t.찬성++;
    else if (v.result.includes("반대")) t.반대++;
    else if (v.result.includes("기권")) t.기권++;
    else t.불참++;
  }
  return t;
});

useHead({ title: () => `${member.value?.name ?? "의원"} · 의정감시` });

const infoRows = computed(() => {
  const m = member.value;
  if (!m) return [];
  return [
    { label: "정당", value: m.party.split("/")[0] },
    { label: "선거구", value: m.origin || "—" },
    { label: "선수", value: m.reelection },
    { label: "당선", value: m.units },
    { label: "위원회", value: m.committee || m.committees || "—" },
    { label: "성별", value: m.sex },
  ].filter((r) => r.value);
});

const contacts = computed(() => {
  const m = member.value;
  if (!m) return [];
  return [
    m.tel && { icon: Phone, label: m.tel, href: `tel:${m.tel}` },
    m.email && { icon: Mail, label: m.email, href: `mailto:${m.email}` },
    m.homepage && { icon: Globe, label: "홈페이지", href: m.homepage },
  ].filter(Boolean) as { icon: any; label: string; href: string }[];
});
</script>

<template>
  <div>
    <NuxtLink
      to="/members"
      class="inline-flex items-center gap-1 text-[13px] font-semibold text-toss-gray-500 hover:text-toss-blue mb-5"
    >
      <ArrowLeft class="size-4" /> 국회의원 목록
    </NuxtLink>

    <div v-if="!member && !pending" class="rounded-2xl bg-card card-shadow p-10 text-center">
      <p class="text-toss-gray-500">의원 정보를 찾을 수 없습니다.</p>
    </div>

    <template v-else-if="member">
      <!-- 프로필 헤더 -->
      <section class="rounded-2xl bg-card card-shadow p-6 sm:p-8">
        <div class="flex flex-col sm:flex-row sm:items-center gap-5">
          <MemberAvatar
            :id="member.id"
            :name="member.name"
            :party="member.party"
            :photo="member.photo"
            :size="84"
          />
          <div class="min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-[26px] font-extrabold text-toss-gray-900 tracking-tight">
                {{ member.name }}
              </h1>
              <span class="text-[15px] text-toss-gray-400">{{ member.hanja }}</span>
              <PartyBadge :party="member.party" />
              <span
                v-for="t in titles"
                :key="t"
                class="inline-flex items-center gap-1 rounded-full bg-[#FFB400]/15 px-2.5 py-1 text-[12px] font-extrabold text-[#C98A00]"
              >
                <Crown class="size-3.5 fill-[#FFB400] text-[#FFB400]" /> {{ t }}
              </span>
            </div>
            <p class="mt-1 text-[14px] text-toss-gray-500">
              {{ member.origin || member.electType }} · {{ member.reelection }}
              <template v-if="member.job"> · {{ member.job }}</template>
            </p>
          </div>
        </div>

        <div
          v-if="contacts.length"
          class="mt-6 flex flex-wrap gap-2 pt-5 border-t border-toss-gray-100"
        >
          <a
            v-for="c in contacts"
            :key="c.label"
            :href="c.href"
            :target="c.href.startsWith('http') ? '_blank' : undefined"
            class="inline-flex items-center gap-1.5 rounded-xl bg-toss-gray-50 px-3 py-2 text-[13px] font-medium text-toss-gray-600 hover:bg-toss-gray-100"
          >
            <component :is="c.icon" class="size-4 text-toss-gray-400" />
            {{ c.label }}
          </a>
        </div>
      </section>

      <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- 기본 정보 -->
        <section class="rounded-2xl bg-card card-shadow p-6">
          <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-4">
            <Building2 class="size-4 text-toss-blue" /> 기본 정보
          </h2>
          <dl class="space-y-3">
            <div
              v-for="r in infoRows"
              :key="r.label"
              class="flex items-start justify-between gap-4"
            >
              <dt class="text-[13px] text-toss-gray-400 shrink-0">{{ r.label }}</dt>
              <dd class="text-[13px] font-semibold text-toss-gray-800 text-right">
                {{ r.value }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- 대표발의 법안 -->
        <section class="lg:col-span-2 rounded-2xl bg-card card-shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
              <FileText class="size-4 text-toss-blue" /> 대표발의 법안
            </h2>
            <span
              v-if="bills?.rows?.length"
              class="text-[12px] font-semibold text-toss-blue bg-toss-blue-light rounded-full px-2.5 py-1"
              >{{ bills.rows.length }}건</span
            >
          </div>

          <DataState
            :pending="billsPending"
            :empty="!bills?.rows?.length"
            empty-text="최근 발의 데이터가 없습니다."
            :skeleton-rows="4"
          >
            <ul class="divide-y divide-toss-gray-100">
              <li v-for="b in bills?.rows" :key="b.id">
                <a
                  :href="b.link"
                  target="_blank"
                  class="group flex items-start justify-between gap-3 py-3"
                >
                  <div class="min-w-0">
                    <p class="text-[14px] font-semibold text-toss-gray-800 group-hover:text-toss-blue line-clamp-2">
                      {{ b.name }}
                    </p>
                    <p class="mt-1 text-[12px] text-toss-gray-400">
                      {{ formatDate(b.proposeDt) }}
                      <template v-if="b.committee"> · {{ b.committee }}</template>
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <ResultBadge v-if="b.procResult" :text="b.procResult" size="sm" />
                    <ExternalLink class="size-3.5 text-toss-gray-300" />
                  </div>
                </a>
              </li>
            </ul>
            <p class="mt-3 text-[11px] text-toss-gray-400">
              ※ 최근 발의분 중 대표발의(이름 기준) 매칭 결과입니다.
            </p>
          </DataState>
        </section>
      </div>

      <!-- 최근 본회의 표결 이력 -->
      <section class="mt-4 rounded-2xl bg-card card-shadow p-6">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900">
            <Vote class="size-4 text-toss-blue" /> 최근 본회의 표결 이력
          </h2>
          <div v-if="votes?.rows?.length" class="flex items-center gap-1.5">
            <span
              v-for="(cnt, label) in voteTally"
              :key="label"
              v-show="cnt > 0"
              class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold"
              :style="{ color: voteStyle(label).fg, backgroundColor: voteStyle(label).bg }"
            >
              {{ label }} {{ cnt }}
            </span>
          </div>
        </div>

        <DataState
          :pending="votesPending"
          :empty="!votes?.rows?.length"
          empty-text="최근 표결 안건에서 이 의원의 기록을 찾지 못했습니다."
          :skeleton-rows="4"
        >
          <ul class="divide-y divide-toss-gray-100">
            <li v-for="v in votes?.rows" :key="v.billId">
              <NuxtLink
                :to="`/votes/${v.billId}`"
                class="group flex items-center justify-between gap-3 py-3"
              >
                <div class="min-w-0">
                  <p class="text-[14px] font-semibold text-toss-gray-800 group-hover:text-toss-blue line-clamp-1">
                    {{ v.billName }}
                  </p>
                  <p class="mt-1 text-[12px] text-toss-gray-400">
                    {{ formatDate(v.date) }}
                    <template v-if="v.procResult"> · {{ v.procResult }}</template>
                  </p>
                </div>
                <span
                  class="rounded-lg px-2.5 py-1 text-[12px] font-bold shrink-0"
                  :style="{ color: voteStyle(v.result).fg, backgroundColor: voteStyle(v.result).bg }"
                >
                  {{ v.result }}
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p class="mt-3 text-[11px] text-toss-gray-400">
            ※ 최근 본회의 표결 {{ votes?.scanned ?? 0 }}건 기준 (표결 API는 안건별 조회만 지원).
          </p>
        </DataState>
      </section>
    </template>

    <div v-else class="space-y-4">
      <Skeleton class="h-40 w-full rounded-2xl bg-toss-gray-100" />
      <Skeleton class="h-60 w-full rounded-2xl bg-toss-gray-100" />
    </div>
  </div>
</template>
