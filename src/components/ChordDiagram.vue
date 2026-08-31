<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { findFingering, fingerNumbers, CHORD_INSTRUMENTS } from '../utils/chordEngine';
import { strum, canPlay } from '../utils/chordAudio';
import IconVolumeUp from '~icons/material-symbols/volume-up-rounded';
import IconVolumeUpOutline from '~icons/material-symbols/volume-up-outline-rounded';

const props = defineProps({
  symbol: { type: String, default: '' },
  chord: { type: String, default: '' },
  /** Tight spots can drop the position switcher */
  switchable: { type: Boolean, default: true },
  /** 'guitar', 'bass' or 'ukulele' */
  instrument: { type: String, default: 'guitar' },
  /** Smaller compact layout for companion popovers and tooltips */
  compact: { type: Boolean, default: false },
  /** External counter to trigger resonance and vibration animations */
  playTrigger: { type: Number, default: 0 },
  width: { type: Number, default: null },
  height: { type: Number, default: null }
});

const emit = defineEmits(['play', 'change-variant']);

const rawSymbol = computed(() => (props.chord || props.symbol || '').trim());

const variant = ref(0);
const audible = ref(false);

const CHORD_QUALITY_LABELS = {
  major: 'dur',
  minor: 'mol',
  seventh: 'septakord',
  minor7: 'mol 7',
  major7: 'veliki 7',
  sus4: 'sus4',
  sus2: 'sus2',
  dim: 'umanjeni',
  aug: 'prekomjerni',
  sixth: 'sekstakord',
  minor6: 'mol 6',
  add9: 'add9',
  fifth: 'kvinta',
  minorMajor7: 'mol veliki 7',
  dim7: 'umanjeni 7',
  halfDim: 'polumanjeni',
  augSeventh: 'prekomjerni 7',
  sevenSus4: '7sus4',
  minorAdd9: 'mol add9',
  ninth: 'nonakord',
  major9: 'veliki 9',
  minor9: 'mol 9',
  eleventh: 'undecima',
  minor11: 'mol 11',
  thirteenth: 'tercdecima',
  sevenFlat9: '7 sa b9',
  sevenSharp9: '7 sa #9'
};

function getQualityLabel(key) {
  if (!key) return '';
  return CHORD_QUALITY_LABELS[key] || key;
}

onMounted(() => {
  audible.value = canPlay();
  if (props.playTrigger > 0) {
    triggerRinging();
  }
});

const ringing = ref(false);
const ringCount = ref(0);
let timer = null;

function triggerRinging() {
  ringCount.value++;
  ringing.value = true;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    ringing.value = false;
  }, 900);
}

function play(direction = 'down') {
  if (shape.value) {
    const tuning = (CHORD_INSTRUMENTS[props.instrument] || CHORD_INSTRUMENTS.guitar).tuning;
    try {
      strum(shape.value.frets, { tuning, direction });
    } catch {
      // Audio playback attempt
    }
    emit('play', shape.value);
  }
  triggerRinging();
}

onBeforeUnmount(() => window.clearTimeout(timer));

watch(() => [rawSymbol.value, props.instrument], () => {
  variant.value = 0;
});

watch(() => props.playTrigger, (newVal, oldVal) => {
  if (newVal > 0 && newVal !== oldVal) triggerRinging();
});

defineExpose({ play, triggerRinging });

const shape = computed(() => findFingering(rawSymbol.value, variant.value, props.instrument));
const fingers = computed(() => (shape.value ? fingerNumbers(shape.value) : []));

// Geometry of the drawn grid, in SVG units.
const STRINGS = computed(() => shape.value?.frets?.length || 6);
const FRETS = 5;
const LEFT = computed(() => (props.compact ? 12 : 16));
const TOP = computed(() => (props.compact ? 18 : 24));
const STEP_X = computed(() => (props.compact ? 13 : 18));
const STEP_Y = computed(() => (props.compact ? 14 : 20));

