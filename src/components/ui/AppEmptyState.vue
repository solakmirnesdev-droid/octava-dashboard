<script setup>
const props = defineProps({
  title: { type: String, default: 'Nema podataka' },
  description: { type: String, default: null }
});
</script>

<template>
  <div class="rounded-2xl border border-dashed border-line-strong bg-panel/50 p-8 sm:p-12 text-center">
    <div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface text-accent text-2xl shadow-2xs mb-3">
      <slot name="icon">📁</slot>
    </div>
    <h3 class="text-sm font-bold text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-xs text-muted max-w-sm mx-auto">{{ description }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center gap-2">
      <slot name="action" />
    </div>
  </div>
</template>
