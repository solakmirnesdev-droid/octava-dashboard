<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToasts } from '../composables/useToasts';
import ThemeSwitcher from '../components/ThemeSwitcher.vue';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconMail from '~icons/material-symbols/mail-outline-rounded';
import IconKey from '~icons/material-symbols/key-rounded';
import IconVisibility from '~icons/material-symbols/visibility-rounded';
import IconVisibilityOff from '~icons/material-symbols/visibility-off-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded';
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded';
import IconLock from '~icons/material-symbols/lock-outline-rounded';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const rememberMe = ref(true);
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
  <div class="flex min-h-screen flex-col lg:flex-row bg-surface text-ink font-sans">
    <!-- LEFT SIDE: Brand Showcase & Hero Visuals (Desktop & Tablet) -->
    <div class="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-10 xl:p-14 bg-panel border-r border-line overflow-hidden select-none">
      <!-- Background Ambient Glow Blobs -->
      <div class="absolute -top-32 -left-32 size-96 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
      <div class="absolute -bottom-32 -right-32 size-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <!-- Top Brand Header -->
      <div class="relative z-10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="flex size-10 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-md">
            <IconMusic class="text-xl" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl font-black tracking-tight text-ink">Octava</span>
              <span class="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent font-mono border border-accent/20">
                Dashboard
              </span>
            </div>
            <span class="text-[11px] text-muted">Urednički i administratorski portal</span>
          </div>
        </div>
      </div>

      <!-- Center Hero Content & Feature Highlights -->
      <div class="relative z-10 my-auto py-8">
        <div class="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent shadow-2xs mb-6">
          <span class="size-2 rounded-full bg-accent animate-pulse" />
          <span>Nova verzija 2.4 sa zvučnim sintetizatorom</span>
        </div>

        <h2 class="text-3xl xl:text-4xl font-black tracking-tight text-ink leading-tight">
          Kvalitet, tačnost i harmonizacija svakog stiha.
        </h2>

        <p class="mt-3 text-sm text-muted leading-relaxed max-w-md">
          Sveobuhvatna radna stanica za kreiranje, standardizaciju i moderaciju muzičkog kataloga ex-yu regije.
        </p>

        <!-- Feature List Cards -->
        <div class="mt-8 space-y-3 max-w-md">
          <div class="flex items-start gap-3 rounded-2xl border border-line-soft bg-surface/60 p-3.5 shadow-2xs backdrop-blur-xs transition hover:border-accent/50">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconMusic class="text-base" />
            </div>
            <div>
              <h4 class="text-xs font-bold text-ink">Fizički model gitare (Karplus-Strong)</h4>
              <p class="text-[11px] text-muted mt-0.5">Realistični akustični ton sa impulsom trzalice i rezonancom tijela.</p>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-2xl border border-line-soft bg-surface/60 p-3.5 shadow-2xs backdrop-blur-xs transition hover:border-accent/50">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconCheckCircle class="text-base" />
            </div>
            <div>
              <h4 class="text-xs font-bold text-ink">Brza banka i štambilj akorda</h4>
              <p class="text-[11px] text-muted mt-0.5">Harmonizacija pjesama jednim dodirom na mobilnim i desktop ekranima.</p>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-2xl border border-line-soft bg-surface/60 p-3.5 shadow-2xs backdrop-blur-xs transition hover:border-accent/50">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconShield class="text-base" />
            </div>
            <div>
              <h4 class="text-xs font-bold text-ink">Sigurnost i revizijski trag</h4>
              <p class="text-[11px] text-muted mt-0.5">Dvostruka autentifikacija (2FA) i automatsko praćenje svih izmjena.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Statistics & Footer Ticker -->
      <div class="relative z-10 border-t border-line-soft pt-5 flex items-center justify-between text-xs text-muted">
        <div class="flex items-center gap-3">
          <span class="font-bold text-ink">2.420+ pjesama</span>
          <span class="text-line-strong">•</span>
          <span class="font-bold text-ink">2.210+ izvođača</span>
          <span class="text-line-strong">•</span>
          <span class="text-ok font-semibold">100% verifikovano</span>
        </div>
        <span class="font-mono text-[11px] text-faint">v2.4 Pro</span>
      </div>
    </div>

    <!-- RIGHT SIDE: Authentication Form (Mobile & Desktop) -->
    <div class="flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-14 bg-surface min-h-screen lg:min-h-0">
      <!-- Top Action Bar with Theme Switcher -->
      <div class="flex items-center justify-between w-full max-w-md mx-auto">
        <!-- Mobile-Only Brand Header -->
        <div class="flex lg:hidden items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-xl bg-accent text-on-accent shadow-xs">
            <IconMusic class="text-base" />
          </div>
          <span class="text-base font-bold text-ink">Octava</span>
          <span class="rounded bg-accent-soft px-1.5 py-0.2 text-[10px] font-bold text-accent">Dashboard</span>
        </div>

        <div class="hidden lg:block">
          <span class="text-xs text-muted">Pristup zaštićenom sistemu</span>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <ThemeSwitcher />
        </div>
      </div>

      <!-- Main Login Card / Container -->
      <div class="w-full max-w-md mx-auto my-auto py-8">
        <!-- Step 1: Email + Password Form -->
        <form v-if="!challenge" class="space-y-5" @submit.prevent="submit">
          <div>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-ink">
              Prijava na panel
            </h1>
            <p class="mt-1.5 text-xs sm:text-sm text-muted">
              Unesite vaše pristupne podatke za rad u uredničkom okruženju.
            </p>
          </div>

          <div class="space-y-4 pt-2">
            <!-- Email Input -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                Email adresa
              </label>
              <div class="relative">
                <IconMail class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-base" />
                <input
                  v-model="email"
                  type="email"
                  required
                  autocomplete="username"
                  placeholder="urednik@octava.ba"
                  class="w-full rounded-2xl border border-line-strong bg-panel py-3 pl-10 pr-4 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition shadow-2xs"
                />
              </div>
            </div>

            <!-- Password Input -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-bold uppercase tracking-wider text-muted">
                  Lozinka
                </label>
              </div>
              <div class="relative">
                <IconLock class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-base" />
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full rounded-2xl border border-line-strong bg-panel py-3 pl-10 pr-11 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition shadow-2xs"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1 transition"
                  :title="showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'"
                  @click="showPassword = !showPassword"
                >
                  <component :is="showPassword ? IconVisibilityOff : IconVisibility" class="text-base" />
                </button>
              </div>
            </div>

            <!-- Remember Me -->
            <div class="flex items-center justify-between text-xs pt-1">
              <label class="flex items-center gap-2 cursor-pointer text-muted hover:text-ink">
                <input
                  v-model="rememberMe"
                  type="checkbox"
                  class="size-4 rounded accent-accent cursor-pointer"
                />
                <span>Ostani prijavljen</span>
              </label>
            </div>
          </div>

          <!-- Error message if any -->
          <div
            v-if="auth.error"
            class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger flex items-center gap-2 animate-in fade-in"
          >
            <span class="size-2 rounded-full bg-danger shrink-0" />
            <span>{{ auth.error }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="auth.loading"
            class="w-full rounded-2xl bg-ink py-3 text-sm font-bold text-on-ink hover:bg-accent disabled:opacity-50 transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span v-if="auth.loading" class="size-4 rounded-full border-2 border-on-ink/30 border-t-on-ink animate-spin" />
            <span>{{ auth.loading ? 'Provjeravam podatke…' : 'Prijavi se na dashboard' }}</span>
          </button>
        </form>

        <!-- Step 2: Two-Factor Authentication Form -->
        <form v-else class="space-y-5" @submit.prevent="verify">
          <div class="flex items-center gap-3">
            <div class="size-12 rounded-2xl bg-accent-soft flex items-center justify-center text-accent shadow-xs">
              <IconShield class="text-2xl" />
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
                Dvostruka potvrda
              </h1>
              <p class="text-xs text-muted">Dodatni sloj zaštite naloga</p>
            </div>
          </div>

          <p class="text-xs sm:text-sm text-muted leading-relaxed">
            Unesite šestocifreni sigurnosni kod iz vaše aplikacije (Google Authenticator / 1Password) ili primljenog emaila.
          </p>

          <div v-if="methods.length" class="flex flex-wrap gap-1.5 text-xs text-muted">
            <span v-if="methods.includes('totp')" class="flex items-center gap-1 rounded-xl bg-panel px-3 py-1 font-medium border border-line shadow-2xs">
              <IconKey class="text-accent text-sm" /> Aplikacija (TOTP)
            </span>
            <span v-if="methods.includes('email')" class="flex items-center gap-1 rounded-xl bg-panel px-3 py-1 font-medium border border-line shadow-2xs">
              <IconMail class="text-accent text-sm" /> Email kod
            </span>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Šestocifreni kod
            </label>
            <input
              v-model="twoFactorCode"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="000 000"
              required
              autofocus
              class="w-full text-center rounded-2xl border-2 border-accent bg-panel py-3.5 font-mono text-2xl font-bold tracking-widest outline-none focus:ring-4 focus:ring-accent/20 shadow-sm"
            />
          </div>

          <div
            v-if="auth.error"
            class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger flex items-center gap-2"
          >
            <span class="size-2 rounded-full bg-danger shrink-0" />
            <span>{{ auth.error }}</span>
          </div>

          <button
            type="submit"
            :disabled="auth.loading || !twoFactorCode.trim()"
            class="w-full rounded-2xl bg-accent py-3 text-sm font-bold text-on-accent hover:brightness-110 disabled:opacity-50 transition shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span v-if="auth.loading" class="size-4 rounded-full border-2 border-on-accent/30 border-t-on-accent animate-spin" />
            <span>{{ auth.loading ? 'Provjeravam kod…' : 'Potvrdi i prijavi se' }}</span>
          </button>

          <div class="flex items-center justify-between text-xs pt-3 border-t border-line-soft">
            <button
              type="button"
              class="text-muted hover:text-ink transition cursor-pointer flex items-center gap-1 font-medium"
              @click="backToPassword"
            >
              <IconArrowBack class="text-sm" />
              <span>Nazad na lozinku</span>
            </button>

            <button
              v-if="methods.includes('email')"
              type="button"
              class="text-accent font-bold hover:underline disabled:opacity-50 cursor-pointer"
              :disabled="resending"
              @click="resend"
            >
              {{ resending ? 'Slanje…' : 'Pošalji novi email kod' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Bottom Disclaimer / Help -->
      <div class="text-center text-xs text-muted w-full max-w-md mx-auto pt-4 border-t border-line-soft">
        <p>
          Sigurnosni pristup isključivo za članove redakcije Octava.
        </p>
      </div>
    </div>
  </div>
</template>
