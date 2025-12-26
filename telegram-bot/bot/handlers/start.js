
//start.js
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const CryptoPayHandler = require("./cryptoPay");
const { profilesDB, indexesDB } = require('./lmdb-manager');
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

  // ================= 2. ФУНКЦИЯ СОХРАНЕНИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЯ В PIONEERUSERS =================
  const saveUserToPioneerUsers = async (ctx) => {
    try {
      const userId = ctx.from.id;
      const userRef = db.collection("pioneerUsers").doc(userId.toString());

      // Получаем текущие данные пользователя
      const userDoc = await userRef.get();

      const userData = {
        telegramId: userId,
        firstName: ctx.from.first_name || "",
        lastName: ctx.from.last_name || "",
        username: ctx.from.username || "",
        phone: "", // телефон будет добавляться позже если есть
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        lastVisit: admin.firestore.FieldValue.serverTimestamp(),
        totalVisits: 1,
      };

      // Если пользователь уже существует, обновляем счетчик посещений
      if (userDoc.exists) {
        const existingData = userDoc.data();
        userData.totalVisits = (existingData.totalVisits || 0) + 1;
        userData.firstVisit = existingData.firstVisit || userData.startDate;
      } else {
        userData.firstVisit = userData.startDate;
      }

      // Сохраняем/обновляем данные пользователя
      await userRef.set(userData, { merge: true });

      console.log(`✅ Данные пользователя ${userId} сохранены в pioneerUsers`);
      return true;
    } catch (error) {
      console.error("❌ Ошибка сохранения пользователя в pioneerUsers:", error);
      return false;
    }
  };

  // ================= 3. ФУНКЦИЯ ОБНОВЛЕНИЯ ПОСЕЩЕНИЙ ПОЛЬЗОВАТЕЛЯ =================
  const updateUserVisit = async (userId) => {
    try {
      const userRef = db.collection("pioneerUsers").doc(userId.toString());
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        await userRef.update({
          lastVisit: admin.firestore.FieldValue.serverTimestamp(),
          totalVisits: admin.firestore.FieldValue.increment(1),
        });
        console.log(`✅ Обновлено посещение для пользователя ${userId}`);
      }
    } catch (error) {
      console.error("❌ Ошибка обновления посещения:", error);
    }
  };

  // ================= 4. ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ =================
  const checkSubscription = async (userId) => {
    try {
      const userIdStr = userId.toString();

      // Проверяем основную подписку
      const subRef = db.collection("subscriptions").doc(userIdStr);
      const subDoc = await subRef.get();

      if (subDoc.exists) {
        const subData = subDoc.data();
        const isActive =
          subData.isActive && subData.endDate.toDate() > new Date();

        if (isActive) {
          const endDate = subData.endDate.toDate();
          const daysLeft = Math.ceil(
            (endDate - new Date()) / (1000 * 60 * 60 * 24)
          );

          let message = "";
          if (subData.subscriptionType === "forever") {
            message = "🎉 У вас бессрочная подписка!";
          } else {
            message = `✅ Подписка активна до: ${endDate.toLocaleDateString()} (осталось ${daysLeft} дней)`;
          }

          return {
            active: true,
            message: message,
            subscription: subData,
          };
        }
      }

      // Если подписка неактивна или не существует, проверяем оплаченные крипто-платежи
      const cryptoPaymentsRef = db
        .collection("cryptoPayPayments")
        .where("userId", "==", userId)
        .where("status", "==", "paid");

      const cryptoPayments = await cryptoPaymentsRef.get();

      for (const doc of cryptoPayments.docs) {
        const payment = doc.data();

        // Проверяем, не истекла ли подписка из крипто-платежа
        const paymentDate = payment.paidAt
          ? payment.paidAt.toDate()
          : payment.createdAt.toDate();
        let subscriptionEndDate = new Date(paymentDate);

        // Определяем длительность подписки на основе плана
        if (payment.plan === "1day") {
          subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 1);
        } else if (payment.plan === "1month") {
          subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
        } else if (payment.plan === "forever") {
          subscriptionEndDate.setFullYear(
            subscriptionEndDate.getFullYear() + 100
          );
        }

        // Если подписка еще активна
        if (subscriptionEndDate > new Date()) {
          const daysLeft = Math.ceil(
            (subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24)
          );

          let planName = "";
          if (payment.plan === "1day") planName = "1 день";
          else if (payment.plan === "1month") planName = "1 месяц";
          else if (payment.plan === "forever") planName = "1 год";

          return {
            active: true,
            message: `✅ Подписка (${planName}, оплата: ${
              payment.asset
            }) активна до: ${subscriptionEndDate.toLocaleDateString()} (осталось ${daysLeft} дней)`,
            subscription: {
              ...payment,
              endDate: admin.firestore.Timestamp.fromDate(subscriptionEndDate),
              isActive: true,
              subscriptionType: payment.plan,
            },
          };
        }
      }

      // Если активных подписок нет
      return {
        active: false,
        message: "❌ У вас нет активной подписки",
      };
    } catch (error) {
      console.error("Ошибка проверки подписки:", error);
      return {
        active: false,
        message: "❌ Ошибка проверки подписки",
      };
    }
  };

  // ================= 5. ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ НА КАНАЛ =================
  // const checkChannelSubscription = async (ctx) => {
  //   try {
  //     const userId = ctx.from.id;
  //     const channelUsername = "<b>MagicClubPrivate</b>";

  //     const chatMember = await ctx.telegram.getChatMember(
  //       channelUsername,
  //       userId
  //     );

  //     const isSubscribed =
  //       chatMember.status === "member" ||
  //       chatMember.status === "administrator" ||
  //       chatMember.status === "creator";

  //     return isSubscribed;
  //   } catch (error) {
  //     console.error("Ошибка проверки подписки на канал:", error);
  //     return false;
  //   }
  // };
// ================= 5. ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ НА КАНАЛ =================
const checkChannelSubscription = async (ctx) => {
  try {
    const userId = ctx.from.id;
    const channelId = "-1001933124424"; // Ваш реальный Chat ID
    
    const chatMember = await ctx.telegram.getChatMember(channelId, userId);

    const isSubscribed =
      chatMember.status === "member" ||
      chatMember.status === "administrator" ||
      chatMember.status === "creator";

    return isSubscribed;
  } catch (error) {
    console.error("Ошибка проверки подписки на канал:", error);
    return false;
  }
};
  // ================= 6. ФУНКЦИЯ ПРОВЕРКИ ПОЛНОГО ДОСТУПА =================
 // Добавьте в начале start.js
const { profilesDB, indexesDB } = require('./lmdb-manager');

