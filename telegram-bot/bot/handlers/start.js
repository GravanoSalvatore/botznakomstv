// const admin = require('firebase-admin');

// module.exports = (bot, db) => {
//   // 1. Проверка подписки (оставляем ваш вариант)
//   const checkSubscription = async (userId) => {
//     try {
//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const doc = await subRef.get();

//       if (!doc.exists) return false;

//       const subData = doc.data();

//       if (subData.subscriptionType === 'forever' && subData.isActive) {
//         return {
//           active: true,
//           type: 'forever',
//           message: '🎉 У вас бессрочная подписка!'
//         };
//       }

//       if (subData.endDate && subData.endDate.toDate() > new Date() && subData.isActive) {
//         return {
//           active: true,
//           type: subData.subscriptionType,
//           endDate: subData.endDate.toDate(),
//           message: `✅ Ваша подписка активна до: ${subData.endDate.toDate().toLocaleString()}`
//         };
//       }

//       return false;
//     } catch (error) {
//       console.error('Ошибка проверки подписки:', error);
//       return false;
//     }
//   };

//   // 2. Команда /start с кнопками (без изменений)
//   bot.start(async (ctx) => {
//     const userId = ctx.from.id;
//     const subscription = await checkSubscription(userId);

//     try {
//       await ctx.replyWithPhoto(
//         {
//           url: 'https://st4.depositphotos.com/2944823/21275/i/450/depositphotos_212755884-stock-photo-fashion-outdoor-photo-group-beautiful.jpg',
//           filename: 'welcome.jpg'
//         },
//         {
//           caption: `👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств 🅿🅴🅰🅲🅴💋🆈🅾🆄🆁🥕🅶🆄🅽</b>
// <em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>
// <b>⚠🚨 Для использования сервиса тебе должно быть 18+❗</b>
// ${subscription ? `\n\n${subscription.message}` : ''}`,
//           parse_mode: 'HTML',
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
//               [{ text: '🌐 Открыть в браузере PeaceYourGun 🥕', url: process.env.WEBAPP_URL }],
//               [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
//               [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
//               [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
//             ]
//           }
//         }
//       );
//     } catch (e) {
//       console.error('Ошибка при отправке фото:', e);
//       await ctx.reply(`👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств</b> +
// <b>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!
// ⚠ Для использования сервиса тебе должно быть 18+</b>
// ${subscription ? `\n\n${subscription.message}` : ''}`, {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
//             [{ text: '🌐 Открыть в браузере PeaceYourGun 🥕', url: process.env.WEBAPP_URL }],
//             [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
//             [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
//             [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
//           ]
//         }
//       });
//     }
//   });

//   // 3. Обработка кнопок (используем invoice без provider_token)
//   bot.action('buy_1day', async (ctx) => {
//     try {
//       await ctx.replyWithInvoice({
//         title: 'Подписка на 1 день',
//         description: 'Доступ на 24 часа',
//         payload: `1day_${ctx.from.id}_${Date.now()}`,
//         currency: 'XTR',
//         prices: [{ label: '1 день', amount: 1 }],
//         start_parameter: '1day_sub'
//       });
//     } catch (error) {
//       console.error('Ошибка:', error);
//       await ctx.reply('⚠️ Ошибка при создании платежа');
//     }
//   });

//   bot.action('buy_1month', async (ctx) => {
//     try {
//       await ctx.replyWithInvoice({
//         title: 'Подписка на 1 месяц',
//         description: 'Доступ на 30 дней',
//         payload: `1month_${ctx.from.id}_${Date.now()}`,
//         currency: 'XTR',
//         prices: [{ label: '1 месяц', amount: 2000 }],
//         start_parameter: '1month_sub'
//       });
//     } catch (error) {
//       console.error('Ошибка:', error);
//       await ctx.reply('⚠️ Ошибка при создании платежа');
//     }
//   });

