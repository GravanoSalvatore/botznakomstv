
// const admin = require('firebase-admin');

// module.exports = (bot, db) => {
//   // 1. Жесткая инициализация коллекций
//   const initCollections = async () => {
//     const requiredCollections = [
//       'usersPay',
//       'payments',
//       'subscriptions',
//       'payment_logs',
//       'transactions'
//     ];

//     for (const colName of requiredCollections) {
//       try {
//         // Проверяем существование коллекции через попытку записи
//         const docRef = db.collection(colName).doc('init_check');
//         await docRef.set({
//           _init: true,
//           timestamp: admin.firestore.FieldValue.serverTimestamp()
//         });
//         await docRef.delete();
//         console.log(`[Firebase] Коллекция ${colName} доступна`);
//       } catch (error) {
//         console.error(`[Firebase] Ошибка доступа к ${colName}:`, error);
//         // Создаем коллекцию через отдельный документ
//         const tempDoc = await db.collection(colName).add({
//           _created: true,
//           timestamp: admin.firestore.FieldValue.serverTimestamp()
//         });
//         await tempDoc.delete();
//         console.log(`[Firebase] Коллекция ${colName} создана принудительно`);
//       }
//     }
//   };

//   // 2. Инициализация при старте
//   initCollections().catch(console.error);

//   // 3. Проверка и создание пользователя с начальным балансом
//   const ensureUser = async (userId) => {
//     const userRef = db.collection('usersPay').doc(userId.toString());
//     try {
//       await db.runTransaction(async (t) => {
//         const doc = await t.get(userRef);
//         if (!doc.exists) {
//           t.set(userRef, {
//             balance: 1000, // Начальный баланс для тестирования
//             reserved: 0,
//             createdAt: admin.firestore.FieldValue.serverTimestamp(),
//             lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//           });
//           console.log(`[User] Создан пользователь ${userId} с начальным балансом`);
//         }
//       });
//       return userRef;
//     } catch (error) {
//       console.error('Ошибка создания пользователя:', error);
//       throw error;
//     }
//   };

//   // 4. Обработка команды /buy
//   bot.command('buy', async (ctx) => {
//     try {
//       const userId = ctx.from.id;
//       const userRef = await ensureUser(userId);
//       const userDoc = await userRef.get();
//       const balance = userDoc.data().balance || 0;

//       const plans = [
//         { id: '1day', name: "1 день", price: 1, duration: 86400000 },
//         { id: '1month', name: "1 месяц", price: 2000, duration: 2592000000 }
//       ];

//       await ctx.reply(`💰 <b>Ваш баланс: ${balance}🌟</b>\nВыберите подписку:`, {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: plans.map(p => [
//             { 
//               text: `${p.name} - ${p.price}🌟`, 
//               callback_data: `start_pay_${p.id}`
//             }
//           ])
//         }
//       });

//     } catch (error) {
//       console.error('Buy command error:', error);
//       await ctx.reply('⚠️ Ошибка при загрузке меню');
//     }
//   });

//   // 5. Обработка начала платежа
//   bot.action(/start_pay_(.+)/, async (ctx) => {
//     const userId = ctx.from.id;
//     const planId = ctx.match[1];
    
//     try {
//       const plan = {
//         '1day': { price: 1, name: "1 день", duration: 86400000 },
//         '1month': { price: 2000, name: "1 месяц", duration: 2592000000 }
//       }[planId];

//       if (!plan) throw new Error('Неизвестный тариф');

//       const userRef = db.collection('usersPay').doc(userId.toString());
//       const txRef = db.collection('transactions').doc();

//       // Атомарная транзакция
//       await db.runTransaction(async (t) => {
//         const userDoc = await t.get(userRef);
//         const userData = userDoc.data() || {};
//         const available = (userData.balance || 0) - (userData.reserved || 0);

//         if (available < plan.price) {
//           throw new Error(`Недостаточно средств. Доступно: ${available}🌟`);
//         }

//         // Резервируем средства
//         t.update(userRef, {
//           reserved: admin.firestore.FieldValue.increment(plan.price),
//           lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//         });

//         // Создаем транзакцию
//         t.set(txRef, {
//           userId,
//           amount: plan.price,
//           plan: planId,
//           status: 'pending',
//           createdAt: admin.firestore.FieldValue.serverTimestamp()
//         });
//       });

//       await ctx.editMessageText(
//         `Подтвердите покупку:\n\n` +
//         `🔹 ${plan.name}\n` +
//         `🔹 ${plan.price}🌟\n\n` +
//         `Баланс после списания: ${(userDoc.data().balance || 0) - plan.price}🌟`,
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '✅ Подтвердить', callback_data: `confirm_pay_${txRef.id}` }],
//               [{ text: '❌ Отмена', callback_data: `cancel_pay_${txRef.id}` }]
//             ]
//           }
//         }
//       );

//     } catch (error) {
//       console.error('Payment start error:', error);
//       await ctx.reply(`⚠️ Ошибка: ${error.message}`);
//     }
//   });

