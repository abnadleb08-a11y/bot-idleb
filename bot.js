const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ==================== الإعدادات ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not found');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

const BOT_NAME = "idlebstore_bot";

// ==================== مجلدات التخزين ====================
const PRODUCTS_FILE = 'products.json';
const USERS_FILE = 'users.json';
const FILES_DIR = path.join(__dirname, 'files');
const APPS_DIR = path.join(__dirname, 'apps');

// إنشاء المجلدات إذا لم توجد
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
if (!fs.existsSync(APPS_DIR)) fs.mkdirSync(APPS_DIR, { recursive: true });

// ==================== تحميل البيانات ====================
let products = [];
let users = {};

if (fs.existsSync(PRODUCTS_FILE)) products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
else fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE));
else fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const saveProducts = () => fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const formatPrice = (p) => p.toLocaleString('ar-SY') + " SYP";
const isAdmin = (id) => id === ADMIN_ID;
const getShareLink = (id) => `https://t.me/${BOT_NAME}?start=product_${id}`;

// ==================== دوال مساعدة ====================
const getUser = (id) => {
    if (!users[id]) {
        users[id] = { 
            balance: 0, purchases: [], name: "User", 
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            cart: [], createdAt: Date.now()
        };
        saveUsers();
    }
    return users[id];
};

const getProduct = (id) => products.find(p => p.id === id);

// ==================== عرض المحتوى حسب نوع المنتج ====================
function getProductContent(product) {
    switch(product.type) {
        case 'link':
            return `🔗 *رابط التحميل:*\n${product.content}`;
        case 'file':
            return `📁 *ملف التحميل:*\nتم حفظ الملف في البوت\n🆔 معرف الملف: \`${product.fileId}\``;
        case 'app':
            return `📱 *تطبيق:*\nتم حفظ التطبيق في البوت\n🆔 معرف التطبيق: \`${product.fileId}\``;
        case 'text':
            return `📝 *المحتوى:*\n${product.content}`;
        default:
            return `🔗 *رابط التحميل:*\n${product.content}`;
    }
}

// ==================== أزرار المشرف ====================
const adminMenu = () => Markup.keyboard([
    ['➕ إضافة منتج', '📦 المنتجات', '🗑️ حذف منتج'],
    ['💰 شحن رصيد', '👥 المستخدمين', '📊 إحصائيات'],
    ['📤 تصدير البيانات', '🔙 رجوع']
]).resize();

const userMenu = () => Markup.keyboard([
    ['📦 المنتجات', '💰 رصيدي', '🛒 سلتي'],
    ['🏷️ كوبونات', '📤 دعوة صديق', '❓ مساعدة']
]).resize();

// ==================== تخزين جلسات الإضافة ====================
let addingProduct = {};

// ==================== بدء البوت ====================
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId);
    
    const welcome = `🎉 مرحباً ${ctx.from.first_name} في متجر IDLEB X!\n\n💰 رصيدك: ${formatPrice(users[userId].balance)}\n🆔 كود دعوتك: ${users[userId].referralCode}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(welcome + '\n\n🔧 *لوحة تحكم المشرف*', { parse_mode: 'Markdown', ...adminMenu() });
    } else {
        await ctx.reply(welcome, { parse_mode: 'Markdown', ...userMenu() });
    }
});

// ==================== رجوع ====================
bot.hears('🔙 رجوع', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const msg = `🎉 مرحباً\n💰 رصيدك: ${formatPrice(user.balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(msg + '\n\n🔧 *لوحة تحكم المشرف*', { parse_mode: 'Markdown', ...adminMenu() });
    } else {
        await ctx.reply(msg, { parse_mode: 'Markdown', ...userMenu() });
    }
});

// ==================== إضافة منتج - اختيار النوع ====================
bot.hears('➕ إضافة منتج', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const typeBtns = Markup.inlineKeyboard([
        [Markup.button.callback('🔗 رابط (Link)', 'add_type_link')],
        [Markup.button.callback('📁 ملف (File Upload)', 'add_type_file')],
        [Markup.button.callback('📱 تطبيق (App Upload)', 'add_type_app')],
        [Markup.button.callback('📝 نص (Text)', 'add_type_text')]
    ]);
    
    await ctx.reply('📝 *اختر نوع المنتج:*', { parse_mode: 'Markdown', ...typeBtns });
});

