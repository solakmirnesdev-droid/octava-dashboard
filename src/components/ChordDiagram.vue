<script setup>
import { computed } from 'vue';
import { getChordData } from '../utils/guitarChords';

const props = defineProps({
  chord: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: 110
  },
  height: {
    type: Number,
    default: 125
  }
});

const chordInfo = computed(() => getChordData(props.chord));

// SVG Coordinates config
const startX = 20;
const startY = 24;
const stringSpacing = 14;
const fretSpacing = 18;
const totalFrets = 4;
const totalStrings = 6;

const gridWidth = (totalStrings - 1) * stringSpacing;
const gridHeight = totalFrets * fretSpacing;

const baseFret = computed(() => chordInfo.value?.baseFret || 1);
const isNut = computed(() => baseFret.value === 1);

// Positions for dots and markers
const dots = computed(() => {
  if (!chordInfo.value) return [];
  const res = [];
  const frets = chordInfo.value.frets;
  const base = baseFret.value;

  frets.forEach((fret, stringIdx) => {
    if (fret > 0) {
      const relFret = fret - base + 1;
      if (relFret >= 1 && relFret <= totalFrets) {
        const cx = startX + stringIdx * stringSpacing;
        const cy = startY + (relFret - 0.5) * fretSpacing;
        res.push({ cx, cy, stringIdx, fret });
      }
    }
  });
  return res;
});

const stringMarkers = computed(() => {
  if (!chordInfo.value) return [];
  return chordInfo.value.frets.map((fret, stringIdx) => {
    const cx = startX + stringIdx * stringSpacing;
    const cy = startY - 8;
    return {
      cx,
      cy,
      type: fret === -1 ? 'x' : (fret === 0 ? 'o' : null)
    };
  }).filter((m) => m.type !== null);
});

const barre = computed(() => {
  if (!chordInfo.value?.barre) return null;
  const b = chordInfo.value.barre;
  const relFret = b.fret - baseFret.value + 1;
  if (relFret < 1 || relFret > totalFrets) return null;

  // Convert 1-indexed string numbers to coordinates (string 1 is highest e on right)
  const x1 = startX + (6 - b.to) * stringSpacing;
  const x2 = startX + (6 - b.from) * stringSpacing;
  const y = startY + (relFret - 0.5) * fretSpacing;
  return { x1, x2, y };
});
</script>

<template>
  <div class="inline-flex flex-col items-center rounded-lg border border-line bg-panel p-2.5 shadow-sm text-center select-none">
    <div class="font-mono text-sm font-bold text-accent mb-0.5">
      {{ props.chord }}
    </div>

    <svg
      v-if="chordInfo"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${startX * 2 + gridWidth} ${startY + gridHeight + 12}`"
      class="text-ink"
    >
      <!-- Base Fret Number (if > 1) -->
      <text
        v-if="!isNut"
        :x="startX - 7"
        :y="startY + fretSpacing / 2 + 4"
        class="fill-muted font-mono text-[10px] font-semibold text-right"
        text-anchor="end"
      >
        {{ baseFret }}fr
      </text>

      <!-- Top Nut (thicker line if fret 1) -->
      <line
        :x1="startX"
        :y1="startY"
        :x2="startX + gridWidth"
        :y2="startY"
        class="stroke-ink"
        :stroke-width="isNut ? 3.5 : 1"
        stroke-linecap="round"
      />

      <!-- Fret Lines (Horizontal) -->
      <line
        v-for="f in totalFrets"
        :key="'fret-' + f"
        :x1="startX"
        :y1="startY + f * fretSpacing"
        :x2="startX + gridWidth"
        :y2="startY + f * fretSpacing"
        class="stroke-line-strong"
        stroke-width="1"
      />

      <!-- String Lines (Vertical) -->
      <line
        v-for="s in totalStrings"
        :key="'string-' + s"
        :x1="startX + (s - 1) * stringSpacing"
        :y1="startY"
        :x2="startX + (s - 1) * stringSpacing"
        :y2="startY + gridHeight"
        class="stroke-line-strong"
        stroke-width="1"
      />

      <!-- Barre Chord Indicator -->
      <line
        v-if="barre"
        :x1="barre.x1"
        :y1="barre.y"
        :x2="barre.x2"
        :y2="barre.y"
        class="stroke-accent"
        stroke-width="7"
        stroke-linecap="round"
      />

      <!-- Finger Dots -->
      <circle
        v-for="(dot, idx) in dots"
        :key="'dot-' + idx"
        :cx="dot.cx"
        :cy="dot.cy"
        r="4.5"
        class="fill-accent"
      />

      <!-- Open (O) / Muted (X) Indicators on Top -->
      <g v-for="(marker, idx) in stringMarkers" :key="'marker-' + idx">
        <!-- O marker -->
        <circle
          v-if="marker.type === 'o'"
          :cx="marker.cx"
          :cy="marker.cy"
          r="3"
          fill="none"
          class="stroke-muted"
          stroke-width="1.2"
        />
        <!-- X marker -->
        <g v-else-if="marker.type === 'x'" class="stroke-faint" stroke-width="1.2">
          <line :x1="marker.cx - 2.5" :y1="marker.cy - 2.5" :x2="marker.cx + 2.5" :y2="marker.cy + 2.5" />
          <line :x1="marker.cx + 2.5" :y1="marker.cy - 2.5" :x2="marker.cx - 2.5" :y2="marker.cy + 2.5" />
        </g>
      </g>
    </svg>

    <div v-else class="py-4 text-[11px] text-faint italic px-2">
      Dijagram nije dostupan
    </div>
  </div>
</template>
