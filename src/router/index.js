import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/DashboardLayout.vue'),
    children: [
      { path: '', redirect: '/songs' },
      { path: 'songs', name: 'songs', component: () => import('../views/SongsView.vue') },
      { path: 'songs/new', name: 'song-new', component: () => import('../views/SongEditorView.vue') },
      { path: 'songs/:id/edit', name: 'song-edit', component: () => import('../views/SongEditorView.vue'), props: true },
      { path: 'artists', name: 'artists', component: () => import('../views/ArtistsView.vue') }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/songs' }
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'songs' };
  }
});

export default router;
