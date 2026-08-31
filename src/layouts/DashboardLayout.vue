<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useChat, onSocket } from '../composables/useChat';
import ToastStack from '../components/ToastStack.vue';
import SessionNotice from '../components/SessionNotice.vue';
import ChatWidget from '../components/ChatWidget.vue';
import NotificationPanel from '../components/NotificationPanel.vue';
import ThemeSwitcher from '../components/ThemeSwitcher.vue';
import CommandPalette from '../components/CommandPalette.vue';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal.vue';
import IconStats from '~icons/material-symbols/bar-chart-rounded';
import IconSongs from '~icons/material-symbols/queue-music-rounded';
import IconArtists from '~icons/material-symbols/artist-rounded';
import IconLogout from '~icons/material-symbols/logout-rounded';
import IconLock from '~icons/material-symbols/lock-outline-rounded';
import IconAccounts from '~icons/material-symbols/manage-accounts-rounded';
import IconBell from '~icons/material-symbols/notifications-outline-rounded';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconBug from '~icons/material-symbols/bug-report-outline-rounded';
import IconRequest from '~icons/material-symbols/playlist-add-rounded';
import IconPrint from '~icons/material-symbols/graphic-eq-rounded';
import IconTrash from '~icons/material-symbols/delete-outline-rounded';
import IconHistory from '~icons/material-symbols/history-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconMenu from '~icons/material-symbols/menu-rounded';
import IconClose from '~icons/material-symbols/close-rounded';
import IconHelp from '~icons/material-symbols/help-outline-rounded';
import { roleBadgeClass } from '../utils/avatar';
import { useNotificationsStore } from '../stores/notifications';

const auth = useAuthStore();
const router = useRouter();
const notifications = useNotificationsStore();
const showCommandPalette = ref(false);
const showShortcuts = ref(false);
const showNotificationPanel = ref(false);
const mobileMenuOpen = ref(false);

