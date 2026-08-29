<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useChat } from '../composables/useChat';
import ToastStack from '../components/ToastStack.vue';
import SessionNotice from '../components/SessionNotice.vue';
import ChatWidget from '../components/ChatWidget.vue';
import ThemeSwitcher from '../components/ThemeSwitcher.vue';
import IconStats from '~icons/material-symbols/bar-chart-rounded';
import IconSongs from '~icons/material-symbols/queue-music-rounded';
import IconArtists from '~icons/material-symbols/artist-rounded';
import IconLogout from '~icons/material-symbols/logout-rounded';
import IconLock from '~icons/material-symbols/lock-outline-rounded';
import IconAccounts from '~icons/material-symbols/manage-accounts-rounded';
import IconBell from '~icons/material-symbols/notifications-outline-rounded';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconChat from '~icons/material-symbols/forum-outline-rounded';
import IconBug from '~icons/material-symbols/bug-report-outline-rounded';
import IconRequest from '~icons/material-symbols/playlist-add-rounded';
import IconPrint from '~icons/material-symbols/graphic-eq-rounded';
import IconTrash from '~icons/material-symbols/delete-outline-rounded';
import IconHistory from '~icons/material-symbols/history-rounded';
import { roleBadgeClass } from '../utils/avatar';
import { onMounted, onBeforeUnmount } from 'vue';
import { useNotificationsStore } from '../stores/notifications';

const auth = useAuthStore();

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
const router = useRouter();
const notifications = useNotificationsStore();

// Polled while the dashboard is open and stopped when it is not, so a tab left
// on a second monitor is not still asking every minute tomorrow morning.
onMounted(() => notifications.startPolling());
onBeforeUnmount(() => notifications.stopPolling());

async function signOut() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink">
    <header class="border-b border-line bg-panel">
      <!-- Top row: Brand & Account tools -->
      <div class="border-b border-line-soft">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <div class="flex items-center gap-3">
            <RouterLink :to="{ name: 'stats' }" class="flex items-center gap-2 hover:opacity-90">
              <span class="text-base font-bold tracking-tight text-ink">Octava</span>
              <span class="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Dashboard</span>
            </RouterLink>

            <span class="h-4 w-px bg-line" aria-hidden="true" />

            <!-- Isolated Inbox on the left -->
            <RouterLink
              :to="{ name: 'notifications' }"
              class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
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
              class="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-line hover:text-ink"
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
              class="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-line hover:text-ink"
              active-class="!border-accent !bg-accent !text-on-accent"
              title="Prijave"
            >
              <IconBug class="text-sm" />
              <span>Prijave</span>
            </RouterLink>
          </div>

          <div class="flex items-center gap-3.5 text-xs sm:text-sm">
            <span class="text-muted">
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
              <IconLogout /> Odjava
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom row: Navigation tabs -->
      <div class="mx-auto max-w-6xl px-6">
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
    </header>

    <main class="mx-auto max-w-6xl px-6 py-8">
      <RouterView />
    </main>

    <ToastStack />
    <SessionNotice />
    <ChatWidget />
  </div>
</template>
