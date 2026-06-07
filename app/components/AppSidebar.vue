<script setup lang="ts">
import { Vote } from "lucide-vue-next";
import { NAV_ITEMS } from "~/lib/nav";
</script>

<template>
  <aside
    class="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-toss-gray-200 bg-white"
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

    <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
      <NuxtLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
        :class="
          $route.path === item.to ||
          (item.to !== '/' && $route.path.startsWith(item.to))
            ? 'bg-[#D6E7FF] text-toss-blue font-bold'
            : 'text-toss-gray-600 font-semibold hover:bg-toss-gray-100'
        "
      >
        <component :is="item.icon" class="size-[18px] shrink-0" />
        <span class="text-[14px]">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="px-5 py-4 border-t border-toss-gray-100">
      <p class="text-[11px] leading-relaxed text-toss-gray-400">
        데이터 ·
        <a
          href="https://open.assembly.go.kr"
          target="_blank"
          class="font-semibold text-toss-gray-500 hover:text-toss-blue"
          >열린국회정보 Open API</a
        >
      </p>
    </div>
  </aside>
</template>
