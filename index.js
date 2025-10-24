
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
const startBot = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const express = require('express');
      const app = express();
      const PORT = process.env.PORT || 3000;
      
      app.use(express.json());
      app.use(bot.webhookCallback('/webhook'));
      
      await bot.telegram.setWebhook(`${process.env.WEBAPP_URL}/webhook`);
      
      app.listen(PORT, () => {
        console.log(`[Production] Бот запущен на порту ${PORT}`);
      });
    } else {
      //await bot.launch();
      console.log('[Development] Бот запущен в polling режиме');
    }
  } catch (error) {
    console.error('[Startup Error] Ошибка запуска бота:', error);
    process.exit(1);
  }
};

// Обработка завершения работы
const shutdown = (signal) => {
  console.log(`Получен сигнал ${signal}, завершение работы...`);
  bot.stop()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Запуск приложения
startBot().catch(console.error);

module.exports = bot;