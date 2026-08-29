<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToasts } from '../composables/useToasts';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconMail from '~icons/material-symbols/mail-outline-rounded';
import IconKey from '~icons/material-symbols/key-rounded';

const email = ref('');
const password = ref('');
const twoFactorCode = ref('');
const challenge = ref(null);
const methods = ref([]);
const resending = ref(false);

const auth = useAuthStore();
const toasts = useToasts();
const route = useRoute();
const router = useRouter();

async function submit() {
  const result = await auth.login(email.value, password.value);
  if (!result) return;

  if (result.twoFactorRequired) {
    challenge.value = result.challenge;
    methods.value = result.methods || [];
    twoFactorCode.value = '';
    return;
  }

  router.push(route.query.redirect || { name: 'songs' });
}

async function verify() {
  if (!twoFactorCode.value.trim() || !challenge.value) return;
  const ok = await auth.loginVerify(challenge.value, twoFactorCode.value.trim());
  if (ok) {
    router.push(route.query.redirect || { name: 'songs' });
  }
}

async function resend() {
  if (!challenge.value || resending.value) return;
  resending.value = true;
  const res = await auth.resendEmailCode(challenge.value);
  if (res.ok) {
    toasts.success(res.message);
  } else {
    toasts.error(res.message);
  }
  resending.value = false;
}

function backToPassword() {
  challenge.value = null;
  methods.value = [];
  twoFactorCode.value = '';
  auth.error = null;
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-6">
    <div class="w-full max-w-sm">
      <!-- Step 1: Email + Password -->
      <form v-if="!challenge" @submit.prevent="submit">
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

      <!-- Step 2: Two-Factor Authentication -->
      <form v-else @submit.prevent="verify">
        <div class="mb-6 flex items-center gap-2">
          <IconShield class="text-2xl text-accent" />
          <h1 class="text-xl font-semibold tracking-tight text-ink">Dvostruka potvrda</h1>
        </div>

        <p class="mb-4 text-sm text-muted">
          Upiši šestocifreni kod iz aplikacije za autentifikaciju, sa emaila ili rezervni kod.
        </p>

        <div v-if="methods.length" class="mb-4 flex flex-wrap gap-2 text-xs text-faint">
          <span v-if="methods.includes('totp')" class="flex items-center gap-1 rounded bg-raised px-2 py-1">
            <IconKey /> Aplikacija (TOTP)
          </span>
          <span v-if="methods.includes('email')" class="flex items-center gap-1 rounded bg-raised px-2 py-1">
            <IconMail /> Email kod
          </span>
        </div>

        <label class="block text-sm font-medium text-ink">Sigurnosni kod</label>
        <input
          v-model="twoFactorCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="npr. 123456"
          required
          autofocus
          class="mt-1 mb-4 w-full rounded border border-line-strong bg-panel px-3 py-2 font-mono text-lg tracking-widest outline-none focus:border-accent"
        />

        <p v-if="auth.error" class="mb-4 text-sm text-accent">{{ auth.error }}</p>

        <button
          type="submit" :disabled="auth.loading || !twoFactorCode.trim()"
          class="w-full rounded bg-ink py-2.5 font-medium text-on-ink hover:bg-accent disabled:opacity-50"
        >
          {{ auth.loading ? 'Provjeravam…' : 'Potvrdi i prijavi se' }}
        </button>

        <div class="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            class="text-muted hover:text-ink"
            @click="backToPassword"
          >
            ← Nazad na lozinku
          </button>

          <button
            v-if="methods.includes('email')"
            type="button"
            class="text-accent hover:underline disabled:opacity-50"
            :disabled="resending"
            @click="resend"
          >
            {{ resending ? 'Šaljem…' : 'Pošalji novi kod na email' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
