<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import client from '../api/client';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconViews from '~icons/material-symbols/visibility-rounded';
import IconSaved from '~icons/material-symbols/favorite-rounded';
import IconRate from '~icons/material-symbols/trending-up-rounded';
import IconSongs from '~icons/material-symbols/queue-music-rounded';
import IconHealth from '~icons/material-symbols/ecg-heart-rounded';

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
  { key: 'recent', label: 'Najnovije' },
  { key: 'gaps', label: 'Rupe u katalogu' }
];

/** The gaps tab answers a different question and so reads a different route. */
const gaps = ref([]);
const isGaps = computed(() => sort.value === 'gaps');

/**
 * Bars are scaled to the largest value on the page, not to the all-time
 * maximum. Otherwise every page after the first would show a row of stubs and
 * the comparison that matters — these songs against each other — would be lost.
 */
const peakViews = computed(() => Math.max(1, ...songs.value.map((s) => s.views)));
const peakGap = computed(() => Math.max(1, ...gaps.value.map((g) => g.empty)));
const peakSaves = computed(() => Math.max(1, ...songs.value.map((s) => s.favorites)));

const number = (value) => new Intl.NumberFormat('bs').format(value || 0);
const percent = (value) => (value * 100).toFixed(1) + '%';

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [o, s] = await Promise.all([
      overview.value ? Promise.resolve({ data: overview.value }) : client.get('/stats/overview'),
      isGaps.value
        ? client.get('/stats/gaps', { params: { limit: 25 } })
        : client.get('/stats/songs', { params: { sort: sort.value, page: page.value, limit: 25 } })
    ]);
    overview.value = o.data;

    if (isGaps.value) {
      gaps.value = s.data.artists;
      meta.value = null;
    } else {
      songs.value = s.data.songs;
      meta.value = s.data.meta;
    }
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

  <p v-if="error" class="mb-4 rounded bg-accent-soft px-4 py-2 text-sm text-accent">{{ error }}</p>

  <SkeletonLoader v-if="!overview && loading" type="stats" class="mb-8" />

  <template v-else-if="overview">
    <!-- Catalogue health, first and widest -->
    <section v-if="overview.health" class="mb-4 rounded-lg border border-line bg-panel p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint">
          <IconHealth /> Zdravlje kataloga
        </p>
        <p class="font-mono text-2xl font-semibold" :class="overview.health.share < 0.1 ? 'text-warn' : 'text-ok'">
          {{ percent(overview.health.share) }}
        </p>
      </div>

      <p class="mt-1 text-xs text-muted">
        {{ number(overview.health.playable) }} od {{ number(overview.health.total) }} pjesama ima akorde
        koje nije napisao generator.
      </p>

      <div class="mt-3 flex h-2.5 overflow-hidden rounded-full bg-sunken">
        <div class="h-full bg-ok" :style="{ width: (overview.health.playable / overview.health.total * 100) + '%' }" />
        <div class="h-full bg-warn" :style="{ width: (overview.health.placeholder / overview.health.total * 100) + '%' }" />
      </div>

      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span><span class="mr-1 inline-block size-2 rounded-full bg-ok align-middle" />{{ number(overview.health.playable) }} s pravim akordima</span>
        <span><span class="mr-1 inline-block size-2 rounded-full bg-warn align-middle" />{{ number(overview.health.placeholder) }} lorem ipsum</span>
        <span><span class="mr-1 inline-block size-2 rounded-full bg-sunken align-middle" />{{ number(overview.health.empty) }} bez ijednog akorda</span>
        <span v-if="overview.health.needsReview" class="text-warn">
          {{ overview.health.needsReview }} čeka provjeru
        </span>
      </div>
    </section>

    <div class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-line bg-panel p-4">
        <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint"><IconViews /> Pregleda</p>
        <p class="mt-1 font-mono text-2xl font-semibold">{{ number(overview.views) }}</p>
        <p v-if="overview.seeded?.views" class="mt-0.5 text-xs text-warn">
          {{ percent(overview.seeded.views / overview.views) }} zasijano, nije stvarni saobraćaj
        </p>
      </div>
      <div class="rounded-lg border border-line bg-panel p-4">
        <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint"><IconSaved /> Sačuvano</p>
        <p class="mt-1 font-mono text-2xl font-semibold text-accent">{{ number(overview.favorites) }}</p>
      </div>
      <div class="rounded-lg border border-line bg-panel p-4">
        <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint"><IconRate /> Stopa čuvanja</p>
        <p class="mt-1 font-mono text-2xl font-semibold">{{ percent(overview.saveRate) }}</p>
        <p class="mt-0.5 text-xs text-faint">koliko pregleda završi sačuvano</p>
      </div>
      <div class="rounded-lg border border-line bg-panel p-4">
        <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint"><IconSongs /> Pjesama</p>
        <p class="mt-1 font-mono text-2xl font-semibold">{{ number(overview.published) }}</p>
        <p class="mt-0.5 text-xs text-faint">+ {{ overview.drafts }} skica</p>
      </div>
    </div>

    <!-- The small numbers -->
    <div class="mb-8 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-line-soft bg-surface px-4 py-3 text-sm">
      <span class="text-xs uppercase tracking-wide text-faint">Stvarno zabilježeno</span>
      <span><span class="font-mono font-semibold">{{ number(overview.users) }}</span> <span class="text-muted">čitalaca</span></span>
      <span><span class="font-mono font-semibold">{{ number(overview.ratings) }}</span> <span class="text-muted">ocjena</span></span>
      <span><span class="font-mono font-semibold text-accent">{{ number(overview.favorites) }}</span> <span class="text-muted">sačuvanih</span></span>
      <span><span class="font-mono font-semibold">{{ number(overview.reviews) }}</span> <span class="text-muted">recenzija</span></span>
      <span><span class="font-mono font-semibold">{{ number(overview.requests) }}</span> <span class="text-muted">zahtjeva</span></span>
    </div>
  </template>

  <div class="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
    <button
      v-for="option in SORTS" :key="option.key"
      class="rounded px-3 py-1"
      :class="sort === option.key ? 'bg-ink text-on-ink' : 'text-muted hover:text-accent'"
      @click="changeSort(option.key)"
    >{{ option.label }}</button>
  </div>

  <SkeletonLoader v-if="loading" type="table" :rows="6" :cols="4" />

  <!-- The one list here that says what to do rather than what happened. -->
  <table v-else-if="isGaps" class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="pb-2">Izvođač</th>
        <th class="pb-2 w-[40%]">Pjesama bez akorda</th>
        <th class="pb-2 text-right">Od ukupno</th>
        <th class="pb-2 text-right">Udio</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="a in gaps" :key="a._id"
        class="group cursor-pointer border-b border-line-soft transition hover:bg-raised/50"
        @click="$router.push({ name: 'songs', query: { q: a.name } })"
      >
        <td class="py-2.5 pr-4">
          <span class="font-medium group-hover:text-accent group-hover:underline">{{ a.name }}</span>
        </td>
        <td class="py-2.5 pr-4">
          <div class="flex items-center gap-2">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
              <div class="h-full rounded-full bg-warn" :style="{ width: (a.empty / peakGap * 100) + '%' }" />
            </div>
            <span class="w-10 shrink-0 text-right font-mono text-xs text-warn">{{ a.empty }}</span>
          </div>
        </td>
        <td class="py-2.5 text-right font-mono text-xs text-muted">{{ a.songs }}</td>
        <td class="py-2.5 text-right font-mono text-xs text-muted">{{ percent(a.share) }}</td>
      </tr>
      <tr v-if="!gaps.length">
        <td colspan="4" class="py-6 text-center text-faint">Nijedan izvođač nema pjesmu bez akorda.</td>
      </tr>
    </tbody>
  </table>

  <table v-else class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="pb-2">Pjesma</th>
        <th class="pb-2 w-[28%]">Pregledi</th>
        <th class="pb-2 w-[28%]">Sačuvano</th>
        <th class="pb-2 text-right">Stopa</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="song in songs" :key="song._id"
        class="group cursor-pointer border-b border-line-soft transition hover:bg-raised/50"
        @click="$router.push({ name: 'song-edit', params: { id: song._id } })"
      >
        <td class="py-2.5 pr-4">
          <span class="font-medium group-hover:text-accent group-hover:underline">{{ song.title }}</span>
          <span class="ml-2 text-xs text-faint">{{ song.artist?.name }}</span>
          <span v-if="song.status === 'draft'" class="ml-2 rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted">
            skica
          </span>
        </td>

        <td class="py-2.5 pr-4">
          <div class="flex items-center gap-2">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
              <div class="h-full rounded-full bg-ink/70" :style="{ width: (song.views / peakViews * 100) + '%' }" />
            </div>
            <span class="w-14 shrink-0 text-right font-mono text-xs text-muted">{{ number(song.views) }}</span>
          </div>
        </td>

        <td class="py-2.5 pr-4">
          <div class="flex items-center gap-2">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
              <div class="h-full rounded-full bg-accent" :style="{ width: (song.favorites / peakSaves * 100) + '%' }" />
            </div>
            <span class="w-14 shrink-0 text-right font-mono text-xs text-accent">{{ number(song.favorites) }}</span>
          </div>
        </td>

        <td class="py-2.5 text-right font-mono text-xs text-muted">{{ percent(song.saveRate) }}</td>
      </tr>
      <tr v-if="!songs.length">
        <td colspan="4" class="py-6 text-center text-faint">Nema pjesama za prikaz.</td>
      </tr>
    </tbody>
  </table>

  <nav v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page <= 1" @click="page--"
    >Prethodna</button>
    <span class="text-muted">{{ meta.page }} / {{ meta.pages }}</span>
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page >= meta.pages" @click="page++"
    >Sljedeća</button>
  </nav>
</template>