// ===================== ФУНКЦИЯ ПРОВЕРКИ ПОЛНОГО ДОСТУПА =====================
const checkFullAccess = async (ctx, forceRefresh = false) => {
    const userId = ctx.from.id;

    // Используем сессионное кэширование
    if (!forceRefresh && ctx.session?.fullAccessCache) {
        const accessCache = ctx.session.fullAccessCache;
        const accessAge = Date.now() - accessCache.timestamp;

        if (accessAge < 10 * 60 * 1000) {
            console.log(`✅ [FULL ACCESS CACHE] Используем кэш для ${userId}: ${accessCache.value}`);
            return accessCache.value;
        }
    }

    try {
        // 🔥 КРИТИЧЕСКИЙ ФИКС: ПРОВЕРЯЕМ ОБА УСЛОВИЯ
        const [hasSubscription, hasChannelSubscription] = await Promise.all([
            checkSubscription(userId),
            checkChannelSubscription(ctx),
        ]);

        const hasFullAccess = hasSubscription && hasChannelSubscription;

        console.log(`📊 [FULL ACCESS] ${userId}: подписка=${hasSubscription}, канал=${hasChannelSubscription}, полный доступ=${hasFullAccess}`);

        // Сохраняем в сессионный кэш
        if (!ctx.session) ctx.session = {};
        ctx.session.fullAccessCache = {
            value: hasFullAccess,
            timestamp: Date.now(),
            subscription: hasSubscription,
            channel: hasChannelSubscription,
        };

        // 🔥 🔥 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: ЕСЛИ ПОЛЬЗОВАТЕЛЬ С ПОЛНЫМ ДОСТУПОМ, ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ СРАЗУ
        if (hasFullAccess) {
            // Используем profilesDB из lmdb-manager
            const profileKeys = Array.from(profilesDB.getKeys());
            const profilesCount = profileKeys.length;
            
            console.log(`📊 [LMDB CHECK] Полных профилей в LMDB: ${profilesCount}`);
            
            if (profilesCount === 0) {
                console.log(`🚀 [AUTO LOAD FULL CACHE] Пользователь ${userId} имеет полный доступ, но LMDB пуст. ЗАГРУЖАЕМ!`);
                
                // 🔥 СООБЩАЕМ ПОЛЬЗОВАТЕЛЮ
                const loadingMsg = await ctx.reply(`
🔄 <b>ЗАГРУЗКА ПОЛНОЙ БАЗЫ ДАННЫХ</b>

🎉 У вас есть полный доступ!
📊 Загружаем 70,000+ анкет в систему...

⏱️ <i>Это займет 2-3 минуты</i>
📦 <i>Загружаем пачками по 5000 анкет</i>
💾 <i>Сохраняем на диск для быстрого доступа</i>

<em>Подождите, загрузка началась...</em>
                `, { parse_mode: "HTML" });

                // 🔥 ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ (нужно передать cacheManager из profiles)
                try {
                    const profilesModule = require('./profiles');
                    const success = await profilesModule.cacheManager.loadGlobalFullCache(db);
                    
                    // Удаляем сообщение о загрузке
                    try {
                        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
                    } catch (e) {}

                    if (success) {
                        console.log(`✅ [AUTO LOAD SUCCESS] Полный кэш загружен для ${userId}`);
                        await ctx.reply(`
✅ <b>БАЗА ДАННЫХ ЗАГРУЖЕНА!</b>

🎉 Теперь доступны все 70,000+ анкет!
• 👤 Все контакты видны
• 📞 Телефоны, Telegram, WhatsApp
• 🌍 ${indexesDB.get('countries:all')?.length || 0} стран
• 🌆 Тысячи городов
• ⚡ Быстрый поиск через индексы

<code>Теперь выберите страну для начала поиска</code>
                        `, { parse_mode: "HTML" });
                    } else {
                        console.log(`❌ [AUTO LOAD FAILED] Не удалось загрузить полный кэш для ${userId}`);
                        await ctx.reply(`
⚠️ <b>ОШИБКА ЗАГРУЗКИ БАЗЫ</b>

Не удалось загрузить полную базу данных.
Попробуйте еще раз через минуту или напишите в поддержку @MagicAdd.

<em>Используйте демо-режим пока исправляем проблему</em>
                        `, { parse_mode: "HTML" });
                    }
                } catch (loadError) {
                    console.error(`❌ [LMDB LOAD CRITICAL] Ошибка загрузки:`, loadError);
                    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
                    await ctx.reply(`
❌ <b>КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ</b>

${loadError.message}

<em>Используйте демо-режим или напишите в поддержку @MagicAdd</em>
                    `, { parse_mode: "HTML" });
                }
            } else {
                console.log(`✅ [LMDB READY] Полный кэш уже загружен: ${profilesCount} профилей`);
            }
        }

        return hasFullAccess;
    } catch (error) {
        console.error(`❌ [FULL ACCESS ERROR] Ошибка для ${userId}:`, error);

        // При ошибке - демо
        if (!ctx.session) ctx.session = {};
        ctx.session.fullAccessCache = {
            value: false,
            timestamp: Date.now(),
            error: error.message,
        };

        return false;
    }
};

  // ================= 7. ФУНКЦИЯ ПОКАЗА СООБЩЕНИЯ О ПОДПИСКЕ НА КАНАЛ =================
//   const showChannelSubscriptionMessage = async (ctx) => {
//     const subscriptionKeyboard = {
//       inline_keyboard: [
//         [
//           {
//             text: "✅ Я ПОДПИСАЛСЯ",
//             callback_data: "check_channel_subscription",
//           },
//         ],
//         [
//           {
//             text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ",
//             url: "https://t.me/+H6Eovikei9xiZWU0",
//           },
//         ],
//         [
//           {
//             text: "🔙 Назад",
//             callback_data: "back_to_main",
//           },
//           {
//             text: "🧹 Очистить экран",
//             callback_data: "clear_screen",
//           },
//         ],
//       ],
//     };

//     const subscriptionMessage = `
// 📢 <b>ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ</b>

// Для доступа к анкетам необходимо подписаться на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a>

// ✨ <b>Почему это важно:</b>
// • Получайте уведомления о новых анкетах
// • Будьте в курсе обновлений бота
// • Узнавайте о специальных предложениях
// • Получайте эксклюзивный контент

// <b>Инструкция:</b>
// 1. Нажмите кнопку "ПОДПИСАТЬСЯ НА КАНАЛ"
// 2. Подпишитесь на канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a>
// 3. Вернитесь в бот и нажмите "Я ПОДПИСАЛСЯ"

// После подтверждения подписки вы получите доступ к анкетам!
//     `;

