<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useRefreshOnVisible } from '../composables/useRefreshOnVisible';
import { useLiveData } from '../composables/useLiveData';
import { useAuthStore } from '../stores/auth';
import BulkBar from '../components/BulkBar.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { initials, avatarStyle } from '../utils/avatar';
import { findFingering } from '../utils/chordEngine';
import { strum } from '../utils/chordAudio';

import IconAdd from '~icons/material-symbols/add-rounded';
import IconPublish from '~icons/material-symbols/visibility-rounded';
import IconUnpublish from '~icons/material-symbols/visibility-off-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import IconEdit from '~icons/material-symbols/edit-outline-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconClose from '~icons/material-symbols/close-rounded';
import IconGridView from '~icons/material-symbols/grid-view-rounded';
import IconTableView from '~icons/material-symbols/table-rows-rounded';
import IconVolume from '~icons/material-symbols/volume-up-rounded';
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded';
import IconPending from '~icons/material-symbols/pending-actions-rounded';
import IconWarning from '~icons/material-symbols/warning-rounded';
import IconArtist from '~icons/material-symbols/person-outline-rounded';

const router = useRouter();
const toasts = useToasts();
const auth = useAuthStore();

const songs = ref([]);
const meta = ref(null);
const loading = ref(true);
const busyId = ref(null);
const genres = ref([]);
const playingChord = ref(null);

// Presentation View Mode: 'grid' | 'table'
const viewMode = ref(localStorage.getItem('octava_songs_view_mode') || 'table');
function setViewMode(mode) {
  viewMode.value = mode;
  localStorage.setItem('octava_songs_view_mode', mode);
}

// Multi-selection state
const selected = ref(new Set());
const selectedIds = computed(() => [...selected.value]);

function toggle(id) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
}


const page = ref(1);
const status = ref('');
const tag = ref('');
const searchQuery = ref('');
const activeLetter = ref('Sve');
const suggestion = ref(null);
let searchTimer = null;

const ALPHABET = [
  'Sve', '#', 'A', 'B', 'C', 'Č', 'Ć', 'D', 'Dž', 'Đ', 'E', 'F', 'G',
  'H', 'I', 'J', 'K', 'L', 'Lj', 'M', 'N', 'Nj', 'O', 'P', 'R', 'S',
  'Š', 'T', 'U', 'V', 'Z', 'Ž'
];

const TAGS = [
  { key: 'bez-akorda', label: 'Bez akorda' },
  { key: 'neprovjereno', label: 'Neprovjereno' },
  { key: 'treba-provjeru', label: 'Treba provjeru' },
  { key: 'uvoz', label: 'Iz uvoza' },
  { key: 'demo', label: 'Lažni tekst' }
];

const FILTERS = [
  { key: '', label: 'Sve pjesme' },
  { key: 'published', label: 'Objavljeno' },
  { key: 'draft', label: 'Na čekanju' }
];

let isSongsFetching = false;
const highlightedSongIds = ref(new Set());
const badgePopping = ref(false);
const statsPopping = ref(false);
let highlightTimer = null;
let previousSongMap = new Map();

function triggerUpdatePulse() {
  statsPopping.value = true;
  badgePopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
    badgePopping.value = false;
  }, 1200);
}

function trackAndHighlightUpdates(newSongs) {
  if (previousSongMap.size > 0) {
    const updatedIds = new Set();
    for (const song of newSongs) {
      const prev = previousSongMap.get(song._id);
      if (!prev || prev.status !== song.status || prev.title !== song.title || prev.updatedAt !== song.updatedAt) {
        updatedIds.add(song._id);
      }
    }
    if (updatedIds.size > 0) {
      highlightedSongIds.value = updatedIds;
      triggerUpdatePulse();
      clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => {
        highlightedSongIds.value = new Set();
      }, 2400);
    }
  }

  const nextMap = new Map();
  for (const s of newSongs) {
    nextMap.set(s._id, { status: s.status, title: s.title, updatedAt: s.updatedAt });
  }
  previousSongMap = nextMap;
}

watch(() => meta.value?.total, (newTotal, oldTotal) => {
  if (oldTotal !== undefined && newTotal !== oldTotal) {
    triggerUpdatePulse();
  }
});

