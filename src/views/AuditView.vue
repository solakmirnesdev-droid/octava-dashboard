<script setup>
import { ref, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';

const toasts = useToasts();

const entries = ref([]);
const meta = ref(null);
const loading = ref(true);
const facets = ref({ actions: [], entities: [] });

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
  create: 'bg-ok-soft text-ok',
  restore: 'bg-ok-soft text-ok',
  unhide: 'bg-ok-soft text-ok',
  'print.store': 'bg-ok-soft text-ok',
  'subscription.grant': 'bg-ok-soft text-ok',
  'arrangement.create': 'bg-ok-soft text-ok',
  'arrangement.restore': 'bg-ok-soft text-ok',
  'arrangement.primary': 'bg-accent-soft text-accent',
  'image.upload': 'bg-ok-soft text-ok',
  update: 'bg-raised text-muted',
  'arrangement.update': 'bg-raised text-muted',
  delete: 'bg-warn-soft text-warn',
  'print.remove': 'bg-warn-soft text-warn',
  'arrangement.delete': 'bg-warn-soft text-warn',
  'image.remove': 'bg-warn-soft text-warn',
  hide: 'bg-warn-soft text-warn',
  purge: 'bg-danger-soft text-danger',
  bulk: 'bg-raised text-muted'
};

const when = (iso) => new Date(iso).toLocaleString('bs');

/** Empty arrays and nulls have to read as something, not as a blank cell. */
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
    // The filters just stay empty; the list itself is the point.
  }
});

function filter() {
  page.value = 1;
  load();
}

function turn(to) {
  page.value = to;
  load();
}
</script>

<template>
  <div class="mb-6">
    <h1 class="text-xl font-semibold tracking-tight">
      Trag izmjena
      <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-faint">{{ meta.total }}</span>
    </h1>
    <p class="mt-1 text-sm text-muted">
      Ko je šta promijenio i kako je izgledalo prije. Zapisi se ne mogu mijenjati ni brisati.
    </p>
  </div>

  <div class="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
    <select
      v-model="entity"
      class="rounded border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent"
      aria-label="Vrsta zapisa" @change="filter"
    >
      <option value="">Sve vrste</option>
      <option v-for="e in facets.entities" :key="e" :value="e">{{ ENTITIES[e] || e }}</option>
    </select>

    <select
      v-model="action"
      class="rounded border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent"
      aria-label="Radnja" @change="filter"
    >
      <option value="">Sve radnje</option>
      <option v-for="a in facets.actions" :key="a" :value="a">{{ ACTIONS[a] || a }}</option>
    </select>
  </div>

  <SkeletonLoader v-if="loading" type="list" :rows="8" />
  <p v-else-if="!entries.length" class="text-sm text-muted">Nema zapisa za ovaj filter.</p>

  <ul v-else class="space-y-2">
    <li
      v-for="entry in entries" :key="entry._id"
      class="rounded-lg border border-line bg-panel p-3 text-sm"
    >
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="TONE[entry.action] || 'bg-raised text-muted' || 'bg-raised text-muted'"
        >{{ ACTIONS[entry.action] || entry.action }}</span>

        <span class="text-xs text-faint">{{ ENTITIES[entry.entity] || entry.entity }}</span>

        <span class="font-medium text-ink">
          {{ entry.summary?.title || entry.summary?.name || entry.entityId }}
        </span>

        <span v-if="entry.summary?.artist" class="text-xs text-muted">
          ({{ entry.summary.artist }})
        </span>

        <span class="ml-auto text-xs text-muted">
          {{ entry.actor?.name || entry.actor?.email || 'Sistem' }}
        </span>

        <span class="font-mono text-xs text-faint">
          {{ when(entry.createdAt) }}
        </span>
      </div>

      <div v-if="entry.changes && Object.keys(entry.changes).length" class="mt-2 text-xs">
        <div
          v-for="(diff, key) in entry.changes" :key="key"
          class="mt-1 font-mono text-muted"
        >
          <span class="font-sans font-medium text-ink">{{ FIELDS[key] || key }}:</span>
          <span class="text-warn line-through ml-1">{{ show(diff.from) }}</span>
          <span class="mx-1 text-faint">→</span>
          <span class="text-ok font-medium">{{ show(diff.to) }}</span>
        </div>
      </div>
    </li>
  </ul>

  <nav v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page <= 1" @click="turn(page - 1)"
    ><span class="flex items-center gap-1"><IconPrev /> Prethodna</span></button>
    <span class="text-muted">{{ meta.page }} / {{ meta.pages }}</span>
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page >= meta.pages" @click="turn(page + 1)"
    ><span class="flex items-center gap-1">Sljedeća <IconNext /></span></button>
  </nav>
</template>
