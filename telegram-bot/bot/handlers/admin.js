// module.exports = (bot, db) => {
//   // Админ-команды
//   bot.command('admin', async (ctx) => {
//     if (!ctx.isAdmin) return
    
//     // Получаем статистику
//     const [usersCount, profilesCount] = await Promise.all([
//       db.collection('users').count().get(),
//       db.collection('profiles').count().get()
//     ])
    
//     await ctx.replyWithHTML(`
// <b>Админ-панель</b>
// ├ Пользователей: ${usersCount.data().count}
// ├ Анкет: ${profilesCount.data().count}
// └ Доход: ${await getRevenue()} ₽

// Команды:
// /moderation - Модерация анкет
// /stats - Подробная статистика
//     `)
//   })

//   async function getRevenue() {
//     // Логика расчета дохода
//     return 0 // Заглушка
//   }
// }
// module.exports = (bot, db) => {
  
//   // Команда для админа - просмотр подписок пользователя
//   bot.command('subinfo', async (ctx) => {
//     if (!ctx.isAdmin) {
//       return ctx.reply('⛔ У вас нет прав для этой команды');
//     }
    
//     try {
//       // Получаем ID пользователя из команды (/subinfo 12345)
//       const userId = ctx.message.text.split(' ')[1];
//       if (!userId) {
//         return ctx.reply('Использование: /subinfo USER_ID');
//       }
      
//       // Получаем информацию о подписке
//       const subRef = db.collection('subscriptions').doc(userId);
//       const doc = await subRef.get();
      
//       if (!doc.exists) {
//         return ctx.reply('ℹ Пользователь не имеет активных подписок');
//       }
      
//       const subData = doc.data();
//       let message = `📝 Информация о подписке пользователя ${userId}:\n\n`;
//       message += `Тип: ${subData.subscriptionType}\n`;
//       message += `Статус: ${subData.isActive ? 'Активна' : 'Неактивна'}\n`;
//       message += `Начало: ${subData.startDate.toDate().toLocaleString()}\n`;
      
//       if (subData.subscriptionType === 'forever') {
//         message += `Окончание: Бессрочно\n`;
//       } else {
//         message += `Окончание: ${subData.endDate.toDate().toLocaleString()}\n`;
//         message += `Осталось: ${Math.ceil((subData.endDate.toDate() - new Date()) / (1000 * 60 * 60 * 24))} дней\n`;
//       }
      
//       await ctx.reply(message);
      
//       // Показываем кнопки управления
//       await ctx.reply('Действия:', {
//         reply_markup: {
//           inline_keyboard: [
//             [
//               { 
//                 text: subData.isActive ? 'Деактивировать' : 'Активировать', 
//                 callback_data: `toggle_sub_${userId}`
//               },
//               { 
//                 text: 'Удалить подписку', 
//                 callback_data: `delete_sub_${userId}`
//               }
//             ]
//           ]
//         }
//       });
      
//     } catch (error) {
//       console.error('Ошибка получения информации о подписке:', error);
//       await ctx.reply('❌ Ошибка при получении информации о подписке');
//     }
//   });
  
//   // Обработка кнопок управления подпиской
//   bot.action(/toggle_sub_(.+)/, async (ctx) => {
//     if (!ctx.isAdmin) {
//       return ctx.answerCbQuery('⛔ У вас нет прав для этого действия');
//     }
    
//     const userId = ctx.match[1];
    
//     try {
//       const subRef = db.collection('subscriptions').doc(userId);
//       const doc = await subRef.get();
      
//       if (!doc.exists) {
//         return ctx.answerCbQuery('Подписка не найдена');
//       }
      
//       const currentStatus = doc.data().isActive;
//       await subRef.update({
//         isActive: !currentStatus,
//         updatedAt: admin.firestore.FieldValue.serverTimestamp()
//       });
      
