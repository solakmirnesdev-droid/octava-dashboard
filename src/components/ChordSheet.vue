<script setup>
import { ref, computed } from 'vue';
import { parseSong, transposeContent, normalizeNotation } from '../utils/chordpro';
import ChordDiagram from './ChordDiagram.vue';
import IconExpand from '~icons/material-symbols/tune-rounded';

const props = defineProps({
  content: { type: String, default: '' },
  semitones: { type: Number, default: 0 },
  originalKey: { type: String, default: '' }
});

const showDiagrams = ref(false);
const activeChordPopover = ref(null);

const lines = computed(() =>
  parseSong(normalizeNotation(transposeContent(props.content, props.semitones, props.originalKey)))
);

const usedChords = computed(() => {
  const seen = new Set();
  for (const line of lines.value) {
    if (line.segments) {
      for (const seg of line.segments) {
        if (seg.chord) seen.add(seg.chord);
      }
    }
  }
  return [...seen];
});

function toggleChordPopover(chord) {
  activeChordPopover.value = activeChordPopover.value === chord ? null : chord;
}
</script>

<template>
  <div class="font-mono text-[15px] leading-tight select-text">
    <!-- Top Chord Gallery Bar with Toggle -->
    <div v-if="usedChords.length" class="mb-4 rounded-xl border border-line bg-panel p-3 shadow-xs">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-sans text-xs font-semibold uppercase tracking-wider text-muted">Akordi u pjesmi:</span>
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="c in usedChords"
              :key="c"
              class="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs font-bold text-accent border border-accent/20 cursor-pointer hover:bg-accent hover:text-on-accent transition"
              @click="toggleChordPopover(c)"
            >
              {{ c }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-line-strong px-2.5 py-1 text-xs font-sans text-muted hover:border-accent hover:text-ink transition"
          @click="showDiagrams = !showDiagrams"
        >
          <IconExpand class="text-xs text-accent" />
          <span>{{ showDiagrams ? 'Sakrij dijagrame' : 'Prikaži dijagrame' }}</span>
        </button>
      </div>

      <!-- Expanded Chord Diagrams Grid -->
      <div
        v-if="showDiagrams"
        class="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      >
        <div v-for="c in usedChords" :key="'diag-' + c" class="flex justify-center">
          <ChordDiagram :chord="c" :width="95" :height="105" />
        </div>
      </div>
    </div>

    <!-- Active Hover/Click Floating Popover Preview -->
    <div
      v-if="activeChordPopover"
      class="mb-4 flex items-center justify-center p-2 rounded-xl border border-accent/40 bg-panel shadow-lg w-fit"
    >
      <div class="relative">
        <button
          type="button"
          class="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-raised text-muted hover:text-ink text-xs font-bold border border-line shadow-xs"
          @click="activeChordPopover = null"
        >×</button>
        <ChordDiagram :chord="activeChordPopover" :width="110" :height="125" />
      </div>
    </div>

    <template v-for="(line, i) in lines" :key="i">
      <h3
        v-if="line.type === 'section'"
        class="mt-6 mb-2 font-sans text-xs font-semibold tracking-widest uppercase text-accent"
      >
        {{ line.label }}
      </h3>

      <!-- Instrumental run: spaced evenly -->
      <div v-else-if="line.instrumental" class="flex flex-wrap gap-4 min-h-[1.6em] font-semibold text-accent">
        <span
          v-for="(seg, j) in line.segments.filter((s) => s.chord)"
          :key="j"
          class="cursor-pointer hover:underline"
          title="Klikni za dijagram akorda"
          @click="toggleChordPopover(seg.chord)"
        >
          {{ seg.chord }}
        </span>
      </div>

      <!-- Chord and lyric line -->
      <div v-else class="flex flex-wrap min-h-[2.6em]">
        <span v-for="(seg, j) in line.segments" :key="j" class="inline-block">
          <span
            class="block h-[1.3em] font-semibold text-accent"
            :class="seg.chord ? 'cursor-pointer hover:underline' : ''"
            :title="seg.chord ? 'Klikni za dijagram akorda' : ''"
            @click="seg.chord && toggleChordPopover(seg.chord)"
          >
            {{ seg.chord || '' }}
          </span>
          <span class="block whitespace-pre">{{ seg.text }}</span>
        </span>
      </div>
    </template>
  </div>
</template>
