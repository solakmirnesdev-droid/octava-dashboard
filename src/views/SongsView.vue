<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
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

const page = ref(1);
const status = ref('');

const FILTERS = [
  { key: '', label: 'Sve' },
  { key: 'published', label: 'Objavljeno' },
  { key: 'draft', label: 'Na čekanju' }
];

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/songs', {
      params: { page: page.value, limit: 25, status: status.value || undefined }
    });
    songs.value = data.songs || [];
    meta.value = data.meta;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

watch([page, status], load);
onMounted(load);

function setFilter(key) {
  status.value = key;
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
      <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-black/40">{{ meta.total }}</span>
    </h1>
    <RouterLink
      :to="{ name: 'song-new' }"
      class="flex items-center gap-1.5 rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
    >
      <IconAdd /> Nova pjesma
    </RouterLink>
  </div>

  <div class="mb-4 flex gap-2 border-b border-black/10 pb-3 text-sm">
    <button
      v-for="filter in FILTERS" :key="filter.key"
      class="rounded px-3 py-1"
      :class="status === filter.key ? 'bg-ink text-white' : 'text-black/55 hover:text-accent'"
      @click="setFilter(filter.key)"
    >{{ filter.label }}</button>
  </div>

  <p v-if="loading" class="text-sm text-black/50">Učitavanje…</p>
  <p v-else-if="!songs.length" class="text-sm text-black/50">Nema pjesama za ovaj filter.</p>

  <table v-else class="w-full text-sm">
    <thead class="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/40">
      <tr>
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
        class="group cursor-pointer border-b border-black/5 hover:bg-black/[0.02]"
        @click="edit(song)"
      >
        <td class="py-2.5">
          <span class="font-medium underline decoration-black/15 decoration-dotted underline-offset-4 group-hover:text-accent group-hover:decoration-accent/40">
            {{ song.title }}
          </span>
        </td>
        <td class="py-2.5 text-black/60">{{ song.artist?.name }}</td>
        <td class="py-2.5 font-mono text-black/60">{{ song.originalKey }}</td>
        <td class="py-2.5">
          <span
            class="rounded px-2 py-0.5 text-xs"
            :class="song.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'"
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
              ? 'border-black/15 text-black/60 hover:border-amber-500 hover:text-amber-700'
              : 'border-black/15 text-black/60 hover:border-green-600 hover:text-green-700'"
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

  <nav v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button
      class="rounded border border-black/15 px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page <= 1" @click="page--"
    ><span class="flex items-center gap-1"><IconPrev /> Prethodna</span></button>
    <span class="text-black/50">{{ meta.page }} / {{ meta.pages }}</span>
    <button
      class="rounded border border-black/15 px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page >= meta.pages" @click="page++"
    ><span class="flex items-center gap-1">Sljedeća <IconNext /></span></button>
  </nav>
</template>