//   // 6. Подтверждение платежа
//   bot.action(/confirm_pay_(.+)/, async (ctx) => {
//     const txId = ctx.match[1];
//     const userId = ctx.from.id;
    
//     try {
//       const txRef = db.collection('transactions').doc(txId);
//       const userRef = db.collection('usersPay').doc(userId.toString());
//       const subRef = db.collection('subscriptions').doc(userId.toString());

//       await db.runTransaction(async (t) => {
//         const txDoc = await t.get(txRef);
//         if (!txDoc.exists) throw new Error('Транзакция не найдена');
        
//         const txData = txDoc.data();
//         if (txData.status !== 'pending') throw new Error('Неверный статус');

//         const plan = {
//           '1day': { name: "1 день", duration: 86400000 },
//           '1month': { name: "1 месяц", duration: 2592000000 }
//         }[txData.plan];

//         // Списание средств
//         t.update(userRef, {
//           balance: admin.firestore.FieldValue.increment(-txData.amount),
//           reserved: admin.firestore.FieldValue.increment(-txData.amount),
//           lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//         });

//         // Обновление транзакции
//         t.update(txRef, {
//           status: 'completed',
//           completedAt: admin.firestore.FieldValue.serverTimestamp()
//         });

//         // Активация подписки
//         const endDate = new Date(Date.now() + plan.duration);
//         t.set(subRef, {
//           userId,
//           plan: txData.plan,
//           subscriptionType: txData.plan,
//           startDate: admin.firestore.FieldValue.serverTimestamp(),
//           endDate: admin.firestore.Timestamp.fromDate(endDate),
//           status: 'active',
//           isActive: true,
//           lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//         }, { merge: true });

//         // Логирование
//         t.set(db.collection('payments').doc(), {
//           userId,
//           amount: txData.amount,
//           plan: txData.plan,
//           status: 'completed',
//           timestamp: admin.firestore.FieldValue.serverTimestamp()
//         });
//       });

//       await ctx.editMessageText('✅ Подписка успешно активирована!');

//     } catch (error) {
//       console.error('Payment confirm error:', error);
//       await ctx.reply(`⚠️ Ошибка: ${error.message}`);
//     }
//   });

//   // 7. Отмена платежа
//   bot.action(/cancel_pay_(.+)/, async (ctx) => {
//     const txId = ctx.match[1];
//     const userId = ctx.from.id;
    
//     try {
//       await db.runTransaction(async (t) => {
//         const txRef = db.collection('transactions').doc(txId);
//         const txDoc = await t.get(txRef);
        
//         if (txDoc.exists && txDoc.data().status === 'pending') {
//           const amount = txDoc.data().amount;
          
//           t.update(db.collection('usersPay').doc(userId.toString()), {
//             reserved: admin.firestore.FieldValue.increment(-amount),
//             lastUpdated: admin.firestore.FieldValue.serverTimestamp()
//           });
          
//           t.update(txRef, {
//             status: 'cancelled',
//             cancelledAt: admin.firestore.FieldValue.serverTimestamp()
//           });
//         }
//       });
      
//       await ctx.deleteMessage();
//       await ctx.reply('ℹ️ Платеж отменен');

//     } catch (error) {
//       console.error('Payment cancel error:', error);
//       await ctx.reply('⚠️ Ошибка при отмене');
//     }
//   });

//   // 8. Восстановление платежей
//   bot.command('fixpay', async (ctx) => {
//     const userId = ctx.from.id;
    
//     try {
//       const pendingTxs = await db.collection('transactions')
//         .where('userId', '==', userId)
//         .where('status', '==', 'pending')
//         .where('createdAt', '<', new Date(Date.now() - 300000))
//         .get();

//       if (pendingTxs.empty) return ctx.reply('ℹ️ Нет зависших платежей');

//       const batch = db.batch();
//       let restored = 0;

//       pendingTxs.forEach(doc => {
//         const amount = doc.data().amount;
//         restored += amount;
        
//         batch.update(db.collection('usersPay').doc(userId.toString()), {
//           reserved: admin.firestore.FieldValue.increment(-amount)
//         });
        
//         batch.update(doc.ref, {
//           status: 'failed',
//           failedAt: admin.firestore.FieldValue.serverTimestamp()
//         });
//       });

//       await batch.commit();
//       await ctx.reply(`♻️ Восстановлено ${restored}🌟`);

//     } catch (error) {
//       console.error('Fix payments error:', error);
//       await ctx.reply('⚠️ Ошибка восстановления');
//     }
//   });
// };




//payments.js
const admin = require('firebase-admin');

