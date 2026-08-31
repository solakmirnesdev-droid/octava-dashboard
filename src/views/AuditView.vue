<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import IconHistory from '~icons/material-symbols/history-rounded';
import IconAdd from '~icons/material-symbols/add-rounded';
import IconEdit from '~icons/material-symbols/edit-outline-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';

const toasts = useToasts();

const entries = ref([]);
const meta = ref(null);
const loading = ref(true);
const facets = ref({ actions: [], entities: [] });
const searchQuery = ref('');
const statsPopping = ref(false);

const page = ref(1);
const action = ref('');
const entity = ref('');

/**
 * Human labels for the verbs and nouns stored in the log.
 */
const ACTIONS = {
  create: 'Kreirano',
  update: 'Izmijenjeno',
  delete: 'Obrisano',
  purge: 'Trajno obrisano',
  restore: 'Vraćeno',
  bulk: 'Grupna izmjena',
  hide: 'Sakriveno',
  unhide: 'Vraćeno u prikaz',
  'print.store': 'Otisak snimljen',
  'print.remove': 'Otisak uklonjen',
  'subscription.grant': 'Dodijeljena pretplata',
  'arrangement.create': 'Verzija dodana',
  'arrangement.update': 'Verzija izmijenjena',
  'arrangement.delete': 'Verzija obrisana',
  'arrangement.restore': 'Verzija vraćena',
  'arrangement.primary': 'Postavljena primarna verzija',
  'image.upload': 'Slika postavljena',
  'image.remove': 'Slika uklonjena'
};

const ENTITIES = {
  Song: 'Pjesma',
  Artist: 'Izvođač',
  StaffUser: 'Nalog',
  User: 'Korisnik',
  Comment: 'Komentar',
  Review: 'Recenzija'
};

/** The tone each verb carries, so a purge does not read like a create. */
const TONE = {
  create: 'bg-ok-soft text-ok border border-ok/20',
  restore: 'bg-ok-soft text-ok border border-ok/20',
  unhide: 'bg-ok-soft text-ok border border-ok/20',
  'print.store': 'bg-ok-soft text-ok border border-ok/20',
  'subscription.grant': 'bg-ok-soft text-ok border border-ok/20',
  'arrangement.create': 'bg-ok-soft text-ok border border-ok/20',
  'arrangement.restore': 'bg-ok-soft text-ok border border-ok/20',
  'arrangement.primary': 'bg-accent-soft text-accent border border-accent/20',
  'image.upload': 'bg-ok-soft text-ok border border-ok/20',
  update: 'bg-raised text-muted border border-line-soft',
  'arrangement.update': 'bg-raised text-muted border border-line-soft',
  delete: 'bg-warn-soft text-warn border border-warn/20',
  'print.remove': 'bg-warn-soft text-warn border border-warn/20',
  'arrangement.delete': 'bg-warn-soft text-warn border border-warn/20',
  'image.remove': 'bg-warn-soft text-warn border border-warn/20',
  hide: 'bg-warn-soft text-warn border border-warn/20',
  purge: 'bg-danger-soft text-danger border border-danger/20',
  bulk: 'bg-raised text-muted border border-line-soft'
};

const when = (iso) => (iso ? new Date(iso).toLocaleString('bs', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function show(value) {
  if (value === null || value === undefined || value === '') return '∅';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '∅';
  return String(value);
}

const FIELDS = {
  title: 'naslov',
  artist: 'izvođač',
  status: 'status',
  genres: 'žanrovi',
  tags: 'tagovi',
  youtubeId: 'video',
  year: 'godina',
  originalKey: 'tonalitet',
  capo: 'kapodaster',
  difficulty: 'težina',
  label: 'naziv',
  content: 'tekst i akordi',
  name: 'ime',
  country: 'zemlja',
  origin: 'porijeklo',
  website: 'sajt',
  activeFrom: 'djeluje od',
  activeTo: 'djeluje do',
  bio: 'biografija',
  role: 'uloga',
  active: 'aktivan'
};

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/audit', {
      params: {
        page: page.value, limit: 30,
        action: action.value || undefined,
        entity: entity.value || undefined
      }
    });
    entries.value = data.entries || [];
    meta.value = data.meta;
    triggerUpdatePulse();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje traga nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  try {
    const { data } = await client.get('/audit/facets');
    facets.value = data;
  } catch {
    // Graceful fallback
  }
});

function setFilter(act, ent) {
  if (act !== undefined) action.value = act;
  if (ent !== undefined) entity.value = ent;
  page.value = 1;
  load();
}

function turn(to) {
  page.value = to;
  load();
}

const filteredEntries = computed(() => {
  if (!searchQuery.value.trim()) return entries.value;
  const q = searchQuery.value.trim().toLowerCase();
  return entries.value.filter((e) =>
    (e.summary?.title || '').toLowerCase().includes(q) ||
    (e.summary?.name || '').toLowerCase().includes(q) ||
    (e.summary?.artist || '').toLowerCase().includes(q) ||
    (e.actor?.name || '').toLowerCase().includes(q) ||
    (e.actor?.email || '').toLowerCase().includes(q) ||
    (ACTIONS[e.action] || '').toLowerCase().includes(q)
  );
});

