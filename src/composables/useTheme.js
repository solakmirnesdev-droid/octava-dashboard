import { ref, computed } from 'vue';

/**
 * The editor's colour scheme choice.
 *
 * Three states, not two. "System" is a real preference — someone whose laptop
 * turns dark at sunset wants this tool to do the same, and a plain on/off switch
 * throws that away the first time they touch it.
 *
 * AI-NOTE: the CSS does the actual work. `style.css` sets `color-scheme:
 * light dark` on :root, so with no attribute at all the operating system decides
 * and every `light-dark()` token follows. This only pins it when the editor
 * overrides that, which is why "system" *removes* the attribute rather than
 * writing a third value.
 */

export const THEME_KEY = 'octava-theme';
export const THEMES = ['system', 'light', 'dark'];

const read = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    // Private browsing can refuse storage entirely.
    return 'system';
  }
};

// Module-level rather than per-call: this is a single-page client, so one
// instance is the whole application and every switcher must agree with it.
const mode = ref(read());

const LABELS = { system: 'sistemska', light: 'svijetla', dark: 'tamna' };

function apply(value, animate) {
  const el = document.documentElement;

  if (animate) el.classList.add('theme-switching');
  if (value === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', value);

  if (animate) window.setTimeout(() => el.classList.remove('theme-switching'), 200);
}

export function useTheme() {
  const set = (value) => {
    if (!THEMES.includes(value)) return;
    mode.value = value;

    try {
      if (value === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      // The choice still applies to this session; it just will not survive a reload.
    }

    apply(value, true);
  };

  /** Steps through the three states, for a single-button control. */
  const cycle = () => set(THEMES[(THEMES.indexOf(mode.value) + 1) % THEMES.length]);

  return { mode, label: computed(() => LABELS[mode.value]), set, cycle };
}
