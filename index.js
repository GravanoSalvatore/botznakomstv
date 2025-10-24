
require('dotenv').config({ path: __dirname + '/.env' });

// Валидация обязательных переменных окружения
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'ADMIN_ID',
  'WEBAPP_URL',
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
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: { webhookReply: process.env.NODE_ENV === 'production' }
});
bot.telegram.setMyCommands([
  { command: '/start', description: '🟢 Перезапустить бота' },
  // { command: '/catalog', description: 'Открыть каталог' },
  // { command: '/profile', description: 'Моя анкета' }
]);
// Middleware
bot.use(session());
bot.use(async (ctx, next) => {
  try {
    // Добавляем db в контекст
    ctx.db = firebaseAdmin.db;
    ctx.storage = firebaseAdmin.storage;
    
    // Проверка админа
    ctx.isAdmin = ctx.from?.id.toString() === process.env.ADMIN_ID;
    
    // Логирование входящих сообщений
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

// Запуск бота
// const startBot = async () => {
//   try {
   
// if (process.env.NODE_ENV === 'production') {
//   const express = require('express');
//   const app = express();
//   const PORT = process.env.PORT || 3000;
  
//   app.use(express.json());
  
//   // ✅ Обработка callback_data
//   app.use(bot.webhookCallback('/webhook', {
//     allowedUpdates: ['message', 'callback_query', 'chat_member', 'my_chat_member']
//   }));
  
//   // ✅ Установка вебхука
//   await bot.telegram.setWebhook(`${process.env.WEBAPP_URL}/webhook`, {
//     allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member']
//   });
  
//   // ✅ Health check для Render
//   app.get('/health', (req, res) => {
//     res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
//   });
  
//   // ✅ Корневой endpoint
//   app.get('/', (req, res) => {
//     res.status(200).json({ service: 'Telegram Bot', status: 'running' });
//   });
  
//   // ✅ Явно слушаем порт с указанием хоста
//   app.listen(PORT, '0.0.0.0', () => {
//     console.log(`[Production] Бот запущен на порту ${PORT}`);
//   });
// } else {
//   // Локальная разработка - polling
//   await bot.launch();
//   console.log('[Development] Бот запущен в polling режиме');
// }
//   } catch (error) {
//     console.error('[Startup Error] Ошибка запуска бота:', error);
//     process.exit(1);
//   }
// };

// Запуск бота
const startBot = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const express = require('express');
      const app = express();
      const PORT = process.env.PORT || 3000;
      
      // ✅ Health check ДО вебхука
      app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
      });
      
      app.get('/', (req, res) => {
        res.status(200).json({ service: 'Telegram Bot', status: 'running' });
      });
      
      app.use(express.json());
      
      // ✅ Вебхук с обработкой callback_data
      app.use(bot.webhookCallback('/webhook', {
        allowedUpdates: ['message', 'callback_query', 'chat_member', 'my_chat_member']
      }));
      
      // ✅ Запускаем сервер СРАЗУ
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Production] Express запущен на порту ! ${PORT}`);
      });
      
      // ✅ setWebhook в try-catch чтобы не падало
      try {
        await bot.telegram.setWebhook(`${process.env.WEBAPP_URL}/webhook`, {
          allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member']
        });
        console.log('✅ Webhook установлен');
      } catch (error) {
        console.error('❌ Webhook ошибка:', error);
        // НЕ выходим из процесса - бот все равно работает!
      }
      
    } else {
      // Локальная разработка - polling
      await bot.launch();
      console.log('[Development] Бот запущен в polling режиме');
    }
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