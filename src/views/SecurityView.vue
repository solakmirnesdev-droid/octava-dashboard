<script setup>
import { ref, computed } from 'vue';
import AppModal from '../components/AppModal.vue';
import client from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useToasts } from '../composables/useToasts';
import { AppCard, AppBadge, AppButton } from '../components/ui';
import IconMail from '~icons/material-symbols/mail-outline-rounded';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconCheck from '~icons/material-symbols/check-circle-outline-rounded';
import IconCopy from '~icons/material-symbols/content-copy-outline-rounded';
import IconDownload from '~icons/material-symbols/download-rounded';

/**
 * Two-factor authentication for a staff account.
 *
 * The API for this has existed and been tested for a while with no screen in
 * front of it, which meant the superadmin account guarding the whole catalogue
 * was held by a password alone.
 */
const auth = useAuthStore();
const toasts = useToasts();

/** off → scanning → codes, or on → (nothing) until an action is chosen. */
const stage = ref('idle');
const busy = ref(false);

const qr = ref(null);
const secret = ref('');
const code = ref('');
const password = ref('');
const backupCodes = ref([]);
const acknowledged = ref(false);

const enabled = computed(() => Boolean(auth.user?.totpEnabled));

// ------------------------------------------------------------ email codes ---

/**
 * Email as a second factor, beside the authenticator rather than instead of it.
 *
 * AI-DECISION: kept as its own card with its own state. Folding both into one
 * control would make "second factor" a single switch with two meanings, and the
 * two are genuinely independent — an account can run either, both, or neither,
 * and the login offers whichever are on.
 */
const mailOn = computed(() => Boolean(auth.user?.emailOtpEnabled));
const mailStage = ref('idle');
const mailBusy = ref(false);
const mailCode = ref('');
const mailPassword = ref('');
const mailDisabling = ref(false);

async function sendMailCode() {
  mailBusy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/email/setup', { password: mailPassword.value });
    mailStage.value = 'sent';
    toasts.success(`Kod poslan na ${data.to}`);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Slanje nije uspjelo.');
  } finally {
    mailBusy.value = false;
  }
}

async function confirmMail() {
  mailBusy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/email/enable', { code: mailCode.value.trim() });
    if (data.backupCodes?.length) {
      backupCodes.value = data.backupCodes;
      acknowledged.value = false;
      stage.value = 'codes';
    }
    await auth.fetchMe();
    mailStage.value = 'idle';
    mailCode.value = '';
    mailPassword.value = '';
    toasts.success('Potvrda mailom je uključena.');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Kod nije tačan.');
  } finally {
    mailBusy.value = false;
  }
}

async function disableMail() {
  mailBusy.value = true;
  try {
    await client.post('/auth/staff/2fa/email/disable', { password: mailPassword.value });
    await auth.fetchMe();
    mailStage.value = 'idle';
    mailPassword.value = '';
    toasts.success('Potvrda mailom je isključena.');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Isključivanje nije uspjelo.');
  } finally {
    mailBusy.value = false;
  }
}

function reset() {
  stage.value = 'idle';
  qr.value = null;
  secret.value = '';
  code.value = '';
  password.value = '';
  backupCodes.value = [];
  acknowledged.value = false;
}

async function startSetup() {
  busy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/setup');
    qr.value = data.qr;
    secret.value = data.secret;
    stage.value = 'scanning';
    code.value = '';
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo pokretanje.');
  } finally {
    busy.value = false;
  }
}

async function confirmEnable() {
  if (code.value.trim().length < 6) return;
  busy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/enable', { code: code.value.trim() });
    backupCodes.value = data.backupCodes || [];
    acknowledged.value = false;
    stage.value = 'codes';
    await auth.fetchMe();
    toasts.success('Dvostruka potvrda je uključena.');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Kod nije tačan.');
  } finally {
    busy.value = false;
  }
}

async function regenerate() {
  if (!password.value) return;
  busy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/backup-codes/regenerate', {
      password: password.value
    });
    backupCodes.value = data.backupCodes || [];
    acknowledged.value = false;
    stage.value = 'codes';
    password.value = '';
    toasts.success('Novi rezervni kodovi su napravljeni.');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  } finally {
    busy.value = false;
  }
}

