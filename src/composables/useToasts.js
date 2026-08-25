import { reactive, readonly } from 'vue';

/**
 * Transient feedback for actions that would otherwise complete silently.
 *
 * State lives at module scope rather than in a store: any component can raise
 * a toast without wiring, and there is only ever one stack on screen.
 */
const items = reactive([]);

let nextId = 1;

/** Long enough to read a sentence, short enough not to sit in the way. */
const DEFAULTS = {
  success: 4000,
  info: 4000,
  // Failures stay until dismissed. A message explaining what went wrong is
  // useless if it disappears before it has been read and acted on.
  error: 0
};

const MAX_VISIBLE = 4;

function push(type, message, options = {}) {
  const id = nextId++;
  const duration = options.duration ?? DEFAULTS[type] ?? 4000;

  items.push({ id, type, message, detail: options.detail || null });

  // Older messages give way rather than the stack growing without limit.
  while (items.length > MAX_VISIBLE) items.shift();

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id) {
  const index = items.findIndex((t) => t.id === id);
  if (index !== -1) items.splice(index, 1);
}

export function useToasts() {
  return {
    items: readonly(items),
    dismiss,
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options)
  };
}
