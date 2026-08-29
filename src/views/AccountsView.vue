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

const ROLES = [
  { key: 'worker', label: 'Worker', hint: 'unosi i uređuje pjesme' },
  { key: 'admin', label: 'Admin', hint: 'plus brisanje pjesama' },
  { key: 'superadmin', label: 'Superadmin', hint: 'plus nalozi' }
];

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

watch([tab, page, filter], load);
let debounce;
watch(query, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { page.value = 1; load(); }, 300);
});
onMounted(load);

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
      v-for="option in [{ k: 'users', l: 'Korisnici' }, { k: 'staff', l: 'Uredništvo' }]" :key="option.k"
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
      <tr v-if="!users.length"><td colspan="4" class="py-6 text-center text-faint">Nema rezultata.</td></tr>
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
      <tr v-for="member in staff" :key="member._id" class="border-b border-line-soft">
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
    </tbody>
  </table>

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
