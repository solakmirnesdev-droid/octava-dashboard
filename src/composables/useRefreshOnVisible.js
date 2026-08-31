import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Re-runs a loader when the page becomes visible again.
 *
 * AI-DECISION: this exists because a list view fetches once, on mount, and then
 * has no way of learning that anything changed. Three ordinary situations all
 * look identical to the person using it — the catalogue is edited by a script
 * or by somebody else, the browser restores the page from its back/forward
 * cache without remounting anything, or the tab simply sat open while work
 * happened elsewhere. In each case the only remedy was a manual reload.
 *
 * AI-TRAP: `visibilitychange` alone does not cover the back button. A page
 * restored from the bfcache fires `pageshow` with `persisted: true` and no
 * lifecycle hook at all — onMounted does not run, so a view that refreshes only
 * there stays stale exactly when somebody has just come back from editing.
 *
 * @param {() => any} reload   the loader to call
 * @param {number} minGapMs    quiet period, so flicking between tabs does not
 *                             turn into a request per switch
 */
export function useRefreshOnVisible(reload, minGapMs = 10000) {
  let last = Date.now();

  const refresh = () => {
    if (Date.now() - last < minGapMs) return;
    last = Date.now();
    reload();
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };

  const onPageShow = (event) => {
    // Only a restore from the bfcache; a normal load already ran onMounted.
    if (event.persisted) refresh();
  };

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onPageShow);
  });

  /** Call after a deliberate local change, so the quiet period does not hide it. */
  const markFresh = () => { last = Date.now(); };

  return { refresh, markFresh };
}
