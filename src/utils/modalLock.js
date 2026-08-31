/**
 * Coordinates modal dialog scroll locking and body dataset counter.
 *
 * Multiple modals/drawers can be open or nested; a reference counter ensures
 * body scrolling and floating widgets (such as Chat) are cleanly managed.
 */
export function lockModalScroll(on) {
  if (typeof document === 'undefined') return;
  const held = Math.max(0, Number(document.body.dataset.modalCount || 0) + (on ? 1 : -1));
  document.body.dataset.modalCount = String(held);
  document.body.style.overflow = held > 0 ? 'hidden' : '';
}
