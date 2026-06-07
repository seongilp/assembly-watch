<script setup lang="ts">
import { partyColor } from "~/lib/party";

const props = withDefaults(
  defineProps<{
    name: string;
    party: string;
    photo?: string;
    size?: number; // px
  }>(),
  { size: 48, photo: "" },
);

const failed = ref(false);
const showImg = computed(() => props.photo && !failed.value);
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
      v-if="showImg"
      :src="photo"
      :alt="name"
      loading="lazy"
      decoding="async"
      class="absolute inset-0 size-full object-cover object-top"
      @error="failed = true"
    />
    <span v-else>{{ name.slice(0, 1) }}</span>
  </div>
</template>
