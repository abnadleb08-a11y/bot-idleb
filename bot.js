const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ==================== الإعدادات ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

// التحقق من التوكن
if (!BOT_TOKEN) {
    console.error('❌ خطأ: BOT_TOKEN غير موجود في متغيرات البيئة');
    process.exit(1);
}

console.log('✅ جاري تشغيل البوت...');
console.log(`📌 التوكن: ${BOT_TOKEN.substring(0, 10)}...`);

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

const BOT_NAME = "idlebstore_bot";

// ==================== البيانات ====================
const PRODUCTS_FILE = 'products.json';
const USERS_FILE = 'users.json';

let products = [];
let users = {};

// تحميل المنتجات
if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
} else {
    products = [
        { id: 1, name: "Kali Linux Pro Kit", price: 450000, link: "https://t.me/your_channel/kali", desc: "أداة اختبار الاختراق", category: "اختبار الاختراق", stock: 999 },
        { id: 2, name: "Burp Suite Pro", price: 1250000, link: "https://t.me/your_channel/burp", desc: "رخصة سنة كاملة", category: "اختبار الاختراق", stock: 25 },
        { id: 3, name: "OSINT Master", price: 320000, link: "https://t.me/your_channel/osint", desc: "50 أداة OSINT", category: "OSINT", stock: 999 },
        { id: 4, name: "VPN Lifetime", price: 850000, link: "https://t.me/your_channel/vpn", desc: "اشتراك مدى الحياة", category: "VPN", stock: 100 }
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// تحميل المستخدمين
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
}

const saveProducts = () => fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
const formatPrice = (p) => p.toLocaleString('ar-SY') + " ل.س";
const isAdmin = (id) => id === ADMIN_ID;
const getShareLink = (id) => `https://t.me/${BOT_NAME}?start=product_${id}`;

// ==================== دوال سريعة ====================
const getUser = (id) => {
    if (!users[id]) {
        users[id] = { balance: 0, purchases: [], name: "مستخدم" };
        saveUsers();
    }
    return users[id];
};

const getProduct = (id) => products.find(p => p.id === id);

// ==================== أزرار ====================
const mainKeyboard = () => Markup.keyboard([
    ['📦 المنتجات', '💰 رصيدي'],
    ['🛒 مشترياتي', '📤 رابط المنتج']
]).resize();

const adminKeyboard = () => Markup.keyboard([
    ['➕ إضافة', '✏️ تعديل', '🗑️ حذف'],
    ['💰 شحن', '👥 مستخدمين', '📊 إحصائيات'],
    ['🔙 رجوع']
]).resize();

// ==================== أوامر البوت ====================

// بدء البوت
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId);
    
    // التحقق من رابط المنتج
    const text = ctx.message.text;
    if (text && text.includes('start=product_')) {
        const productId = parseInt(text.split('product_')[1]);
        const product = getProduct(productId);
        if (product) {
            const msg = `📦 *${product.name}*\n💰 ${formatPrice(product.price)}\n📂 ${product.category}\n📝 ${product.desc}\n📥 ${product.link}`;
            const btns = Markup.inlineKeyboard([
                [Markup.button.callback('🛒 شراء', `buy_${product.id}`)],
                [Markup.button.callback('📤 مشاركة', `share_${product.id}`)]
            ]);
            return ctx.reply(msg, { parse_mode: 'Markdown', ...btns });
        }
    }
    
    const welcome = `🎉 مرحباً ${ctx.from.first_name}\n💰 رصيدك: ${formatPrice(users[userId].balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(welcome + '\n🔧 لوحة المشرف', { parse_mode: 'Markdown', ...adminKeyboard() });
    } else {
        await ctx.reply(welcome, { parse_mode: 'Markdown', ...mainKeyboard() });
    }
});

// عرض المنتجات
bot.hears('📦 المنتجات', async (ctx) => {
    if (!products.length) return ctx.reply("لا توجد منتجات");
    
    let msg = "📦 *المنتجات:*\n\n";
    const btns = [];
    for (const p of products) {
        msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
        btns.push([Markup.button.callback(`📦 ${p.id}. ${p.name}`, `view_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'main')]);
    
    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

// عرض منتج
bot.action(/view_(\d+)/, async (ctx) => {
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const msg = `📦 *${product.name}*\n💰 ${formatPrice(product.price)}\n📂 ${product.category}\n📝 ${product.desc}\n📥 ${product.link}`;
    const btns = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 شراء', `buy_${product.id}`)],
        [Markup.button.callback('📤 مشاركة', `share_${product.id}`)],
        [Markup.button.callback('🔙 رجوع', 'products')]
    ]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...btns });
    await ctx.answerCbQuery();
});

