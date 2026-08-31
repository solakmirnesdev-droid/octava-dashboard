import { defineStore } from 'pinia';
import { ref } from 'vue';
import client from '../api/client';

/**
 * The unread badge in the header, and the feed behind it.
 *
 * Polled AND pushed, in that order of trust.
 *
 * AI-NOTE: this used to be polling only, and the reason written here was that a
 * socket to keep open, reconnect and authenticate was too much machinery for a
 * number allowed to be a minute stale. That was right at the time. It stopped
 * being right when the desk chat brought a socket that is already open, already
 * authenticated and already reconnecting — the cost the argument rested on is
 * now paid by something else.
 *
 * The poll stays as the floor. A push is a nice-to-have that misses anything
 * raised while the tab was closed; the poll is what makes the count correct.
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const unread = ref(0);
  const items = ref([]);
  const total = ref(0);
  const pages = ref(1);
  const loading = ref(false);

  let timer = null;

  async function fetchUnread() {
    try {
      const { data } = await client.get('/notifications/unread-count');
      unread.value = data.unread;
    } catch {
      // A failed poll is not worth a toast: it corrects itself next tick, and
      // the alternative is a stack of errors while the laptop is asleep.
    }
  }

  async function fetchPage({ page = 1, unreadOnly = false } = {}) {
    loading.value = true;
    try {
      const { data } = await client.get('/notifications', {
        params: { page, limit: 25, ...(unreadOnly ? { unread: 'true' } : {}) }
      });
      items.value = data.items;
      total.value = data.total;
      pages.value = data.pages;
      unread.value = data.unread;
    } finally {
      loading.value = false;
    }
  }

  /** Passing no ids marks everything read, which is what the header button does. */
  async function markRead(ids) {
    await client.post('/notifications/read', ids ? { ids } : {});
    if (ids) {
      const set = new Set(ids.map(String));
      items.value = items.value.map((n) => (set.has(String(n._id)) ? { ...n, read: true } : n));
      unread.value = Math.max(unread.value - ids.length, 0);
    } else {
      items.value = items.value.map((n) => ({ ...n, read: true }));
      unread.value = 0;
    }
  }

  function startPolling(intervalMs = 60000) {
    if (timer) return;
    fetchUnread();
    timer = setInterval(fetchUnread, intervalMs);
  }

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  /**
   * A live event from the server.
   *
   * AI-TRAP: guarded against duplicates. The push and the next poll can both
   * carry the same row, and a badge that counts it twice is worse than one that
   * is briefly late.
   */
  function receive(payload) {
    if (!payload?._id) return;
    if (items.value.some((n) => String(n._id) === String(payload._id))) return;

    items.value = [{ ...payload, read: false }, ...items.value];
    total.value += 1;
    unread.value += 1;
  }

  return {
    unread, items, total, pages, loading,
    fetchUnread, fetchPage, markRead, startPolling, stopPolling, receive
  };
});
