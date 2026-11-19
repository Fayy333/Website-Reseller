// Application Logic for KulinerHub Reseller Multi-Seller Platform
(function () {
    'use strict';

    // ================= STATE MANAGEMENT =================
    const OWNER_WHATSAPP = '6285741832972'; // Nomor WhatsApp Utama Pemilik Toko
    const STORAGE_KEY_PRODUCTS = 'kulinerhub_products_v2';
    const STORAGE_KEY_SELLERS = 'kulinerhub_sellers_v2';
    const STORAGE_KEY_SETTINGS = 'kulinerhub_settings_v2';
    const STORAGE_KEY_ORDERS = 'kulinerhub_orders_v2';
    const STORAGE_KEY_CART = 'kulinerhub_cart_v2';
    const STORAGE_KEY_STOCK_HISTORY = 'holystore_stock_history_v1';
    const STORAGE_KEY_ADMIN_NAME = 'holystore_admin_name_v1';

    // Migrate or initialize
    let products = JSON.parse(localStorage.getItem(STORAGE_KEY_PRODUCTS));
    if (!products || !Array.isArray(products) || products.length === 0) {
        products = DEFAULT_DATA.products;
    }
    // Ensure all products have stock and isAvailable
    products = products.map(p => ({
        ...p,
        stock: p.stock !== undefined ? p.stock : 20,
        isAvailable: p.isAvailable !== undefined ? p.isAvailable : true
    }));

    let sellers = JSON.parse(localStorage.getItem(STORAGE_KEY_SELLERS)) || DEFAULT_DATA.sellers;
    let settings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS)) || DEFAULT_DATA.settings;
    settings.whatsapp = OWNER_WHATSAPP; // Wajib set ke nomor owner
    if (settings.storeName === "KulinerHub Reseller" || !settings.logo) {
        settings.storeName = "Holy Store";
        settings.logo = "assets/logo.jpg";
        settings.tagline = "Pusat Aneka Makanan & Minuman Mitra Pilihan";
    }
    saveSettings();
    let orders = JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS)) || DEFAULT_DATA.orders;
    let stockHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_STOCK_HISTORY)) || [];
    if (!Array.isArray(stockHistory)) stockHistory = [];
    let cart = JSON.parse(localStorage.getItem(STORAGE_KEY_CART)) || [];
    const STORAGE_KEY_RESELLERS = 'holystore_resellers_v1';
    let resellerApps = JSON.parse(localStorage.getItem(STORAGE_KEY_RESELLERS)) || [];

    // Filter states
    let activeCategory = 'all'; // 'all', 'makanan', 'minuman'
    let searchQuery = '';
    let sortBy = 'popular';
    let currentUploadedProof = null; // Base64 screenshot proof
    let currentProofFileName = '';
    let pendingProofDownload = null;
    let adminOrderSearch = '';
    let adminOrderStatusFilter = 'all';
    let adminOrderDateFilter = 'all';

    // Secret trigger counter for hidden admin
    let logoClickCount = 0;
    let logoClickTimer = null;

    // Save helper functions
    function saveProducts() { localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products)); }
    function saveSellers() { localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(sellers)); }
    function saveSettings() { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings)); }
    function saveOrders() { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders)); }
    function saveStockHistory() { localStorage.setItem(STORAGE_KEY_STOCK_HISTORY, JSON.stringify(stockHistory)); }
    function saveCart() { localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(cart)); }
    function saveResellerApps() { localStorage.setItem(STORAGE_KEY_RESELLERS, JSON.stringify(resellerApps)); }

    // Helpers
    function formatRupiah(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(number);
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function getSellerById(id) {
        return sellers.find(s => s.id === id) || { name: 'Mitra Terpercaya', badge: 'Mitra', location: 'Pusat' };
    }

    function getOrderDate(order) {
        const date = Number.isFinite(order.timestamp) ? new Date(order.timestamp) : new Date(order.createdAt);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function isSameLocalDay(first, second) {
        return first && second &&
            first.getFullYear() === second.getFullYear() &&
            first.getMonth() === second.getMonth() &&
            first.getDate() === second.getDate();
    }

    function isInCurrentWeek(date, now = new Date()) {
        if (!date) return false;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysSinceMonday = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
        return date >= startOfWeek && date <= now;
    }

    function getAdminName() {
        const nameInput = document.getElementById('adminVerifierName');
        const name = nameInput ? nameInput.value.trim() : localStorage.getItem(STORAGE_KEY_ADMIN_NAME);
        return name || 'Admin';
    }

    function recordStockChange(product, previousStock, nextStock, reason, reference = '') {
        if (previousStock === nextStock) return;
        stockHistory.unshift({
            id: `STK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId: product.id,
            productName: product.name,
            previousStock,
            newStock: nextStock,
            quantity: Math.abs(nextStock - previousStock),
            movement: nextStock > previousStock ? 'Masuk' : 'Keluar',
            reason,
            reference,
            actor: reason === 'Pesanan pelanggan' ? 'Sistem Pesanan' : getAdminName(),
            timestamp: Date.now()
        });
        stockHistory = stockHistory.slice(0, 500);
        saveStockHistory();
    }

    function notifyNewOrder(order) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Pesanan baru - Holy Store', {
                body: `${order.id} • ${order.customerName} • ${formatRupiah(order.grandTotal)}`
            });
        }
        if (adminModal && !adminModal.classList.contains('hidden')) {
            showToast(`Pesanan baru ${order.id} masuk dan menunggu ditangani!`);
        }
    }

    // ================= DOM ELEMENTS =================
    const productGrid = document.getElementById('productGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const storeTitleEl = document.getElementById('storeTitle');
    const storeTaglineEl = document.getElementById('storeTagline');
    const countMakananEl = document.getElementById('countMakanan');
    const countMinumanEl = document.getElementById('countMinuman');
    const countSemuaEl = document.getElementById('countSemua');

    // Cart Elements
    const cartCountBadges = document.querySelectorAll('.cart-count-badge');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartEmptyNotice = document.getElementById('cartEmptyNotice');
    const cartSubtotalEl = document.getElementById('cartSubtotal');
    const cartShippingEl = document.getElementById('cartShipping');
    const cartTotalEl = document.getElementById('cartTotal');
    const btnCheckout = document.getElementById('btnCheckout');
    const deliveryMethodSelect = document.getElementById('deliveryMethodSelect');

    // Checkout Modal Elements
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutTotalEl = document.getElementById('checkoutTotal');
    const checkoutInvoiceEl = document.getElementById('checkoutInvoice');
    const checkoutItemsSummaryEl = document.getElementById('checkoutItemsSummary');
    const qrisStoreNameEl = document.getElementById('qrisStoreName');
    const qrisImageEl = document.getElementById('qrisImage');
    const proofFileInput = document.getElementById('proofFileInput');
    const uploadDropzone = document.getElementById('uploadDropzone');
    const proofPreviewContainer = document.getElementById('proofPreviewContainer');
    const proofPreviewImg = document.getElementById('proofPreviewImg');
    const proofFileNameEl = document.getElementById('proofFileName');
    const btnRemoveProof = document.getElementById('btnRemoveProof');
    const formCheckout = document.getElementById('formCheckout');

    // Order Success Modal Elements
    const successModal = document.getElementById('successModal');
    const successInvoiceId = document.getElementById('successInvoiceId');
    const successTotalAmount = document.getElementById('successTotalAmount');
    const successWaLink = document.getElementById('successWaLink');

    // Hidden Admin Modal Elements
    const adminModal = document.getElementById('adminModal');
    const adminPinModal = document.getElementById('adminPinModal');
    const adminPinInput = document.getElementById('adminPinInput');
    const adminStockList = document.getElementById('adminStockList');
    const adminOrdersList = document.getElementById('adminOrdersList');
    const adminProductsList = document.getElementById('adminProductsList');
    const adminProductSellerSelect = document.getElementById('adminProductSeller');
    const proofViewerModal = document.getElementById('proofViewerModal');
    const proofViewerImage = document.getElementById('proofViewerImage');

    // Toast
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
        toast.className = `fixed bottom-6 right-6 ${bgColor} text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 transform transition-all duration-300 translate-y-10 opacity-0`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} text-lg"></i>
            <span class="text-sm font-medium">${message}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        }, 50);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ================= INITIALIZE APP =================
    function init() {
        renderHeaderInfo();
        updateCategoryCounters();
        populateSellerDropdowns();
        renderProducts();
        updateCartUI();
        setupEventListeners();
        checkUrlForAdmin();
    }

    function renderHeaderInfo() {
        if (storeTitleEl) storeTitleEl.textContent = settings.storeName;
        if (storeTaglineEl) storeTaglineEl.textContent = settings.tagline;
        if (qrisStoreNameEl) qrisStoreNameEl.textContent = settings.storeName;
        if (qrisImageEl && settings.qrisImage) {
            qrisImageEl.src = settings.qrisImage;
        }
        const brandLogoImg = document.getElementById('brandLogoImg');
        if (brandLogoImg && settings.logo) {
            brandLogoImg.src = settings.logo;
        }
    }

    function updateCategoryCounters() {
        const totalSemua = products.length;
        const totalMakanan = products.filter(p => p.category === 'makanan').length;
        const totalMinuman = products.filter(p => p.category === 'minuman').length;

        if (countSemuaEl) countSemuaEl.textContent = totalSemua;
        if (countMakananEl) countMakananEl.textContent = totalMakanan;
        if (countMinumanEl) countMinumanEl.textContent = totalMinuman;
    }

    function populateSellerDropdowns() {
        // Add Product form seller dropdown in Admin
        if (adminProductSellerSelect) {
            adminProductSellerSelect.innerHTML = '';
            sellers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `${s.name} (${s.location})`;
                adminProductSellerSelect.appendChild(opt);
            });
        }
    }

    // ================= RENDER PRODUCTS =================
    function renderProducts() {
        if (!productGrid) return;

        let filtered = products.filter(item => {
            // Category filter
            if (activeCategory !== 'all' && item.category !== activeCategory) {
                return false;
            }
            // Search query
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                const seller = getSellerById(item.sellerId);
                const matchName = item.name.toLowerCase().includes(q);
                const matchDesc = item.description.toLowerCase().includes(q);
                const matchSeller = seller.name.toLowerCase().includes(q);
                const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
                if (!matchName && !matchDesc && !matchSeller && !matchTags) {
                    return false;
                }
            }
            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (sortBy === 'price-asc') return a.price - b.price;
            if (sortBy === 'price-desc') return b.price - a.price;
            if (sortBy === 'rating') return b.rating - a.rating;
            // default popular
            return (b.soldCount || 0) - (a.soldCount || 0);
        });

        if (filtered.length === 0) {
            productGrid.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        productGrid.innerHTML = filtered.map(item => {
            const seller = getSellerById(item.sellerId);
            const isDrink = item.category === 'minuman';
            const categoryBadge = isDrink 
                ? '<span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full"><i class="fa-solid fa-mug-hot text-xs"></i> Minuman</span>'
                : '<span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"><i class="fa-solid fa-utensils text-xs"></i> Makanan</span>';

            const discountPercentage = item.originalPrice && item.originalPrice > item.price
                ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                : 0;

            const isAvailable = item.isAvailable !== false && (item.stock === undefined || item.stock > 0);
            const existingCartItem = cart.find(c => c.productId === item.id);
            const cartQty = existingCartItem ? existingCartItem.quantity : 0;

            return `
            <div class="product-card group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between ${!isAvailable ? 'opacity-85' : ''}" data-id="${item.id}">
                <!-- Image Container -->
                <div class="relative w-full h-48 sm:h-52 overflow-hidden bg-slate-100">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" class="product-image w-full h-full object-cover ${!isAvailable ? 'grayscale contrast-75' : ''}">
                    
                    <!-- Floating Badges Top -->
                    <div class="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center">
                        ${categoryBadge}
                        ${discountPercentage > 0 && isAvailable ? `<span class="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">-${discountPercentage}%</span>` : ''}
                    </div>

                    <!-- Stock Status Badge (If Low Stock or Out of Stock) -->
                    ${!isAvailable ? `
                        <div class="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px] flex items-center justify-center p-3">
                            <span class="bg-red-600 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-xl flex items-center gap-1.5 animate-pulse">
                                <i class="fa-solid fa-ban"></i> STOK HABIS
                            </span>
                        </div>
                    ` : (item.stock !== undefined && item.stock <= 5 ? `
                        <div class="absolute top-3 right-3">
                            <span class="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                Sisa ${item.stock} porsi
                            </span>
                        </div>
                    ` : '')}

                    <!-- Reseller Partner Tag -->
                    <div class="absolute bottom-2 left-2 right-2">
                        <div class="badge-seller px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between backdrop-blur-md bg-white/90 shadow-sm">
                            <span class="flex items-center gap-1.5 truncate">
                                <i class="fa-solid fa-store text-amber-600 text-xs"></i>
                                <span class="truncate font-bold text-slate-800">${seller.name}</span>
                            </span>
                            <span class="text-[10px] text-amber-800 font-medium shrink-0 bg-amber-100/80 px-1.5 py-0.5 rounded-md">Mitra</span>
                        </div>
                    </div>
                </div>

                <!-- Content -->
                <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <!-- Rating & Sold Count & Stock -->
                        <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                            <span class="flex items-center gap-1 font-semibold text-slate-700">
                                <i class="fa-solid fa-star text-amber-400"></i> ${item.rating.toFixed(1)}
                            </span>
                            <span class="text-[11px] ${isAvailable ? 'text-emerald-700 font-semibold' : 'text-red-600 font-bold'}">
                                ${isAvailable ? (item.stock ? `Stok: ${item.stock}` : 'Tersedia') : 'Habis'}
                            </span>
                        </div>

                        <!-- Title -->
                        <h3 class="font-bold text-slate-800 text-base line-clamp-1 group-hover:text-orange-600 transition-colors">
                            ${item.name}
                        </h3>

                        <!-- Description -->
                        <p class="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            ${item.description}
                        </p>

                        <!-- Tags -->
                        <div class="flex flex-wrap gap-1 mt-2.5">
                            ${(item.tags || []).map(t => `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">#${t}</span>`).join('')}
                        </div>
                    </div>

                    <!-- Price & Add Action -->
                    <div class="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                            <span class="text-[11px] text-slate-400 block -mb-0.5">Harga</span>
                            <div class="flex items-baseline gap-1.5">
                                <span class="font-extrabold text-orange-600 text-lg">${formatRupiah(item.price)}</span>
                                ${item.originalPrice ? `<span class="text-xs text-slate-400 line-through">${formatRupiah(item.originalPrice)}</span>` : ''}
                            </div>
                        </div>

                        <!-- Cart Button or Stepper -->
                        <div>
                            ${!isAvailable ? `
                                <button disabled class="h-10 px-3.5 rounded-xl bg-stone-200 text-stone-400 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed">
                                    <i class="fa-solid fa-circle-xmark text-xs"></i> Habis
                                </button>
                            ` : cartQty === 0 ? `
                                <button type="button" onclick="window.KulinerHub.addToCart('${item.id}')" class="h-10 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer">
                                    <i class="fa-solid fa-plus text-xs"></i> Pesan
                                </button>
                            ` : `
                                <div class="flex items-center bg-orange-50 border border-orange-200 rounded-xl overflow-hidden p-1">
                                    <button onclick="window.KulinerHub.changeCartQty('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-white text-orange-600 hover:bg-orange-600 hover:text-white flex items-center justify-center text-xs font-bold transition shadow-xs">
                                        <i class="fa-solid fa-minus text-[10px]"></i>
                                    </button>
                                    <span class="w-7 text-center font-bold text-xs text-orange-700">${cartQty}</span>
                                    <button onclick="window.KulinerHub.changeCartQty('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center text-xs font-bold transition shadow-xs">
                                        <i class="fa-solid fa-plus text-[10px]"></i>
                                    </button>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // ================= CART SYSTEM =================
    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        if (product.isAvailable === false || (product.stock !== undefined && product.stock <= 0)) {
            showToast('Maaf, stok menu ini sedang habis!', 'error');
            return;
        }

        const existing = cart.find(c => c.productId === productId);
        if (existing) {
            if (product.stock !== undefined && existing.quantity >= product.stock) {
                showToast(`Stok maksimal hanya ${product.stock} porsi!`, 'error');
                return;
            }
            existing.quantity += 1;
        } else {
            cart.push({
                productId: productId,
                quantity: 1,
                notes: ''
            });
        }
        saveCart();
        updateCartUI();
        renderProducts();
        showToast(`"${product.name}" ditambahkan ke keranjang!`);
    }

    function changeCartQty(productId, delta) {
        const index = cart.findIndex(c => c.productId === productId);
        if (index === -1) return;

        const product = products.find(p => p.id === productId);
        if (delta > 0 && product && product.stock !== undefined && cart[index].quantity >= product.stock) {
            showToast(`Stok maksimal hanya ${product.stock} porsi!`, 'error');
            return;
        }

        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        saveCart();
        updateCartUI();
        renderProducts();
    }

    function updateCartNotes(productId, notes) {
        const item = cart.find(c => c.productId === productId);
        if (item) {
            item.notes = notes;
            saveCart();
        }
    }

    function updateCartUI() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountBadges.forEach(badge => {
            badge.textContent = totalItems;
            if (totalItems > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });

        // Calculate totals
        let subtotal = 0;
        const populatedCart = cart.map(cartItem => {
            const product = products.find(p => p.id === cartItem.productId);
            if (!product) return null;
            const itemTotal = product.price * cartItem.quantity;
            subtotal += itemTotal;
            return {
                ...cartItem,
                product: product,
                seller: getSellerById(product.sellerId),
                itemTotal: itemTotal
            };
        }).filter(Boolean);

        const deliveryMethod = deliveryMethodSelect ? deliveryMethodSelect.value : 'delivery';
        const shippingFee = deliveryMethod === 'delivery' && subtotal > 0 ? 10000 : 0;
        const grandTotal = subtotal + shippingFee;

        if (cartSubtotalEl) cartSubtotalEl.textContent = formatRupiah(subtotal);
        if (cartShippingEl) cartShippingEl.textContent = shippingFee === 0 ? 'Gratis / Rp 0' : formatRupiah(shippingFee);
        if (cartTotalEl) cartTotalEl.textContent = formatRupiah(grandTotal);

        // Render Cart Items
        if (cartItemsContainer) {
            if (populatedCart.length === 0) {
                cartItemsContainer.innerHTML = '';
                if (cartEmptyNotice) cartEmptyNotice.classList.remove('hidden');
                if (btnCheckout) btnCheckout.disabled = true;
            } else {
                if (cartEmptyNotice) cartEmptyNotice.classList.add('hidden');
                if (btnCheckout) btnCheckout.disabled = false;

                cartItemsContainer.innerHTML = populatedCart.map(item => {
                    return `
                    <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-3 space-y-2">
                        <div class="flex items-start gap-3">
                            <img src="${item.product.image}" class="w-14 h-14 rounded-xl object-cover shrink-0">
                            <div class="flex-1 overflow-hidden">
                                <h4 class="font-bold text-sm text-slate-800 truncate">${item.product.name}</h4>
                                <div class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <i class="fa-solid fa-store text-[10px] text-amber-500"></i> ${item.seller.name}
                                </div>
                                <div class="font-bold text-xs text-orange-600 mt-1">${formatRupiah(item.product.price)}</div>
                            </div>
                            <!-- Stepper -->
                            <div class="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
                                <button onclick="window.KulinerHub.changeCartQty('${item.product.id}', -1)" class="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs">
                                    <i class="fa-solid fa-minus text-[9px]"></i>
                                </button>
                                <span class="w-6 text-center text-xs font-bold">${item.quantity}</span>
                                <button onclick="window.KulinerHub.changeCartQty('${item.product.id}', 1)" class="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs">
                                    <i class="fa-solid fa-plus text-[9px]"></i>
                                </button>
                            </div>
                        </div>
                        <!-- Catatan Pesanan -->
                        <div>
                            <input type="text" placeholder="Catatan (cth: pedas sedang, es sedikit)..." value="${item.notes || ''}" onchange="window.KulinerHub.updateCartNotes('${item.product.id}', this.value)" class="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-orange-500">
                        </div>
                    </div>
                    `;
                }).join('');
            }
        }
    }

    // Toggle Cart Drawer
    function toggleCart(open = null) {
        if (!cartDrawer) return;
        const isOpen = !cartDrawer.classList.contains('translate-x-full');
        const targetState = open !== null ? open : !isOpen;

        if (targetState) {
            cartDrawer.classList.remove('translate-x-full');
            document.body.classList.add('overflow-hidden');
        } else {
            cartDrawer.classList.add('translate-x-full');
            document.body.classList.remove('overflow-hidden');
        }
    }

    // ================= CHECKOUT & QRIS FLOW =================
    function openCheckout() {
        if (cart.length === 0) {
            showToast('Keranjang Anda masih kosong!', 'error');
            return;
        }
        toggleCart(false);

        // Generate temporary invoice code
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const invoiceCode = `INV-${dateStr}-${randomNum}`;

        // Compute totals
        let subtotal = 0;
        const summaryItems = cart.map(cartItem => {
            const product = products.find(p => p.id === cartItem.productId);
            if (!product) return null;
            const itemTotal = product.price * cartItem.quantity;
            subtotal += itemTotal;
            const seller = getSellerById(product.sellerId);
            return { ...cartItem, product, seller, itemTotal };
        }).filter(Boolean);

        const deliveryMethod = deliveryMethodSelect ? deliveryMethodSelect.value : 'delivery';
        const shippingFee = deliveryMethod === 'delivery' ? 10000 : 0;
        const grandTotal = subtotal + shippingFee;

        // Populate Checkout Modal
        if (checkoutInvoiceEl) checkoutInvoiceEl.textContent = invoiceCode;
        if (checkoutTotalEl) checkoutTotalEl.textContent = formatRupiah(grandTotal);

        if (checkoutItemsSummaryEl) {
            checkoutItemsSummaryEl.innerHTML = summaryItems.map(si => `
                <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <div class="truncate pr-2">
                        <span class="font-semibold text-slate-800">${si.quantity}x ${si.product.name}</span>
                        <span class="block text-[10px] text-slate-400">Mitra: ${si.seller.name} ${si.notes ? `(${si.notes})` : ''}</span>
                    </div>
                    <span class="font-bold text-slate-700 shrink-0">${formatRupiah(si.itemTotal)}</span>
                </div>
            `).join('') + `
                <div class="flex items-center justify-between text-xs pt-2 font-bold text-slate-800">
                    <span>Ongkos Kirim (${deliveryMethod === 'delivery' ? 'Kurir Lokal' : 'Ambil Sendiri'})</span>
                    <span class="text-orange-600">${shippingFee === 0 ? 'Gratis' : formatRupiah(shippingFee)}</span>
                </div>
            `;
        }

        // Reset proof file upload state
        currentUploadedProof = null;
        currentProofFileName = '';
        if (proofPreviewContainer) proofPreviewContainer.classList.add('hidden');
        if (uploadDropzone) uploadDropzone.classList.remove('hidden');
        if (proofFileInput) proofFileInput.value = '';

        if (checkoutModal) checkoutModal.classList.remove('hidden');
    }

    function closeCheckout() {
        if (checkoutModal) checkoutModal.classList.add('hidden');
    }

    // Handle Proof Screenshot Upload
    function handleProofFile(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Harap unggah file foto / screenshot bukti transfer!', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            currentUploadedProof = e.target.result;
            currentProofFileName = file.name;

            if (proofPreviewImg) proofPreviewImg.src = currentUploadedProof;
            if (proofFileNameEl) proofFileNameEl.textContent = file.name;
            if (uploadDropzone) uploadDropzone.classList.add('hidden');
            if (proofPreviewContainer) proofPreviewContainer.classList.remove('hidden');
            showToast('Bukti screenshot transfer berhasil diunggah!');
        };
        reader.readAsDataURL(file);
    }

    function removeProofFile() {
        currentUploadedProof = null;
        currentProofFileName = '';
        if (proofPreviewContainer) proofPreviewContainer.classList.add('hidden');
        if (uploadDropzone) uploadDropzone.classList.remove('hidden');
        if (proofFileInput) proofFileInput.value = '';
    }

    function downloadProofForWhatsApp() {
        if (!pendingProofDownload) {
            showToast('File bukti pembayaran tidak tersedia untuk diunduh.', 'error');
            return;
        }

        const [metadata, encodedData] = pendingProofDownload.dataUrl.split(',');
        const mimeMatch = metadata.match(/^data:(.*?);base64$/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const binaryData = atob(encodedData);
        const bytes = Uint8Array.from(binaryData, character => character.charCodeAt(0));
        const fileUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        const downloadLink = document.createElement('a');
        downloadLink.href = fileUrl;
        downloadLink.download = pendingProofDownload.fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    }

    // Submit Checkout Order
    function submitOrder(e) {
        e.preventDefault();

        const custName = document.getElementById('custName').value.trim();
        const custPhone = document.getElementById('custPhone').value.trim();
        const custAddress = document.getElementById('custAddress').value.trim();
        const custNotes = document.getElementById('custNotes').value.trim();
        const invoiceCode = checkoutInvoiceEl.textContent;

        if (!custName || !custPhone) {
            showToast('Nama dan nomor WhatsApp wajib diisi!', 'error');
            return;
        }

        if (!currentUploadedProof) {
            showToast('Harap unggah screenshot bukti transfer QRIS terlebih dahulu!', 'error');
            if (uploadDropzone) {
                uploadDropzone.classList.add('ring-2', 'ring-red-500');
                setTimeout(() => uploadDropzone.classList.remove('ring-2', 'ring-red-500'), 1500);
            }
            return;
        }

        pendingProofDownload = {
            dataUrl: currentUploadedProof,
            fileName: currentProofFileName || 'bukti-pembayaran-qris.png'
        };

        const orderTimestamp = Date.now();

        // Build item details & decrement stock
        let subtotal = 0;
        const populatedCart = cart.map(cartItem => {
            const product = products.find(p => p.id === cartItem.productId);
            if (!product) return null;
            const itemTotal = product.price * cartItem.quantity;
            subtotal += itemTotal;

            const previousStock = product.stock !== undefined ? product.stock : 20;
            product.stock = Math.max(0, previousStock - cartItem.quantity);
            if (product.stock === 0) {
                product.isAvailable = false;
            }
            recordStockChange(product, previousStock, product.stock, 'Pesanan pelanggan', invoiceCode);

            return {
                productId: product.id,
                productName: product.name,
                category: product.category,
                price: product.price,
                quantity: cartItem.quantity,
                notes: cartItem.notes || '',
                sellerName: getSellerById(product.sellerId).name,
                itemTotal: itemTotal
            };
        }).filter(Boolean);

        // Save updated product stocks
        saveProducts();

        const deliveryMethod = deliveryMethodSelect ? deliveryMethodSelect.value : 'delivery';
        const shippingFee = deliveryMethod === 'delivery' ? 10000 : 0;
        const grandTotal = subtotal + shippingFee;

        // Create new order record
        const newOrder = {
            id: invoiceCode,
            customerName: custName,
            customerPhone: custPhone,
            deliveryMethod: deliveryMethod,
            customerAddress: custAddress || 'Ambil Sendiri di Outlet',
            customerNotes: custNotes,
            items: populatedCart,
            subtotal: subtotal,
            shippingFee: shippingFee,
            grandTotal: grandTotal,
            paymentMethod: 'QRIS',
            paymentProof: currentUploadedProof,
            paymentVerified: false,
            handled: false,
            status: 'Menunggu Verifikasi',
            createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
            timestamp: orderTimestamp
        };

        orders.unshift(newOrder);
        saveOrders();
        renderAdminOrders();
        renderAdminDashboard();
        notifyNewOrder(newOrder);

        // Format WhatsApp message to Owner (Invoice Sederhana & Jelas)
        const currentDate = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        let waText = `*INVOICE PESANAN - HOLY STORE*\n`;
        waText += `No. Invoice: ${invoiceCode}\n`;
        waText += `Waktu: ${currentDate}\n\n`;

        waText += `*Data Pemesan:*\n`;
        waText += `• Nama: ${custName}\n`;
        waText += `• No. WhatsApp: ${custPhone}\n`;
        waText += `• Pengiriman: ${deliveryMethod === 'delivery' ? 'Delivery Kurir' : 'Ambil Sendiri'}\n`;
        if (custAddress) waText += `• Alamat/Meja: ${custAddress}\n`;
        if (custNotes) waText += `• Catatan: ${custNotes}\n`;

        waText += `\n*Daftar Menu:*\n`;
        populatedCart.forEach((item, idx) => {
            waText += `${idx + 1}. ${item.productName} (${item.quantity}x) = ${formatRupiah(item.itemTotal)}\n`;
            if (item.notes) waText += `   Catatan: ${item.notes}\n`;
        });

        waText += `\nSubtotal: ${formatRupiah(subtotal)}\n`;
        waText += `Ongkir: ${shippingFee === 0 ? 'Gratis' : formatRupiah(shippingFee)}\n`;
        waText += `*TOTAL BAYAR: ${formatRupiah(grandTotal)}*\n`;
        waText += `*Pembayaran:* QRIS (menunggu verifikasi admin)\n\n`;
        waText += `Bukti screenshot QRIS belum terlampir otomatis. Saya akan melampirkan file bukti pembayaran sebelum mengirim pesan ini. Mohon segera diproses. Terima kasih! 🙏`;

        // Pastikan selalu kirim ke nomor WhatsApp resmi owner: 6285741832972
        const targetNumber = OWNER_WHATSAPP;
        const waUrl = `https://wa.me/${targetNumber}?text=${encodeURIComponent(waText)}`;

        // Clear cart
        cart = [];
        saveCart();
        updateCartUI();
        renderProducts();

        closeCheckout();

        // Show Success Modal
        if (successInvoiceId) successInvoiceId.textContent = invoiceCode;
        if (successTotalAmount) successTotalAmount.textContent = formatRupiah(grandTotal);
        if (successWaLink) successWaLink.href = waUrl;
        if (successModal) successModal.classList.remove('hidden');

        // Automatically trigger WA link in new tab
        window.open(waUrl, '_blank');
    }

    // ================= HIDDEN ADMIN & QUICK STOCK MANAGEMENT =================
    // Trigger hidden admin
    function triggerSecretAdmin() {
        if (adminPinModal) {
            adminPinModal.classList.remove('hidden');
            if (adminPinInput) adminPinInput.focus();
        }
    }

    function checkAdminPin() {
        const pin = adminPinInput.value.trim();
        if (pin === settings.adminPin) {
            adminPinModal.classList.add('hidden');
            adminPinInput.value = '';
            openAdminPanel();
        } else {
            showToast('PIN Admin salah!', 'error');
            adminPinInput.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => adminPinInput.classList.remove('ring-2', 'ring-red-500'), 1500);
        }
    }

    function openAdminPanel() {
        renderAdminDashboard();
        renderQuickStockTable();
        populateStockProductDropdown();
        renderAdminOrders();
        renderAdminProducts();
        renderAdminResellers();
        populateSellerDropdowns();

        // Fill settings
        const waInput = document.getElementById('settingWhatsapp');
        const nameInput = document.getElementById('settingStoreName');
        const taglineInput = document.getElementById('settingTagline');
        const pinInput = document.getElementById('settingPin');

        if (waInput) waInput.value = settings.whatsapp;
        if (nameInput) nameInput.value = settings.storeName;
        if (taglineInput) taglineInput.value = settings.tagline;
        if (pinInput) pinInput.value = settings.adminPin;
        const verifierInput = document.getElementById('adminVerifierName');
        if (verifierInput) {
            verifierInput.value = localStorage.getItem(STORAGE_KEY_ADMIN_NAME) || 'Admin';
            verifierInput.onchange = () => localStorage.setItem(STORAGE_KEY_ADMIN_NAME, verifierInput.value.trim() || 'Admin');
        }

        if (adminModal) adminModal.classList.remove('hidden');
        showAdminTab('adminTabDashboard');
    }

    function showAdminTab(tabId) {
        const target = document.getElementById(tabId);
        if (!target || !target.classList.contains('admin-tab-content')) return;
        document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.add('hidden'));
        target.classList.remove('hidden');
        document.querySelectorAll('.admin-tab-button').forEach(button => {
            const isActive = button.dataset.adminTab === tabId;
            button.classList.toggle('border-b-2', isActive);
            button.classList.toggle('border-orange-600', isActive);
            button.classList.toggle('text-orange-600', isActive);
            button.classList.toggle('text-stone-600', !isActive);
        });
        const backNavigation = document.getElementById('adminBackNavigation');
        if (backNavigation) backNavigation.classList.toggle('hidden', tabId === 'adminTabDashboard');
        if (tabId === 'adminTabOrders') {
            adminOrderDateFilter = 'today';
            const dateFilter = document.getElementById('adminOrderDateFilter');
            if (dateFilter) dateFilter.value = 'today';
            renderAdminOrders();
        }
        if (tabId === 'adminTabStock') renderQuickStockTable();
        if (tabId === 'adminTabAddStock') populateStockProductDropdown();
        const panel = document.querySelector('#adminModal > div.relative');
        if (panel) panel.scrollTop = 0;
    }

    function renderAdminDashboard() {
        const now = new Date();
        const todaysOrders = orders
            .filter(order => isSameLocalDay(getOrderDate(order), now))
            .sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0));
        const weekOrders = orders.filter(order => isInCurrentWeek(getOrderDate(order), now));
        const verifiedSales = list => list
            .filter(order => order.paymentVerified && order.status !== 'Dibatalkan')
            .reduce((total, order) => total + (Number(order.grandTotal) || 0), 0);
        const verifiedToday = todaysOrders.filter(order => order.paymentVerified && order.status !== 'Dibatalkan').length;
        const unhandledOrders = orders.filter(order => !order.handled && order.status !== 'Dibatalkan').length;

        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        setText('adminTodayOrderCount', todaysOrders.length);
        setText('adminTodayPendingCount', todaysOrders.filter(order => !order.handled && order.status !== 'Dibatalkan').length);
        setText('adminTodayVerifiedCount', verifiedToday);
        setText('adminTodaySales', formatRupiah(verifiedSales(todaysOrders)));
        setText('adminWeekOrderCount', weekOrders.length);
        setText('adminWeekSales', formatRupiah(verifiedSales(weekOrders)));
        setText('adminUnhandledCount', unhandledOrders);
        const notificationButton = document.getElementById('adminNotificationButton');
        if (notificationButton) {
            notificationButton.textContent = typeof Notification === 'undefined'
                ? 'Notifikasi browser tidak didukung'
                : Notification.permission === 'granted'
                    ? 'Notifikasi browser aktif'
                    : 'Aktifkan notifikasi browser';
            notificationButton.disabled = typeof Notification === 'undefined' || Notification.permission === 'granted';
        }

    }

    function showTodayOrders() {
        adminOrderSearch = '';
        adminOrderStatusFilter = 'all';
        const searchInputEl = document.getElementById('adminOrderSearch');
        const statusFilterEl = document.getElementById('adminOrderStatusFilter');
        if (searchInputEl) searchInputEl.value = '';
        if (statusFilterEl) statusFilterEl.value = 'all';
        showAdminTab('adminTabOrders');
    }

    function showStockManagement() {
        showAdminTab('adminTabStock');
    }

    function populateStockProductDropdown() {
        const select = document.getElementById('adminAddStockProduct');
        if (!select) return;
        const selectedProductId = select.value;
        select.innerHTML = products.map(product =>
            `<option value="${escapeHTML(product.id)}">${escapeHTML(product.name)} (stok: ${product.stock ?? 20})</option>`
        ).join('');
        if (products.some(product => product.id === selectedProductId)) select.value = selectedProductId;
    }

    function addStock(e) {
        e.preventDefault();
        const productId = document.getElementById('adminAddStockProduct').value;
        const quantityInput = document.getElementById('adminAddStockQuantity');
        const quantity = Number.parseInt(quantityInput.value, 10);
        const note = document.getElementById('adminAddStockNote').value.trim();
        const product = products.find(item => item.id === productId);
        if (!product) {
            showToast('Pilih menu yang akan ditambah stoknya.', 'error');
            return;
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            showToast('Jumlah stok masuk harus lebih dari 0.', 'error');
            quantityInput.focus();
            return;
        }
        const previousStock = product.stock !== undefined ? product.stock : 20;
        product.stock = previousStock + quantity;
        product.isAvailable = true;
        recordStockChange(product, previousStock, product.stock, note ? `Stok masuk: ${note}` : 'Stok masuk baru');
        saveProducts();
        renderProducts();
        renderQuickStockTable();
        populateStockProductDropdown();
        document.getElementById('formAddStock').reset();
        showToast(`Stok ${product.name} bertambah ${quantity} (total ${product.stock}).`);
    }

    function requestAdminNotifications() {
        if (typeof Notification === 'undefined') {
            showToast('Browser ini tidak mendukung notifikasi.', 'error');
            return;
        }
        Notification.requestPermission().then(permission => {
            renderAdminDashboard();
            if (permission === 'granted') showToast('Notifikasi pesanan baru berhasil diaktifkan.');
            else if (permission === 'denied') showToast('Izin notifikasi ditolak. Ubah izin dari pengaturan browser.', 'error');
        }).catch(() => {
            showToast('Notifikasi browser gagal diaktifkan. Periksa izin browser atau coba lagi.', 'error');
        });
    }

    function downloadSalesReport(period) {
        const now = new Date();
        const reportOrders = orders.filter(order => {
            const date = getOrderDate(order);
            const inPeriod = period === 'today'
                ? isSameLocalDay(date, now)
                : isInCurrentWeek(date, now);
            return inPeriod && order.paymentVerified && order.status !== 'Dibatalkan';
        });
        const headers = ['Invoice', 'Waktu Pesanan', 'Nama Pelanggan', 'WhatsApp', 'Menu', 'Subtotal', 'Ongkir', 'Total Terverifikasi', 'Status', 'Diverifikasi Oleh', 'Waktu Verifikasi'];
        const rows = reportOrders.map(order => [
            order.id,
            order.createdAt,
            order.customerName,
            order.customerPhone,
            (order.items || []).map(item => `${item.quantity}x ${item.productName}`).join('; '),
            order.subtotal,
            order.shippingFee,
            order.grandTotal,
            order.status,
            order.paymentVerifiedBy || '',
            order.paymentVerifiedAt ? new Date(order.paymentVerifiedAt).toLocaleString('id-ID') : ''
        ]);
        const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
        const fileUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `laporan-penjualan-${period}-${now.toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
        showToast(`Laporan ${period === 'today' ? 'hari ini' : 'minggu ini'} berhasil diunduh (${reportOrders.length} pesanan terverifikasi).`);
    }

    // ---- QUICK STOCK TABLE RENDERING ----
    function renderQuickStockTable() {
        const dashboardStockList = document.getElementById('adminDashboardStockList');
        if (!adminStockList && !dashboardStockList) return;

        const stockMarkup = products.map(p => {
            const isAvail = p.isAvailable !== false && (p.stock === undefined || p.stock > 0);
            const currentStock = p.stock !== undefined ? p.stock : 20;
            const seller = getSellerById(p.sellerId);

            return `
            <div class="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3 overflow-hidden">
                    <img src="${p.image}" class="w-12 h-12 rounded-xl object-cover shrink-0">
                    <div class="overflow-hidden">
                        <div class="flex items-center gap-2">
                            <h5 class="font-bold text-xs sm:text-sm text-slate-800 truncate">${p.name}</h5>
                            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${p.category === 'makanan' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'}">${p.category}</span>
                        </div>
                        <div class="text-[11px] text-slate-500">
                            Mitra: ${seller.name} • <strong>${formatRupiah(p.price)}</strong>
                        </div>
                    </div>
                </div>

                <!-- Stock Controls -->
                <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end border-t sm:border-0 pt-2 sm:pt-0">
                    
                    <!-- Stepper -->
                    <div class="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-1">
                        <button type="button" onclick="window.KulinerHub.quickAdjustStock('${p.id}', -1)" class="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black shadow-xs">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <input type="number" min="0" value="${currentStock}" aria-label="Jumlah stok ${p.name}" onchange="window.KulinerHub.setExactStock('${p.id}', this.value)" class="w-12 text-center text-xs font-black bg-transparent border-0 focus:outline-none">
                        <button type="button" onclick="window.KulinerHub.quickAdjustStock('${p.id}', 1)" class="w-7 h-7 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    </div>

                    <!-- 1-Click Toggle Availability -->
                    <button type="button" onclick="window.KulinerHub.toggleStockAvailability('${p.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isAvail ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' : 'bg-red-100 hover:bg-red-200 text-red-800'}">
                        <i class="fa-solid ${isAvail ? 'fa-check' : 'fa-ban'}"></i>
                        <span>${isAvail ? 'Tersedia' : 'Habis'}</span>
                    </button>
                </div>
            </div>
            `;
        }).join('');
        if (adminStockList) adminStockList.innerHTML = stockMarkup;
        if (dashboardStockList) dashboardStockList.innerHTML = stockMarkup || '<p class="rounded-xl bg-white p-4 text-center text-xs text-stone-500">Belum ada menu.</p>';
        renderStockHistory();
    }

    function renderStockHistory() {
        const historyEl = document.getElementById('adminStockHistory');
        if (!historyEl) return;
        historyEl.innerHTML = stockHistory.length ? stockHistory.slice(0, 30).map(entry => `
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 text-xs">
                <div>
                    <strong class="text-stone-800">${entry.productName}</strong>
                    <span class="ml-1 font-bold ${entry.movement === 'Masuk' ? 'text-emerald-700' : 'text-red-700'}">${entry.movement} ${entry.quantity}</span>
                    <p class="text-[11px] text-stone-500">${entry.reason}${entry.reference ? ` • ${entry.reference}` : ''} • ${entry.actor || 'Admin'}</p>
                </div>
                <span class="text-[11px] text-stone-500">${new Date(entry.timestamp).toLocaleString('id-ID')}</span>
            </div>
        `).join('') : '<p class="rounded-xl bg-white p-4 text-center text-xs text-stone-500">Belum ada riwayat perubahan stok.</p>';
    }

    function toggleStockAvailability(productId) {
        const prod = products.find(p => p.id === productId);
        if (!prod) return;

        const newState = !(prod.isAvailable !== false && (prod.stock === undefined || prod.stock > 0));
        const previousStock = prod.stock !== undefined ? prod.stock : 20;
        prod.isAvailable = newState;
        if (newState && (!prod.stock || prod.stock <= 0)) {
            prod.stock = 10; // default restock
        } else if (!newState) {
            prod.stock = 0;
        }

        recordStockChange(prod, previousStock, prod.stock, newState ? 'Stok diaktifkan' : 'Ditandai habis');
        saveProducts();
        renderProducts();
        renderQuickStockTable();
        showToast(`Stok "${prod.name}" sekarang ${newState ? 'TERSEDIA' : 'HABIS'}`);
    }

    function quickAdjustStock(productId, delta) {
        const prod = products.find(p => p.id === productId);
        if (!prod) return;

        const current = prod.stock !== undefined ? prod.stock : 20;
        const updated = Math.max(0, current + delta);
        prod.stock = updated;
        prod.isAvailable = updated > 0;

        recordStockChange(prod, current, updated, delta > 0 ? 'Penambahan stok' : 'Pengurangan stok');
        saveProducts();
        renderProducts();
        renderQuickStockTable();
    }

    function setExactStock(productId, value) {
        const prod = products.find(p => p.id === productId);
        if (!prod) return;

        const val = parseInt(value, 10);
        const validVal = isNaN(val) ? 0 : Math.max(0, val);
        const previousStock = prod.stock !== undefined ? prod.stock : 20;
        prod.stock = validVal;
        prod.isAvailable = validVal > 0;

        recordStockChange(prod, previousStock, validVal, 'Penyesuaian stok');
        saveProducts();
        renderProducts();
        renderQuickStockTable();
        showToast(`Stok "${prod.name}" diubah menjadi ${validVal}`);
    }

    function setAllStockStatus(isAvailable) {
        products.forEach(p => {
            const previousStock = p.stock !== undefined ? p.stock : 20;
            p.isAvailable = isAvailable;
            if (isAvailable && (!p.stock || p.stock <= 0)) {
                p.stock = 20;
            } else if (!isAvailable) {
                p.stock = 0;
            }
            recordStockChange(p, previousStock, p.stock, isAvailable ? 'Semua menu tersedia' : 'Semua menu habis');
        });
        saveProducts();
        renderProducts();
        renderQuickStockTable();
        renderStockHistory();
        showToast(`Semua menu ditandai ${isAvailable ? 'TERSEDIA' : 'HABIS'}`);
    }

    // ---- BACKUP & RESTORE DATA SYSTEM ----
    function exportBackupData() {
        const backupPayload = {
            appName: "Holy Store Reseller",
            version: "2.2",
            exportedAt: new Date().toISOString(),
            data: {
                settings: settings,
                sellers: sellers,
                products: products,
                orders: orders,
                stockHistory: stockHistory,
                resellerApps: resellerApps
            }
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
        const downloadAnchor = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `backup-holystore-${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        showToast('File backup data (.JSON) berhasil diunduh!');
    }

    function importBackupData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed.data && parsed.data.products) {
                    products = parsed.data.products;
                    if (parsed.data.sellers) sellers = parsed.data.sellers;
                    if (parsed.data.settings) settings = parsed.data.settings;
                    if (parsed.data.orders) orders = parsed.data.orders;
                    stockHistory = Array.isArray(parsed.data.stockHistory) ? parsed.data.stockHistory : [];
                    if (parsed.data.resellerApps) resellerApps = parsed.data.resellerApps;

                    saveProducts();
                    saveSellers();
                    saveSettings();
                    saveOrders();
                    saveStockHistory();
                    saveResellerApps();

                    renderHeaderInfo();
                    updateCategoryCounters();
                    renderProducts();
                    renderQuickStockTable();
                    renderAdminOrders();
                    renderAdminDashboard();
                    renderAdminProducts();
                    renderAdminResellers();

                    showToast('Data berhasil dipulihkan dari file backup!');
                } else {
                    showToast('Format file backup tidak valid!', 'error');
                }
            } catch (err) {
                showToast('Gagal membaca file backup JSON!', 'error');
            }
        };
        reader.readAsText(file);
    }

    function resetToDefaultData() {
        if (!confirm('Peringatan: Apakah Anda yakin ingin mereset seluruh data kembali ke setelan pabrik default? Data pesanan saat ini akan terhapus.')) return;

        localStorage.removeItem(STORAGE_KEY_PRODUCTS);
        localStorage.removeItem(STORAGE_KEY_SELLERS);
        localStorage.removeItem(STORAGE_KEY_SETTINGS);
        localStorage.removeItem(STORAGE_KEY_ORDERS);
        localStorage.removeItem(STORAGE_KEY_STOCK_HISTORY);

        products = DEFAULT_DATA.products.map(p => ({ ...p, stock: 20, isAvailable: true }));
        sellers = DEFAULT_DATA.sellers;
        settings = DEFAULT_DATA.settings;
        orders = [];
        stockHistory = [];

        saveProducts();
        saveSellers();
        saveSettings();
        saveOrders();
        saveStockHistory();

        renderHeaderInfo();
        updateCategoryCounters();
        renderProducts();
        renderQuickStockTable();
        renderAdminOrders();
        renderAdminDashboard();
        renderAdminProducts();

        showToast('Data berhasil direset ke kondisi awal!');
    }

    // ---- ADMIN ORDERS ----
    function renderAdminOrders() {
        if (!adminOrdersList) return;
        const pendingOrders = orders.filter(order => order.status === 'Menunggu Verifikasi').length;
        const ordersWithProof = orders.filter(order => Boolean(order.paymentProof)).length;
        const totalOrdersEl = document.getElementById('adminOrderCount');
        const pendingOrdersEl = document.getElementById('adminPendingOrderCount');
        const proofOrdersEl = document.getElementById('adminProofOrderCount');
        const unhandledOrdersEl = document.getElementById('adminUnhandledOrdersTabCount');
        const unhandledOrders = orders.filter(order => !order.handled && order.status !== 'Dibatalkan').length;
        if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
        if (pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders;
        if (proofOrdersEl) proofOrdersEl.textContent = ordersWithProof;
        if (unhandledOrdersEl) unhandledOrdersEl.textContent = unhandledOrders;

        const normalizedSearch = adminOrderSearch.toLocaleLowerCase('id-ID');
        const filteredOrders = orders.filter(order => {
            const matchesStatus = adminOrderStatusFilter === 'all' || order.status === adminOrderStatusFilter;
            const matchesDate = adminOrderDateFilter === 'all' ||
                (adminOrderDateFilter === 'today' && isSameLocalDay(getOrderDate(order), new Date()));
            const searchableText = [
                order.id,
                order.customerName,
                order.customerPhone,
                ...(order.items || []).map(item => item.productName)
            ].join(' ').toLocaleLowerCase('id-ID');
            return matchesStatus && matchesDate && searchableText.includes(normalizedSearch);
        });

        if (orders.length === 0) {
            adminOrdersList.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">Belum ada pesanan masuk.</div>`;
            return;
        }
        if (filteredOrders.length === 0) {
            adminOrdersList.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">Tidak ada pesanan yang cocok dengan tanggal, pencarian, atau filter.</div>`;
            return;
        }

        adminOrdersList.innerHTML = filteredOrders.map(ord => {
            const statusColors = {
                'Menunggu Verifikasi': 'bg-amber-100 text-amber-800 border-amber-200',
                'Sedang Diproses': 'bg-blue-100 text-blue-800 border-blue-200',
                'Selesai': 'bg-emerald-100 text-emerald-800 border-emerald-200',
                'Dibatalkan': 'bg-red-100 text-red-800 border-red-200'
            };
            const currentBadge = statusColors[ord.status] || 'bg-slate-100 text-slate-800';

            return `
            <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs mb-3 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                        <span class="font-extrabold text-sm text-slate-900">${ord.id}</span>
                        <span class="text-xs text-slate-400 block">${ord.createdAt}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${ord.handled ? '' : '<span class="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-extrabold text-orange-800">BARU</span>'}
                        <span class="text-xs font-bold px-3 py-1 rounded-full border ${currentBadge}">${ord.status}</span>
                        <button onclick="window.KulinerHub.deleteOrder('${ord.id}')" class="text-xs text-red-500 hover:text-red-700 p-1" title="Hapus Pesanan">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div><strong>Pembeli:</strong> ${ord.customerName} (${ord.customerPhone})</div>
                    <div><strong>Pengiriman:</strong> ${ord.deliveryMethod === 'delivery' ? 'Delivery Kurir' : 'Ambil Sendiri'}</div>
                    <div class="sm:col-span-2"><strong>Alamat:</strong> ${ord.customerAddress || '-'}</div>
                    ${ord.customerNotes ? `<div class="sm:col-span-2"><strong>Catatan:</strong> ${ord.customerNotes}</div>` : ''}
                </div>

                <div class="space-y-1 text-xs">
                    <strong class="text-slate-700 block">Daftar Item:</strong>
                    ${ord.items.map(it => `
                        <div class="flex justify-between text-slate-600 pl-2 border-l-2 border-orange-300">
                            <span>${it.quantity}x ${it.productName} <span class="text-[10px] text-amber-700 font-semibold">[Mitra: ${it.sellerName}]</span></span>
                            <span class="font-bold">${formatRupiah(it.itemTotal)}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div>
                        <span class="text-xs text-slate-500">Total Pembayaran QRIS:</span>
                        <div class="font-extrabold text-base text-orange-600">${formatRupiah(ord.grandTotal)}</div>
                        <div class="text-[11px] ${ord.paymentVerified ? 'text-emerald-700' : 'text-amber-700'}">
                            ${ord.paymentVerified
                                ? `Terverifikasi ${ord.paymentVerifiedBy || 'Admin'} • ${new Date(ord.paymentVerifiedAt).toLocaleString('id-ID')}`
                                : 'Pembayaran belum diverifikasi'}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${ord.paymentProof ? `
                            <button onclick="window.KulinerHub.viewProof('${ord.id}')" class="px-3 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold flex items-center gap-1.5 transition">
                                <i class="fa-solid fa-receipt"></i> Lihat Bukti SS
                            </button>
                        ` : '<span class="text-xs text-slate-400">Tidak ada SS</span>'}
                        ${ord.paymentVerified ? `
                            <span class="rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                                <i class="fa-solid fa-circle-check"></i> QRIS Terverifikasi
                            </span>
                        ` : `
                            <button onclick="window.KulinerHub.confirmOrderPayment('${ord.id}')" ${ord.paymentProof ? '' : 'disabled'} class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:cursor-not-allowed disabled:bg-stone-300">
                                <i class="fa-solid fa-check"></i> ${ord.paymentProof ? 'Bukti cocok — verifikasi & proses' : 'Belum ada bukti SS'}
                            </button>
                        `}
                        <label class="text-[11px] font-semibold text-stone-600">Status Pesanan</label>
                        <select onchange="window.KulinerHub.updateOrderStatus('${ord.id}', this.value)" class="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none">
                            <option value="Menunggu Verifikasi" ${ord.status === 'Menunggu Verifikasi' ? 'selected' : ''}>Menunggu Verifikasi</option>
                            <option value="Sedang Diproses" ${ord.status === 'Sedang Diproses' ? 'selected' : ''}>Sedang Diproses</option>
                            <option value="Selesai" ${ord.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                            <option value="Dibatalkan" ${ord.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
                        </select>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    function filterAdminOrders(searchValue) {
        adminOrderSearch = searchValue.trim();
        renderAdminOrders();
    }

    function setAdminOrderStatusFilter(status) {
        adminOrderStatusFilter = status;
        renderAdminOrders();
    }

    function setAdminOrderDateFilter(period) {
        adminOrderDateFilter = period;
        renderAdminOrders();
    }

    function viewProof(orderId) {
        const order = orders.find(o => o.id === orderId);
        if (order && order.paymentProof) {
            if (proofViewerImage) proofViewerImage.src = order.paymentProof;
            if (proofViewerModal) proofViewerModal.classList.remove('hidden');
        } else {
            showToast('Bukti pembayaran tidak ditemukan', 'error');
        }
    }

    function updateOrderStatus(orderId, newStatus) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = newStatus;
            if (newStatus === 'Menunggu Verifikasi' || newStatus === 'Dibatalkan') {
                order.handled = newStatus === 'Dibatalkan';
            } else {
                order.handled = true;
                order.handledAt = Date.now();
                order.handledBy = getAdminName();
            }
            saveOrders();
            renderAdminOrders();
            renderAdminDashboard();
            showToast(`Status pesanan ${orderId} diubah menjadi "${newStatus}"`);
        }
    }

    function confirmOrderPayment(orderId) {
        const order = orders.find(item => item.id === orderId);
        if (!order || order.paymentVerified) return;
        if (order.status === 'Dibatalkan') {
            showToast('Pesanan yang dibatalkan tidak dapat dikonfirmasi pembayarannya.', 'error');
            return;
        }
        if (!order.paymentProof) {
            showToast('Bukti SS belum tersedia. Verifikasi QRIS tidak dapat dilakukan.', 'error');
            return;
        }
        const verifiedBy = getAdminName().trim();
        if (!verifiedBy) {
            showToast('Isi nama admin sebelum mengonfirmasi pembayaran.', 'error');
            return;
        }
        order.paymentVerified = true;
        order.paymentVerifiedAt = Date.now();
        order.paymentVerifiedBy = verifiedBy;
        order.status = 'Sedang Diproses';
        order.handled = true;
        order.handledAt = order.paymentVerifiedAt;
        order.handledBy = verifiedBy;
        saveOrders();
        renderAdminOrders();
        renderAdminDashboard();
        showToast(`Pembayaran invoice ${orderId} diverifikasi oleh ${verifiedBy}.`);
    }

    function deleteOrder(orderId) {
        if (!confirm(`Yakin ingin menghapus pesanan ${orderId}?`)) return;
        orders = orders.filter(o => o.id !== orderId);
        saveOrders();
        renderAdminOrders();
        renderAdminDashboard();
        showToast('Pesanan berhasil dihapus');
    }

    function renderAdminProducts() {
        if (!adminProductsList) return;
        adminProductsList.innerHTML = products.map(p => {
            const seller = getSellerById(p.sellerId);
            return `
            <form id="editProduct-${p.id}" onsubmit="window.KulinerHub.saveProductDetails(event, '${p.id}')" class="rounded-2xl border border-slate-200 bg-white p-4 mb-3 space-y-3">
                <div class="flex items-center gap-3 border-b border-stone-100 pb-3">
                    <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="w-12 h-12 rounded-lg object-cover shrink-0">
                    <div class="min-w-0">
                        <h5 class="font-bold text-sm text-slate-800 truncate">${escapeHTML(p.name)}</h5>
                        <div class="text-[11px] text-slate-500">Mitra: ${seller.name} • Stok saat ini: ${p.stock ?? 0}</div>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label for="editProductName-${p.id}" class="mb-1 block font-semibold">Nama menu *</label>
                        <input id="editProductName-${p.id}" value="${escapeHTML(p.name)}" required maxlength="100" class="w-full rounded-lg border border-stone-200 px-3 py-2">
                    </div>
                    <div>
                        <label for="editProductCategory-${p.id}" class="mb-1 block font-semibold">Kategori</label>
                        <select id="editProductCategory-${p.id}" class="w-full rounded-lg border border-stone-200 px-3 py-2">
                            <option value="makanan" ${p.category === 'makanan' ? 'selected' : ''}>Makanan</option>
                            <option value="minuman" ${p.category === 'minuman' ? 'selected' : ''}>Minuman</option>
                        </select>
                    </div>
                    <div>
                        <label for="editProductPrice-${p.id}" class="mb-1 block font-semibold">Harga jual (Rp) *</label>
                        <input id="editProductPrice-${p.id}" type="number" min="1" step="1" value="${p.price}" required class="w-full rounded-lg border border-stone-200 px-3 py-2">
                    </div>
                    <div>
                        <label for="editProductOriginalPrice-${p.id}" class="mb-1 block font-semibold">Harga coret (opsional)</label>
                        <input id="editProductOriginalPrice-${p.id}" type="number" min="0" step="1" value="${p.originalPrice || ''}" class="w-full rounded-lg border border-stone-200 px-3 py-2">
                    </div>
                    <div class="sm:col-span-2">
                        <label for="editProductDescription-${p.id}" class="mb-1 block font-semibold">Deskripsi</label>
                        <input id="editProductDescription-${p.id}" value="${escapeHTML(p.description || '')}" maxlength="300" class="w-full rounded-lg border border-stone-200 px-3 py-2">
                    </div>
                    <div class="sm:col-span-2">
                        <label for="editProductImage-${p.id}" class="mb-1 block font-semibold">URL gambar</label>
                        <input id="editProductImage-${p.id}" type="url" value="${escapeHTML(p.image || '')}" class="w-full rounded-lg border border-stone-200 px-3 py-2">
                    </div>
                </div>
                <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" onclick="window.KulinerHub.deleteProduct('${p.id}')" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
                        <i class="fa-solid fa-trash"></i> Hapus Menu
                    </button>
                    <button type="submit" class="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700">
                        <i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan
                    </button>
                </div>
            </form>
            `;
        }).join('');
    }

    function saveProductDetails(event, productId) {
        event.preventDefault();
        const product = products.find(item => item.id === productId);
        if (!product) {
            showToast('Menu tidak ditemukan.', 'error');
            return;
        }
        const name = document.getElementById(`editProductName-${productId}`).value.trim();
        const price = Number.parseInt(document.getElementById(`editProductPrice-${productId}`).value, 10);
        const originalPriceValue = document.getElementById(`editProductOriginalPrice-${productId}`).value;
        const originalPrice = originalPriceValue ? Number.parseInt(originalPriceValue, 10) : null;
        if (!name || !Number.isInteger(price) || price <= 0 ||
            (originalPriceValue && (!Number.isInteger(originalPrice) || originalPrice < 0))) {
            showToast('Periksa nama dan nilai harga menu.', 'error');
            return;
        }
        product.name = name;
        product.category = document.getElementById(`editProductCategory-${productId}`).value;
        product.price = price;
        product.originalPrice = originalPrice && originalPrice > price ? originalPrice : null;
        product.description = document.getElementById(`editProductDescription-${productId}`).value.trim();
        product.image = document.getElementById(`editProductImage-${productId}`).value.trim() || product.image;
        saveProducts();
        renderProducts();
        renderAdminProducts();
        renderQuickStockTable();
        updateCategoryCounters();
        populateStockProductDropdown();
        showToast(`Menu "${name}" berhasil diperbarui.`);
    }

    function deleteProduct(productId) {
        if (!confirm('Yakin ingin menghapus produk ini dari katalog?')) return;
        products = products.filter(p => p.id !== productId);
        saveProducts();
        renderProducts();
        renderAdminProducts();
        renderQuickStockTable();
        updateCategoryCounters();
        showToast('Produk berhasil dihapus');
    }

    function addProduct(e) {
        e.preventDefault();
        const name = document.getElementById('adminProdName').value.trim();
        const category = document.getElementById('adminProdCategory').value;
        const sellerId = document.getElementById('adminProductSeller').value;
        const price = parseInt(document.getElementById('adminProdPrice').value, 10);
        const originalPrice = parseInt(document.getElementById('adminProdOrigPrice').value || 0, 10);
        const stock = parseInt(document.getElementById('adminProdStock').value || 20, 10);
        const image = document.getElementById('adminProdImage').value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
        const desc = document.getElementById('adminProdDesc').value.trim();
        const tags = document.getElementById('adminProdTags').value.split(',').map(t => t.trim()).filter(Boolean);

        if (!name || isNaN(price)) {
            showToast('Nama dan harga produk wajib diisi!', 'error');
            return;
        }

        const newProd = {
            id: 'p_' + Date.now(),
            name: name,
            category: category,
            sellerId: sellerId,
            price: price,
            originalPrice: originalPrice > price ? originalPrice : null,
            stock: stock,
            isAvailable: stock > 0,
            rating: 5.0,
            soldCount: 0,
            image: image,
            description: desc || 'Menu lezat pilihan reseller terbaik.',
            tags: tags.length > 0 ? tags : ['Baru'],
            isPopular: false
        };

        products.unshift(newProd);
        recordStockChange(newProd, 0, stock, 'Stok awal produk');
        saveProducts();
        renderProducts();
        renderAdminProducts();
        renderQuickStockTable();
        updateCategoryCounters();
        document.getElementById('formAddProduct').reset();
        populateStockProductDropdown();
        showToast(`Produk "${name}" berhasil ditambahkan!`);
    }

    // ================= DAFTAR RESELLER SYSTEM =================
    function openResellerModal() {
        const modal = document.getElementById('resellerModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeResellerModal() {
        const modal = document.getElementById('resellerModal');
        if (modal) modal.classList.add('hidden');
    }

    function addResellerProductRow() {
        const container = document.getElementById('resellerProductsContainer');
        if (!container) return;

        const rowId = 'row_' + Date.now();
        const rowDiv = document.createElement('div');
        rowDiv.id = rowId;
        rowDiv.className = 'reseller-prod-row bg-white p-3 rounded-xl border border-stone-200/90 shadow-2xs space-y-2 relative';
        rowDiv.innerHTML = `
            <div class="flex items-center justify-between pb-1 border-b border-stone-100">
                <span class="text-[11px] font-bold text-orange-700 flex items-center gap-1">
                    <i class="fa-solid fa-bowl-food text-[10px]"></i> Menu Tambahan
                </span>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-[11px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                    <i class="fa-solid fa-trash text-[10px]"></i> Hapus
                </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <div class="sm:col-span-5">
                    <label class="block font-bold text-stone-700 text-[11px] mb-1">Nama Produk / Menu *</label>
                    <input type="text" class="prod-row-name w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-orange-500" required placeholder="Cth: Cireng Bumbu Rujak">
                </div>
                <div class="sm:col-span-3">
                    <label class="block font-bold text-stone-700 text-[11px] mb-1">Kategori *</label>
                    <select class="prod-row-cat w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 focus:bg-white focus:outline-none focus:border-orange-500">
                        <option value="makanan">🍔 Makanan</option>
                        <option value="minuman">🍹 Minuman</option>
                    </select>
                </div>
                <div class="sm:col-span-4">
                    <label class="block font-bold text-stone-700 text-[11px] mb-1">Harga Jual (Rp) *</label>
                    <input type="number" class="prod-row-price w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-orange-500" required placeholder="Cth: 15000">
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <div class="sm:col-span-7">
                    <input type="text" class="prod-row-desc w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-orange-500 text-[11px]" placeholder="Deskripsi singkat menu (bahan, porsi, rasa)...">
                </div>
                <div class="sm:col-span-5">
                    <input type="url" class="prod-row-image w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-orange-500 text-[11px]" placeholder="Link Foto / Kosongkan jika belum ada">
                </div>
            </div>
        `;
        container.appendChild(rowDiv);
    }

    function submitResellerForm(e) {
        e.preventDefault();
        const name = document.getElementById('resellerName').value.trim();
        const phone = document.getElementById('resellerPhone').value.trim();
        const city = document.getElementById('resellerCity').value.trim();
        const type = document.getElementById('resellerType').value;
        const experience = document.getElementById('resellerExperience').value;
        const socmed = document.getElementById('resellerSocmed').value.trim();
        const notes = document.getElementById('resellerNotes').value.trim();

        if (!name || !phone || !city) {
            showToast('Nama, WhatsApp, dan Kota wajib diisi!', 'error');
            return;
        }

        // Collect proposed products
        const proposedProducts = [];
        const rows = document.querySelectorAll('.reseller-prod-row');
        rows.forEach(row => {
            const pName = row.querySelector('.prod-row-name')?.value.trim();
            const pCat = row.querySelector('.prod-row-cat')?.value || 'makanan';
            const pPrice = parseInt(row.querySelector('.prod-row-price')?.value, 10);
            const pDesc = row.querySelector('.prod-row-desc')?.value.trim();
            const pImage = row.querySelector('.prod-row-image')?.value.trim();

            if (pName && !isNaN(pPrice)) {
                proposedProducts.push({
                    name: pName,
                    category: pCat,
                    price: pPrice,
                    desc: pDesc || '',
                    image: pImage || ''
                });
            }
        });

        const newApp = {
            id: 'RES-' + Date.now(),
            name: name,
            phone: phone,
            city: city,
            type: type,
            experience: experience,
            socmed: socmed || '-',
            notes: notes || '-',
            proposedProducts: proposedProducts,
            status: 'Menunggu Follow-up',
            createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
            timestamp: Date.now()
        };

        resellerApps.unshift(newApp);
        saveResellerApps();

        // Format WhatsApp message to owner (Template Simpel Pendaftaran)
        let waText = `*PENDAFTARAN RESELLER - HOLY STORE*\n`;
        waText += `Tanggal: ${new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\n\n`;

        waText += `*Data Pendaftar:*\n`;
        waText += `• Nama: ${name}\n`;
        waText += `• No. WhatsApp: ${phone}\n`;
        waText += `• Kota: ${city}\n`;
        waText += `• Kemitraan: ${type}\n`;
        waText += `• Pengalaman: ${experience}\n`;
        if (socmed && socmed !== '-') waText += `• Toko/Medsos: ${socmed}\n`;
        if (notes && notes !== '-') waText += `• Catatan: ${notes}\n`;

        if (proposedProducts.length > 0) {
            waText += `\n*Menu yang Diajukan:*\n`;
            proposedProducts.forEach((p, i) => {
                waText += `${i + 1}. ${p.name} (${p.category}) - ${formatRupiah(p.price)}\n`;
                if (p.desc) waText += `   Keterangan: ${p.desc}\n`;
            });
        }

        waText += `\nHalo Admin Holy Store, saya ingin bekerjasama dan mengajukan menu di atas. Mohon di-ACC agar tayang di website ya kak. Terima kasih! 🙏`;

        // Pastikan selalu kirim ke nomor WhatsApp resmi owner: 6285741832972
        const targetNumber = OWNER_WHATSAPP;
        const waUrl = `https://wa.me/${targetNumber}?text=${encodeURIComponent(waText)}`;

        closeResellerModal();
        document.getElementById('formReseller')?.reset();

        showToast('Pendaftaran dan produk berhasil dikirim! Menghubungkan ke WhatsApp...');
        window.open(waUrl, '_blank');
    }

    function renderAdminResellers() {
        const listEl = document.getElementById('adminResellerList');
        if (!listEl) return;

        if (resellerApps.length === 0) {
            listEl.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">Belum ada data pendaftar reseller baru.</div>`;
            return;
        }

        listEl.innerHTML = resellerApps.map(app => {
            const isApproved = app.status === 'Diterima / Terbit di Katalog';
            const statusClasses = {
                'Menunggu Follow-up': 'bg-amber-100 text-amber-800 border-amber-200',
                'Diterima / Terbit di Katalog': 'bg-emerald-100 text-emerald-800 border-emerald-200',
                'Ditolak / Arsip': 'bg-stone-100 text-stone-600 border-stone-200'
            };
            const currentBadge = statusClasses[app.status] || 'bg-slate-100 text-slate-800';

            const cleanPhone = app.phone.replace(/[^0-9]/g, '');
            const greeting = encodeURIComponent(`Halo kak ${app.name}, terima kasih telah mendaftar menjadi Reseller di ${settings.storeName}! Kami ingin membagikan informasi syarat kemitraan dan katalog harga khusus reseller.`);

            const hasProducts = app.proposedProducts && app.proposedProducts.length > 0;

            return `
            <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs mb-3.5 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-extrabold text-sm text-slate-900">${app.name}</span>
                            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full border ${currentBadge}">${app.status}</span>
                        </div>
                        <span class="text-xs text-slate-400 block">${app.createdAt}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <a href="https://wa.me/${cleanPhone}?text=${greeting}" target="_blank" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs">
                            <i class="fa-brands fa-whatsapp text-sm"></i> Chat WA
                        </a>
                        <button onclick="window.KulinerHub.deleteResellerApp('${app.id}')" class="text-xs text-red-500 hover:text-red-700 p-1.5" title="Hapus Pendaftar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div><strong>WhatsApp:</strong> ${app.phone}</div>
                    <div><strong>Kota:</strong> ${app.city}</div>
                    <div><strong>Tipe:</strong> ${app.type}</div>
                    <div><strong>Pengalaman:</strong> ${app.experience}</div>
                    <div class="sm:col-span-2"><strong>Medsos / Toko:</strong> ${app.socmed}</div>
                    ${app.notes && app.notes !== '-' ? `<div class="sm:col-span-3"><strong>Catatan:</strong> ${app.notes}</div>` : ''}
                </div>

                <!-- Proposed Products Section -->
                ${hasProducts ? `
                    <div class="bg-orange-50/70 p-3.5 rounded-xl border border-orange-200/80 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-extrabold text-orange-900 flex items-center gap-1.5">
                                <i class="fa-solid fa-utensils text-orange-600"></i> ${app.proposedProducts.length} Menu Diajukan untuk Dijual:
                            </span>
                            ${isApproved ? `
                                <span class="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <i class="fa-solid fa-check"></i> Sudah Aktif di Katalog
                                </span>
                            ` : `
                                <button type="button" onclick="window.KulinerHub.approveAndUploadProducts('${app.id}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer">
                                    <i class="fa-solid fa-cloud-arrow-up"></i> ACC & Upload ke Katalog
                                </button>
                            `}
                        </div>
                        <div class="space-y-1.5 pt-1">
                            ${app.proposedProducts.map((p, i) => `
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white p-2 rounded-lg border border-orange-100 gap-1">
                                    <div>
                                        <span class="font-bold text-slate-800">${i + 1}. ${p.name}</span>
                                        <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ml-1.5 ${p.category === 'makanan' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'}">${p.category}</span>
                                        ${p.desc ? `<p class="text-[11px] text-slate-500 mt-0.5">${p.desc}</p>` : ''}
                                    </div>
                                    <span class="font-extrabold text-orange-600 shrink-0">${formatRupiah(p.price)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="flex items-center justify-end gap-2 pt-1">
                    <span class="text-xs text-slate-400">Ubah Status:</span>
                    <select onchange="window.KulinerHub.updateResellerStatus('${app.id}', this.value)" class="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 focus:outline-none">
                        <option value="Menunggu Follow-up" ${app.status === 'Menunggu Follow-up' ? 'selected' : ''}>Menunggu Follow-up</option>
                        <option value="Diterima / Terbit di Katalog" ${app.status === 'Diterima / Terbit di Katalog' ? 'selected' : ''}>Diterima / Terbit di Katalog</option>
                        <option value="Ditolak / Arsip" ${app.status === 'Ditolak / Arsip' ? 'selected' : ''}>Ditolak / Arsip</option>
                    </select>
                </div>
            </div>
            `;
        }).join('');
    }

    function approveAndUploadProducts(appId) {
        const app = resellerApps.find(a => a.id === appId);
        if (!app) return;

        if (!app.proposedProducts || app.proposedProducts.length === 0) {
            showToast('Calon reseller ini tidak mengajukan produk!', 'error');
            return;
        }

        // 1. Create or link Seller
        const sellerName = (app.socmed && app.socmed !== '-') ? app.socmed : app.name;
        let existingSeller = sellers.find(s => s.name.toLowerCase() === sellerName.toLowerCase());
        let sellerId = existingSeller ? existingSeller.id : ('s_' + Date.now());

        if (!existingSeller) {
            const newSeller = {
                id: sellerId,
                name: sellerName,
                category: 'Mitra ' + (app.city || 'Kuliner'),
                rating: 5.0,
                location: app.city || 'Dapur Mitra',
                badge: 'Mitra Baru',
                avatar: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=120&auto=format&fit=crop&q=80'
            };
            sellers.push(newSeller);
            saveSellers();
        }

        // 2. Add each proposed product into catalog
        app.proposedProducts.forEach((p, idx) => {
            const isDrink = p.category === 'minuman';
            const defaultImg = isDrink 
                ? 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80'
                : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

            const newProduct = {
                id: 'p_acc_' + Date.now() + '_' + idx,
                name: p.name,
                category: p.category,
                sellerId: sellerId,
                price: p.price,
                originalPrice: null,
                stock: 20,
                isAvailable: true,
                rating: 5.0,
                soldCount: 0,
                image: (p.image && p.image.startsWith('http')) ? p.image : defaultImg,
                description: p.desc || `Menu ${p.category} lezat dari mitra ${sellerName}.`,
                tags: ['Mitra Baru', p.category === 'makanan' ? 'Makanan' : 'Minuman'],
                isPopular: false
            };
            products.unshift(newProduct);
            recordStockChange(newProduct, 0, newProduct.stock, 'Stok awal produk mitra');
        });

        // 3. Update status of applicant
        app.status = 'Diterima / Terbit di Katalog';
        saveProducts();
        saveResellerApps();
        populateStockProductDropdown();

        // 4. Update UIs
        renderProducts();
        updateCategoryCounters();
        renderQuickStockTable();
        renderAdminProducts();
        renderAdminResellers();
        populateSellerDropdowns();

        showToast(`Sukses! ${app.proposedProducts.length} menu dari ${sellerName} berhasil di-ACC dan terbit di katalog!`);

        // Notify seller via WhatsApp
        const cleanPhone = app.phone.replace(/[^0-9]/g, '');
        const menuNames = app.proposedProducts.map(p => p.name).join(', ');
        const notifyMsg = encodeURIComponent(`Halo kak ${app.name}, kabar gembira! 🎉\n\nPengajuan kemitraan dan produk Anda (*${menuNames}*) telah kami ACC dan resmi tayang di website ${settings.storeName}. Anda dapat melihatnya langsung di website kami. Terima kasih atas kerjasamanya! 🙏`);
        
        setTimeout(() => {
            if (confirm(`Buka WhatsApp untuk mengabari kak ${app.name} bahwa produknya sudah tayang?`)) {
                window.open(`https://wa.me/${cleanPhone}?text=${notifyMsg}`, '_blank');
            }
        }, 300);
    }

    function updateResellerStatus(id, newStatus) {
        const app = resellerApps.find(a => a.id === id);
        if (app) {
            app.status = newStatus;
            saveResellerApps();
            renderAdminResellers();
            showToast(`Status pendaftar ${app.name} diubah menjadi "${newStatus}"`);
        }
    }

    function deleteResellerApp(id) {
        if (!confirm('Hapus data pendaftar ini?')) return;
        resellerApps = resellerApps.filter(a => a.id !== id);
        saveResellerApps();
        renderAdminResellers();
        showToast('Data pendaftar reseller berhasil dihapus');
    }

    function saveStoreSettings(e) {
        e.preventDefault();
        const newWhatsapp = document.getElementById('settingWhatsapp').value.trim();
        const newStoreName = document.getElementById('settingStoreName').value.trim();
        const newTagline = document.getElementById('settingTagline').value.trim();
        const newPin = document.getElementById('settingPin').value.trim();
        const customQrisUrl = document.getElementById('settingQrisUrl').value.trim();

        if (newWhatsapp) settings.whatsapp = newWhatsapp;
        if (newStoreName) settings.storeName = newStoreName;
        if (newTagline) settings.tagline = newTagline;
        if (newPin) settings.adminPin = newPin;
        if (customQrisUrl) settings.qrisImage = customQrisUrl;

        saveSettings();
        renderHeaderInfo();
        showToast('Pengaturan toko berhasil diperbarui!');
    }

    // ================= EVENT LISTENERS =================
    function setupEventListeners() {
        window.addEventListener('storage', event => {
            if (event.key === STORAGE_KEY_ORDERS && event.newValue) {
                try {
                    const updatedOrders = JSON.parse(event.newValue);
                    if (!Array.isArray(updatedOrders)) throw new Error('Data pesanan bukan daftar.');
                    const knownOrderIds = new Set(orders.map(order => order.id));
                    const newOrders = updatedOrders.filter(order => !knownOrderIds.has(order.id) && !order.handled);
                    orders = updatedOrders;
                    renderAdminOrders();
                    renderAdminDashboard();
                    newOrders.forEach(notifyNewOrder);
                } catch (error) {
                    showToast('Data pesanan dari tab lain tidak dapat dibaca.', 'error');
                }
            }
            if (event.key === STORAGE_KEY_PRODUCTS && event.newValue) {
                try {
                    const updatedProducts = JSON.parse(event.newValue);
                    if (!Array.isArray(updatedProducts)) throw new Error('Data produk bukan daftar.');
                    products = updatedProducts;
                    renderProducts();
                    renderQuickStockTable();
                    updateCategoryCounters();
                } catch (error) {
                    showToast('Data stok dari tab lain tidak dapat dibaca.', 'error');
                }
            }
            if (event.key === STORAGE_KEY_STOCK_HISTORY && event.newValue) {
                try {
                    const updatedHistory = JSON.parse(event.newValue);
                    if (!Array.isArray(updatedHistory)) throw new Error('Riwayat stok bukan daftar.');
                    stockHistory = updatedHistory;
                    renderStockHistory();
                } catch (error) {
                    showToast('Riwayat stok dari tab lain tidak dapat dibaca.', 'error');
                }
            }
        });

        // Category Pills Filter
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => {
                    b.classList.remove('bg-orange-600', 'text-white', 'shadow-md', 'shadow-orange-500/20');
                    b.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
                });
                btn.classList.add('bg-orange-600', 'text-white', 'shadow-md', 'shadow-orange-500/20');
                btn.classList.remove('bg-white', 'text-slate-600', 'border', 'border-slate-200');

                activeCategory = btn.getAttribute('data-category');
                renderProducts();
            });
        });

        // Search Input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderProducts();
            });
        }

        // Sort Select
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                sortBy = e.target.value;
                renderProducts();
            });
        }

        // Delivery Method Select in Cart
        if (deliveryMethodSelect) {
            deliveryMethodSelect.addEventListener('change', () => {
                updateCartUI();
            });
        }

        // Proof upload file input
        if (proofFileInput) {
            proofFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleProofFile(e.target.files[0]);
                }
            });
        }

        // Drag and drop for proof upload
        if (uploadDropzone) {
            uploadDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadDropzone.classList.add('dragover');
            });
            uploadDropzone.addEventListener('dragleave', () => {
                uploadDropzone.classList.remove('dragover');
            });
            uploadDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadDropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleProofFile(e.dataTransfer.files[0]);
                }
            });
        }

        // Remove proof button
        if (btnRemoveProof) {
            btnRemoveProof.addEventListener('click', removeProofFile);
        }

        // Checkout Form Submit
        if (formCheckout) {
            formCheckout.addEventListener('submit', submitOrder);
        }

        // Admin Forms
        const formAddProduct = document.getElementById('formAddProduct');
        if (formAddProduct) formAddProduct.addEventListener('submit', addProduct);

        const formAddStock = document.getElementById('formAddStock');
        if (formAddStock) formAddStock.addEventListener('submit', addStock);

        const formSettings = document.getElementById('formSettings');
        if (formSettings) formSettings.addEventListener('submit', saveStoreSettings);

        const formReseller = document.getElementById('formReseller');
        if (formReseller) formReseller.addEventListener('submit', submitResellerForm);

        // QRIS upload input
        const qrisUploadInput = document.getElementById('qrisUploadInput');
        if (qrisUploadInput) {
            qrisUploadInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function (ev) {
                        settings.qrisImage = ev.target.result;
                        saveSettings();
                        renderHeaderInfo();
                        showToast('Gambar QRIS berhasil diperbarui!');
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        }

        // Backup restore input
        const restoreFileInput = document.getElementById('restoreFileInput');
        if (restoreFileInput) {
            restoreFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    importBackupData(e.target.files[0]);
                }
            });
        }

        // ---- SECRET ADMIN TRIGGERS ----
        // 1. Logo 4-click trigger
        const brandLogoTrigger = document.getElementById('brandLogoTrigger');
        if (brandLogoTrigger) {
            brandLogoTrigger.addEventListener('click', () => {
                logoClickCount++;
                clearTimeout(logoClickTimer);
                if (logoClickCount >= 4) {
                    logoClickCount = 0;
                    triggerSecretAdmin();
                } else {
                    logoClickTimer = setTimeout(() => {
                        logoClickCount = 0;
                    }, 2500);
                }
            });
        }

        // 2. Keyboard shortcut Ctrl + Shift + A
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
                e.preventDefault();
                triggerSecretAdmin();
            }
        });
    }

    function checkUrlForAdmin() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('admin')) {
            triggerSecretAdmin();
        }
    }

    // Export to global window scope for inline onclick handlers
    window.KulinerHub = {
        addToCart,
        changeCartQty,
        updateCartNotes,
        toggleCart,
        openCheckout,
        closeCheckout,
        triggerSecretAdmin,
        checkAdminPin,
        openAdminPanel,
        showAdminTab,
        renderAdminDashboard,
        showTodayOrders,
        showStockManagement,
        addStock,
        requestAdminNotifications,
        downloadSalesReport,
        viewProof,
        filterAdminOrders,
        setAdminOrderStatusFilter,
        setAdminOrderDateFilter,
        updateOrderStatus,
        confirmOrderPayment,
        deleteOrder,
        deleteProduct,
        saveProductDetails,
        toggleStockAvailability,
        quickAdjustStock,
        setExactStock,
        setAllStockStatus,
        exportBackupData,
        downloadProofForWhatsApp,
        resetToDefaultData,
        openResellerModal,
        closeResellerModal,
        addResellerProductRow,
        submitResellerForm,
        updateResellerStatus,
        deleteResellerApp,
        approveAndUploadProducts
    };

    // Auto init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