//     await ctx.reply(subscriptionMessage, {
//       parse_mode: "HTML",
//       reply_markup: subscriptionKeyboard,
//     });
//   };
// ================= 7. ФУНКЦИЯ ПОКАЗА СООБЩЕНИЯ О ПОДПИСКЕ НА КАНАЛ =================
const showChannelSubscriptionMessage = async (ctx) => {
  const subscriptionKeyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ Я ПОДПИСАЛСЯ",
          callback_data: "check_channel_subscription",
        },
      ],
      [
        {
          text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ",
          url: "https://t.me/+H6Eovikei9xiZWU0",
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

  const subscriptionMessage = `
📢 <b>ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ</b>

Для доступа к анкетам необходимо подписаться на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a>

✨ <b>Почему это важно:</b>
• Получайте уведомления о новых анкетах
• Будьте в курсе обновлений бота
• Узнавайте о специальных предложениях
• Получайте эксклюзивный контент

<b>Инструкция:</b>
1. Нажмите кнопку "ПОДПИСАТЬСЯ НА КАНАЛ"
2. Подпишитесь на канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a>
3. Вернитесь в бот и нажмите "Я ПОДПИСАЛСЯ"

После подтверждения подписки вы получите доступ к анкетам!
  `;

  await ctx.reply(subscriptionMessage, {
    parse_mode: "HTML",
    reply_markup: subscriptionKeyboard,
  });
};
  // ================= 8. ФУНКЦИЯ ОЧИСТКИ ЧАТА =================
  const clearChat = async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const messageId = ctx.message
        ? ctx.message.message_id
        : ctx.update.callback_query.message.message_id;

      await ctx.deleteMessage();

      for (let i = 1; i <= 10; i++) {
        try {
          await ctx.telegram.deleteMessage(chatId, messageId - i);
        } catch (e) {
          // Игнорируем ошибки
        }
      }

      return true;
    } catch (error) {
      console.error("Ошибка при очистке чата:", error);
      return false;
    }
  };

  // ================= 9. ФУНКЦИЯ ОЧИСТКИ ЭКРАНА =================
  const clearScreen = async (ctx) => {
    try {
      await clearChat(ctx);

      // Обновляем статистику посещений
      await updateUserVisit(ctx.from.id);

      // Отправляем главное меню
      const hasFullAccess = await checkFullAccess(ctx);

      const baseKeyboard = [];

      baseKeyboard.push([
        { text: "🌍 Все страны", callback_data: "all_countries_with_check" },
      ]);

      // 🔥 ДОБАВЛЯЕМ КНОПКУ СОЗДАНИЯ АНКЕТЫ ПЕРЕД КНОПКОЙ "НАЗАД"
      baseKeyboard.push([
        {
          text: "📝 СОЗДАТЬ АНКЕТУ",
          web_app: { url: "https://bot-vai-web-app.web.app/?tab=catalog" },
        },
      ]);

      baseKeyboard.push([
        { text: "💎 Купить подписку", callback_data: "choose_payment_method" },
      ]);
      baseKeyboard.push([
        { text: "👨‍💻 Связаться с админом", url: "https://t.me/MagicAdd" },
      ]);
      baseKeyboard.push([
        { text: "🧹 Очистить экран", callback_data: "clear_screen" },
      ]);

      let welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в клуб  ✨Magic</b> 
<em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
🎉 Каталог обновляется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
<b>Подпишись на новости и обновления в <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a> ✨</b>\n`;

      // Добавляем информацию о демо-режиме если нет полного доступа
      if (!hasFullAccess) {
        welcomeText += `\n👀 <b>Сейчас вы в демо-режиме:</b>
• Показано по 3 анкеты на город  
• Контакты скрыты
• ✨ Для полного доступа Вы должны быть подписаны на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a> и оплатить подписку
`;
      }

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

      // Показываем статус подписки если есть
      const subscription = await checkSubscription(ctx.from.id);
      if (subscription.active) {
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
      await showMainMenu(ctx);
    }
  };

  // ================= 10. ФУНКЦИЯ ОТОБРАЖЕНИЯ ГЛАВНОГО МЕНЮ =================
//   const showMainMenu = async (ctx) => {
//     // Обновляем статистику посещений
//     await updateUserVisit(ctx.from.id);

//     const hasFullAccess = await checkFullAccess(ctx);

//     const baseKeyboard = [];

//     baseKeyboard.push([
//       { text: "🌍 Все страны", callback_data: "all_countries_with_check" },
//     ]);

//     // 🔥 ДОБАВЛЯЕМ КНОПКУ СОЗДАНИЯ АНКЕТЫ ПЕРЕД КНОПКОЙ "НАЗАД"
//     baseKeyboard.push([
//       {
//         text: "📝 СОЗДАТЬ АНКЕТУ",
//         web_app: { url: "https://bot-vai-web-app.web.app/?tab=catalog" },
//       },
//     ]);

//     baseKeyboard.push([
//       { text: "💎 Купить подписку", callback_data: "choose_payment_method" },
//     ]);
//     baseKeyboard.push([
//       { text: "👨‍💻 Связаться с админом", url: "https://t.me/MagicAdd" },
//     ]);
//     baseKeyboard.push([
//       { text: "🧹 Очистить экран", callback_data: "clear_screen" },
//     ]);

//     let welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
// Добро пожаловать в клуб знакомств ✨Magic!</b> 
// <em>Здесь ты найдёшь базу данных анкет со всего мира для общения и не только. 
// 🗄️ База обновляется и пополняется каждый день — всегда свежие профили!
// Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
// <a href="http://t.me/MagicYourClub"><b>✨ Подпишись на новости и обновления в Magic ClubX</b></a>\n`;

//     // Добавляем информацию о демо-режиме если нет полного доступа
//     if (!hasFullAccess) {
//       welcomeText += `\n👀 <b>Сейчас вы в демо-режиме:</b>
// • Показано по 3 анкеты на город  
// • Контакты скрыты
// • ✨ Для полного доступа Вы должны быть подписаны на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a> и оплатить подписку
// `;
//     }

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

//     const subscription = await checkSubscription(ctx.from.id);
//     if (subscription.active) {
//       setTimeout(async () => {
//         try {
//           await ctx.reply(subscription.message, { parse_mode: "HTML" });
//         } catch (e) {
//           console.error("Ошибка отправки статуса подписки:", e);
//         }
//       }, 500);
//     }
//   };
// ================= 10. ФУНКЦИЯ ОТОБРАЖЕНИЯ ГЛАВНОГО МЕНЮ =================
const showMainMenu = async (ctx) => {
  // Обновляем статистику посещений
  await updateUserVisit(ctx.from.id);

  const hasFullAccess = await checkFullAccess(ctx);

  const baseKeyboard = [];

  baseKeyboard.push([
    { text: "🌍 Все страны", callback_data: "all_countries_with_check" },
  ]);

  // 🔥 ДОБАВЛЯЕМ КНОПКУ СОЗДАНИЯ АНКЕТЫ ПЕРЕД КНОПКОЙ "НАЗАД"
  baseKeyboard.push([
    {
      text: "📝 СОЗДАТЬ АНКЕТУ",
      web_app: { url: "https://bot-vai-web-app.web.app/?tab=catalog" },
    },
  ]);

  baseKeyboard.push([
    { text: "💎 Купить подписку", callback_data: "choose_payment_method" },
  ]);
  baseKeyboard.push([
    { text: "👨‍💻 Связаться с админом", url: "https://t.me/MagicAdd" },
  ]);
  baseKeyboard.push([
    { text: "🧹 Очистить экран", callback_data: "clear_screen" },
  ]);

  let welcomeText = `👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в клуб знакомств ✨Magic!</b> 
<em>Здесь ты найдёшь базу данных анкет со всего мира для общения и не только. 
🗄️ База обновляется и пополняется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>\n
<b>✨ Подпишись на новости и обновления в <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a></b>\n`;

  // Добавляем информацию о демо-режиме если нет полного доступа
  if (!hasFullAccess) {
    welcomeText += `\n👀 <b>Сейчас вы в демо-режиме:</b>
• Показано по 3 анкеты на город  
• Контакты скрыты
• ✨ Для полного доступа Вы должны быть подписаны на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a> и оплатить подписку
`;
  }

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

  const subscription = await checkSubscription(ctx.from.id);
  if (subscription.active) {
    setTimeout(async () => {
      try {
        await ctx.reply(subscription.message, { parse_mode: "HTML" });
      } catch (e) {
        console.error("Ошибка отправки статуса подписки:", e);
      }
    }, 500);
  }
};
  // ================= 11. ИНИЦИАЛИЗАЦИЯ КОЛЛЕКЦИЙ =================
  const initCollections = async () => {
    const collections = [
      "subscriptions",
      "transactions",
      "payment_logs",
      "cryptoPayPayments",
      "pioneerUsers", // Добавляем новую коллекцию
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

  // ================= 12. ОБРАБОТЧИК START =================
  bot.start(async (ctx) => {
    try {
      console.log(`🚀 Пользователь ${ctx.from.id} запустил бота через /start`);

      // 1. СРАЗУ показываем меню пользователю
      await showMainMenu(ctx);

      // 2. Параллельно сохраняем данные пользователя и инициализируем кэш
      Promise.all([
        // Сохраняем данные пользователя в pioneerUsers
        saveUserToPioneerUsers(ctx),

        // Инициализируем коллекции если нужно
        initCollections().catch((e) =>
          console.error("Ошибка инициализации:", e)
        ),

        // Инициализируем кэш для пользователя в фоне
        (async () => {
          try {
            const profilesModule = require("./profiles");
            if (profilesModule && profilesModule.ensureUserCache) {
              await profilesModule.ensureUserCache(ctx);
            }
          } catch (error) {
            console.error("Ошибка инициализации кэша:", error);
          }
        })(),
      ]).catch((error) => {
        console.error("Ошибка в фоновых задачах:", error);
      });
    } catch (error) {
      console.error("❌ Ошибка в обработчике start:", error);
      // В случае ошибки все равно показываем меню
      await showMainMenu(ctx);
    }
  });

  // ================= 13. ОБРАБОТЧИК ОЧИСТКИ ЭКРАНА =================
  bot.action("clear_screen", async (ctx) => {
    await clearScreen(ctx);
  });

 // ================= 14. ПРОВЕРКА ПОДПИСКИ НА КАНАЛ =================
bot.action("check_channel_subscription", async (ctx) => {
  try {
    await ctx.answerCbQuery("🔍 Проверяем подписку...");

    console.log(`DEBUG: Начало проверки подписки для пользователя ${ctx.from.id}`);
    
    const isSubscribed = await checkChannelSubscription(ctx);
    
    console.log(`DEBUG: Результат проверки для ${ctx.from.id}: ${isSubscribed}`);

    if (isSubscribed) {
      await ctx.answerCbQuery("✅ Подписка подтверждена!");

      ctx.session = ctx.session || {};
      ctx.session.channelSubscribed = true;

      const successKeyboard = {
        inline_keyboard: [
          [
            {
              text: "🌍 Смотреть анкеты",
              callback_data: "all_countries_with_check",
            },
          ],
          [
            { text: "🔙 Назад", callback_data: "back_to_main" },
            { text: "🧹 Очистить экран", callback_data: "clear_screen" },
          ],
        ],
      };

      await ctx.reply(
        `
🎉 <b>ПОДПИСКА ПОДТВЕРЖДЕНА</b>

✅ Теперь у вас есть доступ к анкетам!
✨ Благодарим за подписку на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a>

<b>Нажмите "Смотреть анкеты" чтобы начать поиск!</b>
      `,
        {
          parse_mode: "HTML",
          reply_markup: successKeyboard,
        }
      );
      
      console.log(`DEBUG: Пользователь ${ctx.from.id} успешно прошел проверку подписки`);
    } else {
      await ctx.answerCbQuery("❌ Вы не подписаны на канал");

      const notSubscribedKeyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ Я ПОДПИСАЛСЯ",
              callback_data: "check_channel_subscription",
            },
          ],
          [
            {
              text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ",
              url: "https://t.me/+H6Eovikei9xiZWU0",
            },
          ],
          [
            { text: "🔙 Назад", callback_data: "back_to_main" },
            { text: "🧹 Очистить экран", callback_data: "clear_screen" },
          ],
        ],
      };

      await ctx.reply(
        `
❌ <b>ПОДПИСКА НЕ НАЙДЕНА</b>

Мы не видим вашу подписку на канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a>

<b>Пожалуйста:</b>
1. Убедитесь, что вы подписались на канал
2. Подождите 5-10 секунд после подписки
3. Нажмите кнопку "Я ПОДПИСАЛСЯ" для повторной проверки

<b>Важно:</b>
• Убедитесь, что вы используете тот же аккаунт Telegram
• Если вы только что подписались, может потребоваться время для обновления статуса

Если проблема не решается:
• Перезагрузите Telegram
• Напишите в поддержку @MagicAdd
      `,
        {
          parse_mode: "HTML",
          reply_markup: notSubscribedKeyboard,
        }
      );
      
      console.log(`DEBUG: Пользователь ${ctx.from.id} не подписан на канал`);
    }
  } catch (error) {
    console.error("Полная ошибка проверки подписки на канал:", error);
    console.error("Детали ошибки:", {
      userId: ctx.from.id,
      errorCode: error.response?.error_code,
      errorDescription: error.response?.description,
      method: error.on?.method,
      payload: error.on?.payload
    });
    
    await ctx.answerCbQuery("❌ Ошибка проверки подписки");
    
    // Показываем сообщение об ошибке
    const errorKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔄 Попробовать снова",
            callback_data: "check_channel_subscription",
          },
        ],
        [
          { text: "🔙 Назад", callback_data: "back_to_main" },
          { text: "🧹 Очистить экран", callback_data: "clear_screen" },
        ],
      ],
    };

    await ctx.reply(
      `
⚠️ <b>ТЕХНИЧЕСКАЯ ОШИБКА</b>

Произошла ошибка при проверке подписки.

<b>Что можно сделать:</b>
1. Нажмите "Попробовать снова"
2. Убедитесь, что бот является администратором канала
3. Проверьте, что канал существует и доступен

<b>Если ошибка повторяется:</b>
• Напишите администратору @MagicAdd
• Укажите код ошибки: <code>${error.response?.error_code || "неизвестно"}</code>
      `,
      {
        parse_mode: "HTML",
        reply_markup: errorKeyboard,
      }
    );
  }
});
// ================= БАНКОВСКАЯ КАРТА =================
bot.action("bank_card_payment", async (ctx) => {
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "➡️ Связаться с админом",
          url: "https://t.me/Audit_Magic",
        },
      ],
      [
        {
          text: "🔙 Назад к выбору оплаты",
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
    `💳 <b>Оплата банковской картой</b>\n\n` +
      `Для оплаты картой свяжитесь с нашим администратором.\n` +
      `В сообщении обязательно укажите:\n\n` +
      `• 🌍 Страну, в которой вы находитесь\n` +
      `• 🏦 Банк, картой которого хотите оплатить\n\n` +
      `После этого администратор подберёт удобный способ оплаты и отправит вам реквизиты.\n\n` +
      `➡️ Связаться с админом: @Audit_Magic`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});
