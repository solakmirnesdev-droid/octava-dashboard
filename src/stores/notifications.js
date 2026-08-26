import { defineStore } from 'pinia';
import { ref } from 'vue';
import client from '../api/client';

/**
 * The unread badge in the header, and the feed behind it.
 *
 * Polled rather than pushed. A websocket would be the right answer for a busy
 * desk, but this one is two or three people and a review lands every few hours;
 * a socket to keep open, reconnect and authenticate is a lot of machinery for a
 * number that can be a minute stale without anyone noticing.
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

  return { unread, items, total, pages, loading, fetchUnread, fetchPage, markRead, startPolling, stopPolling };
});
