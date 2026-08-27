<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import AppModal from '../components/AppModal.vue';
import IconRestore from '~icons/material-symbols/restore-from-trash-rounded';
import IconPurge from '~icons/material-symbols/delete-forever-outline-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';

/**
 * Songs that were deleted but not destroyed.
 *
 * AI-NOTE: this view is the reason deleting is safe to do. Without somewhere to
 * see and undo it, a soft delete is just a hidden record nobody knows how to get
 * back — which is worse than a hard one, because it looks like data loss and is
 * not. See AI-NOTES.md §5.
 */
const toasts = useToasts();
const auth = useAuthStore();

const songs = ref([]);
const meta = ref(null);
const loading = ref(true);
const busyId = ref(null);
const page = ref(1);

const when = (iso) => (iso ? new Date(iso).toLocaleString('bs') : '—');

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/songs/trash', { params: { page: page.value, limit: 25 } });
    songs.value = data.songs || [];
    meta.value = data.meta;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje korpe nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

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

/**
 * The only irreversible action left in the tool.
 *
 * AI-DECISION: it asks for the title to be typed rather than for a yes. A
 * confirm is muscle memory by the second one, and this takes the song's ratings
 * and reviews with it. Typing the title is a deliberate act that cannot be done
 * by reflex — and the dialog can show the title beside the field, which a
 * window.prompt could not.
 */
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
</script>

<template>
  <div class="mb-6">
    <h1 class="text-xl font-semibold tracking-tight">
      Korpa
      <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-faint">{{ meta.total }}</span>
    </h1>
    <p class="mt-1 text-sm text-muted">
      Obrisane pjesme se ne prikazuju na sajtu, ali su i dalje ovdje dok ih neko ne ukloni trajno.
    </p>
  </div>

  <p v-if="loading" class="text-sm text-muted">Učitavanje…</p>
  <p v-else-if="!songs.length" class="text-sm text-muted">Korpa je prazna.</p>

  <table v-else class="w-full text-sm">
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

            <!-- Superadmin only, matching the endpoint. Hiding it from everyone
                 else keeps the button from being a permission error waiting to
                 happen. -->
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
    title="Trajno ukloniti?"
    description="Ovo se ne može poništiti. Ocjene i recenzije nestaju zajedno s pjesmom."
    confirm-label="Ukloni trajno"
    tone="danger"
    :confirm-disabled="!titleMatches"
    :busy="Boolean(busyId)"
    @update:model-value="(open) => { if (!open) purging = null; }"
    @confirm="purge"
  >
    <label for="confirm-title" class="mb-1 block text-xs text-faint">
      Upiši naslov da potvrdiš:
    </label>
    <p class="mb-2 font-medium">{{ purging?.title }}</p>
    <input
      id="confirm-title" v-model="typed" type="text" autocomplete="off"
      class="w-full rounded border px-3 py-2 outline-none"
      :class="titleMatches ? 'border-ok' : 'border-line-strong focus:border-accent'"
      @keyup.enter="titleMatches && purge()"
    >
  </AppModal>
</template>
