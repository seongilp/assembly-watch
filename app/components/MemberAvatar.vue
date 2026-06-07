<script setup lang="ts">
import { memberPhoto } from "~/lib/img";

const props = withDefaults(
  defineProps<{
    name: string;
    party: string;
    photo?: string;
    size?: number; // px
  }>(),
  { size: 48, photo: "" },
);

const partyColor = usePartyColor();
const failed = ref(false);
const src = computed(() =>
  props.photo && !failed.value ? memberPhoto(props.photo, props.size) : "",
);
// 큰 아바타(상세 프로필)는 즉시 로드, 작은 목록은 lazy
const big = computed(() => props.size >= 64);
</script>

<template>
  <div
    class="relative shrink-0 overflow-hidden rounded-full grid place-items-center text-white font-bold"
    :style="{
      width: size + 'px',
      height: size + 'px',
      backgroundColor: partyColor(party),
      fontSize: Math.round(size * 0.4) + 'px',
    }"
  >
    <img
      v-if="src"
      :src="src"
      :alt="name"
      :loading="big ? 'eager' : 'lazy'"
      :fetchpriority="big ? 'high' : 'auto'"
      decoding="async"
      class="absolute inset-0 size-full object-cover object-top"
      @error="failed = true"
    />
    <span v-else>{{ name.slice(0, 1) }}</span>
  </div>
</template>