//   bot.action('buy_forever', async (ctx) => {
//     try {
//       await ctx.replyWithInvoice({
//         title: 'Подписка навсегда',
//         description: 'Пожизненный доступ',
//         payload: `forever_${ctx.from.id}_${Date.now()}`,
//         currency: 'XTR',
//         prices: [{ label: 'Навсегда', amount: 10000 }],
//         start_parameter: 'forever_sub'
//       });
//     } catch (error) {
//       console.error('Ошибка:', error);
//       await ctx.reply('⚠️ Ошибка при создании платежа');
//     }
//   });

//   // 4. Обработка успешной оплаты
//   bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

//   bot.on('successful_payment', async (ctx) => {
//     const userId = ctx.from.id;
//     const payload = ctx.message.successful_payment.invoice_payload;
//     const planId = payload.split('_')[0]; // 1day, 1month, forever

//     try {
//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const subData = {
//         userId,
//         plan: planId,
//         subscriptionType: planId,
//         startDate: admin.firestore.FieldValue.serverTimestamp(),
//         status: 'active',
//         isActive: true,
//         lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//       };

//       // Устанавливаем endDate для временных подписок
//       if (planId === '1day') {
//         subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000));
//       } else if (planId === '1month') {
//         subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000));
//       }

//       await subRef.set(subData, { merge: true });
//       await ctx.reply('✅ Подписка активирована!');
//     } catch (error) {
//       console.error('Ошибка:', error);
//       await ctx.reply('⚠️ Ошибка активации подписки');
//     }
//   });
// };

// const admin = require('firebase-admin');

// module.exports = (bot, db) => {
//   // 1. Проверка активной подписки
//   const checkSubscription = async (userId) => {
//     try {
//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const doc = await subRef.get();

//       if (!doc.exists) return false;

//       const subData = doc.data();

//       if (subData.subscriptionType === 'forever' && subData.isActive) {
//         return {
//           active: true,
//           type: 'forever',
//           message: '🎉 У вас бессрочная подписка!'
//         };
//       }

//       if (subData.endDate && subData.endDate.toDate() > new Date() && subData.isActive) {
//         return {
//           active: true,
//           type: subData.subscriptionType,
//           endDate: subData.endDate.toDate(),
//           message: `✅ Ваша подписка активна до: ${subData.endDate.toDate().toLocaleString()}`
//         };
//       }

//       return false;
//     } catch (error) {
//       console.error('Ошибка проверки подписки:', error);
//       return false;
//     }
//   };

//   // 2. Инициализация коллекций при первом запуске
//   const initCollections = async () => {
//     const collections = ['subscriptions', 'transactions', 'payment_logs'];
//     for (const col of collections) {
//       try {
//         const ref = db.collection(col).doc('init');
//         await ref.set({ _init: true });
//         await ref.delete();
//       } catch (error) {
//         console.log(`Коллекция ${col} уже существует`);
//       }
//     }
//   };

//   // 3. Команда /start с кнопками подписки
//   bot.start(async (ctx) => {
//     await initCollections();
//     const userId = ctx.from.id;
//     const subscription = await checkSubscription(userId);

//     try {
//       await ctx.replyWithPhoto(
//         {
//           url: 'https://st4.depositphotos.com/2944823/21275/i/450/depositphotos_212755884-stock-photo-fashion-outdoor-photo-group-beautiful.jpg',
//           filename: 'welcome.jpg'
//         },
//         {
//           caption: `👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств 🅿🅴🅰🅲🅴💋🆈🅾🆄🆁🥕🅶🆄🅽</b>
// <em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>

// ${subscription ? `\n\n${subscription.message}` : ''}`,
//           parse_mode: 'HTML',
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
//               // [{ text: '🌐 Открыть в браузере PeaceYourGun 🥕', url: process.env.WEBAPP_URL }],
//               [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
//               [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
//               [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
//             ]
//           }
//         }
//       );
//     } catch (e) {
//       console.error('Ошибка при отправке фото:', e);
//       await ctx.reply(`👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств</b> +
// <b>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!
// ⚠ Для использования сервиса тебе должно быть 18+</b>
// ${subscription ? `\n\n${subscription.message}` : ''}`, {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
//             // [{ text: '🌐 Открыть в браузере PeaceYourGun 🥕', url: process.env.WEBAPP_URL }],
//             [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
//             [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
//             [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
//           ]
//         }
//       });
//     }
//   });

