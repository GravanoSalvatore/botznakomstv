// const RateLimiter = require('telegraf-ratelimit');
// const { default: PQueue } = require('p-queue');

// // Настройка очереди для отправки сообщений
// const messageQueue = new PQueue({
//   concurrency: 5,
//   interval: 1000,
//   intervalCap: 5
// });

// // Время жизни сообщений в хранилище (24 часа)
// const MESSAGE_TTL = 86400000;

// module.exports = (bot, db) => {
//   // Конфигурация
//   const PROFILES_PER_PAGE = 5;
//   const MAX_CAPTION_LENGTH = 900;
//   const CACHE_TTL = 300000;
//   const AGE_RANGES = [
//     { label: '18-25', min: 18, max: 25 },
//     { label: '26-35', min: 26, max: 35 },
//     { label: '36-45', min: 36, max: 45 },
//     { label: '46+', min: 46, max: 999 }
//   ];

//   // Инициализация rate-limiter
//   const limiter = new RateLimiter({
//     window: 1000,
//     limit: 3,
//     onLimitExceeded: (ctx) => ctx.reply('⚠️ Слишком много запросов, подождите секунду...')
//   });

//   bot.use(limiter);

//   // Система хранения сообщений
//   const chatStorage = {
//     messages: new Map(),     // chatId: Set(messageIds)
//     mainMenu: new Map(),     // chatId: messageId
//     userState: new Map(),    // userId: state
//     messageTimestamps: new Map() // messageId: timestamp
//   };

//   // Очистка старых сообщений каждые 6 часов
//   setInterval(() => {
//     const now = Date.now();
//     for (const [chatId, messages] of chatStorage.messages) {
//       for (const messageId of messages) {
//         if (now - (chatStorage.messageTimestamps.get(messageId) || 0) > MESSAGE_TTL) {
//           messages.delete(messageId);
//           chatStorage.messageTimestamps.delete(messageId);
//         }
//       }
//     }
//   }, 21600000);

//   // Кэш данных
//   const profilesCache = {
//     data: null,
//     timestamp: 0,
//     countryFilter: null,
//     ageFilter: null,
//     clear: function() {
//       this.data = null;
//       this.timestamp = 0;
//       this.countryFilter = null;
//       this.ageFilter = null;
//     }
//   };

//   // Получение анкет
//   const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null) => {
//     try {
//       const now = Date.now();
//       const cacheKey = `${searchCountry || 'all'}_${ageRange ? ageRange.label : 'all'}`;

//       if (profilesCache.data &&
//           now - profilesCache.timestamp < CACHE_TTL &&
//           profilesCache.countryFilter === (searchCountry || null) &&
//           profilesCache.ageFilter === (ageRange ? ageRange.label : null)) {
//         return profilesCache.data.slice(page * PROFILES_PER_PAGE, (page + 1) * PROFILES_PER_PAGE);
//       }

//       const snapshot = await db.collection('profiles')
//         .orderBy('createdAt', 'desc')
//         .get();

//       let profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

//       if (searchCountry) {
//         const searchTerm = searchCountry.toLowerCase().trim();
//         profiles = profiles.filter(profile => {
//           const profileCountry = profile.country?.toLowerCase() || '';
//           return profileCountry.includes(searchTerm) ||
//                  (searchTerm === 'рос' && profileCountry.includes('россия'));
//         });
//       }

//       if (ageRange) {
//         profiles = profiles.filter(profile => {
//           const age = parseInt(profile.age) || 0;
//           return age >= ageRange.min && age <= ageRange.max;
//         });
//       }

//       profilesCache.data = profiles;
//       profilesCache.timestamp = now;
//       profilesCache.countryFilter = searchCountry || null;
//       profilesCache.ageFilter = ageRange ? ageRange.label : null;

//       return profiles.slice(page * PROFILES_PER_PAGE, (page + 1) * PROFILES_PER_PAGE);
//     } catch (error) {
//       console.error('Ошибка загрузки анкет:', error);
//       profilesCache.clear();
//       return [];
//     }
//   };

//   // Система управления сообщениями
//   const messageManager = {
//     track: function(chatId, messageId) {
//       if (!messageId) return;
//       if (!chatStorage.messages.has(chatId)) {
//         chatStorage.messages.set(chatId, new Set());
//       }
//       chatStorage.messages.get(chatId).add(messageId);
//       chatStorage.messageTimestamps.set(messageId, Date.now());
//     },

//     clear: async function(ctx) {
//       const chatId = ctx.chat.id;
//       if (!chatStorage.messages.has(chatId)) return;

//       const messages = [...chatStorage.messages.get(chatId)];
//       const mainMenuId = chatStorage.mainMenu.get(chatId);

//       for (const messageId of messages) {
//         if (messageId !== mainMenuId) {
//           try {
//             await ctx.telegram.deleteMessage(chatId, messageId);
//             chatStorage.messages.get(chatId).delete(messageId);
//             chatStorage.messageTimestamps.delete(messageId);
//           } catch (e) {
//             if (e.response?.error_code !== 400) { // Игнорируем только "message not found"
//               console.error(`Ошибка удаления ${messageId}:`, e.message);
//             }
//           }
//         }
//       }

//       chatStorage.userState.delete(ctx.from.id);
//     },

//     sendMainMenu: async function(ctx) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старое меню если есть
//           if (chatStorage.mainMenu.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(chatId, chatStorage.mainMenu.get(chatId));
//               chatStorage.messages.get(chatId)?.delete(chatStorage.mainMenu.get(chatId));
//               chatStorage.messageTimestamps.delete(chatStorage.mainMenu.get(chatId));
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error('Ошибка удаления меню:', e);
//               }
//             }
//           }

//           const menu = await ctx.reply('Главное меню:', {
//             reply_markup: {
//               inline_keyboard: [
//                 [{ text: '👩 Показать анкеты', callback_data: 'show_profiles' }],
//                 [{ text: '🔍 Поиск по стране', callback_data: 'search_by_country' }],
//                 [{ text: '🎂 Фильтр по возрасту', callback_data: 'filter_by_age' }],
//                 [{ text: '❌ Очистить экран', callback_data: 'clear_screen' }]
//               ]
//             }
//           });

//           chatStorage.mainMenu.set(chatId, menu.message_id);
//           self.track(chatId, menu.message_id);
//         } catch (error) {
//           console.error('Ошибка отправки меню:', error);
//           throw error;
//         }
//       });
//     }
//   };

//   // Обработчики команд
//   bot.command('start', async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error('Ошибка команды start:', error);
//       }
//     });
//   });

//   // Показать анкеты
//   bot.action('show_profiles', async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = null;
//         ctx.session.displayCountry = null; // Добавлено: сбрасываем отображаемую страну
//         ctx.session.ageRange = null;

//         await messageManager.clear(ctx);
//         const profiles = await getProfilesPage(0);

