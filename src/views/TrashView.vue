<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
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
      const { data } = await client.get('/songs', {
        params: { status: 'deleted', page: page.value, limit: 25 }
      });
      songs.value = data.songs;
      meta.value = data.meta;
    } else {
      const { data } = await client.get('/artists', {
        params: { status: 'deleted', page: page.value, limit: 25 }
      });
      artists.value = data.artists;
      meta.value = data.meta;
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

    page.value = 1;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Pražnjenje nije uspjelo.');
  } finally {
    emptyBusy.value = false;
  }
}
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">
        Kanta
        <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-faint">{{ meta.total }}</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Obrisano se ne prikazuje na sajtu, ali stoji ovdje dok ga neko ne ukloni trajno.
      </p>
    </div>

    <button
      v-if="auth.hasRole('superadmin')"
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 rounded border border-line-strong px-3 py-1.5 text-sm text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-40"
      :disabled="loading || !meta?.total"
      @click="askEmpty"
    ><IconPurge /> Očisti kantu</button>
  </div>

  <div class="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
    <button
      v-for="t in TABS" :key="t.key"
      class="rounded px-3 py-1 transition"
      :class="tab === t.key ? 'bg-panel font-semibold text-accent shadow-xs' : 'text-muted hover:text-ink'"
      @click="pick(t.key)"
    >{{ t.label }}</button>
  </div>

  <SkeletonLoader v-if="loading" type="table" :rows="6" :cols="5" />
  <p v-else-if="tab === 'songs' ? !songs.length : !artists.length" class="text-sm text-muted">Kanta je prazna.</p>

  <table v-else-if="tab === 'songs'" class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="py-2">Naslov</th>
        <th class="py-2">Izvođač</th>
        <th class="py-2">Obrisao</th>
        <th class="py-2">Kada</th>
        <th class="py-2 text-right">Radnja</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="song in songs" :key="song._id" class="border-b border-line-soft">
        <td class="py-2.5 font-medium">{{ song.title }}</td>
        <td class="py-2.5 text-muted">{{ song.artist?.name || '—' }}</td>
        <td class="py-2.5 text-muted">{{ song.deletedBy?.name || '—' }}</td>
        <td class="py-2.5 font-mono text-xs text-faint">{{ when(song.deletedAt) }}</td>
        <td class="py-2.5">
          <div class="flex justify-end gap-2">
            <button
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-ok hover:text-ok disabled:opacity-40"
              :disabled="busyId === song._id"
              @click="restore(song)"
            ><IconRestore /> Vrati</button>

            <button
              v-if="auth.hasRole('superadmin')"
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-danger hover:text-danger disabled:opacity-40"
              :disabled="busyId === song._id"
              @click="askPurge(song)"
            ><IconPurge /> Ukloni trajno</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <table v-else class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="py-2">Izvođač</th>
        <th class="py-2">Pjesama</th>
        <th class="py-2">Obrisao</th>
        <th class="py-2">Kada</th>
        <th class="py-2 text-right">Radnja</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="artist in artists" :key="artist._id" class="border-b border-line-soft">
        <td class="py-2.5 font-medium">{{ artist.name }}</td>
        <td class="py-2.5 text-muted font-mono text-xs">{{ artist.songCount || 0 }}</td>
        <td class="py-2.5 text-muted">{{ artist.deletedBy?.name || '—' }}</td>
        <td class="py-2.5 font-mono text-xs text-faint">{{ when(artist.deletedAt) }}</td>
        <td class="py-2.5">
          <div class="flex justify-end gap-2">
            <button
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-ok hover:text-ok disabled:opacity-40"
              :disabled="busyId === artist._id"
              @click="restoreArtist(artist)"
            ><IconRestore /> Vrati</button>

            <button
              v-if="auth.hasRole('superadmin')"
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-danger hover:text-danger disabled:opacity-40"
              :disabled="busyId === artist._id"
              @click="purgingArtist = artist"
            ><IconPurge /> Ukloni trajno</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

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
    <div v-if="purging" class="mt-4">
      <label class="block text-xs text-muted mb-1">
        Upišite naslov pjesme za potvrdu: <strong class="text-ink select-all">{{ purging.title }}</strong>
      </label>
      <input
        v-model="typed"
        type="text"
        class="w-full rounded border border-line-strong bg-panel px-3 py-2 text-sm outline-none focus:border-danger"
        placeholder="Upišite tačan naslov…"
      />
    </div>
  </AppModal>

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
      <div v-if="pending" class="rounded bg-raised p-3 text-xs text-muted">
        Stavke za trajno brisanje:
        <span class="font-mono font-semibold text-ink">{{ pending.songs || 0 }}</span> pjesama,
        <span class="font-mono font-semibold text-ink">{{ pending.artists || 0 }}</span> izvođača.
      </div>
      <div>
        <label class="block text-xs text-muted mb-1">
          Upišite <strong class="text-danger">SIGURAN SAM</strong> za potvrdu:
        </label>
        <input
          v-model="phrase"
          type="text"
          class="w-full rounded border border-line-strong bg-panel px-3 py-2 text-sm uppercase outline-none focus:border-danger"
          placeholder="SIGURAN SAM"
        />
      </div>
    </div>
  </AppModal>
</template>
