<script setup>
import { ref, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconExternal from '~icons/material-symbols/open-in-new-rounded';

/**
 * Issue reports submitted by readers against songs.
 */
const toasts = useToasts();
const appUrl = import.meta.env.VITE_APP_URL || 'https://octava.app';

const items = ref([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const open = ref(0);
const status = ref('open');
const loading = ref(false);

const KINDS = {
  chords: 'Pogrešan akord',
  lyrics: 'Netačan tekst',
  key: 'Pogrešan tonalitet',
  duplicate: 'Duplikat',
  other: 'Drugo'
};

const STATUSES = [
  { value: 'open', label: 'Otvorene' },
  { value: 'resolved', label: 'Riješene' },
  { value: 'rejected', label: 'Odbijene' },
  { value: 'all', label: 'Sve' }
];

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/reports', {
      params: { status: status.value, page: page.value, limit: 25 }
    });
    items.value = data.reports || [];
    pages.value = data.pages || 1;
    total.value = data.total || 0;
    open.value = data.open || 0;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje prijava nije uspjelo.');
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
      <span v-if="open" class="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
        {{ open }} otvorenih
      </span>

      <div class="ml-auto flex gap-1.5 text-sm">
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

    <p class="mb-3 text-sm text-faint">{{ total }} prijava</p>

    <SkeletonLoader v-if="loading" type="list" :rows="5" />

    <p v-else-if="!items.length" class="rounded border border-line bg-panel px-4 py-8 text-center text-sm text-faint">
      Nema prijava u ovoj kategoriji.
    </p>

    <ul v-else class="space-y-2">
      <li v-for="r in items" :key="r._id" class="rounded border border-line bg-panel px-4 py-3">
        <div class="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span class="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium">
            {{ KINDS[r.kind] || r.kind }}
          </span>
          <template v-if="r.song">
            <RouterLink
              :to="{ name: 'song-edit', params: { id: r.song._id } }"
              class="font-medium hover:text-accent hover:underline"
            >{{ r.song.title }}</RouterLink>
            <a
              :href="`${appUrl}/pjesma/${r.song.slug}`" target="_blank" rel="noopener"
              class="text-faint hover:text-accent" title="Otvori na sajtu"
            ><IconExternal class="text-xs inline" /></a>
            <span class="text-xs text-muted">{{ r.song.artist?.name }}</span>
          </template>
          <span v-else class="text-faint italic">[obrisana pjesma]</span>

          <span class="ml-auto font-mono text-xs text-faint">{{ when(r.createdAt) }}</span>
        </div>

        <p class="mt-2 text-sm whitespace-pre-wrap">{{ r.body }}</p>

        <div v-if="r.reporter?.email" class="mt-1 text-xs text-faint">
          Prijavio/la: {{ r.reporter.email }}
        </div>

        <div v-if="r.status === 'open'" class="mt-3 flex gap-2 border-t border-line-soft pt-2 text-xs">
          <button
            class="rounded bg-accent px-2.5 py-1 text-on-accent hover:opacity-90"
            @click="close(r, 'resolved')"
          >Riješeno</button>
          <button
            class="rounded border border-line-strong px-2.5 py-1 text-muted hover:border-danger hover:text-danger"
            @click="close(r, 'rejected')"
          >Odbij</button>
        </div>
        <div v-else class="mt-2 text-xs text-faint">
          Status: <span class="font-medium">{{ r.status === 'resolved' ? 'Riješeno' : 'Odbijeno' }}</span>
        </div>
      </li>
    </ul>

    <nav v-if="pages > 1" class="mt-6 flex justify-center gap-2 text-sm">
      <button
        v-for="p in pages" :key="p"
        class="size-8 rounded border text-xs"
        :class="page === p ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-panel hover:border-accent'"
        @click="page = p; load()"
      >{{ p }}</button>
    </nav>
  </section>
</template>
