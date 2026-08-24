<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

function signOut() {
  auth.logout();
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
          <RouterLink :to="{ name: 'songs' }" class="hover:text-accent" active-class="text-accent font-medium">
            Pjesme
          </RouterLink>
          <RouterLink :to="{ name: 'artists' }" class="hover:text-accent" active-class="text-accent font-medium">
            Izvođači
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-4 text-sm">
          <span class="text-black/50">{{ auth.user?.email }}</span>
          <button class="hover:text-accent" @click="signOut">Odjava</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