// ==================== معالج اختيار النوع ====================
bot.action(/add_type_(.+)/, async (ctx) => {
    const prodType = ctx.match[1];
    const userId = ctx.from.id;
    
    addingProduct[userId] = { type: prodType, step: 'name' };
    
    const typeNames = { link: 'رابط', file: 'ملف', app: 'تطبيق', text: 'نص' };
    await ctx.editMessageText(`✅ نوع المنتج: ${typeNames[prodType]}\n\n📝 أرسل *اسم المنتج*:`, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== معالجة إضافة المنتج (نصي) ====================
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const session = addingProduct[userId];
    
    if (!session || !isAdmin(userId)) return;
    if (ctx.message.text.startsWith('/')) return;
    
    const text = ctx.message.text;
    
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
            
            if (session.type === 'link' || session.type === 'text') {
                session.step = 'content';
                const prompt = session.type === 'link' ? '🔗 أرسل *الرابط*:' : '📝 أرسل *المحتوى النصي*:';
                await ctx.reply(`✅ السعر: ${formatPrice(price)}\n\n${prompt}`, { parse_mode: 'Markdown' });
            } else if (session.type === 'file') {
                session.step = 'waiting_file';
                await ctx.reply(`✅ السعر: ${formatPrice(price)}\n\n📁 *ارفع الملف* (أي نوع ملف)\n\nيمكنك رفع: PDF, ZIP, RAR, DOC, EXE, إلخ`, { parse_mode: 'Markdown' });
            } else if (session.type === 'app') {
                session.step = 'waiting_file';
                await ctx.reply(`✅ السعر: ${formatPrice(price)}\n\n📱 *ارفع ملف APK للتطبيق*\n\n⚠️ يرجى رفع ملف بصيغة .apk فقط`, { parse_mode: 'Markdown' });
            }
            break;
            
        case 'content':
            session.content = text;
            session.step = 'category';
            await ctx.reply(`✅ المحتوى: ${text.substring(0, 50)}...\n\n📂 أرسل *القسم*:`, { parse_mode: 'Markdown' });
            break;
            
        case 'category':
            session.category = text;
            session.step = 'desc';
            await ctx.reply(`✅ القسم: ${text}\n\n📝 أرسل *وصف المنتج*:`, { parse_mode: 'Markdown' });
            break;
            
        case 'desc':
            session.desc = text;
            session.step = 'stock';
            await ctx.reply(`✅ الوصف: ${text.substring(0, 50)}...\n\n📊 أرسل *المخزون* (رقم فقط):`, { parse_mode: 'Markdown' });
            break;
            
        case 'stock':
            const stock = parseInt(text);
            if (isNaN(stock)) return ctx.reply("❌ الرجاء إدخال رقم صحيح");
            
            const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
            const newProduct = {
                id: newId,
                name: session.name,
                price: session.price,
                type: session.type,
                content: session.content || null,
                fileId: session.fileId || null,
                fileName: session.fileName || null,
                category: session.category,
                desc: session.desc,
                stock: stock,
                sales: 0,
                rating: 4.5,
                createdAt: Date.now()
            };
            
            products.push(newProduct);
            saveProducts();
            
            const typeIcon = { link: '🔗', file: '📁', app: '📱', text: '📝' }[session.type];
            await ctx.reply(`✅ *تم إضافة المنتج بنجاح!*\n\n${typeIcon} ${session.name}\n💰 ${formatPrice(session.price)}\n📂 ${session.category}\n📊 المخزون: ${stock}\n\n🔗 رابط المشاركة: ${getShareLink(newId)}`, { parse_mode: 'Markdown' });
            
            delete addingProduct[userId];
            break;
    }
});

// ==================== معالجة رفع الملفات (صور، ملفات، APK) ====================
bot.on('document', async (ctx) => {
    const userId = ctx.from.id;
    const session = addingProduct[userId];
    
    if (!session || !isAdmin(userId)) return;
    if (session.step !== 'waiting_file') return;
    
    const file = ctx.message.document;
    const fileId = file.file_id;
    const fileName = file.file_name;
    const fileSize = file.file_size;
    
    // التحقق من نوع الملف للتطبيقات
    if (session.type === 'app' && !fileName.endsWith('.apk')) {
        return ctx.reply("❌ يرجى رفع ملف بصيغة .apk فقط للتطبيقات");
    }
    
    session.fileId = fileId;
    session.fileName = fileName;
    session.content = null;
    session.step = 'category';
    
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    await ctx.reply(`✅ تم استلام الملف: ${fileName}\n📦 الحجم: ${fileSizeMB} MB\n\n📂 أرسل *القسم*:`, { parse_mode: 'Markdown' });
});