const createsCount = computed(() => entries.value.filter((e) => e.action === 'create' || e.action.endsWith('.create')).length);
const updatesCount = computed(() => entries.value.filter((e) => e.action === 'update' || e.action.endsWith('.update')).length);
const deletesCount = computed(() => entries.value.filter((e) => e.action === 'delete' || e.action === 'purge' || e.action.endsWith('.delete')).length);
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Revizija i trag izmjena
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Nepromjenjiva hronologija svih izmjena, brisanja, unosa i dodjela u sistemu.
        </p>
      </div>
    </div>

    <!-- Quick Insights Metric Tiles (Interactive Fast Filters) -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <!-- 1. Ukupno akcija -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          action === '' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('', '')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconHistory class="text-sm text-accent" /> Ukupno akcija
          </span>
          <span class="text-[10px] text-faint font-mono">Dnevnik</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ meta ? meta.total : entries.length }}
          </span>
          <span class="text-[11px] text-faint">zapisa</span>
        </div>
      </div>

      <!-- 2. Kreiranja -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          action === 'create' ? 'border-ok ring-2 ring-ok/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('create', entity)"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconAdd class="text-sm text-ok" /> Kreiranja
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">Novo</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ action === 'create' && meta ? meta.total : createsCount }}
          </span>
          <span class="text-[11px] text-faint">stavki</span>
        </div>
      </div>

      <!-- 3. Izmjene -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          action === 'update' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('update', entity)"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconEdit class="text-sm text-accent" /> Izmjene
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Uređivanje</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-accent" :class="{ 'animate-count-bump': statsPopping }">
            {{ action === 'update' && meta ? meta.total : updatesCount }}
          </span>
          <span class="text-[11px] text-faint">izmjena</span>
        </div>
      </div>

      <!-- 4. Brisanja -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          action === 'delete' || action === 'purge' ? 'border-danger ring-2 ring-danger/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setFilter('delete', entity)"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconDelete class="text-sm text-danger" /> Brisanja
          </span>
          <span class="text-[10px] text-danger font-bold font-mono">Uklonjeno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-danger" :class="{ 'animate-count-bump': statsPopping }">
            {{ (action === 'delete' || action === 'purge') && meta ? meta.total : deletesCount }}
          </span>
          <span class="text-[11px] text-faint">brisanja</span>
        </div>
      </div>
    </div>

    <!-- Dropdown Filters & Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Entity Select -->
        <select
          v-model="entity"
          class="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink font-medium outline-none transition hover:border-line-strong focus:border-accent cursor-pointer"
          aria-label="Vrsta zapisa"
          @change="setFilter(action, entity)"
        >
          <option value="">Sve vrste entiteta</option>
          <option v-for="e in facets.entities" :key="e" :value="e">{{ ENTITIES[e] || e }}</option>
        </select>

        <!-- Action Select -->
        <select
          v-model="action"
          class="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink font-medium outline-none transition hover:border-line-strong focus:border-accent cursor-pointer"
          aria-label="Radnja"
          @change="setFilter(action, entity)"
        >
          <option value="">Sve vrste radnji</option>
          <option v-for="a in facets.actions" :key="a" :value="a">{{ ACTIONS[a] || a }}</option>
        </select>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-64">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Pretraži trag izmjena…"
          class="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="list" :rows="8" />

    <div v-else-if="!filteredEntries.length" class="rounded-2xl border border-line bg-panel p-12 text-center shadow-2xs">
      <IconHistory class="mx-auto text-3xl text-dim mb-2" />
      <p class="text-sm font-bold text-ink">Nema zapisa u reviziji</p>
      <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
        {{ searchQuery ? `Nema pronađenih zapisa za pojam „${searchQuery}”.` : 'Nema zabilježenih izmjena za odabrane filtere.' }}
      </p>
    </div>

    <!-- Audit Entries Feed -->
    <div v-else class="space-y-2.5">
      <article
        v-for="entry in filteredEntries"
        :key="entry._id"
        class="rounded-2xl border border-line bg-panel p-4 shadow-2xs transition-all hover:border-line-strong hover:shadow-sm"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line-soft">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="rounded-full px-2 py-0.2 text-[10px] font-bold font-mono"
              :class="TONE[entry.action] || 'bg-raised text-muted border border-line-soft'"
            >
              {{ ACTIONS[entry.action] || entry.action }}
            </span>

            <span class="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-mono font-medium text-faint border border-line-soft">
              {{ ENTITIES[entry.entity] || entry.entity }}
            </span>

            <h2 class="font-bold text-sm text-ink">
              {{ entry.summary?.title || entry.summary?.name || entry.entityId }}
            </h2>

            <span v-if="entry.summary?.artist" class="text-xs text-muted font-medium">
              ({{ entry.summary.artist }})
            </span>
          </div>

          <div class="flex items-center gap-3 text-xs">
            <span class="text-muted font-medium text-[11px]">
              {{ entry.actor?.name || entry.actor?.email || 'Sistem' }}
            </span>
            <span class="font-mono text-[11px] text-faint">
              {{ when(entry.createdAt) }}
            </span>
          </div>
        </div>

        <!-- Diffs & Changes Detail Block -->
        <div v-if="entry.changes && Object.keys(entry.changes).length" class="mt-2.5 bg-surface/60 rounded-xl p-3 border border-line-soft space-y-1.5">
          <div
            v-for="(diff, key) in entry.changes"
            :key="key"
            class="flex items-baseline gap-2 font-mono text-xs text-muted flex-wrap"
          >
            <span class="font-sans font-bold text-ink text-[11px]">{{ FIELDS[key] || key }}:</span>
            <span class="text-danger/80 line-through bg-danger-soft/40 px-1.5 py-0.2 rounded text-[11px]">{{ show(diff.from) }}</span>
            <span class="text-faint">→</span>
            <span class="text-ok font-bold bg-ok-soft/40 px-1.5 py-0.2 rounded text-[11px]">{{ show(diff.to) }}</span>
          </div>
        </div>
      </article>
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
  </section>
</template>
