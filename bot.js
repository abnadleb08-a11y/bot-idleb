const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ==================== الإعدادات الأساسية ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN) {
    console.error('❌ خطأ: BOT_TOKEN غير موجود');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// اسم البوت (غير هذا لاسم بوتك بدون @)
const BOT_NAME = "idlebstore_bot";

// ==================== ملفات التخزين ====================
const PRODUCTS_FILE = 'products.json';
const USERS_FILE = 'users.json';

// تحميل المنتجات
let products = [];
if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
} else {
    products = [
        { id: 1, name: "Kali Linux Pro Kit", price: 450000, link: "https://t.me/your_channel/kali", desc: "أداة اختبار الاختراق", category: "اختبار الاختراق", stock: 999 },
        { id: 2, name: "Burp Suite Pro", price: 1250000, link: "https://t.me/your_channel/burp", desc: "رخصة سنة كاملة", category: "اختبار الاختراق", stock: 25 },
        { id: 3, name: "OSINT Master", price: 320000, link: "https://t.me/your_channel/osint", desc: "50 أداة OSINT", category: "OSINT", stock: 999 }
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// تحميل المستخدمين
let users = {};
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
}

// ==================== دوال مساعدة ====================
function saveProducts() {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function formatPrice(p) {
    return p.toLocaleString('ar-SY') + " ل.س";
}

function isAdmin(userId) {
    return userId === ADMIN_ID;
}

function getProductLink(productId) {
    return `https://t.me/${BOT_NAME}?start=product_${productId}`;
}

// ==================== واجهة المنتج ====================
function productKeyboard(product) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🛒 شراء الآن', `buy_${product.id}`),
            Markup.button.callback('📤 مشاركة', `share_${product.id}`)
        ],
        [
            Markup.button.url('📥 رابط التحميل', product.link),
            Markup.button.callback('🔙 رجوع', 'products')
        ]
    ]);
}

function mainKeyboard() {
    return Markup.keyboard([
        ['📦 المنتجات', '💰 رصيدي'],
        ['🛒 مشترياتي', '📤 رابط المنتج'],
        ['❓ مساعدة']
    ]).resize();
}

function adminKeyboard() {
    return Markup.keyboard([
        ['➕ إضافة منتج', '✏️ تعديل منتج'],
        ['🗑️ حذف منتج', '📋 كل المنتجات'],
        ['💰 شحن رصيد', '👥 المستخدمين'],
        ['📊 إحصائيات', '🔙 رجوع']
    ]).resize();
}

// ==================== أوامر البوت ====================

// بدء البوت
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name;
    
    if (!users[userId]) {
        users[userId] = {
            balance: 0,
            purchases: [],
            name: userName,
            username: ctx.from.username,
            date: new Date().toISOString()
        };
        saveUsers();
    }
    
    // التحقق من رابط المنتج
    const text = ctx.message.text;
    if (text.includes('start=product_')) {
        const productId = parseInt(text.split('product_')[1]);
        const product = products.find(p => p.id === productId);
        if (product) {
            const msg = `📦 *${product.name}*\n\n💰 *السعر:* ${formatPrice(product.price)}\n📂 *القسم:* ${product.category}\n📝 *الوصف:* ${product.desc}\n📊 *المخزون:* ${product.stock}\n\n🔗 *رابط التحميل:* ${product.link}`;
            return ctx.reply(msg, { parse_mode: 'Markdown', ...productKeyboard(product) });
        }
    }
    
    const welcomeMsg = `🎉 *مرحباً بك يا ${userName} في متجر IDLEB X!*\n\n💰 رصيدك الحالي: ${formatPrice(users[userId].balance)}\n\n📌 استخدم الأزرار أدناه للتنقل في المتجر.`;
    
    if (isAdmin(userId)) {
        await ctx.reply(welcomeMsg + '\n\n🔧 *أنت مشرف* 🔧', { parse_mode: 'Markdown', ...adminKeyboard() });
    } else {
        await ctx.reply(welcomeMsg, { parse_mode: 'Markdown', ...mainKeyboard() });
    }
});

