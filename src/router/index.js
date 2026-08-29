import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/DashboardLayout.vue'),
    children: [
      { path: '', redirect: '/stats' },
      { path: 'stats', name: 'stats', component: () => import('../views/StatsView.vue') },
      { path: 'songs', name: 'songs', component: () => import('../views/SongsView.vue') },
      { path: 'songs/new', name: 'song-new', component: () => import('../views/SongEditorView.vue') },
      { path: 'songs/:id/edit', name: 'song-edit', component: () => import('../views/SongEditorView.vue'), props: true },
      { path: 'artists', name: 'artists', component: () => import('../views/ArtistsView.vue') },
      {
        // Everyone on the desk, not just admins: securing your own account
        // is not a privileged act.
        path: 'security',
        name: 'security',
        component: () => import('../views/SecurityView.vue')
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('../views/ReportsView.vue')
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('../views/NotificationsView.vue')
      },
      {
        // Worker: acting on a request is catalogue work, not administration.
        path: 'zahtjevi',
        name: 'requests',
        component: () => import('../views/RequestsView.vue'),
        meta: { minimumRole: 'worker' }
      },
      {
        /*
         * Worker, not admin: recording a print is ordinary catalogue work, the
         * same kind of job as typing in the chords. Only deleting one is gated
         * higher, and the endpoint enforces that itself.
         */
        path: 'otisci',
        name: 'fingerprints',
        component: () => import('../views/FingerprintsView.vue'),
        meta: { minimumRole: 'worker' }
      },
      {
        // Restoring is an admin act because deleting is, and a worker who could
        // undo a deletion could also undo an admin's decision to make it.
        path: 'trash',
        name: 'trash',
        component: () => import('../views/TrashView.vue'),
        meta: { minimumRole: 'admin' }
      },
      {
        // Anybody at the desk, on purpose: a worker who cannot reach an admin
        // has no way to ask about the thing they are not allowed to do.
        path: 'chat',
        name: 'chat',
        component: () => import('../views/ChatView.vue')
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('../views/AuditView.vue'),
        meta: { minimumRole: 'admin' }
      },
      {
        path: 'moderation',
        name: 'moderation',
        component: () => import('../views/ModerationView.vue'),
        // Hiding what a reader wrote is a heavier act than adding a song.
        meta: { minimumRole: 'admin' }
      },
      {
        path: 'accounts',
        name: 'accounts',
        component: () => import('../views/AccountsView.vue'),
        meta: { minimumRole: 'superadmin' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/songs' }
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  /**
   * Resolve the session before judging it.
   *
   * fetchMe runs on mount, which is after the first navigation, so a rank
   * check here saw an empty user and bounced a superadmin off their own
   * screen. The token is present long before the account behind it is.
   */
  if (auth.isAuthenticated && !auth.user) {
    await auth.fetchMe();
  }
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'songs' };
  }

  // The server refuses regardless; this only avoids showing a screen that
  // would arrive empty.
  if (to.meta.minimumRole && !auth.hasRole(to.meta.minimumRole)) {
    return { name: 'songs' };
  }
});

export default router;
