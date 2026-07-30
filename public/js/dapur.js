/* ============================================
   AVORNI COFFEE POS — Dapur (Kitchen) Logic
   API-backed version with SSE real-time
   ============================================ */

(async function () {
  'use strict';

  // --- Auth Check ---
  const currentUser = auth.requireRole('dapur');
  if (!currentUser) return;

  document.getElementById('user-name').textContent = currentUser.name;

  // --- DOM References ---
  const bodyBaru = document.getElementById('body-baru');
  const bodyProses = document.getElementById('body-proses');
  const bodySiap = document.getElementById('body-siap');
  const countBaru = document.getElementById('count-baru');
  const countProses = document.getElementById('count-proses');
  const countSiap = document.getElementById('count-siap');
  const statBaru = document.querySelector('#stat-baru .kitchen-stat-count');
  const statProses = document.querySelector('#stat-proses .kitchen-stat-count');
  const statSiap = document.querySelector('#stat-siap .kitchen-stat-count');
  const notifBadge = document.getElementById('notif-badge');
  const notifBell = document.getElementById('notif-bell');

  // --- State ---
  let newOrderCount = 0;
  let timerInterval = null;

  // --- Initialize ---
  async function init() {
    setupListeners();
    setupBroadcast();
    startTimerUpdates();
    await renderAllColumns();
  }

  // --- Render All Columns ---
  async function renderAllColumns() {
    try {
      const orders = await store.getActiveOrders();

      const baru = orders.filter((o) => o.status === 'baru')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const proses = orders.filter((o) => o.status === 'proses')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const siap = orders.filter((o) => o.status === 'siap')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      renderColumn(bodyBaru, baru, 'baru');
      renderColumn(bodyProses, proses, 'proses');
      renderColumn(bodySiap, siap, 'siap');

      // Update counts
      countBaru.textContent = baru.length;
      countProses.textContent = proses.length;
      countSiap.textContent = siap.length;

      statBaru.textContent = baru.length;
      statProses.textContent = proses.length;
      statSiap.textContent = siap.length;
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }

  function renderColumn(container, orders, status) {
    container.innerHTML = '';

    if (orders.length === 0) {
      const emptyIcons = { baru: '📭', proses: '⏳', siap: '✅' };
      const emptyTexts = {
        baru: 'Tidak ada pesanan baru',
        proses: 'Tidak ada pesanan yang sedang diproses',
        siap: 'Tidak ada pesanan yang siap',
      };
      container.innerHTML = `
        <div class="column-empty">
          <div class="column-empty-icon">${emptyIcons[status]}</div>
          <div class="column-empty-text">${emptyTexts[status]}</div>
        </div>`;
      return;
    }

    orders.forEach((order, idx) => {
      const card = createOrderCard(order, status, idx);
      container.appendChild(card);
    });
  }

  function createOrderCard(order, status, idx) {
    const card = document.createElement('div');
    card.className = 'kitchen-order' + (status === 'baru' ? ' new-pulse' : '');
    card.dataset.orderId = order.id;
    card.style.animationDelay = (idx * 60) + 'ms';

    // Items HTML
    const itemsHtml = order.items.map((item) =>
      `<div class="kitchen-order-item" style="display:flex;align-items:center;gap:8px;">
        <span class="kitchen-order-item-qty">${item.qty}×</span>
        <span>${item.imageUrl ? `<img src="${item.imageUrl}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;">` : item.emoji}</span>
        <span class="kitchen-order-item-name">${escapeHtml(item.name)}</span>
      </div>`
    ).join('');

    // Notes
    const notesHtml = order.notes
      ? `<div class="kitchen-order-notes">${escapeHtml(order.notes)}</div>`
      : '';

    // Action buttons based on status
    let actionsHtml = '';
    if (status === 'baru') {
      actionsHtml = `<button class="btn btn-warning btn-sm action-btn" data-action="proses" data-id="${order.id}">
        🍳 Proses
      </button>`;
    } else if (status === 'proses') {
      actionsHtml = `<button class="btn btn-success btn-sm action-btn" data-action="siap" data-id="${order.id}">
        ✅ Siap
      </button>`;
    } else if (status === 'siap') {
      actionsHtml = `<span class="badge badge-ready">Menunggu disajikan</span>`;
    }

    // Timer class based on elapsed time
    const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
    let timerClass = '';
    if (elapsed > 600) timerClass = 'timer-danger'; // >10 min
    else if (elapsed > 300) timerClass = 'timer-warning'; // >5 min

    card.innerHTML = `
      <div class="kitchen-order-header">
        <div>
          <div class="kitchen-order-id">${order.orderNumber}</div>
          <div class="kitchen-order-waiter">👤 ${escapeHtml(order.waiter || 'Pelayan')}</div>
        </div>
        <div class="kitchen-order-table">🪑 ${order.tableNo} - ${escapeHtml(order.customerName || 'Tanpa Nama')}</div>
      </div>
      <div class="kitchen-order-items">${itemsHtml}</div>
      ${notesHtml}
      <div class="kitchen-order-footer">
        <div class="kitchen-order-timer ${timerClass}" data-start="${order.createdAt}">
          <span class="timer-icon">⏱️</span>
          <span class="timer-value">${formatElapsed(order.createdAt)}</span>
        </div>
        <div class="kitchen-order-actions">${actionsHtml}</div>
      </div>`;

    return card;
  }

  // --- Timer Updates (every second) ---
  function startTimerUpdates() {
    timerInterval = setInterval(() => {
      document.querySelectorAll('.kitchen-order-timer').forEach((timer) => {
        const start = timer.dataset.start;
        if (!start) return;

        const elapsed = (Date.now() - new Date(start).getTime()) / 1000;
        timer.querySelector('.timer-value').textContent = formatElapsed(start);

        // Update timer color
        timer.classList.remove('timer-warning', 'timer-danger');
        if (elapsed > 600) timer.classList.add('timer-danger');
        else if (elapsed > 300) timer.classList.add('timer-warning');
      });
    }, 1000);
  }

  // --- Action Handlers ---
  async function handleAction(action, orderId) {
    const statusMap = {
      proses: 'proses',
      siap: 'siap',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    try {
      const order = await store.updateOrderStatus(orderId, newStatus);
      if (order) {
        const messages = {
          proses: `Pesanan ${order.orderNumber} sedang diproses 🍳`,
          siap: `Pesanan ${order.orderNumber} siap disajikan! ✅`,
        };
        showToast(messages[action], action === 'siap' ? 'success' : 'info');
        await renderAllColumns();
      }
    } catch (err) {
      showToast('Gagal mengupdate status: ' + err.message, 'error');
    }
  }

  // --- Event Listeners ---
  function setupListeners() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      auth.logout();
    });

    // Action buttons (event delegation)
    document.querySelector('.kitchen-board').addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.action-btn');
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      handleAction(action, id);
    });

    // Clear notification badge on bell click
    notifBell.addEventListener('click', () => {
      newOrderCount = 0;
      notifBadge.classList.add('hidden');
    });
  }

  // --- SSE Broadcast Listeners ---
  function setupBroadcast() {
    // New order from waiter
    store.on(MSG_TYPES.ORDER_CREATED, (order) => {
      renderAllColumns();
      playNotificationSound();

      // Update notification badge
      newOrderCount++;
      notifBadge.textContent = newOrderCount;
      notifBadge.classList.remove('hidden');
      notifBell.classList.add('ringing');
      setTimeout(() => notifBell.classList.remove('ringing'), 500);

      showToast(`Pesanan baru! ${order.orderNumber} — Meja ${order.tableNo} 🆕`, 'warning');
    });

    // Order updated (from other dapur tabs or admin)
    store.on(MSG_TYPES.ORDER_UPDATED, () => {
      renderAllColumns();
    });

    // Payment processed
    store.on(MSG_TYPES.PAYMENT_PROCESSED, () => {
      renderAllColumns();
    });
  }

  // --- Cleanup ---
  window.addEventListener('beforeunload', () => {
    if (timerInterval) clearInterval(timerInterval);
  });

  // --- Start ---
  await init();
})();
