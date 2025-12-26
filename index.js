


// if (process.env.NODE_ENV !== 'production') {
//   require('dotenv').config({ path: __dirname + '/.env' });
// }

// // Валидация обязательных переменных окружения
// const requiredEnvVars = [
//   'TELEGRAM_BOT_TOKEN',
//   'ADMIN_ID',
//   'WEBAPP_URL',
//   'FIREBASE_PROJECT_ID'
// ];

// const missingVars = requiredEnvVars.filter(v => !process.env[v]);
// if (missingVars.length > 0) {
//   throw new Error(`Отсутствуют обязательные переменные окружения: ${missingVars.join(', ')}`);
// }

// // Инициализация Firebase
// const firebaseAdmin = require('./telegram-bot/firebase/admin');
// console.log('[Firebase] Инициализирован');

// // Инициализация Telegraf
// const { Telegraf, session } = require('telegraf');
// // const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
// //   telegram: { webhookReply: process.env.NODE_ENV === 'production' }
// // });
// const https = require('https'); // ← ДОБАВЬ ЭТУ СТРОКУ
// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
//   telegram: { 
//     webhookReply: true,
//     agent: require('https').globalAgent
//   }
// });
// bot.telegram.setMyCommands([
//   { command: '/start', description: '🟢 Перезапустить бота' },
//   // { command: '/catalog', description: 'Открыть каталог' },
//   // { command: '/profile', description: 'Моя анкета' }
// ]);
// // Middleware
// bot.use(session());
// bot.use(async (ctx, next) => {
//   try {
//     // Добавляем db в контекст
//     ctx.db = firebaseAdmin.db;
//     ctx.storage = firebaseAdmin.storage;
    
//     // Проверка админа
//     ctx.isAdmin = ctx.from?.id.toString() === process.env.ADMIN_ID;
    
//     // Логирование входящих сообщений
//     console.log(`[Update] ${ctx.updateType} from ${ctx.from?.id || 'unknown'}`);
    
//     await next();
//   } catch (error) {
//     console.error('[Middleware Error]', error);
//     await ctx.reply('⚠️ Произошла внутренняя ошибка').catch(console.error);
//   }
// });

// // Подключение обработчиков
// const loadHandler = (name) => {
//   try {
//     require(`./telegram-bot/bot/handlers/${name}`)(bot, firebaseAdmin.db);
//     console.log(`[Handler] ${name} успешно загружен`);
//   } catch (error) {
//     console.error(`[Handler Error] Ошибка загрузки ${name}:`, error);
//     process.exit(1);
//   }
// };

// [
//   'start',
//   'admin',
//   'payments',
//   'profiles',
//   'webapp'
// ].forEach(loadHandler);

// const startBot = async () => {
//   try {
//     console.log('🚀 ========== RENDER POLLING MODE ==========');
    
//     // 1. УДАЛЯЕМ ВСЕ WEBHOOK (они не работают на Render Free)
//     try {
//       await bot.telegram.deleteWebhook();
//       console.log('✅ Webhooks removed');
//     } catch (e) {
//       console.log('ℹ️ No webhooks to remove');
//     }

//     // 2. ЖДЕМ 3 СЕКУНДЫ
//     await new Promise(resolve => setTimeout(resolve, 3000));

//     // 3. ЗАПУСКАЕМ POLLING (это работает 100%!)
//     await bot.launch({
//       dropPendingUpdates: true,
//       allowedUpdates: ['message', 'callback_query', 'pre_checkout_query'],
//       polling: {
//         timeout: 30,
//         limit: 100,
//         allowedUpdates: ['message', 'callback_query', 'pre_checkout_query']
//       }
//     });

//     console.log('✅ Bot started with POLLING on Render');
//     console.log('✅ Stars payments will work now!');

//     // 4. Health check для Render
//     const express = require('express');
//     const app = express();
//     const PORT = process.env.PORT || 3000;

//     app.get('/health', (req, res) => {
//       res.status(200).json({
//         status: 'OK',
//         mode: 'polling',
//         payments: 'Stars enabled',
//         timestamp: new Date().toISOString()
//       });
//     });

//     app.listen(PORT, '0.0.0.0', () => {
//       console.log(`✅ Health check on port ${PORT}`);
//     });

//   } catch (error) {
//     console.error('[Startup Error] Ошибка запуска бота:', error);
//     process.exit(1);
//   }
// };

// const shutdown = async (signal) => {
//   console.log(`Получен сигнал ${signal}, завершение работы...`);
//   try {
//     await bot.stop();
//     console.log('Бот успешно остановлен');
//   } catch (error) {
//     console.log('Бот уже остановлен или не был запущен:', error.message);
//   }
//   process.exit(0);
// };

// process.once('SIGINT', () => shutdown('SIGINT'));
// process.once('SIGTERM', () => shutdown('SIGTERM'));

// // Запуск приложения
// startBot().catch(console.error);

