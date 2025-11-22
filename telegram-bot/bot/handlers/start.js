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
  const checkChannelSubscription = async (ctx) => {
    try {
      const userId = ctx.from.id;
      const channelUsername = "@MagicYourClub";

      const chatMember = await ctx.telegram.getChatMember(
        channelUsername,
        userId
      );

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
  const checkFullAccess = async (ctx) => {
    try {
      const subscription = await checkSubscription(ctx.from.id);
      const hasChannelSubscription = await checkChannelSubscription(ctx);

      return subscription.active && hasChannelSubscription;
    } catch (error) {
      console.error("Ошибка проверки полного доступа:", error);
      return false;
    }
  };

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
            url: "https://t.me/MagicYourClub",
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

Для доступа к анкетам необходимо подписаться на наш канал <b>@MagicYourClub</b>

✨ <b>Почему это важно:</b>
• Получайте уведомления о новых анкетах
• Будьте в курсе обновлений бота
• Узнавайте о специальных предложениях
• Получайте эксклюзивный контент

<b>Инструкция:</b>
1. Нажмите кнопку "ПОДПИСАТЬСЯ НА КАНАЛ"
2. Подпишитесь на канал @MagicYourClub
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
      { text: "📝 СОЗДАТЬ АНКЕТУ", web_app: { url: "https://bot-vai-web-app.web.app/?tab=catalog" } }
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
<a href="http://t.me/MagicYourClub"><b>Подпишись на новости и обновления в Magic ClubX ✨</b></a>\n`;

    // Добавляем информацию о демо-режиме если нет полного доступа
    if (!hasFullAccess) {
      welcomeText += `\n👀 <b>Сейчас вы в демо-режиме:</b>
• Показано по 1 анкете на город  
• Контакты скрыты
• ✨ Для полного доступа Вы должны быть подписаны на наш канал @MagicYourClub и оплатить подписку
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
    { text: "📝 СОЗДАТЬ АНКЕТУ", web_app: { url: "https://bot-vai-web-app.web.app/?tab=catalog" } }
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
<b>✨ Подпишись на новости и обновления в <a href="http://t.me/MagicYourClub">Magic ClubX</b></a>\n`;

  // Добавляем информацию о демо-режиме если нет полного доступа
  if (!hasFullAccess) {
    welcomeText += `\n👀 <b>Сейчас вы в демо-режиме:</b>
• Показано по 1 анкете на город  
• Контакты скрыты
• ✨ Для полного доступа Вы должны быть подписаны на наш канал @MagicYourClub и оплатить подписку
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

      const isSubscribed = await checkChannelSubscription(ctx);

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
🎉 <b>ПОДПИСКА ПОДТВЕРЖДЕНА!</b>

✅ Теперь у вас есть доступ к анкетам в демо-режиме!
✨ Благодарим за подписку на наш канал @MagicYourClub

👀 <b></b>
• Показано по 1 анкете на город  
• Контакты скрыты
• ✨ Для полного доступа Вы должны быть подписаны на наш канал @MagicYourClub и оплатить подписку

<b>Нажмите "Смотреть анкеты" чтобы начать!</b>
        `,
          {
            parse_mode: "HTML",
            reply_markup: successKeyboard,
          }
        );
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
                url: "https://t.me/MagicYourClub",
              },
            ],
            [{ text: "🔙 Назад", callback_data: "back_to_main" }],
          ],
        };

        await ctx.reply(
          `
❌ <b>ПОДПИСКА НЕ НАЙДЕНА</b>

Мы не видим вашу подписку на канал @MagicYourClub

<b>Пожалуйста:</b>
1. Убедитесь, что вы подписались на канал
2. Нажмите кнопку "Я ПОДПИСАЛСЯ" для повторной проверки

Если проблема persists, попробуйте:
• Перезагрузить Telegram
• Убедиться, что вы используете тот же аккаунт
• Написать в поддержку @MagicAdd
        `,
          {
            parse_mode: "HTML",
            reply_markup: notSubscribedKeyboard,
          }
        );
      }
    } catch (error) {
      console.error("Ошибка проверки подписки на канал:", error);
      await ctx.answerCbQuery("❌ Ошибка проверки подписки");
    }
  });

  // ================= 15. ВЫБОР СПОСОБА ОПЛАТЫ =================
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

  // ================= 16. ТАРИФЫ ДЛЯ STARS =================
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

  // ================= 17. ТАРИФЫ ДЛЯ CRYPTO PAY =================
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
      ` <b>ОПЛАТА USDT </b>\n\n` +
        `Чтобы купить USDT через 🤖крипто-бота, выберите бота, найдите раздел P2P-торговли, выберите USDT, затем укажите способ оплаты (например, СБП) и найдите подходящего продавца, чьи лимиты и курс вас устраивают. Следуйте инструкции продавца для завершения сделки: сделайте перевод фиатных денег и дождитесь поступления USDT на ваш счет.\n\n` +
        `<b>Пошаговая инструкция:</b>\n` +
        `1. Найдите бота: Запустите нужного крипто-бота, например, через телеграм-кошелек.\n` +
        `2. Настройте бота (необязательно): Перед началом зайдите в «Настройки», чтобы установить нужную фиатную валюту (например, гривну или рубль), это повлияет на доступные способы оплаты.\n` +
        `3. Перейдите в P2P-раздел: Найдите в меню раздел «P2P» (peer-to-peer), где происходит покупка и продажа криптовалюту напрямую между пользователями.\n` +
        `4. Выберите «Купить»: Нажмите на кнопку «Купить», выберите USDT и удобный для вас метод оплаты (например, СБП, банковский перевод).\n` +
        `5. Выберите продавца: Ознакомьтесь с предложенными продавцами. Обратите внимание на курс, лимиты по сумме и репутацию продавца.\n` +
        `6. Создайте сделку: Выберите подходящего продавца и следуйте его инструкции для совершения сделки.\n` +
        `7. Подтвердите перевод: После совершения перевода подтвердите сделку в боте. Продавец получит уведомление, и после проверки оплаты отправит вам USDT.\n\n` +
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

  // ================= 18. ТАРИФЫ ДЛЯ TON =================
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

  // ================= 19. ОБРАБОТКА CRYPTO PAY ПЛАТЕЖЕЙ =================
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
            `<b>📢 Не забудьте подписаться на наш канал @MagicYourClub для полного доступа к анкетам!</b>`,
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

      // ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ ПОСЛЕ УСПЕШНОЙ ОПЛАТЫ
      const profilesModule = require("./profiles");
      if (profilesModule && profilesModule.loadFullCacheAfterPayment) {
        await profilesModule.loadFullCacheAfterPayment(userId);
      }

      const subscription = await checkSubscription(userId);
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
        `✅ <b>Подписка успешно активирована!</b>\n\n${subscription.message}\n\n` +
          `<b>📢 Не забудьте подписаться на наш канал @MagicYourClub для полного доступа к анкетам!</b>`,
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