//       await ctx.answerCbQuery(`Подписка ${!currentStatus ? 'активирована' : 'деактивирована'}`);
//       await ctx.deleteMessage();
//       await ctx.reply(`Статус подписки пользователя ${userId} изменен на: ${!currentStatus ? 'Активна' : 'Неактивна'}`);
      
//     } catch (error) {
//       console.error('Ошибка изменения статуса подписки:', error);
//       await ctx.answerCbQuery('❌ Ошибка при изменении статуса');
//     }
//   });
  
//   bot.action(/delete_sub_(.+)/, async (ctx) => {
//     if (!ctx.isAdmin) {
//       return ctx.answerCbQuery('⛔ У вас нет прав для этого действия');
//     }
    
//     const userId = ctx.match[1];
    
//     try {
//       await db.collection('subscriptions').doc(userId).delete();
//       await ctx.answerCbQuery('Подписка удалена');
//       await ctx.deleteMessage();
//       await ctx.reply(`Подписка пользователя ${userId} удалена`);
      
//     } catch (error) {
//       console.error('Ошибка удаления подписки:', error);
//       await ctx.answerCbQuery('❌ Ошибка при удалении подписки');
//     }
//   });
// };
//admin.js
// const admin = require('firebase-admin');

// module.exports = (bot, db) => {
//   // 1. Просмотр информации о подписке
//   bot.command('subinfo', async (ctx) => {
//     if (!ctx.isAdmin) return ctx.reply('⛔ Только для администратора');
    
//     try {
//       const userId = ctx.message.text.split(' ')[1] || ctx.from.id;
//       if (!userId) return ctx.reply('Использование: /subinfo [USER_ID]');

//       const subRef = db.collection('subscriptions').doc(userId.toString());
//       const subDoc = await subRef.get();

//       if (!subDoc.exists) return ctx.reply('❌ Подписка не найдена');

//       const subData = subDoc.data();
//       const userRef = db.collection('usersPay').doc(userId.toString());
//       const userDoc = await userRef.get();
//       const userData = userDoc.exists ? userDoc.data() : { balance: 0 };

//       let message = `📊 <b>Информация о пользователе ${userId}</b>\n\n`;
//       message += `💰 Баланс: ${userData.balance || 0}🌟\n`;
//       message += `🔹 Подписка: ${subData.plan || 'нет'}\n`;
//       message += `🔄 Статус: ${subData.isActive ? 'Активна' : 'Неактивна'}\n`;
//       message += `⏳ Начало: ${subData.startDate.toDate().toLocaleString()}\n`;
      
//       if (subData.endDate) {
//         message += `⏰ Окончание: ${subData.endDate.toDate().toLocaleString()}\n`;
//         const daysLeft = Math.ceil((subData.endDate.toDate() - new Date()) / (86400000));
//         message += `📅 Осталось: ${daysLeft} дней\n`;
//       } else {
//         message += `⏰ Окончание: Бессрочная\n`;
//       }

//       await ctx.reply(message, { parse_mode: 'HTML' });

//       // Кнопки управления
//       if (ctx.isAdmin) {
//         await ctx.reply('Действия:', {
//           reply_markup: {
//             inline_keyboard: [
//               [
//                 { 
//                   text: subData.isActive ? 'Деактивировать' : 'Активировать', 
//                   callback_data: `admin_toggle_sub_${userId}`
//                 },
//                 { 
//                   text: 'Удалить подписку', 
//                   callback_data: `admin_delete_sub_${userId}`
//                 }
//               ],
//               [
//                 {
//                   text: 'Пополнить баланс',
//                   callback_data: `admin_add_balance_${userId}`
//                 }
//               ]
//             ]
//           }
//         });
//       }

//     } catch (error) {
//       console.error('Subinfo error:', error);
//       await ctx.reply('⚠️ Ошибка при получении информации');
//     }
//   });

//   // 2. Управление подписками
//   bot.action(/admin_toggle_sub_(.+)/, async (ctx) => {
//     if (!ctx.isAdmin) return ctx.answerCbQuery('⛔ Недостаточно прав');
    