//   // 4. Обработка покупки подписки
//   const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
//     try {
//       await ctx.replyWithInvoice({
//         title: `Подписка на ${planId === '1day' ? '1 день' : planId === '1month' ? '1 месяц' : 'навсегда'}`,
//         description: planId === '1day' ? 'Доступ на 24 часа' :
//                      planId === '1month' ? 'Доступ на 30 дней' : 'Пожизненный доступ',
//         payload: `${planId}_${ctx.from.id}_${Date.now()}`,
//         currency: 'XTR',
//         prices: [{ label: 'Подписка', amount: amount }],
//         start_parameter: `${planId}_sub`
//       });
//     } catch (error) {
//       console.error('Ошибка создания счета:', error);
//       await ctx.reply('⚠️ Ошибка при создании платежа');
//     }
//   };

//   bot.action('buy_1day', (ctx) => handleSubscriptionPurchase(ctx, '1day', 1, 86400000));
//   bot.action('buy_1month', (ctx) => handleSubscriptionPurchase(ctx, '1month', 2000, 2592000000));
//   bot.action('buy_forever', (ctx) => handleSubscriptionPurchase(ctx, 'forever', 10000, null));

//   // 5. Обработка успешного платежа
//   bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

//   bot.on('successful_payment', async (ctx) => {
//     const userId = ctx.from.id;
//     const payment = ctx.message.successful_payment;
//     const [planId, _] = payment.invoice_payload.split('_');

//     try {
//       // Записываем подписку
//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const subData = {
//         userId,
//         plan: planId,
//         subscriptionType: planId,
//         startDate: admin.firestore.FieldValue.serverTimestamp(),
//         status: 'active',
//         isActive: true,
//         lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//       };

//       if (planId === '1day') {
//         subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000));
//       } else if (planId === '1month') {
//         subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000));
//       }

//       await subRef.set(subData, { merge: true });

//       // Записываем транзакцию
//       const txRef = db.collection('transactions').doc();
//       await txRef.set({
//         userId,
//         amount: payment.total_amount / 100,
//         plan: planId,
//         status: 'completed',
//         paymentId: payment.telegram_payment_charge_id,
//         timestamp: admin.firestore.FieldValue.serverTimestamp()
//       });

//       // Логируем платеж
//       const logRef = db.collection('payment_logs').doc();
//       await logRef.set({
//         userId,
//         amount: payment.total_amount / 100,
//         plan: planId,
//         date: new Date().toISOString(),
//         paymentDetails: payment
//       });

//       await ctx.reply('✅ Подписка успешно активирована!');
//     } catch (error) {
//       console.error('Ошибка обработки платежа:', error);
//       await ctx.reply('⚠️ Ошибка активации подписки');
//     }
//   });
// };

//start.js
// const admin = require('firebase-admin');

// module.exports = (bot, db) => {
//   // 1. Проверка активной подписки
//   const checkSubscription = async (userId) => {
//     try {
//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const doc = await subRef.get();

//       if (!doc.exists) return false;

//       const subData = doc.data();

//       if (subData.subscriptionType === 'forever' && subData.isActive) {
//         return {
//           active: true,
//           type: 'forever',
//           message: '🎉 У вас бессрочная подписка!'
//         };
//       }

//       if (subData.endDate && subData.endDate.toDate() > new Date() && subData.isActive) {
//         return {
//           active: true,
//           type: subData.subscriptionType,
//           endDate: subData.endDate.toDate(),
//           message: `✅ <b>Ваша подписка активна до:</b> ${subData.endDate.toDate().toLocaleString()}`
//         };
//       }

//       return false;
//     } catch (error) {
//       console.error('Ошибка проверки подписки:', error);
//       return false;
//     }
//   };

//   // 2. Инициализация коллекций при первом запуске
//   const initCollections = async () => {
//     const collections = ['subscriptions', 'transactions', 'payment_logs'];
//     for (const col of collections) {
//       try {
//         const ref = db.collection(col).doc('init');
//         await ref.set({ _init: true });
//         await ref.delete();
//       } catch (error) {
//         console.log(`Коллекция ${col} уже существует`);
//       }
//     }
//   };

