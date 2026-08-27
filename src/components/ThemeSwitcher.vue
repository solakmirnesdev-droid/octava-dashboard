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
    class="flex items-center gap-1.5 rounded px-2 py-1 text-muted hover:bg-raised hover:text-accent"
    :title="`Tema: ${label}`"
    :aria-label="`Tema: ${label}`"
    @click="cycle"
  >
    <IconAuto v-if="mode === 'system'" class="text-base" />
    <IconLight v-else-if="mode === 'light'" class="text-base" />
    <IconDark v-else class="text-base" />
  </button>
</template>