async function load() {
  if (isSongsFetching) return;
  isSongsFetching = true;
  if (!songs.value.length) {
    loading.value = true;
  }
  try {
    let q = searchQuery.value.trim();
    if (activeLetter.value !== 'Sve' && !q) {
      q = activeLetter.value;
    }

    if (q) {
      const { data } = await client.get('/songs/search', {
        params: { q, page: page.value, limit: 24 }
      });
      songs.value = data.songs || [];
      meta.value = data.meta;
      suggestion.value = data.suggestion || null;
      trackAndHighlightUpdates(songs.value);
    } else {
      const params = {
        page: page.value,
        limit: 24
      };
      if (status.value && status.value !== '') params.status = status.value;
      if (tag.value && tag.value !== '') params.tag = tag.value;

      const { data } = await client.get('/songs', { params });
      songs.value = data.songs || [];
      meta.value = data.meta;
      suggestion.value = null;
      trackAndHighlightUpdates(songs.value);
    }
  } catch (err) {
    console.warn('Učitavanje pjesama nije uspjelo:', err);
    if (!songs.value.length) {
      toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
    }
  } finally {
    isSongsFetching = false;
    loading.value = false;
  }
}

function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    activeLetter.value = 'Sve';
    selected.value = new Set();
    load();
  }, 250);
}

function setLetter(letter) {
  activeLetter.value = letter;
  searchQuery.value = '';
  page.value = 1;
  selected.value = new Set();
  load();
}

function useSuggestion() {
  searchQuery.value = suggestion.value;
  page.value = 1;
  selected.value = new Set();
  load();
}

function clearSearch() {
  searchQuery.value = '';
  activeLetter.value = 'Sve';
  page.value = 1;
  selected.value = new Set();
  load();
}

watch([page, status, tag], () => {
  selected.value = new Set();
  load();
});

const { markFresh } = useRefreshOnVisible(load);
useLiveData(['songs'], load);

onMounted(async () => {
  await load();
  markFresh();
  try {
    const { data } = await client.get('/genres');
    genres.value = data.genres || [];
  } catch {}
});

async function afterBulk() {
  selected.value = new Set();
  await load();
}

function setFilter(key) {
  status.value = key;
  tag.value = '';
  searchQuery.value = '';
  page.value = 1;
}

function setTag(key) {
  tag.value = tag.value === key ? '' : key;
  searchQuery.value = '';
  page.value = 1;
}

const edit = (song) => router.push({ name: 'song-edit', params: { id: song._id } });

async function toggleStatus(song, e) {
  if (e) e.stopPropagation();
  const previous = song.status;
  const next = previous === 'published' ? 'draft' : 'published';

  song.status = next;
  busyId.value = song._id;

  try {
    await client.put(`/songs/${song._id}`, { status: next });
    triggerUpdatePulse();
    highlightedSongIds.value.add(song._id);
    setTimeout(() => { highlightedSongIds.value.delete(song._id); }, 2400);

    if (status.value && status.value !== next) {
      songs.value = songs.value.filter((s) => s._id !== song._id);
    }
    toasts.success(
      next === 'published' ? `Objavljeno: ${song.title}` : `Skinuto s objave: ${song.title}`,
      { detail: song.artist?.name }
    );
  } catch (err) {
    song.status = previous;
    toasts.error(err.response?.data?.message || 'Promjena statusa nije uspjela.', {
      detail: song.title
    });
  } finally {
    busyId.value = null;
  }
}

function playTonic(keyName, e) {
  if (e) e.stopPropagation();
  if (!keyName) return;
  try {
    const fingering = findFingering(keyName.trim());
    if (fingering && fingering.frets) {
      strum(fingering.frets, { direction: 'down', volume: 0.7 });
    }
  } catch (err) {
    console.warn('Greška pri reprodukciji akorda:', err);
  }
}