//   // 3. Функция для очистки экрана
//   const clearChat = async (ctx) => {
//     try {
//       // Удаляем предыдущие сообщения (до 10 последних)
//       const chatId = ctx.chat.id;
//       const messageId = ctx.message.message_id;

//       // Удаляем текущее сообщение
//       await ctx.deleteMessage();

//       // Пытаемся удалить предыдущие сообщения
//       for (let i = 1; i <= 10; i++) {
//         try {
//           await ctx.telegram.deleteMessage(chatId, messageId - i);
//         } catch (e) {
//           // Игнорируем ошибки (если сообщение уже удалено или не существует)
//         }
//       }

//       // Отправляем новое чистое сообщение
//       return true;
//     } catch (error) {
//       console.error('Ошибка при очистке чата:', error);
//       return false;
//     }
//   };
// //<b>⚠🚨 Для использования сервиса тебе должно быть 18+❗</b>
//   // 4. Команда /start с кнопками подписки
//   bot.start(async (ctx) => {
//     await initCollections();
//     const userId = ctx.from.id;
//     const subscription = await checkSubscription(userId);

//     try {
//       await ctx.replyWithPhoto(
//         {
//           url: 'https://st4.depositphotos.com/2944823/21275/i/450/depositphotos_212755884-stock-photo-fashion-outdoor-photo-group-beautiful.jpg',
//           filename: 'welcome.jpg'
//         },
//         {
//           caption: `👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств 🅿🅴🅰🅲🅴💋🆈🅾🆄🆁🥕🅶🆄🅽</b>
// <em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>

// ${subscription ? `\n\n${subscription.message}` : ''}`,
//           parse_mode: 'HTML',
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
//               [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
//               [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
//               [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
//             ]
//           }
//         }
//       );
//     } catch (e) {
//       console.error('Ошибка при отправке фото:', e);
//       await ctx.reply(`👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в бот знакомств</b> +
// <b>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// 🎉 Каталог обновляется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!
// ⚠ Для использования сервиса тебе должно быть 18+</b>
// ${subscription ? `\n\n${subscription.message}` : ''}`, {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
//             [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
//             [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
//             [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
//           ]
//         }
//       });
//     }
//   });

//   // 5. Обработка покупки подписки
//   const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
//     try {
//       await ctx.replyWithInvoice({
//         title: `Подписка на ${planId === '1day' ? '1 день' : planId === '1month' ? '1 месяц' : 'навсегда'}`,
//         description: planId === '1day' ? 'Доступ на 24 часа' :
//                      planId === '1month' ? 'Доступ на 30 дней' : 'Пожизненный доступ',
//         payload: `${planId}_${ctx.from.id}_${Date.now()}`,
//         currency: 'XTR',
//         prices: [{ label: 'Подписка', amount: amount }],
//         start_parameter: `${planId}_sub`
//       });
//     } catch (error) {
//       console.error('Ошибка создания счета:', error);
//       await ctx.reply('⚠️ Ошибка при создании платежа');
//     }
//   };

//   bot.action('buy_1day', (ctx) => handleSubscriptionPurchase(ctx, '1day', 1, 86400000));
//   bot.action('buy_1month', (ctx) => handleSubscriptionPurchase(ctx, '1month', 2000, 2592000000));
//   bot.action('buy_forever', (ctx) => handleSubscriptionPurchase(ctx, 'forever', 10000, null));

//   // 6. Обработка успешного платежа
//   bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

//   bot.on('successful_payment', async (ctx) => {
//     const userId = ctx.from.id;
//     const payment = ctx.message.successful_payment;
//     const [planId, _] = payment.invoice_payload.split('_');

//     try {
//       // Очищаем экран перед отправкой нового сообщения
//       await clearChat(ctx);

//       // Записываем подписку
//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const subData = {
//         userId,
//         plan: planId,
//         subscriptionType: planId,
//         startDate: admin.firestore.FieldValue.serverTimestamp(),
//         status: 'active',
//         isActive: true,
//         lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//       };

