/* ============================================
   AVORNI COFFEE POS — Pelayan (Waiter) Logic
   API-backed version with SSE real-time
   ============================================ */

(async function () {
  'use strict';

  // --- Auth Check ---
  const currentUser = auth.requireRole('pelayan');
  if (!currentUser) return;

  document.getElementById('user-name').textContent = currentUser.name;

  // --- State ---
  let cart = []; // [{menuId, name, price, qty, emoji}]
  let currentCategory = 'kopi';
  let currentTab = 'order';
  let statusFilter = 'all';
  let menuCache = []; // Cache loaded menu items

  // --- DOM References ---
  const menuGrid = document.getElementById('menu-grid');
  const cartItems = document.getElementById('cart-items');
  const cartEmpty = document.getElementById('cart-empty');
  const cartTotal = document.getElementById('cart-total');
  const openFloorplanBtn = document.getElementById('open-floorplan-btn');
  const selectedTableText = document.getElementById('selected-table-text');
  const tableSelectHidden = document.getElementById('table-select-hidden');
  const modalFloorplan = document.getElementById('modal-floorplan');
  const closeFloorplanBtn = document.getElementById('close-floorplan-btn');
  const orderNotes = document.getElementById('order-notes');
  const submitBtn = document.getElementById('submit-order-btn');
  const clearCartBtn = document.getElementById('clear-cart-btn');
  const activeCount = document.getElementById('active-count');
  const myOrdersGrid = document.getElementById('my-orders-grid');
  const cartFab = document.getElementById('cart-fab');
  const cartFabCount = document.getElementById('cart-fab-count');
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartOverlay = document.getElementById('cart-overlay');

  // --- Cart Bottom Sheet helpers ---
  function openCart() {
    cartSidebar.classList.add('open');
    if (cartFab) cartFab.classList.add('cart-open');
    if (cartOverlay) {
      cartOverlay.style.display = 'block';
      requestAnimationFrame(() => cartOverlay.classList.add('active'));
    }
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    cartSidebar.classList.remove('open');
    if (cartFab) cartFab.classList.remove('cart-open');
    if (cartOverlay) {
      cartOverlay.classList.remove('active');
      setTimeout(() => { cartOverlay.style.display = 'none'; }, 400);
    }
    document.body.style.overflow = '';
  }
  function isMobile() { return window.innerWidth <= 767; }

  // --- Initialize ---
  async function init() {
    // populateTableSelect(); removed
    await renderMenu();
    renderCart();
    await renderMyOrders();
    await updateActiveCount();
    setupListeners();
    setupBroadcast();
  }

  // Populate table function removed

  // --- Menu Rendering ---
  async function renderMenu() {
    try {
      const items = await store.getMenuByCategory(currentCategory);
      menuCache = items;
      menuGrid.innerHTML = '';

      if (items.length === 0) {
        menuGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-state-icon">${getIcon('inbox', 'lucide-icon')}</div>
            <div class="empty-state-text">Tidak ada item di kategori ini</div>
          </div>`;
        return;
      }

      items.forEach((item, idx) => {
        const inCart = cart.find((c) => c.menuId === item.id);
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

        // Click to add to cart (only if not already in cart via the card itself)
        card.addEventListener('click', (e) => {
          try {
            if (e.target.closest('.qty-btn')) return; // ignore qty button clicks
            addToCart(item);
          } catch(err) {
            alert("Error on click: " + err.message);
          }
        });

        menuGrid.appendChild(card);
      });

      // Qty button listeners
      menuGrid.querySelectorAll('.qty-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (btn.dataset.action === 'increase') {
            changeQty(id, 1);
          } else {
            changeQty(id, -1);
          }
        });
      });
    } catch (err) {
      console.error('Failed to load menu:', err);
      menuGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">${getIcon('warning', 'lucide-icon')}</div>
          <div class="empty-state-text">Gagal memuat menu. Coba refresh halaman.</div>
        </div>`;
    }
  }

  // --- Cart Logic ---
  function addToCart(item) {
    try {
      const existing = cart.find((c) => c.menuId === item.id);
      if (existing) {
        existing.qty++;
      } else {
        cart.push({
          menuId: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
          emoji: item.emoji,
          imageUrl: item.imageUrl,
        });
      }
      renderCart();
      renderMenuFromCache(); // Use cache to avoid extra API call
      updateFab();
    } catch (err) {
      alert("Error in addToCart: " + err.message);
    }
  }

  function changeQty(menuId, delta) {
    const item = cart.find((c) => c.menuId === menuId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((c) => c.menuId !== menuId);
    }
    renderCart();
    renderMenuFromCache();
    updateFab();
  }

  function clearCart() {
    cart = [];
    renderCart();
    renderMenuFromCache();
    updateFab();
  }

  // Render menu from cache (no API call) for fast cart updates
  function renderMenuFromCache() {
    if (menuCache.length === 0) return;

    menuGrid.innerHTML = '';
    menuCache.forEach((item, idx) => {
      const inCart = cart.find((c) => c.menuId === item.id);
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
        try {
          if (e.target.closest('.qty-btn')) return;
          addToCart(item);
        } catch(err) {
          alert("Error on click cache: " + err.message);
        }
      });

      menuGrid.appendChild(card);
    });

    menuGrid.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.action === 'increase') {
          changeQty(id, 1);
        } else {
          changeQty(id, -1);
        }
      });
    });
  }

  function renderCart() {
    const hasItems = cart.length > 0;
    cartEmpty.style.display = hasItems ? 'none' : 'flex';
    // Only disable when cart is truly empty — nama & meja validated at submit time
    submitBtn.disabled = !hasItems;

    if (!hasItems) {
      // Keep the empty state but clear cart item elements
      const existingItems = cartItems.querySelectorAll('.cart-item');
      existingItems.forEach((el) => el.remove());
      cartTotal.textContent = 'Rp 0';
      return;
    }

    // Rebuild cart items
    const fragment = document.createDocumentFragment();
    let total = 0;

    cart.forEach((item) => {
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

    // Clear existing items and append new ones
    const existingItems = cartItems.querySelectorAll('.cart-item');
    existingItems.forEach((el) => el.remove());
    cartItems.appendChild(fragment);

    // Cart qty buttons
    cartItems.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'increase') {
          changeQty(id, 1);
        } else {
          changeQty(id, -1);
        }
      });
    });

    cartTotal.textContent = formatCurrency(total);
  }

  function updateFab() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    cartFabCount.textContent = count;
    cartFabCount.classList.toggle('hidden', count === 0);
  }

  // --- Cart Inline Validation ---
  /**
   * Validates all cart fields. Highlights bad fields and shakes submit button.
   * Returns true if valid, false if not.
   */
  function validateCart() {
    const customerNameInput = document.getElementById('customer-name');
    const fieldCustomer = document.getElementById('field-customer-name');
    const fieldTable = document.getElementById('field-table-select');
    const errCart = document.getElementById('err-cart-empty');
    let valid = true;

    // 1. Cart must have items
    if (cart.length === 0) {
      cartItems.classList.add('cart-error');
      if (errCart) errCart.style.display = 'flex';
      valid = false;
    } else {
      cartItems.classList.remove('cart-error');
      if (errCart) errCart.style.display = 'none';
    }

    // 2. Customer name required
    const name = customerNameInput ? customerNameInput.value.trim() : '';
    if (!name) {
      fieldCustomer && fieldCustomer.classList.add('field-error');
      valid = false;
    } else {
      fieldCustomer && fieldCustomer.classList.remove('field-error');
    }

    // 3. Table required
    if (!tableSelectHidden.value) {
      fieldTable && fieldTable.classList.add('field-error');
      valid = false;
    } else {
      fieldTable && fieldTable.classList.remove('field-error');
    }

    // Shake the submit button on error
    if (!valid) {
      submitBtn.classList.remove('btn-shake');
      void submitBtn.offsetWidth; // reflow to restart animation
      submitBtn.classList.add('btn-shake');
      submitBtn.addEventListener('animationend', () => submitBtn.classList.remove('btn-shake'), { once: true });
    }

    return valid;
  }

  /** Remove validation state from a field when user starts fixing it */
  function clearFieldError(fieldId) {
    const el = document.getElementById(fieldId);
    if (el) el.classList.remove('field-error');
  }

    // --- Submit Order ---
  async function submitOrder() {
    // Run inline validation first — shows visual errors on bad fields
    if (!validateCart()) return;

    const customerNameInput = document.getElementById('customer-name');
    const customerName = customerNameInput ? customerNameInput.value.trim() : '';

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Mengirim...';

      const payload = {
        customerName: document.getElementById('customer-name').value.trim(),
        tableNo: parseInt(tableSelectHidden.value),
        items: cart.map((item) => ({ ...item })),
        notes: orderNotes.value.trim(),
        waiter: currentUser.name,
      };

      const order = await store.createOrder(payload);

      showToast(`Pesanan #${order.orderNumber} berhasil dikirim!`, 'success');
      
       cart = [];
      document.getElementById('customer-name').value = '';
      tableSelectHidden.value = '';
      selectedTableText.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Pilih</span>`;
      orderNotes.value = '';
      clearCart();
      
      // Navigate to status tab automatically
      document.getElementById('tab-status').click();
    } catch (error) {
      console.error('Error submitting order:', error);
      showToast('Gagal mengirim pesanan: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        Kirim Pesanan
      `;
    }
  }

  // --- My Orders ---
  async function renderMyOrders() {
    try {
      let orders = await store.getActiveOrders();

      if (statusFilter !== 'all') {
        orders = orders.filter((o) => o.status === statusFilter);
      }

      // Sort newest first
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      myOrdersGrid.innerHTML = '';

      if (orders.length === 0) {
        myOrdersGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-state-icon">${getIcon('clipboard', 'lucide-icon')}</div>
            <div class="empty-state-text">Tidak ada pesanan aktif</div>
          </div>`;
        return;
      }

      orders.forEach((order, idx) => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.dataset.status = order.status;
        card.style.animationDelay = (idx * 60) + 'ms';

        const statusLabels = {
          baru: 'Baru',
          proses: 'Diproses',
          siap: 'Siap Diantar',
          diantar: 'Makan / Belum Bayar',
          selesai: 'Selesai',
        };

        const statusBadgeClass = {
          baru: 'badge-new',
          proses: 'badge-process',
          siap: 'badge-ready',
          diantar: 'badge-delivering',
          selesai: 'badge-done',
        };

        const itemsHtml = order.items.map((item) =>
          `<div class="order-card-item">
            <span style="display:inline-flex;align-items:center;gap:6px;">${getIcon(item.emoji, 'icon-inline')} ${escapeHtml(item.name)} × ${item.qty}</span>
            <span>${formatCurrency(item.price * item.qty)}</span>
          </div>`
        ).join('');

        const notesHtml = order.notes
          ? `<div class="order-card-notes">Catatan: ${escapeHtml(order.notes)}</div>`
          : '';

        const actionHtml = order.status === 'siap' 
          ? `<div class="order-card-actions" style="margin-top: 12px; border-top: 1px dashed var(--glass-border); padding-top: 12px;">
              <button class="btn btn-warning btn-sm btn-antar w-full" data-id="${order.id}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">
                ${getIcon('truck', 'icon-inline')} Konfirmasi Sudah Diantar
              </button>
            </div>`
          : '';

        card.innerHTML = `
          <div class="order-card-header">
            <div>
              <div class="order-card-id">${order.orderNumber}</div>
              <div class="order-card-table" style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Meja ${order.tableNo} <span style="opacity: 0.8">(${escapeHtml(order.customerName || 'Tanpa Nama')})</span></div>
            </div>
            <span style="display:inline-flex;align-items:center;gap:6px;">
              ${order.isPaid ? '<span class="badge badge-ready">Lunas</span>' : ''}
              <span class="badge ${statusBadgeClass[order.status]}">${statusLabels[order.status]}</span>
            </span>
          </div>
          <div class="order-card-items">${itemsHtml}</div>
          ${notesHtml}
          <div class="order-card-footer">
            <span class="order-card-time" style="display:inline-flex;align-items:center;gap:4px;">${getIcon('clock', 'icon-inline')} ${formatTime(order.createdAt)}</span>
            <span class="order-card-total">${formatCurrency(order.total)}</span>
          </div>
          ${actionHtml}`;

        myOrdersGrid.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }

  async function updateActiveCount() {
    try {
      const orders = await store.getActiveOrders();
      const count = orders.length;
      activeCount.textContent = count;
      activeCount.classList.toggle('hidden', count === 0);
    } catch (err) {
      console.error('Failed to update count:', err);
    }
  }

  // --- Event Listeners ---
  function setupListeners() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      auth.logout();
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('page-order').classList.toggle('hidden', currentTab !== 'order');
        document.getElementById('page-status').classList.toggle('hidden', currentTab !== 'status');
        if (currentTab === 'status') {
          renderMyOrders();
        }
      });
    });

    // Category tabs
    document.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.cat;
        document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMenu();
      });
    });

    // Floorplan listeners
    openFloorplanBtn.addEventListener('click', () => {
      modalFloorplan.classList.add('active');
    });

    closeFloorplanBtn.addEventListener('click', () => {
      modalFloorplan.classList.remove('active');
    });

    // Close on overlay click
    modalFloorplan.addEventListener('click', (e) => {
      if (e.target === modalFloorplan) {
        modalFloorplan.classList.remove('active');
      }
    });

    // Table selection from floorplan
    const floorplanTables = document.querySelectorAll('.floorplan-table');
    floorplanTables.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all
        floorplanTables.forEach(b => b.classList.remove('active'));
        // Add active to clicked
        btn.classList.add('active');
        const tableNo = btn.dataset.table;
        tableSelectHidden.value = tableNo;
        selectedTableText.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;">${getIcon('table', 'icon-inline')} Meja ${tableNo}</span>`;
        
        // Clear table validation error when table is selected
        clearFieldError('field-table-select');

        // Re-evaluate submit button
        submitBtn.disabled = cart.length === 0;
        
        // Close modal
        modalFloorplan.classList.remove('active');
      });
    });

    // Submit order
    submitBtn.addEventListener('click', submitOrder);

    // Clear cart
    clearCartBtn.addEventListener('click', () => {
      if (cart.length === 0) return;
      clearCart();
      showToast('Keranjang dikosongkan', 'info');
    });

    // Auto-clear validation errors when user types customer name
    const customerNameInput = document.getElementById('customer-name');
    if (customerNameInput) {
      customerNameInput.addEventListener('input', () => {
        if (customerNameInput.value.trim()) clearFieldError('field-customer-name');
        const errCart = document.getElementById('err-cart-empty');
        // Re-enable submit button if items present
        submitBtn.disabled = cart.length === 0;
      });
    }

    // Handle 'Konfirmasi Sudah Diantar' click
    myOrdersGrid.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-antar');
      if (!btn) return;
      
      const orderId = btn.dataset.id;
      btn.disabled = true;
      try {
        const updated = await store.updateOrderStatus(orderId, 'diantar');
        showToast(
          updated && updated.status === 'selesai'
            ? 'Pesanan diantar — pesanan ini sudah lunas, transaksi selesai!'
            : 'Pesanan dikonfirmasi telah diantar ke meja!',
          'success'
        );
        renderMyOrders();
      } catch (err) {
        showToast('Gagal mengupdate status: ' + err.message, 'error');
        btn.disabled = false;
      }
    });

    // Status filter buttons
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        statusFilter = btn.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderMyOrders();
      });
    });

    // Mobile cart FAB — toggle bottom sheet
    cartFab.addEventListener('click', () => {
      if (cartSidebar.classList.contains('open')) {
        closeCart();
      } else {
        openCart();
      }
    });

    // Close cart on overlay click (mobile)
    if (cartOverlay) {
      cartOverlay.addEventListener('click', () => closeCart());
    }

    // Close cart on submit / clear
    submitBtn.addEventListener('click', () => {
      if (isMobile()) closeCart();
    }, true);
  }

  // --- SSE Broadcast Listeners ---
  function setupBroadcast() {
    // When order status is updated (from kitchen)
    store.on(MSG_TYPES.ORDER_UPDATED, (order) => {
      if (currentTab === 'status') {
        renderMyOrders();
      }
      updateActiveCount();

      if (order.status === 'siap') {
        showToast(`Pesanan ${order.orderNumber} (Meja ${order.tableNo}) SIAP disajikan!`, 'success');
        playNotificationSound();
      }
    });

    // When menu is updated (from admin)
    store.on(MSG_TYPES.MENU_UPDATED, () => {
      renderMenu();
    });

    // When payment is processed (from admin)
    store.on(MSG_TYPES.PAYMENT_PROCESSED, () => {
      if (currentTab === 'status') {
        renderMyOrders();
      }
      updateActiveCount();
    });
  }

  // --- Start ---
  await init();
})();