function turn(to) {
  page.value = to;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- TOP BAR: Title, Live Stats, View Switcher & Action Button -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Pjesme
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Katalog pjesama, harmonizacija, ChordPro stihovi i tonaliteti.
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <!-- View Mode Switcher [Grid / Table] -->
        <div class="flex items-center rounded-xl border border-line-strong bg-panel p-1 shadow-2xs">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer"
            :class="viewMode === 'grid' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
            title="Prikaz u obliku kartica"
            @click="setViewMode('grid')"
          >
            <IconGridView class="text-sm" />
            <span class="hidden sm:inline">Mreža</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer"
            :class="viewMode === 'table' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
            title="Prikaz u obliku tabele"
            @click="setViewMode('table')"
          >
            <IconTableView class="text-sm" />
            <span class="hidden sm:inline">Tabela</span>
          </button>
        </div>

        <RouterLink
          :to="{ name: 'song-new' }"
          class="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs sm:text-sm font-bold text-on-ink hover:bg-accent transition shadow-md active:scale-95 cursor-pointer"
        >
          <IconAdd class="text-base" />
          <span>Nova pjesma</span>
        </RouterLink>
      </div>
    </div>

    <!-- QUICK STATS INSIGHT TILES (Click-to-Filter) -->
    <div class="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <!-- Tile 1: All Songs -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          status === '' && tag === '' && !searchQuery ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconMusic class="text-sm text-accent" /> Ukupno pjesama
          </span>
          <span class="text-[10px] text-faint font-mono">Katalog</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ meta ? meta.total : '…' }}
          </span>
          <span class="text-[11px] text-faint">u bazi</span>
        </div>
      </div>

      <!-- Tile 2: Published -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          status === 'published' ? 'border-ok ring-2 ring-ok/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('published')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCheckCircle class="text-sm text-ok" /> Objavljeno
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">Aktivno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ status === 'published' && meta ? meta.total : (meta?.total || '…') }}
          </span>
          <span class="text-[11px] text-faint">na sajtu</span>
        </div>
      </div>

      <!-- Tile 3: Drafts -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          status === 'draft' ? 'border-warn ring-2 ring-warn/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('draft')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconPending class="text-sm text-warn" /> Na čekanju
          </span>
          <span class="text-[10px] text-warn font-bold font-mono">Skice</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-warn" :class="{ 'animate-count-bump': statsPopping }">
            {{ status === 'draft' && meta ? meta.total : 'Skice' }}
          </span>
          <span class="text-[11px] text-faint">u pripremi</span>
        </div>
      </div>

      <!-- Tile 4: Needs Chords / Check -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          tag === 'bez-akorda' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setTag('bez-akorda')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconWarning class="text-sm text-accent" /> Bez akorda
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Za obradu</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-accent" :class="{ 'animate-count-bump': statsPopping }">
            {{ tag === 'bez-akorda' && meta ? meta.total : 'Za obradu' }}
          </span>
          <span class="text-[11px] text-faint">za dopunu</span>
        </div>
      </div>
    </div>

    <!-- EX-YU ALPHABET SCRUBBER BAR -->
    <div class="mb-4 rounded-2xl border border-line bg-panel/70 p-2 shadow-2xs">
      <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          v-for="letter in ALPHABET"
          :key="letter"
          type="button"
          class="shrink-0 min-w-7 h-7 px-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
          :class="activeLetter === letter
            ? 'bg-accent text-on-accent shadow-xs scale-105'
            : 'text-muted hover:text-ink hover:bg-raised/80'"
          @click="setLetter(letter)"
        >
          {{ letter }}
        </button>
      </div>
    </div>

    <!-- FILTER TABS & SEARCH CONTROLS -->
    <div class="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line pb-4 text-xs sm:text-sm">
      <!-- Status and Tag Chips -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        <button
          v-for="filter in FILTERS"
          :key="filter.key"
          type="button"
          class="shrink-0 rounded-xl px-3 py-1.5 transition font-bold cursor-pointer select-none"
          :class="status === filter.key && tag === '' && !searchQuery
            ? 'bg-ink text-on-ink shadow-xs'
            : 'text-muted hover:text-accent hover:bg-raised'"
          @click="setFilter(filter.key)"
        >
          {{ filter.label }}
        </button>

        <span class="mx-1 self-center h-4 w-px bg-line shrink-0" aria-hidden="true" />

        <button
          v-for="t in TAGS"
          :key="t.key"
          type="button"
          class="shrink-0 rounded-xl border px-2.5 py-1 text-xs transition font-semibold cursor-pointer select-none"
          :class="tag === t.key && !searchQuery
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line-strong text-muted hover:border-accent hover:text-accent'"
          @click="setTag(t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Search Input with Clear Button -->
      <div class="relative w-full md:w-72">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-base" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Pretraži po naslovu ili izvođaču…"
          class="w-full rounded-xl border border-line-strong bg-panel py-2 pl-9 pr-8 text-xs font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition shadow-2xs"
          @input="onSearchInput"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1 transition"
          aria-label="Obriši pretragu"
          @click="clearSearch"
        >
          <IconClose class="text-xs" />
        </button>
      </div>
    </div>

    <!-- Search Suggestion Banner -->
    <div
      v-if="suggestion && !loading"
      class="mb-4 rounded-xl border border-accent/30 bg-accent-soft/20 p-3 text-xs sm:text-sm text-ink flex items-center justify-between gap-2"
    >
      <span>
        Nema tačnih pogodaka. Prikazano za:
        <button
          type="button"
          class="font-bold text-accent underline underline-offset-2 hover:no-underline cursor-pointer"
          @click="useSuggestion"
        >
          {{ suggestion }}
        </button>
      </span>
      <button
        type="button"
        class="text-muted hover:text-ink text-xs font-semibold cursor-pointer"
        @click="clearSearch"
      >
        Poništi
      </button>
    </div>

    <!-- SKELETON LOADER -->
    <SkeletonLoader v-if="loading" type="table" :rows="8" :cols="6" />

    <!-- EMPTY STATE -->
    <div
      v-else-if="!songs.length"
      class="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-line bg-panel my-4 shadow-2xs"
    >
      <div class="size-14 rounded-2xl bg-raised flex items-center justify-center text-muted mb-3">
        <IconMusic class="text-3xl text-faint" />
      </div>
      <p class="font-bold text-base text-ink">Nema pronađenih pjesama</p>
      <p class="text-xs text-muted max-w-sm mt-1">
        {{ searchQuery ? `Nijedna pjesma ne odgovara pretrazi „${searchQuery}”.` : 'Trenutno nema zapisa sa odabranim kriterijumima.' }}
      </p>
      <button
        v-if="searchQuery || tag || status || activeLetter !== 'Sve'"
        type="button"
        class="mt-4 rounded-xl border border-line-strong bg-surface px-4 py-2 text-xs font-bold text-ink hover:border-accent hover:text-accent transition shadow-2xs cursor-pointer"
        @click="clearSearch"
      >
        Poništi sve filtere
      </button>
    </div>

    <!-- MAIN SONGS CONTENT -->
    <div v-else>
      <!-- VIEW MODE 1: MODERN GRID CARDS -->
      <div
        v-if="viewMode === 'grid'"
        class="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <article
          v-for="song in songs"
          :key="song._id"
          class="group relative flex flex-col justify-between rounded-2xl border border-line bg-panel p-4 shadow-sm hover:border-accent/60 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
          :class="highlightedSongIds.has(song._id) ? 'animate-live-flash ring-2 ring-accent' : ''"
          @click="edit(song)"
        >
          <!-- Top Row: Checkbox, Title & Artist Info -->
          <div>
            <div class="flex items-start justify-between gap-2.5">
              <div class="flex items-start gap-2.5 min-w-0 flex-1">
                <!-- Checkbox -->
                <div class="pt-0.5" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selected.has(song._id)"
                    class="size-4 rounded accent-accent cursor-pointer"
                    :aria-label="`Izaberi ${song.title}`"
                    @change="toggle(song._id)"
                  />
                </div>

                <!-- Title & Artist -->
                <div class="min-w-0 flex-1">
                  <h3 class="font-bold text-sm text-ink group-hover:text-accent transition-colors leading-snug line-clamp-2">
                    {{ song.title }}
                  </h3>
                  <p class="text-xs text-muted truncate mt-0.5 font-medium flex items-center gap-1">
                    <IconArtist class="text-xs text-faint shrink-0" />
                    <span>{{ song.artist?.name || 'Nepoznat izvođač' }}</span>
                  </p>
                </div>
              </div>

              <!-- Status Badge -->
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="song.status === 'published' ? 'bg-ok-soft text-ok border border-ok/20' : 'bg-warn-soft text-warn border border-warn/20'"
              >
                {{ song.status === 'published' ? 'Objavljeno' : 'Na čekanju' }}
              </span>
            </div>

            <!-- Tonalitet, Capo & Genre Tags -->
            <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <!-- Key Signature / Tonalitet with sound preview -->
              <button
                v-if="song.originalKey"
                type="button"
                class="flex items-center gap-1 rounded-lg border border-accent/30 bg-accent-soft/70 px-2 py-0.5 font-mono text-xs font-bold text-accent hover:scale-105 active:scale-95 transition cursor-pointer shadow-2xs"
                :title="`Poslušaj osnovni akord tonaliteta: ${song.originalKey}`"
                @click="playTonic(song.originalKey, $event)"
              >
                <IconVolume class="text-[11px]" :class="{ 'animate-ping': playingChord === song.originalKey }" />
                <span>{{ song.originalKey }}</span>
              </button>

              <span
                v-if="song.capo"
                class="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted border border-line-soft"
                title="Kapodaster"
              >
                Capo {{ song.capo }}
              </span>

              <!-- Genre badges -->
              <span
                v-for="g in (song.genres || []).slice(0, 2)"
                :key="g.slug || g"
                class="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted truncate max-w-[90px]"
              >
                {{ g.name || g }}
              </span>
            </div>
          </div>

          <!-- Bottom Row: Quick Actions -->
          <div class="mt-3.5 pt-2.5 border-t border-line-soft flex items-center justify-between gap-2" @click.stop>
            <div class="text-[11px] text-faint font-mono truncate">
              {{ (song.genres || []).length > 2 ? `+${(song.genres || []).length - 2} žanra` : 'Ex-Yu' }}
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-lg border border-line-strong bg-surface text-muted hover:border-accent hover:text-accent active:scale-90 transition cursor-pointer shadow-2xs"
                title="Uredi pjesmu"
                @click="edit(song)"
              >
                <IconEdit class="text-sm" />
              </button>

              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-lg border border-line-strong bg-surface text-muted active:scale-90 transition cursor-pointer shadow-2xs"
                :class="song.status === 'published' ? 'hover:border-warn hover:text-warn' : 'hover:border-ok hover:text-ok'"
                :title="song.status === 'published' ? 'Skini s objave' : 'Objavi pjesmu'"
                :disabled="busyId === song._id"
                @click="toggleStatus(song, $event)"
              >
                <component :is="song.status === 'published' ? IconUnpublish : IconPublish" class="text-sm" />
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- VIEW MODE 2: HIGH-DENSITY SPOTIFY/LINEAR DATA TABLE -->
      <div
        v-else
        class="rounded-2xl border border-line bg-panel overflow-hidden shadow-sm"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-line bg-raised/40 text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th class="w-10 py-3 px-4" aria-label="Odabir" />
                <th class="py-3 px-4">Naslov</th>
                <th class="py-3 px-4">Izvođač</th>
                <th class="py-3 px-4 text-center">Tonalitet</th>
                <th class="py-3 px-4">Rubrika / Žanrovi</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-right">Radnje</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line-soft">
              <tr
                v-for="song in songs"
                :key="song._id"
                class="group hover:bg-raised/60 transition-all duration-200 cursor-pointer"
                :class="[
                  selected.has(song._id) ? 'bg-accent-soft/30' : '',
                  highlightedSongIds.has(song._id) ? 'animate-live-flash' : ''
                ]"
                @click="edit(song)"
              >
                <!-- Checkbox -->
                <td class="py-3 px-4" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selected.has(song._id)"
                    class="accent-accent cursor-pointer"
                    :aria-label="`Izaberi ${song.title}`"
                    @change="toggle(song._id)"
                  />
                </td>

                <!-- Song Title -->
                <td class="py-3 px-4">
                  <span class="font-bold text-ink group-hover:text-accent transition-colors block">
                    {{ song.title }}
                  </span>
                </td>

                <!-- Artist -->
                <td class="py-3 px-4 text-muted font-medium">
                  {{ song.artist?.name || '—' }}
                </td>

                <!-- Tonalitet & Play sound button -->
                <td class="py-3 px-4 text-center" @click.stop>
                  <button
                    v-if="song.originalKey"
                    type="button"
                    class="inline-flex items-center gap-1 font-mono text-accent font-bold bg-accent-soft/70 px-2 py-0.5 rounded-lg text-xs border border-accent/20 hover:scale-105 active:scale-95 transition cursor-pointer shadow-2xs"
                    :title="`Poslušaj akord ${song.originalKey}`"
                    @click="playTonic(song.originalKey, $event)"
                  >
                    <IconVolume class="text-[10px]" :class="{ 'animate-ping': playingChord === song.originalKey }" />
                    <span>{{ song.originalKey }}</span>
                  </button>
                  <span v-else class="text-faint font-mono">—</span>
                </td>

                <!-- Rubrika & Genres -->
                <td class="py-3 px-4 text-xs text-muted">
                  <div v-if="song.genres?.length" class="flex flex-wrap gap-1 max-w-[200px]">
                    <span
                      v-for="g in song.genres.slice(0, 2)"
                      :key="g.slug || g"
                      class="rounded-md bg-raised px-1.5 py-0.2 text-[10px] font-medium text-muted"
                    >
                      {{ g.name || g }}
                    </span>
                    <span v-if="song.genres.length > 2" class="text-[10px] text-faint">
                      +{{ song.genres.length - 2 }}
                    </span>
                  </div>
                  <span v-else class="text-faint">—</span>
                </td>

                <!-- Status Badge -->
                <td class="py-3 px-4 text-center">
                  <span
                    class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="song.status === 'published' ? 'bg-ok-soft text-ok border border-ok/20' : 'bg-warn-soft text-warn border border-warn/20'"
                  >
                    {{ song.status === 'published' ? 'Objavljeno' : 'Na čekanju' }}
                  </span>
                </td>

                <!-- Action Buttons -->
                <td class="py-3 px-4 text-right" @click.stop>
                  <div class="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      class="rounded-lg border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent transition shadow-2xs cursor-pointer flex items-center gap-1"
                      title="Otvori uređivač"
                      @click="edit(song)"
                    >
                      <IconEdit class="text-xs" />
                      <span>Uredi</span>
                    </button>

                    <button
                      type="button"
                      class="rounded-lg border px-2.5 py-1 text-xs transition disabled:opacity-40 cursor-pointer shadow-2xs"
                      :class="song.status === 'published'
                        ? 'border-line-strong bg-panel text-muted hover:border-warn hover:text-warn'
                        : 'border-line-strong bg-panel text-muted hover:border-ok hover:text-ok'"
                      :disabled="busyId === song._id"
                      :title="song.status === 'published' ? 'Skini s objave' : 'Objavi'"
                      @click="toggleStatus(song, $event)"
                    >
                      <span class="flex items-center gap-1">
                        <component :is="song.status === 'published' ? IconUnpublish : IconPublish" class="text-xs" />
                        <span>{{ song.status === 'published' ? 'Skini' : 'Objavi' }}</span>
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- BULK ACTIONS FLOATING BAR -->
    <BulkBar
      v-if="selectedIds.length"
      :ids="selectedIds"
      :genres="genres"
      :can-delete="auth.hasRole('admin')"
      @done="afterBulk"
      @clear="selected = new Set()"
    />

    <!-- PAGINATION BAR -->
    <nav
      v-if="meta && meta.pages > 1"
      class="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm select-none"
    >
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3.5 py-2 font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-30 transition shadow-2xs active:scale-95 cursor-pointer"
        :disabled="page <= 1"
        @click="turn(page - 1)"
      >
        <IconPrev class="text-base" />
        <span>Prethodna</span>
      </button>

      <span class="font-mono text-xs font-bold text-muted bg-raised px-3 py-1.5 rounded-xl border border-line-soft">
        Stranica {{ meta.page }} od {{ meta.pages }}
      </span>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3.5 py-2 font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-30 transition shadow-2xs active:scale-95 cursor-pointer"
        :disabled="page >= meta.pages"
        @click="turn(page + 1)"
      >
        <span>Sljedeća</span>
        <IconNext class="text-base" />
      </button>
    </nav>
  </section>
</template>

