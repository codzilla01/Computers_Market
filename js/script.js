// بيانات المنتجات
const products = [
    {
        id: 1,
        title: "MacBook Pro 16",
        brand: "apple",
        price: 8499,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "جهاز MacBook Pro مقاس 16 بوصة مع شريحة M2 Pro - أداء مذهل للعمل الإبداعي والمهني.",
        specs: {
            "الشاشة": "16.2 بوصة",
            "المعالج": "Apple M2 Pro",
            "الذاكرة": "16 جيجابايت",
            "التخزين": "512 جيجابايت SSD",
            "البطارية": "يصل إلى 21 ساعة",
            "نظام التشغيل": "macOS"
        }
    },
    {
        id: 2,
        title: "Dell XPS 13",
        brand: "dell",
        price: 4999,
        image: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "Dell XPS 13 - جهاز Ultrabook رفيع وخفيف مع أداء قوي وتصميم أنيق.",
        specs: {
            "الشاشة": "13.4 بوصة",
            "المعالج": "Intel Core i7-1165G7",
            "الذاكرة": "16 جيجابايت",
            "التخزين": "512 جيجابايت SSD",
            "البطارية": "يصل إلى 14 ساعة",
            "نظام التشغيل": "Windows 11"
        }
    },
    {
        id: 3,
        title: "HP Spectre x360",
        brand: "hp",
        price: 5699,
        image: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "HP Spectre x360 - جهاز 2 في 1 متعدد الاستخدامات بشاشة قابلة للقلب وتصميم مميز.",
        specs: {
            "الشاشة": "13.5 بوصة",
            "المعالج": "Intel Core i7-1195G7",
            "الذاكرة": "16 جيجابايت",
            "التخزين": "1 تيرابايت SSD",
            "البطارية": "يصل إلى 17 ساعة",
            "نظام التشغيل": "Windows 11"
        }
    },
    {
        id: 4,
        title: "Lenovo ThinkPad X1",
        brand: "lenovo",
        price: 6299,
        image: "https://images.unsplash.com/photo-1593642702749-b7d2a804fbcf?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfhx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "Lenovo ThinkPad X1 Carbon - جهاز أعمال خفيف الوزن ومتين مع أداء متميز.",
        specs: {
            "الشاشة": "14 بوصة",
            "المعالج": "Intel Core i7-1165G7",
            "الذاكرة": "16 جيجابايت",
            "التخزين": "512 جيجابايت SSD",
            "البطارية": "يصل إلى 15 ساعة",
            "نظام التشغيل": "Windows 11 Pro"
        }
    },
    {
        id: 5,
        title: "ASUS ROG Zephyrus",
        brand: "asus",
        price: 7599,
        image: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "ASUS ROG Zephyrus - جهاز ألعاب قوي بشاشة عالية التردد وتصميم أنيق.",
        specs: {
            "الشاشة": "15.6 بوصة",
            "المعالج": "AMD Ryzen 9 5900HS",
            "الذاكرة": "32 جيجابايت",
            "التخزين": "1 تيرابايت SSD",
            "البطارية": "يصل إلى 10 ساعات",
            "نظام التشغيل": "Windows 11"
        }
    },
    {
        id: 6,
        title: "MacBook Air M2",
        brand: "apple",
        price: 5999,
        image: "https://images.unsplash.com/photo-1629131726695-4b4f37c373b7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "MacBook Air مع شريحة M2 - تصميم رفيع وأداء مذهل مع بطارية تدوم طوال اليوم.",
        specs: {
            "الشاشة": "13.6 بوصة",
            "المعالج": "Apple M2",
            "الذاكرة": "8 جيجابايت",
            "التخزين": "256 جيجابايت SSD",
            "البطارية": "يصل إلى 18 ساعة",
            "نظام التشغيل": "macOS"
        }
    },
    {
        id: 7,
        title: "Dell Inspiron 15",
        brand: "dell",
        price: 3499,
        image: "https://images.unsplash.com/photo-1593642634443-44adaa06623a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "Dell Inspiron 15 - جهاز متعدد الاستخدامات بأداء جيد وسعر مناسب.",
        specs: {
            "الشاشة": "15.6 بوصة",
            "المعالج": "Intel Core i5-1135G7",
            "الذاكرة": "8 جيجابايت",
            "التخزين": "512 جيجابايت SSD",
            "البطارية": "يصل إلى 8 ساعات",
            "نظام التشغيل": "Windows 11"
        }
    },
    {
        id: 8,
        title: "HP Pavilion 15",
        brand: "hp",
        price: 3899,
        image: "https://images.unsplash.com/photo-1593642532744-d377ab507dc8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&q=80",
        description: "HP Pavilion 15 - جهاز يومي بميزانية معقولة وأداء موثوق لجميع الاستخدامات.",
        specs: {
            "الشاشة": "15.6 بوصة",
            "المعالج": "AMD Ryzen 5 5500U",
            "الذاكرة": "8 جيجابايت",
            "التخزين": "512 جيجابايت SSD",
            "البطارية": "يصل إلى 9 ساعات",
            "نظام التشغيل": "Windows 11"
        }
    }
];

// عناصر DOM
const productsContainer = document.getElementById('products-container');
const filterButtons = document.querySelectorAll('.filter-btn');
const modal = document.getElementById('product-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');

// عرض المنتجات
function displayProducts(filter = 'all') {
    productsContainer.innerHTML = '';
    
    const filteredProducts = filter === 'all' 
        ? products 
        : products.filter(product => product.brand === filter);
    
    filteredProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-img">
                <img src="${product.image}" alt="${product.title}">
            </div>
            <div class="product-info">
                <span class="product-brand">${product.brand.toUpperCase()}</span>
                <h3 class="product-title">${product.title}</h3>
                <p class="product-price">${product.price.toLocaleString()} ر.س</p>
                <p class="product-description">${product.description}</p>
                <button class="view-details" data-id="${product.id}">عرض التفاصيل</button>
            </div>
        `;
        
        productsContainer.appendChild(productCard);
    });
    
    // إضافة مستمعي الأحداث لأزرار التفاصيل
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', () => {
            const productId = parseInt(button.getAttribute('data-id'));
            showProductDetails(productId);
        });
    });
}

// عرض تفاصيل المنتج
function showProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    
    if (product) {
        let specsHTML = '';
        for (const [key, value] of Object.entries(product.specs)) {
            specsHTML += `<li><strong>${key}:</strong> <span>${value}</span></li>`;
        }
        
        modalBody.innerHTML = `
            <div class="modal-img">
                <img src="${product.image}" alt="${product.title}">
            </div>
            <div class="modal-info">
                <span class="product-brand">${product.brand.toUpperCase()}</span>
                <h2 class="modal-title">${product.title}</h2>
                <p class="modal-price">${product.price.toLocaleString()} ر.س</p>
                <p>${product.description}</p>
                
                <div class="modal-specs">
                    <h3 class="specs-title">المواصفات الفنية</h3>
                    <ul class="specs-list">
                        ${specsHTML}
                    </ul>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    }
}

// إضافة مستمعي الأحداث لأزرار التصفية
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // إزالة النشاط من جميع الأزرار
        filterButtons.forEach(btn => btn.classList.remove('active'));
        
        // إضافة النشاط للزر المحدد
        button.classList.add('active');
        
        // تطبيق التصفية
        const filter = button.getAttribute('data-filter');
        displayProducts(filter);
    });
});

// إغلاق النافذة المنبثقة
closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

// إغلاق النافذة المنبثقة بالنقر خارج المحتوى
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    displayProducts();
});