// const admin = require("firebase-admin");
// const fs = require("fs");
// const path = require("path");
// const CryptoPayHandler = require('./cryptoPay');

// module.exports = (bot, db) => {
//   // ================= 1. ПРЕДЗАГРУЗКА ИЗОБРАЖЕНИЯ =================
//   const welcomeImage = {
//     path: path.join(__dirname, "../../img/welcome.jpg"),
//     buffer: null,
//     fileId: null,
//     load: function () {
//       if (fs.existsSync(this.path)) {
//         this.buffer = fs.readFileSync(this.path);
//         console.log("Изображение welcome.jpg загружено в память");
//       }
//     },
//   };
//   welcomeImage.load();

//   const cryptoPay = new CryptoPayHandler(bot, db);

//   // ================= 2. ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ =================
//   const checkSubscription = async (userId) => {
//     try {
//       const subRef = db.collection("subscriptions").doc(userId.toString());
//       const doc = await subRef.get();

//       if (!doc.exists) {
//         return {
//           active: false,
//           message: "❌ У вас нет активной подписки"
//         };
//       }

//       const subData = doc.data();
//       const isActive = subData.isActive && subData.endDate.toDate() > new Date();

//       let message = "";
//       if (isActive) {
//         const endDate = subData.endDate.toDate();
//         const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

//         if (subData.subscriptionType === "forever") {
//           message = "🎉 У вас бессрочная подписка!";
//         } else {
//           message = `✅ Подписка активна до: ${endDate.toLocaleDateString()} (осталось ${daysLeft} дней)`;
//         }
//       } else {
//         message = "❌ Подписка истекла";
//       }

//       return {
//         active: isActive,
//         message: message,
//         subscription: subData
//       };
//     } catch (error) {
//       console.error("Ошибка проверки подписки:", error);
//       return {
//         active: false,
//         message: "❌ Ошибка проверки подписки"
//       };
//     }
//   };

//   // ================= 3. ФУНКЦИЯ ОЧИСТКИ ЧАТА =================
//   const clearChat = async (ctx) => {
//     try {
//       const chatId = ctx.chat.id;
//       const messageId = ctx.message ? ctx.message.message_id : ctx.update.callback_query.message.message_id;

//       // Удаляем текущее сообщение
//       await ctx.deleteMessage();

//       // Удаляем предыдущие сообщения (до 10 штук)
//       for (let i = 1; i <= 10; i++) {
//         try {
//           await ctx.telegram.deleteMessage(chatId, messageId - i);
//         } catch (e) {
//           // Игнорируем ошибки (сообщения могут не существовать)
//         }
//       }

//       return true;
//     } catch (error) {
//       console.error("Ошибка при очистке чата:", error);
//       return false;
//     }
//   };

//   // ================= 4. ФУНКЦИЯ ОЧИСТКИ ЭКРАНА =================
//   const clearScreen = async (ctx) => {
//     try {
//       await clearChat(ctx);

//       // Отправляем главное меню
//       const userId = ctx.from.id;
//       const subscription = await checkSubscription(userId);
//       const hasSub = subscription.active;

//       const baseKeyboard = [];

//       if (hasSub) {
//         baseKeyboard.push([{ text: "🌍 Все страны", callback_data: "all_countries" }]);
//       }

//       baseKeyboard.push([{ text: "💎 Купить подписку", callback_data: "choose_payment_method" }]);
//       baseKeyboard.push([{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]);

//       const welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств Эскорт💋 Блокнот🥕</b>
// <em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
// <a href="http://t.me/escortnotebook"><b>Подпишись на новости и обновления ❤️</b></a>\n`;

//       try {
//         if (welcomeImage.fileId) {
//           await ctx.replyWithPhoto(welcomeImage.fileId, {
//             caption: welcomeText,
//             parse_mode: "HTML",
//             reply_markup: { inline_keyboard: baseKeyboard },
//           });
//         } else if (welcomeImage.buffer) {
//           const msg = await ctx.replyWithPhoto(
//             { source: welcomeImage.buffer },
//             {
//               caption: welcomeText,
//               parse_mode: "HTML",
//               reply_markup: { inline_keyboard: baseKeyboard },
//             }
//           );
//           welcomeImage.fileId = msg.photo[0].file_id;
//         } else {
//           await ctx.reply(welcomeText, {
//             parse_mode: "HTML",
//             reply_markup: { inline_keyboard: baseKeyboard },
//           });
//         }
//       } catch (e) {
//         console.error("Ошибка отправки welcome:", e);
//         await ctx.reply(welcomeText, {
//           parse_mode: "HTML",
//           reply_markup: { inline_keyboard: baseKeyboard },
//         });
//       }

//       if (hasSub) {
//         setTimeout(async () => {
//           try {
//             await ctx.reply(subscription.message, { parse_mode: "HTML" });
//           } catch (e) {
//             console.error("Ошибка отправки статуса подписки:", e);
//           }
//         }, 500);
//       }

//     } catch (error) {
//       console.error("Ошибка при очистке экрана:", error);
//       // Если очистка не удалась, просто отправляем главное меню
//       await showMainMenu(ctx);
//     }
//   };

//   // ================= 5. ФУНКЦИЯ ОТОБРАЖЕНИЯ ГЛАВНОГО МЕНЮ =================
//   const showMainMenu = async (ctx) => {
//     const userId = ctx.from.id;
//     const subscription = await checkSubscription(userId);
//     const hasSub = subscription.active;

//     const baseKeyboard = [];

//     if (hasSub) {
//       baseKeyboard.push([{ text: "🌍 Все страны", callback_data: "all_countries" }]);
//     }

//     baseKeyboard.push([{ text: "💎 Купить подписку", callback_data: "choose_payment_method" }]);
//     baseKeyboard.push([{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]);

