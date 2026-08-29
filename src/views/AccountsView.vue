<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import AppModal from '../components/AppModal.vue';
import IconStar from '~icons/material-symbols/star-rounded';
import IconUsers from '~icons/material-symbols/group-rounded';
import IconSignedIn from '~icons/material-symbols/login-rounded';
import IconActive from '~icons/material-symbols/bolt-rounded';
import IconShield from '~icons/material-symbols/shield-person-rounded';
import IconLock from '~icons/material-symbols/lock-rounded';
import IconAdd from '~icons/material-symbols/add-circle-outline-rounded';

const toasts = useToasts();

const tab = ref('users');
const users = ref([]);
const staff = ref([]);
const stats = ref(null);
const meta = ref(null);
const loading = ref(true);

const page = ref(1);
const query = ref('');
const filter = ref('');

/**
 * The ranks, in the order they stack. Labels are Bosnian like the rest of the
 * screen — "Worker" was the one English word left in a table headed
 * "Uredništvo" — and each hint names the powers the rank actually adds, since
 * this list is now what somebody reads while deciding what to hand a colleague.
 *
 * AI-NOTE: there is no separate "moderator" rank. Hiding what a reader wrote is
 * gated at `admin` (see router meta on /moderation), so a moderator IS an admin
 * here. Splitting the two would mean a fourth rank and re-reading every gate.
 */
const ROLES = [
  { key: 'worker', label: 'Urednik', hint: 'unosi i uređuje pjesme, otiske i zahtjeve' },
  { key: 'admin', label: 'Admin', hint: 'plus brisanje, moderacija komentara, kanta i revizija' },
  { key: 'superadmin', label: 'Superadmin', hint: 'plus nalozi uredništva' }
];

/**
 * Where the staff tab splits.
 *
 * AI-TRAP: derived from the position in ROLES, never from a list of role names.
 * The rule this codebase repeats — compare ranks, do not enumerate them — is
 * exactly what a hardcoded ['admin', 'superadmin'] would break: a rank added
 * above superadmin would show in neither tab and its holder would vanish from
 * the screen that manages them. Reading the index means a new entry in ROLES
 * lands on the correct side by where it sits in the order.
 *
 * The split is a partition, not two filters: everything that is not at or above
 * admin falls into the other tab, so nothing can drop out between them.
 */
const ADMIN_AT = ROLES.findIndex((r) => r.key === 'admin');
const rankOf = (role) => ROLES.findIndex((r) => r.key === role);

const visibleStaff = computed(() =>
  tab.value === 'admins'
    ? staff.value.filter((m) => rankOf(m.role) >= ADMIN_AT)
    : staff.value.filter((m) => rankOf(m.role) < ADMIN_AT)
);

/** Matches MIN_STAFF_PASSWORD on the server; the form says so before sending. */
const MIN_PASSWORD = 12;

/**
 * Giving somebody a subscription by hand.
 *
 * AI-DECISION: days, not plans. The reason this button exists is a support case
 * — money left and never arrived, a launch promise, an apology — and none of
 * those map onto "monthly" or "yearly". The API writes it to the audit log
 * under the staff member's name, because handing out paid access is exactly the
 * act somebody will one day be asked to account for.
 */
const granting = ref(null);
const grantDays = ref(31);
const grantBusy = ref(false);

async function grant() {
  const user = granting.value;
  if (!user) return;
  grantBusy.value = true;
  try {
    await client.post(`/accounts/users/${user._id}/subscription`, { days: Number(grantDays.value) });
    toasts.success(`Pretplata dodana: ${user.username}`, { detail: `+${grantDays.value} dana` });
    granting.value = null;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Dodavanje nije uspjelo.');
  } finally {
    grantBusy.value = false;
  }
}

const FILTERS = [
  { key: '', label: 'Svi' },
  { key: 'active', label: 'Aktivni ovaj mjesec' },
  { key: 'never', label: 'Nikad se nisu prijavili' },
  { key: 'subscribed', label: 'Pretplaćeni' }
];

/** Never signed in reads differently from signed in long ago. */
const when = (value) => {
  if (!value) return { text: 'nikad', dim: true };
  const days = Math.floor((Date.now() - new Date(value)) / 86400000);
  if (days === 0) return { text: 'danas', dim: false };
  if (days === 1) return { text: 'juče', dim: false };
  if (days < 30) return { text: `prije ${days} dana`, dim: false };
  return { text: new Date(value).toLocaleDateString('bs'), dim: true };
};

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'users') {
      const { data } = await client.get('/accounts/users', {
        params: { page: page.value, limit: 25, q: query.value || undefined, filter: filter.value || undefined }
      });
      users.value = data.users;
      stats.value = data.stats;
      meta.value = data.meta;
    } else {
      const { data } = await client.get('/accounts/staff');
      staff.value = data.staff;
    }
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

