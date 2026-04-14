const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ============== إعدادات البوت ==============
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found! Please set it in environment variables.');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ============== ملفات التخزين ==============
const PRODUCTS_FILE = 'products.json';
const USERS_FILE = 'users.json';

// تحميل المنتجات
let products = [];
if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
} else {
    products = [
        { id: 1, name: "Kali Linux Pro Kit", price: 450000, link: "https://t.me/your_channel/kali_pro_kit", description: "نسخة كاملة من كالي مع 200+ أداة", category: "اختبار الاختراق", stock: 999 },
        { id: 2, name: "Burp Suite Pro License", price: 1250000, link: "https://t.me/your_channel/burp_pro", description: "رخصة سنة كاملة", category: "اختبار الاختراق", stock: 25 },
        { id: 3, name: "حزمة OSINT Master", price: 320000, link: "https://t.me/your_channel/osint_master", description: "50 أداة OSINT", category: "OSINT", stock: 999 },
        { id: 4, name: "VPN Lifetime", price: 850000, link: "https://t.me/your_channel/vpn_lifetime", description: "اشتراك مدى الحياة", category: "VPN", stock: 100 },
        { id: 5, name: "دورة اختراق أخلاقي", price: 680000, link: "https://t.me/your_channel/hacking_course", description: "35 ساعة فيديو", category: "منتجات رقمية", stock: 999 },
        { id: 6, name: "Flipper Zero", price: 2750000, link: "", description: "جهاز Flipper Zero أصلي", category: "أجهزة", stock: 7 }
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// تحميل المستخدمين
let users = {};
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveProducts() { fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2)); }
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function formatPrice(p) { return p.toLocaleString('ar-SY') + " ل.س"; }

// ============== أوامر البوت ==============
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) { users[userId] = { balance: 0, purchases: [] }; saveUsers(); }
    ctx.reply(`🎉 مرحباً بك في متجر IDLEB X!\n\n🔹 /products - عرض المنتجات\n🔹 /product <رقم> - تفاصيل منتج\n🔹 /buy <رقم> - شراء منتج\n🔹 /balance - رصيدك\n🔹 /help - المساعدة`);
});

bot.command('products', (ctx) => {
    let msg = "📦 قائمة المنتجات:\n\n";
    products.forEach(p => { msg += `${p.id}. ${p.name} - ${formatPrice(p.price)}\n`; });
    msg += `\nلشراء منتج: /buy <رقم>\nمثال: /buy 1`;
    ctx.reply(msg);
});

bot.command('product', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);
    const product = products.find(p => p.id === id);
    if (!product) return ctx.reply("❌ منتج غير موجود");
    let msg = `📦 ${product.name}\n💰 ${formatPrice(product.price)}\n📂 ${product.category}\n📝 ${product.description}\n📊 المخزون: ${product.stock}\n\n🔗 رابط التحميل: ${product.link || "لا يوجد رابط"}`;
    ctx.reply(msg);
});

bot.command('buy', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const productId = parseInt(args[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) return ctx.reply("❌ منتج غير موجود");
    if (!users[userId]) { users[userId] = { balance: 0, purchases: [] }; saveUsers(); }
    if (users[userId].balance < product.price) return ctx.reply(`❌ رصيدك غير كافٍ!\n💰 رصيدك: ${formatPrice(users[userId].balance)}\n💵 السعر: ${formatPrice(product.price)}`);
    
    users[userId].balance -= product.price;
    users[userId].purchases.push({ productId, productName: product.name, price: product.price, date: new Date(), link: product.link });
    if (product.link) product.stock--;
    saveProducts();
    saveUsers();
    
    let reply = `✅ تم شراء ${product.name}!\n💰 رصيدك: ${formatPrice(users[userId].balance)}`;
    if (product.link) reply += `\n\n📥 رابط التحميل:\n${product.link}`;
    ctx.reply(reply);
});

bot.command('balance', (ctx) => {
    const userId = ctx.from.id;
    const balance = users[userId]?.balance || 0;
    ctx.reply(`💰 رصيدك: ${formatPrice(balance)}`);
});

bot.command('help', (ctx) => {
    ctx.reply(`🔧 الأوامر المتاحة:\n/start - بدء البوت\n/products - عرض المنتجات\n/product <رقم> - تفاصيل منتج\n/buy <رقم> - شراء منتج\n/balance - رصيدك`);
});

// أوامر المشرف
bot.command('charge', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ للمشرف فقط");
    const args = ctx.message.text.split(' ');
    const userId = parseInt(args[1]);
    const amount = parseInt(args[2]);
    if (!users[userId]) users[userId] = { balance: 0, purchases: [] };
    users[userId].balance += amount;
    saveUsers();
    ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم ${userId}`);
    bot.telegram.sendMessage(userId, `🎉 تم شحن رصيدك بمبلغ ${formatPrice(amount)}`);
});

bot.command('addproduct', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ للمشرف فقط");
    ctx.reply(`📝 أرسل معلومات المنتج بهذا التنسيق:\n\nالاسم: [اسم المنتج]\nالسعر: [السعر]\nالرابط: [رابط التحميل]\nالقسم: [القسم]\nالوصف: [الوصف]`);
    bot.on('text', (ctx2) => {
        if (ctx2.message.text.startsWith('الاسم:')) {
            const text = ctx2.message.text;
            const name = text.match(/الاسم: (.*)/)?.[1];
            const price = parseInt(text.match(/السعر: (.*)/)?.[1]);
            const link = text.match(/الرابط: (.*)/)?.[1];
            const category = text.match(/القسم: (.*)/)?.[1];
            const desc = text.match(/الوصف: (.*)/)?.[1];
            if (!name || !price) return ctx2.reply("❌ الاسم والسعر مطلوبين");
            const newId = products.length + 1;
            products.push({ id: newId, name, price, link: link || "", category: category || "عام", description: desc || "", stock: 999 });
            saveProducts();
            ctx2.reply(`✅ تم إضافة المنتج ${name} برقم ${newId}`);
        }
    });
});

bot.command('allproducts', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ للمشرف فقط");
    let msg = "📊 جميع المنتجات مع الروابط:\n\n";
    products.forEach(p => {
        msg += `${p.id}. ${p.name}\n   💰 ${formatPrice(p.price)}\n   🔗 ${p.link || "لا يوجد رابط"}\n\n`;
    });
    ctx.reply(msg);
});

// خادم HTTP لـ Render
const app = express();
app.get('/', (req, res) => res.send('IDLEB X Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP server running on port ${PORT}`));

// تشغيل البوت
bot.launch();
console.log('🤖 IDLEB X Bot is running...');
console.log('📦 Products loaded:', products.length);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
