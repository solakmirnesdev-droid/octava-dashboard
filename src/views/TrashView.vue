<script setup>
import { ref, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
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

async function purge(song) {
  // The only irreversible action left in the tool, so it asks for the title
  // rather than a yes: a confirm dialog is muscle memory by the second one.
  const typed = window.prompt(
    `Trajno ukloniti "${song.title}"?\n\n`
    + 'Ovo se ne može poništiti — ocjene i recenzije nestaju s pjesmom.\n'
    + 'Upiši naslov pjesme da potvrdiš:'
  );
  if (typed === null) return;

  if (typed.trim() !== song.title.trim()) {
    return toasts.error('Naslov se ne poklapa. Ništa nije uklonjeno.');
  }

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
              @click="purge(song)"
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
</template>
