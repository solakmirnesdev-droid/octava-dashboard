<script setup>
import { ref, computed } from 'vue';
import AppModal from '../components/AppModal.vue';
import client from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useToasts } from '../composables/useToasts';
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
    // Only minted when the account had none; an authenticator set up earlier
    // already handed them over and they are not shown twice.
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
    toasts.error(err.response?.data?.message || 'Kod nije prihvaćen.');
  } finally {
    mailBusy.value = false;
  }
}

async function disableMail() {
  mailBusy.value = true;
  try {
    await client.post('/auth/staff/2fa/email/disable', { password: mailPassword.value });
    await auth.fetchMe();
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
  qr.value = null; secret.value = ''; code.value = ''; password.value = '';
  backupCodes.value = []; acknowledged.value = false;
}

async function startSetup() {
  busy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/setup');
    // The response key is `qr`, not `dataUrl` — that is the controller's own
    // local variable name, and reading it here left the QR silently blank.
    qr.value = data.qr;
    secret.value = data.secret;
    stage.value = 'scanning';
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Pokretanje nije uspjelo.');
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
    stage.value = 'codes';
    await auth.fetchMe();
    toasts.success('Dvostruka potvrda je uključena.');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Kod nije prihvaćen.');
  } finally {
    busy.value = false;
  }
}

async function regenerate() {
  busy.value = true;
  try {
    const { data } = await client.post('/auth/staff/2fa/backup-codes', { password: password.value });
    backupCodes.value = data.backupCodes || [];
    stage.value = 'codes';
    password.value = '';
    toasts.success('Novi rezervni kodovi napravljeni. Stari više ne vrijede.');
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
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  } finally {
    busy.value = false;
  }
}

const codesAsText = computed(() =>
  `Octava — rezervni kodovi za ${auth.user?.email || ''}\n`
  + `Napravljeni ${new Date().toLocaleString('bs')}\n\n`
  + backupCodes.value.map((c, i) => `${i + 1}. ${c}`).join('\n')
  + '\n\nSvaki kod vrijedi jednom. Čuvaj ih odvojeno od telefona.\n'
);

async function copyCodes() {
  try {
    await navigator.clipboard.writeText(codesAsText.value);
    toasts.success('Kodovi kopirani.');
  } catch {
    toasts.error('Kopiranje nije uspjelo — označi ih i kopiraj ručno.');
  }
}

