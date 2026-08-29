<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useChat } from '../composables/useChat';
import ToastStack from '../components/ToastStack.vue';
import SessionNotice from '../components/SessionNotice.vue';
import ChatWidget from '../components/ChatWidget.vue';
import ThemeSwitcher from '../components/ThemeSwitcher.vue';
import CommandPalette from '../components/CommandPalette.vue';
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
import { roleBadgeClass } from '../utils/avatar';
import { useNotificationsStore } from '../stores/notifications';

const auth = useAuthStore();
const router = useRouter();
const notifications = useNotificationsStore();
const showCommandPalette = ref(false);
const mobileMenuOpen = ref(false);

/**
 * The unread badge on the nav.
 *
 * AI-NOTE: reads the module-scoped chat state rather than opening a connection
 * of its own. `connect()` is idempotent, so calling it here means the socket is
 * live from the moment the dashboard loads — which is what lets a message
 * arriving while somebody is editing a song show up at all.
 */
const { totalUnread: chatUnread, connect: connectChat, loadPeers: loadChatPeers } = useChat();

onMounted(() => {
  connectChat();
  loadChatPeers().catch(() => {});
});

// Polled while the dashboard is open and stopped when it is not, so a tab left
// on a second monitor is not still asking every minute tomorrow morning.
onMounted(() => notifications.startPolling());
onBeforeUnmount(() => notifications.stopPolling());

async function signOut() {
  await auth.logout();
  router.push({ name: 'login' });
}

function closeMobile() {
  mobileMenuOpen.value = false;
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink">
    <header class="border-b border-line bg-panel sticky top-0 z-30">
      <!-- Top row: Brand & Account tools -->
      <div class="border-b border-line-soft">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-2.5">
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Mobile Menu Toggle Button -->
            <button
              type="button"
              class="md:hidden flex items-center justify-center p-1.5 rounded-md text-muted hover:bg-raised hover:text-ink focus:outline-none"
              aria-label="Otvori navigaciju"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <IconMenu v-if="!mobileMenuOpen" class="text-xl" />
              <IconClose v-else class="text-xl" />
            </button>

            <RouterLink :to="{ name: 'stats' }" class="flex items-center gap-1.5 sm:gap-2 hover:opacity-90">
              <span class="text-base font-bold tracking-tight text-ink">Octava</span>
              <span class="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Dashboard</span>
            </RouterLink>

            <span class="hidden sm:inline-block h-4 w-px bg-line" aria-hidden="true" />

            <!-- Isolated Inbox on the left -->
            <RouterLink
              :to="{ name: 'notifications' }"
              class="hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="notifications.unread
                ? 'border-accent/40 bg-accent-soft text-accent hover:border-accent'
                : 'border-line-strong text-muted hover:border-line hover:text-ink'"
              active-class="!border-accent !bg-accent !text-on-accent"
              title="Inbox"
            >
              <IconBell class="text-sm" />
              <span>Inbox</span>
              <span
                v-if="notifications.unread"
                class="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-accent"
                :class="{ '!bg-on-accent !text-accent': $route.name === 'notifications' }"
              >
                {{ notifications.unread > 99 ? '99+' : notifications.unread }}
              </span>
            </RouterLink>

            <!-- Isolated Zahtjevi next to Inbox -->
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

            <!-- Isolated Prijave next to Inbox and Zahtjevi -->
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

          <div class="flex items-center gap-2 sm:gap-3.5 text-xs sm:text-sm">
            <!-- Command Palette Trigger -->
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg border border-line-strong bg-surface/60 px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-ink transition-colors"
              title="Brza pretraga (Cmd+K)"
              @click="showCommandPalette = true"
            >
              <IconSearch class="text-sm" />
              <span class="hidden sm:inline">Pretraži…</span>
              <kbd class="hidden sm:inline-block rounded border border-line px-1 py-0.2 text-[10px] font-mono text-faint bg-raised">
                ⌘K
              </kbd>
            </button>

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
              class="relative flex items-center p-1 text-muted hover:text-accent"
              active-class="text-accent"
              title="Sigurnost naloga"
            >
              <IconLock />
              <span
                v-if="!auth.user?.totpEnabled"
                class="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-accent"
                aria-label="Dvostruka potvrda nije uključena"
              />
            </RouterLink>

            <ThemeSwitcher />

            <span class="h-3.5 w-px bg-line" aria-hidden="true" />

            <button class="flex items-center gap-1 text-muted hover:text-danger" @click="signOut">
              <IconLogout /> <span class="hidden sm:inline">Odjava</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom row: Navigation tabs for Desktop -->
      <div class="mx-auto max-w-6xl px-4 sm:px-6 hidden md:block">
        <nav class="flex items-center gap-1 overflow-x-auto py-1 text-sm">
          <RouterLink
            :to="{ name: 'stats' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconStats /> Statistika
          </RouterLink>
          <RouterLink
            :to="{ name: 'songs' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconSongs /> Pjesme
          </RouterLink>
          <RouterLink
            :to="{ name: 'artists' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconArtists /> Izvođači
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'moderation' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconShield /> Moderacija
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'fingerprints' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconPrint /> Otisci
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'trash' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconTrash /> Kanta
          </RouterLink>

          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'audit' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconHistory /> Trag
          </RouterLink>

          <RouterLink
            v-if="auth.isSuperadmin"
            :to="{ name: 'accounts' }"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
          >
            <IconAccounts /> Nalozi
          </RouterLink>
        </nav>
      </div>

      <!-- Mobile Navigation Drawer / Menu -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden border-t border-line bg-panel px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150"
      >
        <div class="pb-2 mb-2 border-b border-line-soft flex items-center justify-between text-xs text-muted">
          <span>{{ auth.user?.name || auth.user?.email }}</span>
          <span
            v-if="auth.user?.role"
            class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
            :class="roleBadgeClass(auth.user.role)"
          >
            {{ auth.user.role }}
          </span>
        </div>

        <nav class="grid grid-cols-2 gap-1 text-sm">
          <RouterLink
            :to="{ name: 'stats' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconStats /> Statistika
          </RouterLink>
          <RouterLink
            :to="{ name: 'songs' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconSongs /> Pjesme
          </RouterLink>
          <RouterLink
            :to="{ name: 'artists' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconArtists /> Izvođači
          </RouterLink>
          <RouterLink
            :to="{ name: 'notifications' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconBell /> Inbox
            <span v-if="notifications.unread" class="ml-auto rounded-full bg-accent px-1.5 py-0.2 text-[10px] text-on-accent font-bold">
              {{ notifications.unread }}
            </span>
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'requests' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconRequest /> Zahtjevi
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'reports' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconBug /> Prijave
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('worker')"
            :to="{ name: 'fingerprints' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconPrint /> Otisci
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'moderation' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconShield /> Moderacija
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'trash' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconTrash /> Kanta
          </RouterLink>
          <RouterLink
            v-if="auth.hasRole('admin')"
            :to="{ name: 'audit' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconHistory /> Trag
          </RouterLink>
          <RouterLink
            v-if="auth.isSuperadmin"
            :to="{ name: 'accounts' }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-raised hover:text-ink"
            active-class="!bg-accent-soft !font-medium !text-accent"
            @click="closeMobile"
          >
            <IconAccounts /> Nalozi
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <RouterView />
    </main>

    <ToastStack />
    <SessionNotice />
    <ChatWidget />
    <CommandPalette v-model="showCommandPalette" />
  </div>
</template>
