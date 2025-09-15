// const RateLimiter = require("telegraf-ratelimit");
// const { default: PQueue } = require("p-queue");

// // Настройка очереди для отправки сообщений
// const messageQueue = new PQueue({
//   concurrency: 5,
//   interval: 1000,
//   intervalCap: 5,
// });

// //Время жизни сообщений в хранилище (24 часа)
// const MESSAGE_TTL = 86400000;
// const CACHE_TTL = 600000;
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
// let preloadedCountries = [];
//   (async () => {
//     try {
//       const snapshot = await db.collection("profiles")
//         .orderBy("country")
//         .select("country")
//         .get();
//       preloadedCountries = [...new Set(snapshot.docs.map(doc => doc.data().country).filter(Boolean))].sort();
//     } catch (error) {
//       console.error("Ошибка предзагрузки стран:", error);
//     }
//   })();
// // Оптимизация: проверка подписки с кэшированием на 5 минут
//   const subscriptionCache = new Map();
//   const checkSubscription = async (userId, db) => {
//     const cacheKey = userId.toString();
//     const now = Date.now();
    
//     // Проверяем кэш
//     if (subscriptionCache.has(cacheKey)) {
//       const { data, timestamp } = subscriptionCache.get(cacheKey);
//       if (now - timestamp < 300000) { // 5 минут кэша
//         return data;
//       }
//     }
    
//     try {
//       const subRef = db.collection('subscriptions').doc(cacheKey);
//       const doc = await subRef.get();
      
//       if (!doc.exists) {
//         subscriptionCache.set(cacheKey, { data: false, timestamp: now });
//         return false;
//       }
      
//       const subData = doc.data();
//       const isActive = subData.isActive && subData.endDate.toDate() > new Date();
//       subscriptionCache.set(cacheKey, { data: isActive, timestamp: now });
//       return isActive;
//     } catch (error) {
//       console.error('Ошибка проверки подписки:', error);
//       return false;
//     }
//   };

  

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
//  setInterval(() => {
//     const now = Date.now();
//     chatStorage.messages.forEach((messages, chatId) => {
//       messages.forEach(messageId => {
//         if (now - (chatStorage.messageTimestamps.get(messageId) || 0) > MESSAGE_TTL) {
//           messages.delete(messageId);
//           chatStorage.messageTimestamps.delete(messageId);
//         }
//       });
//     });
//   }, 43200000);
  
// const profilesCache = {
//     data: null,
//     timestamp: 0,
//     filters: {
//       country: null,
//       age: null,
//       city: null
//     },
//     clear: function() {
//       this.data = null;
//       this.timestamp = 0;
//       this.filters = {
//         country: null,
//         age: null,
//         city: null
//       };
//     },
//     isCacheValid: function(currentFilters) {
//       const now = Date.now();
//       return this.data && 
//              now - this.timestamp < CACHE_TTL &&
//              this.filters.country === (currentFilters.country || null) &&
//              this.filters.age === (currentFilters.age || null) &&
//              this.filters.city === (currentFilters.city || null);
//     }
//   };

  
//   const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null, searchCity = null) => {
//   try {
//     const currentFilters = {
//       country: searchCountry,
//       age: ageRange?.label,
//       city: searchCity
//     };

//     if (profilesCache.isCacheValid(currentFilters)) {
//       return profilesCache.data.slice(
//         page * PROFILES_PER_PAGE,
//         (page + 1) * PROFILES_PER_PAGE
//       );
//     }

//     // ВАЖНО: Добавляем поле photos в запрос
//     let query = db.collection("profiles")
//       .orderBy("createdAt", "desc")
//       .select(
//         "id", "name", "age", "country", "city", 
//         "about", "photoUrl", "telegram", "phone", 
//         "whatsapp", "photos"  // Добавляем это поле
//       );

//     if (searchCountry) {
//       query = query.where("country", "==", searchCountry);
//     }

//     if (searchCity) {
//       query = query.where("city", "==", searchCity);
//     }

//     const snapshot = await query.get();

//     let profiles = snapshot.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data()
//     }));

//     // Остальной код без изменений
//     if (ageRange && !searchCountry && !searchCity) {
//       profiles = profiles.filter(profile => {
//         const age = parseInt(profile.age) || 0;
//         return age >= ageRange.min && age <= ageRange.max;
//       });
//     }

//     profilesCache.data = profiles;
//     profilesCache.timestamp = Date.now();
//     profilesCache.filters = currentFilters;

//     return profiles.slice(
//       page * PROFILES_PER_PAGE,
//       (page + 1) * PROFILES_PER_PAGE
//     );
//   } catch (error) {
//     console.error("Ошибка загрузки анкет:", error);
//     profilesCache.clear();
//     return [];
//   }
// };
//   // Оптимизация: используем предзагруженные страны
//   const getUniqueCountries = async () => {
//     try {
//       // Если есть предзагруженные страны - используем их
//       if (preloadedCountries.length > 0) {
//         return preloadedCountries;
//       }
      