//     const welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств Эскорт💋 Блокнот🥕</b>
// <em>Здесь ты найдёшь базу данных анкет со всего мира для общения.
// 🎉 База обновляется и пополняется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
// <a href="http://t.me/escortnotebook"><b>Подпишись на новости и обновления ❤️</b></a>\n`;

//     try {
//       if (welcomeImage.fileId) {
//         await ctx.replyWithPhoto(welcomeImage.fileId, {
//           caption: welcomeText,
//           parse_mode: "HTML",
//           reply_markup: { inline_keyboard: baseKeyboard },
//         });
//       } else if (welcomeImage.buffer) {
//         const msg = await ctx.replyWithPhoto(
//           { source: welcomeImage.buffer },
//           {
//             caption: welcomeText,
//             parse_mode: "HTML",
//             reply_markup: { inline_keyboard: baseKeyboard },
//           }
//         );
//         welcomeImage.fileId = msg.photo[0].file_id;
//       } else {
//         await ctx.reply(welcomeText, {
//           parse_mode: "HTML",
//           reply_markup: { inline_keyboard: baseKeyboard },
//         });
//       }
//     } catch (e) {
//       console.error("Ошибка отправки welcome:", e);
//       await ctx.reply(welcomeText, {
//         parse_mode: "HTML",
//         reply_markup: { inline_keyboard: baseKeyboard },
//       });
//     }

//     if (hasSub) {
//       setTimeout(async () => {
//         try {
//           await ctx.reply(subscription.message, { parse_mode: "HTML" });
//         } catch (e) {
//           console.error("Ошибка отправки статуса подписки:", e);
//         }
//       }, 500);
//     }
//   };

//   // ================= 6. ИНИЦИАЛИЗАЦИЯ КОЛЛЕКЦИЙ =================
//   const initCollections = async () => {
//     const collections = ["subscriptions", "transactions", "payment_logs", "cryptoPayPayments"];
//     for (const col of collections) {
//       try {
//         const ref = db.collection(col).doc("init");
//         await ref.set({ _init: true });
//         await ref.delete();
//       } catch (error) {
//         console.log(`Коллекция ${col} уже существует`);
//       }
//     }
//   };

//   // ================= 7. ОБРАБОТЧИК START =================
//   bot.start(async (ctx) => {
//     initCollections().catch((e) => console.error("Ошибка инициализации:", e));
//     await showMainMenu(ctx);
//   });

//   // ================= 8. ОБРАБОТЧИК ОЧИСТКИ ЭКРАНА =================
//   bot.action("clear_screen", async (ctx) => {
//     await clearScreen(ctx);
//   });

//   // ================= 9. ВЫБОР СПОСОБА ОПЛАТЫ =================
//   bot.action("choose_payment_method", async (ctx) => {
//     const keyboard = {
//       inline_keyboard: [
//         [
//           {
//             text: "⭐ Оплата Stars",
//             callback_data: "show_stars_plans"
//           }
//         ],
//         [
//           {
//             text: "₿ Оплата USDT (Crypto Pay)",
//             callback_data: "show_crypto_plans"
//           }
//         ],
//         [
//           {
//             text: "🔙 Назад",
//             callback_data: "back_to_main"
//           },
//           {
//             text: "🧹 Очистить экран",
//             callback_data: "clear_screen"
//           }
//         ]
//       ]
//     };

//     await ctx.reply(
//       `💎 <b>ВЫБЕРИ СПОСОБ ОПЛАТЫ</b>\n\n` +
//       `⭐ <b>Stars</b> - оплата через Telegram\n` +
//       `• Быстро и удобно\n` +
//       `• Внутри Telegram\n\n` +
//       `₿ <b>USDT (Crypto Pay)</b> - оплата криптовалютой\n` +
//       `• Анонимно и безопасно\n` +
//       `• Поддержка USDT, BTC, ETH\n\n` +
//       `<b>Выбери способ оплаты:</b>`,
//       {
//         parse_mode: "HTML",
//         reply_markup: keyboard
//       }
//     );
//   });

//   // ================= 10. ТАРИФЫ ДЛЯ STARS =================
//   bot.action("show_stars_plans", async (ctx) => {
//     const keyboard = {
//       inline_keyboard: [
//         [
//           {
//             text: "🔥 1 день (399🌟)",
//             callback_data: "buy_1day",
//           },
//         ],
//         [
//           {
//             text: "❤️ 1 месяц (799🌟)",
//             callback_data: "buy_1month",
//           },
//         ],
//         [
//           {
//             text: "💫 1 год (3999🌟)",
//             callback_data: "buy_forever",
//           },
//         ],
//         [
//           {
//             text: "🔙 Назад",
//             callback_data: "choose_payment_method",
//           },
//           {
//             text: "🧹 Очистить экран",
//             callback_data: "clear_screen",
//           }
//         ]
//       ]
//     };

//     await ctx.reply(
//       `⭐ <b>ОПЛАТА STARS</b>\n\n` +
//       `Выбери тариф подписки:\n\n` +
//       `🔥 <b>1 день</b> - 399 Stars\n` +
//       `❤️ <b>1 месяц</b> - 799 Stars\n` +
//       `💫 <b>1 год</b> - 3999 Stars\n\n` +
//       `<b>Выбери тариф:</b>`,
//       {
//         parse_mode: "HTML",
//         reply_markup: keyboard
//       }
//     );
//   });

