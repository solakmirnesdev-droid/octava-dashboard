<script setup>
import { useToasts } from '../composables/useToasts';
import IconSuccess from '~icons/material-symbols/check-circle-rounded';
import IconError from '~icons/material-symbols/error-rounded';
import IconInfo from '~icons/material-symbols/info-rounded';

const ICONS = { success: IconSuccess, error: IconError, info: IconInfo };

const { items, dismiss } = useToasts();

const STYLES = {
  success: 'border-ok/30 bg-ok-soft text-ok',
  error: 'border-accent/40 bg-accent/5 text-accent',
  info: 'border-line-strong bg-panel text-ink'
};

const ICON_COLOUR = {
  success: 'text-ok',
  error: 'text-accent',
  info: 'text-faint'
};
</script>

<template>
  <!-- aria-live so the message is announced rather than only shown; polite so
       it waits for the reader to finish rather than interrupting. -->
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-from-class="translate-y-2 opacity-0"
      enter-active-class="transition duration-200 ease-out"
      leave-to-class="translate-x-4 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      move-class="transition duration-200"
    >
      <div
        v-for="toast in items" :key="toast.id"
        class="pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg"
        :class="STYLES[toast.type]"
      >
        <component
          :is="ICONS[toast.type]"
          class="mt-0.5 shrink-0"
          :class="ICON_COLOUR[toast.type]"
          aria-hidden="true"
        />

        <div class="min-w-0 flex-1 text-sm">
          <p class="font-medium leading-snug">{{ toast.message }}</p>
          <p v-if="toast.detail" class="mt-0.5 text-xs opacity-70">{{ toast.detail }}</p>
        </div>

        <button
          class="-mr-1 shrink-0 text-lg leading-none opacity-40 hover:opacity-100"
          aria-label="Zatvori"
          @click="dismiss(toast.id)"
        >×</button>
      </div>
    </TransitionGroup>
  </div>
</template>
