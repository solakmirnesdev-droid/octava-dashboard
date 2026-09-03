<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import client from '../api/client';
import { useLiveData } from '../composables/useLiveData';
import { useRefreshOnVisible } from '../composables/useRefreshOnVisible';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { AppCard, AppStatsCard, AppSegmentedControl, AppPagination, AppEmptyState } from '../components/ui';
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
const statsPopping = ref(false);

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

const sort = ref('views');
const page = ref(1);

const SORTS = [
  { value: 'views', label: 'Najgledanije' },
  { value: 'favorites', label: 'Najčuvanije' },
  { value: 'rate', label: 'Najbolja stopa' },
  { value: 'recent', label: 'Najnovije' },
  { value: 'gaps', label: 'Rupe u katalogu' }
];

const gaps = ref([]);
const isGaps = computed(() => sort.value === 'gaps');

const peakViews = computed(() => Math.max(1, ...songs.value.map((s) => s.views)));
const peakGap = computed(() => Math.max(1, ...gaps.value.map((g) => g.empty)));
const peakSaves = computed(() => Math.max(1, ...songs.value.map((s) => s.favorites)));

const number = (value) => new Intl.NumberFormat('bs').format(value || 0);
const percent = (value) => (value * 100).toFixed(1) + '%';

async function load(opts = {}) {
  const fresh = opts?.fresh === true;
  loading.value = true;
  error.value = null;
  try {
    const [o, s] = await Promise.all([
      overview.value && !fresh ? Promise.resolve({ data: overview.value }) : client.get('/stats/overview'),
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
    triggerUpdatePulse();
  } catch (err) {
    error.value = err.response?.data?.message || 'Učitavanje nije uspjelo.';
  } finally {
    loading.value = false;
  }
}

watch([sort, page], () => load());
onMounted(() => load());

useLiveData(['songs', 'artists'], () => load({ fresh: true }));
useRefreshOnVisible(() => load({ fresh: true }));

watch(sort, () => {
  page.value = 1;
});
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5">
      <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
        Statistika i analitika
      </h1>
      <p class="text-xs text-muted mt-0.5">
        Pregledi pjesama, čuvanja, zdravlje kataloga i prepoznavanje rupa u repertoaru.
      </p>
    </div>

    <p v-if="error" class="mb-4 rounded-xl border border-danger/30 bg-danger-soft/40 px-4 py-2.5 text-xs sm:text-sm text-danger font-medium">{{ error }}</p>

    <SkeletonLoader v-if="!overview && loading" type="stats" class="mb-8" />

    <template v-else-if="overview">
      <!-- Catalogue health, first and widest -->
      <AppCard v-if="overview.health" class="mb-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint font-mono">
            <IconHealth class="text-accent text-sm" /> Zdravlje kataloga
          </p>
          <p class="font-mono text-2xl font-black" :class="overview.health.share < 0.1 ? 'text-warn' : 'text-ok'">
            {{ percent(overview.health.share) }}
          </p>
        </div>

        <p class="mt-1 text-xs text-muted">
          {{ number(overview.health.playable) }} od {{ number(overview.health.total) }} pjesama ima akorde
          koje nije napisao generator.
        </p>

        <div class="mt-3.5 flex h-2.5 overflow-hidden rounded-full bg-sunken">
          <div class="h-full bg-ok transition-all duration-500" :style="{ width: (overview.health.playable / overview.health.total * 100) + '%' }" />
          <div class="h-full bg-warn transition-all duration-500" :style="{ width: (overview.health.placeholder / overview.health.total * 100) + '%' }" />
        </div>

        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-muted">
          <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-full bg-ok" />{{ number(overview.health.playable) }} s pravim akordima</span>
          <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-full bg-warn" />{{ number(overview.health.placeholder) }} lorem ipsum</span>
          <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-full bg-sunken border border-line-strong" />{{ number(overview.health.empty) }} bez ijednog akorda</span>
          <span v-if="overview.health.needsReview" class="text-warn font-bold">
            {{ overview.health.needsReview }} čeka provjeru
          </span>
        </div>
      </AppCard>

      <!-- Overview Metric Cards using AppStatsCard -->
      <div class="mb-5 grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        <AppStatsCard
          title="Pregleda"
          :value="number(overview.views)"
          :subtitle="overview.seeded?.views ? percent(overview.seeded.views / overview.views) + ' testno' : 'Ukupne posjete'"
          :class="statsPopping ? 'animate-pulse-glow' : ''"
        >
          <template #icon>
            <IconViews class="text-sm text-accent" />
          </template>
        </AppStatsCard>

        <AppStatsCard
          title="Sačuvano"
          :value="number(overview.favorites)"
          subtitle="Dodano u favorite"
          :class="statsPopping ? 'animate-pulse-glow' : ''"
        >
          <template #icon>
            <IconSaved class="text-sm text-accent" />
          </template>
        </AppStatsCard>

        <AppStatsCard
          title="Stopa čuvanja"
          :value="percent(overview.saveRate)"
          subtitle="Stopa konverzije"
          :class="statsPopping ? 'animate-pulse-glow' : ''"
        >
          <template #icon>
            <IconRate class="text-sm text-ok" />
          </template>
        </AppStatsCard>

        <AppStatsCard
          title="Pjesama"
          :value="number(overview.published)"
          subtitle="Objavljeno u katalogu"
          :class="statsPopping ? 'animate-pulse-glow' : ''"
        >
          <template #icon>
            <IconSongs class="text-sm text-muted" />
          </template>
        </AppStatsCard>
      </div>
    </template>

    <!-- Sort Tabs Toolbar using AppSegmentedControl -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <AppSegmentedControl
        v-model="sort"
        :options="SORTS"
      />
    </div>

    <SkeletonLoader v-if="loading" type="table" :rows="6" :cols="4" />

    <!-- Catalogue gaps list -->
    <div v-else-if="isGaps">
      <!-- Mobile Card View (< sm) -->
      <div class="sm:hidden space-y-2.5">
        <AppCard
          v-for="a in gaps"
          :key="'mob-gap-' + a._id"
          variant="interactive"
          padding="sm"
          class="space-y-2"
          @click="$router.push({ name: 'songs', query: { q: a.name } })"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-ink">{{ a.name }}</span>
            <span class="text-xs font-mono font-bold text-warn">{{ a.empty }} / {{ a.songs }} ({{ percent(a.share) }})</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-sunken">
            <div class="h-full rounded-full bg-warn" :style="{ width: (a.empty / peakGap * 100) + '%' }" />
          </div>
        </AppCard>
        <AppEmptyState
          v-if="!gaps.length"
          title="Nema rupa u katalogu"
          description="Nijedan izvođač nema pjesmu bez akorda."
        />
      </div>

      <!-- Desktop Table (>= sm) -->
      <div class="hidden sm:block rounded-2xl border border-line bg-panel overflow-hidden shadow-2xs">
        <table class="w-full text-sm text-left">
          <thead class="bg-surface/80 backdrop-blur-sm text-faint font-mono text-[11px] font-bold tracking-wider uppercase border-b border-line">
            <tr>
              <th class="py-3 px-4">Izvođač</th>
              <th class="py-3 px-4 w-[40%]">Pjesama bez akorda</th>
              <th class="py-3 px-4 text-right">Od ukupno</th>
              <th class="py-3 px-4 text-right">Udio</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr
              v-for="a in gaps"
              :key="a._id"
              class="group cursor-pointer hover:bg-raised/40 transition-colors"
              @click="$router.push({ name: 'songs', query: { q: a.name } })"
            >
              <td class="py-3 px-4 font-bold text-ink group-hover:text-accent">
                {{ a.name }}
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div class="h-full rounded-full bg-warn" :style="{ width: (a.empty / peakGap * 100) + '%' }" />
                  </div>
                  <span class="w-10 shrink-0 text-right font-mono text-xs text-warn font-bold">{{ a.empty }}</span>
                </div>
              </td>
              <td class="py-3 px-4 text-right font-mono text-xs text-muted">{{ a.songs }}</td>
              <td class="py-3 px-4 text-right font-mono text-xs text-muted font-bold">{{ percent(a.share) }}</td>
            </tr>
            <tr v-if="!gaps.length">
              <td colspan="4" class="py-12 text-center text-faint">Nijedan izvođač nema pjesmu bez akorda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Songs statistics table -->
    <div v-else>
      <!-- Mobile Card View (< sm) -->
      <div class="sm:hidden space-y-2.5">
        <AppCard
          v-for="song in songs"
          :key="'mob-stat-' + song._id"
          variant="interactive"
          padding="sm"
          class="space-y-2.5"
          @click="$router.push({ name: 'song-edit', params: { id: song._id } })"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-ink">{{ song.title }}</h3>
              <p class="text-xs text-muted font-medium">{{ song.artist?.name }}</p>
            </div>
            <span class="text-xs font-mono text-accent font-bold">
              {{ percent(song.saveRate) }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div>
              <div class="flex items-center justify-between text-[11px] text-muted mb-0.5 font-medium">
                <span>Pregledi</span>
                <span class="font-mono font-bold text-ink">{{ number(song.views) }}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                <div class="h-full rounded-full bg-ink/70" :style="{ width: (song.views / peakViews * 100) + '%' }" />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between text-[11px] text-muted mb-0.5 font-medium">
                <span>Sačuvano</span>
                <span class="font-mono font-bold text-accent">{{ number(song.favorites) }}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                <div class="h-full rounded-full bg-accent" :style="{ width: (song.favorites / peakSaves * 100) + '%' }" />
              </div>
            </div>
          </div>
        </AppCard>
        <AppEmptyState
          v-if="!songs.length"
          title="Nema pjesama za prikaz"
          description="Katalog trenutno nema unesenih pjesama."
        />
      </div>

      <!-- Desktop Table (>= sm) -->
      <div class="hidden sm:block rounded-2xl border border-line bg-panel overflow-hidden shadow-2xs">
        <table class="w-full text-sm text-left">
          <thead class="bg-surface/80 backdrop-blur-sm text-faint font-mono text-[11px] font-bold tracking-wider uppercase border-b border-line">
            <tr>
              <th class="py-3 px-4">Pjesma</th>
              <th class="py-3 px-4 w-[28%]">Pregledi</th>
              <th class="py-3 px-4 w-[28%]">Sačuvano</th>
              <th class="py-3 px-4 text-right">Stopa čuvanja</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr
              v-for="song in songs"
              :key="song._id"
              class="group cursor-pointer hover:bg-raised/40 transition-colors"
              @click="$router.push({ name: 'song-edit', params: { id: song._id } })"
            >
              <td class="py-3 px-4">
                <span class="font-bold text-ink group-hover:text-accent">{{ song.title }}</span>
                <span class="ml-2 text-xs text-muted font-medium">{{ song.artist?.name }}</span>
                <span v-if="song.status === 'draft'" class="ml-2 rounded-md bg-raised border border-line-soft px-1.5 py-0.2 text-[10px] text-muted font-mono font-bold">
                  skica
                </span>
              </td>

              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div class="h-full rounded-full bg-ink/70" :style="{ width: (song.views / peakViews * 100) + '%' }" />
                  </div>
                  <span class="w-14 shrink-0 text-right font-mono text-xs text-muted font-bold">{{ number(song.views) }}</span>
                </div>
              </td>

              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div class="h-full rounded-full bg-accent" :style="{ width: (song.favorites / peakSaves * 100) + '%' }" />
                  </div>
                  <span class="w-14 shrink-0 text-right font-mono text-xs text-accent font-black">{{ number(song.favorites) }}</span>
                </div>
              </td>

              <td class="py-3 px-4 text-right font-mono text-xs text-muted font-bold">{{ percent(song.saveRate) }}</td>
            </tr>
            <tr v-if="!songs.length">
              <td colspan="4" class="py-12 text-center text-faint">Nema pjesama za prikaz.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination Controls using AppPagination -->
    <AppPagination
      v-if="meta && meta.pages > 1"
      :page="page"
      :total-pages="meta.pages"
      :total-items="meta.total"
      :page-size="25"
      @update:page="page = $event"
    />
  </section>
</template>
