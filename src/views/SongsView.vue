<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import BulkBar from '../components/BulkBar.vue';
import IconAdd from '~icons/material-symbols/add-rounded';
import IconPublish from '~icons/material-symbols/visibility-rounded';
import IconUnpublish from '~icons/material-symbols/visibility-off-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';

const router = useRouter();
const toasts = useToasts();

const songs = ref([]);
const meta = ref(null);
const loading = ref(true);
const busyId = ref(null);

const auth = useAuthStore();
const genres = ref([]);

/**
 * The selection, by id.
 *
 * AI-NOTE: cleared whenever the page or filter changes. Carrying it across a
 * filter would let somebody publish rows they can no longer see, which is the
 * one thing a bulk edit must never do.
 */
const selected = ref(new Set());

const selectedIds = computed(() => [...selected.value]);
const allOnPage = computed(() =>
  songs.value.length > 0 && songs.value.every((s) => selected.value.has(s._id))
);

function toggle(id) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
}

function toggleAll() {
  selected.value = allOnPage.value ? new Set() : new Set(songs.value.map((s) => s._id));
}

const page = ref(1);
const status = ref('');
const tag = ref('');

/**
 * The marks an automated import leaves behind.
 *
 * AI-NOTE: without a way to filter on these, the marks are invisible and nobody
 * ever works through them — which is the same as not having written them.
 */
const TAGS = [
  { key: 'bez-akorda', label: 'Bez akorda' },
  { key: 'neprovjereno', label: 'Neprovjereno' },
  { key: 'uvoz', label: 'Iz uvoza' }
];

const FILTERS = [
  { key: '', label: 'Sve' },
  { key: 'published', label: 'Objavljeno' },
  { key: 'draft', label: 'Na čekanju' }
];

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/songs', {
      params: {
        page: page.value, limit: 25,
        status: status.value || undefined,
        tag: tag.value || undefined
      }
    });
    songs.value = data.songs || [];
    meta.value = data.meta;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

watch([page, status, tag], () => {
  selected.value = new Set();
  load();
});

onMounted(async () => {
  await load();
  try {
    const { data } = await client.get('/genres');
    genres.value = data.genres || [];
  } catch {
    // The bulk bar degrades to status and tags; not worth a toast on a list view.
  }
});

async function afterBulk() {
  selected.value = new Set();
  await load();
}

function setFilter(key) {
  status.value = key;
  page.value = 1;
}

function setTag(key) {
  tag.value = tag.value === key ? '' : key;
  page.value = 1;
}

const edit = (song) => router.push({ name: 'song-edit', params: { id: song._id } });

/**
 * Publishing is reversible and instant, so the row updates before the request
 * returns and rolls back if it fails. Waiting on the round trip for something
 * this small makes the whole list feel unresponsive.
 */
