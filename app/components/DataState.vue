<script setup lang="ts">
import { Inbox, AlertCircle } from "lucide-vue-next";

withDefaults(
  defineProps<{
    pending?: boolean;
    error?: unknown;
    empty?: boolean;
    emptyText?: string;
    skeletonRows?: number;
  }>(),
  { emptyText: "표시할 데이터가 없습니다.", skeletonRows: 6 },
);
</script>

<template>
  <div v-if="pending" class="space-y-2.5">
    <Skeleton
      v-for="i in skeletonRows"
      :key="i"
      class="h-16 w-full rounded-xl bg-toss-gray-100"
    />
  </div>

  <div
    v-else-if="error"
    class="grid place-items-center text-center rounded-2xl bg-card card-shadow py-16 px-6"
  >
    <AlertCircle class="size-10 text-toss-red mb-3" />
    <p class="text-[15px] font-bold text-toss-gray-800">
      데이터를 불러오지 못했습니다
    </p>
    <p class="mt-1 text-[13px] text-toss-gray-500">
      잠시 후 다시 시도해 주세요.
    </p>
  </div>

  <div
    v-else-if="empty"
    class="grid place-items-center text-center rounded-2xl bg-card card-shadow py-16 px-6"
  >
    <div class="grid place-items-center size-12 rounded-2xl bg-toss-gray-100 mb-3">
      <Inbox class="size-6 text-toss-gray-400" />
    </div>
    <p class="text-[14px] font-semibold text-toss-gray-500">{{ emptyText }}</p>
  </div>

  <slot v-else />
</template>
