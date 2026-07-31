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

/* --- SVG Icon System (Replacing Emojis) --- */
const SVG_ICONS = {
  coffee: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12Z"/><path d="M6 2v2"/><path d="M17 12h1a3 3 0 0 1 0 6h-1"/></svg>',
  bean: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M10.15 4.9a6 6 0 0 1 8.95 8.95L13.5 19.5a6 6 0 0 1-8.95-8.95Z"/><path d="M10 6c0 1.5 1.5 3 3.5 3.5s3.5-.5 3.5-2"/></svg>',
  crown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14a1 1 0 0 0 1-1v-1H4v1a1 1 0 0 0 1 1z"/></svg>',
  'chef-hat': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M6 18V6a4 4 0 0 1 8 0v12"/><path d="M18 18V9a4 4 0 0 0-8 0v9"/><path d="M3 18h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/></svg>',
  user: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  'dollar-sign': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  clipboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  banknote: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  'credit-card': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  table: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M12 3v18M3 12h18M3 3h18v18H3z"/></svg>',
  smartphone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  edit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  inbox: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  milk: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M8 2h8l2 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l2-5zm2 5h4M6 12h12"/></svg>',
  cookie: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5zm0 8h.01M16 14h.01M9 13h.01M12 17h.01M8 9h.01"/></svg>',
  honey: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M8 2h8M6 6h12M6 18c0 2.2 3.5 4 6 4s6-1.8 6-4V6H6v12zM6 12h12"/></svg>',
  'ice-cream': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="m12 13-4 8h8l-4-8z"/><path d="M12 13c2.2 0 4-1.8 4-4a4 4 0 0 0-8 0c0 2.2 1.8 4 4 4z"/></svg>',
  'cup-soda': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M6 8h12M18 8l-1 14H7L6 8m9-5-3 5-3-5"/></svg>',
  leaf: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5.6 9.8A7 7 0 0 1 11 20z"/><path d="M9 11.3a13.3 13.3 0 0 0-5.7 5.7M12.5 17.5a13.3 13.3 0 0 0 2.8-5.3"/></svg>',
  'glass-water': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M15.2 22H8.8L6 2h12l-2.8 20zM6 12h12"/></svg>',
  citrus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 2v20M2 12h20M19.07 4.93 4.93 19.07M19.07 19.07 4.93 4.93"/></svg>',
  croissant: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="m4.6 12.8 1.4-1.4a8.2 8.2 0 0 1 12 0l1.4 1.4c.5.5.5 1.4 0 1.9L18 16.1a1 1 0 0 1-1.4 0l-1-1a3 3 0 0 0-4.2 0l-1 1a1 1 0 0 1-1.4 0l-1.4-1.4c-.5-.5-.5-1.4 0-1.9z"/></svg>',
  bread: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M7 18V5c0-1.7 1.3-3 3-3h4c1.7 0 3 1.3 3 3v13c0 2.2-1.8 4-4 4h-2c-2.2 0-4-1.8-4-4z"/><path d="M10 6h4M10 11h4M10 16h4"/></svg>',
  sandwich: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="m3 11 18-5M3 11v3a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-3M3 11h18M21 11 3 6M10 18h4"/></svg>',
  cake: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16h16M12 2v9M8 4h8"/></svg>',
  banana: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><path d="M4 22a18 18 0 0 1 18-18c-3 3-5 7-5 11s2 7 5 7M4 22c3 0 7-2 11-5s7-5 7-11"/></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

const EMOJI_MAP = {
  '☕': 'coffee',
  '🫘': 'bean',
  '👑': 'crown',
  '🍳': 'chef-hat',
  '🧑‍🍳': 'user',
  '💰': 'dollar-sign',
  '📋': 'clipboard',
  '💵': 'banknote',
  '💳': 'credit-card',
  '🪑': 'table',
  '📱': 'smartphone',
  '✏️': 'edit',
  '🗑️': 'trash',
  '✅': 'check',
  '📭': 'inbox',
  '⚠️': 'warning',
  '🥛': 'milk',
  '🍫': 'cookie',
  '🍯': 'honey',
  '🍨': 'ice-cream',
  '🥤': 'cup-soda',
  '🍵': 'leaf',
  '🟣': 'glass-water',
  '🧋': 'cup-soda',
  '🍋': 'citrus',
  '🍊': 'citrus',
  '🥐': 'croissant',
  '🍞': 'bread',
  '🍟': 'cup-soda',
  '🥪': 'sandwich',
  '🥞': 'cake',
  '🍌': 'banana',
};

function getIcon(keyOrEmoji, classes = '') {
  let key = EMOJI_MAP[keyOrEmoji] || keyOrEmoji;
  let svg = SVG_ICONS[key] || SVG_ICONS['coffee'];
  if (classes) {
    svg = svg.replace('class="lucide-icon"', `class="lucide-icon ${classes}"`);
  }
  return svg;
}

