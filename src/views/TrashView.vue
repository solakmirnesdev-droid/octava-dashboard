<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useRefreshOnVisible } from '../composables/useRefreshOnVisible';
import { useLiveData } from '../composables/useLiveData';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import AppModal from '../components/AppModal.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconRestore from '~icons/material-symbols/restore-from-trash-rounded';
import IconPurge from '~icons/material-symbols/delete-forever-outline-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';

/**
 * Everything that was deleted but not destroyed.
 */
const TABS = [
  { key: 'songs', label: 'Pjesme' },
  { key: 'artists', label: 'Izvođači' }
];
const tab = ref('songs');
const toasts = useToasts();
const auth = useAuthStore();

const songs = ref([]);
const artists = ref([]);
const meta = ref(null);
const loading = ref(true);
const page = ref(1);
const busyId = ref(null);

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'songs') {
      const { data } = await client.get('/songs/trash', {
        params: { page: page.value, limit: 25 }
      });
      songs.value = data.songs || [];
      meta.value = data.meta;
    } else {
      const { data } = await client.get('/artists/trash');
      artists.value = data.artists || [];
      meta.value = { total: artists.value.length, page: 1, pages: 1 };
    }
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje kante nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

function pick(key) {
  tab.value = key;
  page.value = 1;
  load();
}

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs') : '—');