async function toggleStatus(song) {
  const previous = song.status;
  const next = previous === 'published' ? 'draft' : 'published';

  song.status = next;
  busyId.value = song._id;

  try {
    await client.put(`/songs/${song._id}`, { status: next });

    // A song filtered out by the change should leave the list it no longer
    // belongs in, rather than sitting there contradicting the filter.
    if (status.value && status.value !== next) {
      songs.value = songs.value.filter((s) => s._id !== song._id);
    }

    // Naming the song matters: the row may have just scrolled away or been
    // filtered out, and "saved" alone does not say what was saved.
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
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-xl font-semibold tracking-tight">
      Pjesme
      <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-faint">{{ meta.total }}</span>
    </h1>
    <RouterLink
      :to="{ name: 'song-new' }"
      class="flex items-center gap-1.5 rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent"
    >
      <IconAdd /> Nova pjesma
    </RouterLink>
  </div>

  <div class="mb-4 flex gap-2 border-b border-line pb-3 text-sm">
    <button
      v-for="filter in FILTERS" :key="filter.key"
      class="rounded px-3 py-1"
      :class="status === filter.key ? 'bg-ink text-on-ink' : 'text-muted hover:text-accent'"
      @click="setFilter(filter.key)"
    >{{ filter.label }}</button>

    <span class="mx-1 self-center h-5 w-px bg-sunken" aria-hidden="true" />

    <button
      v-for="t in TAGS" :key="t.key"
      class="rounded border px-2.5 py-1 text-xs transition"
      :class="tag === t.key
        ? 'border-accent bg-accent-soft text-accent'
        : 'border-line-strong text-muted hover:border-accent hover:text-accent'"
      @click="setTag(t.key)"
    >{{ t.label }}</button>
  </div>

  <p v-if="loading" class="text-sm text-muted">Učitavanje…</p>
  <p v-else-if="!songs.length" class="text-sm text-muted">Nema pjesama za ovaj filter.</p>

  <table v-else class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="w-8 py-2">
          <input
            type="checkbox" :checked="allOnPage" class="accent-accent"
            aria-label="Izaberi sve na stranici" @change="toggleAll"
          >
        </th>
        <th class="py-2">Naslov</th>
        <th class="py-2">Izvođač</th>
        <th class="py-2">Tonalitet</th>
        <th class="py-2">Status</th>
        <th class="py-2 text-right">Radnja</th>
      </tr>
    </thead>
    <tbody>
      <!-- The whole row opens the editor. The title alone gave no sign it was
           clickable, which is why editing looked like it was missing. -->
      <tr
        v-for="song in songs" :key="song._id"
        class="group cursor-pointer border-b border-line-soft hover:bg-raised"
        @click="edit(song)"
      >
        <!-- Stop here, or ticking a box would also open the editor. -->
        <td class="py-2.5" @click.stop>
          <input
            type="checkbox" :checked="selected.has(song._id)" class="accent-accent"
            :aria-label="`Izaberi ${song.title}`" @change="toggle(song._id)"
          >
        </td>
        <td class="py-2.5">
          <span class="font-medium underline decoration-line-strong decoration-dotted underline-offset-4 group-hover:text-accent group-hover:decoration-accent/40">
            {{ song.title }}
          </span>
        </td>
        <td class="py-2.5 text-muted">{{ song.artist?.name }}</td>
        <td class="py-2.5 font-mono text-muted">{{ song.originalKey }}</td>
        <td class="py-2.5">
          <span
            class="rounded px-2 py-0.5 text-xs"
            :class="song.status === 'published' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'"
          >
            {{ song.status === 'published' ? 'Objavljeno' : 'Na čekanju' }}
          </span>
        </td>
        <td class="py-2.5 text-right">
          <!-- Stop the click here, or every status change would also navigate
               away to the editor. -->
          <button
            class="rounded border px-2.5 py-1 text-xs transition disabled:opacity-40"
            :class="song.status === 'published'
              ? 'border-line-strong text-muted hover:border-warn hover:text-warn'
              : 'border-line-strong text-muted hover:border-ok hover:text-ok'"
            :disabled="busyId === song._id"
            :title="song.status === 'published' ? 'Skini s objave' : 'Objavi'"
            @click.stop="toggleStatus(song)"
          >
            <span class="flex items-center gap-1">
              <component :is="song.status === 'published' ? IconUnpublish : IconPublish" />
              {{ song.status === 'published' ? 'Skini s objave' : 'Objavi' }}
            </span>
          </button>
        </td>
      </tr>
    </tbody>
  </table>

  <BulkBar
    v-if="selectedIds.length"
    :ids="selectedIds"
    :genres="genres"
    :can-delete="auth.hasRole('admin')"
    @done="afterBulk"
    @clear="selected = new Set()"
  />

  <nav v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page <= 1" @click="page--"
    ><span class="flex items-center gap-1"><IconPrev /> Prethodna</span></button>
    <span class="text-muted">{{ meta.page }} / {{ meta.pages }}</span>
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page >= meta.pages" @click="page++"
    ><span class="flex items-center gap-1">Sljedeća <IconNext /></span></button>
  </nav>
</template>
