<script setup>
import { useToasts } from '../composables/useToasts';

const { items, dismiss } = useToasts();

const STYLES = {
  success: 'border-green-600/30 bg-green-50 text-green-900',
  error: 'border-accent/40 bg-accent/5 text-accent',
  info: 'border-black/15 bg-white text-ink'
};

const ICON_COLOUR = {
  success: 'text-green-600',
  error: 'text-accent',
  info: 'text-black/40'
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
        <svg
          v-if="toast.type === 'success'" class="mt-0.5 shrink-0" :class="ICON_COLOUR[toast.type]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg
          v-else-if="toast.type === 'error'" class="mt-0.5 shrink-0" :class="ICON_COLOUR[toast.type]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" stroke-linecap="round" />
        </svg>
        <svg
          v-else class="mt-0.5 shrink-0" :class="ICON_COLOUR[toast.type]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5v.01" stroke-linecap="round" />
        </svg>

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