// ==================== عرض المنتجات ====================
bot.hears('📦 المنتجات', async (ctx) => {
    if (products.length === 0) return ctx.reply("لا توجد منتجات");
    
    let msg = "📦 *المنتجات:*\n\n";
    const btns = [];
    for (const p of products.slice(0, 20)) {
        const icon = { link: '🔗', file: '📁', app: '📱', text: '📝' }[p.type] || '📦';
        msg += `${icon} *${p.id}.* ${p.name}\n   💰 ${formatPrice(p.price)}\n   📂 ${p.category}\n\n`;
        btns.push([Markup.button.callback(`${icon} ${p.id}. ${p.name.substring(0, 20)}`, `view_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'main_back')]);
    
    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

// ==================== عرض منتج معين ====================
bot.action(/view_(\d+)/, async (ctx) => {
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.answerCbQuery('منتج غير موجود');
    
    const icon = { link: '🔗', file: '📁', app: '📱', text: '📝' }[product.type] || '📦';
    let msg = `${icon} *${product.name}*\n💰 ${formatPrice(product.price)}\n📂 ${product.category}\n⭐ ${product.rating}/5\n📝 ${product.desc}\n📊 المخزون: ${product.stock}\n\n`;
    
    if (product.type === 'link') {
        msg += `🔗 *رابط التحميل:*\n${product.content}`;
    } else if (product.type === 'file') {
        msg += `📁 *ملف التحميل:*\n🆔 معرف الملف: \`${product.fileId}\``;
    } else if (product.type === 'app') {
        msg += `📱 *تطبيق:*\n📄 اسم الملف: ${product.fileName}\n🆔 معرف الملف: \`${product.fileId}\``;
    } else if (product.type === 'text') {
        msg += `📝 *المحتوى:*\n${product.content}`;
    }
    
    const btns = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 شراء', `buy_${product.id}`)],
        [Markup.button.callback('📤 مشاركة', `share_${product.id}`)],
        [Markup.button.callback('🔙 رجوع', 'products_back')]
    ]);
    
    if (ctx.callbackQuery) {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...btns });
        await ctx.answerCbQuery();
    } else {
        await ctx.reply(msg, { parse_mode: 'Markdown', ...btns });
    }
});

// ==================== شراء منتج ====================
bot.action(/buy_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const product = getProduct(parseInt(ctx.match[1]));
    
    if (!product) return ctx.answerCbQuery('منتج غير موجود');
    
    const user = getUser(userId);
    
    if (user.balance < product.price) {
        return ctx.answerCbQuery(`❌ رصيدك غير كافٍ! رصيدك: ${user.balance}`, true);
    }
    
    user.balance -= product.price;
    user.purchases.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        date: new Date().toISOString(),
        type: product.type,
        content: product.content,
        fileId: product.fileId,
        fileName: product.fileName
    });
    
    product.stock--;
    product.sales++;
    saveProducts();
    saveUsers();
    
    let msg = `✅ *تم شراء ${product.name} بنجاح!*\n💰 رصيدك: ${formatPrice(user.balance)}\n\n`;
    
    if (product.type === 'link') {
        msg += `🔗 *رابط التحميل:*\n${product.content}`;
    } else if (product.type === 'file') {
        msg += `📁 *ملف التحميل:*\n🆔 معرف الملف: \`${product.fileId}\``;
        // إرسال الملف مباشرة
        try {
            await ctx.replyWithDocument(product.fileId);
        } catch(e) {}
    } else if (product.type === 'app') {
        msg += `📱 *التطبيق:*\n📄 ${product.fileName}\n🆔 معرف الملف: \`${product.fileId}\``;
        try {
            await ctx.replyWithDocument(product.fileId);
        } catch(e) {}
    } else if (product.type === 'text') {
        msg += `📝 *المحتوى:*\n${product.content}`;
    }
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('✅ تم الشراء');
});

