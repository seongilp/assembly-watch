<script setup lang="ts">
import { Home, Vote } from "lucide-vue-next";

const props = defineProps<{ error: { statusCode: number; message?: string } }>();
const is404 = computed(() => props.error?.statusCode === 404);
useHead({ title: () => (is404.value ? "페이지를 찾을 수 없습니다" : "오류") + " · 의정감시" });
</script>

<template>
  <div class="min-h-screen grid place-items-center bg-toss-gray-50 px-6">
    <div class="text-center max-w-md">
      <div class="inline-grid place-items-center size-16 rounded-2xl bg-toss-blue text-white mb-6">
        <Vote class="size-8" />
      </div>
      <p class="text-[56px] font-extrabold text-toss-blue leading-none">
        {{ error?.statusCode || 500 }}
      </p>
      <h1 class="mt-3 text-[20px] font-bold text-toss-gray-900">
        {{ is404 ? "페이지를 찾을 수 없습니다" : "문제가 발생했습니다" }}
      </h1>
      <p class="mt-2 text-[14px] text-toss-gray-500">
        {{ is404 ? "주소가 바뀌었거나 삭제된 페이지일 수 있어요." : "잠시 후 다시 시도해 주세요." }}
      </p>
      <button
        class="mt-6 inline-flex items-center gap-2 rounded-xl bg-toss-blue px-5 py-3 text-[15px] font-bold text-white hover:bg-toss-blue-dark transition-colors"
        @click="clearError({ redirect: '/' })"
      >
        <Home class="size-4" /> 대시보드로
      </button>
    </div>
  </div>
</template>
