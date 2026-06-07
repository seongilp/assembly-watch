<script setup lang="ts">
import { memberPhoto } from "~/lib/img";

const props = withDefaults(
  defineProps<{
    name: string;
    party: string;
    id?: string; // MONA_CD — 있으면 빌드타임 베이크 webp(/m/{id}.webp) 사용
    photo?: string; // 원본 URL (베이크 없을 때 wsrv 폴백)
    size?: number; // px
  }>(),
  { size: 48, photo: "", id: "" },
);

const partyColor = usePartyColor();

// 0: 베이크 webp, 1: wsrv 원본, 2: 이니셜
const stage = ref(0);
watch(
  () => [props.id, props.photo],
  () => (stage.value = 0),
);

const src = computed(() => {
  if (stage.value === 0 && props.id) return `/m/${props.id}.webp`;
  if (stage.value <= 1 && props.photo) return memberPhoto(props.photo, props.size);
  return "";
});

function onError() {
  // 베이크 실패 → wsrv, wsrv 실패 → 이니셜
  if (stage.value === 0 && props.photo) stage.value = 1;
  else stage.value = 2;
}

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
      @error="onError"
    />
    <span v-else>{{ name.slice(0, 1) }}</span>
  </div>
</template>
