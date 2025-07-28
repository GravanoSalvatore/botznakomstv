const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');
const express = require('express');

// Явный запуск Express на порту 8080
const app = express();
app.use(express.json());

// Принудительная обработка порта для Cloud Run
app.listen(8080, () => console.log('Server ready on port 8080'));

// Инициализация Firebase
admin.initializeApp({
  credential: admin.credential.cert(require('../telegram-bot/firebase/firebase-adminsdk.json')),
  databaseURL: "https://vai-51205.firebaseio.com"
});

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Упрощенная загрузка обработчиков
const loadHandler = (name) => {
  try {
    require(`../telegram-bot/bot/handlers/${name}`)(bot, admin);
    console.log(`✅ ${name} loaded`);
  } catch (e) {
    console.error(`❌ ${name} error:`, e.message);
  }
};

['start', 'profiles', 'payments', 'webapp', 'admin'].forEach(loadHandler);

// Основной обработчик
app.post('/', (req, res) => {
  bot.handleUpdate(req.body, res).catch(e => {
    console.error('Handler error:', e);
    if (!res.headersSent) res.status(200).end();
  });
});

// Проверка здоровья
app.get('/health', (req, res) => res.send('OK'));

// Экспорт без дополнительных настроек
exports.telegramBot = functions.https.onRequest(app);