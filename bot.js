const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ==================== الإعدادات ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN غير موجود');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

const BOT_NAME = "idlebstore_bot";

// ==================== ملفات التخزين ====================
const PRODUCTS_FILE = 'products.json';
const USERS_FILE = 'users.json';
const COUPONS_FILE = 'coupons.json';
const ORDERS_FILE = 'orders.json';

// تحميل المنتجات
let products = [];
if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
} else {
    products = [
        { id: 1, name: "Kali Linux Pro Kit", price: 450000, link: "https://t.me/your_channel/kali", desc: "أداة اختبار الاختراق", category: "اختبار الاختراق", stock: 999, sales: 89, rating: 4.9 },
        { id: 2, name: "Burp Suite Pro", price: 1250000, link: "https://t.me/your_channel/burp", desc: "رخصة سنة كاملة", category: "اختبار الاختراق", stock: 25, sales: 12, rating: 5.0 },
        { id: 3, name: "OSINT Master", price: 320000, link: "https://t.me/your_channel/osint", desc: "50 أداة OSINT", category: "OSINT", stock: 999, sales: 34, rating: 4.7 },
        { id: 4, name: "VPN Lifetime", price: 850000, link: "https://t.me/your_channel/vpn", desc: "اشتراك مدى الحياة", category: "VPN", stock: 100, sales: 156, rating: 4.8 }
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// تحميل المستخدمين
let users = {};
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
}

// تحميل الكوبونات
let coupons = [];
if (fs.existsSync(COUPONS_FILE)) {
    coupons = JSON.parse(fs.readFileSync(COUPONS_FILE));
} else {
    coupons = [
        { code: "WELCOME10", discount: 10, type: "percent", uses: 0, maxUses: 100, minOrder: 0 },
        { code: "SAVE50", discount: 50000, type: "fixed", uses: 0, maxUses: 50, minOrder: 500000 }
    ];
    fs.writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2));
}

// تحميل الطلبات
let orders = [];
if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
}

const saveProducts = () => fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
const saveCoupons = () => fs.writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2));
const saveOrders = () => fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

const formatPrice = (p) => p.toLocaleString('ar-SY') + " ل.س";
const isAdmin = (id) => id === ADMIN_ID;
const getShareLink = (id) => `https://t.me/${BOT_NAME}?start=product_${id}`;

// ==================== دوال مساعدة ====================
const getUser = (id) => {
    if (!users[id]) {
        users[id] = { 
            balance: 0, 
            purchases: [], 
            name: "مستخدم",
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: null,
            referralEarnings: 0,
            subscription: null,
            cart: [],
            createdAt: new Date().toISOString()
        };
        saveUsers();
    }
    return users[id];
};

const getProduct = (id) => products.find(p => p.id === id);

// ==================== أزرار ====================
const mainMenu = () => Markup.keyboard([
    ['📦 المنتجات', '🔍 بحث'],
    ['🛒 سلة التسوق', '🏷️ كوبونات'],
    ['💰 رصيدي', '📤 دعوة صديق'],
    ['⭐ تقييمات', '❓ مساعدة']
]).resize();

const adminMenu = () => Markup.keyboard([
    ['📦 إدارة منتجات', '🏷️ إدارة كوبونات'],
    ['💰 شحن رصيد', '📢 بث إعلاني'],
    ['📊 إحصائيات', '👥 المستخدمين'],
    ['🔙 رجوع']
]).resize();

const productKeyboard = (product) => Markup.inlineKeyboard([
    [Markup.button.callback('🛒 شراء', `buy_${product.id}`), Markup.button.callback('➕ سلة', `addcart_${product.id}`)],
    [Markup.button.callback('📤 مشاركة', `share_${product.id}`), Markup.button.callback('⭐ تقييم', `rate_${product.id}`)],
    [Markup.button.url('📥 تحميل', product.link)]
]);

const cartKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('💳 إتمام الشراء', 'checkout'), Markup.button.callback('🗑️ تفريغ', 'clearcart')],
    [Markup.button.callback('🔙 رجوع', 'main')]
]);

