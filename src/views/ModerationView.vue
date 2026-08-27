<script setup>
import { onMounted, ref } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import IconHide from '~icons/material-symbols/visibility-off-outline-rounded';
import IconShow from '~icons/material-symbols/visibility-outline-rounded';

/**
 * Reviews and their replies, for hiding and restoring.
 *
 * Both kinds are moderated identically, so the table is one component driven by
 * which endpoint is active rather than two that drift apart.
 */
const toasts = useToasts();

const tab = ref('reviews');          // reviews | comments
const status = ref('published');     // published | hidden | removed | all
const items = ref([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const loading = ref(false);

/** The row being hidden, and the reason typed for it. Null when no dialog. */
const hiding = ref(null);
const reason = ref('');

const STATUSES = [
  { value: 'published', label: 'Objavljeno' },
  { value: 'hidden',    label: 'Sakriveno' },
  { value: 'removed',   label: 'Autor uklonio' },
  { value: 'all',       label: 'Sve' }
];

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get(`/moderation/${tab.value}`, {
      params: { status: status.value, page: page.value, limit: 25 }
    });
    items.value = data.items;
    pages.value = data.pages;
    total.value = data.total;
  } catch {
    toasts.error('Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

function switchTo(next) {
  tab.value = next;
  page.value = 1;
  load();
}

function setStatus(next) {
  status.value = next;
  page.value = 1;
  load();
}

function askHide(row) {
  hiding.value = row;
  reason.value = '';
}

async function confirmHide() {
  if (!reason.value.trim()) return;
  try {
    await client.patch(`/moderation/${tab.value}/${hiding.value._id}`, {
      hidden: true, reason: reason.value.trim()
    });
    toasts.success('Sakriveno.');
    hiding.value = null;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  }
}

async function restore(row) {
  try {
    await client.patch(`/moderation/${tab.value}/${row._id}`, { hidden: false });
    toasts.success('Vraćeno.');
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  }
}

const when = (iso) => new Date(iso).toLocaleDateString('bs');

onMounted(load);
</script>

<template>
  <section>
    <header class="mb-5 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Moderacija</h1>

      <div class="flex overflow-hidden rounded border border-line-strong text-sm">
        <button
          v-for="t in [{ k: 'reviews', l: 'Recenzije' }, { k: 'comments', l: 'Komentari' }]" :key="t.k"
          class="px-3 py-1.5"
          :class="tab === t.k ? 'bg-accent text-on-accent' : 'bg-panel hover:text-accent'"
          @click="switchTo(t.k)"
        >{{ t.l }}</button>
      </div>

      <div class="ml-auto flex flex-wrap gap-1.5 text-sm">
        <button
          v-for="s in STATUSES" :key="s.value"
          class="rounded border px-2.5 py-1"
          :class="status === s.value
            ? 'border-accent bg-accent text-on-accent'
            : 'border-line-strong bg-panel hover:border-accent hover:text-accent'"
          @click="setStatus(s.value)"
        >{{ s.label }}</button>
      </div>
    </header>

    <p class="mb-3 text-sm text-faint">{{ total }} zapisa</p>

    <p v-if="loading" class="text-sm text-faint">Učitavanje…</p>

    <p v-else-if="!items.length" class="rounded border border-line bg-panel px-4 py-8 text-center text-sm text-faint">
      Nema zapisa za ovaj filter.
    </p>

    <ul v-else class="space-y-2">
      <li v-for="row in items" :key="row._id" class="rounded border border-line bg-panel px-4 py-3">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span class="font-medium">{{ row.user?.username || 'nepoznat' }}</span>
          <span class="text-faint">{{ row.user?.email }}</span>
          <span v-if="row.song" class="text-muted">· {{ row.song.title }}</span>
          <span class="text-xs text-faint">· {{ when(row.createdAt) }}</span>

          <span
            v-if="row.status !== 'published'"
            class="rounded bg-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted"
          >{{ row.status === 'hidden' ? 'sakriveno' : 'uklonio autor' }}</span>
        </div>

        <p class="mt-2 whitespace-pre-wrap text-sm text-ink">{{ row.body }}</p>

        <p v-if="row.status === 'hidden'" class="mt-2 text-xs text-faint">
          Sakrio {{ row.moderatedBy?.name || '—' }}: {{ row.moderationReason }}
        </p>

        <div class="mt-3 flex gap-2">
          <button
            v-if="row.status === 'published'"
            class="flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1 text-sm hover:border-danger hover:text-danger"
            @click="askHide(row)"
          ><IconHide /> Sakrij</button>

          <button
            v-else-if="row.status === 'hidden'"
            class="flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1 text-sm hover:border-accent hover:text-accent"
            @click="restore(row)"
          ><IconShow /> Vrati</button>

          <!-- 'removed' offers nothing: restoring what an author took down is
               not a moderator's call. -->
        </div>
      </li>
    </ul>

    <nav v-if="pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
      <button class="rounded border border-line-strong px-3 py-1.5 disabled:opacity-35"
              :disabled="page <= 1" @click="page--; load()">Prethodna</button>
      <span class="text-faint">{{ page }} / {{ pages }}</span>
      <button class="rounded border border-line-strong px-3 py-1.5 disabled:opacity-35"
              :disabled="page >= pages" @click="page++; load()">Sljedeća</button>
    </nav>

    <!-- Hiding always asks why: a reason nobody has to give is a reason nobody
         gives, and the next editor is left guessing. -->
    <div v-if="hiding" class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div class="w-full max-w-md rounded-lg bg-panel p-5 shadow-xl">
        <h2 class="text-sm font-semibold">Razlog sakrivanja</h2>
        <p class="mt-1 truncate text-xs text-faint">{{ hiding.body }}</p>

        <textarea
          v-model="reason" rows="3" maxlength="500" autofocus
          class="mt-3 w-full rounded border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="npr. uvredljiv sadržaj, spam, nije o pjesmi"
        />

        <div class="mt-4 flex justify-end gap-2 text-sm">
          <button class="rounded px-3 py-1.5 text-muted hover:text-accent" @click="hiding = null">Odustani</button>
          <button
            class="rounded bg-accent px-3 py-1.5 text-on-accent disabled:opacity-40"
            :disabled="!reason.trim()"
            @click="confirmHide"
          >Sakrij</button>
        </div>
      </div>
    </div>
  </section>
</template>