// ==================== مشاركة منتج ====================
bot.action(/share_(\d+)/, async (ctx) => {
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.answerCbQuery('منتج غير موجود');
    
    const link = getShareLink(product.id);
    await ctx.reply(`📤 *رابط مشاركة ${product.name}*\n\n🔗 \`${link}\``, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ==================== رجوع ====================
bot.action('products_back', async (ctx) => {
    if (products.length === 0) return ctx.editMessageText("لا توجد منتجات");
    
    let msg = "📦 *المنتجات:*\n\n";
    const btns = [];
    for (const p of products.slice(0, 20)) {
        const icon = { link: '🔗', file: '📁', app: '📱', text: '📝' }[p.type] || '📦';
        msg += `${icon} *${p.id}.* ${p.name}\n   💰 ${formatPrice(p.price)}\n\n`;
        btns.push([Markup.button.callback(`${icon} ${p.id}. ${p.name.substring(0, 20)}`, `view_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'main_back')]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    await ctx.answerCbQuery();
});

bot.action('main_back', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const msg = `🎉 مرحباً\n💰 رصيدك: ${formatPrice(user.balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.editMessageText(msg + '\n\n🔧 *لوحة تحكم المشرف*', { parse_mode: 'Markdown', ...adminMenu() });
    } else {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...userMenu() });
    }
    await ctx.answerCbQuery();
});

// ==================== حذف منتج ====================
bot.hears('🗑️ حذف منتج', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    if (products.length === 0) return ctx.reply("لا توجد منتجات للحذف");
    
    let msg = "🗑️ *اختر المنتج للحذف:*\n\n";
    for (const p of products) {
        const icon = { link: '🔗', file: '📁', app: '📱', text: '📝' }[p.type] || '📦';
        msg += `${icon} /del_${p.id} - ${p.name}\n`;
    }
    msg += `\nأرسل: /del_1 لحذف المنتج رقم 1`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command(/del_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const id = parseInt(ctx.match[1]);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return ctx.reply("منتج غير موجود");
    
    const deleted = products[index];
    products.splice(index, 1);
    saveProducts();
    
    await ctx.reply(`✅ *تم حذف المنتج:* ${deleted.name}`, { parse_mode: 'Markdown' });
});

// ==================== شحن رصيد ====================
bot.hears('💰 شحن رصيد', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply("💰 *شحن رصيد مستخدم*\n\nأرسل: `/charge 123456789 50000`", { parse_mode: 'Markdown' });
});

bot.command(/charge (\d+) (\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    
    if (!users[userId]) users[userId] = { balance: 0, purchases: [], name: "User" };
    users[userId].balance += amount;
    saveUsers();
    
    await ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم ${userId}`);
    try {
        await bot.telegram.sendMessage(userId, `🎉 تم شحن رصيدك بمبلغ ${formatPrice(amount)}`);
    } catch(e) {}
});

// ==================== عرض المستخدمين ====================
bot.hears('👥 المستخدمين', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userList = Object.entries(users).slice(0, 20);
    if (userList.length === 0) return ctx.reply("لا يوجد مستخدمين");
    
    let msg = "👥 *المستخدمين:*\n\n";
    for (const [id, data] of userList) {
        msg += `🆔 \`${id}\`\n   👤 ${data.name}\n   💰 ${formatPrice(data.balance)}\n   🛒 ${data.purchases?.length || 0} مشتريات\n\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== إحصائيات ====================
bot.hears('📊 إحصائيات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const totalUsers = Object.keys(users).length;
    const totalProducts = products.length;
    const totalSales = products.reduce((s, p) => s + (p.sales || 0), 0);
    const totalRevenue = products.reduce((s, p) => s + ((p.price || 0) * (p.sales || 0)), 0);
    
    const linkCount = products.filter(p => p.type === 'link').length;
    const fileCount = products.filter(p => p.type === 'file').length;
    const appCount = products.filter(p => p.type === 'app').length;
    const textCount = products.filter(p => p.type === 'text').length;
    
    const msg = `📊 *إحصائيات المتجر*\n\n👥 المستخدمين: ${totalUsers}\n📦 المنتجات: ${totalProducts}\n   🔗 رابط: ${linkCount}\n   📁 ملف: ${fileCount}\n   📱 تطبيق: ${appCount}\n   📝 نص: ${textCount}\n🛒 المبيعات: ${totalSales}\n💰 الإيرادات: ${formatPrice(totalRevenue)}`;
    
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== تصدير البيانات ====================
bot.hears('📤 تصدير البيانات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const backup = { products, users, timestamp: Date.now() };
    const backupJson = JSON.stringify(backup, null, 2);
    const backupBuffer = Buffer.from(backupJson, 'utf-8');
    await ctx.replyWithDocument({ source: backupBuffer, filename: `idlebx-backup-${Date.now()}.json` });
});

// ==================== رصيدي ====================
bot.hears('💰 رصيدي', async (ctx) => {
    const user = getUser(ctx.from.id);
    await ctx.reply(`💰 *رصيدك:* ${formatPrice(user.balance)}`, { parse_mode: 'Markdown' });
});

// ==================== سلتي ====================
bot.hears('🛒 سلتي', async (ctx) => {
    const user = getUser(ctx.from.id);
    const cart = user.cart || [];
    if (cart.length === 0) return ctx.reply("🛒 سلتك فارغة");
    
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

// ==================== كوبونات ====================
bot.hears('🏷️ كوبونات', async (ctx) => {
    await ctx.reply("🏷️ أرسل كود الخصم: /coupon <الكود>", { parse_mode: 'Markdown' });
});

bot.command('coupon', async (ctx) => {
    await ctx.reply("⚠️ نظام الكوبونات قيد التطوير");
});

// ==================== دعوة صديق ====================
bot.hears('📤 دعوة صديق', async (ctx) => {
    const user = getUser(ctx.from.id);
    const link = `https://t.me/${BOT_NAME}?start=${ctx.from.id}`;
    await ctx.reply(`📤 *رابط دعوتك:*\n\`${link}\`\n\n🎁 كل صديق ينضم عبر رابطك يربحك 5000 SYP!`, { parse_mode: 'Markdown' });
});

// ==================== مساعدة ====================
bot.hears('❓ مساعدة', async (ctx) => {
    await ctx.reply(`🔧 *الأوامر المتاحة*\n\n📦 /products - عرض المنتجات\n💰 /balance - رصيدك\n🛒 /cart - سلتك\n🏷️ /coupon <كود> - تفعيل كوبون\n📤 /referral - رابط دعوتك\n\nللمشرف:\n/addproduct - إضافة منتج\n/del_1 - حذف منتج\n/charge - شحن رصيد`, { parse_mode: 'Markdown' });
});

// ==================== أوامر سريعة ====================
bot.command('products', async (ctx) => {
    if (products.length === 0) return ctx.reply("لا توجد منتجات");
    let msg = "📦 *المنتجات:*\n\n";
    for (const p of products) {
        const icon = { link: '🔗', file: '📁', app: '📱', text: '📝' }[p.type] || '📦';
        msg += `${icon} *${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
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
    if (cart.length === 0) return ctx.reply("🛒 سلتك فارغة");
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
    await ctx.reply(`📤 *رابط دعوتك:*\n\`${link}\``, { parse_mode: 'Markdown' });
});

// ==================== API للموقع ====================
app.get('/api/products', (req, res) => res.json(products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    type: p.type,
    category: p.category,
    desc: p.desc,
    stock: p.stock
}))));

app.get('/api/stats', (req, res) => res.json({ 
    products: products.length, 
    users: Object.keys(users).length,
    types: {
        link: products.filter(p => p.type === 'link').length,
        file: products.filter(p => p.type === 'file').length,
        app: products.filter(p => p.type === 'app').length,
        text: products.filter(p => p.type === 'text').length
    }
}));

// ==================== تشغيل البوت ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP على منفذ ${PORT}`));

bot.launch().then(() => {
    console.log(`✅ البوت @${BOT_NAME} يعمل!`);
    console.log(`👑 المشرف: ${ADMIN_ID}`);
    console.log(`📦 المنتجات: ${products.length}`);
    console.log(`👥 المستخدمين: ${Object.keys(users).length}`);
}).catch((err) => {
    console.error('❌ فشل تشغيل البوت:', err.message);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