//       if (planId === '1day') {
//         subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000));
//       } else if (planId === '1month') {
//         subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000));
//       }

//       await subRef.set(subData, { merge: true });

//       // Записываем транзакцию
//       const txRef = db.collection('transactions').doc();
//       await txRef.set({
//         userId,
//         amount: payment.total_amount / 100,
//         plan: planId,
//         status: 'completed',
//         paymentId: payment.telegram_payment_charge_id,
//         timestamp: admin.firestore.FieldValue.serverTimestamp()
//       });

//       // Логируем платеж
//       const logRef = db.collection('payment_logs').doc();
//       await logRef.set({
//         userId,
//         amount: payment.total_amount / 100,
//         plan: planId,
//         date: new Date().toISOString(),
//         paymentDetails: payment
//       });

//       // Отправляем обновленное сообщение с подтверждением
//       const subscription = await checkSubscription(userId);
//       await ctx.replyWithPhoto(
//         {
//           url: 'https://st4.depositphotos.com/2944823/21275/i/450/depositphotos_212755884-stock-photo-fashion-outdoor-photo-group-beautiful.jpg',
//           filename: 'welcome.jpg'
//         },
//         {
//           caption: `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`,
//           parse_mode: 'HTML',
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }]
//             ]
//           }
//         }
//       );
//     } catch (error) {
//       console.error('Ошибка обработки платежа:', error);
//       await ctx.reply('⚠️ Ошибка активации подписки');
//     }
//   });
// };

// const admin = require('firebase-admin');
// const fs = require('fs');
// const path = require('path');

// module.exports = (bot, db) => {
//     // ================= 1. ПРЕДЗАГРУЗКА ИЗОБРАЖЕНИЯ =================
//     const welcomeImage = {
//         path: path.join(__dirname, '../../img/welcome.jpg'),
//         buffer: null,
//         fileId: null,
//         load: function() {
//             if (fs.existsSync(this.path)) {
//                 this.buffer = fs.readFileSync(this.path);
//                 console.log('Изображение welcome.jpg загружено в память');
//             }
//         }
//     };
//     welcomeImage.load();

//     // ================= 2. ОРИГИНАЛЬНЫЕ ФУНКЦИИ БЕЗ ИЗМЕНЕНИЙ =================
//     // 1. Проверка активной подписки (полностью сохранена)
//    const checkSubscription = async (userId, db) => {
//     try {
//         const subRef = db.collection('subscriptions').doc(userId.toString());
//         const doc = await subRef.get();

//         if (!doc.exists) return false;

//         const subData = doc.data();
//         return subData.isActive && subData.endDate.toDate() > new Date();
//     } catch (error) {
//         console.error('Ошибка проверки подписки:', error);
//         return false;
//     }
// };

//     // 2. Инициализация коллекций (полностью сохранена)
//     const initCollections = async () => {
//         const collections = ['subscriptions', 'transactions', 'payment_logs'];
//         for (const col of collections) {
//             try {
//                 const ref = db.collection(col).doc('init');
//                 await ref.set({ _init: true });
//                 await ref.delete();
//             } catch (error) {
//                 console.log(`Коллекция ${col} уже существует`);
//             }
//         }
//     };

//     // 3. Функция для очистки экрана (полностью сохранена)
//     const clearChat = async (ctx) => {
//         try {
//             const chatId = ctx.chat.id;
//             const messageId = ctx.message.message_id;

//             await ctx.deleteMessage();

//             for (let i = 1; i <= 10; i++) {
//                 try {
//                     await ctx.telegram.deleteMessage(chatId, messageId - i);
//                 } catch (e) {}
//             }

//             return true;
//         } catch (error) {
//             console.error('Ошибка при очистке чата:', error);
//             return false;
//         }
//     };

//     // ================= 3. ОПТИМИЗИРОВАННЫЙ START =================
// //     bot.start(async (ctx) => {
// //         // Асинхронно инициализируем коллекции (не ждём завершения)
// //         initCollections().catch(e => console.error('Ошибка инициализации:', e));

