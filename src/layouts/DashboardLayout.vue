<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import ToastStack from '../components/ToastStack.vue';
import IconStats from '~icons/material-symbols/bar-chart-rounded';
import IconSongs from '~icons/material-symbols/queue-music-rounded';
import IconArtists from '~icons/material-symbols/artist-rounded';
import IconLogout from '~icons/material-symbols/logout-rounded';

const auth = useAuthStore();
const router = useRouter();

async function signOut() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink">
    <header class="border-b border-black/10 bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <span class="text-lg font-semibold tracking-tight">Octava</span>
        <span class="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Dashboard</span>

        <nav class="flex gap-6 text-sm">
          <RouterLink :to="{ name: 'stats' }" class="flex items-center gap-1.5 hover:text-accent" active-class="text-accent font-medium">
            <IconStats /> Statistika
          </RouterLink>
          <RouterLink :to="{ name: 'songs' }" class="flex items-center gap-1.5 hover:text-accent" active-class="text-accent font-medium">
            <IconSongs /> Pjesme
          </RouterLink>
          <RouterLink :to="{ name: 'artists' }" class="flex items-center gap-1.5 hover:text-accent" active-class="text-accent font-medium">
            <IconArtists /> Izvođači
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-4 text-sm">
          <span class="text-black/50">{{ auth.user?.name || auth.user?.email }}</span>
          <button class="flex items-center gap-1.5 hover:text-accent" @click="signOut">
            <IconLogout /> Odjava
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-8">
      <RouterView />
    </main>

    <ToastStack />
  </div>
</template>
