(() => {
  const state = {
    admin: null,
    currentSection: 'overview',
    products: [],
    orders: [],
    coupons: [],
    messages: [],
    settings: {}
  };

  const STATUS_LABELS = {
    pending: 'قيد المراجعة',
    processing: 'جاري التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'ملغي'
  };

  const CATEGORY_LABELS = {
    laptops: 'لابتوب',
    business: 'أجهزة أعمال',
    gaming: 'ألعاب',
    desktops: 'أجهزة مكتبية',
    accessories: 'ملحقات وشاشات'
  };

  const PAYMENT_LABELS = {
    cod: 'عند الاستلام',
    card: 'بطاقة إلكترونية',
    bank: 'تحويل بنكي'
  };

  const SECTION_TITLES = {
    overview: 'نظرة عامة وإحصائيات المتجر',
    products: 'إدارة المنتجات والمخزون',
    orders: 'إدارة الطلبات والشحن',
    coupons: 'أكواد الخصم والعروض',
    messages: 'رسائل واستفسارات العملاء',
    settings: 'إعدادات المتجر والأمان'
  };

  const els = {
    loginScreen: document.getElementById('login-screen'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error'),
    adminShell: document.getElementById('admin-shell'),
    adminSidebar: document.getElementById('admin-sidebar'),
    sectionHeading: document.getElementById('section-heading'),
    adminUserName: document.getElementById('admin-user-name'),
    navPendingOrders: document.getElementById('nav-pending-orders'),
    navUnreadMessages: document.getElementById('nav-unread-messages'),
    kpiGrid: document.getElementById('kpi-grid'),
    recentOrdersTbody: document.getElementById('recent-orders-tbody'),
    lowStockList: document.getElementById('low-stock-list'),
    brandBreakdown: document.getElementById('brand-breakdown'),
    productsTbody: document.getElementById('products-tbody'),
    adminProductSearch: document.getElementById('admin-product-search'),
    adminProductBrand: document.getElementById('admin-product-brand'),
    ordersTbody: document.getElementById('orders-tbody'),
    adminOrderSearch: document.getElementById('admin-order-search'),
    adminOrderStatus: document.getElementById('admin-order-status'),
    couponsTbody: document.getElementById('coupons-tbody'),
    couponForm: document.getElementById('coupon-form'),
    messagesList: document.getElementById('messages-list'),
    settingsForm: document.getElementById('settings-form'),
    passwordForm: document.getElementById('password-form'),
    productEditorModal: document.getElementById('product-editor-modal'),
    productEditorTitle: document.getElementById('product-editor-title'),
    productEditorForm: document.getElementById('product-editor-form'),
    specsContainer: document.getElementById('pe-specs-container'),
    orderDetailModal: document.getElementById('order-detail-modal'),
    orderDetailTitle: document.getElementById('order-detail-title'),
    orderDetailBody: document.getElementById('order-detail-body'),
    toastContainer: document.getElementById('toast-container')
  };

  function escapeHtml(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(v) {
    const n = Number(v || 0);
    return `${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ر.س`;
  }

  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    els.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  async function api(url, options = {}) {
    const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { ...headers, ...(options.headers || {}) },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/api/admin/login' && url !== '/api/admin/me') {
      showLogin();
      throw new Error(data.error || 'انتهت جلسة الدخول.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'حدث خطأ غير متوقع.');
    }
    return data;
  }

  // ===========================
  // Auth
  // ===========================
  function showLogin() {
    state.admin = null;
    els.adminShell.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
  }

  function showDashboard(admin) {
    state.admin = admin;
    els.adminUserName.textContent = admin.name || admin.email;
    els.loginScreen.classList.add('hidden');
    els.adminShell.classList.remove('hidden');
    switchSection('overview');
  }

  async function checkSession() {
    try {
      const { admin } = await api('/api/admin/me');
      showDashboard(admin);
    } catch {
      showLogin();
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    els.loginError.classList.add('hidden');
    try {
      const { admin } = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: els.loginEmail.value.trim(),
          password: els.loginPassword.value
        })
      });
      els.loginForm.reset();
      showDashboard(admin);
      showToast('مرحباً بك في لوحة إدارة المتجر', 'success');
    } catch (err) {
      els.loginError.textContent = err.message;
      els.loginError.classList.remove('hidden');
    }
  }

  async function handleLogout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
    showToast('تم تسجيل الخروج.');
  }

  // ===========================
  // Navigation
  // ===========================
  function switchSection(section) {
    state.currentSection = section;
    els.sectionHeading.textContent = SECTION_TITLES[section] || 'لوحة الإدارة';
    els.adminSidebar.classList.remove('open');

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.admin-section').forEach((sec) => {
      sec.classList.toggle('hidden', sec.id !== `sec-${section}`);
    });

    if (section === 'overview') loadOverview();
    if (section === 'products') loadAdminProducts();
    if (section === 'orders') loadAdminOrders();
    if (section === 'coupons') loadAdminCoupons();
    if (section === 'messages') loadAdminMessages();
    if (section === 'settings') loadAdminSettings();
  }

  // ===========================
  // 1. Overview
  // ===========================
  async function loadOverview() {
    try {
      const data = await api('/api/admin/stats');
      const k = data.kpis;

      els.navPendingOrders.textContent = String(k.pending_orders);
      els.navPendingOrders.classList.toggle('hidden', k.pending_orders === 0);
      els.navUnreadMessages.textContent = String(k.unread_messages);
      els.navUnreadMessages.classList.toggle('hidden', k.unread_messages === 0);

      els.kpiGrid.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-label">إجمالي المبيعات</div>
          <div class="kpi-value">${formatMoney(k.total_revenue)}</div>
          <div class="kpi-sub">${k.delivered_orders} طلب مكتمل • ${k.shipped_orders} تم شحنه</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">الطلبات</div>
          <div class="kpi-value">${k.total_orders}</div>
          <div class="kpi-sub">${k.pending_orders} قيد المراجعة • ${k.processing_orders} قيد التجهيز</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">المنتجات والمخزون</div>
          <div class="kpi-value">${k.total_products} منتج</div>
          <div class="kpi-sub">${k.total_inventory_units} قطعة بالمخزون • ${k.low_stock_count} مخزون منخفض</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">رسائل العملاء</div>
          <div class="kpi-value">${k.unread_messages}</div>
          <div class="kpi-sub">رسائل غير مقروءة بحاجة للرد</div>
        </div>
      `;

      els.recentOrdersTbody.innerHTML = data.recent_orders.length
        ? data.recent_orders
            .map(
              (o) => `
              <tr>
                <td><button type="button" class="link-btn" data-open-order="${o.id}" dir="ltr">${escapeHtml(o.order_number)}</button></td>
                <td>${escapeHtml(o.customer_name)}</td>
                <td><strong>${formatMoney(o.total)}</strong></td>
                <td><span class="status-pill st-${escapeHtml(o.status)}">${STATUS_LABELS[o.status] || o.status}</span></td>
              </tr>
            `
            )
            .join('')
        : '<tr><td colspan="4" style="text-align:center;color:var(--ink-muted);">لا توجد طلبات حتى الآن</td></tr>';

      els.lowStockList.innerHTML = data.low_stock_products.length
        ? data.low_stock_products
            .map(
              (p) => `
              <div class="low-stock-item">
                <div>
                  <strong>${escapeHtml(p.title)}</strong>
                  <div class="prod-sku">المتبقي: <strong style="color:${p.stock === 0 ? 'var(--danger)' : 'var(--warning)'};">${p.stock} قطعة</strong></div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" data-quick-restock="${p.id}" data-current-stock="${p.stock}">+5 قطعة</button>
              </div>
            `
            )
            .join('')
        : '<p style="color:var(--success);font-weight:700;">ممتاز! جميع المنتجات متوفرة بكميات جيدة.</p>';

      const maxStock = Math.max(1, ...data.brand_breakdown.map((b) => Number(b.stock_units || 0)));
      els.brandBreakdown.innerHTML = data.brand_breakdown
        .map(
          (b) => `
          <div class="brand-bar-item">
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:0.9rem;">
              <span>${escapeHtml(b.brand.toUpperCase())}</span>
              <span>${b.stock_units} قطعة (${b.product_count} موديل)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.round((b.stock_units / maxStock) * 100)}%;"></div>
            </div>
          </div>
        `
        )
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ===========================
  // 2. Products Management
  // ===========================
  async function loadAdminProducts() {
    try {
      const { products } = await api('/api/products?includeInactive=1');
      state.products = products || [];
      renderProductsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderProductsTable() {
    const search = els.adminProductSearch.value.trim().toLowerCase();
    const brand = els.adminProductBrand.value;

    const filtered = state.products.filter((p) => {
      if (brand !== 'all' && p.brand.toLowerCase() !== brand) return false;
      if (search && !`${p.title} ${p.sku} ${p.brand}`.toLowerCase().includes(search)) return false;
      return true;
    });

    els.productsTbody.innerHTML = filtered.length
      ? filtered
          .map(
            (p) => `
            <tr>
              <td>
                <div class="prod-cell">
                  <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">
                  <div>
                    <strong>${escapeHtml(p.title)}</strong>
                    <span class="prod-sku">${escapeHtml(p.sku)}</span>
                  </div>
                </div>
              </td>
              <td>
                <strong>${escapeHtml(p.brand.toUpperCase())}</strong>
                <span class="prod-sku">${CATEGORY_LABELS[p.category] || p.category}</span>
              </td>
              <td>
                <strong>${formatMoney(p.price)}</strong>
                ${p.old_price ? `<span class="prod-sku" style="text-decoration:line-through;">${formatMoney(p.old_price)}</span>` : ''}
              </td>
              <td>
                <div class="stock-inline">
                  <input type="number" min="0" value="${p.stock}" data-stock-input="${p.id}">
                  <button type="button" class="btn btn-secondary btn-sm" data-save-stock="${p.id}">حفظ</button>
                </div>
              </td>
              <td>
                <span class="status-pill ${p.active ? 'st-active' : 'st-inactive'}">
                  ${p.active ? 'نشط' : 'مخفي'}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:0.4rem;">
                  <button type="button" class="btn btn-secondary btn-sm" data-edit-product="${p.id}">تعديل</button>
                  <button type="button" class="btn-danger-sm" data-delete-product="${p.id}">حذف</button>
                </div>
              </td>
            </tr>
          `
          )
          .join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--ink-muted);">لا توجد منتجات مطابقة</td></tr>';
  }

  function addSpecRow(key = '', val = '') {
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.innerHTML = `
      <input type="text" class="spec-key" placeholder="اسم المواصفة (مثال: المعالج)" value="${escapeHtml(key)}">
      <input type="text" class="spec-val" placeholder="القيمة (مثال: Apple M4 Pro)" value="${escapeHtml(val)}">
      <button type="button" class="btn-danger-sm remove-spec-btn" aria-label="حذف المواصفة">✕</button>
    `;
    row.querySelector('.remove-spec-btn').addEventListener('click', () => row.remove());
    els.specsContainer.appendChild(row);
  }

  function openProductEditor(product = null) {
    els.productEditorForm.reset();
    els.specsContainer.innerHTML = '';
    document.getElementById('pe-upload-status').textContent = 'JPG, PNG, WebP (حد أقصى 3MB)';

    if (product) {
      els.productEditorTitle.textContent = `تعديل المنتج: ${product.title}`;
      document.getElementById('pe-id').value = product.id;
      document.getElementById('pe-title').value = product.title;
      document.getElementById('pe-sku').value = product.sku;
      document.getElementById('pe-brand').value = product.brand;
      document.getElementById('pe-category').value = product.category;
      document.getElementById('pe-badge').value = product.badge || '';
      document.getElementById('pe-price').value = product.price;
      document.getElementById('pe-old-price').value = product.old_price ?? '';
      document.getElementById('pe-stock').value = product.stock;
      document.getElementById('pe-rating').value = product.rating;
      document.getElementById('pe-image').value = product.image;
      document.getElementById('pe-image-preview').src = product.image;
      document.getElementById('pe-description').value = product.description;
      document.getElementById('pe-featured').checked = Boolean(product.featured);
      document.getElementById('pe-active').checked = Boolean(product.active);

      const entries = Object.entries(product.specs || {});
      if (entries.length) {
        entries.forEach(([k, v]) => addSpecRow(k, v));
      } else {
        addSpecRow('الشاشة', '');
        addSpecRow('المعالج', '');
      }
    } else {
      els.productEditorTitle.textContent = 'إضافة منتج جديد';
      document.getElementById('pe-id').value = '';
      document.getElementById('pe-image').value = '/assets/images/macbook-pro-16.jpg';
      document.getElementById('pe-image-preview').src = '/assets/images/macbook-pro-16.jpg';
      document.getElementById('pe-active').checked = true;
      addSpecRow('الشاشة', '');
      addSpecRow('المعالج', '');
      addSpecRow('الذاكرة', '');
      addSpecRow('التخزين', '');
    }

    els.productEditorModal.classList.add('open');
  }

  async function saveProductForm(e) {
    e.preventDefault();
    const id = document.getElementById('pe-id').value;
    const specs = {};
    els.specsContainer.querySelectorAll('.spec-row').forEach((row) => {
      const k = row.querySelector('.spec-key').value.trim();
      const v = row.querySelector('.spec-val').value.trim();
      if (k && v) specs[k] = v;
    });

    const payload = {
      title: document.getElementById('pe-title').value.trim(),
      sku: document.getElementById('pe-sku').value.trim(),
      brand: document.getElementById('pe-brand').value,
      category: document.getElementById('pe-category').value,
      badge: document.getElementById('pe-badge').value.trim(),
      price: Number(document.getElementById('pe-price').value),
      old_price: document.getElementById('pe-old-price').value || null,
      stock: parseInt(document.getElementById('pe-stock').value, 10),
      rating: Number(document.getElementById('pe-rating').value || 4.8),
      image: document.getElementById('pe-image').value.trim(),
      description: document.getElementById('pe-description').value.trim(),
      featured: document.getElementById('pe-featured').checked,
      active: document.getElementById('pe-active').checked,
      specs
    };

    try {
      if (id) {
        const res = await api(`/api/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(res.message, 'success');
      } else {
        const res = await api('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(res.message, 'success');
      }
      els.productEditorModal.classList.remove('open');
      loadAdminProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function uploadProductImage(file) {
    if (!file) return;
    const statusEl = document.getElementById('pe-upload-status');
    statusEl.textContent = 'جاري رفع الصورة...';
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await api('/api/products/upload', { method: 'POST', body: formData });
      document.getElementById('pe-image').value = res.url;
      document.getElementById('pe-image-preview').src = res.url;
      statusEl.textContent = 'تم رفع الصورة بنجاح ✓';
      showToast('تم رفع صورة المنتج بنجاح', 'success');
    } catch (err) {
      statusEl.textContent = err.message;
      showToast(err.message, 'error');
    }
  }

  // ===========================
  // 3. Orders Management
  // ===========================
  async function loadAdminOrders() {
    try {
      const q = new URLSearchParams();
      if (els.adminOrderStatus.value !== 'all') q.set('status', els.adminOrderStatus.value);
      if (els.adminOrderSearch.value.trim()) q.set('search', els.adminOrderSearch.value.trim());

      const { orders } = await api(`/api/orders?${q.toString()}`);
      state.orders = orders || [];
      renderOrdersTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderOrdersTable() {
    els.ordersTbody.innerHTML = state.orders.length
      ? state.orders
          .map(
            (o) => `
            <tr>
              <td><strong dir="ltr">${escapeHtml(o.order_number)}</strong><span class="prod-sku">${escapeHtml(o.created_at)}</span></td>
              <td><strong>${escapeHtml(o.customer_name)}</strong><span class="prod-sku" dir="ltr">${escapeHtml(o.customer_phone)}</span></td>
              <td>${escapeHtml(o.city)}</td>
              <td>${PAYMENT_LABELS[o.payment_method] || o.payment_method}</td>
              <td><strong>${formatMoney(o.total)}</strong></td>
              <td>
                <select class="status-select-inline" data-order-status="${o.id}">
                  ${Object.entries(STATUS_LABELS)
                    .map(
                      ([val, label]) =>
                        `<option value="${val}" ${o.status === val ? 'selected' : ''}>${label}</option>`
                    )
                    .join('')}
                </select>
              </td>
              <td>
                <button type="button" class="btn btn-secondary btn-sm" data-open-order="${o.id}">عرض</button>
              </td>
            </tr>
          `
          )
          .join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);">لا توجد طلبات مطابقة</td></tr>';
  }

  async function updateOrderStatus(orderId, nextStatus) {
    try {
      const res = await api(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      showToast(res.message, 'success');
      if (state.currentSection === 'orders') loadAdminOrders();
      if (state.currentSection === 'overview') loadOverview();
    } catch (err) {
      showToast(err.message, 'error');
      loadAdminOrders();
    }
  }

  async function openOrderDetail(orderId) {
    try {
      const { order } = await api(`/api/orders/${orderId}`);
      els.orderDetailTitle.textContent = `تفاصيل الطلب ${order.order_number}`;
      els.orderDetailBody.innerHTML = `
        <div class="form-grid-2" style="margin-bottom:1rem;background:#f8fafc;padding:1rem;border-radius:10px;border:1px solid var(--border);">
          <div>
            <div><strong>العميل:</strong> ${escapeHtml(order.customer_name)}</div>
            <div><strong>الجوال:</strong> <span dir="ltr">${escapeHtml(order.customer_phone)}</span></div>
            ${order.customer_email ? `<div><strong>البريد:</strong> ${escapeHtml(order.customer_email)}</div>` : ''}
          </div>
          <div>
            <div><strong>المدينة:</strong> ${escapeHtml(order.city)}</div>
            <div><strong>العنوان:</strong> ${escapeHtml(order.address)}</div>
            <div><strong>الدفع:</strong> ${PAYMENT_LABELS[order.payment_method] || order.payment_method}</div>
          </div>
        </div>
        ${order.notes ? `<p style="margin-bottom:1rem;font-size:0.9rem;"><strong>ملاحظات العميل:</strong> ${escapeHtml(order.notes)}</p>` : ''}

        <table class="data-table" style="margin-bottom:1rem;">
          <thead>
            <tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (i) => `
              <tr>
                <td>${escapeHtml(i.product_title)}</td>
                <td>${formatMoney(i.unit_price)}</td>
                <td>${i.quantity}</td>
                <td><strong>${formatMoney(i.line_total)}</strong></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div style="display:flex;flex-direction:column;gap:0.35rem;max-width:300px;margin-right:auto;font-size:0.92rem;">
          <div style="display:flex;justify-content:space-between;"><span>المجموع الفرعي:</span><strong>${formatMoney(order.subtotal)}</strong></div>
          ${order.discount > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--success);"><span>الخصم (${escapeHtml(order.coupon_code)}):</span><strong>-${formatMoney(order.discount)}</strong></div>` : ''}
          <div style="display:flex;justify-content:space-between;"><span>الشحن:</span><strong>${order.shipping_fee === 0 ? 'مجاني' : formatMoney(order.shipping_fee)}</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>الضريبة:</span><strong>${formatMoney(order.vat_amount)}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:1.08rem;padding-top:0.5rem;border-top:1px solid var(--border);"><span>الإجمالي النهائي:</span><strong style="color:var(--primary);">${formatMoney(order.total)}</strong></div>
        </div>
      `;
      els.orderDetailModal.classList.add('open');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ===========================
  // 4. Coupons
  // ===========================
  async function loadAdminCoupons() {
    try {
      const { coupons } = await api('/api/coupons');
      state.coupons = coupons || [];
      els.couponsTbody.innerHTML = state.coupons.length
        ? state.coupons
            .map(
              (c) => `
              <tr>
                <td><strong dir="ltr">${escapeHtml(c.code)}</strong></td>
                <td>${c.discount_type === 'percent' ? `${c.discount_value}%` : formatMoney(c.discount_value)}</td>
                <td>${formatMoney(c.min_order)}</td>
                <td>${c.used_count} / ${c.max_uses === 0 ? '∞' : c.max_uses}</td>
                <td><span class="status-pill ${c.active ? 'st-active' : 'st-inactive'}">${c.active ? 'مفعّل' : 'موقوف'}</span></td>
                <td>
                  <div style="display:flex;gap:0.4rem;">
                    <button type="button" class="btn btn-secondary btn-sm" data-toggle-coupon="${c.id}">${c.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button type="button" class="btn-danger-sm" data-delete-coupon="${c.id}">حذف</button>
                  </div>
                </td>
              </tr>
            `
            )
            .join('')
        : '<tr><td colspan="6" style="text-align:center;color:var(--ink-muted);">لا توجد أكواد خصم</td></tr>';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ===========================
  // 5. Messages
  // ===========================
  async function loadAdminMessages() {
    try {
      const { messages } = await api('/api/messages');
      state.messages = messages || [];
      els.messagesList.innerHTML = state.messages.length
        ? state.messages
            .map(
              (m) => `
              <article class="message-card ${m.is_read ? '' : 'unread'}">
                <div class="message-head">
                  <div>
                    <strong>${escapeHtml(m.subject)}</strong>
                    <div class="prod-sku">من: ${escapeHtml(m.name)} (${escapeHtml(m.email)}) ${m.phone ? `• ${escapeHtml(m.phone)}` : ''}</div>
                  </div>
                  <span class="status-pill ${m.is_read ? 'st-delivered' : 'st-processing'}">${m.is_read ? 'مقروءة' : 'جديدة'}</span>
                </div>
                <p style="color:var(--ink-secondary);font-size:0.92rem;">${escapeHtml(m.body)}</p>
                <div class="message-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-toggle-read="${m.id}" data-read-next="${m.is_read ? 0 : 1}">
                    ${m.is_read ? 'تحديد كغير مقروءة' : 'تحديد كمقروءة'}
                  </button>
                  <a href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('رد: ' + m.subject)}" class="btn btn-secondary btn-sm">رد عبر البريد</a>
                  <button type="button" class="btn-danger-sm" data-delete-message="${m.id}">حذف</button>
                </div>
              </article>
            `
            )
            .join('')
        : '<p style="text-align:center;color:var(--ink-muted);padding:2rem;">لا توجد رسائل حالياً.</p>';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ===========================
  // 6. Settings & Password
  // ===========================
  async function loadAdminSettings() {
    try {
      const { settings } = await api('/api/admin/public-settings');
      state.settings = settings || {};
      for (const [key, value] of Object.entries(state.settings)) {
        const input = document.getElementById(`set-${key}`);
        if (input) input.value = value;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ===========================
  // Events
  // ===========================
  function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);
    document.getElementById('fill-demo-creds').addEventListener('click', () => {
      els.loginEmail.value = 'admin@computers-market.sa';
      els.loginPassword.value = 'Admin@2026';
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Sidebar nav
    document.getElementById('sidebar-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-item[data-section]');
      if (btn) switchSection(btn.dataset.section);
    });
    document.getElementById('open-sidebar-btn').addEventListener('click', () => els.adminSidebar.classList.add('open'));
    document.getElementById('close-sidebar-btn').addEventListener('click', () => els.adminSidebar.classList.remove('open'));

    // Jump links
    document.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump-section]');
      if (jump) switchSection(jump.dataset.jumpSection);

      const orderBtn = e.target.closest('[data-open-order]');
      if (orderBtn) openOrderDetail(parseInt(orderBtn.dataset.openOrder, 10));

      const restockBtn = e.target.closest('[data-quick-restock]');
      if (restockBtn) {
        const pid = parseInt(restockBtn.dataset.quickRestock, 10);
        const nextStock = parseInt(restockBtn.dataset.currentStock, 10) + 5;
        api(`/api/products/${pid}/stock`, {
          method: 'PATCH',
          body: JSON.stringify({ stock: nextStock })
        })
          .then(() => {
            showToast('تمت إضافة 5 قطع للمخزون', 'success');
            loadOverview();
          })
          .catch((err) => showToast(err.message, 'error'));
      }
    });

    // Products filters & actions
    els.adminProductSearch.addEventListener('input', renderProductsTable);
    els.adminProductBrand.addEventListener('change', renderProductsTable);
    document.getElementById('open-add-product-btn').addEventListener('click', () => openProductEditor(null));
    document.getElementById('close-product-editor').addEventListener('click', () => els.productEditorModal.classList.remove('open'));
    document.getElementById('pe-cancel-btn').addEventListener('click', () => els.productEditorModal.classList.remove('open'));
    document.getElementById('add-spec-row-btn').addEventListener('click', () => addSpecRow('', ''));
    document.getElementById('pe-image').addEventListener('input', (e) => {
      document.getElementById('pe-image-preview').src = e.target.value.trim();
    });
    document.getElementById('pe-image-file').addEventListener('change', (e) => {
      uploadProductImage(e.target.files[0]);
    });
    els.productEditorForm.addEventListener('submit', saveProductForm);

    els.productsTbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-product]');
      const delBtn = e.target.closest('[data-delete-product]');
      const saveStockBtn = e.target.closest('[data-save-stock]');

      if (editBtn) {
        const pid = parseInt(editBtn.dataset.editProduct, 10);
        const prod = state.products.find((p) => p.id === pid);
        if (prod) openProductEditor(prod);
      }

      if (saveStockBtn) {
        const pid = parseInt(saveStockBtn.dataset.saveStock, 10);
        const input = els.productsTbody.querySelector(`[data-stock-input="${pid}"]`);
        try {
          const res = await api(`/api/products/${pid}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({ stock: parseInt(input.value, 10) })
          });
          showToast(res.message, 'success');
          loadAdminProducts();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }

      if (delBtn) {
        const pid = parseInt(delBtn.dataset.deleteProduct, 10);
        if (!window.confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return;
        try {
          const res = await api(`/api/products/${pid}`, { method: 'DELETE' });
          showToast(res.message, 'success');
          loadAdminProducts();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Orders filters & status change
    els.adminOrderSearch.addEventListener('input', loadAdminOrders);
    els.adminOrderStatus.addEventListener('change', loadAdminOrders);
    document.getElementById('refresh-orders-btn').addEventListener('click', loadAdminOrders);
    els.ordersTbody.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-order-status]');
      if (sel) updateOrderStatus(parseInt(sel.dataset.orderStatus, 10), sel.value);
    });
    document.getElementById('close-order-detail').addEventListener('click', () => els.orderDetailModal.classList.remove('open'));

    // Coupons
    els.couponForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/api/coupons', {
          method: 'POST',
          body: JSON.stringify({
            code: document.getElementById('cp-code').value.trim(),
            discount_type: document.getElementById('cp-type').value,
            discount_value: Number(document.getElementById('cp-value').value),
            min_order: Number(document.getElementById('cp-min').value || 0),
            max_uses: parseInt(document.getElementById('cp-max').value || 0, 10)
          })
        });
        els.couponForm.reset();
        showToast(res.message, 'success');
        loadAdminCoupons();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    els.couponsTbody.addEventListener('click', async (e) => {
      const tog = e.target.closest('[data-toggle-coupon]');
      const del = e.target.closest('[data-delete-coupon]');
      if (tog) {
        try {
          const res = await api(`/api/coupons/${tog.dataset.toggleCoupon}`, { method: 'PATCH', body: JSON.stringify({}) });
          showToast(res.message, 'success');
          loadAdminCoupons();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
      if (del) {
        if (!window.confirm('حذف كود الخصم؟')) return;
        try {
          const res = await api(`/api/coupons/${del.dataset.deleteCoupon}`, { method: 'DELETE' });
          showToast(res.message, 'success');
          loadAdminCoupons();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Messages
    els.messagesList.addEventListener('click', async (e) => {
      const readBtn = e.target.closest('[data-toggle-read]');
      const delBtn = e.target.closest('[data-delete-message]');
      if (readBtn) {
        try {
          await api(`/api/messages/${readBtn.dataset.toggleRead}/read`, {
            method: 'PATCH',
            body: JSON.stringify({ is_read: Number(readBtn.dataset.readNext) })
          });
          loadAdminMessages();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
      if (delBtn) {
        if (!window.confirm('حذف هذه الرسالة؟')) return;
        try {
          await api(`/api/messages/${delBtn.dataset.deleteMessage}`, { method: 'DELETE' });
          showToast('تم حذف الرسالة.', 'success');
          loadAdminMessages();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Settings
    els.settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(els.settingsForm);
      const payload = Object.fromEntries(formData.entries());
      try {
        const res = await api('/api/admin/settings', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Change Password
    els.passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('pw-current').value;
      const newPassword = document.getElementById('pw-new').value;
      const confirmPassword = document.getElementById('pw-confirm').value;
      if (newPassword !== confirmPassword) {
        showToast('كلمتا المرور الجديدتان غير متطابقتين.', 'error');
        return;
      }
      try {
        const res = await api('/api/admin/password', {
          method: 'POST',
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
        els.passwordForm.reset();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        els.productEditorModal.classList.remove('open');
        els.orderDetailModal.classList.remove('open');
      }
    });
  }

  bindEvents();
  checkSession();
})();
