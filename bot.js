const { Telegraf } = require('telegraf');
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

// تحميل المنتجات
let products = [];
if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
} else {
    products = [];
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

// ============== دوال مساعدة ==============
function isAdmin(userId) {
    return userId === ADMIN_ID;
}

function generateProductCard(product) {
    return `
📦 *${product.name}*
🆔 رقم المنتج: \`${product.id}\`
💰 السعر: ${formatPrice(product.price)}
📂 القسم: ${product.category || "عام"}
⭐ التقييم: ${product.rating || "4.5"}/5
📊 المخزون: ${product.stock > 0 ? product.stock : "غير متوفر"}
🔗 رابط التحميل: ${product.link || "لا يوجد رابط"}
📝 الوصف: ${product.description || "لا يوجد وصف"}

🛒 للشراء: /buy ${product.id}
    `;
}

// ============== أوامر المستخدمين ==============

bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) { 
        users[userId] = { balance: 0, purchases: [], username: ctx.from.username, firstName: ctx.from.first_name }; 
        saveUsers(); 
    }
    ctx.reply(`
🎉 *مرحباً بك في متجر IDLEB X!*

🔹 /products - عرض جميع المنتجات
🔹 /product <رقم> - عرض تفاصيل منتج
🔹 /buy <رقم> - شراء منتج
🔹 /balance - عرض رصيدك
🔹 /help - المساعدة

${isAdmin(userId) ? '\n🔧 *أوامر المشرف:*\n/admin - لوحة تحكم المشرف' : ''}
    `, { parse_mode: 'Markdown' });
});

bot.command('products', (ctx) => {
    if (products.length === 0) {
        return ctx.reply("📦 لا توجد منتجات حالياً.");
    }
    
    let msg = "📦 *قائمة المنتجات:*\n\n";
    products.forEach(p => { 
        msg += `*${p.id}.* ${p.name}\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   📂 ${p.category || "عام"}\n\n`;
    });
    msg += `🛒 للشراء: /buy <رقم_المنتج>\n🔍 للتفاصيل: /product <رقم>`;
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('product', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);
    const product = products.find(p => p.id === id);
    
    if (!product) return ctx.reply("❌ منتج غير موجود");
    
    ctx.reply(generateProductCard(product), { parse_mode: 'Markdown' });
});

bot.command('buy', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const productId = parseInt(args[1]);
    const product = products.find(p => p.id === productId);
    
    if (!product) return ctx.reply("❌ منتج غير موجود");
    if (!users[userId]) { 
        users[userId] = { balance: 0, purchases: [], username: ctx.from.username, firstName: ctx.from.first_name }; 
        saveUsers(); 
    }
    
    if (users[userId].balance < product.price) {
        const needed = product.price - users[userId].balance;
        return ctx.reply(`❌ *رصيدك غير كافٍ!*\n\n💰 رصيدك: ${formatPrice(users[userId].balance)}\n💵 سعر المنتج: ${formatPrice(product.price)}\n💸 المبلغ الناقص: ${formatPrice(needed)}\n\nللشحن: تواصل مع @${ctx.botInfo.username}`, { parse_mode: 'Markdown' });
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
    
    if (product.link && product.stock > 0) product.stock--;
    saveProducts();
    saveUsers();
    
    let reply = `✅ *تم شراء ${product.name} بنجاح!*\n\n💰 الرصيد المتبقي: ${formatPrice(users[userId].balance)}`;
    if (product.link) {
        reply += `\n\n📥 *رابط التحميل:*\n${product.link}\n\n⚠️ هذا الرابط خاص بك، يرجى عدم مشاركته.`;
    } else {
        reply += `\n\n📦 هذا المنتج فيزيائي، سيتم التواصل معك خلال 24 ساعة.`;
    }
    
    ctx.reply(reply, { parse_mode: 'Markdown' });
});

bot.command('balance', (ctx) => {
    const userId = ctx.from.id;
    const balance = users[userId]?.balance || 0;
    ctx.reply(`💰 *رصيدك الحالي:* ${formatPrice(balance)}`, { parse_mode: 'Markdown' });
});

bot.command('help', (ctx) => {
    ctx.reply(`
🔧 *الأوامر المتاحة:*

📦 *للمستخدمين:*
/start - بدء البوت
/products - عرض المنتجات
/product <رقم> - تفاصيل منتج
/buy <رقم> - شراء منتج
/balance - عرض رصيدك

${isAdmin(ctx.from.id) ? `
🔧 *للمشرف:*
/admin - لوحة تحكم المشرف
/addproduct - إضافة منتج جديد
/editproduct - تعديل منتج
/deleteproduct - حذف منتج
/charge <معرف> <مبلغ> - شحن رصيد
/stats - إحصائيات البوت
/allproducts - عرض كل المنتجات مع الروابط
` : ''}
    `, { parse_mode: 'Markdown' });
});