async function restoreArtist(artist) {
  busyId.value = artist._id;
  try {
    const { data } = await client.post(`/artists/${artist._id}/restore`);
    artists.value = artists.value.filter((a) => a._id !== artist._id);
    if (meta.value) meta.value.total -= 1;
    toasts.success(data.songs ? `Vraćeno: ${artist.name} i ${data.songs} pjesama.` : `Vraćeno: ${artist.name}`);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Vraćanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const purgingArtist = ref(null);

// The list fetches once. Another session, a script or an import can change
// what it is showing; coming back to the tab refetches.
useRefreshOnVisible(load);

// Live while somebody is looking at it: both tabs, and a delete elsewhere is exactly what fills this one.
// useRefreshOnVisible covers the other half — coming back to a tab that sat
// hidden, and a page restored from the bfcache, where no socket event arrives.
useLiveData(['songs', 'artists'], load);

onMounted(load);

function turn(to) {
  page.value = to;
  load();
}

async function restore(song) {
  busyId.value = song._id;
  try {
    await client.post(`/songs/${song._id}/restore`);
    songs.value = songs.value.filter((s) => s._id !== song._id);
    if (meta.value) meta.value.total -= 1;
    toasts.success(`Vraćeno: ${song.title}`, { detail: song.artist?.name });
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Vraćanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const purging = ref(null);
const typed = ref('');

const titleMatches = computed(() =>
  purging.value && typed.value.trim() === purging.value.title.trim());

function askPurge(song) {
  purging.value = song;
  typed.value = '';
}

async function purge() {
  const song = purging.value;
  if (!song || !titleMatches.value) return;
  purging.value = null;

  busyId.value = song._id;
  try {
    await client.delete(`/songs/${song._id}/purge`);
    songs.value = songs.value.filter((s) => s._id !== song._id);
    if (meta.value) meta.value.total -= 1;
    toasts.success(`Trajno uklonjeno: ${song.title}`);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Uklanjanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const PHRASE = 'SIGURAN SAM';

const emptyOpen = ref(false);
const emptyBusy = ref(false);
const phrase = ref('');
const pending = ref(null);

const phraseMatches = computed(() => phrase.value.trim().toUpperCase() === PHRASE);

async function askEmpty() {
  phrase.value = '';
  pending.value = null;
  emptyOpen.value = true;

  try {
    const { data } = await client.get('/trash/count');
    pending.value = data;
  } catch {
    pending.value = null;
  }
}

async function emptyTrash() {
  if (!phraseMatches.value) return;

  emptyBusy.value = true;
  try {
    const { data } = await client.delete('/trash');
    emptyOpen.value = false;

    const parts = [];
    if (data.songs) parts.push(`${data.songs} pjesama`);
    if (data.artists) parts.push(`${data.artists} izvođača`);
    toasts.success(parts.length ? `Trajno uklonjeno: ${parts.join(', ')}` : 'Kanta je već bila prazna.');

    if (data.kept?.length) {
      toasts.error(`Zadržano ${data.kept.length} izvođača — još imaju pjesme: ${data.kept.map((k) => k.name).join(', ')}`);
    }
    triggerUpdatePulse();
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Pražnjenje kante nije uspjelo.');
  } finally {
    emptyBusy.value = false;
  }
}

const filteredSongs = computed(() => {
  if (!searchQuery.value.trim()) return songs.value;
  const q = searchQuery.value.trim().toLowerCase();
  return songs.value.filter((s) =>
    (s.title || '').toLowerCase().includes(q) ||
    (s.artist?.name || '').toLowerCase().includes(q) ||
    (s.deletedBy?.name || '').toLowerCase().includes(q)
  );
});

const filteredArtists = computed(() => {
  if (!searchQuery.value.trim()) return artists.value;
  const q = searchQuery.value.trim().toLowerCase();
  return artists.value.filter((a) =>
    (a.name || '').toLowerCase().includes(q) ||
    (a.deletedBy?.name || '').toLowerCase().includes(q)
  );
});
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Kanta za otpatke
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Obrisane stavke se ne prikazuju na sajtu, ali se mogu vratiti ili trajno ukloniti.
        </p>
      </div>

      <button
        v-if="auth.hasRole('superadmin')"
        type="button"
        class="flex items-center gap-1.5 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 px-3.5 py-2 text-xs sm:text-sm font-bold transition shadow-md active:scale-95 cursor-pointer disabled:opacity-40"
        :disabled="loading || !meta?.total"
        @click="askEmpty"
      >
        <IconPurge class="text-base" />
        <span>Isprazni cijelu kantu</span>
      </button>
    </div>

    <!-- Quick Insights Metric Tiles -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <!-- 1. Obrisane pjesme -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          tab === 'songs' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('songs')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconMusic class="text-sm text-accent" /> Pjesme u kanti
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Pjesme</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ tab === 'songs' && meta ? meta.total : songs.length }}
          </span>
          <span class="text-[11px] text-faint">stavki</span>
        </div>
      </div>

      <!-- 2. Obrisani izvođači -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          tab === 'artists' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('artists')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconPerson class="text-sm text-accent" /> Izvođači u kanti
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Izvođači</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ tab === 'artists' && meta ? meta.total : artists.length }}
          </span>
          <span class="text-[11px] text-faint">izvođača</span>
        </div>
      </div>

      <!-- 3. Sigurnosni status kante -->
      <div
        class="rounded-2xl border border-line bg-panel p-3.5 shadow-2xs col-span-2 sm:col-span-1"
        :class="statsPopping ? 'animate-pulse-glow' : ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconDelete class="text-sm text-muted" /> Sigurnosna kopija
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">✓ Moguće vraćanje</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-sm font-bold text-muted">
            Privremeno uklonjeno
          </span>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs & Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <!-- Category Tabs -->
      <div class="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line-strong overflow-x-auto scrollbar-none">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer shrink-0"
          :class="tab === t.key ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="pick(t.key)"
        >
          <span>{{ t.label }}</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-64">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Pretraži kantu…"
          class="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="table" :rows="6" :cols="5" />

    <div
      v-else-if="tab === 'songs' ? !filteredSongs.length : !filteredArtists.length"
      class="rounded-2xl border border-line bg-panel p-12 text-center shadow-2xs"
    >
      <IconDelete class="mx-auto text-3xl text-dim mb-2" />
      <p class="text-sm font-bold text-ink">Kanta je prazna</p>
      <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
        {{ searchQuery ? `Nema stavki u kanti za pojam „${searchQuery}”.` : 'Trenutno nema obrisanih stavki u ovoj kategoriji.' }}
      </p>
    </div>

    <!-- SONGS IN TRASH -->
    <div v-else-if="tab === 'songs'">
      <!-- Mobile Cards (< sm) -->
      <div class="sm:hidden space-y-2.5">
        <div
          v-for="song in filteredSongs"
          :key="'mob-t-s-' + song._id"
          class="rounded-2xl border border-line bg-panel p-4 shadow-2xs space-y-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-ink">{{ song.title }}</h3>
              <p class="text-xs text-muted">{{ song.artist?.name || '—' }}</p>
            </div>
            <span class="font-mono text-[11px] text-faint bg-surface border border-line-soft px-2 py-0.5 rounded-lg">
              {{ when(song.deletedAt) }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 pt-2 border-t border-line-soft text-xs">
            <span class="text-faint text-[11px]">Obrisao: {{ song.deletedBy?.name || '—' }}</span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="flex items-center gap-1 rounded-xl bg-ok-soft text-ok hover:bg-ok hover:text-on-ok border border-ok/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                :disabled="busyId === song._id"
                @click="restore(song)"
              >
                <IconRestore class="text-sm" />
                <span>Vrati</span>
              </button>

              <button
                v-if="auth.hasRole('superadmin')"
                type="button"
                class="flex items-center gap-1 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                :disabled="busyId === song._id"
                @click="askPurge(song)"
              >
                <IconPurge class="text-sm" />
                <span>Trajno</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table (>= sm) -->
      <div class="hidden sm:block rounded-2xl border border-line bg-panel overflow-hidden shadow-2xs">
        <table class="w-full text-sm text-left">
          <thead class="bg-surface/80 backdrop-blur-sm text-faint font-mono text-[11px] font-bold tracking-wider uppercase border-b border-line">
            <tr>
              <th class="py-3 px-4">Pjesma</th>
              <th class="py-3 px-4">Izvođač</th>
              <th class="py-3 px-4">Obrisao</th>
              <th class="py-3 px-4">Datum brisanja</th>
              <th class="py-3 px-4 text-right">Radnje</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr
              v-for="song in filteredSongs"
              :key="song._id"
              class="hover:bg-raised/40 transition-colors"
            >
              <td class="py-3 px-4 font-bold text-ink">{{ song.title }}</td>
              <td class="py-3 px-4 text-muted font-medium">{{ song.artist?.name || '—' }}</td>
              <td class="py-3 px-4 text-muted text-xs">{{ song.deletedBy?.name || '—' }}</td>
              <td class="py-3 px-4 font-mono text-xs text-faint">{{ when(song.deletedAt) }}</td>
              <td class="py-3 px-4">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-xl bg-ok-soft text-ok hover:bg-ok hover:text-on-ok border border-ok/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                    :disabled="busyId === song._id"
                    @click="restore(song)"
                  >
                    <IconRestore class="text-sm" />
                    <span>Vrati</span>
                  </button>

                  <button
                    v-if="auth.hasRole('superadmin')"
                    type="button"
                    class="flex items-center gap-1 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                    :disabled="busyId === song._id"
                    @click="askPurge(song)"
                  >
                    <IconPurge class="text-sm" />
                    <span>Ukloni trajno</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ARTISTS IN TRASH -->
    <div v-else-if="tab === 'artists'">
      <!-- Mobile Cards (< sm) -->
      <div class="sm:hidden space-y-2.5">
        <div
          v-for="artist in filteredArtists"
          :key="'mob-t-a-' + artist._id"
          class="rounded-2xl border border-line bg-panel p-4 shadow-2xs space-y-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-ink">{{ artist.name }}</h3>
              <p class="text-xs text-muted font-mono">{{ artist.songCount || 0 }} pjesama</p>
            </div>
            <span class="font-mono text-[11px] text-faint bg-surface border border-line-soft px-2 py-0.5 rounded-lg">
              {{ when(artist.deletedAt) }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 pt-2 border-t border-line-soft text-xs">
            <span class="text-faint text-[11px]">Obrisao: {{ artist.deletedBy?.name || '—' }}</span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="flex items-center gap-1 rounded-xl bg-ok-soft text-ok hover:bg-ok hover:text-on-ok border border-ok/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                :disabled="busyId === artist._id"
                @click="restoreArtist(artist)"
              >
                <IconRestore class="text-sm" />
                <span>Vrati</span>
              </button>

              <button
                v-if="auth.hasRole('superadmin')"
                type="button"
                class="flex items-center gap-1 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                :disabled="busyId === artist._id"
                @click="purgingArtist = artist"
              >
                <IconPurge class="text-sm" />
                <span>Trajno</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table (>= sm) -->
      <div class="hidden sm:block rounded-2xl border border-line bg-panel overflow-hidden shadow-2xs">
        <table class="w-full text-sm text-left">
          <thead class="bg-surface/80 backdrop-blur-sm text-faint font-mono text-[11px] font-bold tracking-wider uppercase border-b border-line">
            <tr>
              <th class="py-3 px-4">Izvođač</th>
              <th class="py-3 px-4">Pjesama</th>
              <th class="py-3 px-4">Obrisao</th>
              <th class="py-3 px-4">Datum brisanja</th>
              <th class="py-3 px-4 text-right">Radnje</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr
              v-for="artist in filteredArtists"
              :key="artist._id"
              class="hover:bg-raised/40 transition-colors"
            >
              <td class="py-3 px-4 font-bold text-ink">{{ artist.name }}</td>
              <td class="py-3 px-4 text-muted font-mono text-xs">{{ artist.songCount || 0 }}</td>
              <td class="py-3 px-4 text-muted text-xs">{{ artist.deletedBy?.name || '—' }}</td>
              <td class="py-3 px-4 font-mono text-xs text-faint">{{ when(artist.deletedAt) }}</td>
              <td class="py-3 px-4">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-xl bg-ok-soft text-ok hover:bg-ok hover:text-on-ok border border-ok/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                    :disabled="busyId === artist._id"
                    @click="restoreArtist(artist)"
                  >
                    <IconRestore class="text-sm" />
                    <span>Vrati</span>
                  </button>

                  <button
                    v-if="auth.hasRole('superadmin')"
                    type="button"
                    class="flex items-center gap-1 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                    :disabled="busyId === artist._id"
                    @click="purgingArtist = artist"
                  >
                    <IconPurge class="text-sm" />
                    <span>Ukloni trajno</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-xl border border-line bg-panel text-muted hover:border-line-strong hover:text-ink transition disabled:opacity-40 cursor-pointer"
        :disabled="page <= 1"
        @click="turn(page - 1)"
      >
        <IconPrev class="text-sm" />
      </button>

      <span class="font-mono text-xs text-faint px-2">
        Stranica {{ meta.page }} od {{ meta.pages }}
      </span>

      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-xl border border-line bg-panel text-muted hover:border-line-strong hover:text-ink transition disabled:opacity-40 cursor-pointer"
        :disabled="page >= meta.pages"
        @click="turn(page + 1)"
      >
        <IconNext class="text-sm" />
      </button>
    </div>

    <!-- Modal: Purge Single Song -->
    <AppModal
      :model-value="Boolean(purging)"
      title="Trajno ukloniti pjesmu?"
      :description="purging ? `Pjesma „${purging.title}“ (${purging.artist?.name || 'nepoznat izvođač'}) biće nepovratno obrisana iz baze podataka zajedno sa svim recenzijama i ocjenama.` : ''"
      confirm-label="Trajno obriši"
      tone="danger"
      :confirm-disabled="!titleMatches"
      @update:model-value="(open) => { if (!open) purging = null; }"
      @confirm="purge"
    >
      <div v-if="purging" class="mt-4 space-y-2">
        <label class="block text-xs text-muted">
          Upišite naslov pjesme za potvrdu: <strong class="text-ink select-all font-mono">{{ purging.title }}</strong>
        </label>
        <input
          v-model="typed"
          type="text"
          class="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-dim focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger font-mono"
          placeholder="Upišite tačan naslov…"
        />
      </div>
    </AppModal>

    <!-- Modal: Empty Trash -->
    <AppModal
      :model-value="emptyOpen"
      title="Isprazniti kantu?"
      description="Sve obrisane pjesme i izvođači biće nepovratno obrisani iz baze podataka. Ova radnja se ne može poništiti."
      confirm-label="Isprazni kantu"
      tone="danger"
      :confirm-disabled="!phraseMatches || emptyBusy"
      @update:model-value="(open) => { if (!open) emptyOpen = false; }"
      @confirm="emptyTrash"
    >
      <div class="mt-4 space-y-3">
        <div v-if="pending" class="rounded-xl border border-line-soft bg-surface/75 p-3 text-xs text-muted">
          Stavke za trajno brisanje:
          <span class="font-mono font-bold text-ink">{{ pending.songs || 0 }}</span> pjesama,
          <span class="font-mono font-bold text-ink">{{ pending.artists || 0 }}</span> izvođača.
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">
            Upišite <strong class="text-danger font-mono">SIGURAN SAM</strong> za potvrdu:
          </label>
          <input
            v-model="phrase"
            type="text"
            class="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono uppercase text-ink placeholder:text-dim focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger"
            placeholder="SIGURAN SAM"
          />
        </div>
      </div>
    </AppModal>
  </section>
</template>
