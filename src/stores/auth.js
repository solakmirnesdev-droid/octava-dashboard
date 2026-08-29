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
      if (data.twoFactorRequired) {
        return { twoFactorRequired: true, methods: data.methods || [], challenge: data.challenge };
      }
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem('octava_staff_token', data.token);
      return { success: true };
    } catch (err) {
      error.value = err.response?.data?.message || 'Prijava nije uspjela.';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function loginVerify(challenge, code) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await client.post('/auth/staff/login/verify', { challenge, code });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem('octava_staff_token', data.token);
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Kod nije prihvaćen.';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function resendEmailCode(challenge) {
    try {
      const { data } = await client.post('/auth/staff/login/resend-code', { challenge });
      return { ok: true, message: data.message || 'Novi kod poslan na email.' };
    } catch (err) {
      return { ok: false, message: err.response?.data?.message || 'Slanje koda nije uspjelo.' };
    }
  }

/**
   * When the held token stops being accepted, in epoch ms — or null.
   *
   * Read straight off the token's own `exp` rather than counted locally: the
   * server sets the deadline, and after a laptop sleeps or a renewal lands in
   * another tab a locally-kept countdown is simply wrong.
   *
   * Decoding here is not a security check. Nothing is trusted on the strength
   * of it; it only decides when to show a warning, and the server refuses an
   * expired token regardless of what this says.
   */
  const claims = computed(() => {
    if (!token.value) return null;
    try {
      const [, body] = token.value.split('.');
      return JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  });

  const expiresAt = computed(() =>
    claims.value?.exp ? claims.value.exp * 1000 : null);

  /**
   * How long a whole session lasts, from the token that says so.
   *
   * AI-TRAP: this used to be inferred — the largest remaining time the client
   * had ever observed. That is wrong twice over: opening the dashboard on a
   * half-spent token records a short "full" span, and anything that remounts
   * the component (a hot reload, a re-rendered layout) resets it again. Renewal
   * then never reaches its threshold and the session dies under someone who is
   * working. `exp - iat` is the real span and needs no state at all.
   */
  const sessionLengthMs = computed(() => {
    const c = claims.value;
    return c?.exp && c?.iat ? (c.exp - c.iat) * 1000 : null;
  });

  /** Extends the session. Returns false if the server would not renew it. */
  async function renew() {
    if (!token.value) return false;
    try {
      const { data } = await client.post('/auth/staff/renew');
      token.value = data.token;
      if (data.user) user.value = data.user;
      localStorage.setItem('octava_staff_token', data.token);
      return true;
    } catch {
      // A refusal here means the session is already gone; the 401 interceptor
      // handles getting back to the login screen.
      return false;
    }
  }

  /**
   * Another tab signed in, renewed, or signed out. Without this the tabs hold
   * different tokens and the quiet one counts down to a warning about a session
   * the other tab already extended.
   */
  function adoptStoredToken() {
    const stored = localStorage.getItem('octava_staff_token');
    if (stored !== token.value) {
      token.value = stored;
      if (!stored) user.value = null;
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
    isAuthenticated, isAdmin, isSuperadmin, hasRole, expiresAt, sessionLengthMs,
    login, loginVerify, resendEmailCode, fetchMe, logout, renew, adoptStoredToken
  };
});
