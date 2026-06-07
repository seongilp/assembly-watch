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
} from "lucide-vue-next";
import type { Member, Bill } from "#shared/types";
import { partyColor } from "~/lib/party";
import { formatDate } from "~/lib/format";

const route = useRoute();
const id = computed(() => String(route.params.id));

const { data: members } = useFetch<{ rows: Member[] }>("/api/members");
const member = computed(() =>
  members.value?.rows.find((m) => m.id === id.value),
);

const { data: bills, pending: billsPending } = useFetch<{ rows: Bill[] }>(
  "/api/member-bills",
  { query: { name: computed(() => member.value?.name ?? "") }, immediate: true },
);

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

    <div v-if="!member && members" class="rounded-2xl bg-white card-shadow p-10 text-center">
      <p class="text-toss-gray-500">의원 정보를 찾을 수 없습니다.</p>
    </div>

    <template v-else-if="member">
      <!-- 프로필 헤더 -->
      <section class="rounded-2xl bg-white card-shadow p-6 sm:p-8">
        <div class="flex flex-col sm:flex-row sm:items-center gap-5">
          <div
            class="grid place-items-center size-20 shrink-0 rounded-3xl text-white font-extrabold text-[32px]"
            :style="{ backgroundColor: partyColor(member.party) }"
          >
            {{ member.name.slice(0, 1) }}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-[26px] font-extrabold text-toss-gray-900 tracking-tight">
                {{ member.name }}
              </h1>
              <span class="text-[15px] text-toss-gray-400">{{ member.hanja }}</span>
              <PartyBadge :party="member.party" />
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
        <section class="rounded-2xl bg-white card-shadow p-6">
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
        <section class="lg:col-span-2 rounded-2xl bg-white card-shadow p-6">
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
    </template>

    <div v-else class="space-y-4">
      <Skeleton class="h-40 w-full rounded-2xl bg-toss-gray-100" />
      <Skeleton class="h-60 w-full rounded-2xl bg-toss-gray-100" />
    </div>
  </div>
</template>