//   // ================= 11. ТАРИФЫ ДЛЯ CRYPTO PAY =================
//   bot.action("show_crypto_plans", async (ctx) => {
//     const keyboard = {
//       inline_keyboard: [
//         [
//           {
//             text: "🟢 1 день - 5 USDT",
//             callback_data: "crypto_basic"
//           }
//         ],
//         [
//           {
//             text: "🔵 1 месяц - 10 USDT",
//             callback_data: "crypto_pro"
//           }
//         ],
//         [
//           {
//             text: "🟣 1 год - 50 USDT",
//             callback_data: "crypto_premium"
//           }
//         ],
//         [
//           {
//             text: "🔙 Назад",
//             callback_data: "choose_payment_method"
//           },
//           {
//             text: "🧹 Очистить экран",
//             callback_data: "clear_screen"
//           }
//         ]
//       ]
//     };

//     await ctx.reply(
//       `₿ <b>ОПЛАТА USDT (CRYPTO PAY)</b>\n\n` +
//       `Выбери тариф подписки:\n\n` +
//       `🟢 <b>1 день</b> - 5 USDT\n` +
//       `🔵 <b>1 месяц</b> - 10 USDT\n` +
//       `🟣 <b>1 год</b> - 50 USDT\n\n` +
//       `<b>Выбери тариф:</b>`,
//       {
//         parse_mode: "HTML",
//         reply_markup: keyboard
//       }
//     );
//   });

//   // ================= 12. ОБРАБОТКА CRYPTO PAY ПЛАТЕЖЕЙ =================
//   bot.action(/crypto_(.+)/, async (ctx) => {
//     const plan = ctx.match[1];
//     let planData;

//     if (plan === 'basic') {
//       planData = { amount: 5, name: '1 день', duration: 1 };
//     } else if (plan === 'pro') {
//       planData = { amount: 10, name: '1 месяц', duration: 30 };
//     } else if (plan === 'premium') {
//       planData = { amount: 50, name: '1 год', duration: 365 };
//     } else {
//       await ctx.reply('❌ Неизвестный тариф');
//       return;
//     }

//     try {
//       console.log(`Создание инвойса для плана: ${plan}, сумма: ${planData.amount} USDT`);

//       const invoice = await cryptoPay.createInvoice(
//         planData.amount,
//         `Подписка: ${planData.name}`
//       );

//       if (!invoice || !invoice.invoice_id) {
//         console.error('Инвойс не создан:', invoice);
//         await ctx.reply('❌ Ошибка при создании счета. Попробуй еще раз.');
//         return;
//       }

//       console.log('Инвойс создан успешно:', invoice);

//       const paymentData = {
//         userId: ctx.from.id,
//         plan: plan === 'basic' ? '1day' : plan === 'pro' ? '1month' : 'forever',
//         invoiceId: invoice.invoice_id,
//         amount: planData.amount,
//         asset: 'USDT',
//         status: 'active',
//         createdAt: admin.firestore.FieldValue.serverTimestamp(),
//         expiresAt: new Date(Date.now() + 3600 * 1000)
//       };

//       const paymentRef = await db.collection('cryptoPayPayments').add(paymentData);

//       const keyboard = {
//         inline_keyboard: [
//           [{
//             text: '💳 ОПЛАТИТЬ В @CryptoBot',
//             url: `https://t.me/CryptoBot?start=${invoice.hash}`
//           }],
//           [{
//             text: '✅ Я ОПЛАТИЛ',
//             callback_data: `check_crypto_${paymentRef.id}`
//           }],
//           [
//             {
//               text: '🔙 НАЗАД',
//               callback_data: 'show_crypto_plans'
//             },
//             {
//               text: '🧹 Очистить экран',
//               callback_data: 'clear_screen'
//             }
//           ]
//         ]
//       };

//       await ctx.reply(
//         `💎 <b>${planData.name}</b>\n` +
//         `₿ <b>ОПЛАТА ЧЕРЕЗ CRYPTO PAY</b>\n\n` +
//         `💰 <b>Сумма:</b> ${planData.amount} USDT\n` +
//         `⏰ <b>Время на оплату:</b> 1 час\n\n` +
//         `📋 <b>Инструкция:</b>\n` +
//         `1. Нажми "ОПЛАТИТЬ В @CryptoBot"\n` +
//         `2. Оплати счет в боте @CryptoBot\n` +
//         `3. Вернись и нажми "Я ОПЛАТИЛ"\n\n` +
//         `🆔 <b>ID платежа:</b> <code>${paymentRef.id}</code>\n` +
//         `🆔 <b>ID счета:</b> <code>${invoice.invoice_id}</code>`,
//         {
//           parse_mode: "HTML",
//           reply_markup: keyboard
//         }
//       );

//     } catch (error) {
//       console.error('Crypto Pay error:', error);
//       await ctx.reply('❌ Ошибка при создании платежа. Проверь настройки Crypto Pay.');
//     }
//   });

//   // ================= 13. ПРОВЕРКА CRYPTO PAY ПЛАТЕЖА =================
//   bot.action(/check_crypto_(.+)/, async (ctx) => {
//     const paymentId = ctx.match[1];

//     try {
//       await ctx.answerCbQuery('🔍 Проверяем платеж...');

//       const paymentDoc = await db.collection('cryptoPayPayments').doc(paymentId).get();

//       if (!paymentDoc.exists) {
//         await ctx.answerCbQuery('❌ Платеж не найден');
//         return;
//       }

//       const payment = paymentDoc.data();

//       if (payment.userId !== ctx.from.id) {
//         await ctx.answerCbQuery('❌ Это не ваш платеж');
//         return;
//       }

//       let invoice;
//       try {
//         invoice = await cryptoPay.getInvoice(payment.invoiceId);
//       } catch (error) {
//         console.error('Ошибка получения инвойса:', error);
//         await ctx.answerCbQuery('❌ Ошибка проверки счета');
//         return;
//       }

//       if (!invoice) {
//         await ctx.answerCbQuery('❌ Счет не найден или истек');
//         return;
//       }