watch([tab, page, filter], (now, before) => {
  // Both staff tabs read the same list; moving between them filters what is
  // already held rather than asking the server the same question twice.
  const staffToStaff = before?.[0] !== 'users' && now[0] !== 'users';
  if (staffToStaff && staff.value.length) return;
  load();
});
let debounce;
watch(query, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { page.value = 1; load(); }, 300);
});
onMounted(load);

/**
 * Creating a dashboard login.
 *
 * AI-DECISION: a dialog, not an inline panel like the artist editor. That one
 * is inline because judging a photo against the grid behind it is part of the
 * job; here nothing on the page helps, and `dismissible: false` keeps a stray
 * click from throwing away a typed password.
 *
 * The password is not emailed. Mail works, so this is a choice rather than a
 * limitation — see the note on createStaff in the backend. The dialog says so
 * plainly so nobody sits waiting for an invite that was never going to be sent.
 */
const creating = ref(false);
const saving = ref(false);
const blank = () => ({ name: '', email: '', role: 'worker', password: '' });
const form = ref(blank());

const canCreate = computed(() =>
  form.value.name.trim().length >= 2
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())
  && form.value.password.length >= MIN_PASSWORD);

function openCreate() {
  form.value = blank();
  creating.value = true;
}

async function submitCreate() {
  if (!canCreate.value || saving.value) return;
  saving.value = true;
  try {
    const { data } = await client.post('/accounts/staff', {
      name: form.value.name.trim(),
      email: form.value.email.trim().toLowerCase(),
      role: form.value.role,
      password: form.value.password
    });
    // Prepended rather than refetched: the list is sorted by rank, and somebody
    // who just made an account wants to see it, not hunt for it.
    staff.value.unshift(data.staff);
    creating.value = false;
    toasts.success(`Nalog napravljen: ${data.staff.email}`);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nalog nije napravljen.');
  } finally {
    saving.value = false;
  }
}

async function changeRole(member, role) {
  const previous = member.role;
  member.role = role;
  try {
    await client.patch(`/accounts/staff/${member._id}`, { role });
    toasts.success(`${member.name}: ${ROLES.find((r) => r.key === role)?.label}`);
  } catch (err) {
    member.role = previous;
    toasts.error(err.response?.data?.message || 'Promjena nije uspjela.');
  }
}

async function toggleActive(member) {
  const previous = member.active;
  member.active = !previous;
  try {
    await client.patch(`/accounts/staff/${member._id}`, { active: member.active });
    toasts.success(member.active ? `${member.name} aktiviran` : `${member.name} deaktiviran`);
  } catch (err) {
    member.active = previous;
    toasts.error(err.response?.data?.message || 'Promjena nije uspjela.');
  }
}
</script>