//     try {
//       const userId = ctx.match[1];
//       const subRef = db.collection('subscriptions').doc(userId.toString());

//       await db.runTransaction(async (t) => {
//         const doc = await t.get(subRef);
//         if (!doc.exists) throw new Error('Подписка не найдена');
        
//         const current = doc.data().isActive || false;
//         t.update(subRef, { 
//           isActive: !current,
//           lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//         });
//       });

//       await ctx.answerCbQuery(`Подписка ${ctx.match[1]} ${!current ? 'активирована' : 'деактивирована'}`);
//       await ctx.deleteMessage();
//       await ctx.reply(`✅ Статус подписки обновлен`);

//     } catch (error) {
//       console.error('Toggle sub error:', error);
//       await ctx.answerCbQuery('❌ Ошибка изменения статуса');
//     }
//   });

//   bot.action(/admin_delete_sub_(.+)/, async (ctx) => {
//     if (!ctx.isAdmin) return ctx.answerCbQuery('⛔ Недостаточно прав');
    
//     try {
//       const userId = ctx.match[1];
//       await db.collection('subscriptions').doc(userId.toString()).delete();
//       await ctx.answerCbQuery('✅ Подписка удалена');
//       await ctx.deleteMessage();
//       await ctx.reply(`Подписка пользователя ${userId} удалена`);

//     } catch (error) {
//       console.error('Delete sub error:', error);
//       await ctx.answerCbQuery('❌ Ошибка удаления');
//     }
//   });

//   // 3. Управление балансом
//   bot.action(/admin_add_balance_(.+)/, async (ctx) => {
//     if (!ctx.isAdmin) return ctx.answerCbQuery('⛔ Недостаточно прав');
    
//     try {
//       const userId = ctx.match[1];
//       await ctx.reply(`Введите сумму для пополнения баланса пользователя ${userId}:`);
      
//       // Ожидаем ввод суммы
//       bot.hears(/^\d+$/, async (ctx) => {
//         const amount = parseInt(ctx.message.text);
//         if (isNaN(amount) || amount <= 0) {
//           return ctx.reply('❌ Неверная сумма');
//         }

//         await db.collection('usersPay').doc(userId.toString()).update({
//           balance: admin.firestore.FieldValue.increment(amount),
//           lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//         });

//         await ctx.reply(`✅ Пользователю ${userId} добавлено ${amount}🌟`);
//       });

//     } catch (error) {
//       console.error('Add balance error:', error);
//       await ctx.answerCbQuery('❌ Ошибка пополнения');
//     }
//   });
// };
const admin = require('firebase-admin');

