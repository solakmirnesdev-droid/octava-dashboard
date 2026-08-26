<script setup>
import { onMounted, ref } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import IconDone from '~icons/material-symbols/check-circle-outline-rounded';
import IconReject from '~icons/material-symbols/cancel-outline-rounded';
import IconOpen from '~icons/material-symbols/open-in-new-rounded';

/**
 * Reports that a chart is wrong.
 *
 * Two ways to close one, and they mean different things: resolved is "we
 * changed something", rejected is "we looked and the chart is right". Collapsing
 * them into a single Done would lose the only signal that tells the desk which
 * reporters are worth reading carefully.
 */
const toasts = useToasts();

const KINDS = {
  chords:    'Pogrešni akordi',
  lyrics:    'Pogrešan tekst',
  key:       'Pogrešan tonalitet',
  duplicate: 'Duplikat',
  other:     'Ostalo'
};
const STATUSES = [
  { value: 'open',     label: 'Otvorene' },
  { value: 'resolved', label: 'Riješene' },
  { value: 'rejected', label: 'Odbijene' }
];

const status = ref('open');
const items = ref([]);
const total = ref(0);
const open = ref(0);
const page = ref(1);
const pages = ref(1);
const loading = ref(false);

const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/reports', {
      params: { status: status.value, page: page.value, limit: 25 }
    });
    items.value = data.items;
    total.value = data.total;
    open.value = data.open;
    pages.value = data.pages;
  } catch {
    toasts.error('Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

function setStatus(next) {
  status.value = next;
  page.value = 1;
  load();
}

async function close(report, nextStatus) {
  try {
    await client.patch(`/reports/${report._id}`, { status: nextStatus });
    toasts.success(nextStatus === 'resolved' ? 'Označeno kao riješeno.' : 'Odbijeno.');
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
      <h1 class="text-xl font-semibold tracking-tight">Prijave grešaka</h1>
      <span v-if="open" class="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
        {{ open }} otvorenih
      </span>

      <div class="ml-auto flex gap-1.5 text-sm">
        <button
          v-for="s in STATUSES" :key="s.value"
          class="rounded border px-2.5 py-1"
          :class="status === s.value
            ? 'border-accent bg-accent text-white'
            : 'border-black/15 bg-white hover:border-accent hover:text-accent'"
          @click="setStatus(s.value)"
        >{{ s.label }}</button>
      </div>
    </header>

    <p class="mb-3 text-sm text-black/45">{{ total }} prijava</p>

    <p v-if="loading" class="text-sm text-black/45">Učitavanje…</p>

    <p v-else-if="!items.length" class="rounded border border-black/10 bg-white px-4 py-8 text-center text-sm text-black/45">
      Nema prijava u ovoj kategoriji.
    </p>

    <ul v-else class="space-y-2">
      <li v-for="r in items" :key="r._id" class="rounded border border-black/10 bg-white px-4 py-3">
        <div class="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span class="rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-medium">
            {{ KINDS[r.kind] || r.kind }}
          </span>
          <a
            v-if="r.song" :href="`${appUrl}/pjesma/${r.song.slug}`" target="_blank" rel="noopener"
            class="inline-flex items-center gap-1 font-medium hover:text-accent"
          >{{ r.song.title }} <IconOpen class="text-xs" /></a>
          <span class="text-black/40">{{ r.user?.username }}</span>
          <span class="text-xs text-black/35">· {{ when(r.createdAt) }}</span>
        </div>

        <p v-if="r.note" class="mt-2 whitespace-pre-wrap text-sm text-black/75">{{ r.note }}</p>

        <p v-if="r.status !== 'open'" class="mt-2 text-xs text-black/45">
          {{ r.status === 'resolved' ? 'Riješio' : 'Odbio' }} {{ r.resolvedBy?.name || '—' }}
        </p>

        <div v-if="r.status === 'open'" class="mt-3 flex gap-2">
          <button
            class="flex items-center gap-1.5 rounded border border-black/15 px-2.5 py-1 text-sm hover:border-emerald-500 hover:text-emerald-700"
            @click="close(r, 'resolved')"
          ><IconDone /> Riješeno</button>
          <button
            class="flex items-center gap-1.5 rounded border border-black/15 px-2.5 py-1 text-sm hover:border-black/40 hover:text-black/70"
            @click="close(r, 'rejected')"
          ><IconReject /> Nije greška</button>
        </div>
      </li>
    </ul>

    <nav v-if="pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
      <button class="rounded border border-black/15 px-3 py-1.5 disabled:opacity-35"
              :disabled="page <= 1" @click="page--; load()">Prethodna</button>
      <span class="text-black/45">{{ page }} / {{ pages }}</span>
      <button class="rounded border border-black/15 px-3 py-1.5 disabled:opacity-35"
              :disabled="page >= pages" @click="page++; load()">Sljedeća</button>
    </nav>
  </section>
</template>