<template>
  <h1 class="mb-6 text-xl font-semibold tracking-tight">Nalozi</h1>

  <div v-if="stats && tab === 'users'" class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <!-- The number a paid product is run on, so it sits with the others rather
         than being something you go and look up. `cancelling` is shown beside
         it because somebody inside a period they already cancelled is leaving,
         and that is worth seeing before they are gone. -->
    <div class="rounded-lg border border-line bg-panel p-4">
      <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint">
        <IconStar /> Pretplaćenih
      </p>
      <p class="mt-1 font-mono text-2xl font-semibold text-ok">
        {{ stats.subscribed ?? 0 }}
        <span v-if="stats.cancelling" class="ml-1 font-sans text-xs font-normal text-warn">
          · {{ stats.cancelling }} otkazuje
        </span>
      </p>
    </div>

    <div class="rounded-lg border border-line bg-panel p-4">
      <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint">
        <IconUsers /> Registrovanih
      </p>
      <p class="mt-1 font-mono text-2xl font-semibold">{{ stats.total }}</p>
    </div>
    <div class="rounded-lg border border-line bg-panel p-4">
      <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint">
        <IconSignedIn /> Ikad se prijavilo
      </p>
      <p class="mt-1 font-mono text-2xl font-semibold">{{ stats.everSignedIn }}</p>
    </div>
    <div class="rounded-lg border border-line bg-panel p-4">
      <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-faint">
        <IconActive /> Aktivnih ovaj mjesec
      </p>
      <p class="mt-1 font-mono text-2xl font-semibold text-accent">{{ stats.activeThisMonth }}</p>
    </div>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-3 text-sm">
    <button
      v-for="option in [{ k: 'users', l: 'Korisnici' }, { k: 'admins', l: 'Admini' }, { k: 'mods', l: 'Moderatori' }]" :key="option.k"
      class="rounded px-3 py-1"
      :class="tab === option.k ? 'bg-ink text-on-ink' : 'text-muted hover:text-accent'"
      @click="tab = option.k; page = 1"
    >{{ option.l }}</button>

    <template v-if="tab === 'users'">
      <input
        v-model="query" type="search" placeholder="Traži po emailu ili imenu…"
        class="ml-auto w-56 rounded border border-line-strong px-3 py-1 outline-none focus:border-accent"
      />
      <select v-model="filter" class="rounded border border-line-strong px-2 py-1 outline-none focus:border-accent">
        <option v-for="f in FILTERS" :key="f.key" :value="f.key">{{ f.label }}</option>
      </select>
    </template>

    <button
      v-else
      class="ml-auto rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent"
      @click="openCreate"
    >
      <span class="flex items-center gap-1.5"><IconAdd /> Novi nalog</span>
    </button>
  </div>

  <p v-if="loading" class="text-sm text-muted">Učitavanje…</p>

  <!-- Readers -->
  <table v-else-if="tab === 'users'" class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="pb-2">Korisnik</th>
        <th class="pb-2">Registrovan</th>
        <th class="pb-2">Zadnja prijava</th>
        <th class="pb-2">Pretplata</th>
        <th class="pb-2 text-right">Sačuvano</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="user in users" :key="user._id" class="border-b border-line-soft">
        <td class="py-2.5">
          <span class="font-medium">{{ user.username }}</span>
          <span class="ml-2 text-xs text-faint">{{ user.email }}</span>
        </td>
        <td class="py-2.5 text-muted">{{ new Date(user.createdAt).toLocaleDateString('bs') }}</td>
        <td class="py-2.5" :class="when(user.lastLoginAt).dim ? 'text-faint' : 'text-muted'">
          {{ when(user.lastLoginAt).text }}
        </td>
        <!-- `active` rather than `status`: a cancelled subscription still works
             until its date passes, and that is what the reader sees. -->
        <td class="py-2.5">
          <span
            v-if="user.subscription?.active"
            class="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok"
            :title="`Vrijedi do ${new Date(user.subscription.expiresAt).toLocaleDateString('bs')}`"
          >
            {{ user.subscription.plan === 'yearly' ? 'godišnja' : 'mjesečna' }}
            <span v-if="user.subscription.status === 'cancelled'" class="text-warn">· otkazana</span>
          </span>
          <span v-else class="text-xs text-dim">—</span>
          <button
            class="ml-2 rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-faint
                   transition hover:border-accent hover:text-accent"
            title="Dodaj dane pretplate"
            @click="granting = user; grantDays = 31"
          >+</button>
        </td>
        <td class="py-2.5 text-right font-mono text-muted">{{ user.savedCount }}</td>
      </tr>
      <tr v-if="!users.length"><td colspan="5" class="py-6 text-center text-faint">Nema rezultata.</td></tr>
    </tbody>
  </table>

  <!-- Editors -->
  <table v-else class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="pb-2">Član</th>
        <th class="pb-2">Uloga</th>
        <th class="pb-2">2FA</th>
        <th class="pb-2">Zadnja prijava</th>
        <th class="pb-2 text-right">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="member in visibleStaff" :key="member._id" class="border-b border-line-soft">
        <td class="py-2.5">
          <span class="font-medium">{{ member.name }}</span>
          <span class="ml-2 text-xs text-faint">{{ member.email }}</span>
          <span v-if="member.isSelf" class="ml-2 rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted">ti</span>
        </td>
        <td class="py-2.5">
          <!-- Your own row is fixed: dropping your own rank would lock you out
               of the screen needed to undo it. -->
          <select
            v-if="!member.isSelf"
            :value="member.role"
            class="rounded border border-line-strong px-2 py-1 text-xs outline-none focus:border-accent"
            @change="changeRole(member, $event.target.value)"
          >
            <option v-for="r in ROLES" :key="r.key" :value="r.key">{{ r.label }}</option>
          </select>
          <span v-else class="flex items-center gap-1 text-xs text-muted">
            <IconShield /> {{ ROLES.find((r) => r.key === member.role)?.label }}
          </span>
        </td>
        <td class="py-2.5">
          <span v-if="member.totpEnabled" class="flex items-center gap-1 text-xs text-ok">
            <IconLock /> uključena
          </span>
          <span v-else class="text-xs text-faint">nema</span>
        </td>
        <td class="py-2.5" :class="when(member.lastLoginAt).dim ? 'text-faint' : 'text-muted'">
          {{ when(member.lastLoginAt).text }}
        </td>
        <td class="py-2.5 text-right">
          <button
            v-if="!member.isSelf"
            class="rounded border px-2.5 py-1 text-xs"
            :class="member.active
              ? 'border-line-strong text-muted hover:border-warn hover:text-warn'
              : 'border-warn bg-warn-soft text-warn'"
            @click="toggleActive(member)"
          >{{ member.active ? 'Deaktiviraj' : 'Aktiviraj' }}</button>
        </td>
      </tr>
      <tr v-if="!visibleStaff.length">
        <td colspan="5" class="py-6 text-center text-faint">
          {{ tab === 'admins' ? 'Nema nijednog admina.' : 'Nema nijednog moderatora.' }}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- The only way a dashboard login is made. Public registration writes to a
       different collection entirely and can never produce one. -->
  <AppModal
    v-model="creating"
    title="Novi nalog za dashboard"
    confirm-label="Napravi nalog"
    :confirm-disabled="!canCreate"
    :busy="saving"
    :dismissible="false"
    @confirm="submitCreate"
  >
    <div class="grid gap-4">
      <label class="block">
        <span class="text-sm font-medium">Ime i prezime</span>
        <input
          v-model="form.name" maxlength="60" placeholder="npr. Amina Hodžić"
          class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
        >
      </label>

      <label class="block">
        <span class="text-sm font-medium">Email</span>
        <input
          v-model="form.email" type="email" autocomplete="off" placeholder="ime@octava.ba"
          class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
        >
        <span class="mt-1 block text-xs text-faint">Ovim se prijavljuje na dashboard.</span>
      </label>

      <label class="block">
        <span class="text-sm font-medium">Uloga</span>
        <select
          v-model="form.role"
          class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
        >
          <option v-for="r in ROLES" :key="r.key" :value="r.key">{{ r.label }}</option>
        </select>
        <span class="mt-1 block text-xs text-faint">
          {{ ROLES.find((r) => r.key === form.role)?.hint }}
        </span>
      </label>

      <label class="block">
        <span class="text-sm font-medium">Početna lozinka</span>
        <input
          v-model="form.password" type="text" autocomplete="new-password"
          class="mt-1 w-full rounded border border-line-strong px-3 py-2 font-mono outline-none focus:border-accent"
        >
        <!-- Shown, not masked: you cannot pass on a password you cannot read,
             and it is going to be typed out to somebody anyway. -->
        <span class="mt-1 block text-xs" :class="form.password.length >= MIN_PASSWORD ? 'text-faint' : 'text-warn'">
          Najmanje {{ MIN_PASSWORD }} znakova. Ne šalje se mailom — predaj je lično.
        </span>
      </label>
    </div>
  </AppModal>

  <nav v-if="tab === 'users' && meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
            :disabled="page <= 1" @click="page--">Prethodna</button>
    <span class="text-muted">{{ meta.page }} / {{ meta.pages }}</span>
    <button class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
            :disabled="page >= meta.pages" @click="page++">Sljedeća</button>
  </nav>

    <AppModal
      :model-value="Boolean(granting)"
      title="Dodati pretplatu?"
      :description="granting ? `${granting.username} (${granting.email}) dobija pristup. Radnja se upisuje u revizioni trag.` : ''"
      confirm-label="Dodaj"
      :busy="grantBusy"
      :confirm-disabled="!(grantDays >= 1 && grantDays <= 400)"
      @update:model-value="(open) => { if (!open) granting = null; }"
      @confirm="grant"
    >
      <label class="block text-xs text-faint" for="grant-days">Broj dana (1–400)</label>
      <input
        id="grant-days" v-model.number="grantDays" type="number" min="1" max="400"
        class="mt-1 w-28 rounded border border-line-strong bg-panel px-3 py-2 font-mono outline-none focus:border-accent"
        @keyup.enter="grant"
      >
      <p class="mt-2 text-xs text-muted">
        Dodaje se na postojeću pretplatu ako je još aktivna — niko ne gubi dane koje već ima.
      </p>
    </AppModal>
</template>
