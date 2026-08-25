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
