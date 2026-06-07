<script setup lang="ts">
import { Moon, Sun } from "lucide-vue-next";

// @nuxtjs/color-mode 의 $colorMode 직접 사용 (useColorMode 이름 충돌 회피)
const colorMode = useNuxtApp().$colorMode;
const toggle = () => {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
};
</script>

<template>
  <button
    type="button"
    aria-label="테마 전환"
    class="grid place-items-center size-9 rounded-xl text-toss-gray-500 hover:bg-toss-gray-100 hover:text-toss-gray-800 transition-colors"
    @click="toggle"
  >
    <ClientOnly>
      <component :is="colorMode.value === 'dark' ? Sun : Moon" class="size-[18px]" />
      <template #fallback><Moon class="size-[18px]" /></template>
    </ClientOnly>
  </button>
</template>
