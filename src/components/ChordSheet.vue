<script setup>
import { ref, computed } from 'vue';
import { parseSong, transposeContent, normalizeNotation } from '../utils/chordpro';
import { playChord } from '../utils/playChord';
import { useSheetFontSize } from '../composables/useSheetFontSize';
import ChordDiagram from './ChordDiagram.vue';
import IconExpand from '~icons/material-symbols/tune-rounded';

const props = defineProps({
  content: { type: String, default: '' },
  semitones: { type: Number, default: 0 },
  originalKey: { type: String, default: '' }
});

const { fontSize } = useSheetFontSize();
const showDiagrams = ref(false);

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
</script>

<template>
  <div
    class="font-mono leading-relaxed select-text tracking-normal text-ink font-medium"
    :style="{ fontSize: fontSize + 'px' }"
  >
    <!-- Top Chord Gallery Bar with Toggle -->
    <div v-if="usedChords.length" class="mb-5 rounded-2xl border border-line bg-surface/60 p-3 shadow-2xs">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-sans text-xs font-bold uppercase tracking-wider text-muted">Akordi:</span>
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="c in usedChords"
              :key="c"
              class="rounded-lg bg-panel border border-accent/25 px-2.5 py-1 font-mono text-xs font-black text-accent cursor-pointer hover:bg-accent hover:text-on-accent transition shadow-2xs"
              title="Klikni da čuješ akord"
              @click="playChord(c)"
            >
              {{ c }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs font-sans font-semibold text-muted hover:border-accent hover:text-ink transition shadow-2xs cursor-pointer"
          @click="showDiagrams = !showDiagrams"
        >
          <IconExpand class="text-xs text-accent" />
          <span>{{ showDiagrams ? 'Sakrij dijagrame' : 'Prikaži dijagrame' }}</span>
        </button>
      </div>

      <!-- Expanded Chord Diagrams Grid -->
      <div
        v-if="showDiagrams"
        class="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-line-soft pt-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      >
        <div v-for="c in usedChords" :key="'diag-' + c" class="flex justify-center">
          <ChordDiagram :chord="c" :compact="true" />
        </div>
      </div>
    </div>

    <template v-for="(line, i) in lines" :key="i">
      <!-- Section Header with distinct Accent Badge and Divider -->
      <div
        v-if="line.type === 'section'"
        class="mt-[1.5em] mb-[0.6em] flex items-center gap-[0.5em]"
      >
        <span class="inline-flex items-center gap-[0.3em] rounded-[0.4em] bg-accent-soft px-[0.6em] py-[0.2em] font-sans text-[0.85em] font-black tracking-wider uppercase text-accent border border-accent/25 shadow-2xs">
          <span>{{ line.label }}</span>
          <span v-if="line.note" class="font-mono normal-case tracking-normal text-accent/80 font-bold">
            {{ line.note }}
          </span>
        </span>
        <div class="h-px flex-1 bg-line-soft" />
      </div>

      <!-- Instrumental / Solo run: spaced cleanly with interactive audio chips -->
      <div
        v-else-if="line.instrumental"
        class="my-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface/70 border border-line-soft px-3 py-2 shadow-2xs"
      >
        <span class="text-[0.75em] font-sans font-bold uppercase tracking-wider text-faint px-1">Solo:</span>
        <span
          v-for="(seg, j) in line.segments.filter((s) => s.chord)"
          :key="j"
          class="rounded-lg bg-panel border border-accent/30 px-2.5 py-1 text-[1.2em] font-black font-mono text-accent hover:bg-accent hover:text-on-accent transition shadow-2xs cursor-pointer select-none"
          title="Klikni da čuješ akord"
          @click="playChord(seg.chord)"
        >
          {{ seg.chord }}
        </span>
      </div>

      <!-- Chord and lyric line with High Contrast Typography -->
      <div v-else class="flex flex-wrap min-h-[3em] my-1 items-end">
        <span v-for="(seg, j) in line.segments" :key="j" class="inline-block">
          <span
            class="block text-[1.2em] font-black text-accent font-mono leading-none tracking-tight select-none mb-1"
            :class="seg.chord ? 'cursor-pointer hover:text-ink hover:underline transition-colors' : ''"
            :title="seg.chord ? 'Klikni da čuješ akord' : ''"
            @click="seg.chord && playChord(seg.chord)"
          >
            {{ seg.chord || '' }}
          </span>
          <span class="block whitespace-pre text-ink font-semibold tracking-normal text-[1em] leading-normal">{{ seg.text }}</span>
        </span>
      </div>
    </template>
  </div>
</template>

