const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ============== إعدادات البوت ==============
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found!');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ============== ملفات التخزين ==============
const PRODUCTS_FILE = 'products.json';
const USERS_FILE = 'users.json';

// رابط البوت (غيّره لرابط بوتك)
const BOT_USERNAME = "idlebstore_bot"; // 👈 غيّر لاسم بوتك بدون @

// تحميل المنتجات
let products = [];
if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
} else {
    products = [
        { 
            id: 1, 
            name: "Kali Linux Pro Kit", 
            price: 450000, 
            link: "https://t.me/your_channel/kali_pro_kit",
            description: "نسخة كاملة من كالي مع 200+ أداة", 
            category: "اختبار الاختراق", 
            stock: 999,
            image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400"
        },
        { 
            id: 2, 
            name: "Burp Suite Pro License", 
            price: 1250000, 
            link: "https://t.me/your_channel/burp_pro",
            description: "رخصة سنة كاملة", 
            category: "اختبار الاختراق", 
            stock: 25,
            image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400"
        }
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

function isAdmin(userId) {
    return userId === ADMIN_ID;
}

// ============== دوال مساعدة ==============

// إنشاء رابط مشاركة المنتج
function getProductShareLink(productId) {
    return `https://t.me/${BOT_USERNAME}?start=product_${productId}`;
}

// إنشاء أزرار المنتج (بما فيها زر المشاركة)
function getProductButtons(product) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🛒 شراء الآن', `buy_${product.id}`),
            Markup.button.callback('📤 مشاركة المنتج', `share_${product.id}`)
        ],
        [
            Markup.button.url('🔗 رابط التحميل المباشر', product.link || 'https://t.me/idlebx'),
            Markup.button.callback('ℹ️ تفاصيل أكثر', `details_${product.id}`)
        ]
    ]);
}

// عرض بطاقة المنتج
async function showProduct(ctx, product, showShareButton = true) {
    const message = `
📦 *${product.name}*

💰 السعر: ${formatPrice(product.price)}
📂 القسم: ${product.category || "عام"}
📊 المخزون: ${product.stock > 0 ? product.stock : "غير متوفر"}
⭐ التقييم: 4.8/5

📝 *الوصف:*
${product.description || "لا يوجد وصف"}

🔗 *رابط التحميل:* ${product.link || "❌ لا يوجد رابط"}

─────────────────
🆔 معرف المنتج: \`${product.id}\`
🔗 رابط المشاركة: ${getProductShareLink(product.id)}
    `;
    
    const buttons = Markup.inlineKeyboard([
        [
            Markup.button.callback('🛒 شراء', `buy_${product.id}`),
            Markup.button.callback('📤 مشاركة', `share_${product.id}`)
        ],
        [
            Markup.button.url('📥 تحميل', product.link || 'https://t.me/idlebx'),
            Markup.button.callback('🔙 رجوع', 'back_to_products')
        ]
    ]);
    
    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...buttons });
        await ctx.answerCbQuery();
    } else {
        await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
    }
}

// ============== API للموقع ==============
const app = express();
app.use(express.json());

app.get('/api/products', (req, res) => res.json(products));
app.get('/api/product/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id);
    product ? res.json(product) : res.status(404).json({ error: "Not found" });
});

// ============== أوامر البوت ==============

// معالج الروابط المباشرة (Deep Links)
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) { 
        users[userId] = { balance: 0, purchases: [], username: ctx.from.username, firstName: ctx.from.first_name }; 
        saveUsers(); 
    }
    
    const payload = ctx.message.text.split(' ')[1];
    
    // إذا الرابط يحتوي على معرف منتج
    if (payload && payload.startsWith('product_')) {
        const productId = parseInt(payload.split('_')[1]);
        const product = products.find(p => p.id === productId);
        
        if (product) {
            await showProduct(ctx, product);
            return;
        }
    }
    
    // القائمة الرئيسية
    const mainMenu = Markup.inlineKeyboard([
        [Markup.button.callback('📦 عرض المنتجات', 'list_products')],
        [Markup.button.callback('💰 رصيدي', 'my_balance')],
        [Markup.button.callback('🛒 مشترياتي', 'my_purchases')],
        [Markup.button.callback('❓ مساعدة', 'help_menu')]
    ]);
    
    ctx.reply(`
🎉 *مرحباً بك في متجر IDLEB X!*

👤 مرحباً ${ctx.from.first_name}

🔹 استخدم الأزرار أدناه للتنقل
🔹 اضغط مطولاً على أي زر لمشاركته
🔹 كل منتج له رابط خاص للمشاركة

📢 *لشراء منتج:*
1. اضغط 📦 عرض المنتجات
2. اختر المنتج
3. اضغط 🛒 شراء الآن
    `, { parse_mode: 'Markdown', ...mainMenu });
});