module.exports = (bot, db) => {
  // 1. Проверка активной подписки
  const checkSubscription = async (userId) => {
    try {
      const subRef = db.collection('subscriptions').doc(userId.toString());
      const doc = await subRef.get();
      
      if (!doc.exists) return false;
      
      const subData = doc.data();
      
      if (subData.subscriptionType === 'forever' && subData.isActive) {
        return { 
          active: true,
          type: 'forever',
          message: '🎉 У вас бессрочная подписка!'
        };
      }
      
      if (subData.endDate && subData.endDate.toDate() > new Date() && subData.isActive) {
        return {
          active: true,
          type: subData.subscriptionType,
          endDate: subData.endDate.toDate(),
          message: `✅ Ваша подписка активна до: ${subData.endDate.toDate().toLocaleString()}`
        };
      }
      
      return false;
    } catch (error) {
      console.error('Ошибка проверки подписки:', error);
      return false;
    }
  };

  // 2. Обработчик стартового сообщения
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const subscription = await checkSubscription(userId);
    
    try {
      await ctx.replyWithPhoto(
        { 
          url: 'https://st4.depositphotos.com/2944823/21275/i/450/depositphotos_212755884-stock-photo-fashion-outdoor-photo-group-beautiful.jpg',
          filename: 'welcome.jpg'
        },
        {
          caption: `👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в бот знакомств 🅿🅴🅰🅲🅴💋🆈🅾🆄🆁🥕🅶🆄🅽</b> 
<em>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
🎉 Каталог обновляется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!</em>
<b>⚠🚨 Для использования сервиса тебе должно быть 18+❗</b>
${subscription ? `\n\n${subscription.message}` : ''}`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
              [{ text: '🌐 Открыть в браузере PeaceYourGun 🥕', url: process.env.WEBAPP_URL }],
              [{ text: '🔥 Купить подписку на 1 день (399🌟)', callback_data: 'start_pay_1day' }],
              [{ text: '❤️ Купить подписку на 1 месяц (799🌟)', callback_data: 'start_pay_1month' }],
              [{ text: '💫 Купить подписку навсегда (3999🌟)', callback_data: 'start_pay_forever' }]
            ]
          }
        }
      );
    } catch (e) {
      console.error('Ошибка при отправке фото:', e);
      await ctx.reply(`👋<b> Привет, ${ctx.from.first_name}!
Добро пожаловать в бот знакомств</b> +
<b>Здесь ты найдёшь каталог анкет со всего мира для общения, флирта и серьёзных отношений.
🎉 Каталог обновляется каждый день — всегда свежие профили!
Начни поиск или размести свою анкету — возможно, твоя вторая половинка уже здесь!
⚠ Для использования сервиса тебе должно быть 18+</b>
${subscription ? `\n\n${subscription.message}` : ''}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👩‍🦰 Анкеты PeaceYourGun 🥕', callback_data: 'show_profiles' }],
            [{ text: '🌐 Открыть в браузере PeaceYourGun 🥕', url: process.env.WEBAPP_URL }],
            [{ text: '🔥 Купить подписку на 1 день (399🌟)', callback_data: 'start_pay_1day' }],
            [{ text: '❤️ Купить подписку на 1 месяц (799🌟)', callback_data: 'start_pay_1month' }],
            [{ text: '💫 Купить подписку навсегда (3999🌟)', callback_data: 'start_pay_forever' }]
          ]
        }
      });
    }
  });

  // 3. Обработка выбора тарифа (для реальных звёзд)
  bot.action(/start_pay_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    const planId = ctx.match[1];
    
    try {
      // Тарифные планы
      const plan = {
        '1day': { price: 399, name: "1 день", duration: 86400000 },
        '1month': { price: 799, name: "1 месяц", duration: 2592000000 },
        'forever': { price: 3999, name: "1 год", duration: null }
      }[planId];

      if (!plan) throw new Error('Неизвестный тариф');

      // Проверяем баланс реальных звёзд через Telegram API
      const userStars = await ctx.telegram.getUserStars(userId);
      if (userStars < plan.price) {
        throw new Error(`Недостаточно звёзд. Ваш баланс: ${userStars}🌟`);
      }

      // Создаем транзакцию
      const txRef = db.collection('transactions').doc();
      await txRef.set({
        userId,
        amount: plan.price,
        plan: planId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Запрашиваем списание звёзд
      await ctx.telegram.spendStars({
        user_id: userId,
        amount: plan.price,
        transaction_id: txRef.id
      });

      // Активируем подписку
      const subRef = db.collection('subscriptions').doc(userId.toString());
      const subData = {
        userId,
        plan: planId,
        subscriptionType: planId,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active',
        isActive: true,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      if (plan.duration) {
        subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + plan.duration));
      }

      await subRef.set(subData, { merge: true });

      // Обновляем статус транзакции
      await txRef.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await ctx.editMessageText('✅ Подписка успешно активирована!');

    } catch (error) {
      console.error('Ошибка оплаты звёздами:', error);
      await ctx.reply(`⚠️ Ошибка: ${error.message}`);
    }
  });
};