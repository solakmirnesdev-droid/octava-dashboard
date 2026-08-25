<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import client from '../api/client';

const overview = ref(null);
const songs = ref([]);
const meta = ref(null);
const loading = ref(true);
const error = ref(null);

const sort = ref('views');
const page = ref(1);

const SORTS = [
  { key: 'views', label: 'Najgledanije' },
  { key: 'favorites', label: 'Najčuvanije' },
  { key: 'rate', label: 'Najbolja stopa' },
  { key: 'recent', label: 'Najnovije' }
];

/**
 * Bars are scaled to the largest value on the page, not to the all-time
 * maximum. Otherwise every page after the first would show a row of stubs and
 * the comparison that matters — these songs against each other — would be lost.
 */
const peakViews = computed(() => Math.max(1, ...songs.value.map((s) => s.views)));
const peakSaves = computed(() => Math.max(1, ...songs.value.map((s) => s.favorites)));

const number = (value) => new Intl.NumberFormat('bs').format(value || 0);
const percent = (value) => (value * 100).toFixed(1) + '%';

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [o, s] = await Promise.all([
      overview.value ? Promise.resolve({ data: overview.value }) : client.get('/stats/overview'),
      client.get('/stats/songs', { params: { sort: sort.value, page: page.value, limit: 25 } })
    ]);
    overview.value = o.data;
    songs.value = s.data.songs;
    meta.value = s.data.meta;
  } catch (err) {
    error.value = err.response?.data?.message || 'Učitavanje nije uspjelo.';
  } finally {
    loading.value = false;
  }
}

watch([sort, page], load);
onMounted(load);

function changeSort(key) {
  sort.value = key;
  page.value = 1;
}
</script>

<template>
  <h1 class="mb-6 text-xl font-semibold tracking-tight">Statistika</h1>

  <p v-if="error" class="mb-4 rounded bg-accent/10 px-4 py-2 text-sm text-accent">{{ error }}</p>

  <div v-if="overview" class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-lg border border-black/10 bg-white p-4">
      <p class="text-xs uppercase tracking-wide text-black/40">Pregleda</p>
      <p class="mt-1 font-mono text-2xl font-semibold">{{ number(overview.views) }}</p>
    </div>
    <div class="rounded-lg border border-black/10 bg-white p-4">
      <p class="text-xs uppercase tracking-wide text-black/40">Sačuvano</p>
      <p class="mt-1 font-mono text-2xl font-semibold text-accent">{{ number(overview.favorites) }}</p>
    </div>
    <div class="rounded-lg border border-black/10 bg-white p-4">
      <p class="text-xs uppercase tracking-wide text-black/40">Stopa čuvanja</p>
      <p class="mt-1 font-mono text-2xl font-semibold">{{ percent(overview.saveRate) }}</p>
      <p class="mt-0.5 text-xs text-black/40">koliko pregleda završi sačuvano</p>
    </div>
    <div class="rounded-lg border border-black/10 bg-white p-4">
      <p class="text-xs uppercase tracking-wide text-black/40">Pjesama</p>
      <p class="mt-1 font-mono text-2xl font-semibold">{{ number(overview.published) }}</p>
      <p class="mt-0.5 text-xs text-black/40">+ {{ overview.drafts }} skica</p>
    </div>
  </div>

  <div class="mb-4 flex flex-wrap gap-2 border-b border-black/10 pb-3 text-sm">
    <button
      v-for="option in SORTS" :key="option.key"
      class="rounded px-3 py-1"
      :class="sort === option.key ? 'bg-ink text-white' : 'text-black/55 hover:text-accent'"
      @click="changeSort(option.key)"
    >{{ option.label }}</button>
  </div>

  <p v-if="loading" class="text-sm text-black/50">Učitavanje…</p>

  <table v-else class="w-full text-sm">
    <thead class="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/40">
      <tr>
        <th class="pb-2">Pjesma</th>
        <th class="pb-2 w-[28%]">Pregledi</th>
        <th class="pb-2 w-[28%]">Sačuvano</th>
        <th class="pb-2 text-right">Stopa</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="song in songs" :key="song._id" class="border-b border-black/5">
        <td class="py-2.5 pr-4">
          <span class="font-medium">{{ song.title }}</span>
          <span class="ml-2 text-xs text-black/45">{{ song.artist?.name }}</span>
          <span v-if="song.status === 'draft'" class="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-black/50">
            skica
          </span>
        </td>

        <td class="py-2.5 pr-4">
          <div class="flex items-center gap-2">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
              <div class="h-full rounded-full bg-ink/70" :style="{ width: (song.views / peakViews * 100) + '%' }" />
            </div>
            <span class="w-14 shrink-0 text-right font-mono text-xs text-black/60">{{ number(song.views) }}</span>
          </div>
        </td>

        <td class="py-2.5 pr-4">
          <div class="flex items-center gap-2">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
              <div class="h-full rounded-full bg-accent" :style="{ width: (song.favorites / peakSaves * 100) + '%' }" />
            </div>
            <span class="w-14 shrink-0 text-right font-mono text-xs text-accent">{{ number(song.favorites) }}</span>
          </div>
        </td>

        <td class="py-2.5 text-right font-mono text-xs text-black/50">{{ percent(song.saveRate) }}</td>
      </tr>
    </tbody>
  </table>

  <nav v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button
      class="rounded border border-black/15 px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page <= 1" @click="page--"
    >Prethodna</button>
    <span class="text-black/50">{{ meta.page }} / {{ meta.pages }}</span>
    <button
      class="rounded border border-black/15 px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page >= meta.pages" @click="page++"
    >Sljedeća</button>
  </nav>
</template>
