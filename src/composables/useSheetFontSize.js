import { ref, computed } from 'vue';

export const MIN_FONT_SIZE = 7;
export const MAX_FONT_SIZE = 32;
export const DEFAULT_FONT_SIZE = 16;

const STORAGE_KEY = 'octava_sheet_font_size';

const clamp = (value) =>
  Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value) || DEFAULT_FONT_SIZE));

const fontSize = ref(DEFAULT_FONT_SIZE);
let initialized = false;

export function useSheetFontSize() {
  if (!initialized && typeof window !== 'undefined') {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved) fontSize.value = clamp(saved);
    initialized = true;
  }

  function set(value) {
    fontSize.value = clamp(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(fontSize.value));
    }
  }

  return {
    fontSize,
    grow: () => set(fontSize.value + 1),
    shrink: () => set(fontSize.value - 1),
    reset: () => set(DEFAULT_FONT_SIZE),
    canGrow: computed(() => fontSize.value < MAX_FONT_SIZE),
    canShrink: computed(() => fontSize.value > MIN_FONT_SIZE),
    isDefault: computed(() => fontSize.value === DEFAULT_FONT_SIZE)
  };
}
