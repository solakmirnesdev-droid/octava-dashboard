import { onMounted, onUnmounted } from 'vue';
import { onSocket } from './useChat';

/**
 * Keeps a screen current without anybody pressing reload.
 *
 * A view says which collections it is showing and how to fetch itself again;
 * when the API announces that one of them moved, it refetches. The event says
 * only *what* changed, never the change, so nothing here has to know how the
 * list is filtered, sorted or paged — the API already does, and asking it again
 * is one request that is always right.
 */

/**
 * AI-TRAP: `onSocket` keeps one handler per event name — it is a Map, not a
 * list — so a second view registering `data:changed` would silently replace the
 * first. This module subscribes once and fans out itself; views never touch
 * onSocket directly.
 */
const subscribers = new Set();
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  onSocket('data:changed', ({ entities }) => {
    for (const notify of subscribers) notify(entities || []);
  });
}

/**
 * The server already coalesces a burst into one frame. This second window
 * catches the other shape: two unrelated collections changing a second apart,
 * which would otherwise be two reloads of the same screen.
 */
const QUIET_MS = 400;

/**
 * @param {string[]} entities  which collections this view shows, e.g. ['songs']
 * @param {() => any} reload   refetch this view; may be async
 */
export function useLiveData(entities, reload) {
  const wanted = new Set(entities);
  let timer = null;
  let running = false;

  async function run() {
    timer = null;
    /*
     * A reload already in flight is not worth queueing behind: it will return
     * data at least as fresh as this request would have asked for. Skipping is
     * what stops a long burst turning into a queue of identical requests.
     */
    if (running) return;
    running = true;
    try {
      await reload();
    } finally {
      running = false;
    }
  }

  function onChanged(changed) {
    if (!changed.some((e) => wanted.has(e))) return;
    clearTimeout(timer);
    timer = setTimeout(run, QUIET_MS);
  }

  onMounted(() => {
    wire();
    subscribers.add(onChanged);
  });

  onUnmounted(() => {
    subscribers.delete(onChanged);
    clearTimeout(timer);
  });
}
