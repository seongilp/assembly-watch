<script setup lang="ts">
import { Vote, Search } from "lucide-vue-next";
import { NAV_ITEMS } from "~/lib/nav";

const palette = useCommandPalette();
</script>

<template>
  <aside
    class="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-toss-gray-200 bg-card"
  >
    <NuxtLink to="/" class="flex items-center gap-2.5 px-6 h-16 shrink-0">
      <div
        class="grid place-items-center size-9 rounded-xl bg-toss-blue text-white shadow-sm"
      >
        <Vote class="size-5" />
      </div>
      <div class="leading-tight">
        <p class="text-[15px] font-extrabold text-toss-gray-900 tracking-tight">
          의정감시
        </p>
        <p class="text-[11px] font-medium text-toss-gray-500">제22대 국회</p>
      </div>
    </NuxtLink>

    <div class="px-3 pb-2">
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-xl border border-toss-gray-200 bg-toss-gray-50 px-3 py-2.5 text-toss-gray-400 hover:border-toss-gray-300 transition-colors"
        @click="palette = true"
      >
        <Search class="size-[18px]" />
        <span class="text-[13px] font-medium">검색</span>
        <kbd
          class="ml-auto rounded-md border border-toss-gray-200 bg-card px-1.5 py-0.5 text-[11px] font-semibold text-toss-gray-500"
          >⌘K</kbd
        >
      </button>
    </div>

    <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
      <NuxtLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
        :class="
          $route.path === item.to ||
          (item.to !== '/' && $route.path.startsWith(item.to))
            ? 'bg-toss-blue text-white font-bold shadow-sm shadow-toss-blue/30'
            : 'text-toss-gray-600 font-semibold hover:bg-toss-gray-100'
        "
      >
        <component :is="item.icon" class="size-[18px] shrink-0" />
        <span class="text-[14px]">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="flex items-center justify-between gap-2 px-4 py-3 border-t border-toss-gray-100">
      <p class="text-[11px] leading-relaxed text-toss-gray-400">
        데이터 ·
        <a
          href="https://open.assembly.go.kr"
          target="_blank"
          rel="noopener"
          class="font-semibold text-toss-gray-500 hover:text-toss-blue"
          >열린국회정보</a
        >
      </p>
      <ThemeToggle />
    </div>
  </aside>
</template>