//       console.log(`Статус инвойса ${payment.invoiceId}:`, invoice.status);

//       if (invoice.status === 'paid') {
//         const planId = payment.plan;
//         const subRef = db.collection("subscriptions").doc(ctx.from.id.toString());
//         const subData = {
//           userId: ctx.from.id,
//           plan: planId,
//           subscriptionType: planId,
//           startDate: admin.firestore.FieldValue.serverTimestamp(),
//           status: "active",
//           isActive: true,
//           lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
//           paymentMethod: 'crypto'
//         };

//         if (planId === "1day") {
//           subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000));
//         } else if (planId === "1month") {
//           subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000));
//         } else if (planId === "forever") {
//           subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 86400000));
//         }

//         await subRef.set(subData, { merge: true });
//         await paymentDoc.ref.update({
//           status: 'paid',
//           paidAt: admin.firestore.FieldValue.serverTimestamp()
//         });

//         const subscription = await checkSubscription(ctx.from.id);
//         const keyboard = {
//           inline_keyboard: [
//             [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//             [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]
//           ]
//         };

//         await ctx.reply(
//           `🎉 <b>ПЛАТЕЖ ПОДТВЕРЖДЕН!</b>\n\n` +
//           `✅ Подписка успешно активирована!\n\n` +
//           `${subscription.message}`,
//           {
//             parse_mode: "HTML",
//             reply_markup: keyboard,
//           }
//         );
//       } else {
//         let statusText = 'не оплачен';
//         if (invoice.status === 'active') statusText = 'ожидает оплаты';
//         if (invoice.status === 'expired') statusText = 'истек';

//         await ctx.answerCbQuery(`❌ Счет ${statusText}. Попробуй через минуту.`);
//       }

//     } catch (error) {
//       console.error('Payment check error:', error);
//       await ctx.answerCbQuery('❌ Ошибка проверки платежа');
//     }
//   });

//   // ================= 14. ОБРАБОТЧИКИ ПОДПИСОК STARS =================
//   const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
//     try {
//       await ctx.replyWithInvoice({
//         title: `Подписка на ${
//           planId === "1day"
//             ? "1 день"
//             : planId === "1month"
//             ? "1 месяц"
//             : "1 год"
//         }`,
//         description:
//           planId === "1day"
//             ? "Доступ на 24 часа"
//             : planId === "1month"
//             ? "Доступ на 30 дней"
//             : "Доступ на 365 дней",
//         payload: `${planId}_${ctx.from.id}_${Date.now()}`,
//         currency: "XTR",
//         prices: [{ label: "Подписка", amount: amount }],
//         start_parameter: `${planId}_sub`,
//       });
//     } catch (error) {
//       console.error("Ошибка создания счета:", error);
//       await ctx.reply("⚠️ Ошибка при создании платежа");
//     }
//   };

//   bot.action("buy_1day", (ctx) =>
//     handleSubscriptionPurchase(ctx, "1day", 399, 86400000)
//   );
//   bot.action("buy_1month", (ctx) =>
//     handleSubscriptionPurchase(ctx, "1month", 799, 2592000000)
//   );
//   bot.action("buy_forever", (ctx) =>
//     handleSubscriptionPurchase(ctx, "forever", 3999, 31536000000)
//   );

//   bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

//   bot.on("successful_payment", async (ctx) => {
//     const userId = ctx.from.id;
//     const payment = ctx.message.successful_payment;
//     const [planId, _] = payment.invoice_payload.split("_");

//     try {
//       await clearChat(ctx);

//       const subRef = db.collection("subscriptions").doc(userId.toString());
//       const subData = {
//         userId,
//         plan: planId,
//         subscriptionType: planId,
//         startDate: admin.firestore.FieldValue.serverTimestamp(),
//         status: "active",
//         isActive: true,
//         lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
//         paymentMethod: 'stars'
//       };

//       if (planId === "1day") {
//         subData.endDate = admin.firestore.Timestamp.fromDate(
//           new Date(Date.now() + 86400000)
//         );
//       } else if (planId === "1month") {
//         subData.endDate = admin.firestore.Timestamp.fromDate(
//           new Date(Date.now() + 2592000000)
//         );
//       } else if (planId === "forever") {
//         subData.endDate = admin.firestore.Timestamp.fromDate(
//           new Date(Date.now() + 31536000000)
//         );
//       }

//       await subRef.set(subData, { merge: true });

//       const subscription = await checkSubscription(userId);
//       const keyboard = {
//         inline_keyboard: [
//           [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//           [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]
//         ]
//       };

//       await ctx.reply(
//         `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`,
//         {
//           parse_mode: "HTML",
//           reply_markup: keyboard,
//         }
//       );
//     } catch (error) {
//       console.error("Ошибка обработки платежа:", error);
//       await ctx.reply("⚠️ Ошибка активации подписки");
//     }
//   });

//   // ================= 15. НАЗАД В ГЛАВНОЕ МЕНЮ =================
//   bot.action("back_to_main", async (ctx) => {
//     await showMainMenu(ctx);
//   });
// };

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const CryptoPayHandler = require("./cryptoPay");

