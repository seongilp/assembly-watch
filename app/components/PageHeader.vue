<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>();
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div>
      <p
        v-if="eyebrow"
        class="text-[12px] font-bold text-toss-blue mb-1.5 tracking-wide"
      >
        {{ eyebrow }}
      </p>
      <h1
        class="text-[22px] sm:text-[26px] font-extrabold text-toss-gray-900 tracking-tight"
      >
        {{ title }}
      </h1>
      <p v-if="subtitle" class="mt-1 text-[14px] text-toss-gray-500">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