// //         const userId = ctx.from.id;
// //         const welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
// // Добро пожаловать в бот знакомств 🅿🅴🅰🅲🅴💋🆈🅾🆄🆁🥕🅶🆄🅽</b>
// // <em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
// // 🎉 Каталог обновляется каждый день — всегда свежие профили!
// // Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>`;
// //  const hasSub = await checkSubscription(userId, db);
// //         // 1. Сначала мгновенно отправляем интерфейс
// //         try {
// //             if (welcomeImage.fileId) {
// //                 await ctx.replyWithPhoto(
// //                     welcomeImage.fileId,
// //                     {
// //                         caption: welcomeText,
// //                         parse_mode: 'HTML',
// //                         reply_markup: {
// //                             inline_keyboard: [
// // // [{ text: '🌍 Все страны', callback_data: 'all_countries' }],
// //                                 // [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
// //                                  [{
// //     text: '🌐 Открыть  PeaceYourGun 🥕 в WebApp',
// //     web_app: { url: process.env.WEBAPP_URL }
// // }],
// //                                 [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
// //                                 [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
// //                                 [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
// //                             ]
// //                         }
// //                     }
// //                 );
// //             } else if (welcomeImage.buffer) {
// //                 const msg = await ctx.replyWithPhoto(
// //                     { source: welcomeImage.buffer },
// //                     {
// //                         caption: welcomeText,
// //                         parse_mode: 'HTML',
// //                         reply_markup: {
// //                             inline_keyboard: [
// // // [{ text: '🌍 Все страны', callback_data: 'all_countries' }],
// //                                 // [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
// //                                  [{
// //     text: '🌐 Открыть  PeaceYourGun 🥕 в WebApp',
// //     web_app: { url: process.env.WEBAPP_URL }
// // }],
// //                                 [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
// //                                 [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
// //                                 [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
// //                             ]
// //                         }
// //                     }
// //                 );
// //                 welcomeImage.fileId = msg.photo[0].file_id;
// //             } else {
// //                 await ctx.reply(welcomeText, {
// //                     parse_mode: 'HTML',
// //                     reply_markup: {
// //                         inline_keyboard: [
// //                             // [{ text: '🌍 Все страны', callback_data: 'all_countries' }],
// //                             // [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
// //                               [{
// //     text: '🌐 Открыть  PeaceYourGun 🥕 в WebApp',
// //     web_app: { url: process.env.WEBAPP_URL }
// // }],
// //                             [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
// //                             [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
// //                             [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
// //                         ]
// //                     }
// //                 });
// //             }
// //         } catch (e) {
// //             console.error('Ошибка отправки welcome:', e);
// //             await ctx.reply(welcomeText, {
// //                 parse_mode: 'HTML',
// //                 reply_markup: {
// //                     inline_keyboard: [
// //                         // [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
// //                         [{ text: '🔥 Купить подписку на 1 день (1🌟)', callback_data: 'buy_1day' }],
// //                         [{ text: '❤️ Купить подписку на 1 месяц (2000🌟)', callback_data: 'buy_1month' }],
// //                         [{ text: '💫 Купить подписку навсегда (10000🌟)', callback_data: 'buy_forever' }]
// //                     ]
// //                 }
// //             });
// //         }

// //         // 2. Затем асинхронно проверяем подписку
// //         setTimeout(async () => {
// //             try {
// //                 const subscription = await checkSubscription(userId);
// //                 if (subscription) {
// //                     await ctx.reply(subscription.message, { parse_mode: 'HTML' });
// //                 }
// //             } catch (e) {
// //                 console.error('Ошибка проверки подписки:', e);
// //             }
// //         }, 0);
// //     });

