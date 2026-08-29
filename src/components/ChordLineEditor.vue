<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { parseLine, insertChord, replaceChord, removeChord } from '../utils/chordline';
import { isChord } from '../utils/chordpro';
import ChordDiagram from './ChordDiagram.vue';

const props = defineProps({ content: { type: String, default: '' } });
const emit = defineEmits(['update:content']);

/** A line that is only a bracketed label, e.g. [Refren]. */
function sectionLabel(line) {
  const match = line.trim().match(/^\[([^\]]+)\]$/);
  return match && !isChord(match[1]) ? match[1] : null;
}

const rawLines = computed(() => (props.content || '').split('\n'));

/**
 * Parsed once per content change.
 */
const parsed = computed(() => rawLines.value.map((line) => {
  const entry = { raw: line, section: sectionLabel(line), ...parseLine(line) };
  entry.instrumental = Boolean(entry.chords.length) && !entry.plain.trim();
  return entry;
}));

/** All unique chords currently used in the song */
const allSongChords = computed(() => {
  const seen = new Set();
  for (const line of parsed.value) {
    for (const c of line.chords) {
      if (c.chord) seen.add(c.chord);
    }
  }
  return [...seen];
});

/**
 * Monospace column-to-pixel measurement.
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
  document.fonts?.ready.then(measure);
  window.addEventListener('resize', measure);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
});

const editing = ref(null);
const input = useTemplateRef('input');

const draggingChord = ref(null);

function startChordDrag(lineIndex, chordIndex, chord, column, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const laneEl = event.currentTarget.closest('[data-chord-lane]');
  const laneRect = laneEl ? laneEl.getBoundingClientRect() : null;
  const { plain } = parseLine(rawLines.value[lineIndex]);

  draggingChord.value = {
    lineIndex,
    chordIndex,
    chord,
    initialColumn: column,
    currentColumn: column,
    startClientX: event.clientX,
    laneRect,
    maxColumn: plain.length,
    hasMoved: false
  };

  const onPointerMove = (e) => {
    if (!draggingChord.value) return;
    const dx = e.clientX - draggingChord.value.startClientX;
    if (Math.abs(dx) > 3) {
      draggingChord.value.hasMoved = true;
    }

    if (draggingChord.value.laneRect) {
      const relX = e.clientX - draggingChord.value.laneRect.left;
      const targetCol = Math.max(0, Math.min(
        draggingChord.value.maxColumn,
        Math.round(relX / charWidth.value)
      ));
      draggingChord.value.currentColumn = targetCol;
    }
  };

  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);

    if (draggingChord.value) {
      const { lineIndex: lIdx, chordIndex: cIdx, chord: ch, initialColumn: initCol, currentColumn: currCol, hasMoved } = draggingChord.value;
      if (hasMoved && currCol !== initCol) {
        const source = rawLines.value[lIdx];
        const withoutOld = removeChord(source, cIdx);
        const updated = insertChord(withoutOld, currCol, ch);
        updateLine(lIdx, updated);
      } else if (!hasMoved) {
        openChip(lIdx, cIdx, ch, initCol);
      }
      draggingChord.value = null;
    }
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function updateLine(index, nextLine) {
  const next = [...rawLines.value];
  next[index] = nextLine;
  emit('update:content', next.join('\n'));
}

async function openAt(lineIndex, event) {
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

function selectQuickChord(chord) {
  if (!editing.value) return;
  editing.value.value = chord;
  commit();
}

function commit() {
  if (!editing.value) return;
  const { lineIndex, column, chordIndex, value } = editing.value;
  const chord = value.trim();
  const source = rawLines.value[lineIndex];

  if (!chord) {
    if (chordIndex !== null) updateLine(lineIndex, removeChord(source, chordIndex));
  } else if (chordIndex !== null) {
    updateLine(lineIndex, replaceChord(source, chordIndex, chord));
  } else {
    updateLine(lineIndex, insertChord(source, column, chord));
  }

  editing.value = null;
}

function drop(lineIndex, chordIndex) {
  const lIdx = lineIndex ?? editing.value?.lineIndex;
  const cIdx = chordIndex ?? editing.value?.chordIndex;
  if (lIdx === undefined || cIdx === null || cIdx === undefined) {
    editing.value = null;
    return;
  }
  updateLine(lIdx, removeChord(rawLines.value[lIdx], cIdx));
  editing.value = null;
}
</script>

<template>
  <div class="relative font-mono text-[14px] leading-tight select-text">
    <!-- Off-screen sample used only to measure one character's width. -->
    <span ref="ruler" aria-hidden="true"
          class="pointer-events-none absolute -top-96 left-0 whitespace-pre opacity-0">{{ RULER_SAMPLE }}</span>

    <template v-for="(line, i) in parsed" :key="i">
      <!-- Section header -->
      <div v-if="line.section" class="mt-4 mb-2 flex items-center gap-2">
        <span class="font-sans text-[11px] font-bold uppercase tracking-wider text-accent rounded bg-accent-soft px-2.5 py-0.5 shadow-xs">
          {{ line.section }}
        </span>
        <div class="h-px flex-1 bg-line-soft" />
      </div>

      <!-- Blank line -->
      <div v-else-if="!line.raw.trim()" class="h-3" />

      <!-- Instrumental run -->
      <div v-else-if="line.instrumental" class="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-raised/40 p-2 border border-line-soft/60">
        <span class="text-[10px] font-sans font-semibold uppercase tracking-wider text-faint">Solo / Akordi:</span>
        <div
          v-for="(c, ci) in line.chords" :key="ci"
          data-chip
          class="group/chip relative inline-flex items-center"
        >
          <button
            type="button"
            class="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent border border-accent/30 shadow-xs hover:bg-accent hover:text-on-accent transition-all cursor-grab active:cursor-grabbing"
            @click="openChip(i, ci, c.chord, c.column)"
          >
            {{ c.chord }}
          </button>
          <button
            type="button"
            class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-white text-[10px] opacity-0 group-hover/chip:opacity-100 transition shadow hover:scale-110"
            @click.stop="drop(i, ci)"
          >×</button>
        </div>
      </div>

      <!-- Regular lyric line with chord lane -->
      <div v-else class="group relative mb-2.5">
        <!-- Chord Lane: Subtle track that illuminates on hover or when chords are present -->
        <div
          data-chord-lane
          class="relative h-6 cursor-text rounded transition-all duration-150"
          :class="[
            line.chords.length > 0
              ? 'border-b border-line-soft/60 bg-transparent'
              : 'border border-dashed border-transparent hover:border-line-strong hover:bg-raised/40 opacity-0 group-hover:opacity-100'
          ]"
          @click="openAt(i, $event)"
        >
          <!-- Drag target vertical guide line -->
          <div
            v-if="draggingChord?.lineIndex === i"
            class="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-accent shadow-[0_0_8px_var(--color-accent)] z-20"
            :style="{ left: (draggingChord.currentColumn * charWidth) + 'px' }"
          />

          <!-- Placed Chord Chips -->
          <div
            v-for="(c, ci) in line.chords" :key="ci"
            data-chip
            class="group/chip absolute top-0"
            :style="{
              left: (draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci
                ? (draggingChord.currentColumn * charWidth)
                : (c.column * charWidth)) + 'px',
              zIndex: draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci ? 30 : 10
            }"
          >
            <button
              type="button"
              class="relative rounded-md px-1.5 py-0.5 text-xs font-bold font-mono transition-all select-none"
              :class="[
                draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci
                  ? 'bg-accent text-on-accent ring-2 ring-accent shadow-xl scale-110 cursor-grabbing'
                  : 'bg-panel text-accent border border-accent/40 shadow-xs hover:bg-accent-soft hover:border-accent cursor-grab active:cursor-grabbing'
              ]"
              @pointerdown="startChordDrag(i, ci, c.chord, c.column, $event)"
            >
              {{ c.chord }}
            </button>

            <!-- Quick Delete Button on Hover -->
            <button
              v-if="!(draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci)"
              type="button"
              class="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold opacity-0 group-hover/chip:opacity-100 transition shadow hover:scale-110 z-20"
              @mousedown.prevent.stop="drop(i, ci)"
            >×</button>
          </div>

          <!-- Empty Lane Hover Hint -->
          <span
            v-if="!line.chords.length && !editing"
            class="pointer-events-none absolute left-2 top-0.5 text-[10px] text-faint flex items-center gap-1 font-sans"
          >
            + klikni za akord
          </span>
        </div>

        <!-- Plain Lyric Text -->
        <div class="whitespace-pre px-0.5 text-ink leading-relaxed font-mono">{{ line.plain }}</div>

        <!-- Inline Chord Input Popover with Quick Suggestions & Diagram Preview -->
        <div
          v-if="editing?.lineIndex === i"
          class="absolute z-40 -mt-1"
          :style="{ left: Math.max(0, editing.column * charWidth - 6) + 'px', top: '-6px' }"
        >
          <div class="flex flex-col gap-2 rounded-xl border-2 border-accent bg-panel p-2.5 shadow-2xl min-w-[11rem]">
            <div class="flex items-center gap-1.5">
              <input
                ref="input"
                v-model="editing.value"
                class="w-20 rounded bg-raised px-2 py-1 text-xs font-bold font-mono text-accent outline-none border border-line focus:border-accent"
                placeholder="Am, G/H"
                @keydown.enter.prevent="commit"
                @keydown.esc.prevent="editing = null"
              />
              <button
                type="button"
                class="rounded bg-accent px-2.5 py-1 text-[11px] font-bold text-on-accent hover:brightness-110 shadow-xs"
                @mousedown.prevent="commit"
              >
                OK
              </button>
              <button
                v-if="editing.chordIndex !== null"
                type="button"
                class="rounded border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] text-danger hover:bg-danger hover:text-white transition"
                title="Ukloni akord"
                @mousedown.prevent="drop()"
              >
                Ukloni
              </button>
            </div>

            <!-- Real-time chord fingering preview inside the edit popover -->
            <div v-if="editing.value.trim()" class="flex justify-center border-t border-line-soft pt-1.5">
              <ChordDiagram :chord="editing.value.trim()" :width="90" :height="100" />
            </div>

            <!-- Quick Chord Suggestions Palette -->
            <div v-if="allSongChords.length" class="flex flex-wrap items-center gap-1 pt-1.5 border-t border-line-soft">
              <span class="text-[9px] text-faint uppercase tracking-wider font-sans block w-full">Predloženi akordi:</span>
              <button
                v-for="sc in allSongChords"
                :key="sc"
                type="button"
                class="rounded bg-accent-soft/70 px-1.5 py-0.5 text-[11px] font-bold text-accent hover:bg-accent hover:text-on-accent transition shadow-xs"
                @mousedown.prevent="selectQuickChord(sc)"
              >
                {{ sc }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <p v-if="!parsed.some((l) => l.raw.trim())" class="text-xs text-faint py-4 text-center">
      Unesite ili zalijepite tekst pjesme, pa kliknite iznad riječi da dodate akord.
    </p>
  </div>
</template>