const x = (stringIndex) => LEFT.value + stringIndex * STEP_X.value;
const y = (fret) => TOP.value + (fret - 0.5) * STEP_Y.value;
const svgWidth = computed(() => LEFT.value * 2 + (STRINGS.value - 1) * STEP_X.value);
const svgHeight = computed(() => TOP.value + FRETS * STEP_Y.value + (props.compact ? 8 : 12));

/** Fret numbers are relative to baseFret once the shape sits up the neck. */
const relative = (fret) => fret - (shape.value.baseFret - 1);

const dots = computed(() => {
  if (!shape.value?.frets) return [];
  return shape.value.frets
    .map((fret, i) => ({ fret, i, finger: fingers.value[i] }))
    .filter(({ fret }) => fret !== null && fret > 0)
    // A barre is drawn as a bar, so its strings are not also drawn as dots.
    .filter(({ fret, i }) => {
      const barre = shape.value.barre;
      return !(barre && fret === barre.fret && i >= barre.from && i <= barre.to);
    });
});

/** The "x32010" line printed under the diagram. */
const tab = computed(() => {
  if (!shape.value?.frets) return '';
  const parts = shape.value.frets.map((f) => (f === null ? 'x' : String(f)));
  return parts.some((p) => p.length > 1) ? parts.join(' ') : parts.join('');
});

const step = (by) => {
  if (!shape.value || !shape.value.variants) return;
  variant.value = (variant.value + by + shape.value.variants) % shape.value.variants;
  emit('change-variant', variant.value);
};
</script>