//     // ================= 4. ОРИГИНАЛЬНЫЕ ОБРАБОТЧИКИ БЕЗ ИЗМЕНЕНИЙ =================
//     const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
//         try {
//             await ctx.replyWithInvoice({
//                 title: `Подписка на ${planId === '1day' ? '1 день' : planId === '1month' ? '1 месяц' : 'навсегда'}`,
//                 description: planId === '1day' ? 'Доступ на 24 часа' :
//                             planId === '1month' ? 'Доступ на 30 дней' : 'Пожизненный доступ',
//                 payload: `${planId}_${ctx.from.id}_${Date.now()}`,
//                 currency: 'XTR',
//                 prices: [{ label: 'Подписка', amount: amount }],
//                 start_parameter: `${planId}_sub`
//             });
//         } catch (error) {
//             console.error('Ошибка создания счета:', error);
//             await ctx.reply('⚠️ Ошибка при создании платежа');
//         }
//     };

//     bot.action('buy_1day', (ctx) => handleSubscriptionPurchase(ctx, '1day', 1, 86400000));
//     bot.action('buy_1month', (ctx) => handleSubscriptionPurchase(ctx, '1month', 2000, 2592000000));
//     bot.action('buy_forever', (ctx) => handleSubscriptionPurchase(ctx, 'forever', 10000, null));

//     bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

//     bot.on('successful_payment', async (ctx) => {
//         const userId = ctx.from.id;
//         const payment = ctx.message.successful_payment;
//         const [planId, _] = payment.invoice_payload.split('_');

//         try {
//             await clearChat(ctx);

//             const subRef = db.collection('subscriptions').doc(userId.toString());
//             const subData = {
//                 userId,
//                 plan: planId,
//                 subscriptionType: planId,
//                 startDate: admin.firestore.FieldValue.serverTimestamp(),
//                 status: 'active',
//                 isActive: true,
//                 lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//             };

//             if (planId === '1day') {
//                 subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000));
//             } else if (planId === '1month') {
//                 subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000));
//             }

//             await subRef.set(subData, { merge: true });

//             const txRef = db.collection('transactions').doc();
//             await txRef.set({
//                 userId,
//                 amount: payment.total_amount / 100,
//                 plan: planId,
//                 status: 'completed',
//                 paymentId: payment.telegram_payment_charge_id,
//                 timestamp: admin.firestore.FieldValue.serverTimestamp()
//             });

//             const logRef = db.collection('payment_logs').doc();
//             await logRef.set({
//                 userId,
//                 amount: payment.total_amount / 100,
//                 plan: planId,
//                 date: new Date().toISOString(),
//                 paymentDetails: payment
//             });

