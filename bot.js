const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

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

const formatPrice = (p) => p.toLocaleString('ar-SY') + " SYP";
const isAdmin = (id) => id === ADMIN_ID;
const getShareLink = (id) => `https://t.me/${BOT_NAME}?start=product_${id}`;

// ==================== دوال مساعدة ====================
const getUser = (id) => {
    if (!users[id]) {
        users[id] = { 
            balance: 0, purchases: [], name: "User", 
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: null, referralEarnings: 0, cart: [], createdAt: Date.now()
        };
        saveUsers();
    }
    return users[id];
};

const getProduct = (id) => products.find(p => p.id === id);

// ==================== أزرار المشرف ====================
const adminMainMenu = () => Markup.keyboard([
    ['Products', 'Users', 'Earnings'],
    ['Coupons', 'Broadcast', 'Stats'],
    ['Settings', 'Backup', 'Back']
]).resize();

const userMainMenu = () => Markup.keyboard([
    ['Products', 'Search', 'My Cart'],
    ['Coupons', 'Invite Friend', 'My Balance'],
    ['Ratings', 'Help']
]).resize();

// ==================== بدء البوت ====================
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId);
    
    const welcome = `Welcome ${ctx.from.first_name} to IDLEB X Store!\n\nYour balance: ${formatPrice(users[userId].balance)}\nYour referral code: ${users[userId].referralCode}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(welcome + '\n\nAdmin Panel', { parse_mode: 'Markdown', ...adminMainMenu() });
    } else {
        await ctx.reply(welcome, { parse_mode: 'Markdown', ...userMainMenu() });
    }
});

// Back button
bot.hears('Back', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const msg = `Welcome\nYour balance: ${formatPrice(user.balance)}`;
    
    if (isAdmin(userId)) {
        await ctx.reply(msg + '\n\nAdmin Panel', { parse_mode: 'Markdown', ...adminMainMenu() });
    } else {
        await ctx.reply(msg, { parse_mode: 'Markdown', ...userMainMenu() });
    }
});

// Products
bot.hears('Products', async (ctx) => {
    if (products.length === 0) return ctx.reply("No products found");
    
    let msg = "Products:\n\n";
    for (const p of products) {
        msg += `${p.id}. ${p.name} - ${formatPrice(p.price)}\n`;
    }
    await ctx.reply(msg);
});

// Search
bot.hears('Search', async (ctx) => {
    await ctx.reply("Send product name to search:");
    bot.once('text', async (ctx2) => {
        const query = ctx2.message.text.toLowerCase();
        const results = products.filter(p => p.name.toLowerCase().includes(query));
        if (results.length === 0) return ctx2.reply("No results");
        let msg = "Search results:\n\n";
        for (const p of results) {
            msg += `${p.id}. ${p.name} - ${formatPrice(p.price)}\n`;
        }
        await ctx2.reply(msg);
    });
});

// My Cart
bot.hears('My Cart', async (ctx) => {
    const user = getUser(ctx.from.id);
    const cart = user.cart || [];
    if (cart.length === 0) return ctx.reply("Your cart is empty");
    let msg = "Your Cart:\n\n";
    let total = 0;
    for (const item of cart) {
        const p = getProduct(item.id);
        if (p) {
            msg += `${p.name} x${item.qty} = ${formatPrice(p.price * item.qty)}\n`;
            total += p.price * item.qty;
        }
    }
    msg += `\nTotal: ${formatPrice(total)}`;
    await ctx.reply(msg);
});

// Coupons
bot.hears('Coupons', async (ctx) => {
    if (coupons.length === 0) return ctx.reply("No coupons available");
    let msg = "Available Coupons:\n\n";
    for (const c of coupons) {
        msg += `${c.code} - ${c.type === 'percent' ? c.discount + '%' : formatPrice(c.discount)} off\n`;
    }
    await ctx.reply(msg);
});

// Invite Friend
bot.hears('Invite Friend', async (ctx) => {
    const user = getUser(ctx.from.id);
    const link = `https://t.me/${BOT_NAME}?start=${ctx.from.id}`;
    await ctx.reply(`Your invite link:\n${link}\n\nEach friend who joins gives you 5000 SYP bonus!`);
});

// My Balance
bot.hears('My Balance', async (ctx) => {
    const user = getUser(ctx.from.id);
    await ctx.reply(`Your balance: ${formatPrice(user.balance)}`);
});

// Ratings
bot.hears('Ratings', async (ctx) => {
    const topRated = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
    if (topRated.length === 0) return ctx.reply("No ratings yet");
    let msg = "Top Rated Products:\n\n";
    for (const p of topRated) {
        msg += `${p.name} - ${p.rating || 4.5}/5\n`;
    }
    await ctx.reply(msg);
});

// Help
bot.hears('Help', async (ctx) => {
    await ctx.reply(`Commands:\n/products - List products\n/balance - Your balance\n/cart - Your cart\n/coupon CODE - Apply coupon\n/referral - Your invite link`);
});