// ============== لوحة تحكم المشرف ==============

bot.command('admin', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ هذا الأمر للمشرف فقط");
    
    ctx.reply(`
🔧 *لوحة تحكم المشرف*

📦 *إدارة المنتجات:*
/addproduct - إضافة منتج جديد
/editproduct - تعديل منتج
/deleteproduct - حذف منتج
/allproducts - عرض كل المنتجات مع الروابط

💰 *إدارة المستخدمين:*
/charge <معرف> <مبلغ> - شحن رصيد
/users - عرض قائمة المستخدمين

📊 *إحصائيات:*
/stats - إحصائيات البوت
    `, { parse_mode: 'Markdown' });
});

// ============== إضافة منتج جديد (بخطوات تفاعلية) ==============
let waitingForProduct = {}; // تخزين جلسات إضافة المنتج

bot.command('addproduct', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    waitingForProduct[ctx.from.id] = { step: 'name' };
    ctx.reply(`
📝 *إضافة منتج جديد - الخطوة 1/7*

الرجاء إرسال *اسم المنتج*:
(مثال: Kali Linux Pro Kit)
    `, { parse_mode: 'Markdown' });
});

// معالجة الردود التفاعلية لإضافة المنتج
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const session = waitingForProduct[userId];
    
    if (!session) return;
    
    const text = ctx.message.text;
    
    // تجنب تنفيذ الأوامر أثناء جلسة الإضافة
    if (text.startsWith('/')) return;
    
    switch (session.step) {
        case 'name':
            session.name = text;
            session.step = 'price';
            ctx.reply(`✅ الاسم: ${text}\n\nالآن أرسل *سعر المنتج* (بالليرة السورية):\n(مثال: 450000)`, { parse_mode: 'Markdown' });
            break;
            
        case 'price':
            const price = parseInt(text);
            if (isNaN(price)) {
                return ctx.reply("❌ الرجاء إدخال رقم صحيح للسعر");
            }
            session.price = price;
            session.step = 'category';
            ctx.reply(`✅ السعر: ${formatPrice(price)}\n\nالآن أرسل *قسم المنتج*:\n(مثال: اختبار الاختراق, OSINT, VPN, منتجات رقمية, أجهزة)`, { parse_mode: 'Markdown' });
            break;
            
        case 'category':
            session.category = text;
            session.step = 'description';
            ctx.reply(`✅ القسم: ${text}\n\nالآن أرسل *وصف المنتج*:\n(وصف مختصر للمنتج)`, { parse_mode: 'Markdown' });
            break;
            
        case 'description':
            session.description = text;
            session.step = 'link';
            ctx.reply(`✅ الوصف: ${text.substring(0, 50)}...\n\nالآن أرسل *رابط التحميل*:\n(رابط من تليجرام أو جوجل درايف)\n\nإذا لا يوجد رابط، أرسل "لا يوجد"`, { parse_mode: 'Markdown' });
            break;
            
        case 'link':
            session.link = (text === "لا يوجد" || text === "لا" || text === "-") ? "" : text;
            session.step = 'image';
            ctx.reply(`✅ الرابط: ${session.link || "لا يوجد"}\n\nالآن أرسل *رابط الصورة*:\n(رابط صورة المنتج)\n\nإذا لا توجد صورة، أرسل "لا يوجد"`, { parse_mode: 'Markdown' });
            break;
            
        case 'image':
            session.image = (text === "لا يوجد" || text === "لا" || text === "-") ? "" : text;
            session.step = 'stock';
            ctx.reply(`✅ صورة المنتج: ${session.image ? "تم إضافة رابط" : "لا توجد صورة"}\n\nالآن أرسل *المخزون*:\n(الكمية المتوفرة، أو 999 للرقمي)`, { parse_mode: 'Markdown' });
            break;
            
        case 'stock':
            const stock = parseInt(text);
            if (isNaN(stock)) {
                return ctx.reply("❌ الرجاء إدخال رقم صحيح للمخزون");
            }
            session.stock = stock;
            
            // إنشاء المنتج الجديد
            const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
            const newProduct = {
                id: newId,
                name: session.name,
                price: session.price,
                category: session.category,
                description: session.description,
                link: session.link || "",
                image: session.image || "",
                stock: session.stock,
                rating: 4.5,
                createdAt: new Date().toISOString()
            };
            
            products.push(newProduct);
            saveProducts();
            
            // عرض المنتج الجديد
            ctx.reply(`
✅ *تم إضافة المنتج بنجاح!*

${generateProductCard(newProduct)}

📊 عدد المنتجات الآن: ${products.length}
            `, { parse_mode: 'Markdown' });
            
            // تنظيف الجلسة
            delete waitingForProduct[userId];
            break;
    }
});