// عرض المنتجات
bot.hears('📦 المنتجات', async (ctx) => {
    if (products.length === 0) {
        return ctx.reply("📦 لا توجد منتجات حالياً.");
    }
    
    let msg = "📦 *قائمة المنتجات:*\n\n";
    const buttons = [];
    
    for (const p of products) {
        msg += `*${p.id}.* ${p.name}\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   📂 ${p.category}\n\n`;
        buttons.push([Markup.button.callback(`${p.id}. ${p.name.substring(0, 25)}`, `view_${p.id}`)]);
    }
    
    buttons.push([Markup.button.callback('🔙 القائمة الرئيسية', 'main')]);
    
    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});

// عرض منتج معين
bot.action(/view_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery('❌ المنتج غير موجود');
        return;
    }
    
    const msg = `📦 *${product.name}*\n\n💰 *السعر:* ${formatPrice(product.price)}\n📂 *القسم:* ${product.category}\n📝 *الوصف:* ${product.desc}\n📊 *المخزون:* ${product.stock}\n\n🔗 *رابط التحميل:* ${product.link}`;
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...productKeyboard(product) });
    await ctx.answerCbQuery();
});

// شراء منتج
bot.action(/buy_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery('❌ المنتج غير موجود');
        return;
    }
    
    if (!users[userId]) {
        users[userId] = { balance: 0, purchases: [], name: ctx.from.first_name };
        saveUsers();
    }
    
    if (users[userId].balance < product.price) {
        await ctx.answerCbQuery(`❌ رصيدك غير كافٍ! رصيدك: ${users[userId].balance}`, true);
        return;
    }
    
    // عملية الشراء
    users[userId].balance -= product.price;
    users[userId].purchases.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        date: new Date().toISOString(),
        link: product.link
    });
    
    if (product.stock > 0) product.stock--;
    saveProducts();
    saveUsers();
    
    const successMsg = `✅ *تم شراء ${product.name} بنجاح!*\n\n💰 الرصيد المتبقي: ${formatPrice(users[userId].balance)}\n\n📥 *رابط التحميل:*\n${product.link}\n\n⚠️ هذا الرابط خاص بك، لا تشاركه مع أحد.`;
    
    await ctx.editMessageText(successMsg, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('✅ تم الشراء بنجاح!');
});

// مشاركة منتج
bot.action(/share_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery('❌ المنتج غير موجود');
        return;
    }
    
    const shareLink = getProductLink(product.id);
    const msg = `📤 *رابط مشاركة المنتج: ${product.name}*\n\n🔗 \`${shareLink}\`\n\n✨ *ملاحظة:* من يضغط على هذا الرابط يصل مباشرة للمنتج.`;
    
    await ctx.reply(msg, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// رجوع للمنتجات
bot.action('products', async (ctx) => {
    if (products.length === 0) {
        await ctx.editMessageText("📦 لا توجد منتجات.");
        return;
    }
    
    let msg = "📦 *قائمة المنتجات:*\n\n";
    const buttons = [];
    
    for (const p of products) {
        msg += `*${p.id}.* ${p.name}\n   💰 ${formatPrice(p.price)}\n   📂 ${p.category}\n\n`;
        buttons.push([Markup.button.callback(`${p.id}. ${p.name.substring(0, 25)}`, `view_${p.id}`)]);
    }
    
    buttons.push([Markup.button.callback('🔙 القائمة الرئيسية', 'main')]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    await ctx.answerCbQuery();
});

// القائمة الرئيسية
bot.action('main', async (ctx) => {
    const userId = ctx.from.id;
    const msg = `🎉 *مرحباً بك في متجر IDLEB X!*\n\n💰 رصيدك: ${formatPrice(users[userId]?.balance || 0)}`;
    
    if (isAdmin(userId)) {
        await ctx.editMessageText(msg + '\n\n🔧 *أنت مشرف* 🔧', { parse_mode: 'Markdown', ...adminKeyboard() });
    } else {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...mainKeyboard() });
    }
    await ctx.answerCbQuery();
});

