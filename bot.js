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

// تحميل البيانات
let products = [];
let users = {};
let coupons = [];
let orders = [];

if (fs.existsSync(PRODUCTS_FILE)) products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
else { products = []; fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2)); }

if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE));
else { users = {}; fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

if (fs.existsSync(COUPONS_FILE)) coupons = JSON.parse(fs.readFileSync(COUPONS_FILE));
else { coupons = []; fs.writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2)); }

if (fs.existsSync(ORDERS_FILE)) orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
else { orders = []; fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2)); }

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
            balance: 0, purchases: [], name: "مستخدم", 
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: null, referralEarnings: 0, cart: [], createdAt: Date.now()
        };
        saveUsers();
    }
    return users[id];
};

const getProduct = (id) => products.find(p => p.id === id);

// ==================== أزرار المشرف الرئيسية ====================
const adminMainMenu = () => Markup.keyboard([
    ['📦 المنتجات', '👥 المستخدمين', '💰 الأرباح'],
    ['🏷️ الكوبونات', '📢 إعلان', '📊 إحصائيات'],
    ['⚙️ الإعدادات', '💾 نسخ احتياطي', '🔙 رجوع']
]).resize();

// ==================== أزرار إدارة المنتجات ====================
const productsAdminMenu = () => Markup.inlineKeyboard([
    [Markup.button.callback('➕ إضافة منتج', 'admin_add_product')],
    [Markup.button.callback('✏️ تعديل منتج', 'admin_edit_product')],
    [Markup.button.callback('🗑️ حذف منتج', 'admin_delete_product')],
    [Markup.button.callback('📋 عرض كل المنتجات', 'admin_list_products')],
    [Markup.button.callback('🔙 رجوع', 'admin_back')]
]);

// ==================== أزرار إدارة المستخدمين ====================
const usersAdminMenu = () => Markup.inlineKeyboard([
    [Markup.button.callback('💰 شحن رصيد', 'admin_charge_balance')],
    [Markup.button.callback('💸 خصم رصيد', 'admin_deduct_balance')],
    [Markup.button.callback('👥 عرض المستخدمين', 'admin_list_users')],
    [Markup.button.callback('🔍 بحث عن مستخدم', 'admin_search_user')],
    [Markup.button.callback('🔙 رجوع', 'admin_back')]
]);

// ==================== أزرار إدارة الكوبونات ====================
const couponsAdminMenu = () => Markup.inlineKeyboard([
    [Markup.button.callback('➕ إضافة كوبون', 'admin_add_coupon')],
    [Markup.button.callback('🗑️ حذف كوبون', 'admin_delete_coupon')],
    [Markup.button.callback('📋 عرض الكوبونات', 'admin_list_coupons')],
    [Markup.button.callback('🔙 رجوع', 'admin_back')]
]);

// ==================== تخزين جلسات الإضافة المؤقتة ====================
let addingProduct = {};
let editingProduct = {};
let addingCoupon = {};
let chargingUser = {};
let broadcasting = {};

// ==================== القائمة الرئيسية للمستخدم ====================
const userMainMenu = () => Markup.keyboard([
    ['📦 المنتجات', '🔍 بحث', '🛒 سلتي'],
    ['🏷️ كوبونات', '📤 دعوة صديق', '💰 رصيدي'],
    ['⭐ تقييمات', '❓ مساعدة']
]).resize();