// ============== تعديل منتج ==============
let editingProduct = {};

bot.command('editproduct', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    if (products.length === 0) {
        return ctx.reply("❌ لا توجد منتجات للتعديل");
    }
    
    let msg = "✏️ *تعديل منتج*\n\nاختر رقم المنتج:\n\n";
    products.forEach(p => {
        msg += `${p.id}. ${p.name} - ${formatPrice(p.price)}\n`;
    });
    msg += `\nأرسل رقم المنتج الذي تريد تعديله:`;
    
    ctx.reply(msg, { parse_mode: 'Markdown' });
    editingProduct[ctx.from.id] = { step: 'select' };
});

// معالجة تعديل المنتج
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const editSession = editingProduct[userId];
    
    if (!editSession) return;
    if (ctx.message.text.startsWith('/')) return;
    
    if (editSession.step === 'select') {
        const productId = parseInt(ctx.message.text);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return ctx.reply("❌ رقم منتج غير صحيح، حاول مرة أخرى");
        }
        
        editSession.productId = productId;
        editSession.step = 'field';
        
        ctx.reply(`
✏️ *تعديل المنتج: ${product.name}*

اختر الحقل الذي تريد تعديله:

1️⃣ الاسم
2️⃣ السعر
3️⃣ القسم
4️⃣ الوصف
5️⃣ رابط التحميل
6️⃣ رابط الصورة
7️⃣ المخزون

أرسل رقم الحقل (1-7):
        `, { parse_mode: 'Markdown' });
    } 
    else if (editSession.step === 'field') {
        const fieldNum = parseInt(ctx.message.text);
        editSession.field = fieldNum;
        
        const fields = {
            1: 'الاسم',
            2: 'السعر',
            3: 'القسم',
            4: 'الوصف',
            5: 'رابط التحميل',
            6: 'رابط الصورة',
            7: 'المخزون'
        };
        
        editSession.fieldName = fields[fieldNum];
        editSession.step = 'value';
        
        ctx.reply(`✏️ أرسل القيمة الجديدة لـ *${fields[fieldNum]}*:`, { parse_mode: 'Markdown' });
    }
    else if (editSession.step === 'value') {
        const productIndex = products.findIndex(p => p.id === editSession.productId);
        if (productIndex === -1) {
            delete editingProduct[userId];
            return ctx.reply("❌ حدث خطأ، المنتج غير موجود");
        }
        
        let newValue = ctx.message.text;
        
        switch (editSession.field) {
            case 1: // الاسم
                products[productIndex].name = newValue;
                break;
            case 2: // السعر
                const price = parseInt(newValue);
                if (isNaN(price)) return ctx.reply("❌ الرجاء إدخال رقم صحيح");
                products[productIndex].price = price;
                newValue = formatPrice(price);
                break;
            case 3: // القسم
                products[productIndex].category = newValue;
                break;
            case 4: // الوصف
                products[productIndex].description = newValue;
                break;
            case 5: // رابط التحميل
                products[productIndex].link = newValue === "لا يوجد" ? "" : newValue;
                break;
            case 6: // رابط الصورة
                products[productIndex].image = newValue === "لا يوجد" ? "" : newValue;
                break;
            case 7: // المخزون
                const stock = parseInt(newValue);
                if (isNaN(stock)) return ctx.reply("❌ الرجاء إدخال رقم صحيح");
                products[productIndex].stock = stock;
                newValue = stock;
                break;
        }
        
        saveProducts();
        
        ctx.reply(`
✅ *تم التعديل بنجاح!*

تم تغيير *${editSession.fieldName}* إلى: ${newValue}

${generateProductCard(products[productIndex])}
        `, { parse_mode: 'Markdown' });
        
        delete editingProduct[userId];
    }
});

