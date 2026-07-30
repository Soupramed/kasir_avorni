/* ============================================
   AVORNI COFFEE POS — Utility Functions
   ============================================ */

/**
 * Format number to Indonesian Rupiah
 */
function formatCurrency(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

/**
 * Format date to Indonesian locale
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format time HH:MM
 */
function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format full date + time
 */
function formatDateTime(dateStr) {
  return formatDate(dateStr) + ' ' + formatTime(dateStr);
}

/**
 * Calculate elapsed time from a given timestamp
 * Returns string like "2m 30s" or "1h 5m"
 */
function formatElapsed(startTime) {
  const now = Date.now();
  const diff = Math.floor((now - new Date(startTime).getTime()) / 1000);

  if (diff < 60) return diff + 'd';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return m + 'm ' + s + 'd';
  }
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h + 'j ' + m + 'm';
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Generate order number (sequential, resets daily)
 */
function generateOrderNumber() {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem('avorni_order_date');
  let counter = parseInt(localStorage.getItem('avorni_order_counter') || '0');

  if (lastDate !== today) {
    counter = 0;
    localStorage.setItem('avorni_order_date', today);
  }

  counter++;
  localStorage.setItem('avorni_order_counter', counter.toString());
  return 'ORD-' + String(counter).padStart(3, '0');
}

/**
 * Play notification sound using Web Audio API
 */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // Audio not supported, silently ignore
  }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Debounce function
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Get today's date string for filtering
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}
