<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import AppModal from '../components/AppModal.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { initials, avatarStyle } from '../utils/avatar';
import IconStar from '~icons/material-symbols/star-rounded';
import IconUsers from '~icons/material-symbols/group-rounded';
import IconSignedIn from '~icons/material-symbols/login-rounded';
import IconActive from '~icons/material-symbols/bolt-rounded';
import IconShield from '~icons/material-symbols/shield-person-rounded';
import IconLock from '~icons/material-symbols/lock-rounded';
import IconAdd from '~icons/material-symbols/add-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconClose from '~icons/material-symbols/close-rounded';
import IconPerson from '~icons/material-symbols/person-outline-rounded';
import IconMail from '~icons/material-symbols/mail-outline-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import IconBookmark from '~icons/material-symbols/bookmark-rounded';

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
 * Staff role ranks and permissions.
 */
const ROLES = [
  { key: 'worker', label: 'Urednik', hint: 'unosi i uređuje pjesme, otiske i zahtjeve' },
  { key: 'admin', label: 'Admin', hint: 'plus brisanje, moderacija komentara, kanta i revizija' },
  { key: 'superadmin', label: 'Superadmin', hint: 'plus nalozi uredništva' }
];

const ADMIN_AT = ROLES.findIndex((r) => r.key === 'admin');
const rankOf = (role) => ROLES.findIndex((r) => r.key === role);

const visibleStaff = computed(() =>
  tab.value === 'admins'
    ? staff.value.filter((m) => rankOf(m.role) >= ADMIN_AT)
    : staff.value.filter((m) => rankOf(m.role) < ADMIN_AT)
);

const MIN_PASSWORD = 12;

const granting = ref(null);
const grantDays = ref(31);
const grantBusy = ref(false);
const PRESET_DAYS = [7, 30, 90, 365];
const statsPopping = ref(false);

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

async function grant() {
  const user = granting.value;
  if (!user) return;
  grantBusy.value = true;
  try {
    await client.post(`/accounts/users/${user._id}/subscription`, { days: Number(grantDays.value) });
    toasts.success(`Pretplata dodana: ${user.username}`, { detail: `+${grantDays.value} dana` });
    granting.value = null;
    triggerUpdatePulse();
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Dodavanje nije uspjelo.');
  } finally {
    grantBusy.value = false;
  }
}

const FILTERS = [
  { key: '', label: 'Svi korisnici' },
  { key: 'active', label: 'Aktivni ovaj mjesec' },
  { key: 'never', label: 'Nikad se nisu prijavili' },
  { key: 'subscribed', label: 'Sa aktivnom pretplatom' }
];

