<script setup lang="ts">
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command";
import { NAV_ITEMS } from "~/lib/nav";
import { partyColor, normalizeParty } from "~/lib/party";
import { Moon, Sun } from "lucide-vue-next";
import type { MemberListItem } from "#shared/types";

const open = useCommandPalette();
const router = useRouter();
const colorMode = useNuxtApp().$colorMode;

// 의원 목록은 클라이언트에서만 lazy 로드 (팔레트 검색용)
const { data: members } = useLazyFetch<{ rows: MemberListItem[] }>(
  "/api/members",
  { server: false },
);

onMounted(() => {
  useEventListener(window, "keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open.value = !open.value;
    }
  });
});

function run(fn: () => void) {
  open.value = false;
  fn();
}
const go = (to: string) => run(() => router.push(to));
const toggleTheme = () =>
  run(() => {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  });
</script>

<template>
  <CommandDialog v-model:open="open">
    <CommandInput placeholder="페이지 이동 또는 의원 이름 검색…" />
    <CommandList>
      <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>

      <CommandGroup heading="바로가기">
        <CommandItem
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :value="`이동 ${item.label}`"
          class="gap-2.5"
          @select="go(item.to)"
        >
          <component :is="item.icon" class="size-4 text-toss-gray-500" />
          <span>{{ item.label }}</span>
          <span class="ml-auto text-[11px] text-toss-gray-400">{{ item.desc }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandGroup v-if="members?.rows?.length" heading="국회의원">
        <CommandItem
          v-for="m in members.rows"
          :key="m.id"
          :value="`${m.name} ${normalizeParty(m.party)} ${m.origin}`"
          class="gap-2.5"
          @select="go(`/members/${m.id}`)"
        >
          <span
            class="grid place-items-center size-5 rounded-full text-white text-[10px] font-bold shrink-0"
            :style="{ backgroundColor: partyColor(m.party) }"
            >{{ m.name.slice(0, 1) }}</span
          >
          <span class="font-medium">{{ m.name }}</span>
          <span class="text-[12px] text-toss-gray-400"
            >{{ normalizeParty(m.party) }}<template v-if="m.origin"> · {{ m.origin }}</template></span
          >
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="환경설정">
        <CommandItem value="테마 다크 라이트 전환 dark light theme" class="gap-2.5" @select="toggleTheme">
          <component :is="colorMode.value === 'dark' ? Sun : Moon" class="size-4 text-toss-gray-500" />
          <span>{{ colorMode.value === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환" }}</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