// ==================== أوامر البوت ====================

// بدء البوت
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    const text = ctx.message.text;
    if (text && text.includes('start=')) {
        const ref = text.split('start=')[1];
        if (ref && ref !== userId.toString() && !user.referredBy) {
            user.referredBy = parseInt(ref);
            if (users[ref]) {
                users[ref].balance += 5000;
                users[ref].referralEarnings += 5000;
                await bot.telegram.sendMessage(ref, `🎉 مستخدم جديد انضم عبر رابط دعوتك! حصلت على 5000 ل.س مكافأة.`);
            }
            saveUsers();
        }
    }
    
    const welcome = `🎉 مرحباً ${ctx.from.first_name} في متجر IDLEB X!\n\n💰 رصيدك: ${formatPrice(user.balance)}\n🆔 كود الدعوة: ${user.referralCode}\n\n📌 استخدم الأزرار أدناه للتنقل.`;
    
    if (isAdmin(userId)) {
        await ctx.reply(welcome + '\n\n🔧 لوحة المشرف', { parse_mode: 'Markdown', ...adminMenu() });
    } else {
        await ctx.reply(welcome, { parse_mode: 'Markdown', ...mainMenu() });
    }
});

// ==================== المنتجات ====================
bot.hears('📦 المنتجات', async (ctx) => {
    if (!products.length) return ctx.reply("لا توجد منتجات");
    
    let msg = "📦 *المنتجات:*\n\n";
    const btns = [];
    for (const p of products) {
        msg += `*${p.id}.* ${p.name}\n   💰 ${formatPrice(p.price)}\n   📂 ${p.category}\n   ⭐ ${p.rating}/5\n\n`;
        btns.push([Markup.button.callback(`📦 ${p.id}. ${p.name.substring(0, 20)}`, `view_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 القائمة الرئيسية', 'main')]);
    
    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

bot.action(/view_(\d+)/, async (ctx) => {
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const msg = `📦 *${product.name}*\n💰 ${formatPrice(product.price)}\n📂 ${product.category}\n⭐ ${product.rating}/5\n📊 مبيعات: ${product.sales}\n📝 ${product.desc}\n\n📥 ${product.link}`;
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...productKeyboard(product) });
    await ctx.answerCbQuery();
});

// ==================== بحث ====================
bot.hears('🔍 بحث', async (ctx) => {
    await ctx.reply("🔍 أرسل اسم المنتج أو كلمة للبحث:");
    bot.once('text', async (ctx2) => {
        const query = ctx2.message.text.toLowerCase();
        const results = products.filter(p => p.name.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query));
        
        if (!results.length) return ctx2.reply("❌ لا توجد نتائج");
        
        let msg = "🔍 *نتائج البحث:*\n\n";
        for (const p of results) {
            msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
        }
        await ctx2.reply(msg, { parse_mode: 'Markdown' });
    });
});

// ==================== سلة التسوق ====================
bot.hears('🛒 سلة التسوق', async (ctx) => {
    const user = getUser(ctx.from.id);
    const cart = user.cart || [];
    
    if (!cart.length) return ctx.reply("🛒 سلة التسوق فارغة");
    
    let total = 0;
    let msg = "🛒 *سلة التسوق:*\n\n";
    for (const item of cart) {
        const p = getProduct(item.id);
        if (p) {
            msg += `*${item.id}. ${p.name}*\n   ${item.qty} × ${formatPrice(p.price)} = ${formatPrice(p.price * item.qty)}\n\n`;
            total += p.price * item.qty;
        }
    }
    msg += `💰 *المجموع:* ${formatPrice(total)}\n\n`;
    msg += `لإتمام الشراء، استخدم الأزرار أدناه.`;
    
    await ctx.reply(msg, { parse_mode: 'Markdown', ...cartKeyboard() });
});

bot.action(/addcart_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const productId = parseInt(ctx.match[1]);
    const product = getProduct(productId);
    
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const user = getUser(userId);
    if (!user.cart) user.cart = [];
    
    const existing = user.cart.find(i => i.id === productId);
    if (existing) {
        existing.qty++;
    } else {
        user.cart.push({ id: productId, qty: 1 });
    }
    
    saveUsers();
    await ctx.answerCbQuery(`✅ تم إضافة ${product.name} إلى السلة`);
});

bot.action('clearcart', async (ctx) => {
    const user = getUser(ctx.from.id);
    user.cart = [];
    saveUsers();
    await ctx.editMessageText("✅ تم تفريغ السلة");
    await ctx.answerCbQuery();
});

// ==================== إتمام الشراء ====================
bot.action('checkout', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const cart = user.cart || [];
    
    if (!cart.length) return ctx.answerCbQuery("السلة فارغة");
    
    let total = 0;
    let items = [];
    for (const item of cart) {
        const p = getProduct(item.id);
        if (p && p.stock >= item.qty) {
            total += p.price * item.qty;
            items.push({ ...p, qty: item.qty });
        }
    }
    
    // إنشاء طلب جديد
    const order = {
        id: Date.now(),
        userId: userId,
        items: items,
        total: total,
        status: "pending",
        date: new Date().toISOString()
    };
    orders.push(order);
    saveOrders();
    
    // خصم الرصيد
    if (user.balance >= total) {
        user.balance -= total;
        for (const item of cart) {
            const p = getProduct(item.id);
            if (p) {
                p.stock -= item.qty;
                p.sales += item.qty;
            }
        }
        user.cart = [];
        saveProducts();
        saveUsers();
        
        let receipt = "✅ *تم الشراء بنجاح!*\n\n";
        for (const item of items) {
            receipt += `📦 ${item.name} ×${item.qty} = ${formatPrice(item.price * item.qty)}\n`;
            receipt += `📥 رابط التحميل: ${item.link}\n\n`;
        }
        receipt += `💰 المدفوع: ${formatPrice(total)}\n💰 الرصيد المتبقي: ${formatPrice(user.balance)}`;
        
        await ctx.editMessageText(receipt, { parse_mode: 'Markdown' });
        
        // إشعار للمشرف
        await bot.telegram.sendMessage(ADMIN_ID, `🛒 طلب جديد!\n\nالمستخدم: ${userId}\nالمبلغ: ${formatPrice(total)}\nالمنتجات: ${items.length}`);
    } else {
        await ctx.editMessageText(`❌ رصيدك غير كافٍ!\n💰 رصيدك: ${formatPrice(user.balance)}\n💵 المطلوب: ${formatPrice(total)}\n\nللشحن: تواصل مع المشرف.`, { parse_mode: 'Markdown' });
    }
    await ctx.answerCbQuery();
});

// ==================== كوبونات ====================
bot.hears('🏷️ كوبونات', async (ctx) => {
    let msg = "🏷️ *الكوبونات المتاحة:*\n\n";
    for (const c of coupons) {
        msg += `🎫 *${c.code}*\n`;
        msg += `   💰 ${c.type === "percent" ? `${c.discount}%` : formatPrice(c.discount)} خصم\n`;
        msg += `   📊 استخدم: ${c.uses}/${c.maxUses}\n`;
        if (c.minOrder > 0) msg += `   🛒 الحد الأدنى: ${formatPrice(c.minOrder)}\n`;
        msg += `\n`;
    }
    msg += `\nلتفعيل كوبون: /coupon <الكود>`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('coupon', async (ctx) => {
    const userId = ctx.from.id;
    const code = ctx.message.text.split(' ')[1]?.toUpperCase();
    
    if (!code) return ctx.reply("⚠️ الاستخدام: /coupon <الكود>");
    
    const coupon = coupons.find(c => c.code === code);
    if (!coupon) return ctx.reply("❌ كوبون غير صالح");
    if (coupon.uses >= coupon.maxUses) return ctx.reply("❌ تم استخدام هذا الكوبون أقصى عدد مرات");
    
    const user = getUser(userId);
    user.activeCoupon = { code: coupon.code, discount: coupon.discount, type: coupon.type };
    saveUsers();
    
    ctx.reply(`✅ تم تفعيل الكوبون ${code}! سيتم تطبيقه على طلبك القادم.`);
});

// ==================== دعوة صديق ====================
bot.hears('📤 دعوة صديق', async (ctx) => {
    const user = getUser(ctx.from.id);
    const link = `https://t.me/${BOT_NAME}?start=${ctx.from.id}`;
    
    const msg = `📤 *رابط دعوتك الخاص:*\n🔗 \`${link}\`\n\n🎁 *المكافآت:*\n• كل صديق ينضم عبر رابطك يربحك 5000 ل.س\n• أصدقاؤك يحصلون على 2000 ل.س ترحيبية\n\n💰 أرباحك من الدعوات: ${formatPrice(user.referralEarnings)}`;
    
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== رصيدي ====================
bot.hears('💰 رصيدي', async (ctx) => {
    const user = getUser(ctx.from.id);
    const msg = `💰 *رصيدك:* ${formatPrice(user.balance)}\n🎁 *أرباح الدعوات:* ${formatPrice(user.referralEarnings)}\n🏷️ *كوبون نشط:* ${user.activeCoupon?.code || "لا يوجد"}`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== تقييمات ====================
bot.hears('⭐ تقييمات', async (ctx) => {
    let msg = "⭐ *أعلى المنتجات تقييماً:*\n\n";
    const topRated = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5);
    for (const p of topRated) {
        msg += `*${p.id}. ${p.name}* - ⭐ ${p.rating}/5\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.action(/rate_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = getProduct(productId);
    
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    await ctx.reply(`⭐ *تقييم المنتج: ${product.name}*\n\nأرسل رقم التقييم من 1 إلى 5:`);
    
    bot.once('text', async (ctx2) => {
        const rating = parseInt(ctx2.message.text);
        if (rating >= 1 && rating <= 5) {
            product.rating = (product.rating * 4 + rating) / 5;
            saveProducts();
            await ctx2.reply(`✅ شكراً لتقييمك! ${product.name} حصل على ${rating}/5 ⭐`);
        } else {
            await ctx2.reply("❌ الرجاء إدخال رقم بين 1 و 5");
        }
    });
    await ctx.answerCbQuery();
});

// ==================== شراء مباشر ====================
bot.action(/buy_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const product = getProduct(parseInt(ctx.match[1]));
    
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const user = getUser(userId);
    
    // تطبيق الكوبون
    let price = product.price;
    if (user.activeCoupon) {
        const coupon = user.activeCoupon;
        if (coupon.type === "percent") {
            price = price * (1 - coupon.discount / 100);
        } else {
            price = Math.max(0, price - coupon.discount);
        }
        delete user.activeCoupon;
        saveUsers();
    }
    
    if (user.balance < price) {
        return ctx.answerCbQuery(`❌ رصيدك غير كافٍ! رصيدك: ${user.balance}`, true);
    }
    
    user.balance -= price;
    user.purchases.push({
        productId: product.id,
        productName: product.name,
        price: price,
        date: new Date().toISOString(),
        link: product.link
    });
    
    product.stock--;
    product.sales++;
    saveProducts();
    saveUsers();
    
    // تسجيل الطلب
    orders.push({
        id: Date.now(),
        userId: userId,
        product: product.name,
        amount: price,
        status: "completed",
        date: new Date().toISOString()
    });
    saveOrders();
    
    const msg = `✅ *تم شراء ${product.name}!\n💰 المدفوع: ${formatPrice(price)}\n💰 الرصيد المتبقي: ${formatPrice(user.balance)}\n\n📥 رابط التحميل: ${product.link}`;
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('✅ تم الشراء');
    
    // إشعار للمشرف
    await bot.telegram.sendMessage(ADMIN_ID, `🛒 عملية شراء جديدة!\n👤 المستخدم: ${userId}\n📦 المنتج: ${product.name}\n💰 المبلغ: ${formatPrice(price)}`);
});

// ==================== مشاركة ====================
bot.action(/share_(\d+)/, async (ctx) => {
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const link = getShareLink(product.id);
    await ctx.reply(`📤 *رابط مشاركة ${product.name}*\n\n🔗 \`${link}\``, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== قائمة رئيسية ====================
bot.action('main', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const msg = `🎉 مرحباً\n💰 رصيدك: ${formatPrice(user.balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.editMessageText(msg + '\n🔧 لوحة المشرف', { parse_mode: 'Markdown', ...adminMenu() });
    } else {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...mainMenu() });
    }
    await ctx.answerCbQuery();
});

bot.hears('🔙 رجوع', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const msg = `🎉 مرحباً\n💰 رصيدك: ${formatPrice(user.balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(msg + '\n🔧 لوحة المشرف', { parse_mode: 'Markdown', ...adminMenu() });
    } else {
        await ctx.reply(msg, { parse_mode: 'Markdown', ...mainMenu() });
    }
});

// ==================== أوامر المشرف ====================

// إدارة المنتجات
bot.hears('📦 إدارة منتجات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    let msg = "📦 *إدارة المنتجات*\n\n";
    for (const p of products) {
        msg += `*${p.id}. ${p.name}*\n   💰 ${formatPrice(p.price)} | 📊 مخزون: ${p.stock} | 📈 مبيعات: ${p.sales}\n`;
        msg += `   /edit_${p.id} - تعديل\n   /del_${p.id} - حذف\n\n`;
    }
    msg += `\n📝 لإضافة منتج: /addproduct <الاسم> <السعر> <الرابط> <القسم>`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// إضافة منتج
bot.command('addproduct', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const args = ctx.message.text.split(' ');
    if (args.length < 5) {
        return ctx.reply("⚠️ /addproduct <الاسم> <السعر> <الرابط> <القسم>\nمثال: /addproduct 'Kali Linux' 450000 https://t.me/file 'اختبار الاختراق'");
    }
    
    const name = args[1];
    const price = parseInt(args[2]);
    const link = args[3];
    const category = args[4];
    
    const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: newId, name, price, link, category, desc: "تمت الإضافة عبر البوت", stock: 999, sales: 0, rating: 4.5 });
    saveProducts();
    
    await ctx.reply(`✅ تم إضافة المنتج ${name}\n🔗 رابط المشاركة: ${getShareLink(newId)}`);
});

// تعديل منتج
bot.command(/edit_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.reply("منتج غير موجود");
    
    await ctx.reply(`✏️ تعديل ${product.name}\nأرسل:\nالاسم: ${product.name}\nالسعر: ${product.price}\nالرابط: ${product.link}\nالقسم: ${product.category}\nالوصف: ${product.desc}\nالمخزون: ${product.stock}`);
});

// حذف منتج
bot.command(/del_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const id = parseInt(ctx.match[1]);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return ctx.reply("منتج غير موجود");
    
    const deleted = products[index];
    products.splice(index, 1);
    saveProducts();
    
    await ctx.reply(`✅ تم حذف ${deleted.name}`);
});

// إدارة كوبونات
bot.hears('🏷️ إدارة كوبونات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    let msg = "🏷️ *الكوبونات*\n\n";
    for (const c of coupons) {
        msg += `*${c.code}* - ${c.type === "percent" ? `${c.discount}%` : formatPrice(c.discount)}\n`;
        msg += `   استخدم: ${c.uses}/${c.maxUses}\n\n`;
    }
    msg += `\nلإضافة كوبون: /addcoupon <الكود> <الخصم> <نوع>\nنوع: percent أو fixed`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// إضافة كوبون
bot.command('addcoupon', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const args = ctx.message.text.split(' ');
    if (args.length < 4) {
        return ctx.reply("⚠️ /addcoupon <الكود> <الخصم> <نوع>\nمثال: /addcoupon SALE20 20 percent");
    }
    
    const code = args[1].toUpperCase();
    const discount = parseInt(args[2]);
    const type = args[3];
    
    coupons.push({ code, discount, type, uses: 0, maxUses: 999, minOrder: 0 });
    saveCoupons();
    
    await ctx.reply(`✅ تم إضافة كوبون ${code} - ${type === "percent" ? `${discount}%` : formatPrice(discount)}`);
});

// شحن رصيد
bot.hears('💰 شحن رصيد', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply("💰 شحن رصيد مستخدم\nأرسل: /charge <معرف> <مبلغ>\nمثال: /charge 123456789 50000");
});

bot.command(/charge (\d+) (\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    
    const user = getUser(userId);
    user.balance += amount;
    saveUsers();
    
    await ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم ${userId}`);
    await bot.telegram.sendMessage(userId, `🎉 تم شحن رصيدك ${formatPrice(amount)}\n💰 رصيدك: ${formatPrice(user.balance)}`);
});

// بث إعلاني
bot.hears('📢 بث إعلاني', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply("📢 أرسل الرسالة التي تريد بثها لجميع المستخدمين:");
    
    bot.once('text', async (ctx2) => {
        const message = ctx2.message.text;
        let success = 0;
        let failed = 0;
        
        for (const userId of Object.keys(users)) {
            try {
                await bot.telegram.sendMessage(userId, `📢 *إعلان من الإدارة*\n\n${message}`, { parse_mode: 'Markdown' });
                success++;
            } catch(e) { failed++; }
        }
        
        await ctx2.reply(`✅ تم الإرسال إلى ${success} مستخدم\n❌ فشل: ${failed}`);
    });
});

// إحصائيات
bot.hears('📊 إحصائيات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const totalUsers = Object.keys(users).length;
    const totalSales = products.reduce((s, p) => s + p.sales, 0);
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    
    const msg = `📊 *إحصائيات البوت*\n\n👥 المستخدمين: ${totalUsers}\n🛒 المبيعات: ${totalSales}\n💰 الإيرادات: ${formatPrice(totalRevenue)}\n📦 الطلبات: ${totalOrders}\n🏷️ الكوبونات: ${coupons.length}\n📦 المنتجات: ${products.length}`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// المستخدمين
bot.hears('👥 المستخدمين', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    let msg = "👥 *قائمة المستخدمين*\n\n";
    const list = Object.entries(users).slice(0, 30);
    for (const [id, data] of list) {
        msg += `🆔 ${id}\n   👤 ${data.name}\n   💰 ${formatPrice(data.balance)}\n   🛒 ${data.purchases?.length || 0} مشتريات\n   📤 ${data.referralEarnings > 0 ? formatPrice(data.referralEarnings) : "لا"} أرباح\n\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// مساعدة
bot.hears('❓ مساعدة', async (ctx) => {
    const msg = `🔧 *قائمة الأوامر*\n\n📦 /products - عرض المنتجات\n🔍 /search <كلمة> - بحث\n🛒 /cart - سلة التسوق\n🏷️ /coupon <كود> - تفعيل كوبون\n💰 /balance - رصيدك\n📤 /referral - رابط دعوتك\n⭐ /rate <رقم> - تقييم منتج\n\n🛒 للشراء: اضغط على زر "شراء" بجانب أي منتج`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== API للموقع ====================
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/coupons', (req, res) => res.json(coupons));

// ==================== تشغيل البوت ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP على منفذ ${PORT}`));

bot.launch().then(() => {
    console.log(`✅ البوت @${BOT_NAME} يعمل!`);
    console.log(`👑 المشرف: ${ADMIN_ID}`);
    console.log(`📦 المنتجات: ${products.length}`);
    console.log(`👥 المستخدمين: ${Object.keys(users).length}`);
    console.log(`🏷️ الكوبونات: ${coupons.length}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
