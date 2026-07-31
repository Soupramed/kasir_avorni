/* ============================================
   AVORNI COFFEE POS — Admin Dashboard Logic
   API-backed version with SSE real-time
   ============================================ */

(async function () {
  'use strict';

  // --- Auth Check ---
  const currentUser = auth.requireRole('admin');
  if (!currentUser) return;

  document.getElementById('admin-name').textContent = currentUser.name;

  // --- State ---
  let currentPage = 'dashboard';
  let menuFilter = 'all';
  let editingMenuId = null;
  let editingUserId = null;
  let payingOrderId = null;
  let selectedPaymentMethod = null;
  let revenueChart = null;
  let editingLapakId = null;

  // Buat Pesanan (order creation) state — mirrors public/js/pelayan.js
  let orderCart = [];
  let orderCurrentCategory = 'kopi';
  let orderMenuCache = [];

  // --- DOM References ---
  const pages = document.querySelectorAll('.page');
  const navItems = document.querySelectorAll('.nav-item');
  const paymentBadge = document.getElementById('payment-badge');

  // --- Initialize ---
  async function init() {
    setTodayDate();
    await renderDashboard();
    await renderMenuTable();
    await renderPaymentGrid();
    await renderHistoryTable();
    await renderUsersTable();
    await renderLapakGrid();
    await renderOrderMenu();
    await updatePaymentBadge();
    setupListeners();
    setupBroadcast();
  }

  function setTodayDate() {
    const today = new Date();
    document.getElementById('today-date').textContent = today.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    document.getElementById('history-date').value = getTodayString();
  }

  // --- Navigation ---
  function navigateTo(page) {
    currentPage = page;
    pages.forEach((p) => p.classList.remove('active'));
    navItems.forEach((n) => n.classList.remove('active'));

    document.getElementById('page-' + page).classList.add('active');
    document.querySelector('[data-page="' + page + '"]').classList.add('active');

    // Refresh data on page change
    if (page === 'dashboard') renderDashboard();
    if (page === 'order') renderOrderMenu();
    if (page === 'menu') renderMenuTable();
    if (page === 'lapak') renderLapakGrid();
    if (page === 'payment') renderPaymentGrid();
    if (page === 'history') renderHistoryTable();
    if (page === 'users') renderUsersTable();

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  // --- Dashboard ---
  async function renderDashboard() {
    try {
      // Summary
      const summary = await store.getTodaySummary();
      document.getElementById('stat-revenue').textContent = formatCurrency(summary.totalRevenue);
      document.getElementById('stat-transactions').textContent = summary.totalTransactions;
      document.getElementById('stat-cash').textContent = formatCurrency(summary.totalCash);
      document.getElementById('stat-qris').textContent = formatCurrency(summary.totalQris);

      // Revenue Chart
      await renderRevenueChart();

      // Lapak revenue/tax report
      const lapakDateInput = document.getElementById('lapak-report-date');
      if (!lapakDateInput.value) lapakDateInput.value = getTodayString();
      await renderLapakReport(lapakDateInput.value);

      // Active Orders
      const activeOrders = await store.getActiveOrders();
      document.getElementById('stat-active-orders').textContent = activeOrders.length;
      document.getElementById('stat-waiting-payment').textContent = activeOrders.filter((o) => !o.isPaid).length;
      document.getElementById('stat-processing-orders').textContent = activeOrders.filter((o) => o.status === 'proses').length;
      const grid = document.getElementById('dashboard-active-orders');

      if (activeOrders.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state-icon">${getIcon('check')}</div>
            <div class="empty-state-text">Tidak ada pesanan aktif</div>
          </div>`;
      } else {
        grid.innerHTML = activeOrders.map((order) => {
          const statusLabels = { baru: 'Baru', proses: 'Proses', siap: 'Siap' };
          const statusClasses = { baru: 'badge-new', proses: 'badge-process', siap: 'badge-ready' };
          const itemsSummary = order.items.map((i) => i.qty + '× ' + i.name).join(', ');

          return `
            <div class="active-order-card">
              <div class="active-order-header">
                <span class="active-order-id">${order.orderNumber}</span>
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  ${order.isPaid ? '<span class="badge badge-ready">Lunas</span>' : ''}
                  <span class="badge ${statusClasses[order.status]}">${statusLabels[order.status]}</span>
                </span>
              </div>
              <div class="active-order-items">${escapeHtml(itemsSummary)}</div>
              <div class="active-order-footer">
                <span style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Meja ${order.tableNo} - ${escapeHtml(order.customerName || 'Tanpa Nama')} · ${formatTime(order.createdAt)}</span>
                <span style="font-weight:700;color:var(--brand-light)">${formatCurrency(order.total)}</span>
              </div>
            </div>`;
        }).join('');
      }

      // Recent Transactions
      const transactions = await store.getTodayTransactions();
      const recent = transactions.slice(0, 10);
      const tbody = document.getElementById('recent-transactions-body');

      if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">Belum ada transaksi hari ini</td></tr>';
      } else {
        tbody.innerHTML = recent.map((t) => `
          <tr>
            <td><strong>${t.orderNumber}</strong></td>
            <td>Meja ${t.tableNo}</td>
            <td>${formatCurrency(t.total)}</td>
            <td><span class="badge ${t.paymentMethod === 'tunai' ? 'badge-ready' : 'badge-done'}">${t.paymentMethod.toUpperCase()}</span></td>
            <td>${formatTime(t.paidAt)}</td>
          </tr>`).join('');
      }
    } catch (err) {
      console.error('Failed to render dashboard:', err);
    }
  }

  // --- Revenue Chart ---
  async function renderRevenueChart() {
    try {
      const chartData = await store.getChartData();
      const ctx = document.getElementById('revenueChart');
      if (!ctx) return;

      const labels = chartData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      });
      const data = chartData.map(d => d.revenue);

      if (revenueChart) {
        revenueChart.data.labels = labels;
        revenueChart.data.datasets[0].data = data;
        revenueChart.update();
        return;
      }

      revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Pendapatan (Rp)',
            data: data,
            backgroundColor: 'rgba(234, 179, 8, 0.7)',
            borderColor: 'rgba(234, 179, 8, 1)',
            borderWidth: 1,
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => formatCurrency(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#a1a1aa' },
              grid: { color: 'rgba(255,255,255,0.06)' }
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: '#a1a1aa',
                callback: (val) => 'Rp ' + (val / 1000) + 'k'
              },
              grid: { color: 'rgba(255,255,255,0.06)' }
            }
          }
        }
      });
    } catch (err) {
      console.error('Failed to render chart:', err);
    }
  }

  // --- Lapak Revenue & Tax Report (Dashboard) ---
  async function renderLapakReport(date) {
    try {
      const { report, grandTotalTax } = await store.getLapakReport(date);
      const tbody = document.getElementById('lapak-report-body');

      if (report.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">Belum ada lapak</td></tr>';
      } else {
        tbody.innerHTML = report.map((l) => `
          <tr>
            <td><strong>${escapeHtml(l.name)}</strong></td>
            <td>${escapeHtml(l.owner_name)}</td>
            <td>${l.totalQty}</td>
            <td>${formatCurrency(l.totalRevenue)}</td>
            <td>${formatCurrency(l.totalTax)}</td>
          </tr>`).join('');
      }

      document.getElementById('lapak-tax-total-value').textContent = formatCurrency(grandTotalTax);
    } catch (err) {
      console.error('Failed to render lapak report:', err);
    }
  }

  // --- Menu Management ---
  async function renderMenuTable() {
    try {
      let menu = await store.getMenu();
      if (menuFilter !== 'all') {
        menu = menu.filter((m) => m.category === menuFilter);
      }

      const lapakList = await store.getLapak();
      const lapakMap = {};
      lapakList.forEach((l) => { lapakMap[l.id] = l.name; });

      const tbody = document.getElementById('menu-table-body');

      if (menu.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:32px;">Tidak ada item menu</td></tr>';
        return;
      }

      const categoryLabels = { kopi: 'Kopi', 'non-kopi': 'Non-Kopi', makanan: 'Makanan' };

      tbody.innerHTML = menu.map((item) => `
        <tr>
          <td class="menu-emoji-cell">
            ${item.imageUrl
              ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">`
              : getIcon(item.emoji)}
          </td>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.lapakId && lapakMap[item.lapakId] ? `<div class="text-muted" style="font-size:0.75rem;">${escapeHtml(lapakMap[item.lapakId])}</div>` : ''}
          </td>
          <td>${categoryLabels[item.category] || item.category}</td>
          <td>${formatCurrency(item.price)}</td>
          <td>
            <button class="menu-status-toggle ${item.available ? 'active' : ''}" 
                    data-id="${item.id}" title="${item.available ? 'Tersedia' : 'Habis'}">
            </button>
          </td>
          <td>
            <div class="flex gap-xs">
              <button class="btn btn-ghost btn-sm edit-menu-btn" data-id="${item.id}" style="display:inline-flex;align-items:center;justify-content:center;">${getIcon('edit')}</button>
              <button class="btn btn-ghost btn-sm delete-menu-btn" data-id="${item.id}" style="display:inline-flex;align-items:center;justify-content:center;">${getIcon('trash')}</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      console.error('Failed to render menu:', err);
    }
  }

  async function populateLapakDropdown(selectedId) {
    const select = document.getElementById('menu-lapak');
    try {
      const lapakList = await store.getLapak();
      select.innerHTML = '<option value="">— Milik Cafe (bukan lapak) —</option>' +
        lapakList.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
      select.value = selectedId || '';
    } catch (err) {
      console.error('Failed to load lapak list:', err);
    }
  }

  async function openMenuModal(item = null) {
    editingMenuId = item ? item.id : null;
    document.getElementById('menu-modal-title').textContent = item ? 'Edit Menu' : 'Tambah Menu';
    document.getElementById('menu-name').value = item ? item.name : '';
    document.getElementById('menu-category').value = item ? item.category : 'kopi';
    document.getElementById('menu-price').value = item ? item.price : '';
    document.getElementById('menu-image').value = ''; // reset file input
    document.getElementById('menu-edit-id').value = editingMenuId || '';
    await populateLapakDropdown(item ? item.lapakId : null);
    openModal('modal-menu');
  }

  async function saveMenu(e) {
    e.preventDefault();
    const name = document.getElementById('menu-name').value.trim();
    const category = document.getElementById('menu-category').value;
    const price = document.getElementById('menu-price').value;
    const lapakId = document.getElementById('menu-lapak').value;
    const imageFile = document.getElementById('menu-image').files[0];

    if (!name || !price) {
      showToast('Mohon lengkapi semua field', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('price', price);
    formData.append('lapakId', lapakId);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      if (editingMenuId) {
        // preserve existing available status since the form has no toggle for it
        const existingMenu = await store.getMenu();
        const currentItem = existingMenu.find((i) => i.id === editingMenuId);
        if (currentItem) formData.append('available', currentItem.available);

        await store.updateMenuItem(editingMenuId, formData);
        showToast('Menu berhasil diupdate', 'success');
      } else {
        await store.addMenuItem(formData);
        showToast('Menu baru ditambahkan', 'success');
      }

      closeModal('modal-menu');
      await renderMenuTable();
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  }

  // --- Lapak Management ---
  async function renderLapakGrid() {
    try {
      const lapakList = await store.getLapak();
      const grid = document.getElementById('lapak-grid');

      if (lapakList.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state-icon">${getIcon('inbox')}</div>
            <div class="empty-state-text">Belum ada lapak. Tambahkan lapak pertama.</div>
          </div>`;
        return;
      }

      grid.innerHTML = lapakList.map((l) => `
        <div class="lapak-card" data-id="${l.id}">
          <div class="lapak-card-header">
            <span class="lapak-card-name">${escapeHtml(l.name)}</span>
            <span class="badge ${l.active ? 'badge-ready' : 'badge-new'}">${l.active ? 'Aktif' : 'Nonaktif'}</span>
          </div>
          <div class="lapak-card-owner">Pemilik: ${escapeHtml(l.owner_name)}</div>
          <div class="lapak-card-tax">
            <span>Pajak per item</span>
            <strong>${formatCurrency(l.tax_per_item)}</strong>
          </div>
          <div class="lapak-card-actions">
            <button class="btn btn-ghost btn-sm w-full edit-lapak-btn" data-id="${l.id}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">${getIcon('edit')} Edit</button>
            <button class="btn btn-ghost btn-sm w-full delete-lapak-btn" data-id="${l.id}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">${getIcon('trash')} Hapus</button>
          </div>
        </div>`).join('');
    } catch (err) {
      console.error('Failed to render lapak grid:', err);
    }
  }

  function openLapakModal(lapak = null) {
    editingLapakId = lapak ? lapak.id : null;
    document.getElementById('lapak-modal-title').textContent = lapak ? 'Edit Lapak' : 'Tambah Lapak';
    document.getElementById('lapak-name').value = lapak ? lapak.name : '';
    document.getElementById('lapak-owner').value = lapak ? lapak.owner_name : '';
    document.getElementById('lapak-tax').value = lapak ? lapak.tax_per_item : 1000;
    document.getElementById('lapak-edit-id').value = editingLapakId || '';
    openModal('modal-lapak');
  }

  async function saveLapak(e) {
    e.preventDefault();
    const name = document.getElementById('lapak-name').value.trim();
    const ownerName = document.getElementById('lapak-owner').value.trim();
    const taxPerItem = parseInt(document.getElementById('lapak-tax').value) || 0;

    if (!name || !ownerName) {
      showToast('Mohon lengkapi semua field', 'warning');
      return;
    }

    try {
      if (editingLapakId) {
        await store.updateLapak(editingLapakId, { name, ownerName, taxPerItem });
        showToast('Lapak berhasil diupdate', 'success');
      } else {
        await store.addLapak({ name, ownerName, taxPerItem });
        showToast('Lapak baru ditambahkan', 'success');
      }

      closeModal('modal-lapak');
      await renderLapakGrid();
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  }

  // --- Buat Pesanan (identik dengan public/js/pelayan.js, DOM ids prefixed "order-") ---
  function isMobile() { return window.innerWidth <= 767; }

  function openOrderCart() {
    const sidebar = document.getElementById('order-cart-sidebar');
    const overlay = document.getElementById('order-cart-overlay');
    sidebar.classList.add('open');
    document.getElementById('order-cart-fab').classList.add('cart-open');
    if (overlay) {
      overlay.style.display = 'block';
      requestAnimationFrame(() => overlay.classList.add('active'));
    }
    document.body.style.overflow = 'hidden';
  }

  function closeOrderCart() {
    const sidebar = document.getElementById('order-cart-sidebar');
    const overlay = document.getElementById('order-cart-overlay');
    sidebar.classList.remove('open');
    document.getElementById('order-cart-fab').classList.remove('cart-open');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    }
    document.body.style.overflow = '';
  }

  function renderOrderMenuCards(items) {
    const menuGrid = document.getElementById('order-menu-grid');
    menuGrid.innerHTML = '';

    if (items.length === 0) {
      menuGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">${getIcon('inbox')}</div>
          <div class="empty-state-text">Tidak ada item di kategori ini</div>
        </div>`;
      return;
    }

    items.forEach((item, idx) => {
      const inCart = orderCart.find((c) => c.menuId === item.id);
      const card = document.createElement('div');
      card.className = 'menu-item' + (inCart ? ' in-cart' : '');
      card.style.animationDelay = (idx * 50) + 'ms';
      card.dataset.id = item.id;

      let qtyHtml = '';
      if (inCart) {
        qtyHtml = `
          <div class="menu-item-qty">
            <button class="qty-btn" data-action="decrease" data-id="${item.id}">−</button>
            <span class="qty-value">${inCart.qty}</span>
            <button class="qty-btn" data-action="increase" data-id="${item.id}">+</button>
          </div>`;
      }

      card.innerHTML = `
        <div class="menu-item-emoji">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}">` : getIcon(item.emoji)}</div>
        <div class="menu-item-name">${escapeHtml(item.name)}</div>
        <div class="menu-item-price">${formatCurrency(item.price)}</div>
        ${qtyHtml}`;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.qty-btn')) return;
        addToOrderCart(item);
      });

      menuGrid.appendChild(card);
    });

    menuGrid.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeOrderQty(btn.dataset.id, btn.dataset.action === 'increase' ? 1 : -1);
      });
    });
  }

  async function renderOrderMenu() {
    try {
      const items = await store.getMenuByCategory(orderCurrentCategory);
      orderMenuCache = items;
      renderOrderMenuCards(items);
    } catch (err) {
      console.error('Failed to load order menu:', err);
      document.getElementById('order-menu-grid').innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">${getIcon('warning')}</div>
          <div class="empty-state-text">Gagal memuat menu. Coba refresh halaman.</div>
        </div>`;
    }
  }

  function addToOrderCart(item) {
    const existing = orderCart.find((c) => c.menuId === item.id);
    if (existing) {
      existing.qty++;
    } else {
      orderCart.push({
        menuId: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        emoji: item.emoji,
        imageUrl: item.imageUrl,
      });
    }
    renderOrderCart();
    renderOrderMenuCards(orderMenuCache);
    updateOrderFab();
  }

  function changeOrderQty(menuId, delta) {
    const item = orderCart.find((c) => c.menuId === menuId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      orderCart = orderCart.filter((c) => c.menuId !== menuId);
    }
    renderOrderCart();
    renderOrderMenuCards(orderMenuCache);
    updateOrderFab();
  }

  function clearOrderCart() {
    orderCart = [];
    renderOrderCart();
    renderOrderMenuCards(orderMenuCache);
    updateOrderFab();
  }

  function renderOrderCart() {
    const cartItems = document.getElementById('order-cart-items');
    const cartEmpty = document.getElementById('order-cart-empty');
    const cartTotal = document.getElementById('order-cart-total');
    const submitBtn = document.getElementById('order-submit-btn');
    const tableSelectHidden = document.getElementById('order-table-select-hidden');
    const hasItems = orderCart.length > 0;

    cartEmpty.style.display = hasItems ? 'none' : 'flex';
    submitBtn.disabled = !hasItems || !tableSelectHidden.value;

    const existingItems = cartItems.querySelectorAll('.cart-item');
    existingItems.forEach((el) => el.remove());

    if (!hasItems) {
      cartTotal.textContent = 'Rp 0';
      return;
    }

    const fragment = document.createDocumentFragment();
    let total = 0;

    orderCart.forEach((item) => {
      const subtotal = item.price * item.qty;
      total += subtotal;

      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <span class="cart-item-emoji">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">` : getIcon(item.emoji, 'icon-inline')}</span>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${formatCurrency(item.price)}</div>
        </div>
        <div class="cart-item-qty-controls">
          <button class="qty-btn" data-action="decrease" data-id="${item.menuId}">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" data-action="increase" data-id="${item.menuId}">+</button>
        </div>
        <div class="cart-item-subtotal">${formatCurrency(subtotal)}</div>`;
      fragment.appendChild(el);
    });

    cartItems.appendChild(fragment);

    cartItems.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        changeOrderQty(btn.dataset.id, btn.dataset.action === 'increase' ? 1 : -1);
      });
    });

    cartTotal.textContent = formatCurrency(total);
  }

  function updateOrderFab() {
    const count = orderCart.reduce((sum, item) => sum + item.qty, 0);
    const fabCount = document.getElementById('order-cart-fab-count');
    fabCount.textContent = count;
    fabCount.classList.toggle('hidden', count === 0);
  }

  async function submitOrderFromAdmin() {
    const customerNameInput = document.getElementById('order-customer-name');
    const customerName = customerNameInput.value.trim();
    const tableSelectHidden = document.getElementById('order-table-select-hidden');
    const submitBtn = document.getElementById('order-submit-btn');
    const selectedTableText = document.getElementById('order-selected-table-text');
    const orderNotes = document.getElementById('order-notes');

    if (!customerName) {
      showToast('Nama Pemesan wajib diisi!', 'warning');
      customerNameInput.focus();
      return;
    }
    if (orderCart.length === 0) {
      showToast('Keranjang masih kosong!', 'warning');
      return;
    }
    if (!tableSelectHidden.value) {
      showToast('Pilih meja terlebih dahulu', 'warning');
      return;
    }

    const originalBtnHtml = submitBtn.innerHTML;
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Mengirim...';

      const payload = {
        customerName,
        tableNo: parseInt(tableSelectHidden.value),
        items: orderCart.map((item) => ({ ...item })),
        notes: orderNotes.value.trim(),
        waiter: currentUser.name,
      };

      const order = await store.createOrder(payload);
      showToast(`Pesanan #${order.orderNumber} berhasil dikirim!`, 'success');

      customerNameInput.value = '';
      tableSelectHidden.value = '';
      selectedTableText.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Pilih</span>`;
      orderNotes.value = '';
      clearOrderCart();
      closeOrderCart();

      navigateTo('dashboard');
    } catch (err) {
      console.error('Error submitting order:', err);
      showToast('Gagal mengirim pesanan: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }

  // --- Payment ---
  async function renderPaymentGrid() {
    try {
      const allOrders = await store.getActiveOrders();
      // Show every unpaid order — cashiers can take payment right after the order
      // is placed, without waiting for the kitchen to finish cooking it.
      const orders = allOrders.filter((o) => !o.isPaid);
      const grid = document.getElementById('payment-grid');

      await updatePaymentBadge();

      if (orders.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state-icon">${getIcon('credit-card')}</div>
            <div class="empty-state-text">Tidak ada pesanan yang perlu dibayar</div>
          </div>`;
        return;
      }

      const kitchenStatusLabels = { baru: 'Baru', proses: 'Diproses', siap: 'Siap Diantar', diantar: 'Sedang Diantar' };
      const kitchenStatusClasses = { baru: 'badge-new', proses: 'badge-process', siap: 'badge-ready', diantar: 'badge-delivering' };

      grid.innerHTML = orders.map((order) => {
        const itemsHtml = order.items.map((item) =>
          `<div class="payment-card-item">
            <span style="display:flex;align-items:center;gap:8px;">
              ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;">` : getIcon(item.emoji, 'icon-inline')}
              ${escapeHtml(item.name)} × ${item.qty}
            </span>
            <span>${formatCurrency(item.price * item.qty)}</span>
          </div>`
        ).join('');

        return `
          <div class="payment-card" data-order-id="${order.id}">
            <div class="payment-card-header">
              <span class="payment-card-id">${order.orderNumber}</span>
              <span class="badge ${kitchenStatusClasses[order.status] || 'badge-new'}">${kitchenStatusLabels[order.status] || order.status}</span>
            </div>
            <div class="payment-card-table" style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Meja ${order.tableNo} - ${escapeHtml(order.customerName || 'Tanpa Nama')}</div>
            <div class="payment-card-items">${itemsHtml}</div>
            <div class="payment-card-divider"></div>
            <div class="payment-card-total">
              <span>Total</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
            <button class="btn btn-primary w-full pay-btn" data-order-id="${order.id}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">
              ${getIcon('credit-card')} Bayar Sekarang
            </button>
          </div>`;
      }).join('');
    } catch (err) {
      console.error('Failed to render payment grid:', err);
    }
  }

  async function updatePaymentBadge() {
    try {
      const allOrders = await store.getActiveOrders();
      const count = allOrders.filter((o) => !o.isPaid).length;
      paymentBadge.textContent = count;
      paymentBadge.classList.toggle('hidden', count === 0);
    } catch (err) {
      console.error('Failed to update badge:', err);
    }
  }

  async function openPaymentModal(orderId) {
    let order;
    try {
      order = await store.getOrderById(orderId);
    } catch {
      showToast('Gagal memuat data pesanan', 'error');
      return;
    }
    if (!order) return;

    payingOrderId = orderId;
    selectedPaymentMethod = null;

      const itemsHtml = order.items.map(item => `
        <div class="payment-summary-row">
          <span style="display:flex;align-items:center;gap:8px;">
            ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;">` : getIcon(item.emoji, 'icon-inline')} 
            ${item.qty}x ${escapeHtml(item.name)}
          </span>
          <span>${formatCurrency(item.price * item.qty)}</span>
        </div>
      `).join('');

    document.getElementById('payment-modal-body').innerHTML = `
      <div class="payment-summary">
        <div style="font-weight:600;margin-bottom:8px;">${order.orderNumber} · Meja ${order.tableNo} - ${escapeHtml(order.customerName || 'Tanpa Nama')}</div>
        ${itemsHtml}
        <div class="payment-summary-row payment-summary-total">
          <span>TOTAL</span>
          <span>${formatCurrency(order.total)}</span>
        </div>
      </div>

      <label class="form-label">Metode Pembayaran</label>
      <div class="payment-methods">
        <button class="payment-method-btn" data-method="tunai" id="method-tunai" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;flex-direction:column;padding:12px;">
          <span class="method-icon" style="color:var(--brand-primary);">${getIcon('banknote')}</span>
          Tunai
        </button>
        <button class="payment-method-btn" data-method="qris" id="method-qris" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;flex-direction:column;padding:12px;">
          <span class="method-icon" style="color:var(--brand-primary);">${getIcon('smartphone')}</span>
          QRIS
        </button>
      </div>

      <div class="form-group" id="cash-input-group" style="display:none;">
        <label class="form-label" for="cash-amount">Jumlah Uang Diterima</label>
        
        <div class="quick-cash-buttons" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm quick-cash-btn" data-amount="${order.total}">Uang Pas</button>
          <button class="btn btn-outline btn-sm quick-cash-btn" data-amount="20000">20k</button>
          <button class="btn btn-outline btn-sm quick-cash-btn" data-amount="50000">50k</button>
          <button class="btn btn-outline btn-sm quick-cash-btn" data-amount="100000">100k</button>
        </div>

        <input type="number" id="cash-amount" class="form-input" placeholder="Masukkan jumlah uang..." min="${order.total}">
        <div class="payment-change" id="change-display" style="display:none; margin-top:12px;">
          <div class="payment-change-label">Kembalian</div>
          <div class="payment-change-value" id="change-value">Rp 0</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" data-close="modal-payment">Batal</button>
        <button class="btn btn-primary" id="confirm-payment-btn" disabled>
          <span style="display:inline-flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Konfirmasi Bayar</span>
        </button>
      </div>`;

    // Setup payment method listeners
    document.querySelectorAll('.payment-method-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPaymentMethod = btn.dataset.method;
        document.querySelectorAll('.payment-method-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');

        const cashGroup = document.getElementById('cash-input-group');
        const confirmBtn = document.getElementById('confirm-payment-btn');

        if (selectedPaymentMethod === 'tunai') {
          cashGroup.style.display = 'block';
          document.getElementById('cash-amount').focus();
          confirmBtn.disabled = true;
        } else {
          cashGroup.style.display = 'none';
          confirmBtn.disabled = false;
        }
      });
    });

    // Cash amount input
    setTimeout(() => {
      const cashInput = document.getElementById('cash-amount');
      const changeDisplay = document.getElementById('change-display');
      const changeValue = document.getElementById('change-value');
      const confirmBtn = document.getElementById('confirm-payment-btn');

      function updateCashInput(amount) {
        if (!cashInput) return;
        cashInput.value = amount;
        const change = amount - order.total;

        if (amount >= order.total) {
          changeDisplay.style.display = 'flex';
          changeValue.textContent = formatCurrency(change);
          confirmBtn.disabled = false;
        } else {
          changeDisplay.style.display = 'none';
          confirmBtn.disabled = true;
        }
      }

      if (cashInput) {
        cashInput.addEventListener('input', () => {
          const amount = parseInt(cashInput.value) || 0;
          updateCashInput(amount);
        });
      }

      // Quick cash buttons
      document.querySelectorAll('.quick-cash-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const amount = parseInt(btn.dataset.amount);
          updateCashInput(amount);
        });
      });

      // Confirm payment
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          processPayment(order);
        });
      }
    }, 100);

    // Close button for dynamically added button
    const closeBtn = document.querySelector('#payment-modal-body [data-close="modal-payment"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal('modal-payment'));
    }

    openModal('modal-payment');
  }

  async function processPayment(order) {
    if (!selectedPaymentMethod) {
      showToast('Pilih metode pembayaran!', 'warning');
      return;
    }

    let amountPaid = order.total;
    if (selectedPaymentMethod === 'tunai') {
      amountPaid = parseInt(document.getElementById('cash-amount').value) || 0;
      if (amountPaid < order.total) {
        showToast('Jumlah uang kurang!', 'error');
        return;
      }
    }

    try {
      const transaction = await store.processPayment(order.id, selectedPaymentMethod, amountPaid);
      if (transaction) {
        closeModal('modal-payment');
        showToast(`Pembayaran ${order.orderNumber} berhasil!`, 'success');
        playNotificationSound();

        // Show receipt
        showReceipt(transaction);

        // Refresh views
        await renderPaymentGrid();
        await renderDashboard();
        await renderHistoryTable();
      }
    } catch (err) {
      showToast('Gagal memproses pembayaran: ' + err.message, 'error');
    }
  }

  function showReceipt(transaction) {
    const itemsHtml = transaction.items.map((item) =>
      `<div class="receipt-item">
        <span>${item.name} ×${item.qty}</span>
        <span>${formatCurrency(item.price * item.qty)}</span>
      </div>`
    ).join('');

    document.getElementById('receipt-content').innerHTML = `
      <div class="receipt-header">
        <h3>AVORNI COFFEE</h3>
        <div>${formatDateTime(transaction.paidAt)}</div>
        <div>${transaction.orderNumber}</div>
      </div>
      <div>Meja: ${transaction.tableNo}</div>
      <div class="receipt-items">${itemsHtml}</div>
      <div class="receipt-total">
        <span>TOTAL</span>
        <span>${formatCurrency(transaction.total)}</span>
      </div>
      <div class="receipt-item">
        <span>Bayar (${transaction.paymentMethod.toUpperCase()})</span>
        <span>${formatCurrency(transaction.amountPaid)}</span>
      </div>
      <div class="receipt-item">
        <span>Kembalian</span>
        <span>${formatCurrency(transaction.change)}</span>
      </div>
      <div class="receipt-footer">
        Terima kasih telah berkunjung!<br>
        Sampai jumpa kembali
      </div>`;

    openModal('modal-receipt');
  }

  // --- Transaction History ---
  async function renderHistoryTable() {
    try {
      const dateValue = document.getElementById('history-date').value;
      const transactions = await store.getTransactions(dateValue || null);

      // Sort newest first (may already be sorted by API)
      transactions.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

      // Summary
      const totalCount = transactions.length;
      const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
      document.getElementById('history-count').textContent = totalCount;
      document.getElementById('history-revenue').textContent = formatCurrency(totalRevenue);

      // Table
      const tbody = document.getElementById('history-table-body');

      if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:32px;">Tidak ada transaksi</td></tr>';
        return;
      }

      tbody.innerHTML = transactions.map((t) => {
        const itemsSummary = t.items.map((i) => i.qty + '× ' + i.name).join(', ');
        return `
          <tr>
            <td><strong>${t.orderNumber}</strong></td>
            <td>Meja ${t.tableNo}</td>
            <td class="text-sm">${escapeHtml(itemsSummary)}</td>
            <td><strong>${formatCurrency(t.total)}</strong></td>
            <td><span class="badge ${t.paymentMethod === 'tunai' ? 'badge-ready' : 'badge-done'}">${t.paymentMethod.toUpperCase()}</span></td>
            <td>${formatCurrency(t.amountPaid)}</td>
            <td>${formatCurrency(t.change)}</td>
            <td>${formatTime(t.paidAt)}</td>
          </tr>`;
      }).join('');
    } catch (err) {
      console.error('Failed to render history:', err);
    }
  }

  // --- User Management ---
  async function renderUsersTable() {
    try {
      const users = await store.getUsers();
      const tbody = document.getElementById('users-table-body');
      const roleLabels = { 
        admin: getIcon('crown', 'icon-inline') + ' Admin', 
        dapur: getIcon('chef-hat', 'icon-inline') + ' Dapur', 
        pelayan: getIcon('user', 'icon-inline') + ' Pelayan' 
      };

      tbody.innerHTML = users.map((user) => `
        <tr>
          <td><strong>${escapeHtml(user.name)}</strong></td>
          <td>${escapeHtml(user.username)}</td>
          <td>${roleLabels[user.role] || user.role}</td>
          <td>
            <div class="flex gap-xs">
              <button class="btn btn-ghost btn-sm edit-user-btn" data-id="${user.id}" style="display:inline-flex;align-items:center;justify-content:center;">${getIcon('edit')}</button>
              <button class="btn btn-ghost btn-sm delete-user-btn" data-id="${user.id}" style="display:inline-flex;align-items:center;justify-content:center;">${getIcon('trash')}</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      console.error('Failed to render users:', err);
    }
  }

  function openUserModal(user = null) {
    editingUserId = user ? user.id : null;
    document.getElementById('user-modal-title').textContent = user ? 'Edit User' : 'Tambah User';
    document.getElementById('user-fullname').value = user ? user.name : '';
    document.getElementById('user-username').value = user ? user.username : '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = user ? user.role : 'pelayan';
    document.getElementById('user-edit-id').value = editingUserId || '';
    openModal('modal-user');
  }

  async function saveUser(e) {
    e.preventDefault();
    const data = {
      name: document.getElementById('user-fullname').value.trim(),
      username: document.getElementById('user-username').value.trim(),
      password: document.getElementById('user-password').value,
      role: document.getElementById('user-role').value,
    };

    if (!data.name || !data.username || !data.password) {
      showToast('Mohon lengkapi semua field', 'warning');
      return;
    }

    try {
      if (editingUserId) {
        await store.updateUser(editingUserId, data);
        showToast('User berhasil diupdate', 'success');
      } else {
        const result = await store.addUser(data);
        if (!result) {
          showToast('Username sudah digunakan!', 'error');
          return;
        }
        showToast('User baru ditambahkan', 'success');
      }

      closeModal('modal-user');
      await renderUsersTable();
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  }

  // --- Modal Helpers ---
  function openModal(id) {
    document.getElementById(id).classList.add('active');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  // --- Event Listeners ---
  function setupListeners() {
    // Navigation
    navItems.forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => auth.logout());
    document.getElementById('mobile-logout-btn').addEventListener('click', () => auth.logout());

    // Mobile hamburger + sidebar overlay
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
      sidebar.classList.add('open');
      if (sidebarOverlay) sidebarOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.getElementById('hamburger-btn').addEventListener('click', () => {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => closeSidebar());
    }

    // Auto-close sidebar on mobile when a nav item is clicked
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.innerWidth <= 1023) closeSidebar();
      });
    });

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Menu: Add
    document.getElementById('add-menu-btn').addEventListener('click', () => openMenuModal());

    // Menu: Form submit
    document.getElementById('menu-form').addEventListener('submit', saveMenu);

    // Menu: Category filter
    document.querySelectorAll('.menu-filters .filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        menuFilter = btn.dataset.cat;
        document.querySelectorAll('.menu-filters .filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMenuTable();
      });
    });

    // Menu table: Edit, Delete, Toggle (event delegation)
    document.getElementById('menu-table-body').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-menu-btn');
      const deleteBtn = e.target.closest('.delete-menu-btn');
      const toggleBtn = e.target.closest('.menu-status-toggle');

      if (editBtn) {
        try {
          const menu = await store.getMenu();
          const item = menu.find((m) => m.id === editBtn.dataset.id);
          if (item) openMenuModal(item);
        } catch (err) {
          showToast('Gagal memuat data', 'error');
        }
      }

      if (deleteBtn) {
        if (confirm('Hapus menu ini?')) {
          try {
            await store.deleteMenuItem(deleteBtn.dataset.id);
            showToast('Menu dihapus', 'info');
            await renderMenuTable();
          } catch (err) {
            showToast('Gagal menghapus: ' + err.message, 'error');
          }
        }
      }

      if (toggleBtn) {
        try {
          const menu = await store.getMenu();
          const item = menu.find((m) => m.id === toggleBtn.dataset.id);
          if (item) {
            await store.updateMenuItem(item.id, { available: !item.available });
            await renderMenuTable();
            showToast(item.available ? 'Menu ditandai habis' : 'Menu tersedia kembali', 'info');
          }
        } catch (err) {
          showToast('Gagal mengupdate status', 'error');
        }
      }
    });

    // Payment: Pay button (event delegation)
    document.getElementById('payment-grid').addEventListener('click', (e) => {
      const payBtn = e.target.closest('.pay-btn');
      if (payBtn) {
        openPaymentModal(payBtn.dataset.orderId);
      }
    });

    // Print receipt
    document.getElementById('print-receipt-btn').addEventListener('click', () => {
      window.print();
    });

    // History: Date filter
    document.getElementById('history-date').addEventListener('change', renderHistoryTable);

    // Users: Add
    document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());

    // Users: Form submit
    document.getElementById('user-form').addEventListener('submit', saveUser);

    // Users table: Edit, Delete (event delegation)
    document.getElementById('users-table-body').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-user-btn');
      const deleteBtn = e.target.closest('.delete-user-btn');

      if (editBtn) {
        try {
          const users = await store.getUsers();
          const user = users.find((u) => u.id === editBtn.dataset.id);
          if (user) openUserModal(user);
        } catch (err) {
          showToast('Gagal memuat data', 'error');
        }
      }

      if (deleteBtn) {
        if (confirm('Hapus user ini?')) {
          try {
            await store.deleteUser(deleteBtn.dataset.id);
            showToast('User dihapus', 'info');
            await renderUsersTable();
          } catch (err) {
            showToast('Gagal menghapus: ' + err.message, 'error');
          }
        }
      }
    });

    // Lapak: Add
    document.getElementById('add-lapak-btn').addEventListener('click', () => openLapakModal());

    // Lapak: Form submit
    document.getElementById('lapak-form').addEventListener('submit', saveLapak);

    // Lapak grid: Edit, Delete (event delegation)
    document.getElementById('lapak-grid').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-lapak-btn');
      const deleteBtn = e.target.closest('.delete-lapak-btn');

      if (editBtn) {
        try {
          const lapakList = await store.getLapak();
          const lapak = lapakList.find((l) => l.id === editBtn.dataset.id);
          if (lapak) openLapakModal(lapak);
        } catch (err) {
          showToast('Gagal memuat data', 'error');
        }
      }

      if (deleteBtn) {
        if (confirm('Hapus lapak ini? Menu yang terhubung akan menjadi milik cafe.')) {
          try {
            await store.deleteLapak(deleteBtn.dataset.id);
            showToast('Lapak dihapus', 'info');
            await renderLapakGrid();
          } catch (err) {
            showToast('Gagal menghapus: ' + err.message, 'error');
          }
        }
      }
    });

    // Dashboard: Lapak report date filter
    document.getElementById('lapak-report-date').addEventListener('change', (e) => {
      renderLapakReport(e.target.value);
    });

    // --- Buat Pesanan ---
    // Category tabs
    document.querySelectorAll('#page-order .cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        orderCurrentCategory = btn.dataset.cat;
        document.querySelectorAll('#page-order .cat-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderOrderMenu();
      });
    });

    // Floorplan modal
    document.getElementById('order-open-floorplan-btn').addEventListener('click', () => {
      openModal('modal-floorplan');
    });

    document.querySelectorAll('#modal-floorplan .floorplan-table').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#modal-floorplan .floorplan-table').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tableNo = btn.dataset.table;
        document.getElementById('order-table-select-hidden').value = tableNo;
        document.getElementById('order-selected-table-text').innerHTML =
          `<span style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Meja ${tableNo}</span>`;
        document.getElementById('order-submit-btn').disabled = orderCart.length === 0;
        closeModal('modal-floorplan');
      });
    });

    // Clear cart
    document.getElementById('order-clear-cart-btn').addEventListener('click', () => {
      if (orderCart.length === 0) return;
      clearOrderCart();
      showToast('Keranjang dikosongkan', 'info');
    });

    // Mobile cart FAB + overlay
    document.getElementById('order-cart-fab').addEventListener('click', () => {
      const sidebar = document.getElementById('order-cart-sidebar');
      sidebar.classList.contains('open') ? closeOrderCart() : openOrderCart();
    });
    document.getElementById('order-cart-overlay').addEventListener('click', () => closeOrderCart());

    // Submit order
    document.getElementById('order-submit-btn').addEventListener('click', submitOrderFromAdmin);
    document.getElementById('order-submit-btn').addEventListener('click', () => {
      if (isMobile()) closeOrderCart();
    }, true);
  }

  // --- SSE Broadcast Listeners ---
  function setupBroadcast() {
    // New order created
    store.on(MSG_TYPES.ORDER_CREATED, () => {
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'payment') renderPaymentGrid();
      updatePaymentBadge();
    });

    // Order status updated
    store.on(MSG_TYPES.ORDER_UPDATED, (order) => {
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'payment') renderPaymentGrid();
      updatePaymentBadge();

      if (order.status === 'siap') {
        showToast(`Pesanan ${order.orderNumber} siap untuk dibayar!`, 'info');
        playNotificationSound();
      }
    });

    // Menu updated
    store.on(MSG_TYPES.MENU_UPDATED, () => {
      if (currentPage === 'menu') renderMenuTable();
      if (currentPage === 'order') renderOrderMenu();
    });

    // Lapak updated
    store.on(MSG_TYPES.LAPAK_UPDATED, () => {
      if (currentPage === 'lapak') renderLapakGrid();
      if (currentPage === 'dashboard') renderDashboard();
    });

    // Payment processed (from another admin tab)
    store.on(MSG_TYPES.PAYMENT_PROCESSED, () => {
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'payment') renderPaymentGrid();
      if (currentPage === 'history') renderHistoryTable();
      updatePaymentBadge();
    });
  }

  // --- Start ---
  await init();
})();