// شراء
bot.action(/buy_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const product = getProduct(parseInt(ctx.match[1]));
    
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const user = getUser(userId);
    
    if (user.balance < product.price) {
        return ctx.answerCbQuery(`❌ رصيدك غير كافٍ! ${formatPrice(user.balance)}`, true);
    }
    
    user.balance -= product.price;
    user.purchases.push({
        productName: product.name,
        price: product.price,
        date: new Date().toISOString(),
        link: product.link
    });
    
    if (product.stock > 0) product.stock--;
    saveProducts();
    saveUsers();
    
    const msg = `✅ تم شراء ${product.name}!\n💰 رصيدك: ${formatPrice(user.balance)}\n📥 ${product.link}`;
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('✅ تم الشراء');
});

// مشاركة
bot.action(/share_(\d+)/, async (ctx) => {
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.answerCbQuery('غير موجود');
    
    const link = getShareLink(product.id);
    await ctx.reply(`📤 *رابط مشاركة ${product.name}*\n\n🔗 \`${link}\``, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// رجوع
bot.action('products', async (ctx) => {
    if (!products.length) return ctx.editMessageText("لا توجد منتجات");
    
    let msg = "📦 *المنتجات:*\n\n";
    const btns = [];
    for (const p of products) {
        msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
        btns.push([Markup.button.callback(`📦 ${p.id}. ${p.name}`, `view_${p.id}`)]);
    }
    btns.push([Markup.button.callback('🔙 رجوع', 'main')]);
    
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    await ctx.answerCbQuery();
});

bot.action('main', async (ctx) => {
    const userId = ctx.from.id;
    const msg = `🎉 مرحباً\n💰 رصيدك: ${formatPrice(users[userId]?.balance || 0)}`;
    
    if (isAdmin(userId)) {
        await ctx.editMessageText(msg + '\n🔧 مشرف', { parse_mode: 'Markdown', ...adminKeyboard() });
    } else {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...mainKeyboard() });
    }
    await ctx.answerCbQuery();
});

// رصيدي
bot.hears('💰 رصيدي', async (ctx) => {
    const user = getUser(ctx.from.id);
    await ctx.reply(`💰 رصيدك: ${formatPrice(user.balance)}`, { parse_mode: 'Markdown' });
});

// مشترياتي
bot.hears('🛒 مشترياتي', async (ctx) => {
    const user = getUser(ctx.from.id);
    
    if (!user.purchases.length) return ctx.reply("📦 لا توجد مشتريات");
    
    let msg = "🛒 *مشترياتك:*\n\n";
    user.purchases.forEach((p, i) => {
        msg += `${i+1}. ${p.productName}\n   💰 ${formatPrice(p.price)}\n   📅 ${new Date(p.date).toLocaleDateString()}\n\n`;
    });
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// رابط منتج
bot.hears('📤 رابط المنتج', async (ctx) => {
    let msg = "📤 *روابط المنتجات:*\n\n";
    for (const p of products) {
        msg += `*/share_${p.id}* - ${p.name}\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// أوامر سريعة
for (const p of products) {
    bot.command(`share_${p.id}`, async (ctx) => {
        await ctx.reply(`📤 *${p.name}*\n🔗 ${getShareLink(p.id)}`, { parse_mode: 'Markdown' });
    });
}

bot.command('products', async (ctx) => {
    let msg = "📦 *المنتجات:*\n\n";
    for (const p of products) {
        msg += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('balance', async (ctx) => {
    const user = getUser(ctx.from.id);
    await ctx.reply(`💰 ${formatPrice(user.balance)}`, { parse_mode: 'Markdown' });
});

// ==================== أوامر المشرف ====================

bot.hears('🔙 رجوع', async (ctx) => {
    if (isAdmin(ctx.from.id)) {
        await ctx.reply('🔧 لوحة المشرف', { ...adminKeyboard() });
    } else {
        await ctx.reply('🎉 القائمة الرئيسية', { ...mainKeyboard() });
    }
});

// إضافة منتج
bot.hears('➕ إضافة', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply(`📝 أرسل:\nالاسم: ...\nالسعر: ...\nالرابط: ...\nالقسم: ...\nالوصف: ...\nالمخزون: ...`);
});

// تعديل منتج
bot.hears('✏️ تعديل', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    let msg = "✏️ اختر المنتج:\n";
    for (const p of products) {
        msg += `/edit_${p.id} - ${p.name}\n`;
    }
    await ctx.reply(msg);
});

// حذف منتج
bot.hears('🗑️ حذف', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    let msg = "🗑️ اختر المنتج:\n";
    for (const p of products) {
        msg += `/del_${p.id} - ${p.name}\n`;
    }
    await ctx.reply(msg);
});

// شحن رصيد
bot.hears('💰 شحن', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply("💰 أرسل: `/charge 123456789 50000`", { parse_mode: 'Markdown' });
});

// المستخدمين
bot.hears('👥 مستخدمين', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    let msg = "👥 *المستخدمين:*\n\n";
    const list = Object.entries(users).slice(0, 20);
    for (const [id, data] of list) {
        msg += `🆔 ${id}\n   💰 ${formatPrice(data.balance)}\n   🛒 ${data.purchases?.length || 0}\n\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// إحصائيات
bot.hears('📊 إحصائيات', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const totalUsers = Object.keys(users).length;
    const totalSales = Object.values(users).reduce((s, u) => s + (u.purchases?.length || 0), 0);
    const totalRevenue = Object.values(users).reduce((s, u) => {
        return s + (u.purchases?.reduce((a, p) => a + p.price, 0) || 0);
    }, 0);
    
    const msg = `📊 *إحصائيات*\n👥 ${totalUsers}\n🛒 ${totalSales}\n💰 ${formatPrice(totalRevenue)}\n📦 ${products.length}`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// معالجة إضافة منتج
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (!isAdmin(ctx.from.id)) return;
    if (!text.includes('الاسم:') || !text.includes('السعر:')) return;
    
    const name = text.match(/الاسم: (.*)/)?.[1];
    const price = parseInt(text.match(/السعر: (\d+)/)?.[1]);
    const link = text.match(/الرابط: (.*)/)?.[1];
    const category = text.match(/القسم: (.*)/)?.[1];
    const desc = text.match(/الوصف: (.*)/)?.[1];
    const stock = parseInt(text.match(/المخزون: (\d+)/)?.[1]) || 999;
    
    if (!name || !price || !link) return ctx.reply("❌ الاسم والسعر والرابط مطلوبة");
    
    const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: newId, name: name.trim(), price, link: link.trim(), category: category || "عام", desc: desc || "", stock });
    saveProducts();
    
    await ctx.reply(`✅ تم إضافة ${name}\n🔗 ${getShareLink(newId)}`);
});

// تعديل منتج
bot.command(/edit_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const product = getProduct(parseInt(ctx.match[1]));
    if (!product) return ctx.reply("غير موجود");
    
    await ctx.reply(`✏️ تعديل ${product.name}\nأرسل:\nالاسم: ${product.name}\nالسعر: ${product.price}\nالرابط: ${product.link}\nالقسم: ${product.category}\nالوصف: ${product.desc}\nالمخزون: ${product.stock}`);
});

// حذف منتج
bot.command(/del_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt(ctx.match[1]);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return ctx.reply("غير موجود");
    
    const deleted = products[index];
    products.splice(index, 1);
    saveProducts();
    await ctx.reply(`✅ تم حذف ${deleted.name}`);
});

// شحن رصيد
bot.command(/charge (\d+) (\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    
    if (!users[userId]) users[userId] = { balance: 0, purchases: [] };
    users[userId].balance += amount;
    saveUsers();
    
    await ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم ${userId}`);
    try {
        await bot.telegram.sendMessage(userId, `🎉 تم شحن رصيدك ${formatPrice(amount)}`);
    } catch(e) {}
});

// خصم رصيد
bot.command(/deduct (\d+) (\d+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    
    if (!users[userId]) return ctx.reply("❌ مستخدم غير موجود");
    if (users[userId].balance < amount) return ctx.reply(`❌ رصيده ${formatPrice(users[userId].balance)}`);
    
    users[userId].balance -= amount;
    saveUsers();
    await ctx.reply(`✅ تم خصم ${formatPrice(amount)} من ${userId}`);
});

// ==================== API ====================
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/product/:id', (req, res) => {
    const p = products.find(p => p.id == req.params.id);
    p ? res.json(p) : res.status(404).json({ error: "Not found" });
});

// ==================== التشغيل ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP على منفذ ${PORT}`));

// محاولة تشغيل البوت مع معالجة الأخطاء
bot.launch().then(() => {
    console.log(`✅ البوت @${BOT_NAME} يعمل بنجاح!`);
    console.log(`👑 المدير: ${ADMIN_ID}`);
    console.log(`📦 عدد المنتجات: ${products.length}`);
}).catch((err) => {
    console.error('❌ فشل تشغيل البوت:', err.message);
});

// معالجة أخطاء FetchError
process.on('unhandledRejection', (err) => {
    if (err.message && err.message.includes('FetchError')) {
        console.error('⚠️ خطأ في الاتصال: إعادة تشغيل البوت بعد 5 ثواني...');
        setTimeout(() => {
            bot.launch();
        }, 5000);
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