<template>
  <div
    v-if="shape"
    class="relative select-none text-center flex flex-col items-center justify-between rounded-xl border border-line bg-panel p-2.5 shadow-sm cursor-pointer group hover:border-accent/40 transition-colors"
    :title="audible ? `Poslušaj ${shape.name}` : ''"
    @click="play"
  >
    <!-- Top-Right Audio Icon Badge -->
    <span
      v-if="audible"
      class="absolute flex items-center justify-center rounded-full border border-transparent transition-colors duration-150 z-20"
      :class="[
        compact ? 'top-1 right-1 size-5 text-xs' : 'top-1 right-1 size-6 text-sm',
        ringing
          ? 'text-accent'
          : 'text-faint hover:text-accent group-hover:text-accent'
      ]"
      aria-hidden="true"
    >
      <!-- Audio ring ripple on play -->
      <span
        v-if="ringing"
        :key="'ring-' + ringCount"
        class="absolute inset-0 rounded-full bg-accent/30 speaker-ring-pulse pointer-events-none"
      />
      <IconVolumeUp
        v-if="ringing"
        :key="'icon-up-' + ringCount"
        class="speaker-icon-pulse"
        :class="compact ? 'text-xs' : 'text-sm'"
      />
      <IconVolumeUpOutline
        v-else
        :key="'icon-out-' + ringCount"
        :class="compact ? 'text-xs' : 'text-sm'"
      />
    </span>

    <!-- Chord Name & Quality -->
    <div class="mb-0.5 w-full relative z-10" :class="compact ? 'px-2' : 'px-4'">
      <div class="flex items-baseline justify-center gap-1">
        <span
          class="font-mono font-extrabold text-ink tracking-tight transition-colors duration-200"
          :class="[
            compact ? 'text-sm' : 'text-base',
            ringing ? 'text-accent' : ''
          ]"
        >{{ shape.name }}</span>
        <span
          v-if="shape.qualityKey"
          class="font-semibold text-accent truncate"
          :class="compact ? 'text-[10px]' : 'text-xs'"
        >{{ getQualityLabel(shape.qualityKey) }}</span>
      </div>
      <p
        v-if="shape.formula"
        class="mt-0.5 inline-block rounded-md border border-line-soft bg-surface/70 font-mono font-medium text-faint"
        :class="compact ? 'px-1.5 py-0.2 text-[8.5px]' : 'px-2 py-0.5 text-[9.5px]'"
      >
        {{ shape.formula }}
      </p>
    </div>

    <!-- The diagram SVG (Stationary frame, strings vibrate ONLY on click and sound) -->
    <div class="relative mx-auto my-0.5 block rounded-xl p-0.5 z-10">
      <svg
        :key="'svg-' + ringCount"
        :width="width || svgWidth"
        :height="height || svgHeight"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        class="overflow-visible"
      >
        <!-- Open and muted markers sit above the nut. -->
        <template v-for="(fret, i) in shape.frets" :key="'m' + i">
          <!-- Open string circle -->
          <g
            v-if="fret === 0"
            :class="ringing ? 'string-vibrating' : ''"
            :style="{ animationDelay: ringing ? `${i * 30}ms` : '0ms' }"
          >
            <circle
              :cx="x(i)"
              :cy="TOP - (compact ? 5.5 : 8)"
              :r="compact ? 2.8 : 3.8"
              fill="none"
              stroke="currentColor"
              :stroke-width="compact ? 1.2 : 1.5"
              class="transition-colors duration-150"
              :class="ringing ? 'text-accent' : 'text-faint'"
            />
          </g>

          <!-- Muted string cross -->
          <text
            v-else-if="fret === null"
            :x="x(i)"
            :y="TOP - (compact ? 4 : 6.5)"
            text-anchor="middle"
            class="fill-faint font-mono font-bold select-none"
            :style="{ fontSize: compact ? '9px' : '11px' }"
          >×</text>
        </template>

        <!-- Nut is heavy only when the shape starts at the top of the neck. -->
        <line
          :x1="x(0)" :y1="TOP" :x2="x(STRINGS - 1)" :y2="TOP"
          stroke="currentColor" :stroke-width="shape.baseFret === 1 ? (compact ? 2.5 : 3.5) : 1.2" class="text-body"
        />

        <line
          v-for="f in FRETS" :key="'f' + f"
          :x1="x(0)" :y1="TOP + f * STEP_Y" :x2="x(STRINGS - 1)" :y2="TOP + f * STEP_Y"
          stroke="currentColor" stroke-width="1.1" class="text-dim"
        />

        <!-- Vertical Strings (Strings vibrate ONLY on click and sound) -->
        <line
          v-for="s in STRINGS" :key="'s' + s"
          :x1="x(s - 1)" :y1="TOP" :x2="x(s - 1)" :y2="TOP + FRETS * STEP_Y"
          stroke="currentColor" stroke-width="1.1"
          class="transition-colors duration-150"
          :class="[
            ringing && shape.frets[s - 1] !== null
              ? 'string-vibrating text-accent'
              : 'text-dim'
          ]"
          :style="{
            animationDelay: ringing && shape.frets[s - 1] !== null ? `${(s - 1) * 30}ms` : '0ms'
          }"
        />

        <!-- Position marker for shapes that start further down the neck. -->
        <text
          v-if="shape.baseFret > 1"
          :x="x(0) - (compact ? 5 : 7)" :y="y(1) + (compact ? 3 : 4)" text-anchor="end"
          class="fill-muted font-mono font-bold" :style="{ fontSize: compact ? '9px' : '11px' }"
        >{{ shape.baseFret }}</text>

        <!-- Barre Chord Shape (Shakes with Barre String) -->
        <g
          v-if="shape.barre"
          :class="ringing ? 'string-vibrating' : ''"
          :style="{ animationDelay: ringing ? `${shape.barre.from * 30}ms` : '0ms' }"
        >
          <rect
            :x="x(shape.barre.from) - (compact ? 4.5 : 6)"
            :y="y(relative(shape.barre.fret)) - (compact ? 4.5 : 6)"
            :width="(shape.barre.to - shape.barre.from) * STEP_X + (compact ? 9 : 12)"
            :height="compact ? 9 : 12" :rx="compact ? 4.5 : 6"
            class="fill-accent transition-all duration-200"
            :class="ringing ? 'filter drop-shadow-[0_0_6px_var(--color-accent)]' : 'shadow-xs'"
          />
          <text
            :x="x(shape.barre.from)" :y="y(relative(shape.barre.fret)) + (compact ? 2.5 : 3.5)"
            text-anchor="middle" class="fill-on-accent font-mono font-bold" :style="{ fontSize: compact ? '7.5px' : '9px' }"
          >1</text>
        </g>

        <!-- Finger Position Dots (Each dot shakes synchronized to its string) -->
        <g
          v-for="d in dots" :key="'d' + d.i"
          :class="ringing ? 'string-vibrating' : ''"
          :style="{ animationDelay: ringing ? `${d.i * 30}ms` : '0ms' }"
        >
          <circle
            :cx="x(d.i)" :cy="y(relative(d.fret))" :r="compact ? 4.2 : 5.8"
            class="fill-accent transition-all duration-200"
            :class="ringing ? 'filter drop-shadow-[0_0_6px_var(--color-accent)]' : 'shadow-xs'"
          />
          <text
            v-if="d.finger"
            :x="x(d.i)" :y="y(relative(d.fret)) + (compact ? 2.5 : 3.5)" text-anchor="middle"
            class="fill-on-accent font-mono font-bold" :style="{ fontSize: compact ? '7.5px' : '9px' }"
          >{{ d.finger }}</text>
        </g>
      </svg>
    </div>

    <p
      class="font-mono font-bold tracking-widest text-muted/90 relative z-10"
      :class="compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'"
    >{{ tab }}</p>

    <!-- Position Switcher (< 1/8 >) -->
    <div
      v-if="switchable && shape.variants > 1"
      class="flex items-center justify-between rounded-full border border-line-soft bg-surface/80 px-1.5 py-0.5 z-10 shadow-2xs hover:border-accent/40 transition-colors"
      :class="compact ? 'mt-1 w-20' : 'mt-2 w-24 sm:w-28'"
      title=""
      @click.stop
    >
      <button
        type="button"
        title="Prethodni oblik"
        aria-label="Prethodni oblik"
        class="flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold text-muted transition-colors hover:bg-panel hover:text-accent active:bg-raised outline-none cursor-pointer"
        @click.stop.prevent="step(-1)"
      >‹</button>

      <span class="font-mono text-[10px] font-bold tabular-nums text-ink/75 px-1" title="">
        {{ shape.variant + 1 }}/{{ shape.variants }}
      </span>

      <button
        type="button"
        title="Sljedeći oblik"
        aria-label="Sljedeći oblik"
        class="flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold text-muted transition-colors hover:bg-panel hover:text-accent active:bg-raised outline-none cursor-pointer"
        @click.stop.prevent="step(1)"
      >›</button>
    </div>
  </div>

  <div v-else class="inline-flex flex-col items-center rounded-lg border border-line bg-panel p-2.5 shadow-sm text-center select-none">
    <div class="font-mono text-sm font-bold text-accent mb-0.5">
      {{ rawSymbol }}
    </div>
    <div class="py-4 text-[11px] text-faint italic px-2">
      Dijagram nije dostupan
    </div>
  </div>
</template>

<style scoped>
@keyframes speaker-icon-pulse {
  0% { transform: scale(1); }
  20% { transform: scale(1.35); }
  40% { transform: scale(0.95); }
  60% { transform: scale(1.2); }
  80% { transform: scale(0.98); }
  100% { transform: scale(1); }
}

.speaker-icon-pulse {
  animation: speaker-icon-pulse 0.85s cubic-bezier(0.25, 1, 0.5, 1) both;
}

@keyframes speaker-ring-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

.speaker-ring-pulse {
  animation: speaker-ring-pulse 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes string-vibrate {
  0% { transform: translateX(0); }
  12% { transform: translateX(-3px); }
  24% { transform: translateX(3px); }
  36% { transform: translateX(-2.2px); }
  48% { transform: translateX(2.2px); }
  60% { transform: translateX(-1.4px); }
  72% { transform: translateX(1.4px); }
  84% { transform: translateX(-0.7px); }
  92% { transform: translateX(0.7px); }
  100% { transform: translateX(0); }
}

.string-vibrating {
  animation: string-vibrate 0.85s cubic-bezier(0.25, 1, 0.5, 1) both;
}
</style>