const disabling = ref(false);

async function disable() {
  busy.value = true;
  try {
    await client.post('/auth/staff/2fa/disable', {
      password: password.value,
      code: code.value.trim()
    });
    await auth.fetchMe();
    reset();
    toasts.success('Dvostruka potvrda je isključena.');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Isključivanje nije uspjelo.');
  } finally {
    busy.value = false;
  }
}

function copyCodes() {
  const text = backupCodes.value.map((c, i) => `${i + 1}. ${c}`).join('\n');
  navigator.clipboard.writeText(text);
  toasts.success('Kodovi kopirani u međuspremnik.');
}

function downloadCodes() {
  const text = [
    `Octava — rezervni kodovi za ${auth.user?.email || 'urednički nalog'}`,
    `Datum: ${new Date().toISOString().slice(0, 10)}`,
    '',
    ...backupCodes.value.map((c, i) => `${i + 1}. ${c}`),
    '',
    'Svaki kod vrijedi samo jednom. Čuvaj ih odvojeno od lozinke.'
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `octava-rezervni-kodovi-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function finishCodes() {
  reset();
}
</script>

<template>
  <section class="mx-auto max-w-2xl pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5">
      <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
        Sigurnost i autentifikacija
      </h1>
      <p class="text-xs text-muted mt-0.5">
        Zaštita vašeg uredničkog naloga dvofaktorskom autentifikacijom (TOTP) i email verifikacijom.
      </p>
    </div>

    <!-- Card 1: App TOTP Authenticator -->
    <AppCard class="shadow-2xs">
      <div class="flex flex-wrap items-center gap-3">
        <div class="size-10 rounded-xl flex items-center justify-center" :class="enabled ? 'bg-ok-soft text-ok' : 'bg-raised text-muted'">
          <IconShield class="text-2xl" />
        </div>
        <div>
          <p class="text-sm font-bold text-ink">Dvostruka potvrda (TOTP)</p>
          <p class="text-xs text-muted">
            {{ enabled
              ? 'Uključena — pri prijavi se traži 6-cifreni kod iz autentifikator aplikacije.'
              : 'Isključena — nalog čuva samo lozinka.' }}
          </p>
        </div>
        <AppBadge
          class="ml-auto"
          :variant="enabled ? 'ok' : 'neutral'"
          size="sm"
          dot
        >
          {{ enabled ? 'aktivna' : 'neaktivna' }}
        </AppBadge>
      </div>

      <!-- Off, nothing started -->
      <template v-if="!enabled && stage === 'idle'">
        <p class="mt-4 text-xs sm:text-sm text-ink leading-relaxed bg-surface/50 p-3 rounded-xl border border-line-soft">
          Trebat će vam aplikacija za kodove na telefonu — Google Authenticator,
          Aegis, 1Password, Bitwarden ili slična.
        </p>
        <AppButton
          class="mt-4"
          variant="primary"
          size="sm"
          :loading="busy"
          @click="startSetup"
        >
          Uključi dvostruku potvrdu
        </AppButton>
      </template>

      <!-- Scanning -->
      <template v-else-if="stage === 'scanning'">
        <p class="mt-4 text-xs sm:text-sm text-ink">
          Skeniraj kod aplikacijom, pa upiši šestocifreni broj koji ti pokaže.
        </p>

        <div class="mt-4 flex flex-wrap items-start gap-5">
          <img v-if="qr" :src="qr" alt="QR kod za postavljanje" class="size-40 rounded-xl border border-line shadow-2xs">

          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-muted">Ako skeniranje ne radi, upiši ključ ručno:</p>
            <code class="mt-1 block break-all rounded-xl bg-surface border border-line-soft px-3 py-2 font-mono text-xs text-accent font-bold">{{ secret }}</code>

            <label class="mt-4 block">
              <span class="text-xs font-bold text-ink">Kod iz aplikacije</span>
              <input
                v-model="code" inputmode="numeric" maxlength="6" placeholder="123456"
                class="mt-1 w-44 rounded-xl border border-line-strong bg-panel px-3 py-2 font-mono text-base tracking-widest outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                @keyup.enter="confirmEnable"
              >
            </label>
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <AppButton variant="ghost" size="sm" @click="reset">Odustani</AppButton>
          <AppButton
            variant="primary"
            size="sm"
            :disabled="busy || code.trim().length < 6"
            :loading="busy"
            @click="confirmEnable"
          >
            Potvrdi
          </AppButton>
        </div>
      </template>

      <!-- Backup codes, shown exactly once -->
      <template v-else-if="stage === 'codes'">
        <div class="mt-4 rounded-xl border border-warn/30 bg-warn-soft/40 px-4 py-3">
          <p class="text-xs sm:text-sm font-bold text-warn">Ovo je jedini put da vidiš ove kodove.</p>
          <p class="mt-1 text-xs text-warn/90 leading-relaxed">
            Poslije ovoga u bazi ostaju samo njihovi otisci. Ako izgubiš telefon
            i nemaš kodove, u nalog se ne može ući.
          </p>
        </div>

        <ul class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <li
            v-for="(c, i) in backupCodes" :key="c"
            class="rounded-xl bg-surface border border-line-soft px-3 py-2 text-center font-mono text-xs sm:text-sm font-bold text-ink"
          >
            <span class="mr-1 text-faint font-normal">{{ i + 1 }}.</span>{{ c }}
          </li>
        </ul>

        <div class="mt-4 flex flex-wrap gap-2">
          <AppButton variant="secondary" size="xs" @click="copyCodes">
            <template #icon><IconCopy /></template>
            Kopiraj
          </AppButton>
          <AppButton variant="secondary" size="xs" @click="downloadCodes">
            <template #icon><IconDownload /></template>
            Preuzmi
          </AppButton>
        </div>

        <label class="mt-4 flex items-center gap-2 text-xs sm:text-sm font-medium text-ink cursor-pointer">
          <input v-model="acknowledged" type="checkbox" class="accent-accent size-4 rounded">
          Sačuvao sam kodove na sigurno mjesto
        </label>

        <AppButton
          class="mt-3"
          variant="primary"
          size="sm"
          :disabled="!acknowledged"
          @click="finishCodes"
        >
          Gotovo
        </AppButton>
      </template>

      <!-- On -->
      <template v-else-if="enabled">
        <p class="mt-4 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-ok">
          <IconCheck /> Prijava traži kod iz aplikacije.
        </p>

        <div class="mt-5 border-t border-line-soft pt-4">
          <p class="text-xs sm:text-sm font-bold text-ink">Novi rezervni kodovi</p>
          <p class="mt-0.5 text-xs text-muted">Pravljenje novih automatski poništava sve stare.</p>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <label class="block">
              <span class="text-xs font-medium text-muted">Lozinka naloga</span>
              <input
                v-model="password" type="password" autocomplete="current-password"
                class="mt-1 w-56 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              >
            </label>
            <AppButton
              variant="secondary"
              size="xs"
              :disabled="busy || !password"
              @click="regenerate"
            >
              Napravi nove
            </AppButton>
          </div>
        </div>

        <div class="mt-5 border-t border-line-soft pt-4">
          <p class="text-xs sm:text-sm font-bold text-ink">Isključi dvostruku potvrdu</p>
          <p class="mt-0.5 text-xs text-muted">Za gašenje 2FA zaštite unesite lozinku i trenutni kod.</p>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <label class="block">
              <span class="text-xs font-medium text-muted">Lozinka naloga</span>
              <input
                v-model="password" type="password" autocomplete="current-password"
                class="mt-1 w-56 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              >
            </label>
            <label class="block">
              <span class="text-xs font-medium text-muted">Kod</span>
              <input
                v-model="code" inputmode="numeric" maxlength="6"
                class="mt-1 w-28 rounded-xl border border-line-strong bg-panel px-3 py-1.5 font-mono text-xs tracking-widest outline-none focus:border-accent"
              >
            </label>
            <AppButton
              variant="danger"
              size="xs"
              :disabled="busy || !password || code.trim().length < 6"
              @click="disabling = true"
            >
              Isključi
            </AppButton>
          </div>
        </div>
      </template>
    </AppCard>
  
    <!-- Card 2: Email codes -->
    <AppCard class="mt-4 shadow-2xs">
      <div class="flex flex-wrap items-center gap-3">
        <div class="size-10 rounded-xl flex items-center justify-center" :class="mailOn ? 'bg-ok-soft text-ok' : 'bg-raised text-muted'">
          <IconMail class="text-2xl" />
        </div>
        <div>
          <p class="text-sm font-bold text-ink">Potvrda mailom</p>
          <p class="text-xs text-muted">
            {{ mailOn
              ? `Uključena — verifikacijski kod stiže na ${auth.user?.email}.`
              : 'Kod na email umjesto mobilne aplikacije za kodove.' }}
          </p>
        </div>
        <AppBadge
          class="ml-auto"
          :variant="mailOn ? 'ok' : 'neutral'"
          size="sm"
          dot
        >
          {{ mailOn ? 'aktivna' : 'neaktivna' }}
        </AppBadge>
      </div>

      <template v-if="!mailOn && mailStage === 'idle'">
        <p class="mt-4 text-xs sm:text-sm text-ink leading-relaxed bg-surface/50 p-3 rounded-xl border border-line-soft">
          Poslat ćemo kod na tvoju adresu da provjerimo da stiže. Bez toga bi
          uključivanje moglo zaključati nalog.
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <label class="block">
            <span class="text-xs text-muted font-medium">Lozinka</span>
            <input
              v-model="mailPassword" type="password" autocomplete="current-password"
              class="mt-1 w-56 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
            >
          </label>
          <AppButton
            variant="primary"
            size="sm"
            :loading="mailBusy"
            :disabled="mailBusy || !mailPassword"
            @click="sendMailCode"
          >
            Pošalji kod
          </AppButton>
        </div>
      </template>

      <template v-else-if="!mailOn && mailStage === 'sent'">
        <p class="mt-4 text-xs sm:text-sm text-ink">
          Upiši šestocifreni kod iz maila. Vrijedi 10 minuta.
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <input
            v-model="mailCode" inputmode="numeric" maxlength="6" placeholder="000000"
            class="w-36 rounded-xl border border-line-strong bg-panel px-3 py-2 text-center font-mono text-lg outline-none focus:border-accent"
            @keyup.enter="confirmMail"
          >
          <AppButton
            variant="primary"
            size="sm"
            :disabled="mailBusy || mailCode.trim().length < 6"
            :loading="mailBusy"
            @click="confirmMail"
          >
            Uključi
          </AppButton>
          <AppButton variant="ghost" size="sm" @click="mailStage = 'idle'">Odustani</AppButton>
        </div>
      </template>

      <template v-else-if="mailOn">
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <label class="block">
            <span class="text-xs text-muted font-medium">Lozinka naloga</span>
            <input
              v-model="mailPassword" type="password" autocomplete="current-password"
              class="mt-1 w-56 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
            >
          </label>
          <AppButton
            variant="danger"
            size="xs"
            :disabled="mailBusy || !mailPassword"
            @click="mailDisabling = true"
          >
            Isključi
          </AppButton>
        </div>
      </template>
    </AppCard>

    <AppModal
      v-model="mailDisabling"
      title="Isključiti potvrdu mailom?"
      :description="enabled
        ? 'Aplikacija za kodove ostaje uključena.'
        : 'Nalog ostaje zaštićen samo lozinkom.'"
      confirm-label="Isključi"
      tone="danger"
      :busy="mailBusy"
      @confirm="() => { mailDisabling = false; disableMail(); }"
    />

    <AppModal
      v-model="disabling"
      title="Isključiti dvostruku potvrdu?"
      description="Nalog ostaje zaštićen samo lozinkom. Rezervni kodovi prestaju vrijediti."
      confirm-label="Isključi"
      tone="danger"
      :busy="busy"
      @confirm="() => { disabling = false; disable(); }"
    />
  </section>
</template>
