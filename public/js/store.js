(() => {
  const CART_STORAGE_KEY = 'techmarket_cart_v2';
  const WISHLIST_STORAGE_KEY = 'techmarket_wishlist_v2';

  const state = {
    products: [],
    settings: {
      store_name: 'تِك ماركت للكمبيوتر',
      whatsapp: '966501234567',
      vat_rate: '15',
      shipping_fee: '35',
      free_shipping_threshold: '1500',
      currency: 'ر.س'
    },
    filters: {
      brand: 'all',
      category: 'all',
      search: '',
      sort: 'featured',
      inStockOnly: false,
      wishlistOnly: false
    },
    cart: loadJson(CART_STORAGE_KEY, []),
    wishlist: loadJson(WISHLIST_STORAGE_KEY, []),
    coupon: null,
    lastOrder: null
  };

  // DOM references
  const els = {
    productsGrid: document.getElementById('products-grid'),
    resultsCount: document.getElementById('results-count'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    searchInput: document.getElementById('search-input'),
    brandSelect: document.getElementById('brand-select'),
    sortSelect: document.getElementById('sort-select'),
    inStockOnly: document.getElementById('in-stock-only'),
    wishlistFilterBtn: document.getElementById('wishlist-filter-btn'),
    wishlistCount: document.getElementById('wishlist-count'),
    cartCount: document.getElementById('cart-count'),
    openCartBtn: document.getElementById('open-cart-btn'),
    closeCartBtn: document.getElementById('close-cart-btn'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartBackdrop: document.getElementById('cart-backdrop'),
    cartItemsList: document.getElementById('cart-items-list'),
    cartItemsSubtitle: document.getElementById('cart-items-subtitle'),
    cartFooter: document.getElementById('cart-footer'),
    freeShippingBar: document.getElementById('free-shipping-bar'),
    freeShippingText: document.getElementById('free-shipping-text'),
    freeShippingProgress: document.getElementById('free-shipping-progress'),
    couponInput: document.getElementById('coupon-input'),
    applyCouponBtn: document.getElementById('apply-coupon-btn'),
    appliedCouponBanner: document.getElementById('applied-coupon-banner'),
    appliedCouponText: document.getElementById('applied-coupon-text'),
    removeCouponBtn: document.getElementById('remove-coupon-btn'),
    cartSubtotal: document.getElementById('cart-subtotal'),
    cartDiscountRow: document.getElementById('cart-discount-row'),
    cartDiscount: document.getElementById('cart-discount'),
    cartShipping: document.getElementById('cart-shipping'),
    cartVatRate: document.getElementById('cart-vat-rate'),
    cartVat: document.getElementById('cart-vat'),
    cartTotal: document.getElementById('cart-total'),
    proceedCheckoutBtn: document.getElementById('proceed-checkout-btn'),
    whatsappCartBtn: document.getElementById('whatsapp-cart-btn'),
    productModal: document.getElementById('product-modal'),
    productModalBody: document.getElementById('product-modal-body'),
    closeProductModal: document.getElementById('close-product-modal'),
    checkoutModal: document.getElementById('checkout-modal'),
    closeCheckoutModal: document.getElementById('close-checkout-modal'),
    checkoutFormView: document.getElementById('checkout-form-view'),
    checkoutSuccessView: document.getElementById('checkout-success-view'),
    checkoutForm: document.getElementById('checkout-form'),
    checkoutItems: document.getElementById('checkout-items'),
    checkoutTotals: document.getElementById('checkout-totals'),
    cardPaymentBox: document.getElementById('card-payment-box'),
    bankPaymentBox: document.getElementById('bank-payment-box'),
    confirmOrderBtn: document.getElementById('confirm-order-btn'),
    trackOrderForm: document.getElementById('track-order-form'),
    trackOrderNumber: document.getElementById('track-order-number'),
    trackOrderPhone: document.getElementById('track-order-phone'),
    trackResult: document.getElementById('track-result'),
    contactForm: document.getElementById('contact-form'),
    contactSubmitBtn: document.getElementById('contact-submit-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    closeMobileMenu: document.getElementById('close-mobile-menu'),
    mobileDrawer: document.getElementById('mobile-drawer'),
    mobileDrawerBackdrop: document.getElementById('mobile-drawer-backdrop'),
    toastContainer: document.getElementById('toast-container')
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage quota errors
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(amount) {
    const num = Number(amount || 0);
    return `${num.toLocaleString('en-US', { minimumFractionDigits: num % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${state.settings.currency || 'ر.س'}`;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'حدث خطأ أثناء الاتصال بالخادم.');
    }
    return data;
  }

  // ===========================
  // Settings & Initial Data Load
  // ===========================
  async function loadSettings() {
    try {
      const { settings } = await apiFetch('/api/admin/public-settings');
      if (settings) {
        state.settings = { ...state.settings, ...settings };
        applySettingsToDOM();
      }
    } catch {
      applySettingsToDOM();
    }
  }

  function applySettingsToDOM() {
    const s = state.settings;
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.textContent = val;
    };

    if (s.store_name) {
      document.title = `${s.store_name} | متجر إلكتروني متكامل`;
    }
    setText('header-store-name', s.store_name);
    setText('footer-store-name', s.store_name);
    setText('footer-copy-name', s.store_name);
    setText('hero-tagline', s.store_tagline);
    setText('store-address', s.address);
    setText('store-phone', s.phone);
    setText('store-email', s.email);
    setText('store-hours-weekdays', s.hours_weekdays);
    setText('store-hours-weekend', s.hours_weekend);
    setText('top-free-shipping', Number(s.free_shipping_threshold || 1500).toLocaleString('en-US'));
    setText('cart-vat-rate', s.vat_rate || '15');
    setText('co-bank-name', s.bank_name);
    setText('co-bank-account', s.bank_account_name);
    setText('co-bank-iban', s.bank_iban);

    const waBtn = document.getElementById('whatsapp-direct-link');
    if (waBtn) {
      const cleanWa = String(s.whatsapp || '966501234567').replace(/[^0-9]/g, '');
      const text = encodeURIComponent(`مرحباً ${s.store_name}، لدي استفسار عن الأجهزة المتوفرة.`);
      waBtn.href = `https://wa.me/${cleanWa}?text=${text}`;
    }
  }

  async function loadProducts() {
    try {
      const { products } = await apiFetch('/api/products');
      state.products = products || [];
      syncCartWithLatestProducts();
      renderProducts();
      renderCart();
      updateBadges();
    } catch (err) {
      els.productsGrid.innerHTML = `<div class="empty-state"><h3>تعذر تحميل المنتجات</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function syncCartWithLatestProducts() {
    const byId = new Map(state.products.map((p) => [p.id, p]));
    state.cart = state.cart
      .map((item) => {
        const latest = byId.get(item.id);
        if (!latest || latest.stock <= 0) return null;
        return {
          id: latest.id,
          title: latest.title,
          price: latest.price,
          image: latest.image,
          stock: latest.stock,
          quantity: Math.min(item.quantity, latest.stock)
        };
      })
      .filter(Boolean);
    saveJson(CART_STORAGE_KEY, state.cart);
  }

  // ===========================
  // Filtering & Rendering Products
  // ===========================
  function getFilteredProducts() {
    const { brand, category, search, sort, inStockOnly, wishlistOnly } = state.filters;
    const term = search.trim().toLowerCase();

    let list = state.products.filter((p) => {
      if (brand !== 'all' && p.brand.toLowerCase() !== brand) return false;
      if (category !== 'all' && p.category.toLowerCase() !== category) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (wishlistOnly && !state.wishlist.includes(p.id)) return false;
      if (term) {
        const haystack = [
          p.title,
          p.brand,
          p.sku,
          p.description,
          ...Object.values(p.specs || {})
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    switch (sort) {
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.sort((a, b) => b.id - a.id);
        break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id);
    }

    return list;
  }

  function hasActiveFilters() {
    const f = state.filters;
    return f.brand !== 'all' || f.category !== 'all' || f.search.trim() !== '' || f.inStockOnly || f.wishlistOnly;
  }

  function renderProducts() {
    const list = getFilteredProducts();
    const filterActive = hasActiveFilters();

    els.resetFiltersBtn.classList.toggle('hidden', !filterActive);
    els.wishlistFilterBtn.classList.toggle('active', state.filters.wishlistOnly);

    const prefix = state.filters.wishlistOnly ? 'المفضلة • ' : '';
    els.resultsCount.textContent = `${prefix}عرض ${list.length} من أصل ${state.products.length} منتج`;

    // Sync brand cards & select
    els.brandSelect.value = state.filters.brand;
    document.querySelectorAll('.brand-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.brand === state.filters.brand);
    });
    document.querySelectorAll('.cat-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.category === state.filters.category);
    });

    if (list.length === 0) {
      els.productsGrid.innerHTML = `
        <div class="empty-state">
          <h3>لا توجد أجهزة مطابقة لخيارات البحث</h3>
          <p>جرّب تعديل كلمات البحث أو إعادة ضبط الفلاتر لعرض جميع الأجهزة المتوفرة.</p>
        </div>
      `;
      return;
    }

    els.productsGrid.innerHTML = list
      .map((p) => {
        const discountPct =
          p.old_price && p.old_price > p.price
            ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
            : 0;
        const isSaved = state.wishlist.includes(p.id);
        const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= 5 ? 'stock-low' : 'stock-in';
        const stockLabel =
          p.stock === 0 ? 'نفد من المخزون' : p.stock <= 5 ? `متبقي ${p.stock} فقط` : 'متوفر للشحن';
        const keySpecs = Object.values(p.specs || {}).slice(0, 3);

        return `
          <article class="product-card" data-product-id="${p.id}">
            <div class="product-media" data-action="details" data-id="${p.id}">
              <div class="product-badges">
                ${p.badge ? `<span class="pill-badge pill-primary">${escapeHtml(p.badge)}</span>` : ''}
                ${discountPct > 0 ? `<span class="pill-badge pill-discount">وفر ${discountPct}%</span>` : ''}
              </div>
              <button type="button" class="wishlist-btn ${isSaved ? 'saved' : ''}" data-action="wishlist" data-id="${p.id}" aria-label="إضافة للمفضلة">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy">
            </div>

            <div class="product-body">
              <div class="product-top-row">
                <span class="product-brand-tag">${escapeHtml(p.brand)}</span>
                <span class="product-rating">★ ${Number(p.rating).toFixed(1)}</span>
              </div>

              <h3 class="product-title" data-action="details" data-id="${p.id}">${escapeHtml(p.title)}</h3>
              <p class="product-desc">${escapeHtml(p.description)}</p>

              <div class="product-spec-chips">
                ${keySpecs.map((val) => `<span class="spec-chip">${escapeHtml(val)}</span>`).join('')}
              </div>

              <div class="product-bottom">
                <div class="price-stock-row">
                  <div class="price-group">
                    <span class="price-current">${formatMoney(p.price)}</span>
                    ${p.old_price && p.old_price > p.price ? `<span class="price-old">${formatMoney(p.old_price)}</span>` : ''}
                  </div>
                  <span class="stock-badge ${stockClass}">${stockLabel}</span>
                </div>

                <div class="product-actions">
                  <button type="button" class="btn btn-primary" data-action="add-cart" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
                    ${p.stock === 0 ? 'غير متوفر' : 'أضف للسلة'}
                  </button>
                  <button type="button" class="btn btn-secondary" data-action="details" data-id="${p.id}">
                    التفاصيل
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ===========================
  // Product Details Modal
  // ===========================
  function openProductModal(productId) {
    const p = state.products.find((item) => item.id === productId);
    if (!p) return;

    const specsRows = Object.entries(p.specs || {})
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join('');

    const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= 5 ? 'stock-low' : 'stock-in';
    const stockLabel =
      p.stock === 0 ? 'نفد من المخزون' : `متوفر في المخزون (${p.stock} قطعة)`;

    const cleanWa = String(state.settings.whatsapp || '966501234567').replace(/[^0-9]/g, '');
    const waText = encodeURIComponent(
      `مرحباً، أرغب في الاستفسار/الطلب للجهاز:\n${p.title}\nالرمز: ${p.sku}\nالسعر: ${formatMoney(p.price)}`
    );

    els.productModalBody.innerHTML = `
      <div class="modal-gallery">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">
        <span class="modal-sku">رمز المنتج (SKU): ${escapeHtml(p.sku)}</span>
      </div>
      <div class="modal-info">
        <div class="product-top-row">
          <span class="product-brand-tag">${escapeHtml(p.brand)}</span>
          <span class="stock-badge ${stockClass}">${stockLabel}</span>
        </div>
        <h2 id="modal-product-title" style="margin:0.35rem 0 0.5rem;">${escapeHtml(p.title)}</h2>
        <div class="price-group" style="margin-bottom:0.85rem;">
          <span class="price-current" style="font-size:1.55rem;">${formatMoney(p.price)}</span>
          ${p.old_price && p.old_price > p.price ? `<span class="price-old">${formatMoney(p.old_price)}</span>` : ''}
        </div>
        <p style="color:var(--ink-secondary);margin-bottom:1rem;">${escapeHtml(p.description)}</p>

        <h4 style="font-size:0.98rem;margin-bottom:0.35rem;">المواصفات الفنية</h4>
        <table class="modal-specs-table">
          <tbody>${specsRows || '<tr><td colspan="2">لا توجد مواصفات إضافية</td></tr>'}</tbody>
        </table>

        <div class="modal-purchase-bar">
          ${
            p.stock > 0
              ? `
            <div class="qty-stepper" id="modal-qty-stepper">
              <button type="button" data-qty-delta="-1" aria-label="إنقاص الكمية">−</button>
              <span id="modal-qty-val">1</span>
              <button type="button" data-qty-delta="1" aria-label="زيادة الكمية">+</button>
            </div>
            <button type="button" class="btn btn-primary" id="modal-add-cart-btn" data-id="${p.id}" style="flex:1;">
              أضف إلى السلة
            </button>
          `
              : `<button type="button" class="btn btn-primary" disabled style="flex:1;">نفد من المخزون حالياً</button>`
          }
          <a href="https://wa.me/${cleanWa}?text=${waText}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">
            اطلب عبر واتساب
          </a>
        </div>
      </div>
    `;

    let selectedQty = 1;
    const qtyValEl = document.getElementById('modal-qty-val');
    const stepper = document.getElementById('modal-qty-stepper');
    if (stepper && qtyValEl) {
      stepper.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-qty-delta]');
        if (!btn) return;
        const delta = parseInt(btn.dataset.qtyDelta, 10);
        selectedQty = Math.min(p.stock, Math.max(1, selectedQty + delta));
        qtyValEl.textContent = String(selectedQty);
      });
    }

    const modalAddBtn = document.getElementById('modal-add-cart-btn');
    if (modalAddBtn) {
      modalAddBtn.addEventListener('click', () => {
        addToCart(p.id, selectedQty);
        closeAllModals();
        openCart();
      });
    }

    els.productModal.classList.add('open');
    document.body.classList.add('scroll-locked');
  }

  // ===========================
  // Wishlist & Cart Operations
  // ===========================
  function toggleWishlist(productId) {
    const idx = state.wishlist.indexOf(productId);
    if (idx === -1) {
      state.wishlist.push(productId);
      showToast('تمت الإضافة إلى المفضلة', 'success');
    } else {
      state.wishlist.splice(idx, 1);
      showToast('تمت الإزالة من المفضلة');
    }
    saveJson(WISHLIST_STORAGE_KEY, state.wishlist);
    updateBadges();
    renderProducts();
  }

  function addToCart(productId, quantity = 1) {
    const p = state.products.find((item) => item.id === productId);
    if (!p || p.stock <= 0) {
      showToast('هذا المنتج غير متوفر حالياً.', 'error');
      return;
    }

    const existing = state.cart.find((item) => item.id === productId);
    if (existing) {
      const nextQty = existing.quantity + quantity;
      if (nextQty > p.stock) {
        existing.quantity = p.stock;
        showToast(`تم الوصول للحد الأقصى المتوفر في المخزون (${p.stock}).`, 'error');
      } else {
        existing.quantity = nextQty;
        showToast(`تم تحديث كمية "${p.title}" في السلة`, 'success');
      }
    } else {
      state.cart.push({
        id: p.id,
        title: p.title,
        price: p.price,
        image: p.image,
        stock: p.stock,
        quantity: Math.min(quantity, p.stock)
      });
      showToast(`تمت إضافة "${p.title}" إلى السلة`, 'success');
    }

    saveJson(CART_STORAGE_KEY, state.cart);
    revalidateCouponIfNeeded();
    updateBadges();
    renderCart();
  }

  function updateCartItemQty(productId, delta) {
    const item = state.cart.find((i) => i.id === productId);
    if (!item) return;
    const latest = state.products.find((p) => p.id === productId);
    const maxStock = latest ? latest.stock : item.stock;
    const nextQty = item.quantity + delta;

    if (nextQty <= 0) {
      state.cart = state.cart.filter((i) => i.id !== productId);
    } else if (nextQty > maxStock) {
      showToast(`الكمية القصوى المتوفرة هي ${maxStock} قطعة.`, 'error');
      return;
    } else {
      item.quantity = nextQty;
    }

    saveJson(CART_STORAGE_KEY, state.cart);
    revalidateCouponIfNeeded();
    updateBadges();
    renderCart();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter((i) => i.id !== productId);
    saveJson(CART_STORAGE_KEY, state.cart);
    revalidateCouponIfNeeded();
    updateBadges();
    renderCart();
  }

  function computeCartTotals() {
    const subtotal = roundMoney(state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0));
    let discount = 0;
    if (state.coupon && subtotal >= Number(state.coupon.min_order || 0)) {
      discount =
        state.coupon.discount_type === 'percent'
          ? roundMoney((subtotal * state.coupon.discount_value) / 100)
          : roundMoney(Math.min(subtotal, state.coupon.discount_value));
    }
    const afterDiscount = roundMoney(Math.max(0, subtotal - discount));
    const freeThreshold = Number(state.settings.free_shipping_threshold || 1500);
    const baseShipping = Number(state.settings.shipping_fee || 35);
    const shipping = subtotal === 0 ? 0 : afterDiscount >= freeThreshold ? 0 : baseShipping;
    const vatRate = Number(state.settings.vat_rate || 15) / 100;
    const vat = roundMoney(afterDiscount * vatRate);
    const total = roundMoney(afterDiscount + shipping + vat);

    return { subtotal, discount, afterDiscount, shipping, vat, total, freeThreshold };
  }

  function roundMoney(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  function revalidateCouponIfNeeded() {
    if (!state.coupon) return;
    const subtotal = state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (subtotal < Number(state.coupon.min_order || 0)) {
      state.coupon = null;
    }
  }

  function updateBadges() {
    const totalItems = state.cart.reduce((sum, i) => sum + i.quantity, 0);
    els.cartCount.textContent = String(totalItems);
    els.wishlistCount.textContent = String(state.wishlist.length);
  }

  function renderCart() {
    const totalQty = state.cart.reduce((sum, i) => sum + i.quantity, 0);
    els.cartItemsSubtitle.textContent = `${totalQty} ${totalQty === 1 ? 'منتج' : 'منتجات'}`;

    const totals = computeCartTotals();

    // Free shipping progress
    if (state.cart.length === 0) {
      els.freeShippingBar.classList.add('hidden');
      els.cartFooter.classList.add('hidden');
      els.cartItemsList.innerHTML = `
        <div class="cart-empty">
          <p style="font-size:1.05rem;font-weight:700;color:var(--ink);margin-bottom:0.35rem;">سلة المشتريات فارغة</p>
          <p>أضف الأجهزة التي تناسبك من المتجر لتبدأ الطلب.</p>
        </div>
      `;
      return;
    }

    els.freeShippingBar.classList.remove('hidden');
    els.cartFooter.classList.remove('hidden');

    if (totals.shipping === 0) {
      els.freeShippingText.textContent = 'مبروك! طلبك مؤهل للشحن المجاني السريع.';
      els.freeShippingProgress.style.width = '100%';
    } else {
      const remaining = Math.max(0, totals.freeThreshold - totals.afterDiscount);
      const pct = Math.min(100, Math.round((totals.afterDiscount / totals.freeThreshold) * 100));
      els.freeShippingText.textContent = `أضف منتجات بقيمة ${formatMoney(remaining)} للحصول على شحن مجاني!`;
      els.freeShippingProgress.style.width = `${pct}%`;
    }

    els.cartItemsList.innerHTML = state.cart
      .map(
        (item) => `
        <div class="cart-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">
          <div class="cart-item-info">
            <h4>${escapeHtml(item.title)}</h4>
            <div class="cart-item-price">${formatMoney(item.price)}</div>
            <div class="cart-item-controls">
              <div class="qty-stepper">
                <button type="button" data-cart-dec="${item.id}" aria-label="إنقاص">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-cart-inc="${item.id}" aria-label="زيادة">+</button>
              </div>
              <button type="button" class="link-btn danger" data-cart-remove="${item.id}">حذف</button>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    // Coupon banner
    if (state.coupon) {
      els.appliedCouponBanner.classList.remove('hidden');
      els.appliedCouponText.textContent = `كود الخصم: ${state.coupon.code} (-${formatMoney(totals.discount)})`;
      els.cartDiscountRow.classList.remove('hidden');
      els.cartDiscount.textContent = `-${formatMoney(totals.discount)}`;
    } else {
      els.appliedCouponBanner.classList.add('hidden');
      els.cartDiscountRow.classList.add('hidden');
    }

    els.cartSubtotal.textContent = formatMoney(totals.subtotal);
    els.cartShipping.textContent = totals.shipping === 0 ? 'مجاني' : formatMoney(totals.shipping);
    els.cartVat.textContent = formatMoney(totals.vat);
    els.cartTotal.textContent = formatMoney(totals.total);
  }

  function openCart() {
    renderCart();
    els.cartDrawer.classList.add('open');
    els.cartBackdrop.classList.add('open');
    document.body.classList.add('scroll-locked');
  }

  function closeCart() {
    els.cartDrawer.classList.remove('open');
    els.cartBackdrop.classList.remove('open');
    document.body.classList.remove('scroll-locked');
  }

  async function applyCoupon() {
    const code = els.couponInput.value.trim().toUpperCase();
    if (!code) {
      showToast('يرجى إدخال كود الخصم أولاً.', 'error');
      return;
    }
    const subtotal = state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    try {
      const res = await apiFetch('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal })
      });
      state.coupon = res.coupon;
      els.couponInput.value = '';
      renderCart();
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function sendCartViaWhatsApp() {
    if (state.cart.length === 0) return;
    const totals = computeCartTotals();
    const lines = state.cart.map(
      (i, idx) => `${idx + 1}. ${i.title} × ${i.quantity} = ${formatMoney(i.price * i.quantity)}`
    );
    const msg = [
      `مرحباً ${state.settings.store_name}، أرغب بإتمام الطلب التالي:`,
      ...lines,
      state.coupon ? `كود الخصم: ${state.coupon.code} (-${formatMoney(totals.discount)})` : '',
      `الإجمالي شامل الضريبة والشحن: ${formatMoney(totals.total)}`
    ]
      .filter(Boolean)
      .join('\n');

    const cleanWa = String(state.settings.whatsapp || '966501234567').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  // ===========================
  // Checkout Modal & Submission
  // ===========================
  function openCheckoutModal() {
    if (state.cart.length === 0) {
      showToast('السلة فارغة.', 'error');
      return;
    }
    closeCart();

    const totals = computeCartTotals();
    els.checkoutFormView.classList.remove('hidden');
    els.checkoutSuccessView.classList.add('hidden');

    els.checkoutItems.innerHTML = state.cart
      .map(
        (i) => `
        <div class="checkout-mini-item">
          <span>${escapeHtml(i.title)} <strong>× ${i.quantity}</strong></span>
          <strong>${formatMoney(i.price * i.quantity)}</strong>
        </div>
      `
      )
      .join('');

    els.checkoutTotals.innerHTML = `
      <div class="summary-row"><span>المجموع الفرعي</span><strong>${formatMoney(totals.subtotal)}</strong></div>
      ${totals.discount > 0 ? `<div class="summary-row discount-row"><span>الخصم (${escapeHtml(state.coupon.code)})</span><strong>-${formatMoney(totals.discount)}</strong></div>` : ''}
      <div class="summary-row"><span>الشحن</span><strong>${totals.shipping === 0 ? 'مجاني' : formatMoney(totals.shipping)}</strong></div>
      <div class="summary-row"><span>ضريبة القيمة المضافة (${escapeHtml(state.settings.vat_rate)}%)</span><strong>${formatMoney(totals.vat)}</strong></div>
      <div class="summary-row total-row"><span>الإجمالي النهائي</span><strong>${formatMoney(totals.total)}</strong></div>
    `;

    els.checkoutModal.classList.add('open');
    document.body.classList.add('scroll-locked');
  }

  async function submitCheckout(e) {
    e.preventDefault();
    const paymentMethod = els.checkoutForm.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

    if (paymentMethod === 'card') {
      const cardNum = document.getElementById('co-card-number').value.replace(/\s+/g, '');
      if (cardNum.length < 12) {
        showToast('يرجى إدخال رقم بطاقة تجريبي مكوّن من 12 رقماً على الأقل.', 'error');
        return;
      }
    }

    const payload = {
      customer_name: document.getElementById('co-name').value.trim(),
      customer_phone: document.getElementById('co-phone').value.trim(),
      customer_email: document.getElementById('co-email').value.trim(),
      city: document.getElementById('co-city').value,
      address: document.getElementById('co-address').value.trim(),
      notes: document.getElementById('co-notes').value.trim(),
      payment_method: paymentMethod,
      coupon_code: state.coupon ? state.coupon.code : '',
      items: state.cart.map((i) => ({ product_id: i.id, quantity: i.quantity }))
    };

    els.confirmOrderBtn.disabled = true;
    els.confirmOrderBtn.textContent = 'جاري تأكيد الطلب...';

    try {
      const { order } = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      state.lastOrder = order;
      state.cart = [];
      state.coupon = null;
      saveJson(CART_STORAGE_KEY, []);
      els.checkoutForm.reset();
      updateBadges();
      renderCart();
      loadProducts(); // refresh live stock

      renderOrderSuccess(order);
      showToast(`تم تسجيل طلبك بنجاح برقم ${order.order_number}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      els.confirmOrderBtn.disabled = false;
      els.confirmOrderBtn.textContent = 'تأكيد وإرسال الطلب';
    }
  }

  function renderOrderSuccess(order) {
    const payLabels = { cod: 'الدفع عند الاستلام', card: 'بطاقة إلكترونية', bank: 'تحويل بنكي' };
    const cleanWa = String(state.settings.whatsapp || '966501234567').replace(/[^0-9]/g, '');
    const waText = encodeURIComponent(
      `مرحباً ${state.settings.store_name}، قمت بإنشاء الطلب رقم ${order.order_number} بإجمالي ${formatMoney(order.total)}.`
    );

    els.checkoutFormView.classList.add('hidden');
    els.checkoutSuccessView.classList.remove('hidden');
    els.checkoutSuccessView.innerHTML = `
      <div class="success-icon-circle">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2>شكراً لك! تم استلام طلبك بنجاح</h2>
      <p style="color:var(--ink-muted);">احتفظ برقم الطلب لمتابعة حالة الشحن والتوصيل في أي وقت</p>
      <div class="order-number-badge">${escapeHtml(order.order_number)}</div>

      <div class="invoice-box">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.85rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
          <div><strong>العميل:</strong> ${escapeHtml(order.customer_name)}</div>
          <div><strong>المدينة:</strong> ${escapeHtml(order.city)}</div>
          <div><strong>الدفع:</strong> ${payLabels[order.payment_method] || order.payment_method}</div>
        </div>
        ${order.items
          .map(
            (i) => `
            <div class="checkout-mini-item">
              <span>${escapeHtml(i.product_title)} × ${i.quantity}</span>
              <strong>${formatMoney(i.line_total)}</strong>
            </div>
          `
          )
          .join('')}
        <div class="cart-summary-rows" style="margin-top:0.85rem;margin-bottom:0;">
          <div class="summary-row"><span>المجموع الفرعي</span><strong>${formatMoney(order.subtotal)}</strong></div>
          ${order.discount > 0 ? `<div class="summary-row discount-row"><span>الخصم</span><strong>-${formatMoney(order.discount)}</strong></div>` : ''}
          <div class="summary-row"><span>الشحن</span><strong>${order.shipping_fee === 0 ? 'مجاني' : formatMoney(order.shipping_fee)}</strong></div>
          <div class="summary-row"><span>ضريبة القيمة المضافة</span><strong>${formatMoney(order.vat_amount)}</strong></div>
          <div class="summary-row total-row"><span>الإجمالي المدفوع / المستحق</span><strong>${formatMoney(order.total)}</strong></div>
        </div>
      </div>

      <div class="success-actions">
        <button type="button" class="btn btn-primary" id="print-invoice-btn">طباعة الفاتورة</button>
        <button type="button" class="btn btn-secondary" id="track-created-order-btn">تتبع هذا الطلب</button>
        <a href="https://wa.me/${cleanWa}?text=${waText}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">تأكيد عبر واتساب</a>
      </div>
    `;

    document.getElementById('print-invoice-btn')?.addEventListener('click', () => window.print());
    document.getElementById('track-created-order-btn')?.addEventListener('click', () => {
      closeAllModals();
      els.trackOrderNumber.value = order.order_number;
      els.trackOrderPhone.value = '';
      document.getElementById('track-order').scrollIntoView({ behavior: 'smooth' });
      trackOrder(order.order_number, '');
    });
  }

  // ===========================
  // Order Tracking
  // ===========================
  async function trackOrder(orderNumber, phone = '') {
    const q = new URLSearchParams({ order_number: orderNumber.trim() });
    if (phone.trim()) q.set('phone', phone.trim());

    try {
      const { order } = await apiFetch(`/api/orders/track?${q.toString()}`);
      renderTrackResult(order);
    } catch (err) {
      els.trackResult.classList.remove('hidden');
      els.trackResult.innerHTML = `<p style="color:var(--danger);text-align:center;font-weight:700;">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderTrackResult(order) {
    const steps = [
      { key: 'pending', label: 'تم استلام الطلب' },
      { key: 'processing', label: 'جاري التجهيز' },
      { key: 'shipped', label: 'تم الشحن' },
      { key: 'delivered', label: 'تم التوصيل' }
    ];
    const currentIdx = steps.findIndex((s) => s.key === order.status);
    const isCancelled = order.status === 'cancelled';

    els.trackResult.classList.remove('hidden');
    els.trackResult.innerHTML = `
      <div class="track-result-header">
        <div>
          <strong style="font-size:1.1rem;">طلب رقم <span dir="ltr">${escapeHtml(order.order_number)}</span></strong>
          <div style="font-size:0.86rem;color:var(--ink-muted);">العميل: ${escapeHtml(order.customer_name)} • ${escapeHtml(order.city)}</div>
        </div>
        <div>
          <span class="stock-badge ${isCancelled ? 'stock-out' : 'stock-in'}">
            ${isCancelled ? 'طلب ملغي' : steps[Math.max(0, currentIdx)].label}
          </span>
        </div>
      </div>

      ${
        isCancelled
          ? `<p style="color:var(--danger);font-weight:700;margin-bottom:1rem;">تم إلغاء هذا الطلب. للاستفسار يرجى التواصل مع خدمة العملاء.</p>`
          : `
        <div class="track-stepper">
          ${steps
            .map((step, idx) => {
              const cls = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : '';
              return `
                <div class="step-item ${cls}">
                  <div class="step-num">${idx < currentIdx ? '✓' : idx + 1}</div>
                  <div>${step.label}</div>
                </div>
              `;
            })
            .join('')}
        </div>
      `
      }

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:1rem;">
        ${order.items
          .map(
            (i) => `
          <div class="checkout-mini-item">
            <span>${escapeHtml(i.product_title)} × ${i.quantity}</span>
            <strong>${formatMoney(i.line_total)}</strong>
          </div>
        `
          )
          .join('')}
        <div class="summary-row total-row" style="border-top:none;margin-top:0.25rem;">
          <span>الإجمالي النهائي</span>
          <strong>${formatMoney(order.total)}</strong>
        </div>
      </div>
    `;
  }

  // ===========================
  // Contact Form
  // ===========================
  async function submitContactForm(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('contact-name').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      phone: document.getElementById('contact-phone').value.trim(),
      subject: document.getElementById('contact-subject').value.trim(),
      body: document.getElementById('contact-body').value.trim()
    };

    els.contactSubmitBtn.disabled = true;
    els.contactSubmitBtn.textContent = 'جاري الإرسال...';

    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      els.contactForm.reset();
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      els.contactSubmitBtn.disabled = false;
      els.contactSubmitBtn.textContent = 'إرسال الرسالة';
    }
  }

  // ===========================
  // Helpers & Event Binding
  // ===========================
  function closeAllModals() {
    els.productModal.classList.remove('open');
    els.checkoutModal.classList.remove('open');
    document.body.classList.remove('scroll-locked');
  }

  function toggleMobileMenu(open) {
    els.mobileDrawer.classList.toggle('open', open);
    els.mobileDrawerBackdrop.classList.toggle('open', open);
    document.body.classList.toggle('scroll-locked', open);
  }

  function bindEvents() {
    // Copy promo code
    document.getElementById('copy-promo-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('SAVE10');
        showToast('تم نسخ كود الخصم SAVE10 بنجاح!', 'success');
      } catch {
        showToast('كود الخصم: SAVE10 (خصم 10% للطلبات فوق 2,000 ر.س)');
      }
    });

    // Brand cards click -> filter & scroll smoothly to products
    document.getElementById('brands-grid')?.addEventListener('click', (e) => {
      const card = e.target.closest('.brand-card[data-brand]');
      if (!card) return;
      const clickedBrand = card.dataset.brand;
      state.filters.brand = state.filters.brand === clickedBrand ? 'all' : clickedBrand;
      state.filters.wishlistOnly = false;
      renderProducts();
      document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    });

    // Category tabs
    document.getElementById('category-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab[data-category]');
      if (!tab) return;
      state.filters.category = tab.dataset.category;
      renderProducts();
    });

    // Search / Brand select / Sort / In stock
    els.searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      renderProducts();
    });
    els.brandSelect.addEventListener('change', (e) => {
      state.filters.brand = e.target.value;
      renderProducts();
    });
    els.sortSelect.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      renderProducts();
    });
    els.inStockOnly.addEventListener('change', (e) => {
      state.filters.inStockOnly = e.target.checked;
      renderProducts();
    });

    // Wishlist toggle filter
    els.wishlistFilterBtn.addEventListener('click', () => {
      state.filters.wishlistOnly = !state.filters.wishlistOnly;
      renderProducts();
      document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    });

    // Reset filters
    els.resetFiltersBtn.addEventListener('click', () => {
      state.filters = {
        brand: 'all',
        category: 'all',
        search: '',
        sort: 'featured',
        inStockOnly: false,
        wishlistOnly: false
      };
      els.searchInput.value = '';
      els.sortSelect.value = 'featured';
      els.inStockOnly.checked = false;
      renderProducts();
    });

    // Product grid delegated clicks
    els.productsGrid.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const id = parseInt(actionEl.dataset.id, 10);
      if (action === 'wishlist') {
        e.stopPropagation();
        toggleWishlist(id);
      } else if (action === 'add-cart') {
        e.stopPropagation();
        addToCart(id, 1);
      } else if (action === 'details') {
        openProductModal(id);
      }
    });

    // Cart Drawer controls
    els.openCartBtn.addEventListener('click', openCart);
    els.closeCartBtn.addEventListener('click', closeCart);
    els.cartBackdrop.addEventListener('click', closeCart);
    els.applyCouponBtn.addEventListener('click', applyCoupon);
    els.couponInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCoupon();
      }
    });
    els.removeCouponBtn.addEventListener('click', () => {
      state.coupon = null;
      renderCart();
      showToast('تمت إزالة كود الخصم.');
    });
    els.cartItemsList.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-cart-inc]');
      const dec = e.target.closest('[data-cart-dec]');
      const rem = e.target.closest('[data-cart-remove]');
      if (inc) updateCartItemQty(parseInt(inc.dataset.cartInc, 10), 1);
      if (dec) updateCartItemQty(parseInt(dec.dataset.cartDec, 10), -1);
      if (rem) removeFromCart(parseInt(rem.dataset.cartRemove, 10));
    });
    els.proceedCheckoutBtn.addEventListener('click', openCheckoutModal);
    els.whatsappCartBtn.addEventListener('click', sendCartViaWhatsApp);

    // Modals close
    els.closeProductModal.addEventListener('click', closeAllModals);
    els.closeCheckoutModal.addEventListener('click', closeAllModals);
    els.productModal.addEventListener('click', (e) => {
      if (e.target === els.productModal) closeAllModals();
    });
    els.checkoutModal.addEventListener('click', (e) => {
      if (e.target === els.checkoutModal) closeAllModals();
    });

    // Payment method extra panels
    els.checkoutForm.addEventListener('change', (e) => {
      if (e.target.name !== 'payment_method') return;
      els.cardPaymentBox.classList.toggle('hidden', e.target.value !== 'card');
      els.bankPaymentBox.classList.toggle('hidden', e.target.value !== 'bank');
    });
    els.checkoutForm.addEventListener('submit', submitCheckout);

    // Track order
    els.trackOrderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      trackOrder(els.trackOrderNumber.value, els.trackOrderPhone.value);
    });
    document.querySelectorAll('[data-track-demo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        els.trackOrderNumber.value = btn.dataset.trackDemo;
        els.trackOrderPhone.value = '';
        trackOrder(btn.dataset.trackDemo, '');
      });
    });

    // Contact form
    els.contactForm.addEventListener('submit', submitContactForm);

    // Mobile drawer
    els.mobileMenuBtn.addEventListener('click', () => toggleMobileMenu(true));
    els.closeMobileMenu.addEventListener('click', () => toggleMobileMenu(false));
    els.mobileDrawerBackdrop.addEventListener('click', () => toggleMobileMenu(false));
    els.mobileDrawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => toggleMobileMenu(false));
    });

    // Global Escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
        closeCart();
        toggleMobileMenu(false);
      }
    });
  }

  // Boot
  bindEvents();
  loadSettings();
  loadProducts();
})();