//             const subscription = await checkSubscription(userId);
//             if (welcomeImage.fileId) {
//                 await ctx.replyWithPhoto(
//                     welcomeImage.fileId,
//                     {
//                         caption: `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`,
//                         parse_mode: 'HTML',
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{ text: '🌍 Все страны', callback_data: 'all_countries' }],
//                                 // [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }]
//                             ]
//                         }
//                     }
//                 );
//             } else if (welcomeImage.buffer) {
//                 const msg = await ctx.replyWithPhoto(
//                     { source: welcomeImage.buffer },
//                     {
//                         caption: `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`,
//                         parse_mode: 'HTML',
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }]
//                             ]
//                         }
//                     }
//                 );
//                 welcomeImage.fileId = msg.photo[0].file_id;
//             } else {
//                 await ctx.reply(`✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`, {
//                     parse_mode: 'HTML',
//                     reply_markup: {
//                         inline_keyboard: [
//                             [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }]
//                         ]
//                     }
//                 });
//             }
//         } catch (error) {
//             console.error('Ошибка обработки платежа:', error);
//             await ctx.reply('⚠️ Ошибка активации подписки');
//         }
//     });
// };
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

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

  // ================= 2. ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ =================
  const checkSubscription = async (userId) => {
    try {
      const subRef = db.collection("subscriptions").doc(userId.toString());
      const doc = await subRef.get();

      if (!doc.exists) return false;

      const subData = doc.data();
      return {
        active: subData.isActive && subData.endDate.toDate() > new Date(),
        message:
          subData.subscriptionType === "forever"
            ? "🎉 У вас бессрочная подписка!"
            : `✅  подписка активна до: ${subData.endDate
                .toDate()
                .toLocaleString()}`,
      };
    } catch (error) {
      console.error("Ошибка проверки подписки:", error);
      return { active: false };
    }
  };

  // ================= 3. ОРИГИНАЛЬНЫЕ ФУНКЦИИ =================
  const initCollections = async () => {
    const collections = ["subscriptions", "transactions", "payment_logs"];
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

  const clearChat = async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const messageId = ctx.message.message_id;

      await ctx.deleteMessage();

      for (let i = 1; i <= 10; i++) {
        try {
          await ctx.telegram.deleteMessage(chatId, messageId - i);
        } catch (e) {}
      }

      return true;
    } catch (error) {
      console.error("Ошибка при очистке чата:", error);
      return false;
    }
  };

  // ================= 4. ОБНОВЛЕННЫЙ ОБРАБОТЧИК START =================
  bot.start(async (ctx) => {
    initCollections().catch((e) => console.error("Ошибка инициализации:", e));

    const userId = ctx.from.id;
    const welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в бот знакомств Эскорт💋 Блокнот🥕</b> 
<em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
🎉 Каталог обновляется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>`;

    // Проверяем подписку сразу
    const subscription = await checkSubscription(userId);
    const hasSub = subscription.active;

    // Формируем динамическую клавиатуру
    const baseKeyboard = [
      // [
      //   {
      //     text: "🌐 Открыть PeaceYourGun 🥕 в WebApp",
      //     web_app: { url: process.env.WEBAPP_URL },
      //   },
      // ],
    ];

    // Добавляем кнопку "Все страны" только при наличии подписки
    if (hasSub) {
      baseKeyboard.push([
        { text: "🌍 Все страны", callback_data: "all_countries" },
      ]);
    }

    // Кнопки покупки подписки
    baseKeyboard.push(
      [
        {
          text: "🔥 Купить подписку на 1 день (199🌟)",
          callback_data: "buy_1day",
        },
      ],
      [
        {
          text: "❤️ Купить подписку на 1 месяц (599🌟)",
          callback_data: "buy_1month",
        },
      ],
      // [
      //   {
      //     text: "💫 Купить подписку навсегда (10000🌟)",
      //     callback_data: "buy_forever",
      //   },
      // ]
    );

    // Отправка приветственного сообщения
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

    // Показываем статус подписки (если есть)
    if (hasSub) {
      setTimeout(async () => {
        try {
          await ctx.reply(subscription.message, { parse_mode: "HTML" });
        } catch (e) {
          console.error("Ошибка отправки статуса подписки:", e);
        }
      }, 500);
    }
  });

  // ================= 5. ОБРАБОТЧИКИ ПОДПИСОК =================
  const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
    try {
      await ctx.replyWithInvoice({
        title: `Подписка на ${
          planId === "1day"
            ? "1 день"
            : planId === "1month"
            ? "1 месяц"
            : "навсегда"
        }`,
        description:
          planId === "1day"
            ? "Доступ на 24 часа"
            : planId === "1month"
            ? "Доступ на 30 дней"
            : "Пожизненный доступ",
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
    handleSubscriptionPurchase(ctx, "1day", 1, 86400000)
  );
  bot.action("buy_1month", (ctx) =>
    handleSubscriptionPurchase(ctx, "1month", 2000, 2592000000)
  );
  bot.action("buy_forever", (ctx) =>
    handleSubscriptionPurchase(ctx, "forever", 10000, null)
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
      };

      if (planId === "1day") {
        subData.endDate = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 86400000)
        );
      } else if (planId === "1month") {
        subData.endDate = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 2592000000)
        );
      }

      await subRef.set(subData, { merge: true });

      // Дополнительные операции с базой данных...

      // Обновляем интерфейс после покупки
      const subscription = await checkSubscription(userId);
      const keyboard = [
        // [
        //   {
        //     text: "🌐 Открыть PeaceYourGun 🥕 в WebApp",
        //     web_app: { url: process.env.WEBAPP_URL },
        //   },
        // ],
        [{ text: "🌍 Все страны", callback_data: "all_countries" }],
      ];

      await ctx.reply(
        `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        }
      );
    } catch (error) {
      console.error("Ошибка обработки платежа:", error);
      await ctx.reply("⚠️ Ошибка активации подписки");
    }
  });
};