// module.exports = bot;

// ========== ИСПРАВЛЕННЫЙ INDEX.JS ==========

// 1. ВСЕГДА грузи .env файл если он есть
const fs = require('fs');
const envPath = __dirname + '/.env';
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ .env loaded');
} else {
  console.log('ℹ️ .env file not found, using Render Environment Variables');
}

console.log('🚀 ==== BOT STARTING ON RENDER ====');
console.log('Mode: POLLING (no webhook)');
console.log('URL: https://botznakomstv-m1pe.onrender.com');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('Bot token exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('====================================');

// Валидация обязательных переменных окружения
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'ADMIN_ID',
  'FIREBASE_PROJECT_ID'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  throw new Error(`Отсутствуют обязательные переменные окружения: ${missingVars.join(', ')}`);
}

// Инициализация Firebase
const firebaseAdmin = require('./telegram-bot/firebase/admin');
console.log('[Firebase] Инициализирован');

// Инициализация Telegraf
const { Telegraf, session } = require('telegraf');
const https = require('https');

// 🔥 ИСПРАВЛЕНО: Правильная конфигурация для Render
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: { 
    webhookReply: false, // ← false для polling
    agent: new https.Agent({
      keepAlive: true,
      timeout: 30000
    })
  }
});

bot.telegram.setMyCommands([
  { command: '/start', description: '🟢 Перезапустить бота' },
]);

// Middleware
bot.use(session());
bot.use(async (ctx, next) => {
  try {
    ctx.db = firebaseAdmin.db;
    ctx.storage = firebaseAdmin.storage;
    ctx.isAdmin = ctx.from?.id.toString() === process.env.ADMIN_ID;
    
    console.log(`[Update] ${ctx.updateType} from ${ctx.from?.id || 'unknown'}`);
    
    await next();
  } catch (error) {
    console.error('[Middleware Error]', error);
    await ctx.reply('⚠️ Произошла внутренняя ошибка').catch(console.error);
  }
});

// Подключение обработчиков
const loadHandler = (name) => {
  try {
    require(`./telegram-bot/bot/handlers/${name}`)(bot, firebaseAdmin.db);
    console.log(`[Handler] ${name} успешно загружен`);
  } catch (error) {
    console.error(`[Handler Error] Ошибка загрузки ${name}:`, error);
    process.exit(1);
  }
};

[
  'start',
  'admin',
  'payments',
  'profiles',
  'webapp'
].forEach(loadHandler);

const startBot = async () => {
  try {
    console.log('🚀 ========== RENDER POLLING MODE ==========');
    
    // 1. СНАЧАЛА запускаем Health Check сервер
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.get('/health', (req, res) => {
      console.log('✅ Health check called');
      res.status(200).json({
        status: 'OK',
        bot: 'starting',
        mode: 'polling',
        timestamp: new Date().toISOString()
      });
    });

    app.get('/', (req, res) => {
      res.status(200).json({
        service: 'Telegram Magic Bot',
        status: 'running',
        mode: 'polling',
        payments: 'Stars/USDT/TON'
      });
    });

    // 🔥 ВАЖНО: Запускаем сервер ПЕРВЫМ
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Health check server started on port ${PORT}`);
    });

    // 2. УДАЛЯЕМ ВСЕ WEBHOOK
    console.log('🗑️ Removing any existing webhooks...');
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log('✅ Webhooks removed');
    } catch (e) {
      console.log('ℹ️ No webhooks to remove:', e.message);
    }

    // 3. ЖДЕМ 2 СЕКУНДЫ
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. ЗАПУСКАЕМ POLLING
    console.log('🔄 Starting bot in POLLING mode...');
    await bot.launch({
      dropPendingUpdates: true,
      allowedUpdates: ['message', 'callback_query', 'pre_checkout_query'],
      polling: {
        timeout: 30,
        limit: 100,
        allowedUpdates: ['message', 'callback_query', 'pre_checkout_query']
      }
    });

    console.log('✅ Bot started successfully with POLLING');
    console.log('✅ Ready to accept Stars payments!');

    // 5. Обновляем health check
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        bot: 'running',
        mode: 'polling',
        payments: 'active',
        timestamp: new Date().toISOString()
      });
    });

    // 6. Проверяем что бот онлайн
    setTimeout(async () => {
      try {
        const me = await bot.telegram.getMe();
        console.log(`✅ Bot is online: @${me.username} (${me.id})`);
      } catch (error) {
        console.error('❌ Bot offline check failed:', error.message);
      }
    }, 3000);

  } catch (error) {
    console.error('[Startup Error] Ошибка запуска бота:', error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`Получен сигнал ${signal}, завершение работы...`);
  try {
    await bot.stop();
    console.log('Бот успешно остановлен');
  } catch (error) {
    console.log('Бот уже остановлен или не был запущен:', error.message);
  }
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Запуск приложения
startBot().catch(console.error);

module.exports = bot;