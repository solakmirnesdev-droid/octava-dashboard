<script setup>
import { useSessionGuard } from '../composables/useSessionGuard';
import IconClock from '~icons/material-symbols/schedule-rounded';

/**
 * Warns that the dashboard session is about to end.
 *
 * AI-DECISION: a corner notice, not a modal. A dialog would steal focus and
 * swallow the next keystroke, which is precisely what somebody returning to an
 * unfinished chord sheet must not have happen. It sits above the toasts and
 * leaves the page usable underneath — and any click, key or scroll renews the
 * session and dismisses it on its own.
 */
const { showWarning, countdown, renewing, extend, dismiss } = useSessionGuard();
</script>

<template>
  <Transition
    enter-from-class="translate-y-2 opacity-0"
    enter-active-class="transition duration-200 ease-out"
    leave-to-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-150 ease-in"
  >
    <div
      v-if="showWarning"
      class="fixed bottom-4 left-1/2 z-[60] w-full max-w-sm -translate-x-1/2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start gap-2.5 rounded-lg border border-warn bg-warn-soft px-4 py-3 shadow-lg">
        <IconClock class="mt-0.5 shrink-0 text-warn" />

        <div class="min-w-0 flex-1 text-sm">
          <p class="font-medium leading-snug text-ink">
            Sesija ističe za <span class="font-mono tabular-nums">{{ countdown }}</span>
          </p>
          <p class="mt-0.5 text-xs text-muted">
            Bilo koja radnja je produžava. Snimi rad prije isteka.
          </p>

          <button
            class="mt-2 rounded bg-ink px-3 py-1.5 text-xs font-medium text-on-ink hover:bg-accent disabled:opacity-50"
            :disabled="renewing"
            @click="extend"
          >{{ renewing ? 'Produžavam…' : 'Ostani prijavljen' }}</button>
        </div>

        <button
          class="-mr-1 shrink-0 text-lg leading-none text-muted opacity-40 hover:opacity-100"
          aria-label="Zatvori upozorenje"
          @click="dismiss"
        >&times;</button>
      </div>
    </div>
  </Transition>
</template>