// ================= 15. ВЫБОР СПОСОБА ОПЛАТЫ =================
bot.action("choose_payment_method", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "💳 Оплата банковской картой",
            callback_data: "bank_card_payment",
          },
        ],
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
            text: "🔙 Назад в главное меню",
            callback_data: "back_to_main",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    const paymentMessage = `
💎 <b>ВЫБЕРИ СПОСОБ ОПЛАТЫ</b>

<b>Доступные способы:</b>

💳 <b>Банковская карта</b>
• Оплата картой любой страны
• Связь с администратором
• Подбор удобного способа оплаты

⭐ <b>Stars</b> - оплата через Telegram
• Быстро и удобно
• Внутри Telegram
• Мгновенная активация

💲 <b>USDT</b> - оплата криптовалютой  
• Анонимно и безопасно
• Поддержка USDT, BTC, ETH
• Криптовалютные платежи

💎 <b>TON</b> - оплата в Toncoin
• Быстрые переводы
• Низкие комиссии
• Современная криптовалюта

<b>Выбери способ оплаты:</b>`;

    await ctx.reply(paymentMessage, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    console.log(`Пользователь ${ctx.from.id} выбрал "Выбор способа оплаты"`);
  } catch (error) {
    console.error("Ошибка в choose_payment_method:", error);
    await ctx.reply("❌ Ошибка при загрузке способов оплаты");
  }
});

