/* ============================================
   AVORNI COFFEE POS — Authentication
   Session via sessionStorage + API
   ============================================ */

const AUTH_KEY = 'avorni_session';

const auth = {
  /**
   * Login with username and password via API
   * Returns user object or null
   */
  async login(username, password) {
    const user = await store.authenticate(username, password);
    if (user) {
      const session = {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        loginAt: new Date().toISOString(),
      };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
      return session;
    }
    return null;
  },

  /**
   * Logout and redirect to login page
   */
  logout() {
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
  },

  /**
   * Get current logged-in user session
   */
  getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(AUTH_KEY));
    } catch {
      return null;
    }
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  /**
   * Require specific role, redirect if unauthorized
   * Call this at the top of each protected page
   */
  requireRole(requiredRole) {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    if (user.role !== requiredRole) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  },
};