// عرض قائمة المنتجات (مع أزرار)
bot.action('list_products', async (ctx) => {
    if (products.length === 0) {
        await ctx.editMessageText("📦 لا توجد منتجات حالياً.");
        return;
    }
    
    let message = "📦 *قائمة المنتجات:*\n\n";
    const buttons = [];
    
    products.forEach(p => {
        message += `*${p.id}.* ${p.name} - ${formatPrice(p.price)}\n`;
        message += `   🔗 /share_${p.id} - لمشاركة هذا المنتج\n\n`;
        buttons.push([Markup.button.callback(`${p.id}. ${p.name.substring(0, 20)}`, `product_${p.id}`)]);
    });
    
    message += `\n📌 *ملاحظة:* اضغط على أي منتج لرؤية التفاصيل\n`;
    message += `📤 *لمشاركة منتج:* اضغط مطولاً على اسم المنتج أو استخدم /share_<رقم>`;
    
    buttons.push([Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')]);
    
    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    await ctx.answerCbQuery();
});

// عرض منتج معين
bot.action(/product_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery("❌ المنتج غير موجود");
        return;
    }
    
    await showProduct(ctx, product);
});

// شراء منتج
bot.action(/buy_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery("❌ المنتج غير موجود");
        return;
    }
    
    if (!users[userId]) { 
        users[userId] = { balance: 0, purchases: [] }; 
        saveUsers(); 
    }
    
    if (users[userId].balance < product.price) {
        await ctx.answerCbQuery(`❌ رصيدك غير كافٍ! رصيدك: ${users[userId].balance}`, true);
        return;
    }
    
    // خصم الرصيد
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
    
    let reply = `✅ *تم شراء ${product.name} بنجاح!*\n\n`;
    reply += `💰 الرصيد المتبقي: ${formatPrice(users[userId].balance)}\n\n`;
    
    if (product.link) {
        reply += `📥 *رابط التحميل:*\n${product.link}\n\n`;
        reply += `⚠️ هذا الرابط خاص بك، لا تشاركه مع أحد.`;
    }
    
    await ctx.editMessageText(reply, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery("✅ تم الشراء بنجاح!");
});

// مشاركة المنتج (إظهار رابط المشاركة)
bot.action(/share_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery("❌ المنتج غير موجود");
        return;
    }
    
    const shareLink = getProductShareLink(product.id);
    const message = `
📤 *رابط مشاركة المنتج*

📦 *${product.name}*
💰 السعر: ${formatPrice(product.price)}

🔗 *رابط المشاركة:*
\`${shareLink}\`

📌 *كيفية الاستخدام:*
1. اضغط مطولاً على الرابط أعلاه
2. اختر "نسخ"
3. أرسل الرابط لأي شخص تريد
4. الشخص يضغط على الرابط ويوصل مباشرة للمنتج

✨ *ميزات رابط المشاركة:*
• يعرض المنتج مباشرة
• يظهر زر الشراء
• يمكن مشاركته في أي مكان
    `;
    
    const buttons = Markup.inlineKeyboard([
        [Markup.button.url('🔗 اضغط لفتح المنتج', shareLink)],
        [Markup.button.callback('🔙 رجوع للمنتج', `product_${product.id}`)]
    ]);
    
    await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
    await ctx.answerCbQuery();
});

// عرض الرصيد
bot.action('my_balance', async (ctx) => {
    const userId = ctx.from.id;
    const balance = users[userId]?.balance || 0;
    
    await ctx.editMessageText(`💰 *رصيدك الحالي:* ${formatPrice(balance)}`, { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')])
    });
    await ctx.answerCbQuery();
});