module.exports = (bot, db) => {
  // 1. Инициализация пользователя
  const ensureUser = async (userId) => {
    const userRef = db.collection('usersPay').doc(userId.toString());
    try {
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        await userRef.set({
          balance: 1000,    // Стартовый баланс 1000🌟
          reserved: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[User] Создан пользователь ${userId} с балансом 1000🌟`);
      }
      
      return userRef;
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      throw error;
    }
  };

  // 2. Команда /buy
  bot.command('buy', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const userRef = await ensureUser(userId);
      const userDoc = await userRef.get();
      const balance = userDoc.data().balance || 0;

      // Обновленные тарифы (1 день теперь за 1🌟)
      const plans = [
        { id: '1day', name: "1 день", price: 1, duration: 86400000 }, // Изменено с 300 на 1
        { id: '1month', name: "1 месяц", price: 499, duration: 2592000000 },
        { id: 'forever', name: "Навсегда", price: 1999, duration: null }
      ];

      await ctx.reply(`💰 <b>Ваш баланс: ${balance}🌟</b>\nВыберите подписку:`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: plans.map(p => [
            { 
              text: `${p.name} - ${p.price}🌟`, 
              callback_data: `start_pay_${p.id}`
            }
          ])
        }
      });

    } catch (error) {
      console.error('Buy command error:', error);
      await ctx.reply('⚠️ Ошибка при загрузке меню');
    }
  });

  // 3. Обработка выбора тарифа
  bot.action(/start_pay_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    const planId = ctx.match[1];
    
    try {
      // Обновленные тарифы (1 день за 1🌟)
      const plan = {
        '1day': { price: 1, name: "1 день", duration: 86400000 }, // Изменено с 300 на 1
        '1month': { price: 499, name: "1 месяц", duration: 2592000000 },
        'forever': { price:1999, name: "1 год", duration: null }
      }[planId];

      if (!plan) throw new Error('Неизвестный тариф');

      const userRef = db.collection('usersPay').doc(userId.toString());
      const txRef = db.collection('transactions').doc();

      // Проверка баланса
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};
      const available = (userData.balance || 0) - (userData.reserved || 0);

      if (available < plan.price) {
        throw new Error(`Недостаточно средств. Доступно: ${available}🌟`);
      }

      // Резервирование средств
      await userRef.update({
        reserved: admin.firestore.FieldValue.increment(plan.price),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      // Создание транзакции
      await txRef.set({
        userId,
        amount: plan.price,
        plan: planId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Подтверждение оплаты
      await ctx.editMessageText(
        `Подтвердите покупку:\n\n` +
        `🔹 ${plan.name}\n` +
        `🔹 ${plan.price}🌟\n\n` +
        `Баланс после списания: ${(userData.balance || 0) - plan.price}🌟`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Подтвердить', callback_data: `confirm_pay_${txRef.id}` }],
              [{ text: '❌ Отмена', callback_data: `cancel_pay_${txRef.id}` }]
            ]
          }
        }
      );

    } catch (error) {
      console.error('Payment start error:', error);
      await ctx.reply(`⚠️ Ошибка: ${error.message}`);
    }
  });

  // 4. Подтверждение платежа
  bot.action(/confirm_pay_(.+)/, async (ctx) => {
    const txId = ctx.match[1];
    const userId = ctx.from.id;
    
    try {
      const txRef = db.collection('transactions').doc(txId);
      const userRef = db.collection('usersPay').doc(userId.toString());
      const subRef = db.collection('subscriptions').doc(userId.toString());

      await db.runTransaction(async (t) => {
        const txDoc = await t.get(txRef);
        if (!txDoc.exists) throw new Error('Транзакция не найдена');
        
        const txData = txDoc.data();
        if (txData.status !== 'pending') throw new Error('Неверный статус');

        const plan = {
          '1day': { name: "1 день", duration: 86400000 },
          '1month': { name: "1 месяц", duration: 2592000000 },
          'forever': { name: "Навсегда", duration: null }
        }[txData.plan];

        // Списание средств
        t.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-txData.amount),
          reserved: admin.firestore.FieldValue.increment(-txData.amount),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        // Обновление транзакции
        t.update(txRef, {
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Активация подписки
        const subData = {
          userId,
          plan: txData.plan,
          subscriptionType: txData.plan,
          startDate: admin.firestore.FieldValue.serverTimestamp(),
          status: 'active',
          isActive: true,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        if (plan.duration) {
          subData.endDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + plan.duration));
        }

        t.set(subRef, subData, { merge: true });
      });

      await ctx.editMessageText('✅ Подписка успешно активирована!');

    } catch (error) {
      console.error('Payment confirm error:', error);
      await ctx.reply(`⚠️ Ошибка: ${error.message}`);
    }
  });

  // 5. Отмена платежа
  bot.action(/cancel_pay_(.+)/, async (ctx) => {
    const txId = ctx.match[1];
    const userId = ctx.from.id;
    
    try {
      await db.runTransaction(async (t) => {
        const txRef = db.collection('transactions').doc(txId);
        const txDoc = await t.get(txRef);
        
        if (txDoc.exists && txDoc.data().status === 'pending') {
          const amount = txDoc.data().amount;
          
          t.update(db.collection('usersPay').doc(userId.toString()), {
            reserved: admin.firestore.FieldValue.increment(-amount),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
          
          t.update(txRef, {
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });
      
      await ctx.deleteMessage();
      await ctx.reply('ℹ️ Платеж отменен!');

    } catch (error) {
      console.error('Payment cancel error:', error);
      await ctx.reply('⚠️ Ошибка при отмене');
    }
  });
}; 