//       // Иначе загружаем из базы
//       const snapshot = await db.collection("profiles")
//         .orderBy("country")
//         .select("country")
//         .get();

//       const countries = new Set();
//       snapshot.docs.forEach(doc => {
//         const country = doc.data().country;
//         if (country) countries.add(country);
//       });

//       return Array.from(countries).sort();
//     } catch (error) {
//       console.error("Ошибка получения списка стран:", error);
//       return [];
//     }
//   };

//   // Оптимизация: кэшируем города для стран
//   const cityCache = new Map();
//   const getUniqueCitiesForCountry = async (country) => {
//     try {
//       // Проверяем кэш
//       if (cityCache.has(country)) {
//         const { cities, timestamp } = cityCache.get(country);
//         if (Date.now() - timestamp < CACHE_TTL) {
//           return cities;
//         }
//       }

//       // Загружаем из базы
//       const snapshot = await db.collection("profiles")
//         .where("country", "==", country)
//         .orderBy("city")
//         .select("city")
//         .get();

//       const cities = new Set();
//       snapshot.docs.forEach(doc => {
//         const city = doc.data().city;
//         if (city) cities.add(city);
//       });

//       const result = Array.from(cities).sort();
//       cityCache.set(country, { cities: result, timestamp: Date.now() });
//       return result;
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


// clear: async function (ctx, keepCityKeyboard = false, keepCountryKeyboard = false) {
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

//   // Удаляем клавиатуру стран если явно указано
//   if (countryKeyboardId && !keepCountryKeyboard) {
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
//         // [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
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
//           // keyboard.push([
//           //   { text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" },
//           // ]);
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

  
//   bot.action(/^city_(.+)$/, async (ctx) => {
//   await messageQueue.add(async () => {
//     try {
//       const city = ctx.match[1];
//       ctx.session = ctx.session || {};
//       ctx.session.profilesPage = 0;
//       ctx.session.filterCity = city;

//       // Очищаем, но сохраняем клавиатуры городов и стран
//       await messageManager.clear(ctx, true, true);

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
// bot.action("back_to_countries", async (ctx) => {
//   await messageQueue.add(async () => {
//     try {
//       // Очищаем, но сохраняем клавиатуру стран
//       await messageManager.clear(ctx, false, true);
//       await messageManager.sendCountriesKeyboard(ctx);
//       await ctx.answerCbQuery();
//     } catch (error) {
//       console.error("Ошибка возврата к странам:", error);
//     }
//   });
// });
  
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
// bot.action("filter_by_age", async (ctx) => {
//   await messageQueue.add(async () => {
//     try {
//       // Сохраняем ID клавиатур перед очисткой
//       const chatId = ctx.chat.id;
//       const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//       const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//       // Очищаем только ненужные сообщения, сохраняя клавиатуры
//       await messageManager.clear(ctx, true, true);

//       // Восстанавливаем ID клавиатур после очистки
//       if (countryKeyboardId) {
//         chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
//       }
//       if (cityKeyboardId) {
//         chatStorage.cityKeyboard.set(chatId, cityKeyboardId);
//       }

//       // Создаем клавиатуру для выбора возраста
//       const keyboard = AGE_RANGES.map((range) => [
//         { text: range.label, callback_data: `age_range_${range.label}` },
//       ]);
//       keyboard.push([
//         { text: "❌ Сбросить фильтр", callback_data: "age_range_reset" },
//       ]);

//       const msg = await ctx.reply("Выберите возрастной диапазон:", {
//         reply_markup: { inline_keyboard: keyboard },
//       });

//       messageManager.track(ctx.chat.id, msg.message_id);
//       await ctx.answerCbQuery();
//     } catch (error) {
//       console.error("Ошибка фильтра по возрасту:", error);
//     }
//   });
// });


 
// // В обработчике фильтра по возрасту:
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

//       // Получаем ID клавиатур перед очисткой
//       const chatId = ctx.chat.id;
//       const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//       const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//       // Очищаем, но сохраняем клавиатуры городов и стран
//       await messageManager.clear(ctx, true, true);

//       // Восстанавливаем ID клавиатур после очистки
//       if (countryKeyboardId) {
//         chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
//       }
//       if (cityKeyboardId) {
//         chatStorage.cityKeyboard.set(chatId, cityKeyboardId);
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

//       // Если была выбрана страна, но не город - показываем города снова
//       if (currentCountry && !currentCity) {
//         await messageManager.sendCitiesKeyboard(ctx, currentCountry);
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
//       // =============================================
//       // 1. ПОДГОТОВКА ДАННЫХ АНКЕТЫ (полностью сохранена ваша логика)
//       // =============================================
      
//       // Форматирование текста "о себе" (как в вашем оригинале)
//       const about = profile.about?.length > MAX_CAPTION_LENGTH
//         ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + "..."
//         : profile.about || "";

