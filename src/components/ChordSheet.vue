<script setup>
import { computed } from 'vue';
import { parseSong, transposeContent, normalizeNotation } from '../utils/chordpro';

const props = defineProps({
  content: { type: String, default: '' },
  semitones: { type: Number, default: 0 },
  // Passed so transposition spells the result to match the destination key
  // instead of falling back to sharps for everything.
  originalKey: { type: String, default: '' }
  /*
   * AI-DECISION: deliberately no `capo` prop, though the site's ChordSheet has
   * one. There it drops the shapes so a capoed guitar sounds the stored chords.
   * Here the sheet is a live preview of what the editor is typing, and its job
   * is to show what is actually stored — shifting it would show them something
   * other than what they wrote, which is the one thing an editing surface must
   * never do. Do not add the prop for symmetry.
   */
});

const lines = computed(() =>
  parseSong(normalizeNotation(transposeContent(props.content, props.semitones, props.originalKey)))
);
</script>

<template>
  <div class="font-mono text-[15px] leading-tight">
    <template v-for="(line, i) in lines" :key="i">
      <h3
        v-if="line.type === 'section'"
        class="mt-6 mb-2 font-sans text-xs font-semibold tracking-widest uppercase text-accent"
      >
        {{ line.label }}
      </h3>

      <!-- Instrumental run: spaced evenly, since there are no words to sit over
           and column positions would collide the chords. -->
      <div v-else-if="line.instrumental" class="flex flex-wrap gap-4 min-h-[1.6em] font-semibold text-accent">
        <span v-for="(seg, j) in line.segments.filter((s) => s.chord)" :key="j">{{ seg.chord }}</span>
      </div>

      <!-- Chord and lyric ride in the same inline-block so they stay aligned
           regardless of font metrics or how the line wraps. -->
      <div v-else class="flex flex-wrap min-h-[2.6em]">
        <span v-for="(seg, j) in line.segments" :key="j" class="inline-block">
          <span class="block h-[1.3em] font-semibold text-accent">{{ seg.chord || '' }}</span>
          <span class="block whitespace-pre">{{ seg.text }}</span>
        </span>
      </div>
    </template>
  </div>
</template>
