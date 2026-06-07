<script setup lang="ts">
import { Menu, Vote } from "lucide-vue-next";
import { NAV_ITEMS } from "~/lib/nav";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "~/components/ui/sheet";

const open = ref(false);
const route = useRoute();
watch(() => route.path, () => (open.value = false));
</script>

<template>
  <header
    class="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white/90 backdrop-blur border-b border-toss-gray-200"
  >
    <NuxtLink to="/" class="flex items-center gap-2">
      <div class="grid place-items-center size-7 rounded-lg bg-toss-blue text-white">
        <Vote class="size-4" />
      </div>
      <span class="text-[15px] font-extrabold text-toss-gray-900">의정감시</span>
    </NuxtLink>

    <Sheet v-model:open="open">
      <SheetTrigger
        class="grid place-items-center size-9 rounded-lg hover:bg-toss-gray-100 text-toss-gray-700"
      >
        <Menu class="size-5" />
      </SheetTrigger>
      <SheetContent side="right" class="w-72 p-0">
        <nav class="px-3 pt-14 space-y-1">
          <SheetClose v-for="item in NAV_ITEMS" :key="item.to" as-child>
            <NuxtLink
              :to="item.to"
              class="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors"
              :class="
                route.path === item.to ||
                (item.to !== '/' && route.path.startsWith(item.to))
                  ? 'bg-[#D6E7FF] text-toss-blue font-bold'
                  : 'text-toss-gray-700 hover:bg-toss-gray-100'
              "
            >
              <component :is="item.icon" class="size-5 shrink-0" />
              <div>
                <p class="text-[14px] font-semibold">{{ item.label }}</p>
                <p class="text-[11px] text-toss-gray-400">{{ item.desc }}</p>
              </div>
            </NuxtLink>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  </header>
</template>