//       // Ваши оригинальные функции форматирования (без изменений)
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

//       const formatPhone = (phone) => {
//         if (!phone) return "";
//         const cleanPhone = phone.replace(/[^0-9+]/g, "");
//         return `📞 <a href="tel:${cleanPhone}">${phone}</a>`;
//       };

//       const formatWhatsApp = (url) => {
//         if (!url) return "";
//         return `📱 <a href="${url}">WhatsApp</a>`;
//       };

//       // =============================================
//       // 2. ФОРМИРОВАНИЕ ТЕКСТА АНКЕТЫ (полностью как у вас)
//       // =============================================
//       const fullCaption = `
// 👤 <b>${profile.name}</b>, ${profile.age}\n\n
// ${profile.country}\n
// 📍 ${profile.city}\n
// <em>${about.length > 300 ? about.substring(0, 300) + '...' : about}</em>\n
// ${profile.phone ? formatPhone(profile.phone) + "\n" : ""}
// ${profile.telegram ? formatTelegram(profile.telegram) + "\n" : ""}
// ${profile.whatsapp ? formatWhatsApp(profile.whatsapp) + "\n" : ""}
// ⚠🚨 <b>НЕ платите вперед с помощью Transcash, билетов PCS, Neosurf, BITCOIN или любых других способов оплаты. Предложения по предоплате – это в основном лохотрон! Пожалуйста, сообщите нам о таких профилях❗</b>`.trim();

// const shortCaption = `👤 <b>${profile.name}</b>, ${profile.age} | ${profile.city}`;

//       // =============================================
//       // 3. ФОРМИРОВАНИЕ КЛАВИАТУРЫ (полностью сохранена ваша логика)
//       // =============================================
//       let keyboard = [];
//       if (isLast) {
//         const totalPages = Math.ceil(profilesCache.data.length / PROFILES_PER_PAGE);
        
//         // 1. Строка пагинации (как у вас)
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

//         // 2. Быстрые страницы (как у вас)
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

        
// //3. Добавляем строку с активными фильтрами
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
//         // 4. Главное меню (как у вас)
//         keyboard.push(
//           [{ text: "🌐 Открыть PeaceYourGun 🥕 в WebApp", web_app: { url: process.env.WEBAPP_URL } }],
//           [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//           // [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
//           [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
//         );
//       }

//       // =============================================
//       // 4. ОПРЕДЕЛЕНИЕ ФОТОГРАФИЙ (добавлена поддержка массива photos)
//       // =============================================
//       let photosToSend = [];
      
//       // Сначала проверяем массив photos (новый код)
//       if (Array.isArray(profile.photos) && profile.photos.length > 0) {
//         photosToSend = profile.photos
//           .filter(url => typeof url === 'string' && url.trim() !== '' && url.startsWith('http'));
//       }
      
//       // Если нет массива photos, проверяем photoUrl (как у вас)
//       if (photosToSend.length === 0 && profile.photoUrl && typeof profile.photoUrl === 'string' && profile.photoUrl.trim() !== '') {
//         photosToSend = [profile.photoUrl];
//       }

//       // =============================================
//       // 5. ЛОГИКА ОТПРАВКИ (добавлена обработка групповых фото)
//       // =============================================
      
//       // 5.1. Нет фото вообще - отправляем только текст (как у вас)
//       if (photosToSend.length === 0) {
//         const msg = await ctx.reply(fullCaption, {
//           parse_mode: "HTML",
//           reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//         });
//         messageManager.track(ctx.chat.id, msg.message_id);
//         return msg;
//       }
      
//       // 5.2. Одно фото - стандартная отправка (как у вас)
//       else if (photosToSend.length === 1) {
//         try {
//           const msg = await ctx.replyWithPhoto(photosToSend[0], {
//             caption: fullCaption,
//             parse_mode: "HTML",
//             reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         } catch (e) {
//           const msg = await ctx.reply(fullCaption, {
//             parse_mode: "HTML",
//             reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//           });
//           messageManager.track(ctx.chat.id, msg.message_id);
//           return msg;
//         }
//       }
      
//       // 5.3. Несколько фото - новая логика отправки медиагруппы
//       else {
//         const mediaGroup = photosToSend.map((photoUrl, index) => ({
//           type: 'photo',
//           media: photoUrl,
//           caption: index === 0 ? fullCaption : shortCaption,
//           parse_mode: 'HTML'
//         }));

//         try {
//           // Отправляем медиагруппу
//           const messages = await ctx.replyWithMediaGroup(mediaGroup);
//           messages.forEach(msg => messageManager.track(ctx.chat.id, msg.message_id));

//           // Отправляем клавиатуру отдельным сообщением (чтобы не потерять пагинацию)
//           if (keyboard.length > 0) {
//             const keyboardMsg = await ctx.reply('Дополнительные действия:', {
//               reply_markup: { inline_keyboard: keyboard }
//             });
//             messageManager.track(ctx.chat.id, keyboardMsg.message_id);
//           }

