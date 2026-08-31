<script setup>
import { useSheetFontSize } from '../composables/useSheetFontSize';

const { fontSize, grow, shrink, reset, canGrow, canShrink, isDefault } = useSheetFontSize();
</script>

<template>
  <div class="flex items-center gap-1.5 select-none">
    <span class="hidden sm:inline text-[11px] font-semibold text-muted">Font:</span>

    <div class="inline-flex items-center rounded-lg border border-line-strong bg-panel p-0.5 shadow-2xs">
      <button
        type="button"
        class="flex size-5.5 items-center justify-center rounded text-xs font-bold text-muted hover:border-accent hover:text-accent disabled:opacity-25 active:scale-95 transition-all cursor-pointer"
        :disabled="!canShrink"
        title="Smanji tekst (A−)"
        aria-label="Smanji tekst"
        @click="shrink"
      >
        <span class="font-bold text-[11px] leading-none">A−</span>
      </button>

      <button
        type="button"
        class="min-w-[2.2rem] px-1 py-0.5 text-center font-mono text-[11px] font-bold text-accent hover:bg-raised rounded transition-colors cursor-pointer"
        :title="isDefault ? 'Podrazumijevana veličina (16px)' : 'Vrati na 16px'"
        @click="reset"
      >
        {{ fontSize }}px
      </button>

      <button
        type="button"
        class="flex size-5.5 items-center justify-center rounded text-xs font-bold text-muted hover:border-accent hover:text-accent disabled:opacity-25 active:scale-95 transition-all cursor-pointer"
        :disabled="!canGrow"
        title="Povećaj tekst (A+)"
        aria-label="Povećaj tekst"
        @click="grow"
      >
        <span class="font-bold text-[11px] leading-none">A+</span>
      </button>
    </div>
  </div>
</template>