module.exports = (bot, db) => {
  // ================= 1. ПРЕДЗАГРУЗКА ИЗОБРАЖЕНИЯ =================
  const welcomeImage = {
    path: path.join(__dirname, "../../img/welcome.jpg"),
    buffer: null,
    fileId: null,
    load: function () {
      if (fs.existsSync(this.path)) {
        this.buffer = fs.readFileSync(this.path);
        console.log("Изображение welcome.jpg загружено в память");
      }
    },
  };
  welcomeImage.load();

  const cryptoPay = new CryptoPayHandler(bot, db);

  // ================= 2. ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ =================
  const checkSubscription = async (userId) => {
    try {
      const subRef = db.collection("subscriptions").doc(userId.toString());
      const doc = await subRef.get();

      if (!doc.exists) {
        return {
          active: false,
          message: "❌ У вас нет активной подписки",
        };
      }

      const subData = doc.data();
      const isActive =
        subData.isActive && subData.endDate.toDate() > new Date();

      let message = "";
      if (isActive) {
        const endDate = subData.endDate.toDate();
        const daysLeft = Math.ceil(
          (endDate - new Date()) / (1000 * 60 * 60 * 24)
        );

        if (subData.subscriptionType === "forever") {
          message = "🎉 У вас бессрочная подписка!";
        } else {
          message = `✅ Подписка активна до: ${endDate.toLocaleDateString()} (осталось ${daysLeft} дней)`;
        }
      } else {
        message = "❌ Подписка истекла";
      }

      return {
        active: isActive,
        message: message,
        subscription: subData,
      };
    } catch (error) {
      console.error("Ошибка проверки подписки:", error);
      return {
        active: false,
        message: "❌ Ошибка проверки подписки",
      };
    }
  };

  // ================= 3. ФУНКЦИЯ ОЧИСТКИ ЧАТА =================
  const clearChat = async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const messageId = ctx.message
        ? ctx.message.message_id
        : ctx.update.callback_query.message.message_id;

      // Удаляем текущее сообщение
      await ctx.deleteMessage();

      // Удаляем предыдущие сообщения (до 10 штук)
      for (let i = 1; i <= 10; i++) {
        try {
          await ctx.telegram.deleteMessage(chatId, messageId - i);
        } catch (e) {
          // Игнорируем ошибки (сообщения могут не существовать)
        }
      }

      return true;
    } catch (error) {
      console.error("Ошибка при очистке чата:", error);
      return false;
    }
  };

  // ================= 4. ФУНКЦИЯ ОЧИСТКИ ЭКРАНА =================
  const clearScreen = async (ctx) => {
    try {
      await clearChat(ctx);

      // Отправляем главное меню
      const userId = ctx.from.id;
      const subscription = await checkSubscription(userId);
      const hasSub = subscription.active;

      const baseKeyboard = [];

      if (hasSub) {
        baseKeyboard.push([
          { text: "🌍 Все страны", callback_data: "all_countries" },
        ]);
      }
if (!hasSub) {
baseKeyboard.push([
        { text: "🌍 Все страны", callback_data: "choose_payment_method" },
      ]);}

      baseKeyboard.push([
        { text: "💎 Купить подписку", callback_data: "choose_payment_method" },
      ]);
      baseKeyboard.push([
        { text: "🧹 Очистить экран", callback_data: "clear_screen" },
      ]);

      const welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в клуб  ✨Magic</b> 
<em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
🎉 Каталог обновляется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
<a href="http://t.me/escortnotebook"><b>Подпишись на новости и обновления ❤️</b></a>\n`;

      try {
        if (welcomeImage.fileId) {
          await ctx.replyWithPhoto(welcomeImage.fileId, {
            caption: welcomeText,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: baseKeyboard },
          });
        } else if (welcomeImage.buffer) {
          const msg = await ctx.replyWithPhoto(
            { source: welcomeImage.buffer },
            {
              caption: welcomeText,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: baseKeyboard },
            }
          );
          welcomeImage.fileId = msg.photo[0].file_id;
        } else {
          await ctx.reply(welcomeText, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: baseKeyboard },
          });
        }
      } catch (e) {
        console.error("Ошибка отправки welcome:", e);
        await ctx.reply(welcomeText, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: baseKeyboard },
        });
      }

      if (hasSub) {
        setTimeout(async () => {
          try {
            await ctx.reply(subscription.message, { parse_mode: "HTML" });
          } catch (e) {
            console.error("Ошибка отправки статуса подписки:", e);
          }
        }, 500);
      }
    } catch (error) {
      console.error("Ошибка при очистке экрана:", error);
      // Если очистка не удалась, просто отправляем главное меню
      await showMainMenu(ctx);
    }
  };

  // ================= 5. ФУНКЦИЯ ОТОБРАЖЕНИЯ ГЛАВНОГО МЕНЮ =================
  const showMainMenu = async (ctx) => {
    const userId = ctx.from.id;
    const subscription = await checkSubscription(userId);
    const hasSub = subscription.active;

    const baseKeyboard = [];

    if (hasSub) {
      baseKeyboard.push([
        { text: "🌍 Все страны", callback_data: "all_countries" },
      ]);
    }
    if (!hasSub) {
baseKeyboard.push([
        { text: "🌍 Все страны", callback_data: "choose_payment_method" },
      ]);}
    baseKeyboard.push([
      { text: "💎 Купить подписку", callback_data: "choose_payment_method" },
    ]);
    baseKeyboard.push([
      { text: "🧹 Очистить экран", callback_data: "clear_screen" },
    ]);

    const welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в клуб знакомств ✨Magic!</b> 
<em>Здесь ты найдёшь базу данных анкет со всего мира для общения и не только. 
🗄️ База обновляется и пополняется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
<a href="http://magicsuperboss"><b>Подпишись на новости и обновления ❤️</b></a>\n`;

    try {
      if (welcomeImage.fileId) {
        await ctx.replyWithPhoto(welcomeImage.fileId, {
          caption: welcomeText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: baseKeyboard },
        });
      } else if (welcomeImage.buffer) {
        const msg = await ctx.replyWithPhoto(
          { source: welcomeImage.buffer },
          {
            caption: welcomeText,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: baseKeyboard },
          }
        );
        welcomeImage.fileId = msg.photo[0].file_id;
      } else {
        await ctx.reply(welcomeText, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: baseKeyboard },
        });
      }
    } catch (e) {
      console.error("Ошибка отправки welcome:", e);
      await ctx.reply(welcomeText, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: baseKeyboard },
      });
    }

    if (hasSub) {
      setTimeout(async () => {
        try {
          await ctx.reply(subscription.message, { parse_mode: "HTML" });
        } catch (e) {
          console.error("Ошибка отправки статуса подписки:", e);
        }
      }, 500);
    }
  };

  // ================= 6. ИНИЦИАЛИЗАЦИЯ КОЛЛЕКЦИЙ =================
  const initCollections = async () => {
    const collections = [
      "subscriptions",
      "transactions",
      "payment_logs",
      "cryptoPayPayments",
    ];
    for (const col of collections) {
      try {
        const ref = db.collection(col).doc("init");
        await ref.set({ _init: true });
        await ref.delete();
      } catch (error) {
        console.log(`Коллекция ${col} уже существует`);
      }
    }
  };

  // ================= 7. ОБРАБОТЧИК START =================
  bot.start(async (ctx) => {
    initCollections().catch((e) => console.error("Ошибка инициализации:", e));
    await showMainMenu(ctx);
  });

  // ================= 8. ОБРАБОТЧИК ОЧИСТКИ ЭКРАНА =================
  bot.action("clear_screen", async (ctx) => {
    await clearScreen(ctx);
  });

  // ================= 9. ВЫБОР СПОСОБА ОПЛАТЫ =================
  bot.action("choose_payment_method", async (ctx) => {
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "⭐ Оплата Stars",
            callback_data: "show_stars_plans",
          },
        ],
        [
          {
            text: "💲 Оплата USDT ",
            callback_data: "show_crypto_plans",
          },
        ],
        [
          {
            text: "💎 Оплата TON",
            callback_data: "show_ton_plans",
          },
        ],
        [
          {
            text: "🔙 Назад",
            callback_data: "back_to_main",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    await ctx.reply(
      `💎 <b>ВЫБЕРИ СПОСОБ ОПЛАТЫ</b>\n\n` +
        `⭐ <b>Stars</b> - оплата через Telegram\n` +
        `• Быстро и удобно\n` +
        `• Внутри Telegram\n\n` +
        ` 💲 <b>USDT </b> - оплата криптовалютой\n` +
        `• Анонимно и безопасно\n` +
        `• Поддержка USDT, BTC, ETH\n\n` +
        `💎 <b>TON</b> - оплата в Toncoin\n` +
        `• Быстрые переводы\n` +
        `• Низкие комиссии\n\n` +
        `<b>Выбери способ оплаты:</b>`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  });

  // ================= 10. ТАРИФЫ ДЛЯ STARS =================
  bot.action("show_stars_plans", async (ctx) => {
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔥 1 день (399🌟)",
            callback_data: "buy_1day",
          },
        ],
        [
          {
            text: "❤️ 1 месяц (799🌟)",
            callback_data: "buy_1month",
          },
        ],
        [
          {
            text: "💫 1 год (3999🌟)",
            callback_data: "buy_forever",
          },
        ],
        [
          {
            text: "🔙 Назад",
            callback_data: "choose_payment_method",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    await ctx.reply(
      `⭐ <b>ОПЛАТА STARS</b>\n\n` +
        `Выбери тариф подписки:\n\n` +
        `🔥 <b>1 день</b> - 399 Stars\n` +
        `❤️ <b>1 месяц</b> - 799 Stars\n` +
        `💫 <b>1 год</b> - 3999 Stars\n\n` +
        `<b>Выбери тариф:</b>`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  });

  // ================= 11. ТАРИФЫ ДЛЯ CRYPTO PAY =================
  bot.action("show_crypto_plans", async (ctx) => {
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🟢 1 день - 5 USDT",
            callback_data: "crypto_basic",
          },
        ],
        [
          {
            text: "🔵 1 месяц - 10 USDT",
            callback_data: "crypto_pro",
          },
        ],
        [
          {
            text: "🟣 1 год - 50 USDT",
            callback_data: "crypto_premium",
          },
        ],
        [
          {
            text: "🔙 Назад",
            callback_data: "choose_payment_method",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    await ctx.reply(
      ` <b>ОПЛАТА USDT )</b>\n\n` +
        `Выбери тариф подписки:\n\n` +
        `🟢 <b>1 день</b> - 5 USDT\n` +
        `🔵 <b>1 месяц</b> - 10 USDT\n` +
        `🟣 <b>1 год</b> - 50 USDT\n\n` +
        `<b>Выбери тариф:</b>`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  });

  // ================= 12. ТАРИФЫ ДЛЯ TON =================
  bot.action("show_ton_plans", async (ctx) => {
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🟡 1 день - 1.5 TON",
            callback_data: "ton_basic",
          },
        ],
        [
          {
            text: "🟠 1 месяц - 3.5 TON",
            callback_data: "ton_pro",
          },
        ],
        [
          {
            text: "🔴 1 год - 15 TON",
            callback_data: "ton_premium",
          },
        ],
        [
          {
            text: "🔙 Назад",
            callback_data: "choose_payment_method",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    await ctx.reply(
      `💎 <b>ОПЛАТА TON</b>\n\n` +
        `Выбери тариф подписки:\n\n` +
        `🟡 <b>1 день</b> - 1.5 TON\n` +
        `🟠 <b>1 месяц</b> - 3.5 TON\n` +
        `🔴 <b>1 год</b> - 15 TON\n\n` +
        `<b>Выбери тариф:</b>`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  });

  // ================= 13. ОБРАБОТКА CRYPTO PAY ПЛАТЕЖЕЙ =================
  bot.action(/crypto_(.+)/, async (ctx) => {
    const plan = ctx.match[1];
    let planData;

    if (plan === "basic") {
      planData = { amount: 5, name: "1 день", duration: 1, asset: "USDT" };
    } else if (plan === "pro") {
      planData = { amount: 10, name: "1 месяц", duration: 30, asset: "USDT" };
    } else if (plan === "premium") {
      planData = { amount: 50, name: "1 год", duration: 365, asset: "USDT" };
    } else {
      await ctx.reply("❌ Неизвестный тариф");
      return;
    }

    try {
      console.log(
        `Создание инвойса для плана: ${plan}, сумма: ${planData.amount} ${planData.asset}`
      );

      const invoice = await cryptoPay.createInvoice(
        planData.amount,
        `Подписка: ${planData.name}`
      );

      if (!invoice || !invoice.invoice_id) {
        console.error("Инвойс не создан:", invoice);
        await ctx.reply("❌ Ошибка при создании счета. Попробуй еще раз.");
        return;
      }

      console.log("Инвойс создан успешно:", invoice);

      const paymentData = {
        userId: ctx.from.id,
        plan: plan === "basic" ? "1day" : plan === "pro" ? "1month" : "forever",
        invoiceId: invoice.invoice_id,
        amount: planData.amount,
        asset: planData.asset,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      const paymentRef = await db
        .collection("cryptoPayPayments")
        .add(paymentData);

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "💳 ОПЛАТИТЬ В @CryptoBot",
              url: `https://t.me/CryptoBot?start=${invoice.hash}`,
            },
          ],
          [
            {
              text: "✅ Я ОПЛАТИЛ",
              callback_data: `check_crypto_${paymentRef.id}`,
            },
          ],
          [
            {
              text: "🔙 НАЗАД",
              callback_data: "show_crypto_plans",
            },
            {
              text: "🧹 Очистить экран",
              callback_data: "clear_screen",
            },
          ],
        ],
      };

      await ctx.reply(
        `💎 <b>${planData.name}</b>\n` +
          `💲 <b>ОПЛАТА ЧЕРЕЗ CRYPTO PAY</b>\n\n` +
          `💰 <b>Сумма:</b> ${planData.amount} ${planData.asset}\n` +
          `⏰ <b>Время на оплату:</b> 1 час\n\n` +
          `📋 <b>Инструкция:</b>\n` +
          `1. Нажми "ОПЛАТИТЬ В @CryptoBot"\n` +
          `2. Оплати счет в боте @CryptoBot\n` +
          `3. Вернись и нажми "Я ОПЛАТИЛ"\n\n` +
          `🆔 <b>ID платежа:</b> <code>${paymentRef.id}</code>\n` +
          `🆔 <b>ID счета:</b> <code>${invoice.invoice_id}</code>`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      console.error("Crypto Pay error:", error);
      await ctx.reply(
        "❌ Ошибка при создании платежа. Проверь настройки Crypto Pay."
      );
    }
  });

  // ================= 14. ОБРАБОТКА TON ПЛАТЕЖЕЙ =================
  bot.action(/ton_(.+)/, async (ctx) => {
    const plan = ctx.match[1];
    let planData;

    if (plan === "basic") {
      planData = { amount: 1.5, name: "1 день", duration: 1, asset: "TON" };
    } else if (plan === "pro") {
      planData = { amount: 3.5, name: "1 месяц", duration: 30, asset: "TON" };
    } else if (plan === "premium") {
      planData = { amount: 15, name: "1 год", duration: 365, asset: "TON" };
    } else {
      await ctx.reply("❌ Неизвестный тариф");
      return;
    }

    try {
      console.log(
        `Создание TON инвойса для плана: ${plan}, сумма: ${planData.amount} ${planData.asset}`
      );

      const invoice = await cryptoPay.createInvoice(
        planData.amount,
        `Подписка: ${planData.name}`,
        "TON"
      );

      if (!invoice || !invoice.invoice_id) {
        console.error("TON инвойс не создан:", invoice);
        await ctx.reply("❌ Ошибка при создании счета. Попробуй еще раз.");
        return;
      }

      console.log("TON инвойс создан успешно:", invoice);

      const paymentData = {
        userId: ctx.from.id,
        plan: plan === "basic" ? "1day" : plan === "pro" ? "1month" : "forever",
        invoiceId: invoice.invoice_id,
        amount: planData.amount,
        asset: planData.asset,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      const paymentRef = await db
        .collection("cryptoPayPayments")
        .add(paymentData);

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "💳 ОПЛАТИТЬ В @CryptoBot",
              url: `https://t.me/CryptoBot?start=${invoice.hash}`,
            },
          ],
          [
            {
              text: "✅ Я ОПЛАТИЛ",
              callback_data: `check_crypto_${paymentRef.id}`,
            },
          ],
          [
            {
              text: "🔙 НАЗАД",
              callback_data: "show_ton_plans",
            },
            {
              text: "🧹 Очистить экран",
              callback_data: "clear_screen",
            },
          ],
        ],
      };

      await ctx.reply(
        `💎 <b>${planData.name}</b>\n` +
          `💎 <b>ОПЛАТА TON</b>\n\n` +
          `💰 <b>Сумма:</b> ${planData.amount} ${planData.asset}\n` +
          `⏰ <b>Время на оплату:</b> 1 час\n\n` +
          `📋 <b>Инструкция:</b>\n` +
          `1. Нажми "ОПЛАТИТЬ В @CryptoBot"\n` +
          `2. Оплати счет в боте @CryptoBot\n` +
          `3. Вернись и нажми "Я ОПЛАТИЛ"\n\n` +
          `🆔 <b>ID платежа:</b> <code>${paymentRef.id}</code>\n` +
          `🆔 <b>ID счета:</b> <code>${invoice.invoice_id}</code>`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      console.error("TON Pay error:", error);
      await ctx.reply(
        "❌ Ошибка при создании платежа. Проверь настройки Crypto Pay."
      );
    }
  });

  // ================= 15. ПРОВЕРКА CRYPTO PAY ПЛАТЕЖА =================
  bot.action(/check_crypto_(.+)/, async (ctx) => {
    const paymentId = ctx.match[1];

    try {
      await ctx.answerCbQuery("🔍 Проверяем платеж...");

      const paymentDoc = await db
        .collection("cryptoPayPayments")
        .doc(paymentId)
        .get();

      if (!paymentDoc.exists) {
        await ctx.answerCbQuery("❌ Платеж не найден");
        return;
      }

      const payment = paymentDoc.data();

      if (payment.userId !== ctx.from.id) {
        await ctx.answerCbQuery("❌ Это не ваш платеж");
        return;
      }

      let invoice;
      try {
        invoice = await cryptoPay.getInvoice(payment.invoiceId);
      } catch (error) {
        console.error("Ошибка получения инвойса:", error);
        await ctx.answerCbQuery("❌ Ошибка проверки счета");
        return;
      }

      if (!invoice) {
        await ctx.answerCbQuery("❌ Счет не найден или истек");
        return;
      }

      console.log(`Статус инвойса ${payment.invoiceId}:`, invoice.status);

      if (invoice.status === "paid") {
        const planId = payment.plan;
        const subRef = db
          .collection("subscriptions")
          .doc(ctx.from.id.toString());
        const subData = {
          userId: ctx.from.id,
          plan: planId,
          subscriptionType: planId,
          startDate: admin.firestore.FieldValue.serverTimestamp(),
          status: "active",
          isActive: true,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          paymentMethod: payment.asset === "TON" ? "ton" : "crypto",
        };

        if (planId === "1day") {
          subData.endDate = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 86400000)
          );
        } else if (planId === "1month") {
          subData.endDate = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 2592000000)
          );
        } else if (planId === "forever") {
          subData.endDate = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 365 * 86400000)
          );
        }

        await subRef.set(subData, { merge: true });
        await paymentDoc.ref.update({
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const subscription = await checkSubscription(ctx.from.id);
        const keyboard = {
          inline_keyboard: [
            [{ text: "🌍 Все страны", callback_data: "all_countries" }],
            [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }],
          ],
        };

        await ctx.reply(
          `🎉 <b>ПЛАТЕЖ ПОДТВЕРЖДЕН!</b>\n\n` +
            `✅ Подписка успешно активирована!\n\n` +
            `${subscription.message}`,
          {
            parse_mode: "HTML",
            reply_markup: keyboard,
          }
        );
      } else {
        let statusText = "не оплачен";
        if (invoice.status === "active") statusText = "ожидает оплаты";
        if (invoice.status === "expired") statusText = "истек";

        await ctx.answerCbQuery(
          `❌ Счет ${statusText}. Попробуй через минуту.`
        );
      }
    } catch (error) {
      console.error("Payment check error:", error);
      await ctx.answerCbQuery("❌ Ошибка проверки платежа");
    }
  });

  // ================= 16. ОБРАБОТЧИКИ ПОДПИСОК STARS =================
  const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
    try {
      await ctx.replyWithInvoice({
        title: `Подписка на ${
          planId === "1day"
            ? "1 день"
            : planId === "1month"
            ? "1 месяц"
            : "1 год"
        }`,
        description:
          planId === "1day"
            ? "Доступ на 24 часа"
            : planId === "1month"
            ? "Доступ на 30 дней"
            : "Доступ на 365 дней",
        payload: `${planId}_${ctx.from.id}_${Date.now()}`,
        currency: "XTR",
        prices: [{ label: "Подписка", amount: amount }],
        start_parameter: `${planId}_sub`,
      });
    } catch (error) {
      console.error("Ошибка создания счета:", error);
      await ctx.reply("⚠️ Ошибка при создании платежа");
    }
  };

  bot.action("buy_1day", (ctx) =>
    handleSubscriptionPurchase(ctx, "1day", 399, 86400000)
  );
  bot.action("buy_1month", (ctx) =>
    handleSubscriptionPurchase(ctx, "1month", 799, 2592000000)
  );
  bot.action("buy_forever", (ctx) =>
    handleSubscriptionPurchase(ctx, "forever", 3999, 31536000000)
  );

  bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

  bot.on("successful_payment", async (ctx) => {
    const userId = ctx.from.id;
    const payment = ctx.message.successful_payment;
    const [planId, _] = payment.invoice_payload.split("_");

    try {
      await clearChat(ctx);

      const subRef = db.collection("subscriptions").doc(userId.toString());
      const subData = {
        userId,
        plan: planId,
        subscriptionType: planId,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        status: "active",
        isActive: true,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        paymentMethod: "stars",
      };

      if (planId === "1day") {
        subData.endDate = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 86400000)
        );
      } else if (planId === "1month") {
        subData.endDate = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 2592000000)
        );
      } else if (planId === "forever") {
        subData.endDate = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 31536000000)
        );
      }

      await subRef.set(subData, { merge: true });

      const subscription = await checkSubscription(userId);
      const keyboard = {
        inline_keyboard: [
          [{ text: "🌍 Все страны", callback_data: "all_countries" }],
          [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }],
        ],
      };

      await ctx.reply(
        `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      console.error("Ошибка обработки платежа:", error);
      await ctx.reply("⚠️ Ошибка активации подписки");
    }
  });

  // ================= 17. НАЗАД В ГЛАВНОЕ МЕНЮ =================
  bot.action("back_to_main", async (ctx) => {
    await showMainMenu(ctx);
  });
};