//           return messages;
//         } catch (e) {
//           // Если не удалось отправить медиагруппу, пробуем отправить первое фото
//           try {
//             const msg = await ctx.replyWithPhoto(photosToSend[0], {
//               caption: fullCaption,
//               parse_mode: "HTML",
//               reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//             });
//             messageManager.track(ctx.chat.id, msg.message_id);
//             return msg;
//           } catch (e) {
//             const msg = await ctx.reply(fullCaption, {
//               parse_mode: "HTML",
//               reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//             });
//             messageManager.track(ctx.chat.id, msg.message_id);
//             return msg;
//           }
//         }
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
const NodeCache = require("node-cache");

// ===================== НАСТРОЙКИ =====================
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 дней в секундах
const CACHE_TTL_SHORT = 300; // 5 минут
const PROFILES_PER_PAGE = 5;
const MAX_CAPTION_LENGTH = 900;
const MESSAGE_TTL = 86400000; // 24 часа для хранения сообщений

const AGE_RANGES = [
  { label: "18-25", min: 18, max: 25 },
  { label: "26-35", min: 26, max: 35 },
  { label: "36-45", min: 36, max: 45 },
  { label: "46+", min: 46, max: 999 },
];

const POPULAR_COUNTRIES = [
  { name: "Россия", flag: "🇷🇺" },
  { name: "Украина", flag: "🇺🇦" },
  { name: "Беларусь", flag: "🇧🇾" },
  { name: "Казахстан", flag: "🇰🇿" },
  { name: "Турция", flag: "🇹🇷" },
  { name: "Германия", flag: "🇩🇪" },
  { name: "США", flag: "🇺🇸" },
  { name: "Израиль", flag: "🇮🇱" },
];

// Инициализация простого кэша в памяти
const cache = new NodeCache({ 
  stdTTL: CACHE_TTL,
  checkperiod: 600 // проверка каждые 10 минут
});

// ===================== СИСТЕМА МОНИТОРИНГА ЧТЕНИЙ =====================
const readingStats = {
  totalReads: 0,
  operations: {
    profiles: 0,
    subscriptions: 0,
    other: 0
  },
  timestamps: [],
  users: new Map(),
  
  // Добавление записи о чтении
  addRead(operationType = 'other', userId = null, count = 1) {
    this.totalReads += count;
    this.operations[operationType] = (this.operations[operationType] || 0) + count;
    this.timestamps.push({ time: Date.now(), type: operationType, count });
    
    if (userId) {
      if (!this.users.has(userId)) {
        this.users.set(userId, { total: 0, operations: {} });
      }
      const userStats = this.users.get(userId);
      userStats.total += count;
      userStats.operations[operationType] = (userStats.operations[operationType] || 0) + count;
    }
    
    console.log(`📖 [READ] ${operationType}: +${count} | Total: ${this.totalReads}`);
  },
  
  // Статистика
  getStats() {
    return {
      totalReads: this.totalReads,
      operations: this.operations,
      uniqueUsers: this.users.size,
      readsPerUser: this.users.size > 0 ? this.totalReads / this.users.size : 0,
      timeline: this.timestamps.slice(-100) // последние 100 операций
    };
  },
  
  // Сброс статистики
  resetStats() {
    this.totalReads = 0;
    this.operations = { profiles: 0, subscriptions: 0, other: 0 };
    this.timestamps = [];
    this.users.clear();
  }
};

// ===================== КЭШ-МЕНЕДЖЕР =====================
const cacheManager = {
  // Сохранение профилей в кэш
  async cacheProfiles(profiles) {
    try {
      cache.set("profiles:all", profiles);
      
      // Извлекаем уникальные страны и города
      const countriesSet = new Set();
      const citiesMap = new Map();

      profiles.forEach(profile => {
        if (profile.country) {
          countriesSet.add(profile.country);
          if (!citiesMap.has(profile.country)) {
            citiesMap.set(profile.country, new Set());
          }
          if (profile.city) {
            citiesMap.get(profile.country).add(profile.city);
          }
        }
      });

      // Сохраняем страны
      cache.set("profiles:countries", Array.from(countriesSet).sort());
      
      // Сохраняем города для каждой страны
      for (const [country, citiesSet] of citiesMap) {
        cache.set(`profiles:cities:${country}`, Array.from(citiesSet).sort());
      }

      console.log(`✅ [CACHE] Кэш обновлен: ${profiles.length} профилей, ${countriesSet.size} стран`);
      
    } catch (error) {
      console.error('❌ [CACHE] Ошибка кэширования профилей:', error);
    }
  },

  // Получение профилей из кэша
  getCachedProfiles() {
    return cache.get("profiles:all") || null;
  },

  // Получение стран из кэша
  getCachedCountries() {
    return cache.get("profiles:countries") || [];
  },

  // Получение городов из кэша
  getCachedCities(country) {
    return cache.get(`profiles:cities:${country}`) || [];
  },

  // Кэширование подписки
  cacheSubscription(userId, isActive) {
    cache.set(`subscription:${userId}`, isActive, CACHE_TTL_SHORT);
  },

  // Получение подписки из кэша
  getCachedSubscription(userId) {
    return cache.get(`subscription:${userId}`);
  },

  // Кэширование отфильтрованных профилей
  cacheFilteredProfiles(filterKey, profiles) {
    cache.set(`filtered:${filterKey}`, profiles, CACHE_TTL_SHORT);
  },

  // Получение отфильтрованных профилей из кэша
  getCachedFilteredProfiles(filterKey) {
    return cache.get(`filtered:${filterKey}`);
  }
};

