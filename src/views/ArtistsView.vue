<script setup>
import { ref, onMounted } from 'vue';
import client from '../api/client';

const artists = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const { data } = await client.get('/artists');
    artists.value = data.artists || [];
  } catch (err) {
    error.value = err.response?.data?.message || 'Učitavanje nije uspjelo.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <h1 class="mb-6 text-xl font-semibold tracking-tight">Izvođači</h1>

  <p v-if="loading" class="text-sm text-black/50">Učitavanje…</p>
  <p v-else-if="error" class="text-sm text-accent">{{ error }}</p>
  <p v-else-if="!artists.length" class="text-sm text-black/50">Još nema izvođača.</p>

  <ul v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <li
      v-for="artist in artists" :key="artist._id"
      class="rounded border border-black/10 bg-white px-4 py-3"
    >
      <p class="font-medium">{{ artist.name }}</p>
      <p class="text-xs text-black/50">{{ artist.songCount || 0 }} pjesama</p>
    </li>
  </ul>
</template>
