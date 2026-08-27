<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

async function submit() {
  if (await auth.login(email.value, password.value)) {
    router.push(route.query.redirect || { name: 'songs' });
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-6">
    <form class="w-full max-w-sm" @submit.prevent="submit">
      <h1 class="text-2xl font-semibold tracking-tight text-ink">Octava</h1>
      <p class="mt-1 mb-8 text-sm text-muted">Prijava za urednike</p>

      <label class="block text-sm font-medium text-ink">Email</label>
      <input
        v-model="email" type="email" required autocomplete="username"
        class="mt-1 mb-4 w-full rounded border border-line-strong bg-panel px-3 py-2 outline-none focus:border-accent"
      />

      <label class="block text-sm font-medium text-ink">Lozinka</label>
      <input
        v-model="password" type="password" required autocomplete="current-password"
        class="mt-1 mb-6 w-full rounded border border-line-strong bg-panel px-3 py-2 outline-none focus:border-accent"
      />

      <p v-if="auth.error" class="mb-4 text-sm text-accent">{{ auth.error }}</p>

      <button
        type="submit" :disabled="auth.loading"
        class="w-full rounded bg-ink py-2.5 font-medium text-on-ink hover:bg-accent disabled:opacity-50"
      >
        {{ auth.loading ? 'Prijava…' : 'Prijavi se' }}
      </button>
    </form>
  </div>
</template>
