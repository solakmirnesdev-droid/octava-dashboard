<script setup>
import { computed } from 'vue';
import { parseSong, transposeContent } from '../utils/chordpro';

const props = defineProps({
  content: { type: String, default: '' },
  semitones: { type: Number, default: 0 },
  targetKey: { type: String, default: '' }
});

const lines = computed(() =>
  parseSong(transposeContent(props.content, props.semitones, props.targetKey))
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