// ================= 16. ТАРИФЫ ДЛЯ STARS =================
bot.action("show_stars_plans", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔥 1 ДЕНЬ - 99🌟",
            callback_data: "buy_1day",
          },
        ],
        [
          {
            text: "❤️ 1 МЕСЯЦ - 499🌟",
            callback_data: "buy_1month",
          },
        ],
        [
          {
            text: "💫 1 ГОД - 1999🌟",
            callback_data: "buy_forever",
          },
        ],
        [
          {
            text: "🔙 Назад к выбору оплаты",
            callback_data: "choose_payment_method",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    const starsMessage = `
⭐ <b>ОПЛАТА STARS</b>

<b>Telegram Stars - это внутренняя валюта Telegram для оплаты внутри ботов.</b>

<b>Как получить Stars:</b>
1. Откройте Telegram → Настройки
2. Выберите "Telegram Stars" или "Баланс"
3. Пополните баланс Stars

<b>Доступные тарифы:</b>

🔥 <b>1 ДЕНЬ</b> - 99 Stars
• Доступ на 24 часа
• Полный доступ ко всем анкетам
• Отображение контактов

❤️ <b>1 МЕСЯЦ</b> - 499 Stars  
• Доступ на 30 дней
• Экономия 83% по сравнению с дневным тарифом
• Полный доступ ко всем функциям

💫 <b>1 ГОД</b> - 1999 Stars
• Доступ на 365 дней
• Максимальная экономия
• Лучшее предложение

<b>Выбери тариф:</b>`;

    await ctx.reply(starsMessage, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    console.log(`Пользователь ${ctx.from.id} выбрал "Тарифы Stars"`);
  } catch (error) {
    console.error("Ошибка в show_stars_plans:", error);
    await ctx.reply("❌ Ошибка при загрузке тарифов Stars!");
  }
});

// ================= 17. ТАРИФЫ ДЛЯ CRYPTO PAY =================
bot.action("show_crypto_plans", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🟢 1 ДЕНЬ - 1.99 USDT",
            callback_data: "crypto_basic",
          },
        ],
        [
          {
            text: "🔵 1 МЕСЯЦ - 10 USDT",
            callback_data: "crypto_pro",
          },
        ],
        [
          {
            text: "🟣 1 ГОД - 50 USDT",
            callback_data: "crypto_premium",
          },
        ],
        [
          {
            text: "🔙 Назад к выбору оплаты",
            callback_data: "choose_payment_method",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    const cryptoMessage = `
💲 <b>ОПЛАТА USDT (КРИПТОВАЛЮТОЙ)</b>

<b>Что такое USDT?</b>
USDT (Tether) - это стейблкоин, привязанный к доллару США.
1 USDT ≈ 1 USD

<b>Как купить USDT через @CryptoBot:</b>

<b>ШАГ 1: Настройка</b>
1. Запустите @CryptoBot
2. Войдите в "Настройки" 
3. Установите нужную фиатную валюту (рубли, гривны, доллары)

<b>ШАГ 2: Покупка USDT</b>
1. Нажмите "P2P Trading" (P2P-торговля)
2. Выберите "Купить" → "USDT"
3. Выберите способ оплаты (СБП, банковская карта и т.д.)

<b>ШАГ 3: Выбор продавца</b>
1. Найдите продавца с хорошим рейтингом
2. Проверьте курс и лимиты
3. Следуйте инструкциям продавца

<b>ШАГ 4: Оплата</b>
1. Совершите перевод продавцу
2. Подтвердите сделку в боте
3. Дождитесь поступления USDT

<b>Доступные тарифы:</b>

🟢 <b>1 ДЕНЬ</b> - 1.99 USDT
• Мгновенная активация
• Полный доступ на 24 часа

🔵 <b>1 МЕСЯЦ</b> - 10 USDT
• Экономия 83% 
• Доступ на 30 дней

🟣 <b>1 ГОД</b> - 50 USDT
• Максимальная экономия
• Доступ на 365 дней

<b>Выбери тариф:</b>`;

    await ctx.reply(cryptoMessage, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    console.log(`Пользователь ${ctx.from.id} выбрал "Тарифы USDT"`);
  } catch (error) {
    console.error("Ошибка в show_crypto_plans:", error);
    await ctx.reply("❌ Ошибка при загрузке тарифов USDT");
  }
});

  // ================= 18. ТАРИФЫ ДЛЯ TON =================
