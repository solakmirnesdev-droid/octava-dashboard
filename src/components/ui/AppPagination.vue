<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  totalItems: { type: Number, default: null },
  pageSize: { type: Number, default: null }
});

const emit = defineEmits(['update:page']);

function goTo(p) {
  if (p >= 1 && p <= props.totalPages && p !== props.page) {
    emit('update:page', p);
  }
}
</script>

<template>
  <div v-if="totalPages > 1" class="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs">
    <span v-if="totalItems !== null" class="text-muted font-medium">
      Prikazano <span class="font-bold text-ink">{{ (page - 1) * (pageSize || 1) + 1 }}</span> do
      <span class="font-bold text-ink">{{ Math.min(page * (pageSize || 1), totalItems) }}</span> od
      <span class="font-bold text-ink">{{ totalItems }}</span>
    </span>
    <span v-else class="text-muted font-medium">
      Stranica <span class="font-bold text-ink">{{ page }}</span> od <span class="font-bold text-ink">{{ totalPages }}</span>
    </span>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded-lg border border-line-strong bg-panel px-2.5 py-1 font-semibold text-muted hover:border-accent hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-2xs"
        :disabled="page <= 1"
        @click="goTo(page - 1)"
      >
        ← Prethodna
      </button>

      <span class="font-mono px-2 text-ink font-bold text-xs">{{ page }} / {{ totalPages }}</span>

      <button
        type="button"
        class="rounded-lg border border-line-strong bg-panel px-2.5 py-1 font-semibold text-muted hover:border-accent hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-2xs"
        :disabled="page >= totalPages"
        @click="goTo(page + 1)"
      >
        Sljedeća →
      </button>
    </div>
  </div>
</template>
