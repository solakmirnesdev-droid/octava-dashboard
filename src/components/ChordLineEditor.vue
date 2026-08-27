<script setup>
import { ref, computed, nextTick, onMounted, useTemplateRef } from 'vue';
import { parseLine, insertChord, replaceChord, removeChord } from '../utils/chordline';
import { isChord } from '../utils/chordpro';

const props = defineProps({ content: { type: String, default: '' } });
const emit = defineEmits(['update:content']);

/** A line that is only a bracketed label, e.g. [Refren]. */
function sectionLabel(line) {
  const match = line.trim().match(/^\[([^\]]+)\]$/);
  return match && !isChord(match[1]) ? match[1] : null;
}

const rawLines = computed(() => (props.content || '').split('\n'));

/**
 * Parsed once per content change. Calling parseLine() from the template would
 * re-run it for every line on every render, i.e. on every keystroke.
 */
const parsed = computed(() => rawLines.value.map((line) => {
  const entry = { raw: line, section: sectionLabel(line), ...parseLine(line) };

  // A line with chords but no words is an instrumental run. Column positions
  // are meaningless there — there is nothing to align to — and placing chips
  // by column makes them collide, since a two-character chord is wider than
  // the single space that separates it from the next.
  entry.instrumental = Boolean(entry.chords.length) && !entry.plain.trim();

  return entry;
}));

/**
 * Column-to-pixel mapping only holds because the text is monospace. The width
 * is measured from a rendered sample rather than hard-coded, so it stays right
 * across fonts, zoom levels and browser text-size settings.
 */
const RULER_SAMPLE = '0'.repeat(20);
const charWidth = ref(8.4);
const ruler = useTemplateRef('ruler');

function measure() {
  const width = ruler.value?.getBoundingClientRect().width;
  if (width) charWidth.value = width / RULER_SAMPLE.length;
}

onMounted(() => {
  measure();
  // Re-measure once webfonts land; before that the sample is in a fallback.
  document.fonts?.ready.then(measure);
  window.addEventListener('resize', measure);
});

const editing = ref(null);
const input = useTemplateRef('input');

function updateLine(index, nextLine) {
  const next = [...rawLines.value];
  next[index] = nextLine;
  emit('update:content', next.join('\n'));
}

async function openAt(lineIndex, event) {
  // Ignore clicks that landed on an existing chip; those open edit instead.
  if (event.target.closest('[data-chip]')) return;

  const rect = event.currentTarget.getBoundingClientRect();
  const { plain } = parseLine(rawLines.value[lineIndex]);
  const column = Math.max(0, Math.min(
    plain.length,
    Math.round((event.clientX - rect.left) / charWidth.value)
  ));

  editing.value = { lineIndex, column, chordIndex: null, value: '' };
  await nextTick();
  input.value?.focus();
}

async function openChip(lineIndex, chordIndex, chord, column) {
  editing.value = { lineIndex, column, chordIndex, value: chord };
  await nextTick();
  input.value?.select();
}

function commit() {
  if (!editing.value) return;
  const { lineIndex, column, chordIndex, value } = editing.value;
  const chord = value.trim();
  const source = rawLines.value[lineIndex];

  if (!chord) {
    // Clearing the field on an existing chord removes it.
    if (chordIndex !== null) updateLine(lineIndex, removeChord(source, chordIndex));
  } else if (chordIndex !== null) {
    updateLine(lineIndex, replaceChord(source, chordIndex, chord));
  } else {
    updateLine(lineIndex, insertChord(source, column, chord));
  }

  editing.value = null;
}

function drop() {
  if (!editing.value || editing.value.chordIndex === null) {
    editing.value = null;
    return;
  }
  updateLine(editing.value.lineIndex, removeChord(rawLines.value[editing.value.lineIndex], editing.value.chordIndex));
  editing.value = null;
}
</script>

<template>
  <div class="relative font-mono text-[15px] leading-tight">
    <!-- Off-screen sample used only to measure one character's width. -->
    <span ref="ruler" aria-hidden="true"
          class="pointer-events-none absolute -top-96 left-0 whitespace-pre opacity-0">{{ RULER_SAMPLE }}</span>

    <template v-for="(line, i) in parsed" :key="i">
      <h3 v-if="line.section"
          class="mt-5 mb-1 font-sans text-xs font-semibold uppercase tracking-widest text-accent">
        {{ line.section }}
      </h3>

      <div v-else-if="!line.raw.trim()" class="h-4" />

      <!-- Instrumental run: laid out inline, since there are no words to sit over. -->
      <div v-else-if="line.instrumental" class="mb-1 flex flex-wrap items-center gap-3">
        <button
          v-for="(c, ci) in line.chords" :key="ci"
          data-chip
          type="button"
          class="rounded px-1 text-sm font-semibold text-accent hover:bg-accent/15"
          @click="openChip(i, ci, c.chord, c.column)"
        >{{ c.chord }}</button>
      </div>

      <div v-else class="group relative mb-1">
        <!-- Chord lane. Clicking anywhere along it places a chord at that column. -->
        <div
          class="relative h-6 cursor-text rounded-sm hover:bg-accent/5"
          :title="'Klikni da dodaš akord'"
          @click="openAt(i, $event)"
        >
          <button
            v-for="(c, ci) in line.chords" :key="ci"
            data-chip
            type="button"
            class="absolute top-0 rounded px-1 text-sm font-semibold text-accent hover:bg-accent/15"
            :style="{ left: (c.column * charWidth) + 'px' }"
            @click.stop="openChip(i, ci, c.chord, c.column)"
          >{{ c.chord }}</button>

          <span
            v-if="!line.chords.length"
            class="pointer-events-none absolute left-0 top-0.5 text-xs text-dim opacity-0 transition group-hover:opacity-100"
          >klikni za akord</span>
        </div>

        <div class="whitespace-pre">{{ line.plain }}</div>

        <!-- Input sits at the clicked column so it reads as an in-place edit. -->
        <div
          v-if="editing?.lineIndex === i"
          class="absolute z-10 -mt-px"
          :style="{ left: Math.max(0, editing.column * charWidth - 4) + 'px', top: '0px' }"
        >
          <div class="flex items-center gap-1 rounded border border-accent bg-panel px-1 py-0.5 shadow-lg">
            <input
              ref="input"
              v-model="editing.value"
              class="w-16 bg-transparent text-sm font-semibold text-accent outline-none"
              placeholder="Am"
              @keydown.enter.prevent="commit"
              @keydown.esc.prevent="editing = null"
              @blur="commit"
            />
            <button
              v-if="editing.chordIndex !== null"
              type="button"
              class="text-xs text-dim hover:text-accent"
              title="Ukloni akord"
              @mousedown.prevent="drop"
            >×</button>
          </div>
        </div>
      </div>
    </template>

    <p v-if="!parsed.some((l) => l.raw.trim())" class="text-sm text-faint">
      Zalijepi ili unesi tekst pjesme, pa klikni iznad stiha da dodaš akord.
    </p>
  </div>
</template>