// ===================== ОСНОВНАЯ ЛОГИКА =====================
module.exports = (bot, db) => {
  // Загрузка кэша при старте с мониторингом
  async function loadFullProfileCache(db) {
    try {
      console.log("🔄 [CACHE] Начинается полная загрузка анкет в кэш...");
      
      // 📊 ЗАПИСЫВАЕМ МАССИВНОЕ ЧТЕНИЕ
      readingStats.addRead('profiles', null, 1); // 1 операция, но много документов
      
      const snapshot = await db.collection("profiles")
        .orderBy("createdAt", "desc")
        .select("id", "name", "age", "country", "city", "about", "photoUrl", "telegram", "phone", "whatsapp", "photos", "createdAt")
        .get();

      const allProfiles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      await cacheManager.cacheProfiles(allProfiles);
      
      console.log(`✅ [CACHE] Загружено ${allProfiles.length} анкет`);
      console.log(`📊 [STATS] Текущие чтения: ${readingStats.totalReads}`);
      
    } catch (error) {
      console.error("❌ [CACHE] Ошибка при загрузке кэша:", error);
    }
  }

  // ИНИЦИАЛИЗАЦИЯ КЭША ПРИ СТАРТЕ БОТА
  (async () => {
    await loadFullProfileCache(db);
    // Настраиваем периодическое обновление раз в 6 дней
    setInterval(() => loadFullProfileCache(db), 6 * 24 * 60 * 60 * 1000);
  })();

  // Настройка очереди для отправки сообщений
  const messageQueue = new PQueue({
    concurrency: 2,
    interval: 1000,
    intervalCap: 2,
  });

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
    countryKeyboard: new Map(), // chatId: messageId
    cityKeyboard: new Map(), // chatId: messageId
  };

  // Очистка старых сообщений каждые 6 часов
  setInterval(() => {
    const now = Date.now();
    chatStorage.messages.forEach((messages, chatId) => {
      messages.forEach(messageId => {
        if (now - (chatStorage.messageTimestamps.get(messageId) || 0) > MESSAGE_TTL) {
          messages.delete(messageId);
          chatStorage.messageTimestamps.delete(messageId);
        }
      });
    });
  }, 43200000);

  // Проверка подписки с кэшированием и мониторингом
  const checkSubscription = async (userId) => {
    try {
      // Пытаемся получить из кэша
      const cachedSubscription = cacheManager.getCachedSubscription(userId);
      if (cachedSubscription !== undefined) {
        return cachedSubscription;
      }
      
      // Если нет в кэше, запрашиваем из БД
      readingStats.addRead('subscriptions', userId, 1); // 📊 ЗАПИСЫВАЕМ ЧТЕНИЕ
      
      const subRef = db.collection('subscriptions').doc(userId.toString());
      const doc = await subRef.get();
      
      if (!doc.exists) {
        cacheManager.cacheSubscription(userId, false);
        return false;
      }
      
      const subData = doc.data();
      const isActive = subData.isActive && subData.endDate.toDate() > new Date();
      cacheManager.cacheSubscription(userId, isActive);
      return isActive;
      
    } catch (error) {
      console.error('Ошибка проверки подписки:', error);
      return false;
    }
  };

  // Получение страницы профилей с кэшированием фильтров
  const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null, searchCity = null) => {
    try {
      // Создаем уникальный ключ для фильтра
      const filterKey = `country:${searchCountry || 'all'}:age:${ageRange?.label || 'all'}:city:${searchCity || 'all'}`;
      
      // Пытаемся получить отфильтрованные профили из кэша
      let filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
      
      if (!filteredProfiles) {
        // Если нет в кэше, загружаем все профили из кэша
        const allProfiles = cacheManager.getCachedProfiles();
        if (!allProfiles) {
          console.error("❌ [CACHE] Нет профилей в кэше");
          return [];
        }

        // Применяем фильтры
        filteredProfiles = allProfiles.filter(profile => {
          // Фильтр по стране
          if (searchCountry && profile.country !== searchCountry) {
            return false;
          }
          
          // Фильтр по городу
          if (searchCity && profile.city !== searchCity) {
            return false;
          }
          
          // Фильтр по возрасту
          if (ageRange && !searchCountry && !searchCity) {
            const age = parseInt(profile.age) || 0;
            if (age < ageRange.min || age > ageRange.max) {
              return false;
            }
          }
          
          return true;
        });

        // Сохраняем в кэш
        cacheManager.cacheFilteredProfiles(filterKey, filteredProfiles);
      }

      // Возвращаем страницу
      return filteredProfiles.slice(
        page * PROFILES_PER_PAGE,
        (page + 1) * PROFILES_PER_PAGE
      );

    } catch (error) {
      console.error("Ошибка загрузки анкет из кэша:", error);
      return [];
    }
  };

  // Получение уникальных стран из кэша
  const getUniqueCountries = async () => {
    return cacheManager.getCachedCountries();
  };

  // Получение уникальных городов для страны из кэша
  const getUniqueCitiesForCountry = async (country) => {
    return cacheManager.getCachedCities(country);
  };

  // Форматирование названия страны с флагом
  const formatCountryWithFlag = (countryName) => {
    if (!countryName) return countryName;
    const popularCountry = POPULAR_COUNTRIES.find(c => c.name === countryName);
    return popularCountry ? `${popularCountry.flag} ${countryName}` : countryName;
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

          const hasSub = await checkSubscription(ctx.from.id);

          const menuButtons = [
            // [{
            //   text: '🌐 Открыть PeaceYourGun 🥕 в WebApp', 
            //   web_app: { url: process.env.WEBAPP_URL || 'https://your-webapp-url.com' }
            // }]
          ];

          if (hasSub) {
            menuButtons.push([{ 
              text: "🌍 Все страны", 
              callback_data: "all_countries" 
            }]);
          }

          menuButtons.push(
            [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
          );

          const menu = await ctx.reply("Главное меню:", {
            reply_markup: { inline_keyboard: menuButtons },
          });

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

          // Получаем список уникальных стран из кэша
          const uniqueCountries = await getUniqueCountries();

          const countriesToShow =
            uniqueCountries.length > 0 && uniqueCountries.length <= 50
              ? uniqueCountries
              : POPULAR_COUNTRIES.map((c) => c.name);

          const keyboard = [];
          let row = [];

          countriesToShow.forEach((country, index) => {
            const countryWithFlag = formatCountryWithFlag(country);
            row.push({
              text: countryWithFlag,
              callback_data: `country_${country}`,
            });

            if (row.length === 3 || index === countriesToShow.length - 1) {
              keyboard.push(row);
              row = [];
            }
          });

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

          // Получаем список уникальных городов из кэша
          const cities = await getUniqueCitiesForCountry(country);

          const keyboard = [];
          let row = [];

          cities.forEach((city, index) => {
            row.push({
              text: city,
              callback_data: `city_${city}`,
            });

            if (row.length === 3 || index === cities.length - 1) {
              keyboard.push(row);
              row = [];
            }
          });

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

        await messageManager.clear(ctx);

        const profiles = await getProfilesPage(0);

        if (!profiles.length) {
          const msg = await ctx.reply("Анкет нет, попробуйте позже");
          messageManager.track(ctx.chat.id, msg.message_id);
          return;
        }

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
      const hasSub = await checkSubscription(ctx.from.id);
      
      if (!hasSub) {
        await ctx.answerCbQuery("❌ Требуется активная подписка");
        return;
      }
      
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

        await messageManager.clear(ctx, true, true);
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

  bot.action("filter_by_age", async (ctx) => {
    await messageQueue.add(async () => {
      try {
        const chatId = ctx.chat.id;
        const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
        const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

        await messageManager.clear(ctx, true, true);

        if (countryKeyboardId) {
          chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
        }
        if (cityKeyboardId) {
          chatStorage.cityKeyboard.set(chatId, cityKeyboardId);
        }

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

        const currentCountry = ctx.session.filterCountry;
        const currentCity = ctx.session.filterCity;

        const chatId = ctx.chat.id;
        const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
        const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

        await messageManager.clear(ctx, true, true);

        if (countryKeyboardId) {
          chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
        }
        if (cityKeyboardId) {
          chatStorage.cityKeyboard.set(chatId, cityKeyboardId);
        }

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

        for (let i = 0; i < profiles.length; i++) {
          const isLast = i === profiles.length - 1;
          await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
          if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
        }

        if (currentCountry && !currentCity) {
          await messageManager.sendCitiesKeyboard(ctx, currentCountry);
        }

        if (currentCity) {
          await messageManager.sendMainMenu(ctx);
        }
      } catch (error) {
        console.error("Ошибка обработки возрастного диапазона:", error);
      }
    });
  });

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

  bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
    await messageQueue.add(async () => {
      try {
        const [_, action, currentPage] = ctx.match;
        let newPage = parseInt(currentPage);

        if (action === "first") newPage = 0;
        else if (action === "prev") newPage = Math.max(0, newPage - 1);
        else if (action === "next") newPage = newPage + 1;
        else if (action === "last") newPage = Math.ceil((cacheManager.getCachedFilteredProfiles(`country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`)?.length || 0) / PROFILES_PER_PAGE) - 1;
        else newPage = parseInt(action);

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
        const about = profile.about?.length > MAX_CAPTION_LENGTH
          ? profile.about.substring(0, MAX_CAPTION_LENGTH - 3) + "..."
          : profile.about || "";

        const formatTelegram = (username) => {
  if (!username) return "";
  
  // Если это похоже на номер телефона (содержит в основном цифры)
  if (/^[0-9+\-() ]+$/.test(username)) {
    // Очищаем от всего, кроме цифр
    const cleanDigits = username.replace(/[^0-9]/g, "");
    
    // Если номер российский (начинается с 7,8 или 9)
    if (cleanDigits.startsWith('7') || cleanDigits.startsWith('8') || 
        (cleanDigits.length >= 10 && !cleanDigits.startsWith('1'))) {
      
      let telegramNumber = cleanDigits;
      
      // Преобразуем в формат для Telegram (без +)
      if (telegramNumber.startsWith('7') && telegramNumber.length === 11) {
        telegramNumber = telegramNumber.substring(1); // убираем 7
      }
      else if (telegramNumber.startsWith('8') && telegramNumber.length === 11) {
        telegramNumber = telegramNumber.substring(1); // убираем 8
      }
      
      return `🔵 <a href="https://t.me/${telegramNumber}">Telegram</a>`;
    }
  }
  
  // Обработка стандартных форматов Telegram
  if (username.startsWith("https://t.me/")) {
    const cleaned = decodeURIComponent(username)
      .replace("https://t.me/", "")
      .replace(/^%40/, "@")
      .replace(/^\+/, "");
    return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
  }
  
  const cleaned = username.replace(/^[@+]/, "");
  return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
};

const formatWhatsApp = (url) => {
  if (!url) return "";
  
  // Если это похоже на номер телефона
  if (/^[0-9+\-() ]+$/.test(url)) {
    // Очищаем от всего, кроме цифр
    let cleanDigits = url.replace(/[^0-9]/g, "");
    
    // Обработка российских номеров
    if (cleanDigits.startsWith('8') && cleanDigits.length === 11) {
      // Формат: 89666661930 → 79666661930
      cleanDigits = '7' + cleanDigits.substring(1);
    } else if (cleanDigits.startsWith('7') && cleanDigits.length === 11) {
      // Уже в правильном формате
    } else if (cleanDigits.length === 10) {
      // Формат: 9666661930 → 79666661930
      cleanDigits = '7' + cleanDigits;
    }
    
    // Проверяем, что номер имеет правильную длину для WhatsApp
    if (cleanDigits.length === 11 && cleanDigits.startsWith('7')) {
      return `🟢 <a href="https://wa.me/${cleanDigits}">WhatsApp</a>`;
    }
  }
  
  // Если не номер или не удалось преобразовать, возвращаем как есть
  return `🟢  <a href="${url}">WhatsApp</a>`;
};

     const formatPhone = (phone) => {
  if (!phone) return "";
  
  // Очищаем номер от всех символов, кроме цифр
  let cleanDigits = phone.replace(/[^0-9]/g, "");
  
  // Если номер пустой после очистки - возвращаем пустую строку
  if (!cleanDigits) return "";
  
  let formattedPhone = phone; // Исходный номер для отображения
  
  // ОБРАБОТКА РОССИЙСКИХ НОМЕРОВ
  if (cleanDigits.length === 11 || cleanDigits.length === 10) {
    // Номер начинается с 7 (международный формат)
    if (cleanDigits.startsWith('7') && cleanDigits.length === 11) {
      // Формат: 79261234567 → +79261234567
      formattedPhone = `+${cleanDigits}`;
    } 
    // Номер начинается с 8 (российский формат)
    else if (cleanDigits.startsWith('8') && cleanDigits.length === 11) {
      // Формат: 89261234567 → +79261234567
      formattedPhone = `+7${cleanDigits.substring(1)}`;
    }
    // Номер из 10 цифр (без кода страны)
    else if (cleanDigits.length === 10) {
      // Формат: 9261234567 → +79261234567
      formattedPhone = `+7${cleanDigits}`;
    }
  }
  
  // Возвращаем номер как текст (без ссылки), чтобы при нажатии он копировался
  return `📞 ${formattedPhone}`;
};  

   const fullCaption = `
👤 <b>${profile.name}</b>, ${profile.age}
-------------------------------
${profile.country},📍${profile.city}
-------------------------------
<em>${about.length > 300 ? about.substring(0, 300) + `...<a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook">читать полностью в Эскорт💋Блокнот</a>` : about}</em>
🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹
<b>Контакты:</b>
-------------------------------
${profile.phone ? formatPhone(profile.phone) : ""}${profile.telegram ? "\n-------------------------------\n" + formatTelegram(profile.telegram) : ""}${profile.whatsapp ? "\n-------------------------------\n" + formatWhatsApp(profile.whatsapp) : ""}${(profile.phone || profile.telegram || profile.whatsapp) ? "\n-------------------------------" : ""}
⚠️ <b>ЕСЛИ КТО-ТО ПРОСИТ: Криптовалюту наперед, деньги на такси🚕 или дорогу, предоплату любым способом, переводы на карты💳 или электронные кошельки, чеки или подтверждения оплаты</b>
🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 
<b>ЭТО 100% МОШЕННИКИ!
НИ В КОЕМ СЛУЧАЕ НЕ ОТПРАВЛЯЙТЕ ПРЕДОПЛАТУ  🛑 ВАС ОБМАНУТ!</b>
-------------------------------
<a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook"><b>Escort💋Notebook WebApp</b></a>
`.trim();    

//     const fullCaption = `
// 👤 <b>${profile.name}</b>, ${profile.age}\n
// ${profile.country},📍${profile.city}\n
// <em>${about.length > 300 ? about.substring(0, 300) + `...<a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook">читать полностью в Эскорт💋Блокнот</a>` : about}</em>\n
// ${profile.phone ? formatPhone(profile.phone)  : ""}
// ${profile.telegram ? formatTelegram(profile.telegram)  : ""}
// ${profile.whatsapp ? formatWhatsApp(profile.whatsapp) : ""}

// 🛑 <b>ЕСЛИ КТО-ТО ПРОСИТ: Криптовалюту наперед, деньги на такси или дорогу, предоплату любым способом, переводы на карты или электронные кошельки, чеки или подтверждения оплаты</b>
// 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 
// <b>ЭТО 100% МОШЕННИКИ!
// НИ В КОЕМ СЛУЧАЕ НЕ ОТПРАВЛЯЙТЕ ПРЕДОПЛАТУ - ВАС ОБМАНУТ!</b>
// -------------------------------
// <a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook"><b>Escort💋Notebook WebApp</b></a>
// `.trim();
const shortCaption = `👤 <b>${profile.name}</b>, ${profile.age} | ${profile.city}`;

        let keyboard = [];
        if (isLast) {
          const filteredProfiles = cacheManager.getCachedFilteredProfiles(
            `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`
          );
          const totalPages = Math.ceil((filteredProfiles?.length || 0) / PROFILES_PER_PAGE);
          
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

          keyboard.push(
            [{ text: "🌍 Все страны", callback_data: "all_countries" }],
            [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
          );
        }

        let photosToSend = [];
        
        if (Array.isArray(profile.photos) && profile.photos.length > 0) {
          photosToSend = profile.photos
            .filter(url => typeof url === 'string' && url.trim() !== '' && url.startsWith('http'));
        }
        
        if (photosToSend.length === 0 && profile.photoUrl && typeof profile.photoUrl === 'string' && profile.photoUrl.trim() !== '') {
          photosToSend = [profile.photoUrl];
        }

        if (photosToSend.length === 0) {
          const msg = await ctx.reply(fullCaption, {
            parse_mode: "HTML",
            reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
          });
          messageManager.track(ctx.chat.id, msg.message_id);
          return msg;
        }
        else if (photosToSend.length === 1) {
          try {
            const msg = await ctx.replyWithPhoto(photosToSend[0], {
              caption: fullCaption,
              parse_mode: "HTML",
              reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
            });
            messageManager.track(ctx.chat.id, msg.message_id);
            return msg;
          } catch (e) {
            const msg = await ctx.reply(fullCaption, {
              parse_mode: "HTML",
              reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
            });
            messageManager.track(ctx.chat.id, msg.message_id);
            return msg;
          }
        }
        else {
          const mediaGroup = photosToSend.map((photoUrl, index) => ({
            type: 'photo',
            media: photoUrl,
            caption: index === 0 ? fullCaption : shortCaption,
            parse_mode: 'HTML'
          }));

          try {
            const messages = await ctx.replyWithMediaGroup(mediaGroup);
            messages.forEach(msg => messageManager.track(ctx.chat.id, msg.message_id));

            if (keyboard.length > 0) {
              const keyboardMsg = await ctx.reply('Дополнительные действия:', {
                reply_markup: { inline_keyboard: keyboard }
              });
              messageManager.track(ctx.chat.id, keyboardMsg.message_id);
            }

            return messages;
          } catch (e) {
            try {
              const msg = await ctx.replyWithPhoto(photosToSend[0], {
                caption: fullCaption,
                parse_mode: "HTML",
                reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
              });
              messageManager.track(ctx.chat.id, msg.message_id);
              return msg;
            } catch (e) {
              const msg = await ctx.reply(fullCaption, {
                parse_mode: "HTML",
                reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
              });
              messageManager.track(ctx.chat.id, msg.message_id);
              return msg;
            }
          }
        }
      } catch (error) {
        console.error("Ошибка отправки анкеты:", error);
        return null;
      }
    });
  };
};