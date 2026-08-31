<script setup>
import { useToasts } from '../composables/useToasts';
import IconSuccess from '~icons/material-symbols/check-circle-rounded';
import IconError from '~icons/material-symbols/error-rounded';
import IconInfo from '~icons/material-symbols/info-rounded';

const ICONS = { success: IconSuccess, error: IconError, info: IconInfo };

const { items, dismiss } = useToasts();

const STYLES = {
  success: 'border-ok/40 bg-panel text-ok',
  error: 'border-danger/40 bg-panel text-danger',
  info: 'border-line-strong bg-panel text-ink'
};

const ICON_COLOUR = {
  success: 'text-ok',
  error: 'text-danger',
  info: 'text-muted'
};
</script>

<template>
  <!-- aria-live so the message is announced rather than only shown; polite so
       it waits for the reader to finish rather than interrupting. -->
  <div
    class="pointer-events-none fixed top-4 sm:top-auto sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 flex w-auto sm:w-full sm:max-w-sm flex-col gap-2.5"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-from-class="-translate-y-3 sm:translate-y-3 opacity-0 scale-90"
      enter-active-class="transition duration-300 cubic-bezier(0.175, 0.885, 0.32, 1.275)"
      leave-to-class="translate-x-6 opacity-0 scale-95"
      leave-active-class="transition duration-200 ease-in"
      move-class="transition duration-250"
    >
      <div
        v-for="toast in items" :key="toast.id"
        class="pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-md"
        :class="STYLES[toast.type]"
      >
        <!-- Glowing vertical accent bar -->
        <span
          class="absolute left-0 top-0 bottom-0 w-1.5"
          :class="{
            'bg-ok': toast.type === 'success',
            'bg-danger': toast.type === 'error',
            'bg-accent': toast.type === 'info'
          }"
        />

        <div class="mt-0.5 shrink-0 relative flex items-center justify-center">
          <span
            class="absolute size-5 rounded-full opacity-40 animate-ping"
            :class="{
              'bg-ok': toast.type === 'success',
              'bg-danger': toast.type === 'error',
              'bg-accent': toast.type === 'info'
            }"
          />
          <component
            :is="ICONS[toast.type]"
            class="relative text-xl"
            :class="ICON_COLOUR[toast.type]"
            aria-hidden="true"
          />
        </div>

        <div class="min-w-0 flex-1 text-xs sm:text-sm">
          <p class="font-bold leading-snug tracking-tight text-ink">{{ toast.message }}</p>
          <p v-if="toast.detail" class="mt-0.5 text-xs text-muted leading-normal">{{ toast.detail }}</p>
        </div>

        <button
          class="-mr-1 shrink-0 text-lg leading-none text-muted hover:text-ink p-1 cursor-pointer transition-colors"
          aria-label="Zatvori"
          @click="dismiss(toast.id)"
        >×</button>
      </div>
    </TransitionGroup>
  </div>
</template>