// ==================== بدء البوت ====================
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId);
    
    // التحقق من رابط المنتج
    const text = ctx.message.text;
    if (text && text.includes('start=product_')) {
        const productId = parseInt(text.split('product_')[1]);
        const product = getProduct(productId);
        if (product) {
            const msg = `📦 *${product.name}*\n💰 ${formatPrice(product.price)}\n📂 ${product.category || 'عام'}\n⭐ ${product.rating || 4.5}/5\n📝 ${product.desc || 'لا يوجد وصف'}\n\n📥 رابط التحميل: ${product.link}`;
            return ctx.reply(msg, { parse_mode: 'Markdown' });
        }
    }
    
    const welcome = `🎉 *مرحباً ${ctx.from.first_name} في متجر IDLEB X!*\n\n💰 رصيدك: ${formatPrice(users[userId].balance)}\n🆔 كود دعوتك: \`${users[userId].referralCode}\`\n\n📌 استخدم الأزرار أدناه للتنقل.`;
    
    if (isAdmin(userId)) {
        await ctx.reply(welcome + '\n\n🔧 *لوحة تحكم المشرف*', { parse_mode: 'Markdown', ...adminMainMenu() });
    } else {
        await ctx.reply(welcome, { parse_mode: 'Markdown', ...userMainMenu() });
    }
});

// ==================== رجوع ====================
bot.hears('🔙 رجوع', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const msg = `🎉 مرحباً\n💰 رصيدك: ${formatPrice(user.balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(msg + '\n\n🔧 *لوحة تحكم المشرف*', { parse_mode: 'Markdown', ...adminMainMenu() });
    } else {
        await ctx.reply(msg, { parse_mode: 'Markdown', ...userMainMenu() });
    }
});

// ==================== لوحة تحكم المشرف ====================
bot.hears('📦 المنتجات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply('📦 *إدارة المنتجات*\nاختر الإجراء:', { parse_mode: 'Markdown', ...productsAdminMenu() });
});

bot.hears('👥 المستخدمين', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply('👥 *إدارة المستخدمين*\nاختر الإجراء:', { parse_mode: 'Markdown', ...usersAdminMenu() });
});

bot.hears('🏷️ الكوبونات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply('🏷️ *إدارة الكوبونات*\nاختر الإجراء:', { parse_mode: 'Markdown', ...couponsAdminMenu() });
});

bot.hears('💰 الأرباح', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
    const totalSales = products.reduce((s, p) => s + (p.sales || 0), 0);
    await ctx.reply(`💰 *الأرباح والإيرادات*\n\n📊 إجمالي المبيعات: ${totalSales}\n💵 إجمالي الإيرادات: ${formatPrice(totalRevenue)}`, { parse_mode: 'Markdown' });
});

bot.hears('📢 إعلان', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    broadcasting[ctx.from.id] = true;
    await ctx.reply("📢 *إرسال إعلان لجميع المستخدمين*\n\nأرسل الرسالة التي تريد بثها (نص فقط):", { parse_mode: 'Markdown' });
});

bot.hears('📊 إحصائيات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const totalUsers = Object.keys(users).length;
    const totalProducts = products.length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
    const totalCoupons = coupons.length;
    
    const msg = `📊 *إحصائيات المتجر*\n\n👥 المستخدمين: ${totalUsers}\n📦 المنتجات: ${totalProducts}\n🛒 الطلبات: ${totalOrders}\n💰 الإيرادات: ${formatPrice(totalRevenue)}\n🏷️ الكوبونات: ${totalCoupons}`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.hears('⚙️ الإعدادات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply(`⚙️ *الإعدادات*\n\n🆔 معرف المشرف: ${ADMIN_ID}\n🤖 اسم البوت: @${BOT_NAME}\n📦 عدد المنتجات: ${products.length}\n👥 عدد المستخدمين: ${Object.keys(users).length}\n\nللتعديل، قم بتغيير متغيرات البيئة في Render.`, { parse_mode: 'Markdown' });
});

bot.hears('💾 نسخ احتياطي', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const backup = { products, users, coupons, orders, timestamp: Date.now() };
    const backupJson = JSON.stringify(backup, null, 2);
    const backupBuffer = Buffer.from(backupJson, 'utf-8');
    await ctx.replyWithDocument({ source: backupBuffer, filename: `idlebx-backup-${Date.now()}.json` });
});

// ==================== إضافة منتج (خطوات سهلة) ====================
bot.action('admin_add_product', async (ctx) => {
    addingProduct[ctx.from.id] = { step: 'name' };
    await ctx.editMessageText("➕ *إضافة منتج جديد - الخطوة 1/7*\n\nأرسل *اسم المنتج*:", { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== تعديل منتج ====================
bot.action('admin_edit_product', async (ctx) => {
    if (products.length === 0) {
        await ctx.editMessageText("❌ لا توجد منتجات للتعديل");
        return;
    }
    
    let msg = "✏️ *اختر المنتج للتعديل:*\n\n";
    const btns = [];
    for (const p of products.slice(0, 20)) {
        msg += `📦 *${p.id}.* ${p.name}\n`;
        btns.push([Markup.button.callback(`${p.id}. ${p.name.substring(0, 25)}`, `edit_select_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'admin_back')]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    await ctx.answerCbQuery();
});