function handleGlobalKeydown(e) {
  if (e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
  if (e.key === '?' || (e.key === '/' && (e.metaKey || e.ctrlKey))) {
    e.preventDefault();
    showShortcuts.value = !showShortcuts.value;
  }
}

/**
 * The unread badge on the nav.
 *
 * AI-NOTE: reads the module-scoped chat state rather than opening a connection
 * of its own. `connect()` is idempotent, so calling it here means the socket is
 * live from the moment the dashboard loads — which is what lets a message
 * arriving while somebody is editing a song show up at all.
 */
const { totalUnread: chatUnread, connect: connectChat, loadPeers: loadChatPeers } = useChat();

const justUpdated = ref(false);

function triggerLivePulse() {
  justUpdated.value = true;
  setTimeout(() => {
    justUpdated.value = false;
  }, 2500);
}

onMounted(() => {
  /*
   * Registered BEFORE connect, deliberately: onSocket holds a handler until
   * the socket exists and binds it then. Doing it after would work today and
   * break the first time connect() finishes faster than this line runs.
   */
  onSocket('notification:new', (payload) => {
    notifications.receive(payload);
    triggerLivePulse();
  });

  onSocket('data:changed', () => {
    triggerLivePulse();
  });

  connectChat();
  loadChatPeers().catch(() => {});
  window.addEventListener('keydown', handleGlobalKeydown);
});

// Polled while the dashboard is open and stopped when it is not, so a tab left
// on a second monitor is not still asking every minute tomorrow morning.
onMounted(() => notifications.startPolling());
onBeforeUnmount(() => {
  notifications.stopPolling();
  window.removeEventListener('keydown', handleGlobalKeydown);
});

async function signOut() {
  await auth.logout();
  router.push({ name: 'login' });
}

function closeMobile() {
  mobileMenuOpen.value = false;
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink flex flex-col selection:bg-accent-soft selection:text-accent">
    <header class="border-b border-line bg-panel/95 backdrop-blur-md sticky top-0 z-30 transition-all">
      <!-- Top row: Brand & Account tools -->
      <div class="border-b border-line-soft/80">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-3.5 sm:px-6 py-2">
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Mobile Menu Toggle Button -->
            <button
              type="button"
              class="md:hidden flex size-8 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink focus:outline-none transition active:scale-95 cursor-pointer"
              aria-label="Otvori navigaciju"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <IconMenu v-if="!mobileMenuOpen" class="text-xl" />
              <IconClose v-else class="text-xl text-accent" />
            </button>

            <RouterLink :to="{ name: 'stats' }" class="flex items-center gap-1.5 sm:gap-2 hover:opacity-90 transition active:scale-95">
              <span class="text-base sm:text-lg font-bold tracking-tight text-ink">Octava</span>
              <span class="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-accent shadow-2xs">Dashboard</span>
            </RouterLink>

            <!-- Live Sync Indicator Pill -->
            <div
              class="hidden lg:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono border transition-all duration-200 select-none whitespace-nowrap shrink-0 leading-none h-6"
              :class="justUpdated
                ? 'border-accent/40 bg-accent-soft text-accent shadow-2xs font-semibold'
                : 'border-line bg-surface/60 text-muted'"
              title="Live sinhronizacija baze u realnom vremenu"
            >
              <span class="relative flex size-2 shrink-0">
                <span
                  class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                  :class="justUpdated ? 'bg-accent' : 'bg-ok'"
                />
                <span
                  class="relative inline-flex size-2 rounded-full"
                  :class="justUpdated ? 'bg-accent' : 'bg-ok'"
                />
              </span>
              <span class="whitespace-nowrap">{{ justUpdated ? 'Sinhronizovano' : 'Live' }}</span>
            </div>

            <span class="hidden sm:inline-block h-4 w-px bg-line" aria-hidden="true" />

            <!-- Isolated Inbox on desktop with Attention Ring, Dropdown Panel & Badge Pop -->
            <div class="relative hidden sm:block">
              <button
                type="button"
                data-notification-trigger
                class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer select-none"
                :class="showNotificationPanel || notifications.unread
                  ? 'border-accent/40 bg-accent-soft text-accent hover:border-accent shadow-2xs font-semibold'
                  : 'border-line-strong text-muted hover:border-line hover:text-ink'"
                title="Obavještenja (Inbox)"
                @click="showNotificationPanel = !showNotificationPanel"
              >
                <IconBell class="text-sm" :class="{ 'animate-bell-ring text-accent': notifications.unread }" />
                <span>Inbox</span>
                <span
                  v-if="notifications.unread"
                  class="relative inline-flex items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-accent animate-badge-pop"
                >
                  <span class="absolute -inset-0.5 rounded-full bg-accent/50 animate-pulse-halo" />
                  <span class="relative">{{ notifications.unread > 99 ? '99+' : notifications.unread }}</span>
                </span>
              </button>
            </div>

            <!-- Isolated Zahtjevi on desktop -->
            <RouterLink
              v-if="auth.hasRole('worker')"
              :to="{ name: 'requests' }"
              class="hidden md:flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-line hover:text-ink"
              active-class="!border-accent !bg-accent !text-on-accent"
              title="Zahtjevi"
            >
              <IconRequest class="text-sm" />
              <span>Zahtjevi</span>
            </RouterLink>

            <!-- Isolated Prijave on desktop -->
            <RouterLink
              v-if="auth.hasRole('worker')"
              :to="{ name: 'reports' }"
              class="hidden md:flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-line hover:text-ink"
              active-class="!border-accent !bg-accent !text-on-accent"
              title="Prijave"
            >
              <IconBug class="text-sm" />
              <span>Prijave</span>
            </RouterLink>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm">
            <!-- Command Palette Trigger -->
            <button
              type="button"
              class="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-line-strong bg-surface/60 px-2 sm:px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-ink transition-colors shadow-2xs cursor-pointer"
              title="Brza pretraga (Cmd+K)"
              @click="showCommandPalette = true"
            >
              <IconSearch class="text-sm text-accent" />
              <span class="hidden sm:inline">Pretraži…</span>
              <kbd class="hidden sm:inline-block rounded border border-line px-1 py-0.2 text-[10px] font-mono text-faint bg-raised">
                ⌘K
              </kbd>
            </button>

            <!-- User badge on desktop -->
            <span class="hidden sm:inline text-muted truncate max-w-[140px] md:max-w-[200px]">
              {{ auth.user?.name || auth.user?.email }}
              <span
                v-if="auth.user?.role"
                class="ml-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-all"
                :class="roleBadgeClass(auth.user.role)"
              >
                {{ auth.user.role }}
              </span>
            </span>

            <RouterLink
              :to="{ name: 'security' }"
              class="relative flex items-center p-1.5 text-muted hover:text-accent rounded-lg transition"
              active-class="text-accent bg-accent-soft/40"
              title="Sigurnost naloga"
            >
              <IconLock class="text-base sm:text-sm" />
              <span
                v-if="!auth.user?.totpEnabled"
                class="absolute right-1 top-1 size-2 rounded-full bg-accent ring-2 ring-panel"
                aria-label="Dvostruka potvrda nije uključena"
              />
            </RouterLink>

            <button
              type="button"
              class="hidden sm:flex items-center p-1.5 text-muted hover:text-accent rounded-lg transition cursor-pointer"
              title="Tastaturne prečice (?)"
              @click="showShortcuts = true"
            >
              <IconHelp class="text-base sm:text-sm" />
            </button>

            <ThemeSwitcher />

            <span class="h-3.5 w-px bg-line hidden sm:inline-block" aria-hidden="true" />

            <button
              class="hidden sm:flex items-center gap-1 text-muted hover:text-danger p-1 rounded transition"
              title="Odjava"
              @click="signOut"
            >
              <IconLogout /> <span class="hidden sm:inline">Odjava</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom row: Navigation tabs for Desktop -->
      <div class="mx-auto max-w-6xl px-4 sm:px-6 hidden md:block">
        <nav class="flex items-center gap-1.5 overflow-x-auto py-1.5 text-xs font-semibold scrollbar-none">
          <RouterLink
            :to="{ name: 'stats' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconStats class="text-sm" /> Statistika
          </RouterLink>
          <RouterLink
            :to="{ name: 'songs' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconSongs class="text-sm" /> Pjesme
          </RouterLink>
          <RouterLink
            :to="{ name: 'artists' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconArtists class="text-sm" /> Izvođači
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'moderation' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconShield class="text-sm" /> Moderacija
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'fingerprints' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconPrint class="text-sm" /> Otisci
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'trash' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconTrash class="text-sm" /> Kanta
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'audit' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconHistory class="text-sm" /> Trag
          </RouterLink>

          <RouterLink
            v-if="auth.isSuperadmin"
            :to="{ name: 'accounts' }"
            class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted transition-all hover:bg-raised hover:text-ink cursor-pointer"
            active-class="!bg-accent-soft !font-bold !text-accent shadow-2xs"
          >
            <IconAccounts class="text-sm" /> Nalozi
          </RouterLink>
        </nav>
      </div>

      <!-- Mobile Backdrop Overlay -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden fixed inset-0 top-[49px] bg-black/60 backdrop-blur-xs z-40 transition-opacity"
        @click="closeMobile"
      />

      <!-- Mobile Navigation Drawer / Menu -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden absolute top-full left-0 right-0 z-50 border-b border-line bg-panel px-4 py-3 space-y-2 shadow-2xl animate-in slide-in-from-top duration-200"
      >
        <div class="pb-2.5 border-b border-line-soft flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="font-medium text-ink truncate max-w-[200px]">{{ auth.user?.name || auth.user?.email }}</span>
            <span
              v-if="auth.user?.role"
              class="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
              :class="roleBadgeClass(auth.user.role)"
            >
              {{ auth.user.role }}
            </span>
          </div>
          <button
            class="text-xs text-danger font-medium flex items-center gap-1 hover:underline cursor-pointer"
            @click="signOut"
          >
            <IconLogout /> Odjava
          </button>
        </div>

        <nav class="grid grid-cols-2 gap-1.5 text-xs font-medium">
          <RouterLink
            :to="{ name: 'stats' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconStats class="text-base text-accent" /> Statistika
          </RouterLink>
          <RouterLink
            :to="{ name: 'songs' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconSongs class="text-base text-accent" /> Pjesme
          </RouterLink>
          <RouterLink
            :to="{ name: 'artists' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconArtists class="text-base text-accent" /> Izvođači
          </RouterLink>
          <RouterLink
            :to="{ name: 'notifications' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconBell class="text-base text-accent" /> Inbox
            <span v-if="notifications.unread" class="ml-auto rounded-full bg-accent px-1.5 py-0.2 text-[10px] text-on-accent font-bold">
              {{ notifications.unread }}
            </span>
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'requests' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconRequest class="text-base text-accent" /> Zahtjevi
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'reports' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconBug class="text-base text-accent" /> Prijave
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'fingerprints' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconPrint class="text-base text-accent" /> Otisci
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'moderation' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconShield class="text-base text-accent" /> Moderacija
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'trash' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconTrash class="text-base text-accent" /> Kanta
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'audit' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconHistory class="text-base text-accent" /> Trag
          </RouterLink>
          <RouterLink
            v-if="auth.isSuperadmin"
            :to="{ name: 'accounts' }"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95"
            active-class="!bg-accent-soft !font-bold !text-accent"
            @click="closeMobile"
          >
            <IconAccounts class="text-base text-accent" /> Nalozi
          </RouterLink>
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg p-2.5 text-muted hover:bg-raised hover:text-ink transition active:scale-95 text-left w-full cursor-pointer"
            @click="closeMobile(); showShortcuts = true"
          >
            <IconHelp class="text-base text-accent" /> Prečice na tastaturi
          </button>
        </nav>
      </div>
    </header>

    <!-- Main Content Area with Bottom Padding on Mobile for Fixed Nav -->
    <main class="flex-1 mx-auto w-full max-w-6xl px-3.5 sm:px-6 py-4 sm:py-8 pb-20 md:pb-8">
      <RouterView />
    </main>

    <!-- Native-like Mobile Bottom Navigation Bar -->
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-panel/95 backdrop-blur-md border-t border-line px-2 py-1.5 flex items-center justify-around text-[10px] shadow-2xl safe-area-pb"
      aria-label="Mobilna navigacija"
    >
      <RouterLink
        :to="{ name: 'stats' }"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-muted transition active:scale-90"
        active-class="!text-accent font-bold"
      >
        <IconStats class="text-lg" />
        <span>Statistika</span>
      </RouterLink>

      <RouterLink
        :to="{ name: 'songs' }"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-muted transition active:scale-90"
        active-class="!text-accent font-bold"
      >
        <IconSongs class="text-lg" />
        <span>Pjesme</span>
      </RouterLink>

      <RouterLink
        :to="{ name: 'artists' }"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-muted transition active:scale-90"
        active-class="!text-accent font-bold"
      >
        <IconArtists class="text-lg" />
        <span>Izvođači</span>
      </RouterLink>

      <button
        type="button"
        data-notification-trigger
        class="relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-muted transition active:scale-90 cursor-pointer"
        :class="showNotificationPanel || notifications.unread ? '!text-accent font-bold' : ''"
        @click="showNotificationPanel = !showNotificationPanel"
      >
        <span class="relative">
          <IconBell class="text-lg" :class="{ 'animate-bell-ring': notifications.unread }" />
          <span
            v-if="notifications.unread"
            class="absolute -top-0.5 -right-1 size-2 rounded-full bg-accent ring-2 ring-panel animate-pulse"
          />
        </span>
        <span>Inbox</span>
      </button>

      <button
        type="button"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition active:scale-90 cursor-pointer"
        :class="mobileMenuOpen ? 'text-accent font-bold' : 'text-muted'"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <component :is="mobileMenuOpen ? IconClose : IconMenu" class="text-lg" />
        <span>{{ mobileMenuOpen ? 'Zatvori' : 'Meni' }}</span>
      </button>
    </nav>

    <NotificationPanel v-model="showNotificationPanel" />
    <ToastStack />
    <SessionNotice />
    <ChatWidget />
    <CommandPalette v-model="showCommandPalette" />
    <KeyboardShortcutsModal v-model="showShortcuts" />
  </div>
</template>