// ============== حذف منتج ==============
bot.command('deleteproduct', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    const args = ctx.message.text.split(' ');
    const productId = parseInt(args[1]);
    
    if (isNaN(productId)) {
        let msg = "🗑️ *حذف منتج*\n\nاختر رقم المنتج:\n\n";
        products.forEach(p => {
            msg += `${p.id}. ${p.name}\n`;
        });
        msg += `\nالاستخدام: /deleteproduct <رقم_المنتج>`;
        return ctx.reply(msg, { parse_mode: 'Markdown' });
    }
    
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) return ctx.reply("❌ منتج غير موجود");
    
    const deletedProduct = products[productIndex];
    products.splice(productIndex, 1);
    saveProducts();
    
    ctx.reply(`✅ *تم حذف المنتج:*\n📦 ${deletedProduct.name}`, { parse_mode: 'Markdown' });
});

// ============== عرض جميع المنتجات مع الروابط ==============
bot.command('allproducts', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    if (products.length === 0) {
        return ctx.reply("📦 لا توجد منتجات");
    }
    
    let msg = "📊 *جميع المنتجات مع الروابط*\n\n";
    products.forEach(p => {
        msg += `*${p.id}. ${p.name}*\n`;
        msg += `   💰 ${formatPrice(p.price)}\n`;
        msg += `   📂 ${p.category || "عام"}\n`;
        msg += `   🔗 ${p.link || "لا يوجد رابط"}\n`;
        msg += `   📊 المخزون: ${p.stock}\n`;
        msg += `   ⭐ التقييم: ${p.rating || 4.5}/5\n\n`;
    });
    
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ============== شحن رصيد ==============
bot.command('charge', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    const args = ctx.message.text.split(' ');
    const userId = parseInt(args[1]);
    const amount = parseInt(args[2]);
    
    if (isNaN(userId) || isNaN(amount)) {
        return ctx.reply("⚠️ طريقة الاستخدام:\n/charge <معرف_المستخدم> <المبلغ>\nمثال: /charge 123456789 50000");
    }
    
    if (!users[userId]) {
        users[userId] = { balance: 0, purchases: [], username: null, firstName: null };
    }
    
    users[userId].balance += amount;
    saveUsers();
    
    ctx.reply(`✅ تم شحن ${formatPrice(amount)} للمستخدم \`${userId}\``, { parse_mode: 'Markdown' });
    
    // إرسال إشعار للمستخدم
    try {
        bot.telegram.sendMessage(userId, `🎉 تم شحن رصيدك بمبلغ ${formatPrice(amount)}\n💰 رصيدك الحالي: ${formatPrice(users[userId].balance)}`);
    } catch(e) {}
});

// ============== عرض المستخدمين ==============
bot.command('users', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    const userList = Object.entries(users);
    if (userList.length === 0) return ctx.reply("لا يوجد مستخدمين");
    
    let msg = "👥 *قائمة المستخدمين:*\n\n";
    userList.forEach(([id, data]) => {
        msg += `🆔 \`${id}\`\n`;
        msg += `   👤 ${data.firstName || "بدون اسم"} ${data.username ? `(@${data.username})` : ''}\n`;
        msg += `   💰 الرصيد: ${formatPrice(data.balance)}\n`;
        msg += `   🛒 المشتريات: ${data.purchases?.length || 0}\n\n`;
    });
    
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ============== إحصائيات ==============
bot.command('stats', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ للمشرف فقط");
    
    const totalUsers = Object.keys(users).length;
    const totalSales = users.reduce((sum, u) => sum + (u.purchases?.length || 0), 0);
    const totalRevenue = users.reduce((sum, u) => {
        return sum + (u.purchases?.reduce((s, p) => s + p.price, 0) || 0);
    }, 0);
    
    ctx.reply(`
📊 *إحصائيات البوت*

👥 عدد المستخدمين: ${totalUsers}
🛒 عدد المبيعات: ${totalSales}
💰 إجمالي الإيرادات: ${formatPrice(totalRevenue)}
📦 عدد المنتجات: ${products.length}

🤖 البوت: @${ctx.botInfo.username}
    `, { parse_mode: 'Markdown' });
});

// ============== خادم HTTP لـ Render ==============
const app = express();
app.get('/', (req, res) => res.send('IDLEB X Bot is running!'));
app.get('/products', (req, res) => res.json(products));
app.get('/stats', (req, res) => res.json({ users: Object.keys(users).length, products: products.length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ HTTP server running on port ${PORT}`));

// ============== تشغيل البوت ==============
bot.launch();
console.log('🤖 IDLEB X Bot is running...');
console.log('📦 Products loaded:', products.length);
console.log('👥 Users loaded:', Object.keys(users).length);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