// ==================== Admin Commands ====================

// Users list
bot.hears('Users', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const userList = Object.entries(users).slice(0, 20);
    if (userList.length === 0) return ctx.reply("No users");
    let msg = "Users List:\n\n";
    for (const [id, data] of userList) {
        msg += `ID: ${id}\n   Name: ${data.name}\n   Balance: ${formatPrice(data.balance)}\n   Purchases: ${data.purchases?.length || 0}\n\n`;
    }
    await ctx.reply(msg);
});

// Earnings
bot.hears('Earnings', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
    const totalSales = products.reduce((s, p) => s + (p.sales || 0), 0);
    await ctx.reply(`Total Sales: ${totalSales}\nTotal Revenue: ${formatPrice(totalRevenue)}`);
});

// Broadcast
bot.hears('Broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply("Send the message to broadcast to all users:");
    bot.once('text', async (ctx2) => {
        const message = ctx2.message.text;
        let success = 0, failed = 0;
        for (const uid of Object.keys(users)) {
            try {
                await bot.telegram.sendMessage(uid, `Announcement:\n\n${message}`);
                success++;
            } catch(e) { failed++; }
        }
        await ctx2.reply(`Sent to ${success} users, Failed: ${failed}`);
    });
});

// Stats
bot.hears('Stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const totalUsers = Object.keys(users).length;
    const totalProducts = products.length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
    await ctx.reply(`Users: ${totalUsers}\nProducts: ${totalProducts}\nOrders: ${totalOrders}\nRevenue: ${formatPrice(totalRevenue)}`);
});

// Settings
bot.hears('Settings', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.reply(`Admin ID: ${ADMIN_ID}\nBot: @${BOT_NAME}\nProducts: ${products.length}\nUsers: ${Object.keys(users).length}`);
});

// Backup
bot.hears('Backup', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const backup = { products, users, coupons, orders, timestamp: Date.now() };
    const backupJson = JSON.stringify(backup, null, 2);
    const backupBuffer = Buffer.from(backupJson, 'utf-8');
    await ctx.replyWithDocument({ source: backupBuffer, filename: `backup-${Date.now()}.json` });
});

// Charge user
bot.command('charge', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Usage: /charge <user_id> <amount>");
    const userId = parseInt(args[1]);
    const amount = parseInt(args[2]);
    if (!users[userId]) users[userId] = { balance: 0, purchases: [], name: "User" };
    users[userId].balance += amount;
    saveUsers();
    await ctx.reply(`Charged ${formatPrice(amount)} to user ${userId}`);
    await bot.telegram.sendMessage(userId, `Your balance has been increased by ${formatPrice(amount)}`);
});

// Add product
bot.command('addproduct', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 4) return ctx.reply("Usage: /addproduct <name> <price> <link>");
    const name = args[1];
    const price = parseInt(args[2]);
    const link = args[3];
    const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: newId, name, price, link, category: "General", desc: "Added via bot", stock: 999, sales: 0, rating: 4.5 });
    saveProducts();
    await ctx.reply(`Product added: ${name}\nShare link: ${getShareLink(newId)}`);
});

// Delete product
bot.command('delproduct', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Usage: /delproduct <product_id>");
    const id = parseInt(args[1]);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return ctx.reply("Product not found");
    const deleted = products[index];
    products.splice(index, 1);
    saveProducts();
    await ctx.reply(`Product deleted: ${deleted.name}`);
});

// Add coupon
bot.command('addcoupon', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 4) return ctx.reply("Usage: /addcoupon <code> <discount> <type>\ntype: percent or fixed");
    const code = args[1].toUpperCase();
    const discount = parseInt(args[2]);
    const type = args[3];
    coupons.push({ code, discount, type, uses: 0, maxUses: 999, minOrder: 0 });
    saveCoupons();
    await ctx.reply(`Coupon added: ${code} - ${type === 'percent' ? discount + '%' : formatPrice(discount)}`);
});

// Apply coupon
bot.command('coupon', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Usage: /coupon <code>");
    const code = args[1].toUpperCase();
    const coupon = coupons.find(c => c.code === code);
    if (!coupon) return ctx.reply("Invalid coupon");
    const user = getUser(userId);
    user.activeCoupon = { code: coupon.code, discount: coupon.discount, type: coupon.type };
    saveUsers();
    await ctx.reply(`Coupon ${code} activated!`);
});

// ==================== API ====================
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/stats', (req, res) => res.json({ products: products.length, users: Object.keys(users).length, orders: orders.length }));

// ==================== تشغيل البوت ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));

bot.launch().then(() => {
    console.log(`Bot @${BOT_NAME} is running!`);
    console.log(`Admin ID: ${ADMIN_ID}`);
    console.log(`Products: ${products.length}`);
    console.log(`Users: ${Object.keys(users).length}`);
}).catch((err) => {
    console.error('Failed to launch bot:', err.message);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