//         if (!profiles.length) {
//           const msg = await ctx.reply('Анкет нет, попробуйте позже');
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         await Promise.all(
//           profiles.map((profile, index) =>
//             sendProfile(ctx, profile, 0, profiles.length, index === profiles.length - 1)
//           )
//         );

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error('Ошибка показа анкет:', error);
//         const msg = await ctx.reply('Ошибка загрузки анкет');
//         messageManager.track(ctx.chat.id, msg.message_id);
//       }
//     });
//   });

//   // Поиск по стране
//   bot.action('search_by_country', async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         chatStorage.userState.set(ctx.from.id, 'awaiting_country');
//         const msg = await ctx.reply('Введите страну для поиска:');
//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error('Ошибка поиска:', error);
//       }
//     });
//   });

//   // Фильтр по возрасту
//   bot.action('filter_by_age', async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);

//         const keyboard = AGE_RANGES.map(range =>
//           [{ text: range.label, callback_data: `age_range_${range.label}` }]
//         );
//         keyboard.push([{ text: '❌ Сбросить фильтр', callback_data: 'age_range_reset' }]);

//         const msg = await ctx.reply('Выберите возрастной диапазон:', {
//           reply_markup: { inline_keyboard: keyboard }
//         });

//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error('Ошибка фильтра по возрасту:', error);
//       }
//     });
//   });

//   // Обработчик выбора возрастного диапазона
//   bot.action(/^age_range_(.+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const [_, range] = ctx.match;

//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;

//         if (range === 'reset') {
//           ctx.session.ageRange = null;
//         } else {
//           const selectedRange = AGE_RANGES.find(r => r.label === range);
//           if (selectedRange) {
//             ctx.session.ageRange = selectedRange;
//           }
//         }

//         await messageManager.clear(ctx);
//         const profiles = await getProfilesPage(0, ctx.session.filterCountry, ctx.session.ageRange);

//         if (!profiles.length) {
//           const msg = await ctx.reply('Анкет нет, попробуйте изменить фильтры');
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         await Promise.all(
//           profiles.map((profile, index) =>
//             sendProfile(ctx, profile, 0, profiles.length, index === profiles.length - 1)
//           )
//         );

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error('Ошибка обработки возрастного диапазона:', error);
//       }
//     });
//   });

//   // Обработчик ввода страны
//   bot.on('text', async (ctx) => {
//     const userId = ctx.from.id;
//     if (chatStorage.userState.get(userId) === 'awaiting_country') {
//       await messageQueue.add(async () => {
//         try {
//           messageManager.track(ctx.chat.id, ctx.message.message_id);
//           const countryInput = ctx.message.text.trim();

//           if (!countryInput) {
//             const msg = await ctx.reply('Вы не указали страну');
//             messageManager.track(ctx.chat.id, msg.message_id);
//             return;
//           }

//           await messageManager.clear(ctx);
//           ctx.session = ctx.session || {};
//           ctx.session.profilesPage = 0;

//           // Получаем профили для поиска
//           const profiles = await getProfilesPage(0, countryInput, ctx.session.ageRange);

//           // Определяем нормализованное название страны из первого найденного профиля
//           let normalizedCountry = null;
//           if (profiles.length > 0) {
//             normalizedCountry = profiles[0].country;
//           } else if (countryInput.toLowerCase() === 'рос') {
//             normalizedCountry = 'Россия';
//           } else {
//             normalizedCountry = countryInput;
//           }

//           // Сохраняем оригинальный ввод для поиска и нормализованное название для отображения
//           ctx.session.filterCountry = countryInput;
//           ctx.session.displayCountry = normalizedCountry;

//           if (profiles.length) {
//             await Promise.all(
//               profiles.map((profile, index) =>
//                 sendProfile(ctx, profile, 0, profiles.length, index === profiles.length - 1)
//               )
//             );
//           } else {
//             const msg = await ctx.reply(`Анкет из "${normalizedCountry}" не найдено`);
//             messageManager.track(ctx.chat.id, msg.message_id);
//           }

//           await messageManager.sendMainMenu(ctx);
//         } catch (error) {
//           console.error('Ошибка обработки страны:', error);
//         }
//       });
//     }
//   });

//   // Пагинация
//   bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const [_, action, currentPage] = ctx.match;
//         let newPage = parseInt(currentPage);

//         if (action === 'first') newPage = 0;
//         else if (action === 'prev') newPage = Math.max(0, newPage - 1);
//         else if (action === 'next') newPage = newPage + 1;
//         else if (action === 'last') newPage = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE) - 1;
//         else newPage = parseInt(action); // для прямого перехода по номеру страницы

//         await messageManager.clear(ctx);
//         ctx.session = ctx.session || {};

//         const profiles = await getProfilesPage(
//           newPage,
//           ctx.session.filterCountry,
//           ctx.session.ageRange
//         );

//         if (profiles.length) {
//           ctx.session.profilesPage = newPage;

//           await Promise.all(
//             profiles.map((profile, index) =>
//               sendProfile(ctx, profile, newPage, profiles.length, index === profiles.length - 1)
//             )
//           );
//         } else {
//           const msg = await ctx.reply('Больше анкет нет');
//           messageManager.track(ctx.chat.id, msg.message_id);
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error('Ошибка пагинации:', error);
//       }
//     });
//   });

//   // Очистка экрана
//   bot.action('clear_screen', async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await ctx.answerCbQuery('Экран очищен');
//       } catch (error) {
//         console.error('Ошибка очистки:', error);
//         await ctx.answerCbQuery('Ошибка при очистке');
//       }
//     });
//   });

//   // Функция отправки анкеты
//   const sendProfile = async (ctx, profile, page, total, isLast) => {
//     return messageQueue.add(async () => {
//       try {
//         const about = profile.about?.length > MAX_CAPTION_LENGTH
//           ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + '...'
//           : profile.about || '';

//         const formatTelegram = (username) => {
//           if (!username) return '';
//           const cleaned = decodeURIComponent(username)
//             .replace(/%2b/gi, '+')
//             .replace(/^(@?)(\+)/, '$1$2');
//           return cleaned ? `💬 <a href="https://t.me/${cleaned.replace(/^@/, '')}">${cleaned}</a>\n\n` : '';
//         };

//         const formatPhone = (phone) => {
//           if (!phone) return '';
//           const cleanPhone = phone.replace(/[^0-9+]/g, '');
//           return `📞 <a href="tel:${cleanPhone}">${phone}</a>\n\n`;
//         };
// // <i>${about}</i>
//         const caption = `
// 👤 <b>${profile.name}</b>, ${profile.age}\n\n
// 📍 ${profile.country}\n\n
// ${profile.phone ? formatPhone(profile.phone) : ''}
// ${profile.telegram ? formatTelegram(profile.telegram) : ''}
//         `.trim();

//         // Формируем клавиатуру с пагинацией и фильтрами
//         let keyboard = [];

//         if (isLast) {
//           const totalPages = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE);

//           // Строка пагинации
//           const paginationRow = [];

//           // Кнопка "В начало" если не на первой странице
//           if (page > 0) {
//             paginationRow.push({ text: '⏪', callback_data: `page_first_${page}` });
//           }

//           // Кнопка "Назад" если не на первой странице
//           if (page > 0) {
//             paginationRow.push({ text: '◀️', callback_data: `page_prev_${page}` });
//           }

//           // Номер текущей страницы
//           paginationRow.push({
//             text: `${page + 1}/${totalPages}`,
//             callback_data: 'page_info'
//           });

//           // Кнопка "Вперед" если не на последней странице
//           if (page < totalPages - 1) {
//             paginationRow.push({ text: '▶️', callback_data: `page_next_${page}` });
//           }

//           // Кнопка "В конец" если не на последней странице
//           if (page < totalPages - 1) {
//             paginationRow.push({ text: '⏩', callback_data: `page_last_${page}` });
//           }

//           // Быстрые переходы по страницам (показываем только если больше 3 страниц)
//           if (totalPages > 3) {
//             const quickPagesRow = [];
//             const maxQuickPages = Math.min(5, totalPages);
//             const startPage = Math.max(0, Math.min(
//               page - Math.floor(maxQuickPages / 2),
//               totalPages - maxQuickPages
//             ));

//             for (let i = 0; i < maxQuickPages; i++) {
//               const p = startPage + i;
//               if (p >= 0 && p < totalPages) {
//                 quickPagesRow.push({
//                   text: p === page ? `• ${p + 1} •` : `${p + 1}`,
//                   callback_data: `page_${p}_${page}`
//                 });
//               }
//             }

//             keyboard.push(quickPagesRow);
//           }

//           // Строка с фильтрами
//           const filtersRow = [];
//           if (ctx.session?.displayCountry || ctx.session?.ageRange?.label) {
//             let filtersText = '🔹 ';
//             if (ctx.session.displayCountry) {
//               filtersText += `Страна: ${ctx.session.displayCountry}`;
//             }
//             if (ctx.session.ageRange?.label) {
//               if (ctx.session.displayCountry) filtersText += ', ';
//               filtersText += `Возраст: ${ctx.session.ageRange.label}`;
//             }
//             filtersRow.push({ text: filtersText, callback_data: 'filters_info' });
//           }

//           keyboard = filtersRow.length > 0
//             ? [paginationRow, ...keyboard, filtersRow]
//             : [paginationRow, ...keyboard];
//         }

//         try {
//           const msg = await ctx.replyWithPhoto(profile.photoUrl, {
//             caption,
//             parse_mode: 'HTML',
//             reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         } catch (e) {
//           const msg = await ctx.reply(caption, {
//             parse_mode: 'HTML',
//             reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         }
//       } catch (error) {
//         console.error('Ошибка отправки анкеты:', error);
//         return null;
//       }
//     });
//   };
// };
// const RateLimiter = require("telegraf-ratelimit");
// const { default: PQueue } = require("p-queue");

// // Настройка очереди для отправки сообщений
// const messageQueue = new PQueue({
//   concurrency: 5,
//   interval: 1000,
//   intervalCap: 5,
// });

// // Время жизни сообщений в хранилище (24 часа)
// const MESSAGE_TTL = 86400000;

// module.exports = (bot, db) => {
//   // Конфигурация
//   const PROFILES_PER_PAGE = 5;
//   const MAX_CAPTION_LENGTH = 900;
//   const CACHE_TTL = 300000;
//   const AGE_RANGES = [
//     { label: "18-25", min: 18, max: 25 },
//     { label: "26-35", min: 26, max: 35 },
//     { label: "36-45", min: 36, max: 45 },
//     { label: "46+", min: 46, max: 999 },
//   ];

//   // Список популярных стран с эмодзи флагами
//   const POPULAR_COUNTRIES = [
//     { name: "Россия", flag: "🇷🇺" },
//     { name: "Украина", flag: "🇺🇦" },
//     { name: "Беларусь", flag: "🇧🇾" },
//     { name: "Казахстан", flag: "🇰🇿" },
//     { name: "США", flag: "🇺🇸" },
//     { name: "Германия", flag: "🇩🇪" },
//     { name: "Франция", flag: "🇫🇷" },
//     { name: "Италия", flag: "🇮🇹" },
//     { name: "Испания", flag: "🇪🇸" },
//     { name: "Турция", flag: "🇹🇷" },
//     { name: "Китай", flag: "🇨🇳" },
//     { name: "Япония", flag: "🇯🇵" },
//     { name: "Великобритания", flag: "🇬🇧" },
//     { name: "Польша", flag: "🇵🇱" },
//     { name: "Израиль", flag: "🇮🇱" },
//     { name: "ОАЭ", flag: "🇦🇪" },
//     { name: "Таиланд", flag: "🇹🇭" },
//     { name: "Индия", flag: "🇮🇳" },
//     { name: "Бразилия", flag: "🇧🇷" },
//     { name: "Канада", flag: "🇨🇦" },
//     // Дополнительные страны
//     { name: "Австралия", flag: "🇦🇺" },
//     { name: "Новая Зеландия", flag: "🇳🇿" },
//     { name: "Мексика", flag: "🇲🇽" },
//     { name: "Аргентина", flag: "🇦🇷" },
//     { name: "Чили", flag: "🇨🇱" },
//     { name: "Колумбия", flag: "🇨🇴" },
//     { name: "Перу", flag: "🇵🇪" },
//     { name: "Венесуэла", flag: "🇻🇪" },
//     { name: "Куба", flag: "🇨🇺" },
//     { name: "Южная Корея", flag: "🇰🇷" },
//     { name: "Индонезия", flag: "🇮🇩" },
//     { name: "Вьетнам", flag: "🇻🇳" },
//     { name: "Малайзия", flag: "🇲🇾" },
//     { name: "Филиппины", flag: "🇵🇭" },
//     { name: "Сингапур", flag: "🇸🇬" },
//     { name: "Саудовская Аравия", flag: "🇸🇦" },
//     { name: "Катар", flag: "🇶🇦" },
//     { name: "Кувейт", flag: "🇰🇼" },
//     { name: "Иран", flag: "🇮🇷" },
//     { name: "Ирак", flag: "🇮🇶" },
//     { name: "Азербайджан", flag: "🇦🇿" },
//     { name: "Армения", flag: "🇦🇲" },
//     { name: "Грузия", flag: "🇬🇪" },
//     { name: "Молдова", flag: "🇲🇩" },
//     { name: "Латвия", flag: "🇱🇻" },
//     { name: "Литва", flag: "🇱🇹" },
//     { name: "Эстония", flag: "🇪🇪" },
//     { name: "Финляндия", flag: "🇫🇮" },
//     { name: "Швеция", flag: "🇸🇪" },
//     { name: "Норвегия", flag: "🇳🇴" },
//     { name: "Дания", flag: "🇩🇰" },
//     { name: "Нидерланды", flag: "🇳🇱" },
//     { name: "Бельгия", flag: "🇧🇪" },
//     { name: "Швейцария", flag: "🇨🇭" },
//     { name: "Австрия", flag: "🇦🇹" },
//     { name: "Чехия", flag: "🇨🇿" },
//     { name: "Словакия", flag: "🇸🇰" },
//     { name: "Венгрия", flag: "🇭🇺" },
//     { name: "Румыния", flag: "🇷🇴" },
//     { name: "Болгария", flag: "🇧🇬" },
//     { name: "Сербия", flag: "🇷🇸" },
//     { name: "Хорватия", flag: "🇭🇷" },
//     { name: "Греция", flag: "🇬🇷" },
//     { name: "Португалия", flag: "🇵🇹" },
//     { name: "Ирландия", flag: "🇮🇪" },
//     { name: "Исландия", flag: "🇮🇸" },
//     { name: "Мальта", flag: "🇲🇹" },
//     { name: "Кипр", flag: "🇨🇾" },
//     { name: "Люксембург", flag: "🇱🇺" },
//     { name: "Афганистан", flag: "🇦🇫" },
//     { name: "Пакистан", flag: "🇵🇰" },
//     { name: "Бангладеш", flag: "🇧🇩" },
//     { name: "Шри-Ланка", flag: "🇱🇰" },
//     { name: "Непал", flag: "🇳🇵" },
//   ];

//   // Инициализация rate-limiter
//   const limiter = new RateLimiter({
//     window: 1000,
//     limit: 3,
//     onLimitExceeded: (ctx) =>
//       ctx.reply("⚠️ Слишком много запросов, подождите секунду..."),
//   });

//   bot.use(limiter);

//   // Система хранения сообщений
//   const chatStorage = {
//     messages: new Map(), // chatId: Set(messageIds)
//     mainMenu: new Map(), // chatId: messageId
//     userState: new Map(), // userId: state
//     messageTimestamps: new Map(), // messageId: timestamp
//     countryKeyboard: new Map(), // chatId: messageId (для хранения сообщения с клавиатурой стран)
//   };

//   // Очистка старых сообщений каждые 6 часов
//   setInterval(() => {
//     const now = Date.now();
//     for (const [chatId, messages] of chatStorage.messages) {
//       for (const messageId of messages) {
//         if (
//           now - (chatStorage.messageTimestamps.get(messageId) || 0) >
//           MESSAGE_TTL
//         ) {
//           messages.delete(messageId);
//           chatStorage.messageTimestamps.delete(messageId);
//         }
//       }
//     }
//   }, 21600000);

//   // Кэш данных
//   const profilesCache = {
//     data: null,
//     timestamp: 0,
//     countryFilter: null,
//     ageFilter: null,
//     clear: function () {
//       this.data = null;
//       this.timestamp = 0;
//       this.countryFilter = null;
//       this.ageFilter = null;
//     },
//   };

//   // Получение анкет
//   const getProfilesPage = async (
//     page = 0,
//     searchCountry = null,
//     ageRange = null
//   ) => {
//     try {
//       const now = Date.now();
//       const cacheKey = `${searchCountry || "all"}_${
//         ageRange ? ageRange.label : "all"
//       }`;

//       if (
//         profilesCache.data &&
//         now - profilesCache.timestamp < CACHE_TTL &&
//         profilesCache.countryFilter === (searchCountry || null) &&
//         profilesCache.ageFilter === (ageRange ? ageRange.label : null)
//       ) {
//         return profilesCache.data.slice(
//           page * PROFILES_PER_PAGE,
//           (page + 1) * PROFILES_PER_PAGE
//         );
//       }

//       const snapshot = await db
//         .collection("profiles")
//         .orderBy("createdAt", "desc")
//         .get();

//       let profiles = snapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));

//       if (searchCountry) {
//         const searchTerm = searchCountry.toLowerCase().trim();
//         profiles = profiles.filter((profile) => {
//           const profileCountry = profile.country?.toLowerCase() || "";
//           return (
//             profileCountry.includes(searchTerm) ||
//             (searchTerm === "рос" && profileCountry.includes("россия"))
//           );
//         });
//       }

//       if (ageRange) {
//         profiles = profiles.filter((profile) => {
//           const age = parseInt(profile.age) || 0;
//           return age >= ageRange.min && age <= ageRange.max;
//         });
//       }

//       profilesCache.data = profiles;
//       profilesCache.timestamp = now;
//       profilesCache.countryFilter = searchCountry || null;
//       profilesCache.ageFilter = ageRange ? ageRange.label : null;

//       return profiles.slice(
//         page * PROFILES_PER_PAGE,
//         (page + 1) * PROFILES_PER_PAGE
//       );
//     } catch (error) {
//       console.error("Ошибка загрузки анкет:", error);
//       profilesCache.clear();
//       return [];
//     }
//   };

//   // Получение списка уникальных стран из базы данных
//   const getUniqueCountries = async () => {
//     try {
//       const snapshot = await db.collection("profiles").orderBy("country").get();

//       const countries = new Set();
//       snapshot.docs.forEach((doc) => {
//         const country = doc.data().country;
//         if (country) countries.add(country);
//       });

//       return Array.from(countries).sort();
//     } catch (error) {
//       console.error("Ошибка получения списка стран:", error);
//       return [];
//     }
//   };

//   // Форматирование названия страны с добавлением флага (если есть в списке популярных)
//   const formatCountryWithFlag = (countryName) => {
//     if (!countryName) return countryName;

//     const foundCountry = POPULAR_COUNTRIES.find(
//       (c) => c.name.toLowerCase() === countryName.toLowerCase()
//     );

//     return foundCountry ? `${foundCountry.flag} ${countryName}` : countryName;
//   };

//   // Система управления сообщениями
//   const messageManager = {
//     track: function (chatId, messageId) {
//       if (!messageId) return;
//       if (!chatStorage.messages.has(chatId)) {
//         chatStorage.messages.set(chatId, new Set());
//       }
//       chatStorage.messages.get(chatId).add(messageId);
//       chatStorage.messageTimestamps.set(messageId, Date.now());
//     },

//     clear: async function (ctx) {
//       const chatId = ctx.chat.id;
//       if (!chatStorage.messages.has(chatId)) return;

//       const messages = [...chatStorage.messages.get(chatId)];
//       const mainMenuId = chatStorage.mainMenu.get(chatId);
//       const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);

//       for (const messageId of messages) {
//         if (messageId !== mainMenuId && messageId !== countryKeyboardId) {
//           try {
//             await ctx.telegram.deleteMessage(chatId, messageId);
//             chatStorage.messages.get(chatId).delete(messageId);
//             chatStorage.messageTimestamps.delete(messageId);
//           } catch (e) {
//             if (e.response?.error_code !== 400) {
//               // Игнорируем только "message not found"
//               console.error(`Ошибка удаления ${messageId}:`, e.message);
//             }
//           }
//         }
//       }

//       // Удаляем клавиатуру стран если есть
//       if (countryKeyboardId) {
//         try {
//           await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
//           chatStorage.messages.get(chatId).delete(countryKeyboardId);
//           chatStorage.messageTimestamps.delete(countryKeyboardId);
//           chatStorage.countryKeyboard.delete(chatId);
//         } catch (e) {
//           if (e.response?.error_code !== 400) {
//             console.error("Ошибка удаления клавиатуры стран:", e);
//           }
//         }
//       }

//       chatStorage.userState.delete(ctx.from.id);
//     },

//     sendMainMenu: async function (ctx) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старое меню если есть
//           if (chatStorage.mainMenu.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(
//                 chatId,
//                 chatStorage.mainMenu.get(chatId)
//               );
//               chatStorage.messages
//                 .get(chatId)
//                 ?.delete(chatStorage.mainMenu.get(chatId));
//               chatStorage.messageTimestamps.delete(
//                 chatStorage.mainMenu.get(chatId)
//               );
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error("Ошибка удаления меню:", e);
//               }
//             }
//           }

//           const menu = await ctx.reply("Главное меню:", {
//             reply_markup: {
//               inline_keyboard: [
//                 // [{ text: '👩 Показать анкеты', callback_data: 'show_profiles' }],
//                 [{
//     text: '🌐 Открыть  PeaceYourGun 🥕 в WebApp',
//     web_app: { url: process.env.WEBAPP_URL }
// }],
//                 [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//                 // [{ text: '🔍 Поиск по стране', callback_data: 'search_by_country' }],
//                 [
//                   {
//                     text: "🎂 Фильтр по возрасту",
//                     callback_data: "filter_by_age",
//                   },
//                 ],
//                 [{ text: "❌ Очистить экран", callback_data: "clear_screen" }],
//               ],
//             },
//           });

//           chatStorage.mainMenu.set(chatId, menu.message_id);
//           self.track(chatId, menu.message_id);
//         } catch (error) {
//           console.error("Ошибка отправки меню:", error);
//           throw error;
//         }
//       });
//     },

//     // Отправка клавиатуры со списком стран
//     sendCountriesKeyboard: async function (ctx) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старую клавиатуру стран если есть
//           if (chatStorage.countryKeyboard.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(
//                 chatId,
//                 chatStorage.countryKeyboard.get(chatId)
//               );
//               chatStorage.messages
//                 .get(chatId)
//                 ?.delete(chatStorage.countryKeyboard.get(chatId));
//               chatStorage.messageTimestamps.delete(
//                 chatStorage.countryKeyboard.get(chatId)
//               );
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error("Ошибка удаления клавиатуры стран:", e);
//               }
//             }
//           }

//           // Получаем список уникальных стран из базы
//           const uniqueCountries = await getUniqueCountries();

//           // Если стран нет или слишком много, показываем только популярные
//           const countriesToShow =
//             uniqueCountries.length > 0 && uniqueCountries.length <= 50
//               ? uniqueCountries
//               : POPULAR_COUNTRIES.map((c) => c.name);

//           // Формируем клавиатуру
//           const keyboard = [];
//           let row = [];

//           // Добавляем страны с флагами
//           countriesToShow.forEach((country, index) => {
//             const countryWithFlag = formatCountryWithFlag(country);
//             row.push({
//               text: countryWithFlag,
//               callback_data: `country_${country}`,
//             });

//             // Разбиваем на строки по 3 кнопки
//             if (row.length === 3 || index === countriesToShow.length - 1) {
//               keyboard.push(row);
//               row = [];
//             }
//           });

//           // Добавляем кнопку "Назад"
//           keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

//           const msg = await ctx.reply("Выберите страну:", {
//             reply_markup: { inline_keyboard: keyboard },
//           });

//           chatStorage.countryKeyboard.set(chatId, msg.message_id);
//           self.track(chatId, msg.message_id);
//         } catch (error) {
//           console.error("Ошибка отправки клавиатуры стран:", error);
//           throw error;
//         }
//       });
//     },
//   };

//   // Обработчики команд
//   bot.command("start", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка команды start:", error);
//       }
//     });
//   });
//   bot.action("show_profiles", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         // Подтверждаем нажатие кнопки
//         await ctx.answerCbQuery("Загружаем анкеты...");

//         // Инициализация сессии
//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = null;
//         ctx.session.displayCountry = null;
//         ctx.session.ageRange = null;

//         // Логирование для диагностики
//         console.log("Starting profiles load", {
//           cache: profilesCache.data ? "exists" : "empty",
//           cacheAge: Date.now() - profilesCache.timestamp,
//         });

//         // Очистка предыдущих сообщений
//         await messageManager.clear(ctx);

//         // Загрузка профилей с принудительным обновлением кэша при необходимости
//         if (
//           !profilesCache.data ||
//           Date.now() - profilesCache.timestamp > CACHE_TTL
//         ) {
//           profilesCache.clear();
//         }
//         const profiles = await getProfilesPage(0);

//         if (!profiles.length) {
//           const msg = await ctx.reply("Анкет нет, попробуйте позже");
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         // Отправка профилей с задержкой между сообщениями
//         for (let i = 0; i < profiles.length; i++) {
//           await sendProfile(
//             ctx,
//             profiles[i],
//             0,
//             profiles.length,
//             i === profiles.length - 1
//           );
//           if (i < profiles.length - 1)
//             await new Promise((resolve) => setTimeout(resolve, 300));
//         }

//         // Отправка главного меню
//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка показа анкет:", error);
//         try {
//           await ctx.answerCbQuery("Ошибка загрузки");
//           const msg = await ctx.reply(
//             "Ошибка загрузки анкет, попробуйте ещё раз"
//           );
//           messageManager.track(ctx.chat.id, msg.message_id);
//         } catch (e) {
//           console.error("Дополнительная ошибка:", e);
//         }
//       }
//     });
//   });
//    bot.action("all_countries", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendCountriesKeyboard(ctx);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка обработки списка стран:", error);
//       }
//     });
//   });

//   // Обработчик выбора страны из списка
//   bot.action(/^country_(.+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const country = ctx.match[1];
//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = country;
//         ctx.session.displayCountry = country; // Используем оригинальное название для отображения

//         await messageManager.clear(ctx);
//         const profiles = await getProfilesPage(
//           0,
//           country,
//           ctx.session.ageRange
//         );

//         if (!profiles.length) {
//           const msg = await ctx.reply(`Анкет из "${country}" не найдено`);
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         await Promise.all(
//           profiles.map((profile, index) =>
//             sendProfile(
//               ctx,
//               profile,
//               0,
//               profiles.length,
//               index === profiles.length - 1
//             )
//           )
//         );

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка обработки выбора страны:", error);
//       }
//     });
//   });

//   // Обработчик кнопки "Назад" из клавиатуры стран
//   bot.action("back_to_menu", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка возврата в меню:", error);
//       }
//     });
//   });

//   // Поиск по стране через ввод текста
//   bot.action("search_by_country", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         chatStorage.userState.set(ctx.from.id, "awaiting_country");
//         const msg = await ctx.reply("Введите страну для поиска:");
//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка поиска:", error);
//       }
//     });
//   });

//   // Фильтр по возрасту
//   bot.action("filter_by_age", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);

//         const keyboard = AGE_RANGES.map((range) => [
//           { text: range.label, callback_data: `age_range_${range.label}` },
//         ]);
//         keyboard.push([
//           { text: "❌ Сбросить фильтр", callback_data: "age_range_reset" },
//         ]);

//         const msg = await ctx.reply("Выберите возрастной диапазон:", {
//           reply_markup: { inline_keyboard: keyboard },
//         });

//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка фильтра по возрасту:", error);
//       }
//     });
//   });

//   // Обработчик выбора возрастного диапазона
//   bot.action(/^age_range_(.+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const [_, range] = ctx.match;

//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;

//         if (range === "reset") {
//           ctx.session.ageRange = null;
//         } else {
//           const selectedRange = AGE_RANGES.find((r) => r.label === range);
//           if (selectedRange) {
//             ctx.session.ageRange = selectedRange;
//           }
//         }

//         await messageManager.clear(ctx);
//         const profiles = await getProfilesPage(
//           0,
//           ctx.session.filterCountry,
//           ctx.session.ageRange
//         );

//         if (!profiles.length) {
//           const msg = await ctx.reply("Анкет нет, попробуйте изменить фильтры");
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         await Promise.all(
//           profiles.map((profile, index) =>
//             sendProfile(
//               ctx,
//               profile,
//               0,
//               profiles.length,
//               index === profiles.length - 1
//             )
//           )
//         );

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка обработки возрастного диапазона:", error);
//       }
//     });
//   });

//   // Обработчик ввода страны
//   bot.on("text", async (ctx) => {
//     const userId = ctx.from.id;
//     if (chatStorage.userState.get(userId) === "awaiting_country") {
//       await messageQueue.add(async () => {
//         try {
//           messageManager.track(ctx.chat.id, ctx.message.message_id);
//           const countryInput = ctx.message.text.trim();

//           if (!countryInput) {
//             const msg = await ctx.reply("Вы не указали страну");
//             messageManager.track(ctx.chat.id, msg.message_id);
//             return;
//           }

//           await messageManager.clear(ctx);
//           ctx.session = ctx.session || {};
//           ctx.session.profilesPage = 0;

//           // Получаем профили для поиска
//           const profiles = await getProfilesPage(
//             0,
//             countryInput,
//             ctx.session.ageRange
//           );

//           // Определяем нормализованное название страны из первого найденного профиля
//           let normalizedCountry = null;
//           if (profiles.length > 0) {
//             normalizedCountry = profiles[0].country;
//           } else if (countryInput.toLowerCase() === "рос") {
//             normalizedCountry = "Россия";
//           } else {
//             normalizedCountry = countryInput;
//           }

//           // Сохраняем оригинальный ввод для поиска и нормализованное название для отображения
//           ctx.session.filterCountry = countryInput;
//           ctx.session.displayCountry = normalizedCountry;

//           if (profiles.length) {
//             await Promise.all(
//               profiles.map((profile, index) =>
//                 sendProfile(
//                   ctx,
//                   profile,
//                   0,
//                   profiles.length,
//                   index === profiles.length - 1
//                 )
//               )
//             );
//           } else {
//             const msg = await ctx.reply(
//               `Анкет из "${normalizedCountry}" не найдено`
//             );
//             messageManager.track(ctx.chat.id, msg.message_id);
//           }

//           await messageManager.sendMainMenu(ctx);
//         } catch (error) {
//           console.error("Ошибка обработки страны:", error);
//         }
//       });
//     }
//   });

//   // Пагинация
//   bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const [_, action, currentPage] = ctx.match;
//         let newPage = parseInt(currentPage);

//         if (action === "first") newPage = 0;
//         else if (action === "prev") newPage = Math.max(0, newPage - 1);
//         else if (action === "next") newPage = newPage + 1;
//         else if (action === "last")
//           newPage =
//             Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE) - 1;
//         else newPage = parseInt(action); // для прямого перехода по номеру страницы

//         await messageManager.clear(ctx);
//         ctx.session = ctx.session || {};

//         const profiles = await getProfilesPage(
//           newPage,
//           ctx.session.filterCountry,
//           ctx.session.ageRange
//         );

//         if (profiles.length) {
//           ctx.session.profilesPage = newPage;

//           await Promise.all(
//             profiles.map((profile, index) =>
//               sendProfile(
//                 ctx,
//                 profile,
//                 newPage,
//                 profiles.length,
//                 index === profiles.length - 1
//               )
//             )
//           );
//         } else {
//           const msg = await ctx.reply("Больше анкет нет");
//           messageManager.track(ctx.chat.id, msg.message_id);
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка пагинации:", error);
//       }
//     });
//   });

//   // Очистка экрана
//   bot.action("clear_screen", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await ctx.answerCbQuery("Экран очищен");
//       } catch (error) {
//         console.error("Ошибка очистки:", error);
//         await ctx.answerCbQuery("Ошибка при очистке");
//       }
//     });
//   });

//   // Функция отправки анкеты
//   const sendProfile = async (ctx, profile, page, total, isLast) => {
//     return messageQueue.add(async () => {
//       try {
//         const about =
//           profile.about?.length > MAX_CAPTION_LENGTH
//             ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + "..."
//             : profile.about || "";

        
//         const formatTelegram = (username) => {
//           if (!username) return "";

//           // Обработка URL формата (https://t.me/%2B491772619571)
//           if (username.startsWith("https://t.me/")) {
//             // Декодируем URL и извлекаем username/number
//             const cleaned = decodeURIComponent(username)
//               .replace("https://t.me/", "")
//               .replace(/^%40/, "@") // Заменяем %40 на @
//               .replace(/^\+/, ""); // Убираем + в начале, если есть

//             return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
//           }

//           // Обработка формата @username или +number
//           const cleaned = username.replace(/^[@+]/, "");
//           return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
//         };
//         const formatPhone = (phone) => {
//           if (!phone) return "";
//           const cleanPhone = phone.replace(/[^0-9+]/g, "");
//           return `📞 <a href="tel:${cleanPhone}">${phone}</a>`;
//         };

//         const formatWhatsApp = (url) => {
//           if (!url) return "";
//           return `📱 <a href="${url}">WhatsApp</a>`;
//         };

//         const caption = `
// 👤 <b>${profile.name}</b>, ${profile.age}\n\n
//  ${profile.country}\n
// 📍 ${profile.city}\n
// <em>${profile.about}</em>\n
// ${profile.phone ? formatPhone(profile.phone) + "\n" : ""}
// ${profile.telegram ? formatTelegram(profile.telegram) + "\n" : ""}
// ${profile.whatsapp ? formatWhatsApp(profile.whatsapp) + "\n" : ""}
// ⚠🚨 <b>НЕ платите вперед с помощью Transcash, билетов PCS, Neosurf, BITCOIN или любых других способов оплаты. Предложения по предоплате – это в основном лохотрон! Пожалуйста, сообщите нам о таких профилях❗</b>`.trim();

//         // Остальной код (клавиатура пагинации и т.д.) остается без изменений
//         let keyboard = [];

//         if (isLast) {
//           const totalPages = Math.ceil(
//             profilesCache.data.length / PROFILES_PER_PAGE
//           );
//           const paginationRow = [];

//           if (page > 0)
//             paginationRow.push({
//               text: "⏪",
//               callback_data: `page_first_${page}`,
//             });
//           if (page > 0)
//             paginationRow.push({
//               text: "◀️",
//               callback_data: `page_prev_${page}`,
//             });

//           paginationRow.push({
//             text: `${page + 1}/${totalPages}`,
//             callback_data: "page_info",
//           });

//           if (page < totalPages - 1)
//             paginationRow.push({
//               text: "▶️",
//               callback_data: `page_next_${page}`,
//             });
//           if (page < totalPages - 1)
//             paginationRow.push({
//               text: "⏩",
//               callback_data: `page_last_${page}`,
//             });

//           if (totalPages > 3) {
//             const quickPagesRow = [];
//             const maxQuickPages = Math.min(5, totalPages);
//             const startPage = Math.max(
//               0,
//               Math.min(
//                 page - Math.floor(maxQuickPages / 2),
//                 totalPages - maxQuickPages
//               )
//             );

//             for (let i = 0; i < maxQuickPages; i++) {
//               const p = startPage + i;
//               if (p >= 0 && p < totalPages) {
//                 quickPagesRow.push({
//                   text: p === page ? `• ${p + 1} •` : `${p + 1}`,
//                   callback_data: `page_${p}_${page}`,
//                 });
//               }
//             }
//             keyboard.push(quickPagesRow);
//           }

//           const filtersRow = [];
//           if (ctx.session?.displayCountry || ctx.session?.ageRange?.label) {
//             let filtersText = "🔹 ";
//             if (ctx.session.displayCountry)
//               filtersText += `Страна: ${ctx.session.displayCountry}`;
//             if (ctx.session.ageRange?.label) {
//               if (ctx.session.displayCountry) filtersText += ", ";
//               filtersText += `Возраст: ${ctx.session.ageRange.label}`;
//             }
//             filtersRow.push({
//               text: filtersText,
//               callback_data: "filters_info",
//             });
//           }

//           keyboard =
//             filtersRow.length > 0
//               ? [paginationRow, ...keyboard, filtersRow]
//               : [paginationRow, ...keyboard];
//         }

//         try {
//           const msg = await ctx.replyWithPhoto(profile.photoUrl, {
//             caption,
//             parse_mode: "HTML",
//             reply_markup:
//               keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         } catch (e) {
//           const msg = await ctx.reply(caption, {
//             parse_mode: "HTML",
//             reply_markup:
//               keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         }
//       } catch (error) {
//         console.error("Ошибка отправки анкеты:", error);
//         return null;
//       }
//     });
//   };
// };
// const RateLimiter = require("telegraf-ratelimit");
// const { default: PQueue } = require("p-queue");

// // Настройка очереди для отправки сообщений
// const messageQueue = new PQueue({
//   concurrency: 5,
//   interval: 1000,
//   intervalCap: 5,
// });

// // Время жизни сообщений в хранилище (24 часа)
// const MESSAGE_TTL = 86400000;

// module.exports = (bot, db) => {
//   // Конфигурация
//   const PROFILES_PER_PAGE = 5;
//   const MAX_CAPTION_LENGTH = 900;
//   const CACHE_TTL = 300000;
//   const AGE_RANGES = [
//     { label: "18-25", min: 18, max: 25 },
//     { label: "26-35", min: 26, max: 35 },
//     { label: "36-45", min: 36, max: 45 },
//     { label: "46+", min: 46, max: 999 },
//   ];

//   // Список популярных стран с эмодзи флагами
//   const POPULAR_COUNTRIES = [
//     { name: "Россия", flag: "🇷🇺" },
//     { name: "Украина", flag: "🇺🇦" },
//     { name: "Беларусь", flag: "🇧🇾" },
//     { name: "Казахстан", flag: "🇰🇿" },
//     { name: "США", flag: "🇺🇸" },
//     { name: "Германия", flag: "🇩🇪" },
//     { name: "Франция", flag: "🇫🇷" },
//     { name: "Италия", flag: "🇮🇹" },
//     { name: "Испания", flag: "🇪🇸" },
//     { name: "Турция", flag: "🇹🇷" },
//     { name: "Китай", flag: "🇨🇳" },
//     { name: "Япония", flag: "🇯🇵" },
//     { name: "Великобритания", flag: "🇬🇧" },
//     { name: "Польша", flag: "🇵🇱" },
//     { name: "Израиль", flag: "🇮🇱" },
//     { name: "ОАЭ", flag: "🇦🇪" },
//     { name: "Таиланд", flag: "🇹🇭" },
//     { name: "Индия", flag: "🇮🇳" },
//     { name: "Бразилия", flag: "🇧🇷" },
//     { name: "Канада", flag: "🇨🇦" },
//     // Дополнительные страны
//     { name: "Австралия", flag: "🇦🇺" },
//     { name: "Новая Зеландия", flag: "🇳🇿" },
//     { name: "Мексика", flag: "🇲🇽" },
//     { name: "Аргентина", flag: "🇦🇷" },
//     { name: "Чили", flag: "🇨🇱" },
//     { name: "Колумбия", flag: "🇨🇴" },
//     { name: "Перу", flag: "🇵🇪" },
//     { name: "Венесуэла", flag: "🇻🇪" },
//     { name: "Куба", flag: "🇨🇺" },
//     { name: "Южная Корея", flag: "🇰🇷" },
//     { name: "Индонезия", flag: "🇮🇩" },
//     { name: "Вьетнам", flag: "🇻🇳" },
//     { name: "Малайзия", flag: "🇲🇾" },
//     { name: "Филиппины", flag: "🇵🇭" },
//     { name: "Сингапур", flag: "🇸🇬" },
//     { name: "Саудовская Аравия", flag: "🇸🇦" },
//     { name: "Катар", flag: "🇶🇦" },
//     { name: "Кувейт", flag: "🇰🇼" },
//     { name: "Иран", flag: "🇮🇷" },
//     { name: "Ирак", flag: "🇮🇶" },
//     { name: "Азербайджан", flag: "🇦🇿" },
//     { name: "Армения", flag: "🇦🇲" },
//     { name: "Грузия", flag: "🇬🇪" },
//     { name: "Молдова", flag: "🇲🇩" },
//     { name: "Латвия", flag: "🇱🇻" },
//     { name: "Литва", flag: "🇱🇹" },
//     { name: "Эстония", flag: "🇪🇪" },
//     { name: "Финляндия", flag: "🇫🇮" },
//     { name: "Швеция", flag: "🇸🇪" },
//     { name: "Норвегия", flag: "🇳🇴" },
//     { name: "Дания", flag: "🇩🇰" },
//     { name: "Нидерланды", flag: "🇳🇱" },
//     { name: "Бельгия", flag: "🇧🇪" },
//     { name: "Швейцария", flag: "🇨🇭" },
//     { name: "Австрия", flag: "🇦🇹" },
//     { name: "Чехия", flag: "🇨🇿" },
//     { name: "Словакия", flag: "🇸🇰" },
//     { name: "Венгрия", flag: "🇭🇺" },
//     { name: "Румыния", flag: "🇷🇴" },
//     { name: "Болгария", flag: "🇧🇬" },
//     { name: "Сербия", flag: "🇷🇸" },
//     { name: "Хорватия", flag: "🇭🇷" },
//     { name: "Греция", flag: "🇬🇷" },
//     { name: "Португалия", flag: "🇵🇹" },
//     { name: "Ирландия", flag: "🇮🇪" },
//     { name: "Исландия", flag: "🇮🇸" },
//     { name: "Мальта", flag: "🇲🇹" },
//     { name: "Кипр", flag: "🇨🇾" },
//     { name: "Люксембург", flag: "🇱🇺" },
//     { name: "Афганистан", flag: "🇦🇫" },
//     { name: "Пакистан", flag: "🇵🇰" },
//     { name: "Бангладеш", flag: "🇧🇩" },
//     { name: "Шри-Ланка", flag: "🇱🇰" },
//     { name: "Непал", flag: "🇳🇵" },
//   ];

//   // Инициализация rate-limiter
//   const limiter = new RateLimiter({
//     window: 1000,
//     limit: 3,
//     onLimitExceeded: (ctx) =>
//       ctx.reply("⚠️ Слишком много запросов, подождите секунду..."),
//   });

//   bot.use(limiter);

//   // Система хранения сообщений
//   const chatStorage = {
//     messages: new Map(), // chatId: Set(messageIds)
//     mainMenu: new Map(), // chatId: messageId
//     userState: new Map(), // userId: state
//     messageTimestamps: new Map(), // messageId: timestamp
//     countryKeyboard: new Map(), // chatId: messageId (для хранения сообщения с клавиатурой стран)
//   };

//   // Очистка старых сообщений каждые 6 часов
//   setInterval(() => {
//     const now = Date.now();
//     for (const [chatId, messages] of chatStorage.messages) {
//       for (const messageId of messages) {
//         if (
//           now - (chatStorage.messageTimestamps.get(messageId) || 0) >
//           MESSAGE_TTL
//         ) {
//           messages.delete(messageId);
//           chatStorage.messageTimestamps.delete(messageId);
//         }
//       }
//     }
//   }, 21600000);

//   // Кэш данных
//   const profilesCache = {
//     data: null,
//     timestamp: 0,
//     countryFilter: null,
//     ageFilter: null,
//     clear: function () {
//       this.data = null;
//       this.timestamp = 0;
//       this.countryFilter = null;
//       this.ageFilter = null;
//     },
//   };

//   // Получение анкет
//   const getProfilesPage = async (
//     page = 0,
//     searchCountry = null,
//     ageRange = null
//   ) => {
//     try {
//       const now = Date.now();
//       const cacheKey = `${searchCountry || "all"}_${
//         ageRange ? ageRange.label : "all"
//       }`;

//       if (
//         profilesCache.data &&
//         now - profilesCache.timestamp < CACHE_TTL &&
//         profilesCache.countryFilter === (searchCountry || null) &&
//         profilesCache.ageFilter === (ageRange ? ageRange.label : null)
//       ) {
//         return profilesCache.data.slice(
//           page * PROFILES_PER_PAGE,
//           (page + 1) * PROFILES_PER_PAGE
//         );
//       }

//       const snapshot = await db
//         .collection("profiles")
//         .orderBy("createdAt", "desc")
//         .get();

//       let profiles = snapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));

//       if (searchCountry) {
//         const searchTerm = searchCountry.toLowerCase().trim();
//         profiles = profiles.filter((profile) => {
//           const profileCountry = profile.country?.toLowerCase() || "";
//           return (
//             profileCountry.includes(searchTerm) ||
//             (searchTerm === "рос" && profileCountry.includes("россия"))
//           );
//         });
//       }

//       if (ageRange) {
//         profiles = profiles.filter((profile) => {
//           const age = parseInt(profile.age) || 0;
//           return age >= ageRange.min && age <= ageRange.max;
//         });
//       }

//       profilesCache.data = profiles;
//       profilesCache.timestamp = now;
//       profilesCache.countryFilter = searchCountry || null;
//       profilesCache.ageFilter = ageRange ? ageRange.label : null;

//       return profiles.slice(
//         page * PROFILES_PER_PAGE,
//         (page + 1) * PROFILES_PER_PAGE
//       );
//     } catch (error) {
//       console.error("Ошибка загрузки анкет:", error);
//       profilesCache.clear();
//       return [];
//     }
//   };

//   // Получение списка уникальных стран из базы данных
//   const getUniqueCountries = async () => {
//     try {
//       const snapshot = await db.collection("profiles").orderBy("country").get();

//       const countries = new Set();
//       snapshot.docs.forEach((doc) => {
//         const country = doc.data().country;
//         if (country) countries.add(country);
//       });

//       return Array.from(countries).sort();
//     } catch (error) {
//       console.error("Ошибка получения списка стран:", error);
//       return [];
//     }
//   };

//   // Форматирование названия страны с добавлением флага (если есть в списке популярных)
//   const formatCountryWithFlag = (countryName) => {
//     if (!countryName) return countryName;

//     const foundCountry = POPULAR_COUNTRIES.find(
//       (c) => c.name.toLowerCase() === countryName.toLowerCase()
//     );

//     return foundCountry ? `${foundCountry.flag} ${countryName}` : countryName;
//   };

//   // Система управления сообщениями
//   const messageManager = {
//     track: function (chatId, messageId) {
//       if (!messageId) return;
//       if (!chatStorage.messages.has(chatId)) {
//         chatStorage.messages.set(chatId, new Set());
//       }
//       chatStorage.messages.get(chatId).add(messageId);
//       chatStorage.messageTimestamps.set(messageId, Date.now());
//     },

//     clear: async function (ctx) {
//       const chatId = ctx.chat.id;
//       if (!chatStorage.messages.has(chatId)) return;

//       const messages = [...chatStorage.messages.get(chatId)];
//       const mainMenuId = chatStorage.mainMenu.get(chatId);
//       const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);

//       for (const messageId of messages) {
//         if (messageId !== mainMenuId && messageId !== countryKeyboardId) {
//           try {
//             await ctx.telegram.deleteMessage(chatId, messageId);
//             chatStorage.messages.get(chatId).delete(messageId);
//             chatStorage.messageTimestamps.delete(messageId);
//           } catch (e) {
//             if (e.response?.error_code !== 400) {
//               // Игнорируем только "message not found"
//               console.error(`Ошибка удаления ${messageId}:`, e.message);
//             }
//           }
//         }
//       }

//       // Удаляем клавиатуру стран если есть
//       if (countryKeyboardId) {
//         try {
//           await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
//           chatStorage.messages.get(chatId).delete(countryKeyboardId);
//           chatStorage.messageTimestamps.delete(countryKeyboardId);
//           chatStorage.countryKeyboard.delete(chatId);
//         } catch (e) {
//           if (e.response?.error_code !== 400) {
//             console.error("Ошибка удаления клавиатуры стран:", e);
//           }
//         }
//       }

//       chatStorage.userState.delete(ctx.from.id);
//     },

//     sendMainMenu: async function (ctx) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старое меню если есть
//           if (chatStorage.mainMenu.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(
//                 chatId,
//                 chatStorage.mainMenu.get(chatId)
//               );
//               chatStorage.messages
//                 .get(chatId)
//                 ?.delete(chatStorage.mainMenu.get(chatId));
//               chatStorage.messageTimestamps.delete(
//                 chatStorage.mainMenu.get(chatId)
//               );
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error("Ошибка удаления меню:", e);
//               }
//             }
//           }

//           const menu = await ctx.reply("Главное меню:", {
//             reply_markup: {
//               inline_keyboard: [
//                 [{
//                   text: '🌐 Открыть PeaceYourGun 🥕 в WebApp',
//                   web_app: { url: process.env.WEBAPP_URL }
//                 }],
//                 [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//                 [
//                   {
//                     text: "🎂 Фильтр по возрасту",
//                     callback_data: "filter_by_age",
//                   },
//                 ],
//                 [{ text: "❌ Очистить экран", callback_data: "clear_screen" }],
//               ],
//             },
//           });

//           chatStorage.mainMenu.set(chatId, menu.message_id);
//           self.track(chatId, menu.message_id);
//         } catch (error) {
//           console.error("Ошибка отправки меню:", error);
//           throw error;
//         }
//       });
//     },

//     sendCountriesKeyboard: async function (ctx) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старую клавиатуру стран если есть
//           if (chatStorage.countryKeyboard.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(
//                 chatId,
//                 chatStorage.countryKeyboard.get(chatId)
//               );
//               chatStorage.messages
//                 .get(chatId)
//                 ?.delete(chatStorage.countryKeyboard.get(chatId));
//               chatStorage.messageTimestamps.delete(
//                 chatStorage.countryKeyboard.get(chatId)
//               );
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error("Ошибка удаления клавиатуры стран:", e);
//               }
//             }
//           }

//           // Получаем список уникальных стран из базы
//           const uniqueCountries = await getUniqueCountries();

//           // Если стран нет или слишком много, показываем только популярные
//           const countriesToShow =
//             uniqueCountries.length > 0 && uniqueCountries.length <= 50
//               ? uniqueCountries
//               : POPULAR_COUNTRIES.map((c) => c.name);

//           // Формируем клавиатуру
//           const keyboard = [];
//           let row = [];

//           // Добавляем страны с флагами
//           countriesToShow.forEach((country, index) => {
//             const countryWithFlag = formatCountryWithFlag(country);
//             row.push({
//               text: countryWithFlag,
//               callback_data: `country_${country}`,
//             });

//             // Разбиваем на строки по 3 кнопки
//             if (row.length === 3 || index === countriesToShow.length - 1) {
//               keyboard.push(row);
//               row = [];
//             }
//           });

//           // Добавляем кнопку "Назад"
//           keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

//           const msg = await ctx.reply("Выберите страну:", {
//             reply_markup: { inline_keyboard: keyboard },
//           });

//           chatStorage.countryKeyboard.set(chatId, msg.message_id);
//           self.track(chatId, msg.message_id);
//         } catch (error) {
//           console.error("Ошибка отправки клавиатуры стран:", error);
//           throw error;
//         }
//       });
//     },
//   };

//   // Обработчики команд
//   bot.command("start", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка команды start:", error);
//       }
//     });
//   });

//   bot.action("show_profiles", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await ctx.answerCbQuery("Загружаем анкеты...");

//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = null;
//         ctx.session.displayCountry = null;
//         ctx.session.ageRange = null;

//         console.log("Starting profiles load", {
//           cache: profilesCache.data ? "exists" : "empty",
//           cacheAge: Date.now() - profilesCache.timestamp,
//         });

//         await messageManager.clear(ctx);

//         if (
//           !profilesCache.data ||
//           Date.now() - profilesCache.timestamp > CACHE_TTL
//         ) {
//           profilesCache.clear();
//         }
//         const profiles = await getProfilesPage(0);

//         if (!profiles.length) {
//           const msg = await ctx.reply("Анкет нет, попробуйте позже");
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         // Отправляем все анкеты на странице
//         for (let i = 0; i < profiles.length; i++) {
//           const isLast = i === profiles.length - 1;
//           await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//           if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка показа анкет:", error);
//         try {
//           await ctx.answerCbQuery("Ошибка загрузки");
//           const msg = await ctx.reply(
//             "Ошибка загрузки анкет, попробуйте ещё раз"
//           );
//           messageManager.track(ctx.chat.id, msg.message_id);
//         } catch (e) {
//           console.error("Дополнительная ошибка:", e);
//         }
//       }
//     });
//   });

//   bot.action("all_countries", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendCountriesKeyboard(ctx);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка обработки списка стран:", error);
//       }
//     });
//   });

//   // Обработчик выбора страны из списка
//   bot.action(/^country_(.+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const country = ctx.match[1];
//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = country;
//         ctx.session.displayCountry = country;

//         await messageManager.clear(ctx);
//         const profiles = await getProfilesPage(
//           0,
//           country,
//           ctx.session.ageRange
//         );

//         if (!profiles.length) {
//           const msg = await ctx.reply(`Анкет из "${country}" не найдено`);
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         // Отправляем все анкеты на странице
//         for (let i = 0; i < profiles.length; i++) {
//           const isLast = i === profiles.length - 1;
//           await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//           if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка обработки выбора страны:", error);
//       }
//     });
//   });

//   // Обработчик кнопки "Назад" из клавиатуры стран
//   bot.action("back_to_menu", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка возврата в меню:", error);
//       }
//     });
//   });

//   // Поиск по стране через ввод текста
//   bot.action("search_by_country", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         chatStorage.userState.set(ctx.from.id, "awaiting_country");
//         const msg = await ctx.reply("Введите страну для поиска:");
//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка поиска:", error);
//       }
//     });
//   });

//   // Фильтр по возрасту
//   bot.action("filter_by_age", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);

//         const keyboard = AGE_RANGES.map((range) => [
//           { text: range.label, callback_data: `age_range_${range.label}` },
//         ]);
//         keyboard.push([
//           { text: "❌ Сбросить фильтр", callback_data: "age_range_reset" },
//         ]);

//         const msg = await ctx.reply("Выберите возрастной диапазон:", {
//           reply_markup: { inline_keyboard: keyboard },
//         });

//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка фильтра по возрасту:", error);
//       }
//     });
//   });

//   // Обработчик выбора возрастного диапазона
//   bot.action(/^age_range_(.+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const [_, range] = ctx.match;

//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;

//         if (range === "reset") {
//           ctx.session.ageRange = null;
//         } else {
//           const selectedRange = AGE_RANGES.find((r) => r.label === range);
//           if (selectedRange) {
//             ctx.session.ageRange = selectedRange;
//           }
//         }

//         await messageManager.clear(ctx);
//         const profiles = await getProfilesPage(
//           0,
//           ctx.session.filterCountry,
//           ctx.session.ageRange
//         );

//         if (!profiles.length) {
//           const msg = await ctx.reply("Анкет нет, попробуйте изменить фильтры");
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         // Отправляем все анкеты на странице
//         for (let i = 0; i < profiles.length; i++) {
//           const isLast = i === profiles.length - 1;
//           await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//           if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка обработки возрастного диапазона:", error);
//       }
//     });
//   });

//   // Обработчик ввода страны
//   bot.on("text", async (ctx) => {
//     const userId = ctx.from.id;
//     if (chatStorage.userState.get(userId) === "awaiting_country") {
//       await messageQueue.add(async () => {
//         try {
//           messageManager.track(ctx.chat.id, ctx.message.message_id);
//           const countryInput = ctx.message.text.trim();

//           if (!countryInput) {
//             const msg = await ctx.reply("Вы не указали страну");
//             messageManager.track(ctx.chat.id, msg.message_id);
//             return;
//           }

//           await messageManager.clear(ctx);
//           ctx.session = ctx.session || {};
//           ctx.session.profilesPage = 0;

//           const profiles = await getProfilesPage(
//             0,
//             countryInput,
//             ctx.session.ageRange
//           );

//           let normalizedCountry = null;
//           if (profiles.length > 0) {
//             normalizedCountry = profiles[0].country;
//           } else if (countryInput.toLowerCase() === "рос") {
//             normalizedCountry = "Россия";
//           } else {
//             normalizedCountry = countryInput;
//           }

//           ctx.session.filterCountry = countryInput;
//           ctx.session.displayCountry = normalizedCountry;

//           if (profiles.length) {
//             for (let i = 0; i < profiles.length; i++) {
//               const isLast = i === profiles.length - 1;
//               await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//               if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//             }
//           } else {
//             const msg = await ctx.reply(
//               `Анкет из "${normalizedCountry}" не найдено`
//             );
//             messageManager.track(ctx.chat.id, msg.message_id);
//           }

//           await messageManager.sendMainMenu(ctx);
//         } catch (error) {
//           console.error("Ошибка обработки страны:", error);
//         }
//       });
//     }
//   });

//   // Пагинация
//   bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const [_, action, currentPage] = ctx.match;
//         let newPage = parseInt(currentPage);

//         if (action === "first") newPage = 0;
//         else if (action === "prev") newPage = Math.max(0, newPage - 1);
//         else if (action === "next") newPage = newPage + 1;
//         else if (action === "last")
//           newPage =
//             Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE) - 1;
//         else newPage = parseInt(action);

//         await messageManager.clear(ctx);
//         ctx.session = ctx.session || {};

//         const profiles = await getProfilesPage(
//           newPage,
//           ctx.session.filterCountry,
//           ctx.session.ageRange
//         );

//         if (profiles.length) {
//           ctx.session.profilesPage = newPage;

//           for (let i = 0; i < profiles.length; i++) {
//             const isLast = i === profiles.length - 1;
//             await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast);
//             if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//           }
//         } else {
//           const msg = await ctx.reply("Больше анкет нет");
//           messageManager.track(ctx.chat.id, msg.message_id);
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка пагинации:", error);
//       }
//     });
//   });

//   // Очистка экрана
//   bot.action("clear_screen", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await ctx.answerCbQuery("Экран очищен");
//       } catch (error) {
//         console.error("Ошибка очистки:", error);
//         await ctx.answerCbQuery("Ошибка при очистке");
//       }
//     });
//   });

//   // Функция отправки анкеты
//   const sendProfile = async (ctx, profile, page, total, isLast) => {
//     return messageQueue.add(async () => {
//       try {
//         const about =
//           profile.about?.length > MAX_CAPTION_LENGTH
//             ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + "..."
//             : profile.about || "";

//         const formatTelegram = (username) => {
//           if (!username) return "";

//           if (username.startsWith("https://t.me/")) {
//             const cleaned = decodeURIComponent(username)
//               .replace("https://t.me/", "")
//               .replace(/^%40/, "@")
//               .replace(/^\+/, "");
//             return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
//           }

//           const cleaned = username.replace(/^[@+]/, "");
//           return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
//         };

//         const formatPhone = (phone) => {
//           if (!phone) return "";
//           const cleanPhone = phone.replace(/[^0-9+]/g, "");
//           return `📞 <a href="tel:${cleanPhone}">${phone}</a>`;
//         };

//         const formatWhatsApp = (url) => {
//           if (!url) return "";
//           return `📱 <a href="${url}">WhatsApp</a>`;
//         };

//         const caption = `
// 👤 <b>${profile.name}</b>, ${profile.age}\n\n
//  ${profile.country}\n
// 📍 ${profile.city}\n
// <em>${profile.about}</em>\n
// ${profile.phone ? formatPhone(profile.phone) + "\n" : ""}
// ${profile.telegram ? formatTelegram(profile.telegram) + "\n" : ""}
// ${profile.whatsapp ? formatWhatsApp(profile.whatsapp) + "\n" : ""}
// ⚠🚨 <b>НЕ платите вперед с помощью Transcash, билетов PCS, Neosurf, BITCOIN или любых других способов оплаты. Предложения по предоплате – это в основном лохотрон! Пожалуйста, сообщите нам о таких профилях❗</b>`.trim();

//         // Формируем клавиатуру только для последней анкеты на странице
//         let keyboard = [];
//         if (isLast) {
//           const totalPages = Math.ceil(
//             profilesCache.data.length / PROFILES_PER_PAGE
//           );
//           const paginationRow = [];

//           if (page > 0)
//             paginationRow.push({
//               text: "⏪",
//               callback_data: `page_first_${page}`,
//             });
//           if (page > 0)
//             paginationRow.push({
//               text: "◀️",
//               callback_data: `page_prev_${page}`,
//             });

//           paginationRow.push({
//             text: `${page + 1}/${totalPages}`,
//             callback_data: "page_info",
//           });

//           if (page < totalPages - 1)
//             paginationRow.push({
//               text: "▶️",
//               callback_data: `page_next_${page}`,
//             });
//           if (page < totalPages - 1)
//             paginationRow.push({
//               text: "⏩",
//               callback_data: `page_last_${page}`,
//             });

//           if (totalPages > 3) {
//             const quickPagesRow = [];
//             const maxQuickPages = Math.min(5, totalPages);
//             const startPage = Math.max(
//               0,
//               Math.min(
//                 page - Math.floor(maxQuickPages / 2),
//                 totalPages - maxQuickPages
//               )
//             );

//             for (let i = 0; i < maxQuickPages; i++) {
//               const p = startPage + i;
//               if (p >= 0 && p < totalPages) {
//                 quickPagesRow.push({
//                   text: p === page ? `• ${p + 1} •` : `${p + 1}`,
//                   callback_data: `page_${p}_${page}`,
//                 });
//               }
//             }
//             keyboard.push(quickPagesRow);
//           }

//           const filtersRow = [];
//           if (ctx.session?.displayCountry || ctx.session?.ageRange?.label) {
//             let filtersText = "🔹 ";
//             if (ctx.session.displayCountry)
//               filtersText += `Страна: ${ctx.session.displayCountry}`;
//             if (ctx.session.ageRange?.label) {
//               if (ctx.session.displayCountry) filtersText += ", ";
//               filtersText += `Возраст: ${ctx.session.ageRange.label}`;
//             }
//             filtersRow.push({
//               text: filtersText,
//               callback_data: "filters_info",
//             });
//           }

//           keyboard =
//             filtersRow.length > 0
//               ? [paginationRow, ...keyboard, filtersRow]
//               : [paginationRow, ...keyboard];
//         }

//         try {
//           const msg = await ctx.replyWithPhoto(profile.photoUrl, {
//             caption,
//             parse_mode: "HTML",
//             reply_markup:
//               keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         } catch (e) {
//           const msg = await ctx.reply(caption, {
//             parse_mode: "HTML",
//             reply_markup:
//               keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         }
//       } catch (error) {
//         console.error("Ошибка отправки анкеты:", error);
//         return null;
//       }
//     });
//   };
// };


// const RateLimiter = require("telegraf-ratelimit");
// const { default: PQueue } = require("p-queue");

// // Настройка очереди для отправки сообщений
// const messageQueue = new PQueue({
//   concurrency: 5,
//   interval: 1000,
//   intervalCap: 5,
// });

// // Время жизни сообщений в хранилище (24 часа)
// const MESSAGE_TTL = 86400000;

// module.exports = (bot, db) => {
//   // Конфигурация
//   const PROFILES_PER_PAGE = 5;
//   const MAX_CAPTION_LENGTH = 900;
//   const CACHE_TTL = 300000;
//   const AGE_RANGES = [
//     { label: "18-25", min: 18, max: 25 },
//     { label: "26-35", min: 26, max: 35 },
//     { label: "36-45", min: 36, max: 45 },
//     { label: "46+", min: 46, max: 999 },
//   ];


// // Добавляем после объявления констант (PROFILES_PER_PAGE, MAX_CAPTION_LENGTH и т.д.)
// const checkSubscription = async (userId, db) => {
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
//   // Список популярных стран с эмодзи флагами
//   const POPULAR_COUNTRIES = [
//     { name: "Россия", flag: "🇷🇺" },
//     { name: "Украина", flag: "🇺🇦" },
//     { name: "Беларусь", flag: "🇧🇾" },
//     { name: "Казахстан", flag: "🇰🇿" },
//     { name: "США", flag: "🇺🇸" },
//     { name: "Германия", flag: "🇩🇪" },
//     { name: "Франция", flag: "🇫🇷" },
//     { name: "Италия", flag: "🇮🇹" },
//     { name: "Испания", flag: "🇪🇸" },
//     { name: "Турция", flag: "🇹🇷" },
//     { name: "Китай", flag: "🇨🇳" },
//     { name: "Япония", flag: "🇯🇵" },
//     { name: "Великобритания", flag: "🇬🇧" },
//     { name: "Польша", flag: "🇵🇱" },
//     { name: "Израиль", flag: "🇮🇱" },
//     { name: "ОАЭ", flag: "🇦🇪" },
//     { name: "Таиланд", flag: "🇹🇭" },
//     { name: "Индия", flag: "🇮🇳" },
//     { name: "Бразилия", flag: "🇧🇷" },
//     { name: "Канада", flag: "🇨🇦" },
//     // Дополнительные страны
//     { name: "Австралия", flag: "🇦🇺" },
//     { name: "Новая Зеландия", flag: "🇳🇿" },
//     { name: "Мексика", flag: "🇲🇽" },
//     { name: "Аргентина", flag: "🇦🇷" },
//     { name: "Чили", flag: "🇨🇱" },
//     { name: "Колумбия", flag: "🇨🇴" },
//     { name: "Перу", flag: "🇵🇪" },
//     { name: "Венесуэла", flag: "🇻🇪" },
//     { name: "Куба", flag: "🇨🇺" },
//     { name: "Южная Корея", flag: "🇰🇷" },
//     { name: "Индонезия", flag: "🇮🇩" },
//     { name: "Вьетнам", flag: "🇻🇳" },
//     { name: "Малайзия", flag: "🇲🇾" },
//     { name: "Филиппины", flag: "🇵🇭" },
//     { name: "Сингапур", flag: "🇸🇬" },
//     { name: "Саудовская Аравия", flag: "🇸🇦" },
//     { name: "Катар", flag: "🇶🇦" },
//     { name: "Кувейт", flag: "🇰🇼" },
//     { name: "Иран", flag: "🇮🇷" },
//     { name: "Ирак", flag: "🇮🇶" },
//     { name: "Азербайджан", flag: "🇦🇿" },
//     { name: "Армения", flag: "🇦🇲" },
//     { name: "Грузия", flag: "🇬🇪" },
//     { name: "Молдова", flag: "🇲🇩" },
//     { name: "Латвия", flag: "🇱🇻" },
//     { name: "Литва", flag: "🇱🇹" },
//     { name: "Эстония", flag: "🇪🇪" },
//     { name: "Финляндия", flag: "🇫🇮" },
//     { name: "Швеция", flag: "🇸🇪" },
//     { name: "Норвегия", flag: "🇳🇴" },
//     { name: "Дания", flag: "🇩🇰" },
//     { name: "Нидерланды", flag: "🇳🇱" },
//     { name: "Бельгия", flag: "🇧🇪" },
//     { name: "Швейцария", flag: "🇨🇭" },
//     { name: "Австрия", flag: "🇦🇹" },
//     { name: "Чехия", flag: "🇨🇿" },
//     { name: "Словакия", flag: "🇸🇰" },
//     { name: "Венгрия", flag: "🇭🇺" },
//     { name: "Румыния", flag: "🇷🇴" },
//     { name: "Болгария", flag: "🇧🇬" },
//     { name: "Сербия", flag: "🇷🇸" },
//     { name: "Хорватия", flag: "🇭🇷" },
//     { name: "Греция", flag: "🇬🇷" },
//     { name: "Португалия", flag: "🇵🇹" },
//     { name: "Ирландия", flag: "🇮🇪" },
//     { name: "Исландия", flag: "🇮🇸" },
//     { name: "Мальта", flag: "🇲🇹" },
//     { name: "Кипр", flag: "🇨🇾" },
//     { name: "Люксембург", flag: "🇱🇺" },
//     { name: "Афганистан", flag: "🇦🇫" },
//     { name: "Пакистан", flag: "🇵🇰" },
//     { name: "Бангладеш", flag: "🇧🇩" },
//     { name: "Шри-Ланка", flag: "🇱🇰" },
//     { name: "Непал", flag: "🇳🇵" },
//   ];

//   // Инициализация rate-limiter
//   const limiter = new RateLimiter({
//     window: 1000,
//     limit: 3,
//     onLimitExceeded: (ctx) =>
//       ctx.reply("⚠️ Слишком много запросов, подождите секунду..."),
//   });

//   bot.use(limiter);

//   // Система хранения сообщений
//   const chatStorage = {
//     messages: new Map(), // chatId: Set(messageIds)
//     mainMenu: new Map(), // chatId: messageId
//     userState: new Map(), // userId: state
//     messageTimestamps: new Map(), // messageId: timestamp
//     countryKeyboard: new Map(), // chatId: messageId (для хранения сообщения с клавиатурой стран)
//     cityKeyboard: new Map(), // chatId: messageId (для хранения сообщения с клавиатурой городов)
//   };

//   // Очистка старых сообщений каждые 6 часов
//   setInterval(() => {
//     const now = Date.now();
//     for (const [chatId, messages] of chatStorage.messages) {
//       for (const messageId of messages) {
//         if (
//           now - (chatStorage.messageTimestamps.get(messageId) || 0) >
//           MESSAGE_TTL
//         ) {
//           messages.delete(messageId);
//           chatStorage.messageTimestamps.delete(messageId);
//         }
//       }
//     }
//   }, 21600000);

//   // Кэш данных
//   const profilesCache = {
//     data: null,
//     timestamp: 0,
//     countryFilter: null,
//     ageFilter: null,
//     cityFilter: null,
//     clear: function () {
//       this.data = null;
//       this.timestamp = 0;
//       this.countryFilter = null;
//       this.ageFilter = null;
//       this.cityFilter = null;
//     },
//   };

//   // Получение анкет с фильтрацией по стране и городу
//   const getProfilesPage = async (
//     page = 0,
//     searchCountry = null,
//     ageRange = null,
//     searchCity = null
//   ) => {
//     try {
//       const now = Date.now();
//       const cacheKey = `${searchCountry || "all"}_${
//         ageRange ? ageRange.label : "all"
//       }_${searchCity || "all"}`;

//       if (
//         profilesCache.data &&
//         now - profilesCache.timestamp < CACHE_TTL &&
//         profilesCache.countryFilter === (searchCountry || null) &&
//         profilesCache.ageFilter === (ageRange ? ageRange.label : null) &&
//         profilesCache.cityFilter === (searchCity || null)
//       ) {
//         return profilesCache.data.slice(
//           page * PROFILES_PER_PAGE,
//           (page + 1) * PROFILES_PER_PAGE
//         );
//       }

//       const snapshot = await db
//         .collection("profiles")
//         .orderBy("createdAt", "desc")
//         .get();

//       let profiles = snapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));

//       // Фильтрация по стране
//       if (searchCountry) {
//         const searchTerm = searchCountry.toLowerCase().trim();
//         profiles = profiles.filter((profile) => {
//           const profileCountry = profile.country?.toLowerCase() || "";
//           return (
//             profileCountry.includes(searchTerm) ||
//             (searchTerm === "рос" && profileCountry.includes("россия"))
//           );
//         });
//       }

//       // Фильтрация по возрасту
//       if (ageRange) {
//         profiles = profiles.filter((profile) => {
//           const age = parseInt(profile.age) || 0;
//           return age >= ageRange.min && age <= ageRange.max;
//         });
//       }

//       // Фильтрация по городу
//       if (searchCity) {
//         const searchTerm = searchCity.toLowerCase().trim();
//         profiles = profiles.filter((profile) => {
//           const profileCity = profile.city?.toLowerCase() || "";
//           return profileCity.includes(searchTerm);
//         });
//       }

//       profilesCache.data = profiles;
//       profilesCache.timestamp = now;
//       profilesCache.countryFilter = searchCountry || null;
//       profilesCache.ageFilter = ageRange ? ageRange.label : null;
//       profilesCache.cityFilter = searchCity || null;

//       return profiles.slice(
//         page * PROFILES_PER_PAGE,
//         (page + 1) * PROFILES_PER_PAGE
//       );
//     } catch (error) {
//       console.error("Ошибка загрузки анкет:", error);
//       profilesCache.clear();
//       return [];
//     }
//   };

//   // Получение списка уникальных стран из базы данных
//   const getUniqueCountries = async () => {
//     try {
//       const snapshot = await db.collection("profiles").orderBy("country").get();

//       const countries = new Set();
//       snapshot.docs.forEach((doc) => {
//         const country = doc.data().country;
//         if (country) countries.add(country);
//       });

//       return Array.from(countries).sort();
//     } catch (error) {
//       console.error("Ошибка получения списка стран:", error);
//       return [];
//     }
//   };

//   // Получение списка уникальных городов для страны
//   const getUniqueCitiesForCountry = async (country) => {
//     try {
//       const snapshot = await db
//         .collection("profiles")
//         .where("country", "==", country)
//         .orderBy("city")
//         .get();

//       const cities = new Set();
//       snapshot.docs.forEach((doc) => {
//         const city = doc.data().city;
//         if (city) cities.add(city);
//       });

//       return Array.from(cities).sort();
//     } catch (error) {
//       console.error("Ошибка получения списка городов:", error);
//       return [];
//     }
//   };

//   // Форматирование названия страны с добавлением флага (если есть в списке популярных)
//   const formatCountryWithFlag = (countryName) => {
//     if (!countryName) return countryName;

//     const foundCountry = POPULAR_COUNTRIES.find(
//       (c) => c.name.toLowerCase() === countryName.toLowerCase()
//     );

//     return foundCountry ? `${foundCountry.flag} ${countryName}` : countryName;
//   };

//   // Система управления сообщениями
//   const messageManager = {
//     track: function (chatId, messageId) {
//       if (!messageId) return;
//       if (!chatStorage.messages.has(chatId)) {
//         chatStorage.messages.set(chatId, new Set());
//       }
//       chatStorage.messages.get(chatId).add(messageId);
//       chatStorage.messageTimestamps.set(messageId, Date.now());
//     },

//     clear: async function (ctx, keepCityKeyboard = false) {
//   const chatId = ctx.chat.id;
//   if (!chatStorage.messages.has(chatId)) return;

//   const messages = [...chatStorage.messages.get(chatId)];
//   const mainMenuId = chatStorage.mainMenu.get(chatId);
//   const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//   const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//   for (const messageId of messages) {
//     if (
//       messageId !== mainMenuId &&
//       messageId !== countryKeyboardId &&
//       messageId !== cityKeyboardId
//     ) {
//       try {
//         await ctx.telegram.deleteMessage(chatId, messageId);
//         chatStorage.messages.get(chatId).delete(messageId);
//         chatStorage.messageTimestamps.delete(messageId);
//       } catch (e) {
//         if (e.response?.error_code !== 400) {
//           console.error(`Ошибка удаления ${messageId}:`, e.message);
//         }
//       }
//     }
//   }

//   // Удаляем клавиатуру городов только если явно указано
//   if (cityKeyboardId && !keepCityKeyboard) {
//     try {
//       await ctx.telegram.deleteMessage(chatId, cityKeyboardId);
//       chatStorage.messages.get(chatId).delete(cityKeyboardId);
//       chatStorage.messageTimestamps.delete(cityKeyboardId);
//       chatStorage.cityKeyboard.delete(chatId);
//     } catch (e) {
//       if (e.response?.error_code !== 400) {
//         console.error("Ошибка удаления клавиатуры городов:", e);
//       }
//     }
//   }

//   // Удаляем клавиатуру стран если есть
//   if (countryKeyboardId) {
//     try {
//       await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
//       chatStorage.messages.get(chatId).delete(countryKeyboardId);
//       chatStorage.messageTimestamps.delete(countryKeyboardId);
//       chatStorage.countryKeyboard.delete(chatId);
//     } catch (e) {
//       if (e.response?.error_code !== 400) {
//         console.error("Ошибка удаления клавиатуры стран:", e);
//       }
//     }
//   }

//   chatStorage.userState.delete(ctx.from.id);
// },
// sendMainMenu: async function (ctx) {
//   return messageQueue.add(async () => {
//     const chatId = ctx.chat.id;
//     const self = this;

//     try {
//       // 1. Удаление старого меню
//       if (chatStorage.mainMenu.has(chatId)) {
//         try {
//           await ctx.telegram.deleteMessage(chatId, chatStorage.mainMenu.get(chatId));
//           chatStorage.messages.get(chatId)?.delete(chatStorage.mainMenu.get(chatId));
//           chatStorage.messageTimestamps.delete(chatStorage.mainMenu.get(chatId));
//         } catch (e) {
//           if (e.response?.error_code !== 400) {
//             console.error("Ошибка удаления меню:", e);
//           }
//         }
//       }

//       // 2. Проверка подписки (db должен быть доступен в этом контексте)
//       const hasSub = await checkSubscription(ctx.from.id, db);

//       // 3. Формирование динамической клавиатуры
//       const menuButtons = [
//         [{
//           text: '🌐 Открыть PeaceYourGun 🥕 в WebApp', 
//           web_app: { url: process.env.WEBAPP_URL }
//         }]
//       ];

//       // 4. Добавляем кнопку "Все страны" только для подписчиков
//       if (hasSub) {
//         menuButtons.push([{ 
//           text: "🌍 Все страны", 
//           callback_data: "all_countries" 
//         }]);
//       }

//       // 5. Общие кнопки для всех пользователей
//       menuButtons.push(
//         [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
//         [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
//       );

//       // 6. Отправка меню
//       const menu = await ctx.reply("Главное меню:", {
//         reply_markup: { inline_keyboard: menuButtons },
//       });

//       // 7. Сохранение в хранилище
//       chatStorage.mainMenu.set(chatId, menu.message_id);
//       self.track(chatId, menu.message_id);

//     } catch (error) {
//       console.error("Ошибка отправки меню:", error);
//       throw error;
//     }
//   });
// },
//     // sendMainMenu: async function (ctx) {
//     //   return messageQueue.add(async () => {
//     //     const chatId = ctx.chat.id;
//     //     const self = this;

//     //     try {
//     //       // Удаляем старое меню если есть
//     //       if (chatStorage.mainMenu.has(chatId)) {
//     //         try {
//     //           await ctx.telegram.deleteMessage(
//     //             chatId,
//     //             chatStorage.mainMenu.get(chatId)
//     //           );
//     //           chatStorage.messages
//     //             .get(chatId)
//     //             ?.delete(chatStorage.mainMenu.get(chatId));
//     //           chatStorage.messageTimestamps.delete(
//     //             chatStorage.mainMenu.get(chatId)
//     //           );
//     //         } catch (e) {
//     //           if (e.response?.error_code !== 400) {
//     //             console.error("Ошибка удаления меню:", e);
//     //           }
//     //         }
//     //       }

//     //       const menu = await ctx.reply("Главное меню:", {
//     //         reply_markup: {
//     //           inline_keyboard: [
//     //             [{
//     //               text: '🌐 Открыть PeaceYourGun 🥕 в WebApp',
//     //               web_app: { url: process.env.WEBAPP_URL }
//     //             }],
//     //             [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//     //             [
//     //               {
//     //                 text: "🎂 Фильтр по возрасту",
//     //                 callback_data: "filter_by_age",
//     //               },
//     //             ],
//     //             [{ text: "❌ Очистить экран", callback_data: "clear_screen" }],
//     //           ],
//     //         },
//     //       });

//     //       chatStorage.mainMenu.set(chatId, menu.message_id);
//     //       self.track(chatId, menu.message_id);
//     //     } catch (error) {
//     //       console.error("Ошибка отправки меню:", error);
//     //       throw error;
//     //     }
//     //   });
//     // },

//     sendCountriesKeyboard: async function (ctx) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старую клавиатуру стран если есть
//           if (chatStorage.countryKeyboard.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(
//                 chatId,
//                 chatStorage.countryKeyboard.get(chatId)
//               );
//               chatStorage.messages
//                 .get(chatId)
//                 ?.delete(chatStorage.countryKeyboard.get(chatId));
//               chatStorage.messageTimestamps.delete(
//                 chatStorage.countryKeyboard.get(chatId)
//               );
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error("Ошибка удаления клавиатуры стран:", e);
//               }
//             }
//           }

//           // Получаем список уникальных стран из базы
//           const uniqueCountries = await getUniqueCountries();

//           // Если стран нет или слишком много, показываем только популярные
//           const countriesToShow =
//             uniqueCountries.length > 0 && uniqueCountries.length <= 50
//               ? uniqueCountries
//               : POPULAR_COUNTRIES.map((c) => c.name);

//           // Формируем клавиатуру
//           const keyboard = [];
//           let row = [];

//           // Добавляем страны с флагами
//           countriesToShow.forEach((country, index) => {
//             const countryWithFlag = formatCountryWithFlag(country);
//             row.push({
//               text: countryWithFlag,
//               callback_data: `country_${country}`,
//             });

//             // Разбиваем на строки по 3 кнопки
//             if (row.length === 3 || index === countriesToShow.length - 1) {
//               keyboard.push(row);
//               row = [];
//             }
//           });

//           // Добавляем кнопку "Назад"
//           keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

//           const msg = await ctx.reply("Выберите страну:", {
//             reply_markup: { inline_keyboard: keyboard },
//           });

//           chatStorage.countryKeyboard.set(chatId, msg.message_id);
//           self.track(chatId, msg.message_id);
//         } catch (error) {
//           console.error("Ошибка отправки клавиатуры стран:", error);
//           throw error;
//         }
//       });
//     },

//     sendCitiesKeyboard: async function (ctx, country) {
//       return messageQueue.add(async () => {
//         const chatId = ctx.chat.id;
//         const self = this;

//         try {
//           // Удаляем старую клавиатуру городов если есть
//           if (chatStorage.cityKeyboard.has(chatId)) {
//             try {
//               await ctx.telegram.deleteMessage(
//                 chatId,
//                 chatStorage.cityKeyboard.get(chatId)
//               );
//               chatStorage.messages
//                 .get(chatId)
//                 ?.delete(chatStorage.cityKeyboard.get(chatId));
//               chatStorage.messageTimestamps.delete(
//                 chatStorage.cityKeyboard.get(chatId)
//               );
//             } catch (e) {
//               if (e.response?.error_code !== 400) {
//                 console.error("Ошибка удаления клавиатуры городов:", e);
//               }
//             }
//           }

//           // Получаем список уникальных городов для страны
//           const cities = await getUniqueCitiesForCountry(country);

//           // Формируем клавиатуру
//           const keyboard = [];
//           let row = [];

//           // Добавляем города
//           cities.forEach((city, index) => {
//             row.push({
//               text: city,
//               callback_data: `city_${city}`,
//             });

//             // Разбиваем на строки по 3 кнопки
//             if (row.length === 3 || index === cities.length - 1) {
//               keyboard.push(row);
//               row = [];
//             }
//           });

//           // Добавляем кнопки фильтров и возврата
//           keyboard.push([
//             { text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" },
//           ]);
//           keyboard.push([
//             { text: "🔙 Назад к странам", callback_data: "back_to_countries" },
//           ]);

//           const msg = await ctx.reply(`Города в ${country}:`, {
//             reply_markup: { inline_keyboard: keyboard },
//           });

//           chatStorage.cityKeyboard.set(chatId, msg.message_id);
//           self.track(chatId, msg.message_id);
//         } catch (error) {
//           console.error("Ошибка отправки клавиатуры городов:", error);
//           throw error;
//         }
//       });
//     },
//   };

//   // Обработчики команд
//   bot.command("start", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка команды start:", error);
//       }
//     });
//   });

//   bot.action("show_profiles", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await ctx.answerCbQuery("Загружаем анкеты...");

//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = null;
//         ctx.session.displayCountry = null;
//         ctx.session.ageRange = null;
//         ctx.session.filterCity = null;

//         console.log("Starting profiles load", {
//           cache: profilesCache.data ? "exists" : "empty",
//           cacheAge: Date.now() - profilesCache.timestamp,
//         });

//         await messageManager.clear(ctx);

//         if (
//           !profilesCache.data ||
//           Date.now() - profilesCache.timestamp > CACHE_TTL
//         ) {
//           profilesCache.clear();
//         }
//         const profiles = await getProfilesPage(0);

//         if (!profiles.length) {
//           const msg = await ctx.reply("Анкет нет, попробуйте позже");
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return;
//         }

//         // Отправляем все анкеты на странице
//         for (let i = 0; i < profiles.length; i++) {
//           const isLast = i === profiles.length - 1;
//           await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//           if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//         }

//         await messageManager.sendMainMenu(ctx);
//       } catch (error) {
//         console.error("Ошибка показа анкет:", error);
//         try {
//           await ctx.answerCbQuery("Ошибка загрузки");
//           const msg = await ctx.reply(
//             "Ошибка загрузки анкет, попробуйте ещё раз"
//           );
//           messageManager.track(ctx.chat.id, msg.message_id);
//         } catch (e) {
//           console.error("Дополнительная ошибка:", e);
//         }
//       }
//     });
//   });
// bot.action("all_countries", async (ctx) => {
//     try {
//         // 1. Проверяем подписку
//         const hasSub = await checkSubscription(ctx.from.id, db);
        
//         // 2. Если подписки нет - показываем сообщение и выходим
//         if (!hasSub) {
//             await ctx.answerCbQuery("❌ Требуется активная подписка");
//             return;
//         }
        
//         // 3. Если подписка есть - выполняем основной код
//         await ctx.answerCbQuery("Загружаем список стран...");
        
//         return messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await messageManager.sendCountriesKeyboard(ctx);
//             } catch (error) {
//                 console.error("Ошибка обработки списка стран:", error);
//                 await ctx.answerCbQuery("Ошибка загрузки");
//             }
//         });
        
//     } catch (error) {
//         console.error("Ошибка в обработчике all_countries:", error);
//         await ctx.answerCbQuery("Произошла ошибка");
//     }
// });
//   // bot.action("all_countries", async (ctx) => {
    
//   //   await messageQueue.add(async () => {
//   //     try {
//   //       await messageManager.clear(ctx);
//   //       await messageManager.sendCountriesKeyboard(ctx);
//   //       await ctx.answerCbQuery();
//   //     } catch (error) {
//   //       console.error("Ошибка обработки списка стран:", error);
//   //     }
//   //   });
//   // });

//   // Обработчик выбора страны из списка
//   bot.action(/^country_(.+)$/, async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         const country = ctx.match[1];
//         ctx.session = ctx.session || {};
//         ctx.session.profilesPage = 0;
//         ctx.session.filterCountry = country;
//         ctx.session.displayCountry = country;
//         ctx.session.filterCity = null;

//         await messageManager.clear(ctx);
//         await messageManager.sendCitiesKeyboard(ctx, country);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка обработки выбора страны:", error);
//       }
//     });
//   });

//   // Обработчик выбора города из списка
// bot.action(/^city_(.+)$/, async (ctx) => {
//   await messageQueue.add(async () => {
//     try {
//       const city = ctx.match[1];
//       ctx.session = ctx.session || {};
//       ctx.session.profilesPage = 0;
//       ctx.session.filterCity = city;

//       // Очищаем, но сохраняем клавиатуру городов
//       await messageManager.clear(ctx, true);

//       // Отправляем главное меню внизу
//       await messageManager.sendMainMenu(ctx);

//       const profiles = await getProfilesPage(
//         0,
//         ctx.session.filterCountry,
//         ctx.session.ageRange,
//         city
//       );

//       if (!profiles.length) {
//         const msg = await ctx.reply(`Анкет из города "${city}" не найдено`);
//         messageManager.track(ctx.chat.id, msg.message_id);
//         return;
//       }

//       // Отправляем анкеты
//       for (let i = 0; i < profiles.length; i++) {
//         const isLast = i === profiles.length - 1;
//         await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//         if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//       }
//     } catch (error) {
//       console.error("Ошибка обработки выбора города:", error);
//     }
//   });
// });
  
//   bot.action("back_to_countries", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendCountriesKeyboard(ctx);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка возврата к странам:", error);
//       }
//     });
//   });

//   // Обработчик кнопки "Назад" из клавиатуры стран
//   bot.action("back_to_menu", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await messageManager.sendMainMenu(ctx);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка возврата в меню:", error);
//       }
//     });
//   });

//   // Поиск по стране через ввод текста
//   bot.action("search_by_country", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         chatStorage.userState.set(ctx.from.id, "awaiting_country");
//         const msg = await ctx.reply("Введите страну для поиска:");
//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка поиска:", error);
//       }
//     });
//   });

//   // Фильтр по возрасту
//   bot.action("filter_by_age", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);

//         const keyboard = AGE_RANGES.map((range) => [
//           { text: range.label, callback_data: `age_range_${range.label}` },
//         ]);
//         keyboard.push([
//           { text: "❌ Сбросить фильтр", callback_data: "age_range_reset" },
//         ]);

//         const msg = await ctx.reply("Выберите возрастной диапазон:", {
//           reply_markup: { inline_keyboard: keyboard },
//         });

//         messageManager.track(ctx.chat.id, msg.message_id);
//         await ctx.answerCbQuery();
//       } catch (error) {
//         console.error("Ошибка фильтра по возрасту:", error);
//       }
//     });
//   });


//   // Обработчик выбора возрастного диапазона
// bot.action(/^age_range_(.+)$/, async (ctx) => {
//   await messageQueue.add(async () => {
//     try {
//       const [_, range] = ctx.match;
//       ctx.session = ctx.session || {};
//       ctx.session.profilesPage = 0;

//       if (range === "reset") {
//         ctx.session.ageRange = null;
//       } else {
//         const selectedRange = AGE_RANGES.find((r) => r.label === range);
//         if (selectedRange) {
//           ctx.session.ageRange = selectedRange;
//         }
//       }

//       // Сохраняем текущий город и страну перед очисткой
//       const currentCountry = ctx.session.filterCountry;
//       const currentCity = ctx.session.filterCity;

//       // Очищаем, но сохраняем клавиатуру городов если есть
//       await messageManager.clear(ctx, true);

//       // Если была выбрана страна, но не город - показываем города снова
//       if (currentCountry && !currentCity) {
//         await messageManager.sendCitiesKeyboard(ctx, currentCountry);
//       }

//       // Загружаем анкеты с учетом всех текущих фильтров
//       const profiles = await getProfilesPage(
//         0,
//         currentCountry,
//         ctx.session.ageRange,
//         currentCity
//       );

//       if (!profiles.length) {
//         const msg = await ctx.reply("Анкет нет, попробуйте изменить фильтры");
//         messageManager.track(ctx.chat.id, msg.message_id);
//         return;
//       }

//       // Отправляем анкеты
//       for (let i = 0; i < profiles.length; i++) {
//         const isLast = i === profiles.length - 1;
//         await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//         if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//       }

//       // Если был выбран город - оставляем главное меню
//       if (currentCity) {
//         await messageManager.sendMainMenu(ctx);
//       }
//     } catch (error) {
//       console.error("Ошибка обработки возрастного диапазона:", error);
//     }
//   });
// });

//   // Обработчик ввода страны
//   bot.on("text", async (ctx) => {
//     const userId = ctx.from.id;
//     if (chatStorage.userState.get(userId) === "awaiting_country") {
//       await messageQueue.add(async () => {
//         try {
//           messageManager.track(ctx.chat.id, ctx.message.message_id);
//           const countryInput = ctx.message.text.trim();

//           if (!countryInput) {
//             const msg = await ctx.reply("Вы не указали страну");
//             messageManager.track(ctx.chat.id, msg.message_id);
//             return;
//           }

//           await messageManager.clear(ctx);
//           ctx.session = ctx.session || {};
//           ctx.session.profilesPage = 0;

//           const profiles = await getProfilesPage(
//             0,
//             countryInput,
//             ctx.session.ageRange
//           );

//           let normalizedCountry = null;
//           if (profiles.length > 0) {
//             normalizedCountry = profiles[0].country;
//           } else if (countryInput.toLowerCase() === "рос") {
//             normalizedCountry = "Россия";
//           } else {
//             normalizedCountry = countryInput;
//           }

//           ctx.session.filterCountry = countryInput;
//           ctx.session.displayCountry = normalizedCountry;

//           if (profiles.length) {
//             for (let i = 0; i < profiles.length; i++) {
//               const isLast = i === profiles.length - 1;
//               await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//               if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//             }
//           } else {
//             const msg = await ctx.reply(
//               `Анкет из "${normalizedCountry}" не найдено`
//             );
//             messageManager.track(ctx.chat.id, msg.message_id);
//           }

//           await messageManager.sendMainMenu(ctx);
//         } catch (error) {
//           console.error("Ошибка обработки страны:", error);
//         }
//       });
//     }
//   });

//   // Пагинация
//  bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
//   await messageQueue.add(async () => {
//     try {
//       const [_, action, currentPage] = ctx.match;
//       let newPage = parseInt(currentPage);

//       if (action === "first") newPage = 0;
//       else if (action === "prev") newPage = Math.max(0, newPage - 1);
//       else if (action === "next") newPage = newPage + 1;
//       else if (action === "last")
//         newPage = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE) - 1;
//       else newPage = parseInt(action);

//       // Очищаем, но сохраняем клавиатуру городов
//       await messageManager.clear(ctx, true);
      
//       ctx.session = ctx.session || {};
//       const profiles = await getProfilesPage(
//         newPage,
//         ctx.session.filterCountry,
//         ctx.session.ageRange,
//         ctx.session.filterCity
//       );

//       if (profiles.length) {
//         ctx.session.profilesPage = newPage;

//         for (let i = 0; i < profiles.length; i++) {
//           const isLast = i === profiles.length - 1;
//           await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast);
//           if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//         }
//       } else {
//         const msg = await ctx.reply("Больше анкет нет");
//         messageManager.track(ctx.chat.id, msg.message_id);
//       }
//     } catch (error) {
//       console.error("Ошибка пагинации:", error);
//     }
//   });
// });

//   // Очистка экрана
//   bot.action("clear_screen", async (ctx) => {
//     await messageQueue.add(async () => {
//       try {
//         await messageManager.clear(ctx);
//         await ctx.answerCbQuery("Экран очищен");
//       } catch (error) {
//         console.error("Ошибка очистки:", error);
//         await ctx.answerCbQuery("Ошибка при очистке");
//       }
//     });
//   });
// const sendProfile = async (ctx, profile, page, total, isLast) => {
//   return messageQueue.add(async () => {
//     try {
//       // Форматируем текст анкеты
//       const about = profile.about?.length > MAX_CAPTION_LENGTH
//         ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + "..."
//         : profile.about || "";

//       // Функция для форматирования Telegram ссылки
//       const formatTelegram = (username) => {
//         if (!username) return "";
//         if (username.startsWith("https://t.me/")) {
//           const cleaned = decodeURIComponent(username)
//             .replace("https://t.me/", "")
//             .replace(/^%40/, "@")
//             .replace(/^\+/, "");
//           return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
//         }
//         const cleaned = username.replace(/^[@+]/, "");
//         return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
//       };

//       // Функция для форматирования телефона
//       const formatPhone = (phone) => {
//         if (!phone) return "";
//         const cleanPhone = phone.replace(/[^0-9+]/g, "");
//         return `📞 <a href="tel:${cleanPhone}">${phone}</a>`;
//       };

//       // Функция для форматирования WhatsApp ссылки
//       const formatWhatsApp = (url) => {
//         if (!url) return "";
//         return `📱 <a href="${url}">WhatsApp</a>`;
//       };

//       // Формируем основное сообщение анкеты
//       const caption = `
// 👤 <b>${profile.name}</b>, ${profile.age}\n\n
// ${profile.country}\n
// 📍 ${profile.city}\n
// <em>${about}</em>\n
// ${profile.phone ? formatPhone(profile.phone) + "\n" : ""}
// ${profile.telegram ? formatTelegram(profile.telegram) + "\n" : ""}
// ${profile.whatsapp ? formatWhatsApp(profile.whatsapp) + "\n" : ""}
// ⚠🚨 <b>НЕ платите вперед с помощью Transcash, билетов PCS, Neosurf, BITCOIN или любых других способов оплаты. Предложения по предоплате – это в основном лохотрон! Пожалуйста, сообщите нам о таких профилях❗</b>`.trim();

//       // Формируем клавиатуру только для последней анкеты на странице
//       let keyboard = [];
//       if (isLast) {
//         const totalPages = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE);
        
//         // 1. Создаем строку пагинации
//         const paginationRow = [];
//         if (page > 0) {
//           paginationRow.push({ text: "⏪", callback_data: `page_first_${page}` });
//           paginationRow.push({ text: "◀️", callback_data: `page_prev_${page}` });
//         }
        
//         paginationRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "page_info" });
        
//         if (page < totalPages - 1) {
//           paginationRow.push({ text: "▶️", callback_data: `page_next_${page}` });
//           paginationRow.push({ text: "⏩", callback_data: `page_last_${page}` });
//         }
        
//         keyboard.push(paginationRow);

//         // 2. Добавляем быстрые страницы если нужно
//         if (totalPages > 3) {
//           const quickPagesRow = [];
//           const maxQuickPages = Math.min(5, totalPages);
//           const startPage = Math.max(
//             0,
//             Math.min(page - Math.floor(maxQuickPages / 2), totalPages - maxQuickPages)
//           );

//           for (let i = 0; i < maxQuickPages; i++) {
//             const p = startPage + i;
//             if (p >= 0 && p < totalPages) {
//               quickPagesRow.push({
//                 text: p === page ? `• ${p + 1} •` : `${p + 1}`,
//                 callback_data: `page_${p}_${page}`,
//               });
//             }
//           }
//           keyboard.push(quickPagesRow);
//         }

//         // 3. Добавляем строку с активными фильтрами
//         if (ctx.session?.displayCountry || ctx.session?.ageRange?.label || ctx.session?.filterCity) {
//           let filtersText = "🔹 ";
//           if (ctx.session.displayCountry) filtersText += `Страна: ${ctx.session.displayCountry}`;
//           if (ctx.session.filterCity) {
//             if (ctx.session.displayCountry) filtersText += ", ";
//             filtersText += `Город: ${ctx.session.filterCity}`;
//           }
//           if (ctx.session.ageRange?.label) {
//             if (ctx.session.displayCountry || ctx.session.filterCity) filtersText += ", ";
//             filtersText += `Возраст: ${ctx.session.ageRange.label}`;
//           }
//           keyboard.push([{ text: filtersText, callback_data: "filters_info" }]);
//         }

//         // 4. Добавляем главное меню под пагинацией
//         keyboard.push(
//           [{ text: "🌐 Открыть PeaceYourGun 🥕 в WebApp", web_app: { url: process.env.WEBAPP_URL } }],
//           [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//           [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
//           [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
//         );
//       }

//       // Пытаемся отправить с фото
//       try {
//         const msg = await ctx.replyWithPhoto(profile.photoUrl, {
//           caption,
//           parse_mode: "HTML",
//           reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//         });
//         messageManager.track(ctx.chat.id, msg.message_id);
//         return msg;
//       } catch (e) {
//         // Если не удалось с фото, отправляем только текст
//         const msg = await ctx.reply(caption, {
//           parse_mode: "HTML",
//           reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//         });
//         messageManager.track(ctx.chat.id, msg.message_id);
//         return msg;
//       }
//     } catch (error) {
//       console.error("Ошибка отправки анкеты:", error);
//       return null;
//     }
//   });
// };
  
// };

const RateLimiter = require("telegraf-ratelimit");
const { default: PQueue } = require("p-queue");

// Настройка очереди для отправки сообщений
const messageQueue = new PQueue({
  concurrency: 5,
  interval: 1000,
  intervalCap: 5,
});

// Время жизни сообщений в хранилище (24 часа)
const MESSAGE_TTL = 86400000;

module.exports = (bot, db) => {
  // Конфигурация
  const PROFILES_PER_PAGE = 5;
  const MAX_CAPTION_LENGTH = 900;
  const CACHE_TTL = 300000;
  const AGE_RANGES = [
    { label: "18-25", min: 18, max: 25 },
    { label: "26-35", min: 26, max: 35 },
    { label: "36-45", min: 36, max: 45 },
    { label: "46+", min: 46, max: 999 },
  ];


// Добавляем после объявления констант (PROFILES_PER_PAGE, MAX_CAPTION_LENGTH и т.д.)
const checkSubscription = async (userId, db) => {
    try {
        const subRef = db.collection('subscriptions').doc(userId.toString());
        const doc = await subRef.get();
        
        if (!doc.exists) return false;
        
        const subData = doc.data();
        return subData.isActive && subData.endDate.toDate() > new Date();
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        return false;
    }
};
  // Список популярных стран с эмодзи флагами
  const POPULAR_COUNTRIES = [
    { name: "Россия", flag: "🇷🇺" },
    { name: "Украина", flag: "🇺🇦" },
    { name: "Беларусь", flag: "🇧🇾" },
    { name: "Казахстан", flag: "🇰🇿" },
    { name: "США", flag: "🇺🇸" },
    { name: "Германия", flag: "🇩🇪" },
    { name: "Франция", flag: "🇫🇷" },
    { name: "Италия", flag: "🇮🇹" },
    { name: "Испания", flag: "🇪🇸" },
    { name: "Турция", flag: "🇹🇷" },
    { name: "Китай", flag: "🇨🇳" },
    { name: "Япония", flag: "🇯🇵" },
    { name: "Великобритания", flag: "🇬🇧" },
    { name: "Польша", flag: "🇵🇱" },
    { name: "Израиль", flag: "🇮🇱" },
    { name: "ОАЭ", flag: "🇦🇪" },
    { name: "Таиланд", flag: "🇹🇭" },
    { name: "Индия", flag: "🇮🇳" },
    { name: "Бразилия", flag: "🇧🇷" },
    { name: "Канада", flag: "🇨🇦" },
    // Дополнительные страны
    { name: "Австралия", flag: "🇦🇺" },
    { name: "Новая Зеландия", flag: "🇳🇿" },
    { name: "Мексика", flag: "🇲🇽" },
    { name: "Аргентина", flag: "🇦🇷" },
    { name: "Чили", flag: "🇨🇱" },
    { name: "Колумбия", flag: "🇨🇴" },
    { name: "Перу", flag: "🇵🇪" },
    { name: "Венесуэла", flag: "🇻🇪" },
    { name: "Куба", flag: "🇨🇺" },
    { name: "Южная Корея", flag: "🇰🇷" },
    { name: "Индонезия", flag: "🇮🇩" },
    { name: "Вьетнам", flag: "🇻🇳" },
    { name: "Малайзия", flag: "🇲🇾" },
    { name: "Филиппины", flag: "🇵🇭" },
    { name: "Сингапур", flag: "🇸🇬" },
    { name: "Саудовская Аравия", flag: "🇸🇦" },
    { name: "Катар", flag: "🇶🇦" },
    { name: "Кувейт", flag: "🇰🇼" },
    { name: "Иран", flag: "🇮🇷" },
    { name: "Ирак", flag: "🇮🇶" },
    { name: "Азербайджан", flag: "🇦🇿" },
    { name: "Армения", flag: "🇦🇲" },
    { name: "Грузия", flag: "🇬🇪" },
    { name: "Молдова", flag: "🇲🇩" },
    { name: "Латвия", flag: "🇱🇻" },
    { name: "Литва", flag: "🇱🇹" },
    { name: "Эстония", flag: "🇪🇪" },
    { name: "Финляндия", flag: "🇫🇮" },
    { name: "Швеция", flag: "🇸🇪" },
    { name: "Норвегия", flag: "🇳🇴" },
    { name: "Дания", flag: "🇩🇰" },
    { name: "Нидерланды", flag: "🇳🇱" },
    { name: "Бельгия", flag: "🇧🇪" },
    { name: "Швейцария", flag: "🇨🇭" },
    { name: "Австрия", flag: "🇦🇹" },
    { name: "Чехия", flag: "🇨🇿" },
    { name: "Словакия", flag: "🇸🇰" },
    { name: "Венгрия", flag: "🇭🇺" },
    { name: "Румыния", flag: "🇷🇴" },
    { name: "Болгария", flag: "🇧🇬" },
    { name: "Сербия", flag: "🇷🇸" },
    { name: "Хорватия", flag: "🇭🇷" },
    { name: "Греция", flag: "🇬🇷" },
    { name: "Португалия", flag: "🇵🇹" },
    { name: "Ирландия", flag: "🇮🇪" },
    { name: "Исландия", flag: "🇮🇸" },
    { name: "Мальта", flag: "🇲🇹" },
    { name: "Кипр", flag: "🇨🇾" },
    { name: "Люксембург", flag: "🇱🇺" },
    { name: "Афганистан", flag: "🇦🇫" },
    { name: "Пакистан", flag: "🇵🇰" },
    { name: "Бангладеш", flag: "🇧🇩" },
    { name: "Шри-Ланка", flag: "🇱🇰" },
    { name: "Непал", flag: "🇳🇵" },
  ];

  // Инициализация rate-limiter
  const limiter = new RateLimiter({
    window: 1000,
    limit: 3,
    onLimitExceeded: (ctx) =>
      ctx.reply("⚠️ Слишком много запросов, подождите секунду..."),
  });

  bot.use(limiter);

  // Система хранения сообщений
  const chatStorage = {
    messages: new Map(), // chatId: Set(messageIds)
    mainMenu: new Map(), // chatId: messageId
    userState: new Map(), // userId: state
    messageTimestamps: new Map(), // messageId: timestamp
    countryKeyboard: new Map(), // chatId: messageId (для хранения сообщения с клавиатурой стран)
    cityKeyboard: new Map(), // chatId: messageId (для хранения сообщения с клавиатурой городов)
  };

  // Очистка старых сообщений каждые 6 часов
  setInterval(() => {
    const now = Date.now();
    for (const [chatId, messages] of chatStorage.messages) {
      for (const messageId of messages) {
        if (
          now - (chatStorage.messageTimestamps.get(messageId) || 0) >
          MESSAGE_TTL
        ) {
          messages.delete(messageId);
          chatStorage.messageTimestamps.delete(messageId);
        }
      }
    }
  }, 21600000);

  // Кэш данных
  const profilesCache = {
    data: null,
    timestamp: 0,
    countryFilter: null,
    ageFilter: null,
    cityFilter: null,
    clear: function () {
      this.data = null;
      this.timestamp = 0;
      this.countryFilter = null;
      this.ageFilter = null;
      this.cityFilter = null;
    },
  };

  // Получение анкет с фильтрацией по стране и городу
  const getProfilesPage = async (
    page = 0,
    searchCountry = null,
    ageRange = null,
    searchCity = null
  ) => {
    try {
      const now = Date.now();
      const cacheKey = `${searchCountry || "all"}_${
        ageRange ? ageRange.label : "all"
      }_${searchCity || "all"}`;

      if (
        profilesCache.data &&
        now - profilesCache.timestamp < CACHE_TTL &&
        profilesCache.countryFilter === (searchCountry || null) &&
        profilesCache.ageFilter === (ageRange ? ageRange.label : null) &&
        profilesCache.cityFilter === (searchCity || null)
      ) {
        return profilesCache.data.slice(
          page * PROFILES_PER_PAGE,
          (page + 1) * PROFILES_PER_PAGE
        );
      }

      const snapshot = await db
        .collection("profiles")
        .orderBy("createdAt", "desc")
        .get();

      let profiles = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Фильтрация по стране
      if (searchCountry) {
        const searchTerm = searchCountry.toLowerCase().trim();
        profiles = profiles.filter((profile) => {
          const profileCountry = profile.country?.toLowerCase() || "";
          return (
            profileCountry.includes(searchTerm) ||
            (searchTerm === "рос" && profileCountry.includes("россия"))
          );
        });
      }

      // Фильтрация по возрасту
      if (ageRange) {
        profiles = profiles.filter((profile) => {
          const age = parseInt(profile.age) || 0;
          return age >= ageRange.min && age <= ageRange.max;
        });
      }

      // Фильтрация по городу
      if (searchCity) {
        const searchTerm = searchCity.toLowerCase().trim();
        profiles = profiles.filter((profile) => {
          const profileCity = profile.city?.toLowerCase() || "";
          return profileCity.includes(searchTerm);
        });
      }

      profilesCache.data = profiles;
      profilesCache.timestamp = now;
      profilesCache.countryFilter = searchCountry || null;
      profilesCache.ageFilter = ageRange ? ageRange.label : null;
      profilesCache.cityFilter = searchCity || null;

      return profiles.slice(
        page * PROFILES_PER_PAGE,
        (page + 1) * PROFILES_PER_PAGE
      );
    } catch (error) {
      console.error("Ошибка загрузки анкет:", error);
      profilesCache.clear();
      return [];
    }
  };

  // Получение списка уникальных стран из базы данных
  const getUniqueCountries = async () => {
    try {
      const snapshot = await db.collection("profiles").orderBy("country").get();

      const countries = new Set();
      snapshot.docs.forEach((doc) => {
        const country = doc.data().country;
        if (country) countries.add(country);
      });

      return Array.from(countries).sort();
    } catch (error) {
      console.error("Ошибка получения списка стран:", error);
      return [];
    }
  };

  // Получение списка уникальных городов для страны
  const getUniqueCitiesForCountry = async (country) => {
    try {
      const snapshot = await db
        .collection("profiles")
        .where("country", "==", country)
        .orderBy("city")
        .get();

      const cities = new Set();
      snapshot.docs.forEach((doc) => {
        const city = doc.data().city;
        if (city) cities.add(city);
      });

      return Array.from(cities).sort();
    } catch (error) {
      console.error("Ошибка получения списка городов:", error);
      return [];
    }
  };

  // Форматирование названия страны с добавлением флага (если есть в списке популярных)
  const formatCountryWithFlag = (countryName) => {
    if (!countryName) return countryName;

    const foundCountry = POPULAR_COUNTRIES.find(
      (c) => c.name.toLowerCase() === countryName.toLowerCase()
    );

    return foundCountry ? `${foundCountry.flag} ${countryName}` : countryName;
  };

  // Система управления сообщениями
  const messageManager = {
    track: function (chatId, messageId) {
      if (!messageId) return;
      if (!chatStorage.messages.has(chatId)) {
        chatStorage.messages.set(chatId, new Set());
      }
      chatStorage.messages.get(chatId).add(messageId);
      chatStorage.messageTimestamps.set(messageId, Date.now());
    },


clear: async function (ctx, keepCityKeyboard = false, keepCountryKeyboard = false) {
  const chatId = ctx.chat.id;
  if (!chatStorage.messages.has(chatId)) return;

  const messages = [...chatStorage.messages.get(chatId)];
  const mainMenuId = chatStorage.mainMenu.get(chatId);
  const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
  const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

  for (const messageId of messages) {
    if (
      messageId !== mainMenuId &&
      messageId !== countryKeyboardId &&
      messageId !== cityKeyboardId
    ) {
      try {
        await ctx.telegram.deleteMessage(chatId, messageId);
        chatStorage.messages.get(chatId).delete(messageId);
        chatStorage.messageTimestamps.delete(messageId);
      } catch (e) {
        if (e.response?.error_code !== 400) {
          console.error(`Ошибка удаления ${messageId}:`, e.message);
        }
      }
    }
  }

  // Удаляем клавиатуру городов только если явно указано
  if (cityKeyboardId && !keepCityKeyboard) {
    try {
      await ctx.telegram.deleteMessage(chatId, cityKeyboardId);
      chatStorage.messages.get(chatId).delete(cityKeyboardId);
      chatStorage.messageTimestamps.delete(cityKeyboardId);
      chatStorage.cityKeyboard.delete(chatId);
    } catch (e) {
      if (e.response?.error_code !== 400) {
        console.error("Ошибка удаления клавиатуры городов:", e);
      }
    }
  }

  // Удаляем клавиатуру стран если явно указано
  if (countryKeyboardId && !keepCountryKeyboard) {
    try {
      await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
      chatStorage.messages.get(chatId).delete(countryKeyboardId);
      chatStorage.messageTimestamps.delete(countryKeyboardId);
      chatStorage.countryKeyboard.delete(chatId);
    } catch (e) {
      if (e.response?.error_code !== 400) {
        console.error("Ошибка удаления клавиатуры стран:", e);
      }
    }
  }

  chatStorage.userState.delete(ctx.from.id);
},

sendMainMenu: async function (ctx) {
  return messageQueue.add(async () => {
    const chatId = ctx.chat.id;
    const self = this;

    try {
      // 1. Удаление старого меню
      if (chatStorage.mainMenu.has(chatId)) {
        try {
          await ctx.telegram.deleteMessage(chatId, chatStorage.mainMenu.get(chatId));
          chatStorage.messages.get(chatId)?.delete(chatStorage.mainMenu.get(chatId));
          chatStorage.messageTimestamps.delete(chatStorage.mainMenu.get(chatId));
        } catch (e) {
          if (e.response?.error_code !== 400) {
            console.error("Ошибка удаления меню:", e);
          }
        }
      }

      // 2. Проверка подписки (db должен быть доступен в этом контексте)
      const hasSub = await checkSubscription(ctx.from.id, db);

      // 3. Формирование динамической клавиатуры
      const menuButtons = [
        [{
          text: '🌐 Открыть PeaceYourGun 🥕 в WebApp', 
          web_app: { url: process.env.WEBAPP_URL }
        }]
      ];

      // 4. Добавляем кнопку "Все страны" только для подписчиков
      if (hasSub) {
        menuButtons.push([{ 
          text: "🌍 Все страны", 
          callback_data: "all_countries" 
        }]);
      }

      // 5. Общие кнопки для всех пользователей
      menuButtons.push(
        [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
        [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
      );

      // 6. Отправка меню
      const menu = await ctx.reply("Главное меню:", {
        reply_markup: { inline_keyboard: menuButtons },
      });

      // 7. Сохранение в хранилище
      chatStorage.mainMenu.set(chatId, menu.message_id);
      self.track(chatId, menu.message_id);

    } catch (error) {
      console.error("Ошибка отправки меню:", error);
      throw error;
    }
  });
},
    
    sendCountriesKeyboard: async function (ctx) {
      return messageQueue.add(async () => {
        const chatId = ctx.chat.id;
        const self = this;

        try {
          // Удаляем старую клавиатуру стран если есть
          if (chatStorage.countryKeyboard.has(chatId)) {
            try {
              await ctx.telegram.deleteMessage(
                chatId,
                chatStorage.countryKeyboard.get(chatId)
              );
              chatStorage.messages
                .get(chatId)
                ?.delete(chatStorage.countryKeyboard.get(chatId));
              chatStorage.messageTimestamps.delete(
                chatStorage.countryKeyboard.get(chatId)
              );
            } catch (e) {
              if (e.response?.error_code !== 400) {
                console.error("Ошибка удаления клавиатуры стран:", e);
              }
            }
          }

          // Получаем список уникальных стран из базы
          const uniqueCountries = await getUniqueCountries();

          // Если стран нет или слишком много, показываем только популярные
          const countriesToShow =
            uniqueCountries.length > 0 && uniqueCountries.length <= 50
              ? uniqueCountries
              : POPULAR_COUNTRIES.map((c) => c.name);

          // Формируем клавиатуру
          const keyboard = [];
          let row = [];

          // Добавляем страны с флагами
          countriesToShow.forEach((country, index) => {
            const countryWithFlag = formatCountryWithFlag(country);
            row.push({
              text: countryWithFlag,
              callback_data: `country_${country}`,
            });

            // Разбиваем на строки по 3 кнопки
            if (row.length === 3 || index === countriesToShow.length - 1) {
              keyboard.push(row);
              row = [];
            }
          });

          // Добавляем кнопку "Назад"
          keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

          const msg = await ctx.reply("Выберите страну:", {
            reply_markup: { inline_keyboard: keyboard },
          });

          chatStorage.countryKeyboard.set(chatId, msg.message_id);
          self.track(chatId, msg.message_id);
        } catch (error) {
          console.error("Ошибка отправки клавиатуры стран:", error);
          throw error;
        }
      });
    },

    sendCitiesKeyboard: async function (ctx, country) {
      return messageQueue.add(async () => {
        const chatId = ctx.chat.id;
        const self = this;

        try {
          // Удаляем старую клавиатуру городов если есть
          if (chatStorage.cityKeyboard.has(chatId)) {
            try {
              await ctx.telegram.deleteMessage(
                chatId,
                chatStorage.cityKeyboard.get(chatId)
              );
              chatStorage.messages
                .get(chatId)
                ?.delete(chatStorage.cityKeyboard.get(chatId));
              chatStorage.messageTimestamps.delete(
                chatStorage.cityKeyboard.get(chatId)
              );
            } catch (e) {
              if (e.response?.error_code !== 400) {
                console.error("Ошибка удаления клавиатуры городов:", e);
              }
            }
          }

          // Получаем список уникальных городов для страны
          const cities = await getUniqueCitiesForCountry(country);

          // Формируем клавиатуру
          const keyboard = [];
          let row = [];

          // Добавляем города
          cities.forEach((city, index) => {
            row.push({
              text: city,
              callback_data: `city_${city}`,
            });

            // Разбиваем на строки по 3 кнопки
            if (row.length === 3 || index === cities.length - 1) {
              keyboard.push(row);
              row = [];
            }
          });

          // Добавляем кнопки фильтров и возврата
          keyboard.push([
            { text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" },
          ]);
          keyboard.push([
            { text: "🔙 Назад к странам", callback_data: "back_to_countries" },
          ]);

          const msg = await ctx.reply(`Города в ${country}:`, {
            reply_markup: { inline_keyboard: keyboard },
          });

          chatStorage.cityKeyboard.set(chatId, msg.message_id);
          self.track(chatId, msg.message_id);
        } catch (error) {
          console.error("Ошибка отправки клавиатуры городов:", error);
          throw error;
        }
      });
    },
  };

  // Обработчики команд
  bot.command("start", async (ctx) => {
    await messageQueue.add(async () => {
      try {
        await messageManager.clear(ctx);
        await messageManager.sendMainMenu(ctx);
      } catch (error) {
        console.error("Ошибка команды start:", error);
      }
    });
  });

  bot.action("show_profiles", async (ctx) => {
    await messageQueue.add(async () => {
      try {
        await ctx.answerCbQuery("Загружаем анкеты...");

        ctx.session = ctx.session || {};
        ctx.session.profilesPage = 0;
        ctx.session.filterCountry = null;
        ctx.session.displayCountry = null;
        ctx.session.ageRange = null;
        ctx.session.filterCity = null;

        console.log("Starting profiles load", {
          cache: profilesCache.data ? "exists" : "empty",
          cacheAge: Date.now() - profilesCache.timestamp,
        });

        await messageManager.clear(ctx);

        if (
          !profilesCache.data ||
          Date.now() - profilesCache.timestamp > CACHE_TTL
        ) {
          profilesCache.clear();
        }
        const profiles = await getProfilesPage(0);

        if (!profiles.length) {
          const msg = await ctx.reply("Анкет нет, попробуйте позже");
          messageManager.track(ctx.chat.id, msg.message_id);
          return;
        }

        // Отправляем все анкеты на странице
        for (let i = 0; i < profiles.length; i++) {
          const isLast = i === profiles.length - 1;
          await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
          if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
        }

        await messageManager.sendMainMenu(ctx);
      } catch (error) {
        console.error("Ошибка показа анкет:", error);
        try {
          await ctx.answerCbQuery("Ошибка загрузки");
          const msg = await ctx.reply(
            "Ошибка загрузки анкет, попробуйте ещё раз"
          );
          messageManager.track(ctx.chat.id, msg.message_id);
        } catch (e) {
          console.error("Дополнительная ошибка:", e);
        }
      }
    });
  });
bot.action("all_countries", async (ctx) => {
    try {
        // 1. Проверяем подписку
        const hasSub = await checkSubscription(ctx.from.id, db);
        
        // 2. Если подписки нет - показываем сообщение и выходим
        if (!hasSub) {
            await ctx.answerCbQuery("❌ Требуется активная подписка");
            return;
        }
        
        // 3. Если подписка есть - выполняем основной код
        await ctx.answerCbQuery("Загружаем список стран...");
        
        return messageQueue.add(async () => {
            try {
                await messageManager.clear(ctx);
                await messageManager.sendCountriesKeyboard(ctx);
            } catch (error) {
                console.error("Ошибка обработки списка стран:", error);
                await ctx.answerCbQuery("Ошибка загрузки");
            }
        });
        
    } catch (error) {
        console.error("Ошибка в обработчике all_countries:", error);
        await ctx.answerCbQuery("Произошла ошибка");
    }
});
  

  // Обработчик выбора страны из списка
  bot.action(/^country_(.+)$/, async (ctx) => {
    await messageQueue.add(async () => {
      try {
        const country = ctx.match[1];
        ctx.session = ctx.session || {};
        ctx.session.profilesPage = 0;
        ctx.session.filterCountry = country;
        ctx.session.displayCountry = country;
        ctx.session.filterCity = null;

        await messageManager.clear(ctx);
        await messageManager.sendCitiesKeyboard(ctx, country);
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("Ошибка обработки выбора страны:", error);
      }
    });
  });

  
  bot.action(/^city_(.+)$/, async (ctx) => {
  await messageQueue.add(async () => {
    try {
      const city = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.profilesPage = 0;
      ctx.session.filterCity = city;

      // Очищаем, но сохраняем клавиатуры городов и стран
      await messageManager.clear(ctx, true, true);

      // Отправляем главное меню внизу
      await messageManager.sendMainMenu(ctx);

      const profiles = await getProfilesPage(
        0,
        ctx.session.filterCountry,
        ctx.session.ageRange,
        city
      );

      if (!profiles.length) {
        const msg = await ctx.reply(`Анкет из города "${city}" не найдено`);
        messageManager.track(ctx.chat.id, msg.message_id);
        return;
      }

      // Отправляем анкеты
      for (let i = 0; i < profiles.length; i++) {
        const isLast = i === profiles.length - 1;
        await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
        if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error("Ошибка обработки выбора города:", error);
    }
  });
});
bot.action("back_to_countries", async (ctx) => {
  await messageQueue.add(async () => {
    try {
      // Очищаем, но сохраняем клавиатуру стран
      await messageManager.clear(ctx, false, true);
      await messageManager.sendCountriesKeyboard(ctx);
      await ctx.answerCbQuery();
    } catch (error) {
      console.error("Ошибка возврата к странам:", error);
    }
  });
});
  
  bot.action("back_to_menu", async (ctx) => {
    await messageQueue.add(async () => {
      try {
        await messageManager.clear(ctx);
        await messageManager.sendMainMenu(ctx);
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("Ошибка возврата в меню:", error);
      }
    });
  });

  // Поиск по стране через ввод текста
  bot.action("search_by_country", async (ctx) => {
    await messageQueue.add(async () => {
      try {
        chatStorage.userState.set(ctx.from.id, "awaiting_country");
        const msg = await ctx.reply("Введите страну для поиска:");
        messageManager.track(ctx.chat.id, msg.message_id);
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("Ошибка поиска:", error);
      }
    });
  });

  // Фильтр по возрасту
  // Фильтр по возрасту
bot.action("filter_by_age", async (ctx) => {
  await messageQueue.add(async () => {
    try {
      // Сохраняем ID клавиатур перед очисткой
      const chatId = ctx.chat.id;
      const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
      const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

      // Очищаем только ненужные сообщения, сохраняя клавиатуры
      await messageManager.clear(ctx, true, true);

      // Восстанавливаем ID клавиатур после очистки
      if (countryKeyboardId) {
        chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
      }
      if (cityKeyboardId) {
        chatStorage.cityKeyboard.set(chatId, cityKeyboardId);
      }

      // Создаем клавиатуру для выбора возраста
      const keyboard = AGE_RANGES.map((range) => [
        { text: range.label, callback_data: `age_range_${range.label}` },
      ]);
      keyboard.push([
        { text: "❌ Сбросить фильтр", callback_data: "age_range_reset" },
      ]);

      const msg = await ctx.reply("Выберите возрастной диапазон:", {
        reply_markup: { inline_keyboard: keyboard },
      });

      messageManager.track(ctx.chat.id, msg.message_id);
      await ctx.answerCbQuery();
    } catch (error) {
      console.error("Ошибка фильтра по возрасту:", error);
    }
  });
});


 
// В обработчике фильтра по возрасту:
bot.action(/^age_range_(.+)$/, async (ctx) => {
  await messageQueue.add(async () => {
    try {
      const [_, range] = ctx.match;
      ctx.session = ctx.session || {};
      ctx.session.profilesPage = 0;

      if (range === "reset") {
        ctx.session.ageRange = null;
      } else {
        const selectedRange = AGE_RANGES.find((r) => r.label === range);
        if (selectedRange) {
          ctx.session.ageRange = selectedRange;
        }
      }

      // Сохраняем текущий город и страну перед очисткой
      const currentCountry = ctx.session.filterCountry;
      const currentCity = ctx.session.filterCity;

      // Получаем ID клавиатур перед очисткой
      const chatId = ctx.chat.id;
      const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
      const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

      // Очищаем, но сохраняем клавиатуры городов и стран
      await messageManager.clear(ctx, true, true);

      // Восстанавливаем ID клавиатур после очистки
      if (countryKeyboardId) {
        chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
      }
      if (cityKeyboardId) {
        chatStorage.cityKeyboard.set(chatId, cityKeyboardId);
      }

      // Загружаем анкеты с учетом всех текущих фильтров
      const profiles = await getProfilesPage(
        0,
        currentCountry,
        ctx.session.ageRange,
        currentCity
      );

      if (!profiles.length) {
        const msg = await ctx.reply("Анкет нет, попробуйте изменить фильтры");
        messageManager.track(ctx.chat.id, msg.message_id);
        return;
      }

      // Отправляем анкеты
      for (let i = 0; i < profiles.length; i++) {
        const isLast = i === profiles.length - 1;
        await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
        if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Если была выбрана страна, но не город - показываем города снова
      if (currentCountry && !currentCity) {
        await messageManager.sendCitiesKeyboard(ctx, currentCountry);
      }

      // Если был выбран город - оставляем главное меню
      if (currentCity) {
        await messageManager.sendMainMenu(ctx);
      }
    } catch (error) {
      console.error("Ошибка обработки возрастного диапазона:", error);
    }
  });
});
  // Обработчик ввода страны
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    if (chatStorage.userState.get(userId) === "awaiting_country") {
      await messageQueue.add(async () => {
        try {
          messageManager.track(ctx.chat.id, ctx.message.message_id);
          const countryInput = ctx.message.text.trim();

          if (!countryInput) {
            const msg = await ctx.reply("Вы не указали страну");
            messageManager.track(ctx.chat.id, msg.message_id);
            return;
          }

          await messageManager.clear(ctx);
          ctx.session = ctx.session || {};
          ctx.session.profilesPage = 0;

          const profiles = await getProfilesPage(
            0,
            countryInput,
            ctx.session.ageRange
          );

          let normalizedCountry = null;
          if (profiles.length > 0) {
            normalizedCountry = profiles[0].country;
          } else if (countryInput.toLowerCase() === "рос") {
            normalizedCountry = "Россия";
          } else {
            normalizedCountry = countryInput;
          }

          ctx.session.filterCountry = countryInput;
          ctx.session.displayCountry = normalizedCountry;

          if (profiles.length) {
            for (let i = 0; i < profiles.length; i++) {
              const isLast = i === profiles.length - 1;
              await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
              if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
            }
          } else {
            const msg = await ctx.reply(
              `Анкет из "${normalizedCountry}" не найдено`
            );
            messageManager.track(ctx.chat.id, msg.message_id);
          }

          await messageManager.sendMainMenu(ctx);
        } catch (error) {
          console.error("Ошибка обработки страны:", error);
        }
      });
    }
  });

  // Пагинация
 bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
  await messageQueue.add(async () => {
    try {
      const [_, action, currentPage] = ctx.match;
      let newPage = parseInt(currentPage);

      if (action === "first") newPage = 0;
      else if (action === "prev") newPage = Math.max(0, newPage - 1);
      else if (action === "next") newPage = newPage + 1;
      else if (action === "last")
        newPage = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE) - 1;
      else newPage = parseInt(action);

      // Очищаем, но сохраняем клавиатуру городов
      await messageManager.clear(ctx, true);
      
      ctx.session = ctx.session || {};
      const profiles = await getProfilesPage(
        newPage,
        ctx.session.filterCountry,
        ctx.session.ageRange,
        ctx.session.filterCity
      );

      if (profiles.length) {
        ctx.session.profilesPage = newPage;

        for (let i = 0; i < profiles.length; i++) {
          const isLast = i === profiles.length - 1;
          await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast);
          if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } else {
        const msg = await ctx.reply("Больше анкет нет");
        messageManager.track(ctx.chat.id, msg.message_id);
      }
    } catch (error) {
      console.error("Ошибка пагинации:", error);
    }
  });
});

  // Очистка экрана
  bot.action("clear_screen", async (ctx) => {
    await messageQueue.add(async () => {
      try {
        await messageManager.clear(ctx);
        await ctx.answerCbQuery("Экран очищен");
      } catch (error) {
        console.error("Ошибка очистки:", error);
        await ctx.answerCbQuery("Ошибка при очистке");
      }
    });
  });
const sendProfile = async (ctx, profile, page, total, isLast) => {
  return messageQueue.add(async () => {
    try {
      // Форматируем текст анкеты
      const about = profile.about?.length > MAX_CAPTION_LENGTH
        ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + "..."
        : profile.about || "";

      // Функция для форматирования Telegram ссылки
      const formatTelegram = (username) => {
        if (!username) return "";
        if (username.startsWith("https://t.me/")) {
          const cleaned = decodeURIComponent(username)
            .replace("https://t.me/", "")
            .replace(/^%40/, "@")
            .replace(/^\+/, "");
          return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
        }
        const cleaned = username.replace(/^[@+]/, "");
        return `💬 <a href="https://t.me/${cleaned}">Telegram</a>`;
      };

      // Функция для форматирования телефона
      const formatPhone = (phone) => {
        if (!phone) return "";
        const cleanPhone = phone.replace(/[^0-9+]/g, "");
        return `📞 <a href="tel:${cleanPhone}">${phone}</a>`;
      };

      // Функция для форматирования WhatsApp ссылки
      const formatWhatsApp = (url) => {
        if (!url) return "";
        return `📱 <a href="${url}">WhatsApp</a>`;
      };

      // Формируем основное сообщение анкеты
      const caption = `
👤 <b>${profile.name}</b>, ${profile.age}\n\n
${profile.country}\n
📍 ${profile.city}\n
<em>${about}</em>\n
${profile.phone ? formatPhone(profile.phone) + "\n" : ""}
${profile.telegram ? formatTelegram(profile.telegram) + "\n" : ""}
${profile.whatsapp ? formatWhatsApp(profile.whatsapp) + "\n" : ""}
⚠🚨 <b>НЕ платите вперед с помощью Transcash, билетов PCS, Neosurf, BITCOIN или любых других способов оплаты. Предложения по предоплате – это в основном лохотрон! Пожалуйста, сообщите нам о таких профилях❗</b>`.trim();

      // Формируем клавиатуру только для последней анкеты на странице
      let keyboard = [];
      if (isLast) {
        const totalPages = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE);
        
        // 1. Создаем строку пагинации
        const paginationRow = [];
        if (page > 0) {
          paginationRow.push({ text: "⏪", callback_data: `page_first_${page}` });
          paginationRow.push({ text: "◀️", callback_data: `page_prev_${page}` });
        }
        
        paginationRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "page_info" });
        
        if (page < totalPages - 1) {
          paginationRow.push({ text: "▶️", callback_data: `page_next_${page}` });
          paginationRow.push({ text: "⏩", callback_data: `page_last_${page}` });
        }
        
        keyboard.push(paginationRow);

        // 2. Добавляем быстрые страницы если нужно
        if (totalPages > 3) {
          const quickPagesRow = [];
          const maxQuickPages = Math.min(5, totalPages);
          const startPage = Math.max(
            0,
            Math.min(page - Math.floor(maxQuickPages / 2), totalPages - maxQuickPages)
          );

          for (let i = 0; i < maxQuickPages; i++) {
            const p = startPage + i;
            if (p >= 0 && p < totalPages) {
              quickPagesRow.push({
                text: p === page ? `• ${p + 1} •` : `${p + 1}`,
                callback_data: `page_${p}_${page}`,
              });
            }
          }
          keyboard.push(quickPagesRow);
        }

        // 3. Добавляем строку с активными фильтрами
        if (ctx.session?.displayCountry || ctx.session?.ageRange?.label || ctx.session?.filterCity) {
          let filtersText = "🔹 ";
          if (ctx.session.displayCountry) filtersText += `Страна: ${ctx.session.displayCountry}`;
          if (ctx.session.filterCity) {
            if (ctx.session.displayCountry) filtersText += ", ";
            filtersText += `Город: ${ctx.session.filterCity}`;
          }
          if (ctx.session.ageRange?.label) {
            if (ctx.session.displayCountry || ctx.session.filterCity) filtersText += ", ";
            filtersText += `Возраст: ${ctx.session.ageRange.label}`;
          }
          keyboard.push([{ text: filtersText, callback_data: "filters_info" }]);
        }

        // 4. Добавляем главное меню под пагинацией
        keyboard.push(
          [{ text: "🌐 Открыть PeaceYourGun 🥕 в WebApp", web_app: { url: process.env.WEBAPP_URL } }],
          [{ text: "🌍 Все страны", callback_data: "all_countries" }],
          [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
          [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
        );
      }

      // Пытаемся отправить с фото
      try {
        const msg = await ctx.replyWithPhoto(profile.photoUrl, {
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
        });
        messageManager.track(ctx.chat.id, msg.message_id);
        return msg;
      } catch (e) {
        // Если не удалось с фото, отправляем только текст
        const msg = await ctx.reply(caption, {
          parse_mode: "HTML",
          reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
        });
        messageManager.track(ctx.chat.id, msg.message_id);
        return msg;
      }
    } catch (error) {
      console.error("Ошибка отправки анкеты:", error);
      return null;
    }
  });
};
  
};
