<script setup>
import { ref, onMounted } from 'vue';
import client from '../api/client';

const songs = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const { data } = await client.get('/songs', { params: { limit: 50 } });
    songs.value = data.songs || [];
  } catch (err) {
    error.value = err.response?.data?.message || 'Učitavanje nije uspjelo.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-xl font-semibold tracking-tight">Pjesme</h1>
    <RouterLink
      :to="{ name: 'song-new' }"
      class="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
    >
      Nova pjesma
    </RouterLink>
  </div>

  <p v-if="loading" class="text-sm text-black/50">Učitavanje…</p>
  <p v-else-if="error" class="text-sm text-accent">{{ error }}</p>
  <p v-else-if="!songs.length" class="text-sm text-black/50">
    Još nema unesenih pjesama.
  </p>

  <table v-else class="w-full text-sm">
    <thead class="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/40">
      <tr>
        <th class="py-2">Naslov</th>
        <th class="py-2">Izvođač</th>
        <th class="py-2">Tonalitet</th>
        <th class="py-2">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="song in songs" :key="song._id" class="border-b border-black/5 hover:bg-black/[0.02]">
        <td class="py-2.5">
          <RouterLink :to="{ name: 'song-edit', params: { id: song._id } }" class="hover:text-accent">
            {{ song.title }}
          </RouterLink>
        </td>
        <td class="py-2.5 text-black/60">{{ song.artist?.name }}</td>
        <td class="py-2.5 font-mono text-black/60">{{ song.originalKey }}</td>
        <td class="py-2.5">
          <span
            class="rounded px-2 py-0.5 text-xs"
            :class="song.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-black/5 text-black/50'"
          >
            {{ song.status === 'published' ? 'Objavljeno' : 'Skica' }}
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