bot.action("show_ton_plans", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🟡 1 ДЕНЬ - 1 TON",
            callback_data: "ton_basic",
          },
        ],
        [
          {
            text: "🟠 1 МЕСЯЦ - 5 TON",
            callback_data: "ton_pro",
          },
        ],
        [
          {
            text: "🔴 1 ГОД - 25 TON",
            callback_data: "ton_premium",
          },
        ],
        [
          {
            text: "🔙 Назад к выбору оплаты",
            callback_data: "choose_payment_method",
          },
          {
            text: "🧹 Очистить экран",
            callback_data: "clear_screen",
          },
        ],
      ],
    };

    const tonMessage = `
💎 <b>ОПЛАТА TON (TONCOIN)</b>

<b>Что такое TON?</b>
TON (The Open Network) - это быстрая и безопасная блокчейн-платформа.
Используется для мгновенных платежей с низкими комиссиями.

<b>Как купить TON через @CryptoBot:</b>

<b>ШАГ 1: Настройка</b>
1. Запустите @CryptoBot
2. Войдите в "Настройки"
3. Выберите удобную валюту для пополнения

<b>ШАГ 2: Покупка TON</b>  
1. Нажмите "P2P Trading" (P2P-торговля)
2. Выберите "Купить" → "TON"
3. Выберите способ оплаты

<b>ШАГ 3: Выбор продавца</b>
1. Найдите продавца с хорошим рейтингом
2. Проверьте курс TON к USD
3. Следуйте инструкциям продавца

<b>ШАГ 4: Оплата</b>
1. Совершите перевод продавцу
2. Подтвердите сделку в боте
3. Получите TON на кошелек

<b>Доступные тарифы:</b>

🟡 <b>1 ДЕНЬ</b> - 1 TON
• Мгновенная активация
• Полный доступ на 24 часа

🟠 <b>1 МЕСЯЦ</b> - 5 TON
• Экономия 93%
• Доступ на 30 дней

🔴 <b>1 ГОД</b> - 25 TON
• Максимальная экономия
• Доступ на 365 дней

<b>Текущий курс TON:</b> ~$6.5 за 1 TON

<b>Выбери тариф:</b>`;

    await ctx.reply(tonMessage, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    console.log(`Пользователь ${ctx.from.id} выбрал "Тарифы TON"`);
  } catch (error) {
    console.error("Ошибка в show_ton_plans:", error);
    await ctx.reply("❌ Ошибка при загрузке тарифов TON");
  }
});

  // ================= 19. ОБРАБОТКА CRYPTO PAY ПЛАТЕЖЕЙ =================
  bot.action(/crypto_(.+)/, async (ctx) => {
    const plan = ctx.match[1];
    let planData;

    if (plan === "basic") {
      planData = { amount: 1.99, name: "1 день", duration: 1, asset: "USDT" };
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
        status: "pending",
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

  // ================= 20. ОБРАБОТКА TON ПЛАТЕЖЕЙ =================
  bot.action(/ton_(.+)/, async (ctx) => {
    const plan = ctx.match[1];
    let planData;

    if (plan === "basic") {
      planData = { amount: 1, name: "1 день", duration: 1, asset: "TON" };
    } else if (plan === "pro") {
      planData = { amount: 5, name: "1 месяц", duration: 30, asset: "TON" };
    } else if (plan === "premium") {
      planData = { amount: 25, name: "1 год", duration: 365, asset: "TON" };
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
        status: "pending",
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

  // ================= 21. ПРОВЕРКА CRYPTO PAY ПЛАТЕЖА =================
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

      // Если платеж уже обработан
      if (payment.status === "paid") {
        await ctx.answerCbQuery("✅ Платеж уже подтвержден");
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

        // Обновляем статус платежа
        await paymentDoc.ref.update({
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Создаем запись в subscriptions для унификации
        const subRef = db
          .collection("subscriptions")
          .doc(ctx.from.id.toString());

        let endDate = new Date();
        if (planId === "1day") {
          endDate.setDate(endDate.getDate() + 1);
        } else if (planId === "1month") {
          endDate.setDate(endDate.getDate() + 30);
        } else if (planId === "forever") {
          endDate.setFullYear(endDate.getFullYear() + 100);
        }

        const subData = {
          userId: ctx.from.id,
          plan: planId,
          subscriptionType: planId,
          startDate: admin.firestore.FieldValue.serverTimestamp(),
          endDate: admin.firestore.Timestamp.fromDate(endDate),
          status: "active",
          isActive: true,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          paymentMethod: payment.asset === "TON" ? "ton" : "crypto",
        };

        await subRef.set(subData, { merge: true });

        // ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ ПОСЛЕ УСПЕШНОЙ ОПЛАТЫ
        const profilesModule = require("./profiles");
        if (profilesModule && profilesModule.loadFullCacheAfterPayment) {
          await profilesModule.loadFullCacheAfterPayment(ctx.from.id);
        }

        const subscription = await checkSubscription(ctx.from.id);
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🌍 Все страны",
                callback_data: "all_countries_with_check",
              },
            ],
            [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }],
          ],
        };

        await ctx.reply(
          `🎉 <b>ПЛАТЕЖ ПОДТВЕРЖДЕН!</b>\n\n` +
            `✅ Подписка успешно активирована!\n\n` +
            `${subscription.message}\n\n` +
            `<b>📢 Не забудьте подписаться на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a> для полного доступа к анкетам!</b>`,
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

  // ================= 22. ОБРАБОТЧИКИ ПОДПИСОК STARS =================
  // const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
  //   try {
  //     await ctx.replyWithInvoice({
  //       title: `Подписка на ${
  //         planId === "1day"
  //           ? "1 день"
  //           : planId === "1month"
  //           ? "1 месяц"
  //           : "1 год"
  //       }`,
  //       description:
  //         planId === "1day"
  //           ? "Доступ на 24 часа"
  //           : planId === "1month"
  //           ? "Доступ на 30 дней"
  //           : "Доступ на 365 дней",
  //       payload: `${planId}_${ctx.from.id}_${Date.now()}`,
  //       currency: "XTR",
  //       prices: [{ label: "Подписка", amount: amount }],
  //       start_parameter: `${planId}_sub`,
  //     });
  //   } catch (error) {
  //     console.error("Ошибка создания счета:", error);
  //     await ctx.reply("⚠️ Ошибка при создании платежа");
  //   }
  // };
const handleSubscriptionPurchase = async (ctx, planId, amount, duration) => {
  console.log('💰 ==== CREATING STARS INVOICE ====');
  console.log('User:', ctx.from.id);
  console.log('Plan:', planId);
  console.log('Amount:', amount);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Webhook URL:', process.env.WEBAPP_URL);
  
  try {
    // 🔥 ВАЖНО ДЛЯ RENDER: Проверяем токен
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN не найден!');
    }
    
    // 🔥 ДЛЯ RENDER: Добавляем provider_data
    const invoice = await ctx.replyWithInvoice({
      title: `Подписка на ${planId === "1day" ? "1 день" : planId === "1month" ? "1 месяц" : "1 год"}`,
      description: planId === "1day" ? "Доступ на 24 часа" : 
                   planId === "1month" ? "Доступ на 30 дней" : 
                   "Доступ на 365 дней",
      payload: `${planId}_${ctx.from.id}_${Date.now()}`,
      currency: "XTR",
      prices: [{ label: "Подписка", amount: amount }],
      start_parameter: `${planId}_sub`,
      provider_data: JSON.stringify({
        bot_username: process.env.BOT_USERNAME || 'magicboss_bot',
        webhook_url: process.env.WEBAPP_URL
      })
    });
    
    console.log('✅ Invoice created successfully on Render');
    console.log('💰 ==== INVOICE CREATED ====');
    
  } catch (error) {
    console.error('❌ ==== INVOICE CREATION FAILED ON RENDER ====');
    console.error('Full error:', error);
    console.error('Error code:', error.response?.error_code);
    console.error('Error description:', error.response?.description);
    console.error('Bot token (first 10):', process.env.TELEGRAM_BOT_TOKEN?.substring(0, 10));
    console.error('NODE_ENV:', process.env.NODE_ENV);
    console.error('❌ ==============================');
    
    // 🔥 СООБЩЕНИЕ ДЛЯ ПОЛЬЗОВАТЕЛЯ НА RENDER
    await ctx.reply(
      `❌ <b>ПЛАТЕЖНАЯ СИСТЕМА НА RENDER</b>\n\n` +
      `⚠️ Временная ошибка на сервере\n\n` +
      `Попробуйте:\n` +
      `1. Нажмите кнопку оплаты еще раз\n` +
      `2. Подождите 1 минуту\n` +
      `3. Если не работает - используйте USDT/TON\n\n` +
      `<i>Сообщите в поддержку если ошибка повторяется: @MagicAdd</i>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: "🔄 Попробовать снова", 
                callback_data: `start_pay_${planId}` 
              }
            ],
            [
              { 
                text: "💲 Оплатить USDT", 
                callback_data: "show_crypto_plans" 
              },
              { 
                text: "💎 Оплатить TON", 
                callback_data: "show_ton_plans" 
              }
            ]
          ]
        }
      }
    );
  }
};
  bot.action("buy_1day", (ctx) =>
    handleSubscriptionPurchase(ctx, "1day", 1, 86400000)
  );
  bot.action("buy_1month", (ctx) =>
    handleSubscriptionPurchase(ctx, "1month", 499, 2592000000)
  );
  bot.action("buy_forever", (ctx) =>
    handleSubscriptionPurchase(ctx, "forever", 1999, 31536000000)
  );
bot.on("pre_checkout_query", async (ctx) => {
  console.log('🔍 ========== PRE CHECKOUT QUERY ==========');
  console.log('User ID:', ctx.from.id);
  console.log('Query ID:', ctx.preCheckoutQuery.id);
  console.log('Currency:', ctx.preCheckoutQuery.currency);
  console.log('Amount:', ctx.preCheckoutQuery.total_amount);
  console.log('Payload:', ctx.preCheckoutQuery.invoice_payload);
  console.log('✅ =====================================');
  
  try {
    await ctx.answerPreCheckoutQuery(true);
    console.log('✅ Pre-checkout approved');
  } catch (error) {
    console.error('❌ Pre-checkout error:', error);
    console.error('Error response:', error.response);
    await ctx.answerPreCheckoutQuery(false, "Payment system error");
  }
});
  // bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on("successful_payment", async (ctx) => {
  console.log('🚀 ========== PAYMENT SUCCESS START ==========');
  
  // 1. Логируем ВСЕ детали платежа
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('👤 User ID:', ctx.from.id);
  console.log('👤 Username:', ctx.from.username);
  console.log('💰 Payment object:', JSON.stringify(ctx.message.successful_payment, null, 2));
  console.log('📦 Invoice payload:', ctx.message.successful_payment?.invoice_payload);
  console.log('💳 Currency:', ctx.message.successful_payment?.currency);
  console.log('💵 Total amount:', ctx.message.successful_payment?.total_amount);
  console.log('📝 Provider charge ID:', ctx.message.successful_payment?.provider_payment_charge_id);
  console.log('🤖 Telegram charge ID:', ctx.message.successful_payment?.telegram_payment_charge_id);
  
  // 2. Логируем конфигурацию бота
  console.log('🤖 Bot token exists:', !!process.env.TELEGRAM_BOT_TOKEN);
  console.log('🌐 Webhook URL:', process.env.WEBAPP_URL);
  console.log('🏗 Render URL:', process.env.RENDER_EXTERNAL_URL);
  
  const userId = ctx.from.id;
  const payment = ctx.message.successful_payment;
  const [planId, _] = payment.invoice_payload.split("_");
  
  console.log('🎯 Plan ID from payload:', planId);
  console.log('🔍 Parsed user ID from payload:', _);
  
  console.log('✅ ========== PAYMENT DATA LOGGED ==========');

  try {
    // 3. Очищаем чат (как у тебя было)
    await clearChat(ctx);

    // 4. Сохраняем платеж в Firestore
    console.log('💾 Saving payment to Firestore...');
    const paymentRef = db.collection("payment_logs").doc(`${userId}_${Date.now()}`);
    await paymentRef.set({
      userId: userId,
      telegramId: ctx.from.id,
      username: ctx.from.username,
      paymentData: payment,
      planId: planId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // environment: process.env.NODE_ENV || 'development',
      status: 'processing'
    });
    console.log('💾 Payment saved to Firestore with ID:', paymentRef.id);

    // 5. Активация подписки (твой существующий код)
    const subRef = db.collection("subscriptions").doc(userId.toString());
    
    console.log('🔄 Activating subscription for plan:', planId);
    
    const subData = {
      userId,
      plan: planId,
      subscriptionType: planId,
      startDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      isActive: true,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: "stars",
      paymentLogId: paymentRef.id,
      paymentAmount: payment.total_amount,
      paymentCurrency: payment.currency
    };

    // Устанавливаем дату окончания
    if (planId === "1day") {
      subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000));
      console.log('📅 End date set: 1 day');
    } else if (planId === "1month") {
      subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000));
      console.log('📅 End date set: 1 month');
    } else if (planId === "forever") {
      subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 31536000000));
      console.log('📅 End date set: 1 year (forever)');
    }

    await subRef.set(subData, { merge: true });
    console.log('✅ Subscription activated in Firestore');

    // 6. Загружаем полный кэш
    console.log('🚀 Loading full cache after payment...');
    const profilesModule = require("./profiles");
    if (profilesModule && profilesModule.loadFullCacheAfterPayment) {
      await profilesModule.loadFullCacheAfterPayment(userId);
    }
    console.log('✅ Full cache loaded');

    // 7. Проверяем подписку
    console.log('🔍 Checking subscription status...');
    const subscription = await checkSubscription(userId);
    console.log('📊 Subscription check result:', subscription);

    // 8. Отправляем сообщение пользователю
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🌍 Все страны",
            callback_data: "all_countries_with_check",
          },
        ],
        [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }],
      ],
    };

    const messageText = 
      `🎉 <b>ПЛАТЕЖ УСПЕШНО ОБРАБОТАН!</b>\n\n` +
      `✅ Подписка активирована: <b>${planId === "1day" ? "1 день" : planId === "1month" ? "1 месяц" : "1 год"}</b>\n` +
      `💰 Сумма: ${payment.total_amount} ${payment.currency}\n` +
      `🆔 ID платежа: <code>${paymentRef.id}</code>\n\n` +
      `${subscription.message || "Подписка активна!"}\n\n` +
      `<b>📢 Не забудьте подписаться на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0">MagicClubPrivate</a> для полного доступа!</b>`;

    await ctx.reply(messageText, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    
    console.log('📨 Success message sent to user');
    
    // 9. Обновляем статус платежа
    await paymentRef.update({
      status: 'completed',
      subscriptionId: subRef.id,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('🚀 ========== PAYMENT SUCCESS END ==========');

  } catch (error) {
    console.error('❌ ========== PAYMENT PROCESSING ERROR ==========');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('❌ ============================================');
    
    // Сохраняем ошибку
    if (paymentRef) {
      await paymentRef.update({
        status: 'failed',
        error: error.message,
        errorStack: error.stack,
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Сообщаем пользователю
    await ctx.reply(
      `⚠️ <b>ПЛАТЕЖ ПРИНЯТ, НО ВОЗНИКЛА ОШИБКА</b>\n\n` +
      `✅ Средства списаны\n` +
      `❌ Ошибка активации подписки\n\n` +
      `🆔 ID платежа: <code>${paymentRef?.id || 'неизвестно'}</code>\n` +
      `📞 Свяжитесь с поддержкой: @MagicAdd\n\n` +
      `<i>Сообщите этот ID для быстрого решения проблемы</i>`,
      { parse_mode: "HTML" }
    );
  }
});
  // bot.on("successful_payment", async (ctx) => {
  //   const userId = ctx.from.id;
  //   const payment = ctx.message.successful_payment;
  //   const [planId, _] = payment.invoice_payload.split("_");

  //   try {
  //     await clearChat(ctx);

  //     const subRef = db.collection("subscriptions").doc(userId.toString());
  //     const subData = {
  //       userId,
  //       plan: planId,
  //       subscriptionType: planId,
  //       startDate: admin.firestore.FieldValue.serverTimestamp(),
  //       status: "active",
  //       isActive: true,
  //       lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  //       paymentMethod: "stars",
  //     };

  //     if (planId === "1day") {
  //       subData.endDate = admin.firestore.Timestamp.fromDate(
  //         new Date(Date.now() + 86400000)
  //       );
  //     } else if (planId === "1month") {
  //       subData.endDate = admin.firestore.Timestamp.fromDate(
  //         new Date(Date.now() + 2592000000)
  //       );
  //     } else if (planId === "forever") {
  //       subData.endDate = admin.firestore.Timestamp.fromDate(
  //         new Date(Date.now() + 31536000000)
  //       );
  //     }

  //     await subRef.set(subData, { merge: true });

  //     // ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ ПОСЛЕ УСПЕШНОЙ ОПЛАТЫ
  //     const profilesModule = require("./profiles");
  //     if (profilesModule && profilesModule.loadFullCacheAfterPayment) {
  //       await profilesModule.loadFullCacheAfterPayment(userId);
  //     }

  //     const subscription = await checkSubscription(userId);
  //     const keyboard = {
  //       inline_keyboard: [
  //         [
  //           {
  //             text: "🌍 Все страны",
  //             callback_data: "all_countries_with_check",
  //           },
  //         ],
  //         [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }],
  //       ],
  //     };

  //     await ctx.reply(
  //       `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}\n\n` +
  //         `<b>📢 Не забудьте подписаться на наш канал <a href="https://t.me/+H6Eovikei9xiZWU0"><b>MagicClubPrivate</b></a> для полного доступа к анкетам!</b>`,
  //       {
  //         parse_mode: "HTML",
  //         reply_markup: keyboard,
  //       }
  //     );
  //   } catch (error) {
  //     console.error("Ошибка обработки платежа:", error);
  //     await ctx.reply("⚠️ Ошибка активации подписки");
  //   }
  // });

  // ================= 23. НАЗАД В ГЛАВНОЕ МЕНЮ =================
  bot.action("back_to_main", async (ctx) => {
    await showMainMenu(ctx);
  });

  // ================= 24. ОБРАБОТЧИК ВОЗВРАТА В МЕНЮ =================
  bot.action("back_to_menu", async (ctx) => {
    await showMainMenu(ctx);
  });

  // Экспортируем функции для использования в других модулях
  return {
    checkSubscription,
    checkChannelSubscription,
    checkFullAccess,
    showMainMenu,
    clearScreen,
    saveUserToPioneerUsers,
    updateUserVisit,
  };
};