bot.action(/edit_select_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = getProduct(productId);
    if (!product) return ctx.answerCbQuery('منتج غير موجود');
    
    editingProduct[ctx.from.id] = productId;
    
    const btns = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ اسم المنتج', `edit_name_${productId}`)],
        [Markup.button.callback('💰 السعر', `edit_price_${productId}`)],
        [Markup.button.callback('🔗 رابط التحميل', `edit_link_${productId}`)],
        [Markup.button.callback('📂 القسم', `edit_category_${productId}`)],
        [Markup.button.callback('📝 الوصف', `edit_desc_${productId}`)],
        [Markup.button.callback('📊 المخزون', `edit_stock_${productId}`)],
        [Markup.button.callback('🔙 رجوع', 'admin_edit_product')]
    ]);
    
    await ctx.editMessageText(`✏️ *تعديل المنتج: ${product.name}*\n\nاختر الحقل الذي تريد تعديله:`, { parse_mode: 'Markdown', ...btns });
    await ctx.answerCbQuery();
});

bot.action(/edit_name_(\d+)/, async (ctx) => {
    await ctx.editMessageText("✏️ أرسل *الاسم الجديد* للمنتج:", { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { productId: parseInt(ctx.match[1]), field: 'name' };
    await ctx.answerCbQuery();
});

bot.action(/edit_price_(\d+)/, async (ctx) => {
    await ctx.editMessageText("💰 أرسل *السعر الجديد* (رقم فقط):", { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { productId: parseInt(ctx.match[1]), field: 'price' };
    await ctx.answerCbQuery();
});

bot.action(/edit_link_(\d+)/, async (ctx) => {
    await ctx.editMessageText("🔗 أرسل *رابط التحميل الجديد*:", { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { productId: parseInt(ctx.match[1]), field: 'link' };
    await ctx.answerCbQuery();
});

bot.action(/edit_category_(\d+)/, async (ctx) => {
    await ctx.editMessageText("📂 أرسل *القسم الجديد* (مثال: اختبار الاختراق, OSINT, VPN):", { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { productId: parseInt(ctx.match[1]), field: 'category' };
    await ctx.answerCbQuery();
});

bot.action(/edit_desc_(\d+)/, async (ctx) => {
    await ctx.editMessageText("📝 أرسل *الوصف الجديد* للمنتج:", { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { productId: parseInt(ctx.match[1]), field: 'desc' };
    await ctx.answerCbQuery();
});

bot.action(/edit_stock_(\d+)/, async (ctx) => {
    await ctx.editMessageText("📊 أرسل *المخزون الجديد* (رقم فقط):", { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { productId: parseInt(ctx.match[1]), field: 'stock' };
    await ctx.answerCbQuery();
});

// ==================== حذف منتج ====================
bot.action('admin_delete_product', async (ctx) => {
    if (products.length === 0) {
        await ctx.editMessageText("❌ لا توجد منتجات للحذف");
        return;
    }
    
    let msg = "🗑️ *اختر المنتج للحذف:*\n\n";
    const btns = [];
    for (const p of products.slice(0, 20)) {
        btns.push([Markup.button.callback(`🗑️ ${p.id}. ${p.name.substring(0, 25)}`, `delete_confirm_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'admin_back')]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    await ctx.answerCbQuery();
});

bot.action(/delete_confirm_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = getProduct(productId);
    if (!product) return ctx.answerCbQuery('منتج غير موجود');
    
    const btns = Markup.inlineKeyboard([
        [Markup.button.callback('✅ نعم، احذف', `delete_yes_${productId}`)],
        [Markup.button.callback('❌ لا، إلغاء', 'admin_delete_product')]
    ]);
    
    await ctx.editMessageText(`⚠️ *تأكيد حذف المنتج*\n\n📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\nهل أنت متأكد من حذف هذا المنتج نهائياً؟`, { parse_mode: 'Markdown', ...btns });
    await ctx.answerCbQuery();
});

bot.action(/delete_yes_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
        const deleted = products[index];
        products.splice(index, 1);
        saveProducts();
        await ctx.editMessageText(`✅ *تم حذف المنتج:* ${deleted.name}`, { parse_mode: 'Markdown' });
    }
    await ctx.answerCbQuery();
});

// ==================== عرض كل المنتجات ====================
bot.action('admin_list_products', async (ctx) => {
    if (products.length === 0) {
        await ctx.editMessageText("❌ لا توجد منتجات");
        return;
    }
    
    let msg = "📋 *جميع المنتجات*\n\n";
    for (const p of products) {
        msg += `📦 *${p.id}.* ${p.name}\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   📂 ${p.category || 'عام'}\n`;
        msg += `   📊 مخزون: ${p.stock || 999}\n`;
        msg += `   🔗 ${p.link}\n\n`;
    }
    msg += `📊 إجمالي المنتجات: ${products.length}`;
    
    const btns = Markup.inlineKeyboard([Markup.button.callback('🔙 رجوع', 'admin_back')]);
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...btns });
    await ctx.answerCbQuery();
});

// ==================== شحن رصيد ====================
bot.action('admin_charge_balance', async (ctx) => {
    chargingUser[ctx.from.id] = { step: 'userId' };
    await ctx.editMessageText("💰 *شحن رصيد مستخدم*\n\nأرسل *معرف المستخدم* (الرقم):", { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== خصم رصيد ====================
bot.action('admin_deduct_balance', async (ctx) => {
    chargingUser[ctx.from.id] = { step: 'userId', deduct: true };
    await ctx.editMessageText("💸 *خصم رصيد مستخدم*\n\nأرسل *معرف المستخدم* (الرقم):", { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== عرض المستخدمين ====================
bot.action('admin_list_users', async (ctx) => {
    const userList = Object.entries(users);
    if (userList.length === 0) {
        await ctx.editMessageText("❌ لا يوجد مستخدمين");
        return;
    }
    
    let msg = "👥 *قائمة المستخدمين*\n\n";
    for (const [id, data] of userList.slice(0, 20)) {
        msg += `🆔 \`${id}\`\n`;
        msg += `   👤 ${data.name || 'مستخدم'}\n`;
        msg += `   💰 ${formatPrice(data.balance)}\n`;
        msg += `   🛒 ${data.purchases?.length || 0} مشتريات\n\n`;
    }
    if (userList.length > 20) msg += `\n... و ${userList.length - 20} مستخدمين آخرين`;
    
    const btns = Markup.inlineKeyboard([Markup.button.callback('🔙 رجوع', 'admin_back')]);
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...btns });
    await ctx.answerCbQuery();
});

// ==================== بحث عن مستخدم ====================
bot.action('admin_search_user', async (ctx) => {
    await ctx.editMessageText("🔍 *بحث عن مستخدم*\n\nأرسل معرف المستخدم أو اسمه:", { parse_mode: 'Markdown' });
    chargingUser[ctx.from.id] = { step: 'search' };
    await ctx.answerCbQuery();
});

// ==================== إضافة كوبون ====================
bot.action('admin_add_coupon', async (ctx) => {
    addingCoupon[ctx.from.id] = { step: 'code' };
    await ctx.editMessageText("🏷️ *إضافة كوبون جديد - الخطوة 1/3*\n\nأرسل *كود الخصم* (مثال: SALE20):", { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== حذف كوبون ====================
bot.action('admin_delete_coupon', async (ctx) => {
    if (coupons.length === 0) {
        await ctx.editMessageText("❌ لا توجد كوبونات للحذف");
        return;
    }
    
    let msg = "🗑️ *اختر الكوبون للحذف:*\n\n";
    const btns = [];
    for (const c of coupons) {
        btns.push([Markup.button.callback(`🏷️ ${c.code}`, `delete_coupon_${c.code}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'admin_back')]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    await ctx.answerCbQuery();
});

bot.action(/delete_coupon_(.+)/, async (ctx) => {
    const code = ctx.match[1];
    const index = coupons.findIndex(c => c.code === code);
    if (index !== -1) {
        coupons.splice(index, 1);
        saveCoupons();
        await ctx.editMessageText(`✅ *تم حذف الكوبون:* ${code}`, { parse_mode: 'Markdown' });
    }
    await ctx.answerCbQuery();
});

// ==================== عرض الكوبونات ====================
bot.action('admin_list_coupons', async (ctx) => {
    if (coupons.length === 0) {
        await ctx.editMessageText("❌ لا توجد كوبونات");
        return;
    }
    
    let msg = "🏷️ *قائمة الكوبونات*\n\n";
    for (const c of coupons) {
        msg += `🎫 *${c.code}*\n`;
        msg += `   💰 ${c.type === 'percent' ? `${c.discount}%` : formatPrice(c.discount)}\n`;
        msg += `   📊 استخدم: ${c.uses || 0}/${c.maxUses || 999}\n\n`;
    }
    
    const btns = Markup.inlineKeyboard([Markup.button.callback('🔙 رجوع', 'admin_back')]);
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...btns });
    await ctx.answerCbQuery();
});

// ==================== رجوع للوحة المشرف ====================
bot.action('admin_back', async (ctx) => {
    await ctx.editMessageText("🔧 *لوحة تحكم المشرف*\nاختر القسم:', { parse_mode: 'Markdown', ...adminMainMenu() });
    await ctx.answerCbQuery();
});

// ==================== معالجة الرسائل النصية (إضافة/تعديل/شحن) ====================
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    // ===== إضافة منتج =====
    if (addingProduct[userId]) {
        const session = addingProduct[userId];
        
        switch(session.step) {
            case 'name':
                session.name = text;
                session.step = 'price';
                await ctx.reply(`✅ الاسم: ${text}\n\n💰 أرسل *السعر* (رقم فقط):`, { parse_mode: 'Markdown' });
                break;
            case 'price':
                const price = parseInt(text);
                if (isNaN(price)) return ctx.reply("❌ الرجاء إدخال رقم صحيح");
                session.price = price;
                session.step = 'link';
                await ctx.reply(`✅ السعر: ${formatPrice(price)}\n\n🔗 أرسل *رابط التحميل*:`, { parse_mode: 'Markdown' });
                break;
            case 'link':
                session.link = text;
                session.step = 'category';
                await ctx.reply(`✅ الرابط: ${text.substring(0, 50)}...\n\n📂 أرسل *القسم* (مثال: اختبار الاختراق, OSINT, VPN):`, { parse_mode: 'Markdown' });
                break;
            case 'category':
                session.category = text;
                session.step = 'desc';
                await ctx.reply(`✅ القسم: ${text}\n\n📝 أرسل *وصف المنتج*:`, { parse_mode: 'Markdown' });
                break;
            case 'desc':
                session.desc = text;
                session.step = 'stock';
                await ctx.reply(`✅ الوصف: ${text.substring(0, 50)}...\n\n📊 أرسل *المخزون* (رقم فقط، 999 للغير محدود):`, { parse_mode: 'Markdown' });
                break;
            case 'stock':
                const stock = parseInt(text);
                if (isNaN(stock)) return ctx.reply("❌ الرجاء إدخال رقم صحيح");
                
                const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
                const newProduct = {
                    id: newId, name: session.name, price: session.price, link: session.link,
                    category: session.category, desc: session.desc, stock: stock,
                    sales: 0, rating: 4.5, createdAt: Date.now()
                };
                products.push(newProduct);
                saveProducts();
                
                await ctx.reply(`✅ *تم إضافة المنتج بنجاح!*\n\n📦 ${session.name}\n💰 ${formatPrice(session.price)}\n🔗 رابط المشاركة: ${getShareLink(newId)}`, { parse_mode: 'Markdown' });
                delete addingProduct[userId];
                break;
        }
        return;
    }
    
    // ===== تعديل منتج =====
    if (editingProduct[userId]) {
        const edit = editingProduct[userId];
        const productId = edit.productId || edit;
        const productIndex = products.findIndex(p => p.id === productId);
        
        if (productIndex !== -1) {
            switch(edit.field) {
                case 'name':
                    products[productIndex].name = text;
                    await ctx.reply(`✅ تم تغيير الاسم إلى: ${text}`);
                    break;
                case 'price':
                    const price = parseInt(text);
                    if (!isNaN(price)) products[productIndex].price = price;
                    await ctx.reply(`✅ تم تغيير السعر إلى: ${formatPrice(products[productIndex].price)}`);
                    break;
                case 'link':
                    products[productIndex].link = text;
                    await ctx.reply(`✅ تم تغيير رابط التحميل`);
                    break;
                case 'category':
                    products[productIndex].category = text;
                    await ctx.reply(`✅ تم تغيير القسم إلى: ${text}`);
                    break;
                case 'desc':
                    products[productIndex].desc = text;
                    await ctx.reply(`✅ تم تغيير الوصف`);
                    break;
                case 'stock':
                    const stock = parseInt(text);
                    if (!isNaN(stock)) products[productIndex].stock = stock;
                    await ctx.reply(`✅ تم تغيير المخزون إلى: ${stock}`);
                    break;
            }
            saveProducts();
        }
        delete editingProduct[userId];
        return;
    }
    
    // ===== شحن/خصم رصيد =====
    if (chargingUser[userId]) {
        const session = chargingUser[userId];
        
        if (session.step === 'userId') {
            session.userId = parseInt(text);
            if (isNaN(session.userId)) {
                delete chargingUser[userId];
                return ctx.reply("❌ معرف غير صحيح");
            }
            session.step = 'amount';
            await ctx.reply(`✅ المستخدم: ${session.userId}\n\n💰 أرسل *المبلغ* (رقم فقط):`, { parse_mode: 'Markdown' });
        } else if (session.step === 'amount') {
            const amount = parseInt(text);
            if (isNaN(amount)) return ctx.reply("❌ مبلغ غير صحيح");
            
            if (!users[session.userId]) users[session.userId] = { balance: 0, purchases: [], name: "مستخدم" };
            
            if (session.deduct) {
                if (users[session.userId].balance < amount) {
                    return ctx.reply(`❌ رصيد المستخدم غير كافٍ! رصيده: ${formatPrice(users[session.userId].balance)}`);
                }
                users[session.userId].balance -= amount;
                await ctx.reply(`✅ تم خصم ${formatPrice(amount)} من المستخدم ${session.userId}`);
                await bot.telegram.sendMessage(session.userId, `⚠️ تم خصم ${formatPrice(amount)} من رصيدك\n💰 رصيدك: ${formatPrice(users[session.userId].balance)}`);
            } else {
                users[session.userId].balance += amount;
                await ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم ${session.userId}`);
                await bot.telegram.sendMessage(session.userId, `🎉 تم شحن ${formatPrice(amount)} إلى رصيدك\n💰 رصيدك: ${formatPrice(users[session.userId].balance)}`);
            }
            saveUsers();
            delete chargingUser[userId];
        }
        return;
    }
    
    // ===== إضافة كوبون =====
    if (addingCoupon[userId]) {
        const session = addingCoupon[userId];
        
        if (session.step === 'code') {
            session.code = text.toUpperCase();
            session.step = 'discount';
            await ctx.reply(`✅ الكود: ${session.code}\n\n💰 أرسل *قيمة الخصم* (رقم فقط):`, { parse_mode: 'Markdown' });
        } else if (session.step === 'discount') {
            const discount = parseInt(text);
            if (isNaN(discount)) return ctx.reply("❌ قيمة غير صحيحة");
            session.discount = discount;
            session.step = 'type';
            const btns = Markup.inlineKeyboard([
                [Markup.button.callback('نسبة مئوية (%)', 'coupon_type_percent')],
                [Markup.button.callback('قيمة ثابتة (ل.س)', 'coupon_type_fixed')]
            ]);
            await ctx.reply(`✅ الخصم: ${discount}\n\nاختر *نوع الخصم*:`, { parse_mode: 'Markdown', ...btns });
        }
        return;
    }
    
    // ===== بحث عن مستخدم =====
    if (chargingUser[userId] && chargingUser[userId].step === 'search') {
        const searchTerm = text.toLowerCase();
        const found = Object.entries(users).filter(([id, data]) => 
            id.includes(searchTerm) || data.name?.toLowerCase().includes(searchTerm)
        ).slice(0, 10);
        
        if (found.length === 0) {
            await ctx.reply("❌ لا يوجد مستخدمين مطابقين");
        } else {
            let msg = "🔍 *نتائج البحث:*\n\n";
            for (const [id, data] of found) {
                msg += `🆔 \`${id}\`\n   👤 ${data.name}\n   💰 ${formatPrice(data.balance)}\n\n`;
            }
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        delete chargingUser[userId];
        return;
    }
    
    // ===== بث إعلاني =====
    if (broadcasting[userId]) {
        let success = 0, failed = 0;
        for (const uid of Object.keys(users)) {
            try {
                await bot.telegram.sendMessage(uid, `📢 *إعلان من الإدارة*\n\n${text}`, { parse_mode: 'Markdown' });
                success++;
            } catch(e) { failed++; }
        }
        await ctx.reply(`✅ تم الإرسال إلى ${success} مستخدم\n❌ فشل: ${failed}`);
        delete broadcasting[userId];
        return;
    }
    
    // ===== قائمة المستخدمين العاديين =====
    if (!isAdmin(userId)) {
        if (text === '📦 المنتجات') {
            if (products.length === 0) return ctx.reply("لا توجد منتجات");
            let msg = "📦 *المنتجات:*\n\n";
            for (const p of products) {
                msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
            }
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        else if (text === '🔍 بحث') {
            await ctx.reply("🔍 أرسل اسم المنتج أو كلمة للبحث:");
        }
        else if (text === '🛒 سلتي') {
            const user = getUser(userId);
            const cart = user.cart || [];
            if (!cart.length) return ctx.reply("🛒 سلتك فارغة");
            let msg = "🛒 *سلتك:*\n\n";
            let total = 0;
            for (const item of cart) {
                const p = getProduct(item.id);
                if (p) {
                    msg += `📦 ${p.name} ×${item.qty} = ${formatPrice(p.price * item.qty)}\n`;
                    total += p.price * item.qty;
                }
            }
            msg += `\n💰 *المجموع:* ${formatPrice(total)}`;
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        else if (text === '🏷️ كوبونات') {
            let msg = "🏷️ *الكوبونات المتاحة:*\n\n";
            for (const c of coupons) {
                msg += `🎫 *${c.code}* - ${c.type === 'percent' ? `${c.discount}%` : formatPrice(c.discount)} خصم\n`;
            }
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        else if (text === '📤 دعوة صديق') {
            const user = getUser(userId);
            const link = `https://t.me/${BOT_NAME}?start=${userId}`;
            await ctx.reply(`📤 *رابط دعوتك:*\n\`${link}\`\n\n🎁 كل صديق ينضم عبر رابطك يربحك 5000 ل.س!`, { parse_mode: 'Markdown' });
        }
        else if (text === '💰 رصيدي') {
            const user = getUser(userId);
            await ctx.reply(`💰 *رصيدك:* ${formatPrice(user.balance)}`, { parse_mode: 'Markdown' });
        }
        else if (text === '⭐ تقييمات') {
            let msg = "⭐ *أعلى المنتجات تقييماً:*\n\n";
            const topRated = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
            for (const p of topRated) {
                msg += `📦 ${p.name} - ⭐ ${p.rating || 4.5}/5\n`;
            }
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        else if (text === '❓ مساعدة') {
            await ctx.reply(`🔧 *الأوامر المتاحة*\n\n📦 /products - عرض المنتجات\n💰 /balance - رصيدك\n🛒 /cart - سلتك\n🏷️ /coupon <كود> - تفعيل كوبون\n📤 /referral - رابط دعوتك`, { parse_mode: 'Markdown' });
        }
        else if (text.startsWith('/coupon')) {
            const code = text.split(' ')[1]?.toUpperCase();
            if (!code) return ctx.reply("⚠️ /coupon <الكود>");
            const coupon = coupons.find(c => c.code === code);
            if (!coupon) return ctx.reply("❌ كوبون غير صالح");
            const user = getUser(userId);
            user.activeCoupon = { code: coupon.code, discount: coupon.discount, type: coupon.type };
            saveUsers();
            await ctx.reply(`✅ تم تفعيل الكوبون ${code}!`);
        }
        else if (text.startsWith('/products')) {
            if (products.length === 0) return ctx.reply("لا توجد منتجات");
            let msg = "📦 *المنتجات:*\n\n";
            for (const p of products) {
                msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
            }
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        else if (text.startsWith('/balance')) {
            const user = getUser(userId);
            await ctx.reply(`💰 *رصيدك:* ${formatPrice(user.balance)}`, { parse_mode: 'Markdown' });
        }
    }
});

// ==================== أوامر سريعة للمستخدم ====================
bot.command('products', async (ctx) => {
    if (products.length === 0) return ctx.reply("لا توجد منتجات");
    let msg = "📦 *المنتجات:*\n\n";
    for (const p of products) {
        msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('balance', async (ctx) => {
    const user = getUser(ctx.from.id);
    await ctx.reply(`💰 *رصيدك:* ${formatPrice(user.balance)}`, { parse_mode: 'Markdown' });
});

bot.command('cart', async (ctx) => {
    const user = getUser(ctx.from.id);
    const cart = user.cart || [];
    if (!cart.length) return ctx.reply("🛒 سلتك فارغة");
    let msg = "🛒 *سلتك:*\n\n";
    let total = 0;
    for (const item of cart) {
        const p = getProduct(item.id);
        if (p) {
            msg += `📦 ${p.name} ×${item.qty} = ${formatPrice(p.price * item.qty)}\n`;
            total += p.price * item.qty;
        }
    }
    msg += `\n💰 *المجموع:* ${formatPrice(total)}`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('referral', async (ctx) => {
    const user = getUser(ctx.from.id);
    const link = `https://t.me/${BOT_NAME}?start=${ctx.from.id}`;
    await ctx.reply(`📤 *رابط دعوتك:*\n\`${link}\`\n\n🎁 كل صديق ينضم عبر رابطك يربحك 5000 ل.س!`, { parse_mode: 'Markdown' });
});

// ==================== API ====================
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/stats', (req, res) => res.json({ 
    products: products.length, 
    users: Object.keys(users).length,
    orders: orders.length 
}));

// ==================== تشغيل البوت ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP على منفذ ${PORT}`));

bot.launch().then(() => {
    console.log(`✅ البوت @${BOT_NAME} يعمل!`);
    console.log(`👑 المشرف: ${ADMIN_ID}`);
    console.log(`📦 المنتجات: ${products.length}`);
    console.log(`👥 المستخدمين: ${Object.keys(users).length}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
