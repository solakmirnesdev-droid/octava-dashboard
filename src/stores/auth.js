import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import client from '../api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('octava_staff_token') || null);
  const user = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => Boolean(token.value));
  const isAdmin = computed(() => user.value?.role === 'admin');

  /**
   * Same ranking the server applies. Comparing positions rather than matching
   * a role means superadmin passes an admin check without being listed.
   */
  const RANKS = { worker: 1, admin: 2, superadmin: 3 };
  const hasRole = (minimum) => (RANKS[user.value?.role] || 0) >= (RANKS[minimum] || 99);
  const isSuperadmin = computed(() => hasRole('superadmin'));

  async function login(email, password) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await client.post('/auth/staff/login', { email, password });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem('octava_staff_token', data.token);
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Prijava nije uspjela.';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe() {
    if (!token.value) return;
    try {
      const { data } = await client.get('/auth/staff/me');
      user.value = data.user;
    } catch {
      logout();
    }
  }

  async function logout() {
    // Clears the httpOnly cookie as well; dropping only the local token would
    // leave a valid session sitting in the browser.
    try {
      await client.post('/auth/staff/logout');
    } finally {
      token.value = null;
      user.value = null;
      localStorage.removeItem('octava_staff_token');
    }
  }

  return {
    token, user, loading, error,
    isAuthenticated, isAdmin, isSuperadmin, hasRole,
    login, fetchMe, logout
  };
});
