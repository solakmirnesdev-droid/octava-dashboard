<script setup>
import { useTheme } from '../composables/useTheme';
import IconAuto from '~icons/material-symbols/brightness-auto-outline';
import IconLight from '~icons/material-symbols/light-mode-outline';
import IconDark from '~icons/material-symbols/dark-mode-outline';

const { mode, label, cycle } = useTheme();
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-1.5 rounded-lg p-1.5 text-muted hover:bg-raised hover:text-accent transition-all active:scale-90 cursor-pointer"
    :title="`Tema: ${label}`"
    :aria-label="`Tema: ${label}`"
    @click="cycle"
  >
    <IconAuto v-if="mode === 'system'" class="text-base text-muted transition-transform duration-200" />
    <IconLight v-else-if="mode === 'light'" class="text-base text-warn transition-transform duration-200" />
    <IconDark v-else class="text-base text-accent transition-transform duration-200" />
  </button>
</template>