const when = (value) => {
  if (!value) return { text: 'nikad', dim: true, badgeClass: 'bg-raised text-faint border border-line-soft' };
  const days = Math.floor((Date.now() - new Date(value)) / 86400000);
  if (days === 0) return { text: 'danas', dim: false, badgeClass: 'bg-ok-soft text-ok border border-ok/20' };
  if (days === 1) return { text: 'juče', dim: false, badgeClass: 'bg-accent-soft text-accent border border-accent/20' };
  if (days < 30) return { text: `prije ${days} d.`, dim: false, badgeClass: 'bg-panel text-muted border border-line-strong' };
  return { text: new Date(value).toLocaleDateString('bs'), dim: true, badgeClass: 'bg-panel text-faint border border-line-soft' };
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('bs', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'users') {
      const { data } = await client.get('/accounts/users', {
        params: { page: page.value, limit: 25, q: query.value || undefined, filter: filter.value || undefined }
      });
      users.value = data.users || [];
      if (stats.value && data.stats && (stats.value.total !== data.stats.total || stats.value.activeThisMonth !== data.stats.activeThisMonth)) {
        triggerUpdatePulse();
      }
      stats.value = data.stats || null;
      meta.value = data.meta || null;
    } else {
      const { data } = await client.get('/accounts/staff');
      staff.value = data.staff || [];
    }
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

watch([tab, page, filter], (now, before) => {
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
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Nalozi i Korisnici
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Upravljanje registrovanim čitaocima, pretplatama, uredničkim timom i administratorskim ovlastima.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="tab !== 'users'"
          type="button"
          class="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs sm:text-sm font-bold text-on-accent hover:brightness-110 active:scale-95 transition shadow-xs cursor-pointer"
          @click="openCreate"
        >
          <IconAdd class="text-base" />
          <span>Novi nalog za tim</span>
        </button>
      </div>
    </div>

    <!-- Quick Insights Metric Tiles (Interactive Fast Filters) -->
    <div v-if="stats && tab === 'users'" class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <!-- 1. Pretplaćeni -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          filter === 'subscribed' ? 'border-ok ring-2 ring-ok/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="filter = filter === 'subscribed' ? '' : 'subscribed'"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconStar class="text-sm text-ok" /> Pretplaćenih
          </span>
          <span v-if="stats.cancelling" class="text-[10px] font-bold text-warn bg-warn-soft px-1.5 py-0.2 rounded">
            {{ stats.cancelling }} otkazuje
          </span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">{{ stats.subscribed ?? 0 }}</span>
          <span class="text-[11px] text-faint">čitalaca</span>
        </div>
      </div>

      <!-- 2. Ukupno registrovanih -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          filter === '' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="filter = ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconUsers class="text-sm text-accent" /> Registrovani
          </span>
          <span class="text-[10px] text-faint font-mono">Baza</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">{{ stats.total }}</span>
          <span class="text-[11px] text-faint">naloga</span>
        </div>
      </div>

      <!-- 3. Aktivnih ovaj mjesec -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          filter === 'active' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="filter = filter === 'active' ? '' : 'active'"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconActive class="text-sm text-accent" /> Aktivnih (30d)
          </span>
          <span class="text-[10px] font-bold text-accent font-mono">
            {{ stats.total ? Math.round((stats.activeThisMonth / stats.total) * 100) : 0 }}%
          </span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-accent" :class="{ 'animate-count-bump': statsPopping }">{{ stats.activeThisMonth }}</span>
          <span class="text-[11px] text-faint">ovaj mjesec</span>
        </div>
      </div>

      <!-- 4. Prijavljeni ikad / Nikad -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          filter === 'never' ? 'border-warn ring-2 ring-warn/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="filter = filter === 'never' ? '' : 'never'"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconSignedIn class="text-sm text-muted" /> Prijavljeno
          </span>
          <span class="text-[10px] text-faint font-mono">{{ stats.total - stats.everSignedIn }} nikad</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">{{ stats.everSignedIn }}</span>
          <span class="text-[11px] text-faint">od {{ stats.total }}</span>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs & Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-soft bg-panel p-2 shadow-2xs text-xs">
      <!-- Category Tabs -->
      <div class="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line-strong">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer"
          :class="tab === 'users' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="tab = 'users'"
        >
          <IconUsers class="text-sm" />
          <span>Korisnici</span>
          <span v-if="stats" class="text-[10px] opacity-75 font-mono">({{ stats.total }})</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer"
          :class="tab === 'staff' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="tab = 'staff'"
        >
          <IconPerson class="text-sm" />
          <span>Uredništvo</span>
          <span class="text-[10px] opacity-75 font-mono">({{ staff.filter((m) => rankOf(m.role) < ADMIN_AT).length }})</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer"
          :class="tab === 'admins' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="tab = 'admins'"
        >
          <IconShield class="text-sm" />
          <span>Admini</span>
          <span class="text-[10px] opacity-75 font-mono">({{ staff.filter((m) => rankOf(m.role) >= ADMIN_AT).length }})</span>
        </button>
      </div>

      <!-- Filters & Search (Only on users tab) -->
      <div v-if="tab === 'users'" class="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-[16rem]">
        <div class="relative flex-1 max-w-xs">
          <IconSearch class="absolute left-2.5 top-2 text-xs text-muted" />
          <input
            v-model="query"
            type="text"
            placeholder="Traži po emailu ili imenu…"
            class="w-full rounded-xl border border-line-strong bg-surface py-1.5 pl-8 pr-7 text-xs outline-none focus:border-accent shadow-2xs transition-colors font-medium"
          />
          <button
            v-if="query"
            type="button"
            class="absolute right-2 top-2 text-xs text-muted hover:text-ink cursor-pointer"
            @click="query = ''"
          >
            <IconClose />
          </button>
        </div>

        <select
          v-model="filter"
          class="rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent shadow-2xs font-medium cursor-pointer"
        >
          <option v-for="f in FILTERS" :key="f.key" :value="f.key">{{ f.label }}</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="py-6">
      <SkeletonLoader type="table" :rows="8" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="tab === 'users' && !users.length"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-panel py-16 text-center text-xs text-muted"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-raised text-muted mb-3">
        <IconUsers class="text-2xl text-accent" />
      </div>
      <p class="font-bold text-sm text-ink">Nema pronađenih korisnika</p>
      <p class="text-faint max-w-xs mt-1">
        {{ query ? `Nijedan nalog ne odgovara pretrazi "${query}".` : 'Trenutno nema korisnika u ovoj kategoriji.' }}
      </p>
    </div>

    <!-- 1. USERS LISTING -->
    <div v-else-if="tab === 'users'" class="rounded-2xl border border-line bg-panel overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm">
          <thead class="border-b border-line bg-raised/40 uppercase tracking-wide text-faint text-[11px] font-bold">
            <tr>
              <th class="py-3 px-4">Korisnik</th>
              <th class="py-3 px-4">Registrovan</th>
              <th class="py-3 px-4">Zadnja prijava</th>
              <th class="py-3 px-4">Pretplata</th>
              <th class="py-3 px-4 text-center">Sačuvano</th>
              <th class="py-3 px-4 text-right">Radnje</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr
              v-for="user in users"
              :key="user._id"
              class="hover:bg-raised/50 transition-colors"
            >
              <!-- User Profile & Avatar -->
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div
                    :style="avatarStyle(user.username || user.email)"
                    class="size-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-inner shrink-0"
                  >
                    {{ initials(user.username || user.email) }}
                  </div>
                  <div class="min-w-0">
                    <span class="font-bold text-ink text-sm block truncate">
                      {{ user.username }}
                    </span>
                    <span class="text-xs text-muted flex items-center gap-1 truncate font-mono">
                      <IconMail class="text-xs text-faint shrink-0" />
                      {{ user.email }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Registration Date -->
              <td class="py-3 px-4 text-muted whitespace-nowrap">
                <span class="font-medium">{{ formatDate(user.createdAt) }}</span>
              </td>

              <!-- Last Login Status Badge -->
              <td class="py-3 px-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium"
                  :class="when(user.lastLoginAt).badgeClass"
                >
                  <IconSignedIn class="text-xs" />
                  {{ when(user.lastLoginAt).text }}
                </span>
              </td>

              <!-- Subscription Status & Plan -->
              <td class="py-3 px-4 whitespace-nowrap">
                <div v-if="user.subscription?.active" class="flex items-center gap-1.5">
                  <span
                    class="inline-flex items-center gap-1 rounded-lg bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok border border-ok/20 shadow-2xs"
                    :title="`Vrijedi do: ${formatDate(user.subscription.expiresAt)}`"
                  >
                    <IconStar class="text-xs" />
                    {{ user.subscription.plan === 'yearly' ? 'Godišnja' : 'Mjesečna' }}
                  </span>
                  <span v-if="user.subscription.status === 'cancelled'" class="text-[10px] font-bold text-warn bg-warn-soft px-1.5 py-0.2 rounded">
                    otkazana
                  </span>
                </div>
                <span v-else class="text-xs text-faint italic">
                  Bez pretplate
                </span>
              </td>

              <!-- Saved Songs Count -->
              <td class="py-3 px-4 text-center whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold font-mono"
                  :class="user.savedCount ? 'bg-accent-soft text-accent border border-accent/20' : 'bg-surface text-faint'"
                >
                  <IconBookmark class="text-xs" />
                  {{ user.savedCount || 0 }}
                </span>
              </td>

              <!-- Direct Actions -->
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-xl border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-accent active:scale-95 transition shadow-2xs cursor-pointer"
                  title="Dodaj dane pretplate"
                  @click="granting = user; grantDays = 31"
                >
                  <IconAdd class="text-sm text-accent" />
                  <span>Dodaj dane</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div v-if="meta && meta.pages > 1" class="flex items-center justify-between border-t border-line-soft p-3 bg-surface/50 text-xs">
        <span class="text-muted font-medium">
          Prikazano <span class="font-bold text-ink">{{ (page - 1) * 25 + 1 }}</span> – <span class="font-bold text-ink">{{ Math.min(page * 25, meta.total) }}</span> od <span class="font-bold text-ink">{{ meta.total }}</span> korisnika
        </span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-3 py-1.5 font-semibold text-muted hover:border-accent hover:text-ink disabled:opacity-40 transition cursor-pointer shadow-2xs"
            :disabled="page <= 1"
            @click="page--"
          >
            <IconPrev class="text-base" /> Prethodna
          </button>

          <span class="font-mono font-bold text-ink px-2">{{ meta.page }} / {{ meta.pages }}</span>

          <button
            type="button"
            class="flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-3 py-1.5 font-semibold text-muted hover:border-accent hover:text-ink disabled:opacity-40 transition cursor-pointer shadow-2xs"
            :disabled="page >= meta.pages"
            @click="page++"
          >
            Sljedeća <IconNext class="text-base" />
          </button>
        </div>
      </div>
    </div>

    <!-- 2. STAFF & ADMINS LISTING -->
    <div v-else class="rounded-2xl border border-line bg-panel overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm">
          <thead class="border-b border-line bg-raised/40 uppercase tracking-wide text-faint text-[11px] font-bold">
            <tr>
              <th class="py-3 px-4">Član tima</th>
              <th class="py-3 px-4">Uloga i ovlasti</th>
              <th class="py-3 px-4 text-center">2FA Zaštita</th>
              <th class="py-3 px-4">Zadnja prijava</th>
              <th class="py-3 px-4 text-right">Status naloga</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr
              v-for="member in visibleStaff"
              :key="member._id"
              class="hover:bg-raised/50 transition-colors"
            >
              <!-- Staff Member Info -->
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div
                    :style="avatarStyle(member.name || member.email)"
                    class="size-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-inner shrink-0"
                  >
                    {{ initials(member.name || member.email) }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-ink text-sm">{{ member.name }}</span>
                      <span v-if="member.isSelf" class="rounded-md bg-accent-soft px-1.5 py-0.2 text-[10px] font-black text-accent uppercase tracking-wider">
                        TI
                      </span>
                    </div>
                    <span class="text-xs text-muted flex items-center gap-1 font-mono">
                      <IconMail class="text-xs text-faint" /> {{ member.email }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Role Selector / Badge -->
              <td class="py-3 px-4">
                <div v-if="!member.isSelf">
                  <select
                    :value="member.role"
                    class="rounded-xl border border-line-strong bg-surface px-2.5 py-1 text-xs outline-none focus:border-accent shadow-2xs font-semibold cursor-pointer"
                    @change="changeRole(member, $event.target.value)"
                  >
                    <option v-for="r in ROLES" :key="r.key" :value="r.key">{{ r.label }}</option>
                  </select>
                  <p class="text-[11px] text-faint mt-0.5 max-w-xs truncate">
                    {{ ROLES.find(r => r.key === member.role)?.hint }}
                  </p>
                </div>
                <div v-else>
                  <span class="inline-flex items-center gap-1 rounded-lg bg-accent/10 text-accent font-bold px-2.5 py-0.5 text-xs border border-accent/20">
                    <IconShield class="text-sm" />
                    {{ ROLES.find(r => r.key === member.role)?.label }}
                  </span>
                </div>
              </td>

              <!-- 2FA Status -->
              <td class="py-3 px-4 text-center whitespace-nowrap">
                <span
                  v-if="member.totpEnabled"
                  class="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok border border-ok/20"
                >
                  <IconLock class="text-xs" /> Uključena
                </span>
                <span v-else class="text-xs text-faint italic">
                  Isključena
                </span>
              </td>

              <!-- Last Login -->
              <td class="py-3 px-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium"
                  :class="when(member.lastLoginAt).badgeClass"
                >
                  <IconSignedIn class="text-xs" />
                  {{ when(member.lastLoginAt).text }}
                </span>
              </td>

              <!-- Status & Toggle Active -->
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <button
                  v-if="!member.isSelf"
                  type="button"
                  class="rounded-xl border px-3 py-1 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                  :class="member.active
                    ? 'border-line-strong text-muted hover:border-danger hover:bg-danger/10 hover:text-danger'
                    : 'border-ok bg-ok-soft text-ok hover:bg-ok hover:text-white'"
                  @click="toggleActive(member)"
                >
                  {{ member.active ? 'Deaktiviraj' : 'Aktiviraj nalog' }}
                </button>
                <span v-else class="text-xs text-ok font-bold">Aktivan</span>
              </td>
            </tr>

            <tr v-if="!visibleStaff.length">
              <td colspan="5" class="py-8 text-center text-muted">
                {{ tab === 'admins' ? 'Nema administratora u bazi.' : 'Nema urednika u bazi.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CREATE STAFF MODAL -->
    <AppModal
      v-model="creating"
      title="Novi nalog za urednički tim"
      description="Nalog omogućava prijavu na dashboard. Pristupni podaci se ne šalju emailom već ih predajete lično."
      confirm-label="Napravi nalog"
      :confirm-disabled="!canCreate"
      :busy="saving"
      :dismissible="false"
      @confirm="submitCreate"
    >
      <div class="space-y-3.5 text-xs">
        <div>
          <label class="block font-bold text-muted mb-1">Ime i prezime *</label>
          <input
            v-model="form.name"
            type="text"
            maxlength="60"
            placeholder="npr. Amina Hodžić"
            class="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium"
          />
        </div>

        <div>
          <label class="block font-bold text-muted mb-1">Email adresa *</label>
          <input
            v-model="form.email"
            type="email"
            autocomplete="off"
            placeholder="amina@octava.ba"
            class="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium font-mono"
          />
        </div>

        <div>
          <label class="block font-bold text-muted mb-1">Uloga i ovlasti</label>
          <select
            v-model="form.role"
            class="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium cursor-pointer"
          >
            <option v-for="r in ROLES" :key="r.key" :value="r.key">{{ r.label }}</option>
          </select>
          <p class="mt-1 text-[11px] text-faint">
            {{ ROLES.find(r => r.key === form.role)?.hint }}
          </p>
        </div>

        <div>
          <label class="block font-bold text-muted mb-1">Početna lozinka *</label>
          <div class="relative">
            <input
              v-model="form.password"
              type="text"
              autocomplete="new-password"
              class="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs font-mono outline-none focus:border-accent shadow-2xs"
              placeholder="Unesite privremenu lozinku..."
            />
          </div>
          <p class="mt-1 text-[11px]" :class="form.password.length >= MIN_PASSWORD ? 'text-ok font-medium' : 'text-warn'">
            Najmanje {{ MIN_PASSWORD }} znakova (uneseno: {{ form.password.length }}).
          </p>
        </div>
      </div>
    </AppModal>

    <!-- GRANT SUBSCRIPTION MODAL -->
    <AppModal
      :model-value="Boolean(granting)"
      title="Dodjela pretplate korisniku"
      :description="granting ? `Dodajete pristup za korisnika ${granting.username} (${granting.email}). Ova radnja se trajno bilježi u revizioni trag.` : ''"
      confirm-label="Dodaj dane pretplate"
      :busy="grantBusy"
      :confirm-disabled="!(grantDays >= 1 && grantDays <= 400)"
      @update:model-value="(open) => { if (!open) granting = null; }"
      @confirm="grant"
    >
      <div v-if="granting" class="space-y-4 text-xs">
        <!-- Preset Days Chips -->
        <div>
          <label class="block font-bold text-muted mb-1.5">Brzi odabir trajanja:</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in PRESET_DAYS"
              :key="d"
              type="button"
              class="rounded-xl border px-3 py-1.5 font-bold transition shadow-2xs cursor-pointer"
              :class="grantDays === d
                ? 'border-accent bg-accent text-on-accent'
                : 'border-line-strong bg-surface text-muted hover:border-accent hover:text-ink'"
              @click="grantDays = d"
            >
              +{{ d }} dana {{ d === 365 ? '(1 god.)' : '' }}
            </button>
          </div>
        </div>

        <!-- Custom Days Input -->
        <div>
          <label class="block font-bold text-muted mb-1" for="grant-days">Prilagođen broj dana (1–400):</label>
          <input
            id="grant-days"
            v-model.number="grantDays"
            type="number"
            min="1"
            max="400"
            class="w-32 rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent shadow-2xs font-bold"
            @keyup.enter="grant"
          />
        </div>

        <div class="rounded-xl border border-line-soft bg-surface/70 p-3 text-[11px] text-faint">
          💡 Dani se automatski nadovezuju na postojeću pretplatu ukoliko je još aktivna — korisnik ne gubi nijedan ranije plaćeni dan.
        </div>
      </div>
    </AppModal>
  </section>
</template>