// عرض المشتريات
bot.action('my_purchases', async (ctx) => {
    const userId = ctx.from.id;
    const user = users[userId];
    
    if (!user || !user.purchases || user.purchases.length === 0) {
        await ctx.editMessageText("📦 لم تقم بشراء أي منتج بعد.", {
            ...Markup.inlineKeyboard([Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')])
        });
        return;
    }
    
    let message = "🛒 *مشترياتك:*\n\n";
    user.purchases.forEach((p, i) => {
        message += `${i+1}. *${p.productName}*\n`;
        message += `   💰 ${formatPrice(p.price)}\n`;
        message += `   📅 ${new Date(p.date).toLocaleDateString('ar-SY')}\n`;
        if (p.link) message += `   🔗 ${p.link}\n`;
        message += `\n`;
    });
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')])
    });
    await ctx.answerCbQuery();
});

// القائمة الرئيسية
bot.action('main_menu', async (ctx) => {
    const mainMenu = Markup.inlineKeyboard([
        [Markup.button.callback('📦 عرض المنتجات', 'list_products')],
        [Markup.button.callback('💰 رصيدي', 'my_balance')],
        [Markup.button.callback('🛒 مشترياتي', 'my_purchases')],
        [Markup.button.callback('❓ مساعدة', 'help_menu')]
    ]);
    
    await ctx.editMessageText(`
🎉 *مرحباً بك في متجر IDLEB X!*

🔹 استخدم الأزرار أدناه للتنقل
🔹 اضغط مطولاً على أي زر لمشاركته
🔹 كل منتج له رابط خاص للمشاركة

📢 *لشراء منتج:*
1. اضغط 📦 عرض المنتجات
2. اختر المنتج
3. اضغط 🛒 شراء الآن
    `, { parse_mode: 'Markdown', ...mainMenu });
    await ctx.answerCbQuery();
});

// ============== أوامر نصية ==============

// أمر للحصول على رابط منتج مباشرة
bot.command('share', (ctx) => {
    const args = ctx.message.text.split(' ');
    const productId = parseInt(args[1]);
    
    if (isNaN(productId)) {
        let msg = "📤 *لمشاركة منتج:*\n\n";
        products.forEach(p => {
            msg += `/share_${p.id} - ${p.name}\n`;
        });
        msg += `\nأو استخدم: /share <رقم_المنتج>`;
        return ctx.reply(msg, { parse_mode: 'Markdown' });
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return ctx.reply("❌ منتج غير موجود");
    
    const shareLink = getProductShareLink(product.id);
    ctx.reply(`
📤 *رابط مشاركة المنتج: ${product.name}*

🔗 ${shareLink}

✨ *ملاحظة:* من يضغط على هذا الرابط يصل مباشرة للمنتج ويمكنه شراؤه.
    `, { parse_mode: 'Markdown' });
});

// أوامر سريعة لكل منتج (/share_1, /share_2, إلخ)
products.forEach(p => {
    bot.command(`share_${p.id}`, (ctx) => {
        const shareLink = getProductShareLink(p.id);
        ctx.reply(`
📤 *رابط مشاركة ${p.name}*

🔗 ${shareLink}

💰 السعر: ${formatPrice(p.price)}
🛒 للشراء: /buy ${p.id}
        `, { parse_mode: 'Markdown' });
    });
});

// أمر عرض منتج
bot.command('product', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);
    const product = products.find(p => p.id === id);
    
    if (!product) return ctx.reply("❌ منتج غير موجود");
    
    showProduct(ctx, product);
});

// أمر شراء
bot.command('buy', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const productId = parseInt(args[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) return ctx.reply("❌ منتج غير موجود");
    if (!users[userId]) { 
        users[userId] = { balance: 0, purchases: [] }; 
        saveUsers(); 
    }
    
    if (users[userId].balance < product.price) {
        return ctx.reply(`❌ رصيدك غير كافٍ! رصيدك: ${formatPrice(users[userId].balance)}`);
    }
    
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
    
    let reply = `✅ تم شراء ${product.name}!\n💰 رصيدك: ${formatPrice(users[userId].balance)}`;
    if (product.link) reply += `\n\n📥 رابط التحميل:\n${product.link}`;
    
    ctx.reply(reply);
});

