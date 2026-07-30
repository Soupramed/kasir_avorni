/* ============================================
   AVORNI COFFEE POS — Data Store (API Client)
   Connects to backend via fetch() + SSE
   ============================================ */

const API_BASE = '/api';

const MSG_TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  MENU_UPDATED: 'MENU_UPDATED',
  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
};

/* --- API Helper --- */
async function apiFetch(endpoint, options = {}) {
  const url = API_BASE + endpoint;
  const isFormData = options.body instanceof FormData;
  const config = {
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  };

  if (!isFormData && config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'API Error');
  }

  return data;
}

/* --- Store Class (API-backed) --- */
class AvorniStore {
  constructor() {
    this._listeners = {};
    this._connectSSE();
  }

  /* === SSE: Real-time events from server === */
  _connectSSE() {
    this._eventSource = new EventSource(API_BASE + '/events');

    this._eventSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'CONNECTED') return;
        const listeners = this._listeners[msg.type] || [];
        listeners.forEach((fn) => fn(msg.payload));
      } catch (err) {
        // ignore parse errors
      }
    };

    this._eventSource.onerror = () => {
      // Auto-reconnect is handled by EventSource
    };
  }

  /**
   * Subscribe to a broadcast event type
   */
  on(type, callback) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(callback);
  }

  /* === AUTHENTICATION === */
  async authenticate(username, password) {
    try {
      return await apiFetch('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
    } catch {
      return null;
    }
  }

  /* === MENU === */
  async getMenu() {
    return apiFetch('/menu');
  }

  async getAvailableMenu() {
    return apiFetch('/menu/available');
  }

  async getMenuByCategory(category) {
    return apiFetch('/menu/category/' + category);
  }

  async addMenuItem(item) {
    return apiFetch('/menu', { method: 'POST', body: item });
  }

  async updateMenuItem(id, updates) {
    return apiFetch('/menu/' + id, { method: 'PUT', body: updates });
  }

  async deleteMenuItem(id) {
    return apiFetch('/menu/' + id, { method: 'DELETE' });
  }

  /* === ORDERS === */
  async getOrders() {
    return apiFetch('/orders');
  }

  async getOrdersByStatus(status) {
    return apiFetch('/orders?status=' + status);
  }

  async getActiveOrders() {
    return apiFetch('/orders/active');
  }

  async getTodayOrders() {
    return apiFetch('/orders/today');
  }

  async getOrderById(id) {
    return apiFetch('/orders/' + id);
  }

  async createOrder(orderData) {
    return apiFetch('/orders', { method: 'POST', body: orderData });
  }

  async updateOrderStatus(orderId, newStatus) {
    return apiFetch('/orders/' + orderId + '/status', {
      method: 'PUT',
      body: { status: newStatus },
    });
  }

  async deleteOrder(orderId) {
    return apiFetch('/orders/' + orderId, { method: 'DELETE' });
  }

  /* === TRANSACTIONS === */
  async getTransactions(date) {
    const query = date ? '?date=' + date : '';
    return apiFetch('/transactions' + query);
  }

  async getTodayTransactions() {
    return apiFetch('/transactions/today');
  }

  async getTodaySummary(date) {
    const query = date ? '?date=' + date : '';
    return apiFetch('/transactions/summary' + query);
  }

  async getChartData() {
    return apiFetch('/transactions/chart');
  }

  async processPayment(orderId, paymentMethod, amountPaid) {
    return apiFetch('/transactions/pay', {
      method: 'POST',
      body: { orderId, paymentMethod, amountPaid },
    });
  }

  /* === USERS === */
  async getUsers() {
    return apiFetch('/users');
  }

  async addUser(userData) {
    try {
      return await apiFetch('/users', { method: 'POST', body: userData });
    } catch (err) {
      if (err.message.includes('sudah digunakan')) return null;
      throw err;
    }
  }

  async updateUser(id, updates) {
    return apiFetch('/users/' + id, { method: 'PUT', body: updates });
  }

  async deleteUser(id) {
    return apiFetch('/users/' + id, { method: 'DELETE' });
  }
}

// Create global store instance
const store = new AvorniStore();