// عرض الرصيد
bot.hears('💰 رصيدي', async (ctx) => {
    const userId = ctx.from.id;
    const balance = users[userId]?.balance || 0;
    await ctx.reply(`💰 *رصيدك الحالي:* ${formatPrice(balance)}`, { parse_mode: 'Markdown' });
});

// عرض المشتريات
bot.hears('🛒 مشترياتي', async (ctx) => {
    const userId = ctx.from.id;
    const user = users[userId];
    
    if (!user || !user.purchases || user.purchases.length === 0) {
        return ctx.reply("📦 لم تقم بشراء أي منتج بعد.");
    }
    
    let msg = "🛒 *مشترياتك:*\n\n";
    user.purchases.forEach((p, i) => {
        msg += `${i + 1}. *${p.productName}*\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   📅 ${new Date(p.date).toLocaleDateString('ar-SY')}\n`;
        msg += `   🔗 ${p.link}\n\n`;
    });
    
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// رابط المنتج
bot.hears('📤 رابط المنتج', async (ctx) => {
    let msg = "📤 *اختر المنتج للحصول على رابط المشاركة:*\n\n";
    products.forEach(p => {
        msg += `*/share_${p.id}* - ${p.name}\n`;
    });
    msg += `\nأرسل: /share_1 للحصول على رابط المنتج رقم 1`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// أوامر رابط المشاركة لكل منتج
products.forEach(p => {
    bot.command(`share_${p.id}`, async (ctx) => {
        const shareLink = getProductLink(p.id);
        const msg = `📤 *رابط مشاركة ${p.name}*\n\n🔗 \`${shareLink}\`\n\n💰 السعر: ${formatPrice(p.price)}\n\n✨ اضغط على الرابط وانسخه، ثم أرسله لأي شخص.`;
        await ctx.reply(msg, { parse_mode: 'Markdown' });
    });
});

// مساعدة
bot.hears('❓ مساعدة', async (ctx) => {
    const msg = `🔧 *قائمة الأوامر:*\n\n📦 /products - عرض جميع المنتجات\n💰 /balance - عرض رصيدك\n🛒 /purchases - عرض مشترياتك\n📤 /share_1 - رابط مشاركة المنتج رقم 1\n🔗 /link_1 - رابط تحميل المنتج رقم 1\n\n🛒 *للشراء:* اضغط على "شراء الآن" بجانب أي منتج.`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// أوامر سريعة
bot.command('products', async (ctx) => {
    if (products.length === 0) return ctx.reply("📦 لا توجد منتجات.");
    
    let msg = "📦 *قائمة المنتجات:*\n\n";
    for (const p of products) {
        msg += `*${p.id}.* ${p.name}\n   💰 ${formatPrice(p.price)}\n   📂 ${p.category}\n\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('balance', async (ctx) => {
    const userId = ctx.from.id;
    const balance = users[userId]?.balance || 0;
    await ctx.reply(`💰 *رصيدك:* ${formatPrice(balance)}`, { parse_mode: 'Markdown' });
});

bot.command('purchases', async (ctx) => {
    const userId = ctx.from.id;
    const user = users[userId];
    
    if (!user || !user.purchases || user.purchases.length === 0) {
        return ctx.reply("📦 لم تشترِ أي منتج بعد.");
    }
    
    let msg = "🛒 *مشترياتك:*\n\n";
    user.purchases.forEach((p, i) => {
        msg += `${i + 1}. ${p.productName} - ${formatPrice(p.price)}\n`;
        msg += `   📅 ${new Date(p.date).toLocaleDateString('ar-SY')}\n`;
    });
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== أوامر المشرف ====================

// إظهار لوحة المشرف
bot.hears('🔙 رجوع', async (ctx) => {
    const userId = ctx.from.id;
    if (isAdmin(userId)) {
        await ctx.reply('🔧 *لوحة تحكم المشرف*', { parse_mode: 'Markdown', ...adminKeyboard() });
    } else {
        await ctx.reply('🎉 *القائمة الرئيسية*', { parse_mode: 'Markdown', ...mainKeyboard() });
    }
});

// إضافة منتج
bot.hears('➕ إضافة منتج', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    ctx.reply(`📝 *إضافة منتج جديد*\n\nأرسل المعلومات بهذا التنسيق:\n\n\`\`\`\nالاسم: اسم المنتج\nالسعر: 100000\nالرابط: https://t.me/...\nالقسم: اختبار الاختراق\nالوصف: وصف المنتج\nالمخزون: 999\n\`\`\``, { parse_mode: 'Markdown' });
});

// تعديل منتج
bot.hears('✏️ تعديل منتج', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    
    let msg = "✏️ *تعديل منتج*\n\nاختر المنتج:\n\n";
    products.forEach(p => {
        msg += `${p.id}. ${p.name}\n`;
    });
    msg += `\nأرسل: /edit_1 لتعديل المنتج رقم 1`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// حذف منتج
bot.hears('🗑️ حذف منتج', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    
    let msg = "🗑️ *حذف منتج*\n\nاختر المنتج:\n\n";
    products.forEach(p => {
        msg += `${p.id}. ${p.name}\n`;
    });
    msg += `\nأرسل: /delete_1 لحذف المنتج رقم 1`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// عرض كل المنتجات للمشرف
bot.hears('📋 كل المنتجات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    
    let msg = "📋 *جميع المنتجات*\n\n";
    products.forEach(p => {
        msg += `*${p.id}. ${p.name}*\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   🔗 ${p.link}\n`;
        msg += `   📂 ${p.category}\n`;
        msg += `   📊 المخزون: ${p.stock}\n`;
        msg += `   🔗 رابط المشاركة: ${getProductLink(p.id)}\n\n`;
    });
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// شحن رصيد
bot.hears('💰 شحن رصيد', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    ctx.reply("💰 *شحن رصيد مستخدم*\n\nأرسل: `/charge 123456789 50000`\n\n(معرف المستخدم + المبلغ)", { parse_mode: 'Markdown' });
});

// عرض المستخدمين
bot.hears('👥 المستخدمين', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    
    const userList = Object.entries(users);
    if (userList.length === 0) return ctx.reply("لا يوجد مستخدمين");
    
    let msg = "👥 *قائمة المستخدمين:*\n\n";
    userList.slice(0, 30).forEach(([id, data]) => {
        msg += `🆔 \`${id}\`\n`;
        msg += `   👤 ${data.name || "بدون اسم"}\n`;
        msg += `   💰 ${formatPrice(data.balance)}\n`;
        msg += `   🛒 ${data.purchases?.length || 0} مشتريات\n\n`;
    });
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// إحصائيات
bot.hears('📊 إحصائيات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    
    const totalUsers = Object.keys(users).length;
    const totalSales = Object.values(users).reduce((sum, u) => sum + (u.purchases?.length || 0), 0);
    const totalRevenue = Object.values(users).reduce((sum, u) => {
        return sum + (u.purchases?.reduce((s, p) => s + p.price, 0) || 0);
    }, 0);
    
    const msg = `📊 *إحصائيات البوت*\n\n👥 المستخدمين: ${totalUsers}\n🛒 المبيعات: ${totalSales}\n💰 الإيرادات: ${formatPrice(totalRevenue)}\n📦 المنتجات: ${products.length}`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==================== أوامر نصية للمشرف ====================

// إضافة منتج (معالجة النص)
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) return;
    
    // إضافة منتج
    if (text.includes('الاسم:') && text.includes('السعر:')) {
        const name = text.match(/الاسم: (.*)/)?.[1];
        const price = parseInt(text.match(/السعر: (\d+)/)?.[1]);
        const link = text.match(/الرابط: (.*)/)?.[1];
        const category = text.match(/القسم: (.*)/)?.[1];
        const desc = text.match(/الوصف: (.*)/)?.[1];
        const stock = parseInt(text.match(/المخزون: (\d+)/)?.[1]) || 999;
        
        if (!name || !price || !link) {
            return ctx.reply("❌ البيانات غير مكتملة. الاسم والسعر والرابط مطلوبة.");
        }
        
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
        const newProduct = {
            id: newId,
            name: name.trim(),
            price: price,
            link: link.trim(),
            category: category || "عام",
            desc: desc || "لا يوجد وصف",
            stock: stock
        };
        
        products.push(newProduct);
        saveProducts();
        
        await ctx.reply(`✅ *تم إضافة المنتج بنجاح!*\n\n📦 ${name}\n💰 ${formatPrice(price)}\n🔗 رابط المشاركة: ${getProductLink(newId)}`, { parse_mode: 'Markdown' });
    }
});

// تعديل منتج
bot.command(/edit_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) return ctx.reply("❌ منتج غير موجود");
    
    ctx.reply(`✏️ *تعديل المنتج: ${product.name}*\n\nأرسل المعلومات الجديدة:\n\n\`\`\`\nالاسم: ${product.name}\nالسعر: ${product.price}\nالرابط: ${product.link}\nالقسم: ${product.category}\nالوصف: ${product.desc}\nالمخزون: ${product.stock}\n\`\`\``, { parse_mode: 'Markdown' });
    
    // تخزين مؤقت للمنتج الجاري تعديله
    ctx.session = ctx.session || {};
    ctx.session.editingProduct = productId;
});

// حذف منتج
bot.command(/delete_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const productId = parseInt(ctx.match[1]);
    const index = products.findIndex(p => p.id === productId);
    
    if (index === -1) return ctx.reply("❌ منتج غير موجود");
    
    const deleted = products[index];
    products.splice(index, 1);
    saveProducts();
    
    await ctx.reply(`✅ *تم حذف المنتج:* ${deleted.name}`, { parse_mode: 'Markdown' });
});

// شحن رصيد
bot.command(/charge (\d+) (\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    
    if (!users[userId]) {
        users[userId] = { balance: 0, purchases: [], name: "مستخدم جديد" };
    }
    
    users[userId].balance += amount;
    saveUsers();
    
    await ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم \`${userId}\``, { parse_mode: 'Markdown' });
    
    // إشعار المستخدم
    try {
        await bot.telegram.sendMessage(userId, `🎉 تم شحن رصيدك بمبلغ ${formatPrice(amount)}\n💰 رصيدك الحالي: ${formatPrice(users[userId].balance)}`);
    } catch(e) {}
});

// خصم رصيد
bot.command(/deduct (\d+) (\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    
    if (!users[userId]) {
        return ctx.reply("❌ المستخدم غير موجود");
    }
    
    if (users[userId].balance < amount) {
        return ctx.reply(`❌ رصيد المستخدم غير كافٍ! رصيده: ${formatPrice(users[userId].balance)}`);
    }
    
    users[userId].balance -= amount;
    saveUsers();
    
    await ctx.reply(`✅ تم خصم ${formatPrice(amount)} من المستخدم \`${userId}\``, { parse_mode: 'Markdown' });
});

// ==================== API للموقع ====================
app.get('/api/products', (req, res) => {
    res.json(products);
});

app.get('/api/product/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id);
    product ? res.json(product) : res.status(404).json({ error: "Not found" });
});

app.post('/api/purchase', async (req, res) => {
    const { userId, productId, productName, amount } = req.body;
    
    try {
        await bot.telegram.sendMessage(userId, `🛍️ طلب شراء جديد!\n\n📦 المنتج: ${productName}\n💰 السعر: ${formatPrice(amount)}\n\nللشراء، استخدم /buy ${productId} في البوت.`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== تشغيل البوت ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP server on port ${PORT}`));

bot.launch();
console.log('🤖 IDLEB X Bot is running...');
console.log(`👑 Admin ID: ${ADMIN_ID}`);
console.log(`📦 Products: ${products.length}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
