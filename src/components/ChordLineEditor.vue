<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { parseLine, insertChord, replaceChord, removeChord, updatePlainText } from '../utils/chordline';
import { isChord } from '../utils/chordpro';
import { useSheetFontSize } from '../composables/useSheetFontSize';
import ChordDiagram from './ChordDiagram.vue';
import IconCheck from '~icons/material-symbols/check-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconClose from '~icons/material-symbols/close-rounded';

const props = defineProps({ content: { type: String, default: '' } });
const emit = defineEmits(['update:content']);

const { fontSize } = useSheetFontSize();

/** A line that is only a bracketed label, e.g. [Refren] or [Strofa 1]. */
function sectionLabel(line) {
  const match = line.trim().match(/^\[([^\]]+)\](?:\s*\(.*?\))?$/);
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
    if (line.section) continue;
    for (const c of line.chords) {
      if (c.chord && isChord(c.chord)) seen.add(c.chord);
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

function handleDocumentPointerDown(e) {
  if (!editing.value) return;
  const popover = document.querySelector('[data-chord-popover]');
  if (popover && popover.contains(e.target)) return;
  if (e.target.closest('[data-chip]')) return;
  if (e.target.closest('[data-chord-bank]')) return;
  commit();
}

function handleGlobalKeydown(e) {
  if (e.key === 'Escape' && editing.value) {
    editing.value = null;
  }
}

onMounted(() => {
  measure();
  document.fonts?.ready.then(measure);
  window.addEventListener('resize', measure);
  window.addEventListener('pointerdown', handleDocumentPointerDown);
  window.addEventListener('keydown', handleGlobalKeydown);
});

watch(fontSize, async () => {
  await nextTick();
  measure();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  window.removeEventListener('pointerdown', handleDocumentPointerDown);
  window.removeEventListener('keydown', handleGlobalKeydown);
});

const editing = ref(null);
const input = useTemplateRef('input');
const activeStampChord = ref(null);

const draggingChord = ref(null);

function selectStampChord(chord) {
  if (activeStampChord.value === chord) {
    activeStampChord.value = null;
  } else {
    activeStampChord.value = chord;
    editing.value = null;
  }
}

function startChordDrag(lineIndex, chordIndex, chord, column, event) {
  if (event.button !== 0 && event.pointerType === 'mouse') return;
  event.preventDefault();
  event.stopPropagation();

  const laneEl = event.currentTarget.closest('[data-chord-lane]');
  const laneRect = laneEl ? laneEl.getBoundingClientRect() : null;
  const { plain } = parseLine(rawLines.value[lineIndex] || '');
  const maxCol = Math.max(plain.length + 100, Math.round((laneRect?.width || 0) / (charWidth.value || 8.4)));

  draggingChord.value = {
    lineIndex,
    chordIndex,
    chord,
    initialColumn: column,
    currentColumn: column,
    startClientX: event.clientX,
    laneRect,
    maxColumn: maxCol,
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
      if (draggingChord.value.currentColumn !== targetCol) {
        draggingChord.value.currentColumn = targetCol;
      }
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
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
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

function onPlainInput(index, newPlain) {
  const source = rawLines.value[index] || '';
  const updated = updatePlainText(source, newPlain);
  updateLine(index, updated);
}

function onSectionInput(index, newSection) {
  const val = newSection.trim();
  updateLine(index, val ? `[${val}]` : '');
}

function insertLineAfter(index, content = '') {
  const next = [...rawLines.value];
  next.splice(index + 1, 0, content);
  emit('update:content', next.join('\n'));
  focusLineInput(index + 1);
}

function deleteLine(index) {
  if (rawLines.value.length <= 1) {
    emit('update:content', '');
    return;
  }
  const next = [...rawLines.value];
  next.splice(index, 1);
  emit('update:content', next.join('\n'));
  focusLineInput(Math.max(0, index - 1));
}

function focusLineInput(index) {
  nextTick(() => {
    const el = document.querySelector(`[data-line-input="${index}"]`);
    el?.focus();
  });
}

function onLyricKeydown(index, event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    insertLineAfter(index, '');
  } else if (event.key === 'Backspace' && event.target.value === '' && !parsed.value[index]?.chords.length) {
    event.preventDefault();
    deleteLine(index);
  } else if (event.key === 'ArrowUp' && index > 0) {
    event.preventDefault();
    focusLineInput(index - 1);
  } else if (event.key === 'ArrowDown' && index < rawLines.value.length - 1) {
    event.preventDefault();
    focusLineInput(index + 1);
  }
}

const COMMON_CHORDS = ['Am', 'C', 'Dm', 'Em', 'F', 'G', 'E', 'A', 'D', 'H', 'Hm', 'F#m', 'Gm'];

const quickPaletteChords = computed(() => {
  const list = [...allSongChords.value];
  for (const c of COMMON_CHORDS) {
    if (!list.includes(c)) list.push(c);
  }
  return list.slice(0, 14);
});

async function openAt(lineIndex, event) {
  if (event.target.closest('[data-chip]')) return;

  const rect = event.currentTarget.getBoundingClientRect();
  const { plain } = parseLine(rawLines.value[lineIndex] || '');
  const maxCol = Math.max(plain.length + 100, Math.round(rect.width / (charWidth.value || 8.4)));
  const column = Math.max(0, Math.min(
    maxCol,
    Math.round((event.clientX - rect.left) / charWidth.value)
  ));

  if (activeStampChord.value) {
    const source = rawLines.value[lineIndex] || '';
    updateLine(lineIndex, insertChord(source, column, activeStampChord.value));
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    return;
  }

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
  const source = rawLines.value[lineIndex] || '';

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

function getChordChipStyle(lineIndex, ci, c, allChords) {
  if (draggingChord.value?.lineIndex === lineIndex && draggingChord.value?.chordIndex === ci) {
    return {
      left: (draggingChord.value.currentColumn * charWidth.value) + 'px',
      zIndex: 35
    };
  }

  const naturalLeft = c.column * charWidth.value;
  let renderLeft = naturalLeft;

  // Anti-collision staggering: ensure no two chord chips overlap horizontally
  if (ci > 0 && allChords) {
    const prevChord = allChords[ci - 1];
    const prevLeft = prevChord._renderLeft ?? (prevChord.column * charWidth.value);
    const minChipWidth = Math.max(charWidth.value * 2, (String(prevChord.chord || '').length * charWidth.value * 1.2) + (fontSize.value * 0.6));
    const gap = Math.max(2, fontSize.value * 0.15);
    if (renderLeft < prevLeft + minChipWidth + gap) {
      renderLeft = prevLeft + minChipWidth + gap;
    }
  }
  c._renderLeft = renderLeft;

  return {
    left: renderLeft + 'px',
    zIndex: 10 + ci
  };
}
</script>

<template>
  <div
    class="relative font-mono leading-relaxed select-text text-ink font-medium tracking-normal"
    :style="{ fontSize: fontSize + 'px' }"
  >
    <!-- Off-screen sample used only to measure one character's width. -->
    <span ref="ruler" aria-hidden="true"
          class="pointer-events-none absolute -top-96 left-0 whitespace-pre opacity-0 font-mono"
          :style="{ fontSize: fontSize + 'px' }">{{ RULER_SAMPLE }}</span>

    <!-- Sticky Quick Chord Bank & Active Stamp Placer Bar -->
    <div
      data-chord-bank
      class="sticky top-0 z-30 -mt-1 mb-4 rounded-2xl border border-line-strong bg-panel/95 backdrop-blur-md p-3 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <span class="text-[10px] font-sans font-bold uppercase tracking-wider text-muted mr-0.5 shrink-0">
            {{ activeStampChord ? '🎯 Štambilj:' : 'Akordi:' }}
          </span>
          <button
            v-for="c in quickPaletteChords"
            :key="c"
            type="button"
            class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-mono font-black transition shadow-2xs cursor-pointer active:scale-95"
            :class="activeStampChord === c
              ? 'bg-accent text-on-accent ring-2 ring-accent ring-offset-1 font-black scale-105'
              : 'bg-raised text-accent border border-line hover:border-accent hover:bg-accent-soft'"
            :title="activeStampChord === c ? 'Klikni da deaktiviraš' : 'Klikni da aktiviraš brzi unos dodirom'"
            @click="selectStampChord(c)"
          >
            {{ c }}
          </button>
        </div>

        <div v-if="activeStampChord" class="flex items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-sans text-accent font-bold animate-pulse">Dodirni stih za unos</span>
          <button
            type="button"
            class="rounded-lg border border-line-strong bg-panel px-2.5 py-1 text-[11px] font-sans font-semibold text-muted hover:text-ink cursor-pointer shadow-2xs"
            @click="activeStampChord = null"
          >
            Isključi
          </button>
        </div>
      </div>
    </div>

    <template v-for="(line, i) in parsed" :key="i">
      <!-- Section header (e.g. [Refren], [Strofa 1], [Uvod]) -->
      <div v-if="line.section" class="mt-[1.5em] mb-[0.6em] flex items-center gap-[0.5em]">
        <div class="inline-flex items-center gap-[0.3em] rounded-[0.4em] bg-accent-soft px-[0.6em] py-[0.2em] border border-accent/25 shadow-2xs">
          <input
            :value="line.section"
            type="text"
            spellcheck="false"
            :data-line-input="i"
            class="font-sans text-[0.85em] font-black tracking-wider uppercase text-accent bg-transparent outline-none w-auto max-w-[16rem] transition-colors"
            placeholder="OZNAKA SEKCIJE..."
            @input="onSectionInput(i, $event.target.value)"
            @keydown="onLyricKeydown(i, $event)"
          />
        </div>
        <div class="h-px flex-1 bg-line-soft" />
      </div>

      <!-- Blank line / Stanza break -->
      <div v-else-if="!line.raw.trim()" class="relative my-[0.6em] flex items-center gap-[0.4em]">
        <input
          type="text"
          spellcheck="false"
          :data-line-input="i"
          placeholder="␣ prazan red (razmak između strofa)"
          class="w-full h-[1.4em] bg-transparent px-[0.2em] text-ink font-mono text-[1em] outline-none border-b border-dashed border-line-soft/40 hover:border-accent/40 focus:border-accent rounded transition-colors placeholder:text-faint/30 placeholder:font-sans placeholder:text-[0.75em]"
          @input="onPlainInput(i, $event.target.value)"
          @keydown="onLyricKeydown(i, $event)"
        />
      </div>

      <!-- Instrumental run (Solo / Chords without lyrics) -->
      <div v-else-if="line.instrumental" class="my-[0.5em] flex flex-wrap items-center gap-[0.4em] rounded-[0.5em] bg-surface/70 border border-line-soft px-[0.5em] py-[0.3em] shadow-2xs">
        <span class="text-[0.75em] font-sans font-bold uppercase tracking-wider text-faint px-[0.2em]">Solo:</span>
        <div
          v-for="(c, ci) in line.chords" :key="ci"
          data-chip
          class="relative inline-flex items-center"
        >
          <button
            type="button"
            class="rounded-[0.35em] px-[0.4em] py-[0.1em] text-[1.2em] font-black font-mono text-accent bg-panel border border-accent/30 shadow-2xs hover:bg-accent hover:text-on-accent transition-all cursor-grab active:cursor-grabbing leading-none"
            @click="openChip(i, ci, c.chord, c.column)"
          >
            {{ c.chord }}
          </button>
        </div>

        <button
          type="button"
          class="rounded-[0.35em] border border-dashed border-line-strong px-[0.4em] py-[0.1em] text-[0.8em] text-muted hover:border-accent hover:text-accent transition ml-auto font-sans font-semibold cursor-pointer shadow-2xs leading-none"
          title="Dodaj akord u solo"
          @click="openAt(i, $event)"
        >
          + Akord
        </button>
      </div>

      <!-- Regular lyric line with distinct chord track & precision alignment -->
      <div v-else class="group/line relative mb-[0.6em]">
        <!-- Chord Lane: Distinct sliding rail track positioned right above the text -->
        <div
          data-chord-lane
          class="relative min-h-[1.75em] h-[1.75em] flex items-center cursor-text transition-all rounded-[0.4em] select-none bg-surface/70 border border-line-strong hover:border-accent/60 hover:bg-surface px-[0.2em] shadow-2xs before:pointer-events-none before:absolute before:inset-x-[0.3em] before:top-1/2 before:h-px before:bg-line-strong/40"
          title="Klikni ili prevuci akord po traci"
          @click="openAt(i, $event)"
        >
          <!-- Drag target vertical laser hairline reaching down through the lyrics -->
          <div
            v-if="draggingChord?.lineIndex === i"
            class="pointer-events-none absolute top-0 -bottom-[1.2em] w-0.5 bg-accent shadow-[0_0_8px_var(--color-accent)] z-30"
            :style="{ left: (draggingChord.currentColumn * charWidth) + 'px' }"
          />

          <!-- Placed Chord Chips with Anti-Collision Staggering -->
          <div
            v-for="(c, ci) in line.chords" :key="ci"
            data-chip
            class="absolute top-1/2 -translate-y-1/2"
            :style="getChordChipStyle(i, ci, c, line.chords)"
          >
            <!-- Precision letter preview tooltip while dragging -->
            <div
              v-if="draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci"
              class="pointer-events-none absolute -top-[1.6em] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-[0.4em] py-[0.1em] text-[0.75em] font-mono font-bold text-on-ink shadow-md z-40 border border-line flex items-center gap-[0.2em]"
            >
              <span>{{ draggingChord.chord }}</span>
              <span class="text-accent">→</span>
              <span class="underline">{{ (line.plain[draggingChord.currentColumn] === ' ' ? '␣ (razmak)' : line.plain[draggingChord.currentColumn]) || 'kraj' }}</span>
              <span class="text-[0.75em] text-faint">({{ draggingChord.currentColumn }})</span>
            </div>

            <button
              type="button"
              class="group/btn relative inline-flex items-center gap-[0.15em] rounded-[0.35em] px-[0.35em] py-[0.1em] text-[1.2em] font-black font-mono leading-none tracking-tight transition-all select-none shadow-xs"
              :class="[
                draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci
                  ? 'bg-accent text-on-accent ring-2 ring-accent shadow-xl scale-105 cursor-grabbing'
                  : 'bg-panel text-accent border border-accent/40 hover:bg-accent hover:text-on-accent hover:border-accent cursor-grab active:cursor-grabbing'
              ]"
              @pointerdown="startChordDrag(i, ci, c.chord, c.column, $event)"
            >
              <!-- Grip handle dots icon -->
              <span class="text-[0.65em] opacity-40 group-hover/btn:opacity-90 transition-opacity select-none -ml-[0.1em]">⋮</span>
              <span>{{ c.chord }}</span>

              <!-- Precision alignment pointer arrow pointing down to exact syllable -->
              <span
                class="pointer-events-none absolute -bottom-[0.35em] left-1/2 -translate-x-1/2 size-0 border-x-[0.2em] border-x-transparent border-t-[0.35em]"
                :class="draggingChord?.lineIndex === i && draggingChord?.chordIndex === ci ? 'border-t-accent' : 'border-t-accent/60 group-hover/btn:border-t-accent'"
              />
            </button>
          </div>
        </div>

        <!-- Editable Lyric Text Line -->
        <div class="relative flex items-center mt-[0.15em]">
          <input
            :value="line.plain"
            type="text"
            spellcheck="false"
            :data-line-input="i"
            placeholder="Unesite stih..."
            class="w-full bg-transparent px-[0.2em] py-[0.1em] text-ink font-semibold font-mono text-[1em] leading-normal outline-none border-b border-transparent focus:border-accent focus:bg-surface/50 hover:border-line-soft rounded transition-all placeholder:text-faint/40 placeholder:font-sans placeholder:text-[0.75em]"
            @input="onPlainInput(i, $event.target.value)"
            @keydown="onLyricKeydown(i, $event)"
          />
        </div>

        <!-- Modern Floating Chord Popover -->
        <div
          v-if="editing?.lineIndex === i"
          data-chord-popover
          class="absolute z-50 -top-12 select-none"
          :style="{ left: Math.max(0, (editing.column * charWidth) - 8) + 'px' }"
          @click.stop
          @pointerdown.stop
          @mousedown.stop
        >
          <!-- Floating Capsule Card -->
          <div class="relative flex flex-col gap-1.5 rounded-xl border border-line-strong bg-panel/95 backdrop-blur-xl p-1.5 shadow-2xl ring-1 ring-black/20">
            <!-- Top Input Row -->
            <div class="flex items-center gap-1.5">
              <input
                ref="input"
                v-model="editing.value"
                class="w-20 rounded-lg bg-surface px-2 py-0.5 text-xs font-black font-mono text-accent uppercase tracking-wider outline-none border border-line focus:border-accent focus:ring-1 focus:ring-accent transition shadow-2xs placeholder:text-faint/40 placeholder:normal-case"
                placeholder="npr. Am"
                @keydown.enter.prevent="commit"
                @keydown.esc.prevent="editing = null"
              />

              <button
                type="button"
                class="flex size-6.5 items-center justify-center rounded-lg bg-accent text-on-accent hover:brightness-110 active:scale-95 transition shadow-xs cursor-pointer font-bold shrink-0"
                title="Sačuvaj akord (Enter)"
                aria-label="Sačuvaj akord"
                @mousedown.prevent="commit"
              >
                <IconCheck class="text-xs" />
              </button>

              <button
                v-if="editing.chordIndex !== null"
                type="button"
                class="flex size-6.5 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:border-danger hover:bg-danger/10 hover:text-danger active:scale-95 transition cursor-pointer shrink-0"
                title="Ukloni akord sa ovog mjesta"
                aria-label="Ukloni akord"
                @mousedown.prevent="drop()"
              >
                <IconDelete class="text-xs" />
              </button>

              <button
                type="button"
                class="flex size-6.5 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raised active:scale-95 transition cursor-pointer shrink-0"
                title="Zatvori (Esc)"
                aria-label="Zatvori"
                @mousedown.prevent="editing = null"
              >
                <IconClose class="text-xs" />
              </button>
            </div>

            <!-- Quick Chord Suggestions from Song Context -->
            <div v-if="allSongChords.length" class="flex flex-wrap items-center gap-1 max-w-[13.5rem] pt-1 border-t border-line-soft">
              <button
                v-for="sc in allSongChords"
                :key="sc"
                type="button"
                class="rounded-md bg-raised border border-line px-1.5 py-0.5 text-[11px] font-mono font-bold text-accent hover:bg-accent hover:text-on-accent hover:border-accent active:scale-95 transition shadow-2xs cursor-pointer"
                :title="'Izaberi ' + sc"
                @mousedown.prevent="selectQuickChord(sc)"
              >
                {{ sc }}
              </button>
            </div>

            <!-- Pointer Arrow Caret pointing down to the exact syllable -->
            <div class="pointer-events-none absolute -bottom-1.5 left-4 size-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-line-strong" />
            <div class="pointer-events-none absolute -bottom-1 left-4 size-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-panel" />
          </div>
        </div>
      </div>
    </template>

    <!-- Bottom Quick Add Actions Bar -->
    <div class="mt-4 pt-3 border-t border-line-soft/80 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition flex items-center gap-1 font-sans font-medium cursor-pointer shadow-2xs"
        @click="insertLineAfter(rawLines.length - 1, '')"
      >
        + Novi stih
      </button>
      <button
        type="button"
        class="rounded border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition flex items-center gap-1 font-sans font-medium cursor-pointer shadow-2xs"
        @click="insertLineAfter(rawLines.length - 1, '[Refren]')"
      >
        + [Refren]
      </button>
      <button
        type="button"
        class="rounded border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition flex items-center gap-1 font-sans font-medium cursor-pointer shadow-2xs"
        @click="insertLineAfter(rawLines.length - 1, '[Strofa]')"
      >
        + [Strofa]
      </button>
      <button
        type="button"
        class="rounded border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition flex items-center gap-1 font-sans font-medium cursor-pointer shadow-2xs"
        @click="insertLineAfter(rawLines.length - 1, '[Solo]')"
      >
        + [Solo]
      </button>
    </div>
  </div>
</template>