function downloadCodes() {
  const blob = new Blob([codesAsText.value], { type: 'text/plain;charset=utf-8' });
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
  <section class="mx-auto max-w-2xl">
    <h1 class="mb-6 text-xl font-semibold tracking-tight">Sigurnost</h1>

    <div class="rounded border border-line bg-panel px-5 py-4">
      <div class="flex flex-wrap items-center gap-3">
        <IconShield class="text-xl" :class="enabled ? 'text-ok' : 'text-dim'" />
        <div>
          <p class="text-sm font-medium">Dvostruka potvrda</p>
          <p class="text-xs text-muted">
            {{ enabled
              ? 'Uključena — pri prijavi se traži kod iz aplikacije.'
              : 'Isključena — nalog čuva samo lozinka.' }}
          </p>
        </div>
        <span
          class="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          :class="enabled ? 'bg-ok-soft text-ok' : 'bg-raised text-muted'"
        >{{ enabled ? 'aktivna' : 'neaktivna' }}</span>
      </div>

      <!-- Off, nothing started ------------------------------------------- -->
      <template v-if="!enabled && stage === 'idle'">
        <p class="mt-4 text-sm text-body">
          Trebat će ti aplikacija za kodove na telefonu — Google Authenticator,
          Aegis, 1Password ili slična.
        </p>
        <button
          class="mt-4 rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
          :disabled="busy" @click="startSetup"
        >{{ busy ? 'Trenutak…' : 'Uključi' }}</button>
      </template>

      <!-- Scanning -------------------------------------------------------- -->
      <template v-else-if="stage === 'scanning'">
        <p class="mt-4 text-sm text-body">
          Skeniraj kod aplikacijom, pa upiši šestocifreni broj koji ti pokaže.
        </p>

        <div class="mt-4 flex flex-wrap items-start gap-5">
          <img v-if="qr" :src="qr" alt="QR kod za postavljanje" class="size-40 rounded border border-line">

          <div class="min-w-0">
            <p class="text-xs font-medium text-muted">Ako skeniranje ne radi, upiši ključ ručno:</p>
            <code class="mt-1 block break-all rounded bg-raised px-2 py-1 font-mono text-xs">{{ secret }}</code>

            <label class="mt-4 block">
              <span class="text-sm font-medium">Kod iz aplikacije</span>
              <input
                v-model="code" inputmode="numeric" maxlength="6" placeholder="123456"
                class="mt-1 w-40 rounded border border-line-strong px-3 py-2 font-mono tracking-widest outline-none focus:border-accent"
                @keyup.enter="confirmEnable"
              >
            </label>
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <button class="rounded px-4 py-2 text-sm text-muted hover:text-accent" @click="reset">Odustani</button>
          <button
            class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
            :disabled="busy || code.trim().length < 6" @click="confirmEnable"
          >{{ busy ? 'Provjeravam…' : 'Potvrdi' }}</button>
        </div>
      </template>

      <!-- Backup codes, shown exactly once -------------------------------- -->
      <template v-else-if="stage === 'codes'">
        <div class="mt-4 rounded border border-warn bg-warn-soft px-4 py-3">
          <p class="text-sm font-medium text-warn">Ovo je jedini put da vidiš ove kodove.</p>
          <p class="mt-1 text-sm text-warn/80">
            Poslije ovoga u bazi ostaju samo njihovi otisci. Ako izgubiš telefon
            i nemaš kodove, u nalog se ne može ući.
          </p>
        </div>

        <ul class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <li
            v-for="(c, i) in backupCodes" :key="c"
            class="rounded bg-raised px-3 py-2 text-center font-mono text-sm"
          >
            <span class="mr-1 text-dim">{{ i + 1 }}.</span>{{ c }}
          </li>
        </ul>

        <div class="mt-4 flex flex-wrap gap-2">
          <button class="rounded border border-line-strong px-4 py-2 text-sm hover:border-accent" @click="copyCodes">
            <span class="flex items-center gap-1.5"><IconCopy /> Kopiraj</span>
          </button>
          <button class="rounded border border-line-strong px-4 py-2 text-sm hover:border-accent" @click="downloadCodes">
            <span class="flex items-center gap-1.5"><IconDownload /> Preuzmi</span>
          </button>
        </div>

        <label class="mt-4 flex items-center gap-2 text-sm">
          <input v-model="acknowledged" type="checkbox" class="accent-accent">
          Sačuvao sam kodove na sigurno mjesto
        </label>

        <button
          class="mt-3 rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
          :disabled="!acknowledged" @click="finishCodes"
        >Gotovo</button>
      </template>

      <!-- On -------------------------------------------------------------- -->
      <template v-else-if="enabled">
        <p class="mt-4 flex items-center gap-1.5 text-sm text-ok">
          <IconCheck /> Prijava traži kod iz aplikacije.
        </p>

        <div class="mt-5 border-t border-line pt-4">
          <p class="text-sm font-medium">Novi rezervni kodovi</p>
          <p class="mt-1 text-xs text-muted">Pravljenje novih poništava sve stare.</p>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <label class="block">
              <span class="text-xs font-medium text-muted">Lozinka</span>
              <input
                v-model="password" type="password" autocomplete="current-password"
                class="mt-1 w-56 rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
              >
            </label>
            <button
              class="rounded border border-line-strong px-4 py-2 text-sm hover:border-accent disabled:opacity-50"
              :disabled="busy || !password" @click="regenerate"
            >Napravi nove</button>
          </div>
        </div>

        <!-- Password as well as a code: a borrowed unlocked session should not
             be enough to strip the second factor off an account. -->
        <div class="mt-5 border-t border-line pt-4">
          <p class="text-sm font-medium">Isključi dvostruku potvrdu</p>
          <p class="mt-1 text-xs text-muted">Traži i lozinku i kod.</p>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <label class="block">
              <span class="text-xs font-medium text-muted">Lozinka</span>
              <input
                v-model="password" type="password" autocomplete="current-password"
                class="mt-1 w-56 rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
              >
            </label>
            <label class="block">
              <span class="text-xs font-medium text-muted">Kod</span>
              <input
                v-model="code" inputmode="numeric" maxlength="6"
                class="mt-1 w-28 rounded border border-line-strong px-3 py-2 font-mono tracking-widest outline-none focus:border-accent"
              >
            </label>
            <button
              class="rounded border border-line-strong px-4 py-2 text-sm hover:border-danger hover:text-danger disabled:opacity-50"
              :disabled="busy || !password || code.trim().length < 6" @click="disabling = true"
            >Isključi</button>
          </div>
        </div>
      </template>
    </div>
  
    <!-- Email codes ------------------------------------------------------ -->
    <div class="mt-4 rounded border border-line bg-panel px-5 py-4">
      <div class="flex flex-wrap items-center gap-3">
        <IconMail class="text-xl" :class="mailOn ? 'text-ok' : 'text-dim'" />
        <div>
          <p class="text-sm font-medium">Potvrda mailom</p>
          <p class="text-xs text-muted">
            {{ mailOn
              ? `Uključena — kod stiže na ${auth.user?.email}.`
              : 'Kod na email umjesto aplikacije za kodove.' }}
          </p>
        </div>
        <span
          class="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          :class="mailOn ? 'bg-ok-soft text-ok' : 'bg-raised text-muted'"
        >{{ mailOn ? 'aktivna' : 'neaktivna' }}</span>
      </div>

      <template v-if="!mailOn && mailStage === 'idle'">
        <p class="mt-4 text-sm text-body">
          Poslat ćemo kod na tvoju adresu da provjerimo da stiže. Bez toga bi
          uključivanje moglo zaključati nalog.
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <label class="block">
            <span class="text-xs text-faint">Lozinka</span>
            <input
              v-model="mailPassword" type="password" autocomplete="current-password"
              class="mt-1 w-56 rounded border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent"
            >
          </label>
          <button
            class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
            :disabled="mailBusy || !mailPassword" @click="sendMailCode"
          >{{ mailBusy ? 'Šaljem…' : 'Pošalji kod' }}</button>
        </div>
      </template>

      <template v-else-if="!mailOn && mailStage === 'sent'">
        <p class="mt-4 text-sm text-body">
          Upiši šestocifreni kod iz maila. Vrijedi 10 minuta.
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <input
            v-model="mailCode" inputmode="numeric" maxlength="6" placeholder="000000"
            class="w-32 rounded border border-line-strong px-3 py-2 text-center font-mono text-lg outline-none focus:border-accent"
            @keyup.enter="confirmMail"
          >
          <button
            class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
            :disabled="mailBusy || mailCode.trim().length < 6" @click="confirmMail"
          >Uključi</button>
          <button class="px-2 py-2 text-sm text-muted hover:text-ink" @click="mailStage = 'idle'">Odustani</button>
        </div>
      </template>

      <template v-else-if="mailOn">
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <label class="block">
            <span class="text-xs text-faint">Lozinka</span>
            <input
              v-model="mailPassword" type="password" autocomplete="current-password"
              class="mt-1 w-56 rounded border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent"
            >
          </label>
          <button
            class="rounded border border-line-strong px-4 py-2 text-sm hover:border-danger hover:text-danger disabled:opacity-50"
            :disabled="mailBusy || !mailPassword" @click="mailDisabling = true"
          >Isključi</button>
        </div>
      </template>
    </div>

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