// عرض الرصيد
bot.command('balance', (ctx) => {
    const userId = ctx.from.id;
    const balance = users[userId]?.balance || 0;
    ctx.reply(`💰 رصيدك: ${formatPrice(balance)}`);
});

// قائمة المنتجات
bot.command('products', (ctx) => {
    if (products.length === 0) return ctx.reply("📦 لا توجد منتجات");
    
    let msg = "📦 *قائمة المنتجات:*\n\n";
    products.forEach(p => {
        msg += `*${p.id}.* ${p.name}\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   📤 /share_${p.id} - رابط المشاركة\n\n`;
    });
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ============== أوامر المشرف ==============

// إضافة منتج سريع
bot.command('addproduct', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    const args = ctx.message.text.split(' ');
    if (args.length < 4) {
        return ctx.reply(`⚠️ طريقة الاستخدام:
/addproduct <الاسم> <السعر> <الرابط> <القسم>

مثال:
/addproduct "Kali Linux" 450000 https://t.me/channel/file "اختبار الاختراق"

✨ بعد الإضافة، سيظهر أمر /share_<رقم> تلقائياً لمشاركة المنتج
        `);
    }
    
    let name = args[1];
    const price = parseInt(args[2]);
    const link = args[3];
    const category = args[4] || "عام";
    
    if (isNaN(price)) return ctx.reply("❌ السعر يجب أن يكون رقماً");
    
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct = {
        id: newId,
        name: name,
        price: price,
        link: link,
        category: category,
        description: "تمت الإضافة عبر البوت",
        stock: 999,
        image: "",
        rating: 4.5,
        createdAt: new Date().toISOString()
    };
    
    products.push(newProduct);
    saveProducts();
    
    // إضافة أمر share للمنتج الجديد ديناميكياً
    bot.command(`share_${newId}`, (ctx2) => {
        const shareLink = getProductShareLink(newId);
        ctx2.reply(`
📤 *رابط مشاركة ${newProduct.name}*

🔗 ${shareLink}

💰 السعر: ${formatPrice(newProduct.price)}
🛒 للشراء: /buy ${newId}
        `, { parse_mode: 'Markdown' });
    });
    
    ctx.reply(`✅ *تم إضافة المنتج بنجاح!*

📦 ${name}
💰 ${formatPrice(price)}
🔗 ${link}
📂 ${category}
🆔 رقم المنتج: ${newId}

🔗 *رابط مشاركة المنتج:*
\`${getProductShareLink(newId)}\`

✨ يمكنك الآن مشاركة هذا الرابط مع أي شخص!
    `, { parse_mode: 'Markdown' });
});

// تعيين رابط لمنتج
bot.command('setlink', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    const args = ctx.message.text.split(' ');
    const productId = parseInt(args[1]);
    const newLink = args[2];
    
    if (isNaN(productId) || !newLink) {
        return ctx.reply("⚠️ /setlink <رقم_المنتج> <الرابط>");
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return ctx.reply("❌ منتج غير موجود");
    
    product.link = newLink;
    saveProducts();
    
    ctx.reply(`✅ تم تعيين رابط المنتج *${product.name}*:\n🔗 ${newLink}\n\n🔗 رابط المشاركة: ${getProductShareLink(productId)}`, { parse_mode: 'Markdown' });
});

// عرض جميع المنتجات مع روابط المشاركة
bot.command('allproducts', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    let msg = "📊 *جميع المنتجات مع روابط المشاركة*\n\n";
    products.forEach(p => {
        msg += `*${p.id}. ${p.name}*\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   🔗 رابط المشاركة: \`${getProductShareLink(p.id)}\`\n\n`;
    });
    
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ============== تشغيل البوت ==============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP server running on port ${PORT}`));

bot.launch();
console.log('🤖 IDLEB X Bot is running...');
console.log(`🔗 Bot username: @${BOT_USERNAME}`);
console.log(`📦 Products with share links:`);
products.forEach(p => {
    console.log(`   ${p.id}. ${p.name} -> ${getProductShareLink(p.id)}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
