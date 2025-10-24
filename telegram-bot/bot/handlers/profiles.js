// ===================== ИМПОРТЫ И ЗАВИСИМОСТИ =====================
// const RateLimiter = require("telegraf-ratelimit");
// const { default: PQueue } = require("p-queue");
// const NodeCache = require("node-cache");
// const fs = require('fs');
// const path = require('path');

// // ===================== БЛОКИРОВКА ОТ МНОЖЕСТВЕННОГО ЗАПУСКА =====================
// const LOCK_FILE = path.join(__dirname, 'bot.lock');
// if (fs.existsSync(LOCK_FILE)) {
//     const existingPid = fs.readFileSync(LOCK_FILE, 'utf8');
//     console.error(`❌ Бот уже запущен с PID: ${existingPid}`);
//     console.error('❌ Остановите предыдущий процесс или удалите файл bot.lock');
//     process.exit(1);
// }
// fs.writeFileSync(LOCK_FILE, process.pid.toString());
// process.on('exit', () => { 
//     if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); 
// });
// process.on('SIGINT', () => { 
//     if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); 
//     process.exit(0); 
// });

// // ===================== КОНФИГУРАЦИЯ МАСШТАБИРОВАНИЯ =====================
// const SCALING_CONFIG = {
//     // Настройки очереди сообщений для 1000+ пользователей
//     MESSAGE_QUEUE: {
//         CONCURRENCY: 15, // Увеличиваем для обработки пиковой нагрузки
//         INTERVAL: 1000,
//         INTERVAL_CAP: 60, // 60 сообщений в секунду
//         TIMEOUT: 30000,
//     },
    
//     // Настройки кэша
//     CACHE: {
//         PROFILES_TTL: 7 * 24 * 60 * 60, // 7 дней для профилей
//         FILTERS_TTL: 600, // 10 минут для фильтров
//         SESSIONS_TTL: 1800, // 30 минут для сессий
//         MAX_FILTER_KEYS: 200, // Уменьшаем лимит ключей
//         CHECKPERIOD: 300,
//     },
    
//     // Настройки производительности
//     PERFORMANCE: {
//         PROFILES_PER_PAGE: 1,
//         MAX_CAPTION_LENGTH: 900,
//         MESSAGE_TTL: 86400000,
//         FILTER_CHUNK_SIZE: 1000,
//         MAX_CONCURRENT_FILTERS: 3,
//     }
// };

// // ===================== ВСПОМОГАТЕЛЬНЫЕ КОНСТАНТЫ =====================
// const AGE_RANGES = [
//     { label: "18-25", min: 18, max: 25 },
//     { label: "26-35", min: 26, max: 35 },
//     { label: "36-45", min: 36, max: 45 },
//     { label: "46+", min: 46, max: 999 },
// ];

// const POPULAR_COUNTRIES = [
//     { name: "Россия", flag: "🇷🇺" },
//     { name: "Украина", flag: "🇺🇦" },
//     { name: "Беларусь", flag: "🇧🇾" },
//     { name: "Казахстан", flag: "🇰🇿" },
//     { name: "Турция", flag: "🇹🇷" },
//     { name: "Германия", flag: "🇩🇪" },
//     { name: "США", flag: "🇺🇸" },
//     { name: "Израиль", flag: "🇮🇱" },
// ];

// const PAGINATION_JUMP_SECTIONS = [
//     { label: "1-1000", start: 0, end: 999 },
//     { label: "1000-2000", start: 1000, end: 1999 },
//     { label: "2000-3000", start: 2000, end: 2999 },
// ];

// // // Карта нормализации украинских городов
// const cityNormalizationMap = {
//   // Украинские города - английские варианты
//   kyiv: "Киев",
//   kiev: "Киев",
//   kiyv: "Киев",
//   "kryvyi rih": "Кривой Рог",
//   "kryvyi rig": "Кривой Рог",
//   odesa: "Одесса",
//   odessa: "Одесса",
//   kharkiv: "Харьков",
//   lviv: "Львов",
//   dnipro: "Днепр",
//   zaporizhzhia: "Запорожье",
//   zaporozhye: "Запорожье",
//   vinnytsia: "Винница",
//   vinnitsa: "Винница",
//   ternopil: "Тернополь",
//   khmelnytskyi: "Хмельницкий",
//   khmelnitsky: "Хмельницкий",
//   cherkasy: "Черкассы",
//   chernivtsi: "Черновцы",
//   chernovtsy: "Черновцы",
//   "ivano-frankivsk": "Ивано-Франковск",
//   kropyvnytskyi: "Кропивницкий",
//   mykolaiv: "Николаев",
//   nikolaev: "Николаев",
//   poltava: "Полтава",
//   rivne: "Ровно",
//   rovno: "Ровно",
//   sumy: "Сумы",
//   uzhhorod: "Ужгород",
//   zhytomyr: "Житомир",
//   kramatorsk: "Краматорск",
//   slovyansk: "Славянск",
//   lutsk: "Луцк",
//   kherson: "Херсон",
//   bukovel: "Буковель",

//   // Украинские города - украинские варианты
//   київ: "Киев",
//   "кривий ріг": "Кривой Рог",
//   одеса: "Одесса",
//   харків: "Харьков",
//   львів: "Львов",
//   дніпро: "Днепр",
//   дніпропетровськ: "Днепр",
//   запоріжжя: "Запорожье",
//   вінниця: "Винница",
//   тернопіль: "Тернополь",
//   хмельницький: "Хмельницкий",
//   черкаси: "Черкассы",
//   чернівці: "Черновцы",
//   "івано-франківськ": "Ивано-Франковск",
//   кропивницький: "Кропивницкий",
//   миколаїв: "Николаев",
//   полтава: "Полтава",
//   рівне: "Ровно",
//   суми: "Сумы",
//   ужгород: "Ужгород",
//   житомир: "Житомир",
//   краматорськ: "Краматорск",
//   "слов'янськ": "Славянск",
//   луцьк: "Луцк",
//   херсон: "Херсон",
//   буковель: "Буковель",
// };


// // ===================== ИНИЦИАЛИЗАЦИЯ СИСТЕМ КЭШИРОВАНИЯ =====================
// const profilesCache = new NodeCache({ 
//     stdTTL: SCALING_CONFIG.CACHE.PROFILES_TTL,
//     checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD,
//     useClones: false
// });

// class LimitedFilterCache {
//     constructor() {
//         this.keys = new Set();
//         this.maxKeys = SCALING_CONFIG.CACHE.MAX_FILTER_KEYS;
//     }
    
//     set(key, value) {
//         if (this.keys.size >= this.maxKeys) {
//             const firstKey = this.keys.values().next().value;
//             profilesCache.del(`filtered:${firstKey}`);
//             this.keys.delete(firstKey);
//         }
//         this.keys.add(key);
//         return profilesCache.set(`filtered:${key}`, value, SCALING_CONFIG.CACHE.FILTERS_TTL);
//     }
    
//     get(key) {
//         return profilesCache.get(`filtered:${key}`);
//     }
// }

// const filterCache = new LimitedFilterCache();
// const sessionsCache = new NodeCache({
//     stdTTL: SCALING_CONFIG.CACHE.SESSIONS_TTL,
//     checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD
// });

// // ===================== СИСТЕМА МОНИТОРИНГА =====================
// const readingStats = {
//     totalReads: 0,
//     operations: { profiles: 0, subscriptions: 0, other: 0, cacheHits: 0, cacheMisses: 0 },
//     timestamps: [],
//     users: new Map(),
    
//     addRead(operationType = 'other', userId = null, count = 1) {
//         this.totalReads += count;
//         this.operations[operationType] = (this.operations[operationType] || 0) + count;
//         this.timestamps.push({ time: Date.now(), type: operationType, count, userId });
        
//         if (this.timestamps.length > 1000) {
//             this.timestamps = this.timestamps.slice(-500);
//         }
        
//         if (userId) {
//             if (!this.users.has(userId)) {
//                 this.users.set(userId, { total: 0, operations: {} });
//             }
//             const userStats = this.users.get(userId);
//             userStats.total += count;
//             userStats.operations[operationType] = (userStats.operations[operationType] || 0) + count;
//         }
        
//         console.log(`📖 [READ] ${operationType}: +${count} | Total: ${this.totalReads}`);
//     },
    
//     addCacheHit() { this.operations.cacheHits = (this.operations.cacheHits || 0) + 1; },
//     addCacheMiss() { this.operations.cacheMisses = (this.operations.cacheMisses || 0) + 1; },
    
//     getStats() {
//         const cacheEfficiency = this.operations.cacheHits + this.operations.cacheMisses > 0 
//             ? (this.operations.cacheHits / (this.operations.cacheHits + this.operations.cacheMisses)) * 100 
//             : 0;
            
//         return {
//             totalReads: this.totalReads,
//             operations: this.operations,
//             uniqueUsers: this.users.size,
//             readsPerUser: this.users.size > 0 ? this.totalReads / this.users.size : 0,
//             cacheEfficiency: `${cacheEfficiency.toFixed(2)}%`,
//             timeline: this.timestamps.slice(-100)
//         };
//     },
    
//     resetStats() {
//         this.totalReads = 0;
//         this.operations = { profiles: 0, subscriptions: 0, other: 0, cacheHits: 0, cacheMisses: 0 };
//         this.timestamps = [];
//         this.users.clear();
//     }
// };

// // ===================== ОПТИМИЗИРОВАННЫЙ КЭШ-МЕНЕДЖЕР =====================
// const cacheManager = {
//     async cacheProfiles(profiles) {
//         try {
//             console.log(`🔄 [CACHE] Загрузка ${profiles.length} анкет в кэш...`);
            
//             // НОРМАЛИЗУЕМ ГОРОДА ПРИ ЗАГРУЗКЕ В КЭШ - КАК В СТАРОМ КОДЕ!
//             const normalizedProfiles = profiles.map(profile => ({
//                 ...profile,
//                 city: this.normalizeCityName(profile.city)
//             }));
            
//             profilesCache.set("profiles:all", normalizedProfiles);
            
//             const countriesSet = new Set();
//             const citiesMap = new Map();

//             normalizedProfiles.forEach(profile => {
//                 if (profile.country) {
//                     countriesSet.add(profile.country);
//                     if (!citiesMap.has(profile.country)) {
//                         citiesMap.set(profile.country, new Set());
//                     }
//                     if (profile.city) {
//                         citiesMap.get(profile.country).add(profile.city);
//                     }
//                 }
//             });

//             profilesCache.set("profiles:countries", Array.from(countriesSet).sort());
            
//             citiesMap.forEach((citiesSet, country) => {
//                 profilesCache.set(`profiles:cities:${country}`, Array.from(citiesSet).sort());
//             });

//             filterCache.keys.clear();
            
//             console.log(`✅ [CACHE] Кэш обновлен: ${normalizedProfiles.length} профилей, ${countriesSet.size} стран`);
            
//         } catch (error) {
//             console.error('❌ [CACHE] Ошибка кэширования:', error);
//         }
//     },

//     normalizeCityName(cityName) {
//         if (!cityName || typeof cityName !== 'string') return cityName;
//         const trimmedCity = cityName.trim();
//         if (trimmedCity.length === 0) return cityName;
        
//         const lowerCity = trimmedCity.toLowerCase();
//         if (cityNormalizationMap[lowerCity]) {
//             return cityNormalizationMap[lowerCity];
//         }
        
//         for (const [key, value] of Object.entries(cityNormalizationMap)) {
//             if (lowerCity.includes(key) || key.includes(lowerCity)) {
//                 return value;
//             }
//         }
        
//         return trimmedCity.charAt(0).toUpperCase() + trimmedCity.slice(1);
//     },

//     getCachedProfiles() { return profilesCache.get("profiles:all") || null; },
//     getCachedCountries() { return profilesCache.get("profiles:countries") || []; },
//     getCachedCities(country) { return profilesCache.get(`profiles:cities:${country}`) || []; },
//     cacheSubscription(userId, isActive) { sessionsCache.set(`subscription:${userId}`, isActive); },
//     getCachedSubscription(userId) { return sessionsCache.get(`subscription:${userId}`); },
//     cacheFilteredProfiles(filterKey, profiles) { filterCache.set(filterKey, profiles); readingStats.addCacheHit(); },
//     getCachedFilteredProfiles(filterKey) { 
//         const result = filterCache.get(filterKey); 
//         if (result) readingStats.addCacheHit(); else readingStats.addCacheMiss();
//         return result;
//     },
    
//     getCacheStats() {
//         return {
//             profilesCount: profilesCache.get("profiles:all")?.length || 0,
//             filterKeysCount: filterCache.keys.size,
//             sessionsCount: sessionsCache.keys().length,
//             filterCacheLimit: SCALING_CONFIG.CACHE.MAX_FILTER_KEYS
//         };
//     }
// };

// // ===================== ОПТИМИЗИРОВАННАЯ СИСТЕМА ФИЛЬТРАЦИИ =====================
// class AsyncFilterManager {
//     constructor() {
//         this.filterQueue = new PQueue({
//             concurrency: SCALING_CONFIG.PERFORMANCE.MAX_CONCURRENT_FILTERS,
//             timeout: SCALING_CONFIG.MESSAGE_QUEUE.TIMEOUT
//         });
//     }
    
//     async filterProfilesAsync(profiles, filters) {
//         return this.filterQueue.add(async () => {
//             console.log(`🔍 [FILTER] Фильтрация ${profiles.length} профилей`);
            
//             const chunkSize = SCALING_CONFIG.PERFORMANCE.FILTER_CHUNK_SIZE;
//             const results = [];
            
//             for (let i = 0; i < profiles.length; i += chunkSize) {
//                 const chunk = profiles.slice(i, i + chunkSize);
//                 const filteredChunk = this.applyFiltersToChunk(chunk, filters);
//                 results.push(...filteredChunk);
                
//                 if (i % (chunkSize * 2) === 0) {
//                     await new Promise(resolve => setImmediate(resolve));
//                 }
//             }
            
//             console.log(`✅ [FILTER] Завершено: ${results.length} результатов`);
//             return results;
//         });
//     }
    
//     applyFiltersToChunk(chunk, filters) {
//         return chunk.filter(profile => {
//             if (filters.country && profile.country !== filters.country) return false;
//             if (filters.city && profile.city !== filters.city) return false;
//             if (filters.ageRange) {
//                 const age = parseInt(profile.age) || 0;
//                 if (age < filters.ageRange.min || age > filters.ageRange.max) return false;
//             }
//             return true;
//         });
//     }
// }

// const asyncFilterManager = new AsyncFilterManager();

// // ===================== ГЛАВНЫЙ МОДУЛЬ БОТА =====================
// module.exports = (bot, db) => {
//     // ОЧЕРЕДЬ СООБЩЕНИЙ ДЛЯ МАСШТАБИРОВАНИЯ
//     const messageQueue = new PQueue({
//         concurrency: SCALING_CONFIG.MESSAGE_QUEUE.CONCURRENCY,
//         interval: SCALING_CONFIG.MESSAGE_QUEUE.INTERVAL,
//         intervalCap: SCALING_CONFIG.MESSAGE_QUEUE.INTERVAL_CAP,
//         timeout: SCALING_CONFIG.MESSAGE_QUEUE.TIMEOUT,
//         throwOnTimeout: false
//     });

//     // Мониторинг очереди
//     messageQueue.on('active', () => {
//         if (messageQueue.size > 10) {
//             console.log(`📊 [QUEUE] Активные: ${messageQueue.pending} | Ожидание: ${messageQueue.size}`);
//         }
//     });

//     // Rate Limiter
//     const limiter = new RateLimiter({
//         window: 1000,
//         limit: 8,
//         keyGenerator: (ctx) => `${ctx.from.id}:${ctx.updateType}`,
//         onLimitExceeded: (ctx) => {
//             console.log(`⚠️ [RATE LIMIT] Лимит для ${ctx.from.id}`);
//             return ctx.reply("⚠️ Слишком много запросов, подождите...");
//         },
//     });

//     bot.use(limiter);

//     // ===================== ЗАГРУЗКА КЭША =====================
//     async function loadFullProfileCache(db) {
//         try {
//             console.log(`🔄 [CACHE] Загрузка анкет в кэш...`);
//             readingStats.addRead('profiles', null, 1);
            
//             const snapshot = await db.collection("profiles")
//                 .orderBy("createdAt", "desc")
//                 .select("id", "name", "age", "country", "city", "about", "photoUrl", "telegram", "phone", "whatsapp", "photos", "createdAt")
//                 .get();

//             const allProfiles = snapshot.docs.map(doc => ({
//                 id: doc.id,
//                 ...doc.data()
//             }));

//             await cacheManager.cacheProfiles(allProfiles);
//             console.log(`✅ [CACHE] Загружено ${allProfiles.length} анкет`);
            
//         } catch (error) {
//             console.error(`❌ [CACHE] Ошибка загрузки:`, error);
//         }
//     }

//     // Инициализация кэша
//     (async () => {
//         await loadFullProfileCache(db);
//         setInterval(() => loadFullProfileCache(db), 6 * 24 * 60 * 60 * 1000);
//     })();

//     // ===================== СИСТЕМА УПРАВЛЕНИЯ СООБЩЕНИЯМИ =====================
//     const chatStorage = {
//         messages: new Map(),
//         mainMenu: new Map(),
//         userState: new Map(),
//         messageTimestamps: new Map(),
//         countryKeyboard: new Map(),
//         cityKeyboard: new Map(),
//     };

//     // Очистка старых сообщений
//     setInterval(() => {
//         const now = Date.now();
//         let cleanedCount = 0;
        
//         chatStorage.messages.forEach((messages, chatId) => {
//             messages.forEach(messageId => {
//                 if (now - (chatStorage.messageTimestamps.get(messageId) || 0) > SCALING_CONFIG.PERFORMANCE.MESSAGE_TTL) {
//                     messages.delete(messageId);
//                     chatStorage.messageTimestamps.delete(messageId);
//                     cleanedCount++;
//                 }
//             });
            
//             if (messages.size === 0) {
//                 chatStorage.messages.delete(chatId);
//             }
//         });
        
//         if (cleanedCount > 0) {
//             console.log(`🧹 [CLEANUP] Очищено ${cleanedCount} сообщений`);
//         }
//     }, 3600000);

//     // ===================== ОСНОВНЫЕ ФУНКЦИИ =====================
//     const checkSubscription = async (userId) => {
//         try {
//             const cachedSubscription = cacheManager.getCachedSubscription(userId);
//             if (cachedSubscription !== undefined) return cachedSubscription;
            
//             readingStats.addRead('subscriptions', userId, 1);
//             const subRef = db.collection('subscriptions').doc(userId.toString());
//             const doc = await subRef.get();
            
//             if (!doc.exists) {
//                 cacheManager.cacheSubscription(userId, false);
//                 return false;
//             }
            
//             const subData = doc.data();
//             const isActive = subData.isActive && subData.endDate.toDate() > new Date();
//             cacheManager.cacheSubscription(userId, isActive);
//             return isActive;
            
//         } catch (error) {
//             console.error('❌ Ошибка проверки подписки:', error);
//             return false;
//         }
//     };

//     const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null, searchCity = null) => {
//         try {
//             const normalizedSearchCity = searchCity ? cacheManager.normalizeCityName(searchCity) : null;
//             const filterKey = `country:${searchCountry || 'all'}:age:${ageRange?.label || 'all'}:city:${normalizedSearchCity || 'all'}`;
            
//             let filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
            
//             if (!filteredProfiles) {
//                 console.log(`🔍 [FILTER] Промах кэша: ${filterKey}`);
//                 const allProfiles = cacheManager.getCachedProfiles();
//                 if (!allProfiles) {
//                     console.error("❌ [CACHE] Нет профилей в кэше");
//                     return [];
//                 }

//                 filteredProfiles = await asyncFilterManager.filterProfilesAsync(allProfiles, {
//                     country: searchCountry,
//                     city: normalizedSearchCity,
//                     ageRange: ageRange
//                 });

//                 if (filteredProfiles.length > 0) {
//                     cacheManager.cacheFilteredProfiles(filterKey, filteredProfiles);
//                 }
//             }

//             const startIndex = page * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
//             const endIndex = startIndex + SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
//             return filteredProfiles.slice(startIndex, endIndex);

//         } catch (error) {
//             console.error("❌ Ошибка загрузки анкет:", error);
//             return [];
//         }
//     };

//     const getUniqueCountries = async () => cacheManager.getCachedCountries();
//     const getUniqueCitiesForCountry = async (country) => cacheManager.getCachedCities(country);

//     const formatCountryWithFlag = (countryName) => {
//         if (!countryName) return countryName;
//         const popularCountry = POPULAR_COUNTRIES.find(c => c.name === countryName);
//         return popularCountry ? `${popularCountry.flag} ${countryName}` : countryName;
//     };

//     // ===================== СИСТЕМА ПАГИНАЦИИ =====================
//     const createEnhancedPaginationKeyboard = (currentPage, totalPages, filterKey) => {
//         const keyboard = [];
        
//         const navRow = [];
//         if (currentPage > 0) {
//             navRow.push({ text: "⏪", callback_data: `page_first_${currentPage}` });
//             navRow.push({ text: "◀️", callback_data: `page_prev_${currentPage}` });
//         }
        
//         navRow.push({ text: `${currentPage + 1}/${totalPages}`, callback_data: "page_info" });
        
//         if (currentPage < totalPages - 1) {
//             navRow.push({ text: "▶️", callback_data: `page_next_${currentPage}` });
//             navRow.push({ text: "⏩", callback_data: `page_last_${currentPage}` });
//         }
        
//         keyboard.push(navRow);

//         if (totalPages > 10) {
//             const jumpRow = [];
//             const totalProfiles = totalPages * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
//             PAGINATION_JUMP_SECTIONS.forEach(section => {
//                 if (section.start < totalProfiles) {
//                     const sectionPage = Math.floor(section.start / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
//                     if (sectionPage < totalPages) {
//                         jumpRow.push({ text: section.label, callback_data: `page_${sectionPage}_${currentPage}` });
//                     }
//                 }
//             });
            
//             if (jumpRow.length > 0) keyboard.push(jumpRow);
//         }

//         if (totalPages > 1) {
//             const quickPagesRow = [];
//             const pagesToShow = Math.min(5, totalPages);
//             let startPage = Math.max(0, currentPage - Math.floor(pagesToShow / 2));
            
//             if (startPage + pagesToShow > totalPages) startPage = Math.max(0, totalPages - pagesToShow);

//             for (let i = 0; i < pagesToShow; i++) {
//                 const pageNum = startPage + i;
//                 if (pageNum >= 0 && pageNum < totalPages) {
//                     quickPagesRow.push({
//                         text: pageNum === currentPage ? `• ${pageNum + 1} •` : `${pageNum + 1}`,
//                         callback_data: `page_${pageNum}_${currentPage}`,
//                     });
//                 }
//             }
            
//             if (quickPagesRow.length > 0) keyboard.push(quickPagesRow);
//         }

//         return keyboard;
//     };

//     // ===================== МЕНЕДЖЕР СООБЩЕНИЙ =====================
//     const messageManager = {
//         track: function (chatId, messageId) {
//             if (!messageId) return;
//             if (!chatStorage.messages.has(chatId)) chatStorage.messages.set(chatId, new Set());
//             chatStorage.messages.get(chatId).add(messageId);
//             chatStorage.messageTimestamps.set(messageId, Date.now());
//         },

//         clear: async function (ctx, keepCityKeyboard = false, keepCountryKeyboard = false) {
//             const chatId = ctx.chat.id;
//             if (!chatStorage.messages.has(chatId)) return;

//             const messages = [...chatStorage.messages.get(chatId)];
//             const mainMenuId = chatStorage.mainMenu.get(chatId);
//             const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//             const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//             let deletedCount = 0;

//             for (const messageId of messages) {
//                 if (messageId !== mainMenuId && messageId !== countryKeyboardId && messageId !== cityKeyboardId) {
//                     try {
//                         await ctx.telegram.deleteMessage(chatId, messageId);
//                         chatStorage.messages.get(chatId).delete(messageId);
//                         chatStorage.messageTimestamps.delete(messageId);
//                         deletedCount++;
//                     } catch (e) {
//                         if (e.response?.error_code !== 400) console.error(`❌ Ошибка удаления ${messageId}:`, e.message);
//                     }
//                 }
//             }

//             if (cityKeyboardId && !keepCityKeyboard) {
//                 try {
//                     await ctx.telegram.deleteMessage(chatId, cityKeyboardId);
//                     chatStorage.messages.get(chatId).delete(cityKeyboardId);
//                     chatStorage.messageTimestamps.delete(cityKeyboardId);
//                     chatStorage.cityKeyboard.delete(chatId);
//                     deletedCount++;
//                 } catch (e) {
//                     if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
//                 }
//             }

//             if (countryKeyboardId && !keepCountryKeyboard) {
//                 try {
//                     await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
//                     chatStorage.messages.get(chatId).delete(countryKeyboardId);
//                     chatStorage.messageTimestamps.delete(countryKeyboardId);
//                     chatStorage.countryKeyboard.delete(chatId);
//                     deletedCount++;
//                 } catch (e) {
//                     if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
//                 }
//             }

//             chatStorage.userState.delete(ctx.from.id);
//             if (deletedCount > 0) console.log(`🧹 [CLEAN] Удалено ${deletedCount} сообщений для чата ${chatId}`);
//         },

//         sendMainMenu: async function (ctx) {
//             return messageQueue.add(async () => {
//                 const chatId = ctx.chat.id;
//                 const self = this;

//                 try {
//                     if (chatStorage.mainMenu.has(chatId)) {
//                         try {
//                             await ctx.telegram.deleteMessage(chatId, chatStorage.mainMenu.get(chatId));
//                             chatStorage.messages.get(chatId)?.delete(chatStorage.mainMenu.get(chatId));
//                             chatStorage.messageTimestamps.delete(chatStorage.mainMenu.get(chatId));
//                         } catch (e) {
//                             if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления меню:", e);
//                         }
//                     }

//                     const hasSub = await checkSubscription(ctx.from.id);
//                     const menuButtons = [];

//                     menuButtons.push([{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }]);
//                     if (hasSub) menuButtons.push([{ text: "🌍 Все страны", callback_data: "all_countries" }]);
//                     menuButtons.push([{ text: "❌ Очистить экран", callback_data: "clear_screen" }]);

//                     const menu = await ctx.reply("Главное меню:", { reply_markup: { inline_keyboard: menuButtons } });
//                     chatStorage.mainMenu.set(chatId, menu.message_id);
//                     self.track(chatId, menu.message_id);

//                 } catch (error) {
//                     console.error("❌ Ошибка отправки меню:", error);
//                     throw error;
//                 }
//             });
//         },
        
//         sendCountriesKeyboard: async function (ctx) {
//             return messageQueue.add(async () => {
//                 const chatId = ctx.chat.id;
//                 const self = this;

//                 try {
//                     if (chatStorage.countryKeyboard.has(chatId)) {
//                         try {
//                             await ctx.telegram.deleteMessage(chatId, chatStorage.countryKeyboard.get(chatId));
//                             chatStorage.messages.get(chatId)?.delete(chatStorage.countryKeyboard.get(chatId));
//                             chatStorage.messageTimestamps.delete(chatStorage.countryKeyboard.get(chatId));
//                         } catch (e) {
//                             if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
//                         }
//                     }

//                     const uniqueCountries = await getUniqueCountries();
//                     const countriesToShow = uniqueCountries.length > 0 && uniqueCountries.length <= 50 ? uniqueCountries : POPULAR_COUNTRIES.map((c) => c.name);

//                     const keyboard = [];
//                     let row = [];

//                     countriesToShow.forEach((country, index) => {
//                         const countryWithFlag = formatCountryWithFlag(country);
//                         row.push({ text: countryWithFlag, callback_data: `country_${country}` });

//                         if (row.length === 3 || index === countriesToShow.length - 1) {
//                             keyboard.push(row);
//                             row = [];
//                         }
//                     });

//                     keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

//                     const msg = await ctx.reply("Выберите страну:", { reply_markup: { inline_keyboard: keyboard } });
//                     chatStorage.countryKeyboard.set(chatId, msg.message_id);
//                     self.track(chatId, msg.message_id);
//                 } catch (error) {
//                     console.error("❌ Ошибка отправки клавиатуры стран:", error);
//                     throw error;
//                 }
//             });
//         },

//         sendCitiesKeyboard: async function (ctx, country) {
//             return messageQueue.add(async () => {
//                 const chatId = ctx.chat.id;
//                 const self = this;

//                 try {
//                     if (chatStorage.cityKeyboard.has(chatId)) {
//                         try {
//                             await ctx.telegram.deleteMessage(chatId, chatStorage.cityKeyboard.get(chatId));
//                             chatStorage.messages.get(chatId)?.delete(chatStorage.cityKeyboard.get(chatId));
//                             chatStorage.messageTimestamps.delete(chatStorage.cityKeyboard.get(chatId));
//                         } catch (e) {
//                             if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
//                         }
//                     }

//                     const cities = await getUniqueCitiesForCountry(country);
//                     const keyboard = [];
//                     let row = [];

//                     cities.forEach((city, index) => {
//                         row.push({ text: city, callback_data: `city_${city}` });
//                         if (row.length === 3 || index === cities.length - 1) {
//                             keyboard.push(row);
//                             row = [];
//                         }
//                     });

//                     keyboard.push([{ text: "🔙 Назад к странам", callback_data: "back_to_countries" }]);
//                     const msg = await ctx.reply(`Города в ${country}:`, { reply_markup: { inline_keyboard: keyboard } });
//                     chatStorage.cityKeyboard.set(chatId, msg.message_id);
//                     self.track(chatId, msg.message_id);
//                 } catch (error) {
//                     console.error("❌ Ошибка отправки клавиатуры городов:", error);
//                     throw error;
//                 }
//             });
//         },
//     };

//     // ===================== ОБРАБОТЧИКИ КОМАНД =====================
//     bot.command("start", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await messageManager.sendMainMenu(ctx);
//             } catch (error) {
//                 console.error("❌ Ошибка команды start:", error);
//             }
//         });
//     });

//     bot.action("show_profiles", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await ctx.answerCbQuery("Загружаем анкеты...");
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;
//                 ctx.session.filterCountry = null;
//                 ctx.session.displayCountry = null;
//                 ctx.session.ageRange = null;
//                 ctx.session.filterCity = null;

//                 await messageManager.clear(ctx);
//                 const profiles = await getProfilesPage(0);

//                 if (!profiles.length) {
//                     const msg = await ctx.reply("Анкет нет, попробуйте позже");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return;
//                 }

//                 for (let i = 0; i < profiles.length; i++) {
//                     const isLast = i === profiles.length - 1;
//                     await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                     if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                 }

//                 await messageManager.sendMainMenu(ctx);
//             } catch (error) {
//                 console.error("❌ Ошибка показа анкет:", error);
//                 try {
//                     await ctx.answerCbQuery("Ошибка загрузки");
//                     const msg = await ctx.reply("Ошибка загрузки анкет, попробуйте ещё раз");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                 } catch (e) {
//                     console.error("❌ Дополнительная ошибка:", e);
//                 }
//             }
//         });
//     });

//     bot.action("all_countries", async (ctx) => {
//         try {
//             const hasSub = await checkSubscription(ctx.from.id);
//             if (!hasSub) {
//                 await ctx.answerCbQuery("❌ Требуется активная подписка");
//                 return;
//             }
            
//             await ctx.answerCbQuery("Загружаем список стран...");
//             return messageQueue.add(async () => {
//                 try {
//                     await messageManager.clear(ctx);
//                     await messageManager.sendCountriesKeyboard(ctx);
//                 } catch (error) {
//                     console.error("❌ Ошибка обработки списка стран:", error);
//                     await ctx.answerCbQuery("Ошибка загрузки");
//                 }
//             });
//         } catch (error) {
//             console.error("❌ Ошибка в обработчике all_countries:", error);
//             await ctx.answerCbQuery("Произошла ошибка");
//         }
//     });

//     bot.action(/^country_(.+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const country = ctx.match[1];
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;
//                 ctx.session.filterCountry = country;
//                 ctx.session.displayCountry = country;
//                 ctx.session.filterCity = null;

//                 await messageManager.clear(ctx);
//                 await messageManager.sendCitiesKeyboard(ctx, country);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка обработки выбора страны:", error);
//             }
//         });
//     });

//     bot.action(/^city_(.+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const city = ctx.match[1];
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;
//                 ctx.session.filterCity = city;

//                 await messageManager.clear(ctx, true, true);
//                 await messageManager.sendMainMenu(ctx);

//                 const profiles = await getProfilesPage(0, ctx.session.filterCountry, ctx.session.ageRange, city);

//                 if (!profiles.length) {
//                     const msg = await ctx.reply(`Анкет из города "${city}" не найдено`);
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return;
//                 }

//                 for (let i = 0; i < profiles.length; i++) {
//                     const isLast = i === profiles.length - 1;
//                     await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                     if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                 }
//             } catch (error) {
//                 console.error("❌ Ошибка обработки выбора города:", error);
//             }
//         });
//     });

//     bot.action("back_to_countries", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx, false, true);
//                 await messageManager.sendCountriesKeyboard(ctx);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка возврата к странам:", error);
//             }
//         });
//     });
    
//     bot.action("back_to_menu", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await messageManager.sendMainMenu(ctx);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка возврата в меню:", error);
//             }
//         });
//     });

//     bot.action("filter_by_age", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const chatId = ctx.chat.id;
//                 const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//                 const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//                 await messageManager.clear(ctx, true, true);
//                 if (countryKeyboardId) chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
//                 if (cityKeyboardId) chatStorage.cityKeyboard.set(chatId, cityKeyboardId);

//                 const keyboard = AGE_RANGES.map((range) => [
//                     { text: range.label, callback_data: `age_range_${range.label}` },
//                 ]);
                
//                 keyboard.push([{ text: "❌ Сбросить фильтр возраста", callback_data: "age_range_reset" }]);
//                 keyboard.push([{ text: "🔙 Назад в меню", callback_data: "back_to_menu" }]);

//                 const msg = await ctx.reply("Выберите возрастной диапазон:", { reply_markup: { inline_keyboard: keyboard } });
//                 messageManager.track(ctx.chat.id, msg.message_id);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка фильтра по возрасту:", error);
//             }
//         });
//     });

//     bot.action(/^age_range_(.+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const [_, range] = ctx.match;
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;

//                 if (range === "reset") {
//                     ctx.session.ageRange = null;
//                     await ctx.answerCbQuery("✅ Фильтр по возрасту сброшен");
//                 } else {
//                     const selectedRange = AGE_RANGES.find((r) => r.label === range);
//                     if (selectedRange) {
//                         ctx.session.ageRange = selectedRange;
//                         await ctx.answerCbQuery(`✅ Установлен фильтр: ${range} лет`);
//                     }
//                 }

//                 const currentCountry = ctx.session.filterCountry;
//                 const currentCity = ctx.session.filterCity;
//                 const chatId = ctx.chat.id;
//                 const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//                 const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//                 await messageManager.clear(ctx, true, true);
//                 if (countryKeyboardId) chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
//                 if (cityKeyboardId) chatStorage.cityKeyboard.set(chatId, cityKeyboardId);

//                 const profiles = await getProfilesPage(0, currentCountry, ctx.session.ageRange, currentCity);

//                 if (!profiles.length) {
//                     const msg = await ctx.reply("Анкет по выбранным критериям не найдено.");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return;
//                 }

//                 let filtersText = "🎯 Применены фильтры: ";
//                 if (ctx.session.ageRange) filtersText += `Возраст: ${ctx.session.ageRange.label}`;
//                 if (currentCountry) filtersText += `, Страна: ${currentCountry}`;
//                 if (currentCity) filtersText += `, Город: ${currentCity}`;
                
//                 const filtersMsg = await ctx.reply(filtersText);
//                 messageManager.track(ctx.chat.id, filtersMsg.message_id);

//                 for (let i = 0; i < profiles.length; i++) {
//                     const isLast = i === profiles.length - 1;
//                     await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                     if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                 }

//                 if (currentCountry && !currentCity) {
//                     await messageManager.sendCitiesKeyboard(ctx, currentCountry);
//                 } else {
//                     await messageManager.sendMainMenu(ctx);
//                 }
//             } catch (error) {
//                 console.error("❌ Ошибка обработки возрастного диапазона:", error);
//                 await ctx.answerCbQuery("❌ Ошибка применения фильтра");
//             }
//         });
//     });

//     bot.on("text", async (ctx) => {
//         const userId = ctx.from.id;
//         if (chatStorage.userState.get(userId) === "awaiting_country") {
//             await messageQueue.add(async () => {
//                 try {
//                     messageManager.track(ctx.chat.id, ctx.message.message_id);
//                     const countryInput = ctx.message.text.trim();

//                     if (!countryInput) {
//                         const msg = await ctx.reply("Вы не указали страну");
//                         messageManager.track(ctx.chat.id, msg.message_id);
//                         return;
//                     }

//                     await messageManager.clear(ctx);
//                     ctx.session = ctx.session || {};
//                     ctx.session.profilesPage = 0;

//                     const profiles = await getProfilesPage(0, countryInput, ctx.session.ageRange);

//                     let normalizedCountry = null;
//                     if (profiles.length > 0) {
//                         normalizedCountry = profiles[0].country;
//                     } else if (countryInput.toLowerCase() === "рос") {
//                         normalizedCountry = "Россия";
//                     } else {
//                         normalizedCountry = countryInput;
//                     }

//                     ctx.session.filterCountry = countryInput;
//                     ctx.session.displayCountry = normalizedCountry;

//                     if (profiles.length) {
//                         for (let i = 0; i < profiles.length; i++) {
//                             const isLast = i === profiles.length - 1;
//                             await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                             if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                         }
//                     } else {
//                         const msg = await ctx.reply(`Анкет из "${normalizedCountry}" не найдено`);
//                         messageManager.track(ctx.chat.id, msg.message_id);
//                     }

//                     await messageManager.sendMainMenu(ctx);
//                 } catch (error) {
//                     console.error("❌ Ошибка обработки страны:", error);
//                 }
//             });
//         }
//     });

//     bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const [_, action, currentPage] = ctx.match;
//                 let newPage = parseInt(currentPage);

//                 if (action === "first") newPage = 0;
//                 else if (action === "prev") newPage = Math.max(0, newPage - 1);
//                 else if (action === "next") newPage = newPage + 1;
//                 else if (action === "last") {
//                     const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
//                     const filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
//                     newPage = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE) - 1;
//                 } else {
//                     newPage = parseInt(action);
//                 }

//                 await messageManager.clear(ctx, true);
                
//                 ctx.session = ctx.session || {};
//                 const profiles = await getProfilesPage(newPage, ctx.session.filterCountry, ctx.session.ageRange, ctx.session.filterCity);

//                 if (profiles.length) {
//                     ctx.session.profilesPage = newPage;

//                     for (let i = 0; i < profiles.length; i++) {
//                         const isLast = i === profiles.length - 1;
//                         await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast);
//                         if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                     }
//                 } else {
//                     const msg = await ctx.reply("Больше анкет нет");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                 }
//             } catch (error) {
//                 console.error("❌ Ошибка пагинации:", error);
//             }
//         });
//     });

//     bot.action("clear_screen", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await ctx.answerCbQuery("Экран очищен");
//             } catch (error) {
//                 console.error("❌ Ошибка очистки:", error);
//                 await ctx.answerCbQuery("Ошибка при очистке");
//             }
//         });
//     });

//     // ===================== ФУНКЦИЯ ОТПРАВКИ ПРОФИЛЯ =====================
//     const sendProfile = async (ctx, profile, page, total, isLast) => {
//         return messageQueue.add(async () => {
//             try {
//                 const about = profile.about?.length > SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH
//                     ? profile.about.substring(0, SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH - 3) + "..."
//                     : profile.about || "";

//                 const formatTelegram = (username) => {
//                     if (!username) return "";
//                     if (/^[0-9+\-() ]+$/.test(username)) {
//                         const cleanDigits = username.replace(/[^0-9]/g, "");
//                         if (cleanDigits.startsWith('7') || cleanDigits.startsWith('8') || (cleanDigits.length >= 10 && !cleanDigits.startsWith('1'))) {
//                             let telegramNumber = cleanDigits;
//                             if (telegramNumber.startsWith('7') && telegramNumber.length === 11) telegramNumber = telegramNumber.substring(1);
//                             else if (telegramNumber.startsWith('8') && telegramNumber.length === 11) telegramNumber = telegramNumber.substring(1);
//                             return `🔵 <a href="https://t.me/${telegramNumber}">Telegram</a>`;
//                         }
//                     }
//                     if (username.startsWith("https://t.me/")) {
//                         const cleaned = decodeURIComponent(username).replace("https://t.me/", "").replace(/^%40/, "@").replace(/^\+/, "");
//                         return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
//                     }
//                     const cleaned = username.replace(/^[@+]/, "");
//                     return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
//                 };

//                 const formatWhatsApp = (url) => {
//                     if (!url) return "";
//                     if (/^[0-9+\-() ]+$/.test(url)) {
//                         let cleanDigits = url.replace(/[^0-9]/g, "");
//                         if (cleanDigits.startsWith('8') && cleanDigits.length === 11) cleanDigits = '7' + cleanDigits.substring(1);
//                         else if (cleanDigits.length === 10) cleanDigits = '7' + cleanDigits;
//                         if (cleanDigits.length === 11 && cleanDigits.startsWith('7')) return `🟢 <a href="https://wa.me/${cleanDigits}">WhatsApp</a>`;
//                     }
//                     return `🟢 <a href="${url}">WhatsApp</a>`;
//                 };

//                 const formatPhone = (phone) => {
//                     if (!phone) return "";
//                     let cleanDigits = phone.replace(/[^0-9]/g, "");
//                     if (!cleanDigits) return "";
//                     let formattedPhone = phone;
//                     if (cleanDigits.length === 11 || cleanDigits.length === 10) {
//                         if (cleanDigits.startsWith('7') && cleanDigits.length === 11) formattedPhone = `+${cleanDigits}`;
//                         else if (cleanDigits.startsWith('8') && cleanDigits.length === 11) formattedPhone = `+7${cleanDigits.substring(1)}`;
//                         else if (cleanDigits.length === 10) formattedPhone = `+7${cleanDigits}`;
//                     }
//                     return `📞 ${formattedPhone}`;
//                 };

//                 const fullCaption = `
// 👤 <b>${profile.name}</b>, ${profile.age}
// -------------------------------
// ${profile.country},📍${profile.city}
// -------------------------------
// <em>${about.length > 300 ? about.substring(0, 300) + `...<a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook">читать полностью в Эскорт💋Блокнот</a>` : about}</em>
// 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹
// <b>Контакты:</b>
// -------------------------------
// ${profile.phone ? formatPhone(profile.phone) : ""}${profile.telegram ? "\n-------------------------------\n" + formatTelegram(profile.telegram) : ""}${profile.whatsapp ? "\n-------------------------------\n" + formatWhatsApp(profile.whatsapp) : ""}${(profile.phone || profile.telegram || profile.whatsapp) ? "\n-------------------------------" : ""}
// ⚠️ <b>ЕСЛИ КТО-ТО ПРОСИТ: Криптовалюту наперед, деньги на такси🚕 или дорогу, предоплату любым способом, переводы на карты💳 или электронные кошельки, чеки или подтверждения оплаты</b>
// 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 
// <b>ЭТО 100% МОШЕННИКИ!
// НИ В КОЕМ СЛУЧАЕ НЕ ОТПРАВЛЯЙТЕ ПРЕДОПЛАТУ  🛑 ВАС ОБМАНУТ!</b>
// -------------------------------
// <a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook"><b>Escort💋Notebook WebApp</b></a>
// `.trim();

//                 let keyboard = [];
//                 if (isLast) {
//                     const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
//                     const filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
//                     const totalPages = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
                    
//                     keyboard = createEnhancedPaginationKeyboard(page, totalPages, filterKey);

//                     if (ctx.session?.displayCountry || ctx.session?.ageRange?.label || ctx.session?.filterCity) {
//                         let filtersText = "";
//                         if (ctx.session.displayCountry) filtersText += ` ${ctx.session.displayCountry}`;
//                         if (ctx.session.filterCity) {
//                             if (ctx.session.displayCountry) filtersText += ", ";
//                             filtersText += ` ${ctx.session.filterCity}`;
//                         }
//                         if (ctx.session.ageRange?.label) {
//                             if (ctx.session.displayCountry || ctx.session.filterCity) filtersText += ", ";
//                             filtersText += ` ${ctx.session.ageRange.label}`;
//                         }
//                         keyboard.push([{ text: filtersText, callback_data: "filters_info" }]);
//                     }

//                     keyboard.push(
//                         [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
//                         [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//                         [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
//                     );
//                 }

//                 let photosToSend = [];
//                 const seenUrls = new Set();
                
//                 if (Array.isArray(profile.photos) && profile.photos.length > 0) {
//                     profile.photos.forEach(url => {
//                         if (typeof url === 'string' && url.trim() !== '') {
//                             try {
//                                 const urlObj = new URL(url.trim());
//                                 const cleanUrl = urlObj.href;
//                                 if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
//                                     seenUrls.add(cleanUrl);
//                                     photosToSend.push(cleanUrl);
//                                 }
//                             } catch (e) {}
//                         }
//                     });
//                 }
                
//                 if (profile.photoUrl && typeof profile.photoUrl === 'string' && profile.photoUrl.trim() !== '') {
//                     try {
//                         const urlObj = new URL(profile.photoUrl.trim());
//                         const cleanUrl = urlObj.href;
//                         if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
//                             seenUrls.add(cleanUrl);
//                             photosToSend.unshift(cleanUrl);
//                         }
//                     } catch (e) {}
//                 }

//                 photosToSend = photosToSend.slice(0, 10);
                
//                 console.log(`📸 [PHOTO] Уникальные фото для ${profile.name}: ${photosToSend.length}`);

//                 const sendPhotoSafely = async (photoUrl, photoNumber, totalPhotos) => {
//                     try {
//                         const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
//                         const numberEmoji = photoNumber <= 10 ? emojiNumbers[photoNumber - 1] : `${photoNumber}.`;
//                         const photoCaption = `${numberEmoji} Фото ${photoNumber}/${totalPhotos}`;
//                         return await ctx.replyWithPhoto(photoUrl, { caption: photoCaption, parse_mode: "HTML" });
//                     } catch (error) {
//                         console.log(`❌ Ошибка отправки фото ${photoNumber}:`, error.message);
//                         return null;
//                     }
//                 };

//                 let infoMessage = null;
                
//                 if (photosToSend.length > 0) {
//                     const profileInfo = `❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ \n\n👤 <b>${profile.name}</b>, ${profile.age}`;
//                     infoMessage = await ctx.reply(profileInfo, { parse_mode: "HTML" });
//                     messageManager.track(ctx.chat.id, infoMessage.message_id);
//                     await new Promise(resolve => setTimeout(resolve, 300));
//                 }

//                 const sentPhotoMessages = [];
                
//                 if (photosToSend.length === 0) {
//                     console.log(`📭 [PHOTO] Нет валидных фото для ${profile.name}, отправляем только текст`);
//                     const msg = await ctx.reply(fullCaption, {
//                         parse_mode: "HTML",
//                         reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//                     });
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return msg;
//                 }
//                 else {
//                     for (let i = 0; i < photosToSend.length; i++) {
//                         const photoUrl = photosToSend[i];
//                         const photoNumber = i + 1;
//                         const totalPhotos = photosToSend.length;
//                         const photoMsg = await sendPhotoSafely(photoUrl, photoNumber, totalPhotos);
//                         if (photoMsg) {
//                             sentPhotoMessages.push(photoMsg);
//                             messageManager.track(ctx.chat.id, photoMsg.message_id);
//                             if (i < photosToSend.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
//                         }
//                     }
                    
//                     if (sentPhotoMessages.length === 0) {
//                         console.log(`⚠️ [PHOTO] Все фото не удалось отправить для ${profile.name}`);
//                         const fallbackMsg = await ctx.reply(`📷 [Все фото недоступны]\n\n${fullCaption}`, { 
//                             parse_mode: "HTML",
//                             reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//                         });
//                         messageManager.track(ctx.chat.id, fallbackMsg.message_id);
//                         return fallbackMsg;
//                     }
//                 }

//                 await new Promise(resolve => setTimeout(resolve, 300));

//                 const textMsg = await ctx.reply(fullCaption, {
//                     parse_mode: "HTML",
//                     reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//                 });

//                 messageManager.track(ctx.chat.id, textMsg.message_id);
//                 console.log(`✅ [PROFILE] Анкета ${profile.name} отправлена: ${sentPhotoMessages.length} фото + текст`);

//                 return textMsg;

//             } catch (error) {
//                 console.error("❌ Критическая ошибка отправки анкеты:", error);
//                 try {
//                     const fallbackText = `👤 ${profile.name}, ${profile.age}\n📍 ${profile.city}, ${profile.country}\n\n${profile.about || 'Описание недоступно'}\n\n⚠️ Приносим извинения, возникли технические проблемы с отображением фото.`;
//                     const msg = await ctx.reply(fallbackText, { parse_mode: "HTML" });
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return msg;
//                 } catch (finalError) {
//                     console.error("💥 Не удалось отправить даже текстовое сообщение:", finalError);
//                     return null;
//                 }
//             }
//         });
//     };

//     // ===================== ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ =====================
//     bot.command("stats", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const stats = readingStats.getStats();
//                 const cacheStats = cacheManager.getCacheStats();
                
//                 const statsMessage = `
// 📊 **Статистика системы**

// **Операции чтения:**
// • Всего: ${stats.totalReads}
// • Профили: ${stats.operations.profiles}
// • Подписки: ${stats.operations.subscriptions}
// • Кэш попадания: ${stats.operations.cacheHits}
// • Кэш промахи: ${stats.operations.cacheMisses}
// • Эффективность кэша: ${stats.cacheEfficiency}

// **Пользователи:**
// • Уникальные: ${stats.uniqueUsers}
// • Чтений на пользователя: ${stats.readsPerUser.toFixed(2)}

// **Кэш:**
// • Профилей: ${cacheStats.profilesCount}
// • Ключей фильтров: ${cacheStats.filterKeysCount}/${cacheStats.filterCacheLimit}
// • Сессий: ${cacheStats.sessionsCount}

// **Очередь:**
// • Активные задачи: ${messageQueue.pending}
// • Задачи в ожидании: ${messageQueue.size}
//                 `;
                
//                 const msg = await ctx.reply(statsMessage, { parse_mode: "Markdown" });
//                 messageManager.track(ctx.chat.id, msg.message_id);
                
//             } catch (error) {
//                 console.error("❌ Ошибка команды stats:", error);
//             }
//         });
//     });

//     bot.command("reset_stats", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 readingStats.resetStats();
//                 const msg = await ctx.reply("✅ Статистика сброшена");
//                 messageManager.track(ctx.chat.id, msg.message_id);
//             } catch (error) {
//                 console.error("❌ Ошибка сброса статистики:", error);
//             }
//         });
//     });

//     console.log(`✅ Бот инициализирован с оптимизациями для масштабирования`);
// };






// ===================== ИМПОРТЫ И ЗАВИСИМОСТИ =====================
// const RateLimiter = require("telegraf-ratelimit");
// const { default: PQueue } = require("p-queue");
// const NodeCache = require("node-cache");
// const fs = require('fs');
// const path = require('path');

// // ===================== БЛОКИРОВКА ОТ МНОЖЕСТВЕННОГО ЗАПУСКА =====================
// const LOCK_FILE = path.join(__dirname, 'bot.lock');
// if (fs.existsSync(LOCK_FILE)) {
//     const existingPid = fs.readFileSync(LOCK_FILE, 'utf8');
//     console.error(`❌ Бот уже запущен с PID: ${existingPid}`);
//     console.error('❌ Остановите предыдущий процесс или удалите файл bot.lock');
//     process.exit(1);
// }
// fs.writeFileSync(LOCK_FILE, process.pid.toString());
// process.on('exit', () => { 
//     if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); 
// });
// process.on('SIGINT', () => { 
//     if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); 
//     process.exit(0); 
// });

// // ===================== КОНФИГУРАЦИЯ МАСШТАБИРОВАНИЯ =====================
// const SCALING_CONFIG = {
//     // Настройки очереди сообщений для 1000+ пользователей
//     MESSAGE_QUEUE: {
//         CONCURRENCY: 15, // Увеличиваем для обработки пиковой нагрузки
//         INTERVAL: 1000,
//         INTERVAL_CAP: 60, // 60 сообщений в секунду
//         TIMEOUT: 30000,
//     },
    
//     // Настройки кэша
//     CACHE: {
//         PROFILES_TTL: 7 * 24 * 60 * 60, // 7 дней для профилей
//         FILTERS_TTL: 600, // 10 минут для фильтров
//         SESSIONS_TTL: 1800, // 30 минут для сессий
//         MAX_FILTER_KEYS: 200, // Уменьшаем лимит ключей
//         CHECKPERIOD: 300,
//     },
    
//     // Настройки производительности
//     PERFORMANCE: {
//         PROFILES_PER_PAGE: 1,
//         MAX_CAPTION_LENGTH: 900,
//         MESSAGE_TTL: 86400000,
//         FILTER_CHUNK_SIZE: 1000,
//         MAX_CONCURRENT_FILTERS: 3,
//     }
// };

// // ===================== ВСПОМОГАТЕЛЬНЫЕ КОНСТАНТЫ =====================
// const AGE_RANGES = [
//     { label: "18-25", min: 18, max: 25 },
//     { label: "26-35", min: 26, max: 35 },
//     { label: "36-45", min: 36, max: 45 },
//     { label: "46+", min: 46, max: 999 },
// ];

// const POPULAR_COUNTRIES = [
//     { name: "Россия", flag: "🇷🇺" },
//     { name: "Украина", flag: "🇺🇦" },
//     { name: "Беларусь", flag: "🇧🇾" },
//     { name: "Казахстан", flag: "🇰🇿" },
//     { name: "Турция", flag: "🇹🇷" },
//     { name: "Германия", flag: "🇩🇪" },
//     { name: "США", flag: "🇺🇸" },
//     { name: "Израиль", flag: "🇮🇱" },
// ];

// const PAGINATION_JUMP_SECTIONS = [
//     { label: "1-1000", start: 0, end: 999 },
//     { label: "1000-2000", start: 1000, end: 1999 },
//     { label: "2000-3000", start: 2000, end: 2999 },
// ];

// // Карта нормализации украинских городов
// const cityNormalizationMap = {
//   // Украинские города - английские варианты
//   kyiv: "Киев",
//   kiev: "Киев",
//   kiyv: "Киев",
//   "kryvyi rih": "Кривой Рог",
//   "kryvyi rig": "Кривой Рог",
//   odesa: "Одесса",
//   odessa: "Одесса",
//   kharkiv: "Харьков",
//   lviv: "Львов",
//   dnipro: "Днепр",
//   zaporizhzhia: "Запорожье",
//   zaporozhye: "Запорожье",
//   vinnytsia: "Винница",
//   vinnitsa: "Винница",
//   ternopil: "Тернополь",
//   khmelnytskyi: "Хмельницкий",
//   khmelnitsky: "Хмельницкий",
//   cherkasy: "Черкассы",
//   chernivtsi: "Черновцы",
//   chernovtsy: "Черновцы",
//   "ivano-frankivsk": "Ивано-Франковск",
//   kropyvnytskyi: "Кропивницкий",
//   mykolaiv: "Николаев",
//   nikolaev: "Николаев",
//   poltava: "Полтава",
//   rivne: "Ровно",
//   rovno: "Ровно",
//   sumy: "Сумы",
//   uzhhorod: "Ужгород",
//   zhytomyr: "Житомир",
//   kramatorsk: "Краматорск",
//   slovyansk: "Славянск",
//   lutsk: "Луцк",
//   kherson: "Херсон",
//   bukovel: "Буковель",

//   // Украинские города - украинские варианты
//   київ: "Киев",
//   "кривий ріг": "Кривой Рог",
//   одеса: "Одесса",
//   харків: "Харьков",
//   львів: "Львов",
//   дніпро: "Днепр",
//   дніпропетровськ: "Днепр",
//   запоріжжя: "Запорожье",
//   вінниця: "Винница",
//   тернопіль: "Тернополь",
//   хмельницький: "Хмельницкий",
//   черкаси: "Черкассы",
//   чернівці: "Черновцы",
//   "івано-франківськ": "Ивано-Франковск",
//   кропивницький: "Кропивницкий",
//   миколаїв: "Николаев",
//   полтава: "Полтава",
//   рівне: "Ровно",
//   суми: "Сумы",
//   ужгород: "Ужгород",
//   житомир: "Житомир",
//   краматорськ: "Краматорск",
//   "слов'янськ": "Славянск",
//   луцьк: "Луцк",
//   херсон: "Херсон",
//   буковель: "Буковель",
// };

// // ===================== ФУНКЦИЯ ОЧИСТКИ ABOUT ОТ ССЫЛОК =====================
// /**
//  * Функция для очистки текста в поле about от ссылок на сторонние ресурсы
//  * Удаляет предложения, содержащие URL, но сохраняет все остальные поля профиля
//  * @param {string} aboutText - исходный текст из поля about
//  * @returns {string} очищенный текст без предложений со ссылками
//  */

// const replaceSitesInAbout = (aboutText) => {
//     if (!aboutText || typeof aboutText !== 'string') return aboutText;
    
//     // Ищем любые названия сайтов (слова с точкой и доменной зоной)
//     const siteRegex = /[a-zA-Z0-9-]+\.\s*[a-zA-Z]{2,}/g;
    
//     // Заменяем все найденные сайты на ссылку на бота
//     const cleanedAbout = aboutText.replace(siteRegex, 'https://t.me/NotebookForWorldEscortBot');
    
//     return cleanedAbout;
// };

// // ===================== ИНИЦИАЛИЗАЦИЯ СИСТЕМ КЭШИРОВАНИЯ =====================
// // Основной кэш для профилей с длительным временем жизни
// const profilesCache = new NodeCache({ 
//     stdTTL: SCALING_CONFIG.CACHE.PROFILES_TTL,
//     checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD,
//     useClones: false
// });

// // Специальный класс для ограниченного кэша фильтров
// class LimitedFilterCache {
//     constructor() {
//         this.keys = new Set();
//         this.maxKeys = SCALING_CONFIG.CACHE.MAX_FILTER_KEYS;
//     }
    
//     set(key, value) {
//         // Если достигнут лимит ключей, удаляем самый старый
//         if (this.keys.size >= this.maxKeys) {
//             const firstKey = this.keys.values().next().value;
//             profilesCache.del(`filtered:${firstKey}`);
//             this.keys.delete(firstKey);
//         }
//         this.keys.add(key);
//         return profilesCache.set(`filtered:${key}`, value, SCALING_CONFIG.CACHE.FILTERS_TTL);
//     }
    
//     get(key) {
//         return profilesCache.get(`filtered:${key}`);
//     }
// }

// const filterCache = new LimitedFilterCache();

// // Кэш для сессий пользователей с коротким временем жизни
// const sessionsCache = new NodeCache({
//     stdTTL: SCALING_CONFIG.CACHE.SESSIONS_TTL,
//     checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD
// });

// // ===================== СИСТЕМА МОНИТОРИНГА =====================
// const readingStats = {
//     totalReads: 0,
//     operations: { profiles: 0, subscriptions: 0, other: 0, cacheHits: 0, cacheMisses: 0 },
//     timestamps: [],
//     users: new Map(),
    
//     addRead(operationType = 'other', userId = null, count = 1) {
//         this.totalReads += count;
//         this.operations[operationType] = (this.operations[operationType] || 0) + count;
//         this.timestamps.push({ time: Date.now(), type: operationType, count, userId });
        
//         // Ограничиваем размер массива временных меток
//         if (this.timestamps.length > 1000) {
//             this.timestamps = this.timestamps.slice(-500);
//         }
        
//         // Собираем статистику по пользователям
//         if (userId) {
//             if (!this.users.has(userId)) {
//                 this.users.set(userId, { total: 0, operations: {} });
//             }
//             const userStats = this.users.get(userId);
//             userStats.total += count;
//             userStats.operations[operationType] = (userStats.operations[operationType] || 0) + count;
//         }
        
//         console.log(`📖 [READ] ${operationType}: +${count} | Total: ${this.totalReads}`);
//     },
    
//     addCacheHit() { this.operations.cacheHits = (this.operations.cacheHits || 0) + 1; },
//     addCacheMiss() { this.operations.cacheMisses = (this.operations.cacheMisses || 0) + 1; },
    
//     getStats() {
//         const cacheEfficiency = this.operations.cacheHits + this.operations.cacheMisses > 0 
//             ? (this.operations.cacheHits / (this.operations.cacheHits + this.operations.cacheMisses)) * 100 
//             : 0;
            
//         return {
//             totalReads: this.totalReads,
//             operations: this.operations,
//             uniqueUsers: this.users.size,
//             readsPerUser: this.users.size > 0 ? this.totalReads / this.users.size : 0,
//             cacheEfficiency: `${cacheEfficiency.toFixed(2)}%`,
//             timeline: this.timestamps.slice(-100)
//         };
//     },
    
//     resetStats() {
//         this.totalReads = 0;
//         this.operations = { profiles: 0, subscriptions: 0, other: 0, cacheHits: 0, cacheMisses: 0 };
//         this.timestamps = [];
//         this.users.clear();
//     }
// };

// // ===================== ОПТИМИЗИРОВАННЫЙ КЭШ-МЕНЕДЖЕР =====================
// const cacheManager = {
//     /**
//      * Кэширует профили в память с предварительной обработкой:
//      * - Нормализует названия городов
//      * - Очищает поле about от ссылок на сторонние ресурсы
//      * - Сохраняет все остальные поля (включая фото) без изменений
//      */
//     async cacheProfiles(profiles) {
//         try {
//             console.log(`🔄 [CACHE] Загрузка ${profiles.length} анкет в кэш...`);
            
//             // Обрабатываем каждый профиль:
//             // - Сохраняем ВСЕ оригинальные поля с помощью spread оператора
//             // - Нормализуем только город
//             // - Очищаем ТОЛЬКО поле about от ссылок
//             const normalizedProfiles = profiles.map(profile => ({
//                 ...profile, // Сохраняем все поля: id, name, age, photoUrl, photos, telegram, phone, whatsapp и т.д.
//                 city: this.normalizeCityName(profile.city),
//                 about: replaceSitesInAbout(profile.about) // ОЧИСТКА ТОЛЬКО ABOUT ОТ ССЫЛОК
//             }));
            
//             // Сохраняем обработанные профили в кэш
//             profilesCache.set("profiles:all", normalizedProfiles);
            
//             // Собираем уникальные страны и города для фильтров
//             const countriesSet = new Set();
//             const citiesMap = new Map();

//             normalizedProfiles.forEach(profile => {
//                 if (profile.country) {
//                     countriesSet.add(profile.country);
//                     if (!citiesMap.has(profile.country)) {
//                         citiesMap.set(profile.country, new Set());
//                     }
//                     if (profile.city) {
//                         citiesMap.get(profile.country).add(profile.city);
//                     }
//                 }
//             });

//             // Кэшируем списки стран и городов
//             profilesCache.set("profiles:countries", Array.from(countriesSet).sort());
            
//             citiesMap.forEach((citiesSet, country) => {
//                 profilesCache.set(`profiles:cities:${country}`, Array.from(citiesSet).sort());
//             });

//             // Очищаем кэш фильтров при обновлении профилей
//             filterCache.keys.clear();
            
//             console.log(`✅ [CACHE] Кэш обновлен: ${normalizedProfiles.length} профилей, ${countriesSet.size} стран`);
            
//         } catch (error) {
//             console.error('❌ [CACHE] Ошибка кэширования:', error);
//         }
//     },

//     /**
//      * Нормализует название города используя карту нормализации
//      */
//     normalizeCityName(cityName) {
//         if (!cityName || typeof cityName !== 'string') return cityName;
//         const trimmedCity = cityName.trim();
//         if (trimmedCity.length === 0) return cityName;
        
//         const lowerCity = trimmedCity.toLowerCase();
//         if (cityNormalizationMap[lowerCity]) {
//             return cityNormalizationMap[lowerCity];
//         }
        
//         // Поиск частичного совпадения в карте нормализации
//         for (const [key, value] of Object.entries(cityNormalizationMap)) {
//             if (lowerCity.includes(key) || key.includes(lowerCity)) {
//                 return value;
//             }
//         }
        
//         // Если совпадений нет, возвращаем оригинальное название с заглавной буквы
//         return trimmedCity.charAt(0).toUpperCase() + trimmedCity.slice(1);
//     },

//     // Методы доступа к закэшированным данным
//     getCachedProfiles() { return profilesCache.get("profiles:all") || null; },
//     getCachedCountries() { return profilesCache.get("profiles:countries") || []; },
//     getCachedCities(country) { return profilesCache.get(`profiles:cities:${country}`) || []; },
    
//     // Методы для работы с подписками
//     cacheSubscription(userId, isActive) { sessionsCache.set(`subscription:${userId}`, isActive); },
//     getCachedSubscription(userId) { return sessionsCache.get(`subscription:${userId}`); },
    
//     // Методы для работы с фильтрами
//     cacheFilteredProfiles(filterKey, profiles) { filterCache.set(filterKey, profiles); readingStats.addCacheHit(); },
//     getCachedFilteredProfiles(filterKey) { 
//         const result = filterCache.get(filterKey); 
//         if (result) readingStats.addCacheHit(); else readingStats.addCacheMiss();
//         return result;
//     },
    
//     // Статистика кэша
//     getCacheStats() {
//         return {
//             profilesCount: profilesCache.get("profiles:all")?.length || 0,
//             filterKeysCount: filterCache.keys.size,
//             sessionsCount: sessionsCache.keys().length,
//             filterCacheLimit: SCALING_CONFIG.CACHE.MAX_FILTER_KEYS
//         };
//     }
// };

// // ===================== ОПТИМИЗИРОВАННАЯ СИСТЕМА ФИЛЬТРАЦИИ =====================
// class AsyncFilterManager {
//     constructor() {
//         this.filterQueue = new PQueue({
//             concurrency: SCALING_CONFIG.PERFORMANCE.MAX_CONCURRENT_FILTERS,
//             timeout: SCALING_CONFIG.MESSAGE_QUEUE.TIMEOUT
//         });
//     }
    
//     /**
//      * Асинхронная фильтрация профилей с чанкированием для производительности
//      */
//     async filterProfilesAsync(profiles, filters) {
//         return this.filterQueue.add(async () => {
//             console.log(`🔍 [FILTER] Фильтрация ${profiles.length} профилей`);
            
//             const chunkSize = SCALING_CONFIG.PERFORMANCE.FILTER_CHUNK_SIZE;
//             const results = [];
            
//             // Обрабатываем профили чанками для снижения нагрузки на память
//             for (let i = 0; i < profiles.length; i += chunkSize) {
//                 const chunk = profiles.slice(i, i + chunkSize);
//                 const filteredChunk = this.applyFiltersToChunk(chunk, filters);
//                 results.push(...filteredChunk);
                
//                 // Периодически даем event loop возможность обработать другие задачи
//                 if (i % (chunkSize * 2) === 0) {
//                     await new Promise(resolve => setImmediate(resolve));
//                 }
//             }
            
//             console.log(`✅ [FILTER] Завершено: ${results.length} результатов`);
//             return results;
//         });
//     }
    
//     /**
//      * Применяет фильтры к чанку профилей
//      */
//     applyFiltersToChunk(chunk, filters) {
//         return chunk.filter(profile => {
//             // Фильтр по стране
//             if (filters.country && profile.country !== filters.country) return false;
//             // Фильтр по городу
//             if (filters.city && profile.city !== filters.city) return false;
//             // Фильтр по возрасту
//             if (filters.ageRange) {
//                 const age = parseInt(profile.age) || 0;
//                 if (age < filters.ageRange.min || age > filters.ageRange.max) return false;
//             }
//             return true;
//         });
//     }
// }

// const asyncFilterManager = new AsyncFilterManager();

// // ===================== ГЛАВНЫЙ МОДУЛЬ БОТА =====================
// module.exports = (bot, db) => {
//     // ОЧЕРЕДЬ СООБЩЕНИЙ ДЛЯ МАСШТАБИРОВАНИЯ
//     const messageQueue = new PQueue({
//         concurrency: SCALING_CONFIG.MESSAGE_QUEUE.CONCURRENCY,
//         interval: SCALING_CONFIG.MESSAGE_QUEUE.INTERVAL,
//         intervalCap: SCALING_CONFIG.MESSAGE_QUEUE.INTERVAL_CAP,
//         timeout: SCALING_CONFIG.MESSAGE_QUEUE.TIMEOUT,
//         throwOnTimeout: false
//     });

//     // Мониторинг очереди
//     messageQueue.on('active', () => {
//         if (messageQueue.size > 10) {
//             console.log(`📊 [QUEUE] Активные: ${messageQueue.pending} | Ожидание: ${messageQueue.size}`);
//         }
//     });

//     // Rate Limiter для защиты от спама
//     const limiter = new RateLimiter({
//         window: 1000,
//         limit: 8,
//         keyGenerator: (ctx) => `${ctx.from.id}:${ctx.updateType}`,
//         onLimitExceeded: (ctx) => {
//             console.log(`⚠️ [RATE LIMIT] Лимит для ${ctx.from.id}`);
//             return ctx.reply("⚠️ Слишком много запросов, подождите...");
//         },
//     });

//     bot.use(limiter);

//     // ===================== ЗАГРУЗКА КЭША =====================
//     /**
//      * Загружает все профили из базы данных в кэш
//      * В процессе загрузки автоматически очищает поле about от ссылок
//      */
//     async function loadFullProfileCache(db) {
//         try {
//             console.log(`🔄 [CACHE] Загрузка анкет в кэш...`);
//             readingStats.addRead('profiles', null, 1);
            
//             const snapshot = await db.collection("profiles")
//                 .orderBy("createdAt", "desc")
//                 .select("id", "name", "age", "country", "city", "about", "photoUrl", "telegram", "phone", "whatsapp", "photos", "createdAt")
//                 .get();

//             const allProfiles = snapshot.docs.map(doc => ({
//                 id: doc.id,
//                 ...doc.data()
//             }));

//             // Загружаем профили в кэш с автоматической очисткой about от ссылок
//             await cacheManager.cacheProfiles(allProfiles);
//             console.log(`✅ [CACHE] Загружено ${allProfiles.length} анкет`);
            
//         } catch (error) {
//             console.error(`❌ [CACHE] Ошибка загрузки:`, error);
//         }
//     }

//     // Инициализация кэша при запуске и периодическое обновление
//     (async () => {
//         await loadFullProfileCache(db);
//         // Обновляем кэш каждые 6 дней
//         setInterval(() => loadFullProfileCache(db), 6 * 24 * 60 * 60 * 1000);
//     })();

//     // ===================== СИСТЕМА УПРАВЛЕНИЯ СООБЩЕНИЯМИ =====================
//     const chatStorage = {
//         messages: new Map(),           // ID сообщений по чатам
//         mainMenu: new Map(),           // ID главного меню по чатам  
//         userState: new Map(),          // Состояния пользователей
//         messageTimestamps: new Map(),  // Временные метки сообщений
//         countryKeyboard: new Map(),    // ID клавиатур стран
//         cityKeyboard: new Map(),       // ID клавиатур городов
//     };

//     // Очистка старых сообщений для управления памятью
//     setInterval(() => {
//         const now = Date.now();
//         let cleanedCount = 0;
        
//         chatStorage.messages.forEach((messages, chatId) => {
//             messages.forEach(messageId => {
//                 if (now - (chatStorage.messageTimestamps.get(messageId) || 0) > SCALING_CONFIG.PERFORMANCE.MESSAGE_TTL) {
//                     messages.delete(messageId);
//                     chatStorage.messageTimestamps.delete(messageId);
//                     cleanedCount++;
//                 }
//             });
            
//             if (messages.size === 0) {
//                 chatStorage.messages.delete(chatId);
//             }
//         });
        
//         if (cleanedCount > 0) {
//             console.log(`🧹 [CLEANUP] Очищено ${cleanedCount} сообщений`);
//         }
//     }, 3600000); // Каждый час

//     // ===================== ОСНОВНЫЕ ФУНКЦИИ =====================
//     /**
//      * Проверяет активность подписки пользователя
//      * Использует кэш для снижения нагрузки на базу данных
//      */
//     const checkSubscription = async (userId) => {
//         try {
//             // Сначала проверяем кэш
//             const cachedSubscription = cacheManager.getCachedSubscription(userId);
//             if (cachedSubscription !== undefined) return cachedSubscription;
            
//             // Если нет в кэше, загружаем из базы
//             readingStats.addRead('subscriptions', userId, 1);
//             const subRef = db.collection('subscriptions').doc(userId.toString());
//             const doc = await subRef.get();
            
//             if (!doc.exists) {
//                 cacheManager.cacheSubscription(userId, false);
//                 return false;
//             }
            
//             const subData = doc.data();
//             const isActive = subData.isActive && subData.endDate.toDate() > new Date();
//             cacheManager.cacheSubscription(userId, isActive);
//             return isActive;
            
//         } catch (error) {
//             console.error('❌ Ошибка проверки подписки:', error);
//             return false;
//         }
//     };

//     /**
//      * Получает страницу профилей с применением фильтров
//      * Использует кэширование результатов фильтрации для производительности
//      */
//     const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null, searchCity = null) => {
//         try {
//             // Нормализуем город для поиска
//             const normalizedSearchCity = searchCity ? cacheManager.normalizeCityName(searchCity) : null;
            
//             // Создаем ключ для кэша фильтров
//             const filterKey = `country:${searchCountry || 'all'}:age:${ageRange?.label || 'all'}:city:${normalizedSearchCity || 'all'}`;
            
//             // Пытаемся получить отфильтрованные профили из кэша
//             let filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
            
//             if (!filteredProfiles) {
//                 console.log(`🔍 [FILTER] Промах кэша: ${filterKey}`);
//                 const allProfiles = cacheManager.getCachedProfiles();
//                 if (!allProfiles) {
//                     console.error("❌ [CACHE] Нет профилей в кэше");
//                     return [];
//                 }

//                 // Фильтруем профили асинхронно
//                 filteredProfiles = await asyncFilterManager.filterProfilesAsync(allProfiles, {
//                     country: searchCountry,
//                     city: normalizedSearchCity,
//                     ageRange: ageRange
//                 });

//                 // Кэшируем результаты фильтрации
//                 if (filteredProfiles.length > 0) {
//                     cacheManager.cacheFilteredProfiles(filterKey, filteredProfiles);
//                 }
//             }

//             // Вычисляем диапазон для пагинации
//             const startIndex = page * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
//             const endIndex = startIndex + SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
//             return filteredProfiles.slice(startIndex, endIndex);

//         } catch (error) {
//             console.error("❌ Ошибка загрузки анкет:", error);
//             return [];
//         }
//     };

//     // Вспомогательные функции для получения данных
//     const getUniqueCountries = async () => cacheManager.getCachedCountries();
//     const getUniqueCitiesForCountry = async (country) => cacheManager.getCachedCities(country);

//     /**
//      * Форматирует название страны с добавлением флага
//      */
//     const formatCountryWithFlag = (countryName) => {
//         if (!countryName) return countryName;
//         const popularCountry = POPULAR_COUNTRIES.find(c => c.name === countryName);
//         return popularCountry ? `${popularCountry.flag} ${countryName}` : countryName;
//     };

//     // ===================== СИСТЕМА ПАГИНАЦИИ =====================
//     /**
//      * Создает расширенную клавиатуру пагинации с быстрыми переходами
//      */
//     const createEnhancedPaginationKeyboard = (currentPage, totalPages, filterKey) => {
//         const keyboard = [];
        
//         // Основная навигация
//         const navRow = [];
//         if (currentPage > 0) {
//             navRow.push({ text: "⏪", callback_data: `page_first_${currentPage}` });
//             navRow.push({ text: "◀️", callback_data: `page_prev_${currentPage}` });
//         }
        
//         navRow.push({ text: `${currentPage + 1}/${totalPages}`, callback_data: "page_info" });
        
//         if (currentPage < totalPages - 1) {
//             navRow.push({ text: "▶️", callback_data: `page_next_${currentPage}` });
//             navRow.push({ text: "⏩", callback_data: `page_last_${currentPage}` });
//         }
        
//         keyboard.push(navRow);

//         // Быстрые переходы по секциям для большого количества страниц
//         if (totalPages > 10) {
//             const jumpRow = [];
//             const totalProfiles = totalPages * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
//             PAGINATION_JUMP_SECTIONS.forEach(section => {
//                 if (section.start < totalProfiles) {
//                     const sectionPage = Math.floor(section.start / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
//                     if (sectionPage < totalPages) {
//                         jumpRow.push({ text: section.label, callback_data: `page_${sectionPage}_${currentPage}` });
//                     }
//                 }
//             });
            
//             if (jumpRow.length > 0) keyboard.push(jumpRow);
//         }

//         // Быстрый выбор страниц
//         if (totalPages > 1) {
//             const quickPagesRow = [];
//             const pagesToShow = Math.min(5, totalPages);
//             let startPage = Math.max(0, currentPage - Math.floor(pagesToShow / 2));
            
//             if (startPage + pagesToShow > totalPages) startPage = Math.max(0, totalPages - pagesToShow);

//             for (let i = 0; i < pagesToShow; i++) {
//                 const pageNum = startPage + i;
//                 if (pageNum >= 0 && pageNum < totalPages) {
//                     quickPagesRow.push({
//                         text: pageNum === currentPage ? `• ${pageNum + 1} •` : `${pageNum + 1}`,
//                         callback_data: `page_${pageNum}_${currentPage}`,
//                     });
//                 }
//             }
            
//             if (quickPagesRow.length > 0) keyboard.push(quickPagesRow);
//         }

//         return keyboard;
//     };

//     // ===================== МЕНЕДЖЕР СООБЩЕНИЙ =====================
//     const messageManager = {
//         /**
//          * Отслеживает сообщение для последующего управления
//          */
//         track: function (chatId, messageId) {
//             if (!messageId) return;
//             if (!chatStorage.messages.has(chatId)) chatStorage.messages.set(chatId, new Set());
//             chatStorage.messages.get(chatId).add(messageId);
//             chatStorage.messageTimestamps.set(messageId, Date.now());
//         },

//         /**
//          * Очищает сообщения в чате с опциональным сохранением клавиатур
//          */
//         clear: async function (ctx, keepCityKeyboard = false, keepCountryKeyboard = false) {
//             const chatId = ctx.chat.id;
//             if (!chatStorage.messages.has(chatId)) return;

//             const messages = [...chatStorage.messages.get(chatId)];
//             const mainMenuId = chatStorage.mainMenu.get(chatId);
//             const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//             const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//             let deletedCount = 0;

//             // Удаляем все сообщения кроме исключенных
//             for (const messageId of messages) {
//                 if (messageId !== mainMenuId && messageId !== countryKeyboardId && messageId !== cityKeyboardId) {
//                     try {
//                         await ctx.telegram.deleteMessage(chatId, messageId);
//                         chatStorage.messages.get(chatId).delete(messageId);
//                         chatStorage.messageTimestamps.delete(messageId);
//                         deletedCount++;
//                     } catch (e) {
//                         if (e.response?.error_code !== 400) console.error(`❌ Ошибка удаления ${messageId}:`, e.message);
//                     }
//                 }
//             }

//             // Удаляем клавиатуру городов если не нужно сохранять
//             if (cityKeyboardId && !keepCityKeyboard) {
//                 try {
//                     await ctx.telegram.deleteMessage(chatId, cityKeyboardId);
//                     chatStorage.messages.get(chatId).delete(cityKeyboardId);
//                     chatStorage.messageTimestamps.delete(cityKeyboardId);
//                     chatStorage.cityKeyboard.delete(chatId);
//                     deletedCount++;
//                 } catch (e) {
//                     if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
//                 }
//             }

//             // Удаляем клавиатуру стран если не нужно сохранять
//             if (countryKeyboardId && !keepCountryKeyboard) {
//                 try {
//                     await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
//                     chatStorage.messages.get(chatId).delete(countryKeyboardId);
//                     chatStorage.messageTimestamps.delete(countryKeyboardId);
//                     chatStorage.countryKeyboard.delete(chatId);
//                     deletedCount++;
//                 } catch (e) {
//                     if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
//                 }
//             }

//             // Очищаем состояние пользователя
//             chatStorage.userState.delete(ctx.from.id);
//             if (deletedCount > 0) console.log(`🧹 [CLEAN] Удалено ${deletedCount} сообщений для чата ${chatId}`);
//         },

//         /**
//          * Отправляет главное меню
//          */
//         sendMainMenu: async function (ctx) {
//             return messageQueue.add(async () => {
//                 const chatId = ctx.chat.id;
//                 const self = this;

//                 try {
//                     // Удаляем предыдущее меню если есть
//                     if (chatStorage.mainMenu.has(chatId)) {
//                         try {
//                             await ctx.telegram.deleteMessage(chatId, chatStorage.mainMenu.get(chatId));
//                             chatStorage.messages.get(chatId)?.delete(chatStorage.mainMenu.get(chatId));
//                             chatStorage.messageTimestamps.delete(chatStorage.mainMenu.get(chatId));
//                         } catch (e) {
//                             if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления меню:", e);
//                         }
//                     }

//                     // Проверяем подписку для определения доступных функций
//                     const hasSub = await checkSubscription(ctx.from.id);
//                     const menuButtons = [];

//                     menuButtons.push([{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }]);
//                     if (hasSub) menuButtons.push([{ text: "🌍 Все страны", callback_data: "all_countries" }]);
//                     menuButtons.push([{ text: "❌ Очистить экран", callback_data: "clear_screen" }]);

//                     const menu = await ctx.reply("Главное меню:", { reply_markup: { inline_keyboard: menuButtons } });
//                     chatStorage.mainMenu.set(chatId, menu.message_id);
//                     self.track(chatId, menu.message_id);

//                 } catch (error) {
//                     console.error("❌ Ошибка отправки меню:", error);
//                     throw error;
//                 }
//             });
//         },
        
//         /**
//          * Отправляет клавиатуру выбора стран
//          */
//         sendCountriesKeyboard: async function (ctx) {
//             return messageQueue.add(async () => {
//                 const chatId = ctx.chat.id;
//                 const self = this;

//                 try {
//                     // Удаляем предыдущую клавиатуру стран если есть
//                     if (chatStorage.countryKeyboard.has(chatId)) {
//                         try {
//                             await ctx.telegram.deleteMessage(chatId, chatStorage.countryKeyboard.get(chatId));
//                             chatStorage.messages.get(chatId)?.delete(chatStorage.countryKeyboard.get(chatId));
//                             chatStorage.messageTimestamps.delete(chatStorage.countryKeyboard.get(chatId));
//                         } catch (e) {
//                             if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
//                         }
//                     }

//                     // Получаем список стран
//                     const uniqueCountries = await getUniqueCountries();
//                     const countriesToShow = uniqueCountries.length > 0 && uniqueCountries.length <= 50 ? uniqueCountries : POPULAR_COUNTRIES.map((c) => c.name);

//                     // Создаем клавиатуру
//                     const keyboard = [];
//                     let row = [];

//                     countriesToShow.forEach((country, index) => {
//                         const countryWithFlag = formatCountryWithFlag(country);
//                         row.push({ text: countryWithFlag, callback_data: `country_${country}` });

//                         if (row.length === 3 || index === countriesToShow.length - 1) {
//                             keyboard.push(row);
//                             row = [];
//                         }
//                     });

//                     keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

//                     const msg = await ctx.reply("Выберите страну:", { reply_markup: { inline_keyboard: keyboard } });
//                     chatStorage.countryKeyboard.set(chatId, msg.message_id);
//                     self.track(chatId, msg.message_id);
//                 } catch (error) {
//                     console.error("❌ Ошибка отправки клавиатуры стран:", error);
//                     throw error;
//                 }
//             });
//         },

//         /**
//          * Отправляет клавиатуру выбора городов для указанной страны
//          */
//         sendCitiesKeyboard: async function (ctx, country) {
//             return messageQueue.add(async () => {
//                 const chatId = ctx.chat.id;
//                 const self = this;

//                 try {
//                     // Удаляем предыдущую клавиатуру городов если есть
//                     if (chatStorage.cityKeyboard.has(chatId)) {
//                         try {
//                             await ctx.telegram.deleteMessage(chatId, chatStorage.cityKeyboard.get(chatId));
//                             chatStorage.messages.get(chatId)?.delete(chatStorage.cityKeyboard.get(chatId));
//                             chatStorage.messageTimestamps.delete(chatStorage.cityKeyboard.get(chatId));
//                         } catch (e) {
//                             if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
//                         }
//                     }

//                     // Получаем список городов для страны
//                     const cities = await getUniqueCitiesForCountry(country);
//                     const keyboard = [];
//                     let row = [];

//                     cities.forEach((city, index) => {
//                         row.push({ text: city, callback_data: `city_${city}` });
//                         if (row.length === 3 || index === cities.length - 1) {
//                             keyboard.push(row);
//                             row = [];
//                         }
//                     });

//                     keyboard.push([{ text: "🔙 Назад к странам", callback_data: "back_to_countries" }]);
//                     const msg = await ctx.reply(`Города в ${country}:`, { reply_markup: { inline_keyboard: keyboard } });
//                     chatStorage.cityKeyboard.set(chatId, msg.message_id);
//                     self.track(chatId, msg.message_id);
//                 } catch (error) {
//                     console.error("❌ Ошибка отправки клавиатуры городов:", error);
//                     throw error;
//                 }
//             });
//         },
//     };

//     // ===================== ОБРАБОТЧИКИ КОМАНД =====================
    
//     // Команда /start - инициализация бота
//     bot.command("start", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await messageManager.sendMainMenu(ctx);
//             } catch (error) {
//                 console.error("❌ Ошибка команды start:", error);
//             }
//         });
//     });

//     // Действие: показать профили
//     bot.action("show_profiles", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await ctx.answerCbQuery("Загружаем анкеты...");
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;
//                 ctx.session.filterCountry = null;
//                 ctx.session.displayCountry = null;
//                 ctx.session.ageRange = null;
//                 ctx.session.filterCity = null;

//                 await messageManager.clear(ctx);
//                 const profiles = await getProfilesPage(0);

//                 if (!profiles.length) {
//                     const msg = await ctx.reply("Анкет нет, попробуйте позже");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return;
//                 }

//                 // Отправляем профили по одному с задержкой
//                 for (let i = 0; i < profiles.length; i++) {
//                     const isLast = i === profiles.length - 1;
//                     await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                     if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                 }

//                 await messageManager.sendMainMenu(ctx);
//             } catch (error) {
//                 console.error("❌ Ошибка показа анкет:", error);
//                 try {
//                     await ctx.answerCbQuery("Ошибка загрузки");
//                     const msg = await ctx.reply("Ошибка загрузки анкет, попробуйте ещё раз");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                 } catch (e) {
//                     console.error("❌ Дополнительная ошибка:", e);
//                 }
//             }
//         });
//     });

//     // Действие: показать все страны (только для подписанных пользователей)
//     bot.action("all_countries", async (ctx) => {
//         try {
//             const hasSub = await checkSubscription(ctx.from.id);
//             if (!hasSub) {
//                 await ctx.answerCbQuery("❌ Требуется активная подписка");
//                 return;
//             }
            
//             await ctx.answerCbQuery("Загружаем список стран...");
//             return messageQueue.add(async () => {
//                 try {
//                     await messageManager.clear(ctx);
//                     await messageManager.sendCountriesKeyboard(ctx);
//                 } catch (error) {
//                     console.error("❌ Ошибка обработки списка стран:", error);
//                     await ctx.answerCbQuery("Ошибка загрузки");
//                 }
//             });
//         } catch (error) {
//             console.error("❌ Ошибка в обработчике all_countries:", error);
//             await ctx.answerCbQuery("Произошла ошибка");
//         }
//     });

//     // Действие: выбор страны
//     bot.action(/^country_(.+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const country = ctx.match[1];
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;
//                 ctx.session.filterCountry = country;
//                 ctx.session.displayCountry = country;
//                 ctx.session.filterCity = null;

//                 await messageManager.clear(ctx);
//                 await messageManager.sendCitiesKeyboard(ctx, country);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка обработки выбора страны:", error);
//             }
//         });
//     });

//     // Действие: выбор города
//     bot.action(/^city_(.+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const city = ctx.match[1];
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;
//                 ctx.session.filterCity = city;

//                 await messageManager.clear(ctx, true, true);
//                 await messageManager.sendMainMenu(ctx);

//                 const profiles = await getProfilesPage(0, ctx.session.filterCountry, ctx.session.ageRange, city);

//                 if (!profiles.length) {
//                     const msg = await ctx.reply(`Анкет из города "${city}" не найдено`);
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return;
//                 }

//                 for (let i = 0; i < profiles.length; i++) {
//                     const isLast = i === profiles.length - 1;
//                     await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                     if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                 }
//             } catch (error) {
//                 console.error("❌ Ошибка обработки выбора города:", error);
//             }
//         });
//     });

//     // Действие: возврат к списку стран
//     bot.action("back_to_countries", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx, false, true);
//                 await messageManager.sendCountriesKeyboard(ctx);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка возврата к странам:", error);
//             }
//         });
//     });
    
//     // Действие: возврат в главное меню
//     bot.action("back_to_menu", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await messageManager.sendMainMenu(ctx);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка возврата в меню:", error);
//             }
//         });
//     });

//     // Действие: фильтр по возрасту
//     bot.action("filter_by_age", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const chatId = ctx.chat.id;
//                 const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//                 const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//                 await messageManager.clear(ctx, true, true);
//                 if (countryKeyboardId) chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
//                 if (cityKeyboardId) chatStorage.cityKeyboard.set(chatId, cityKeyboardId);

//                 const keyboard = AGE_RANGES.map((range) => [
//                     { text: range.label, callback_data: `age_range_${range.label}` },
//                 ]);
                
//                 keyboard.push([{ text: "❌ Сбросить фильтр возраста", callback_data: "age_range_reset" }]);
//                 keyboard.push([{ text: "🔙 Назад в меню", callback_data: "back_to_menu" }]);

//                 const msg = await ctx.reply("Выберите возрастной диапазон:", { reply_markup: { inline_keyboard: keyboard } });
//                 messageManager.track(ctx.chat.id, msg.message_id);
//                 await ctx.answerCbQuery();
//             } catch (error) {
//                 console.error("❌ Ошибка фильтра по возрасту:", error);
//             }
//         });
//     });

//     // Действие: выбор возрастного диапазона
//     bot.action(/^age_range_(.+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const [_, range] = ctx.match;
//                 ctx.session = ctx.session || {};
//                 ctx.session.profilesPage = 0;

//                 if (range === "reset") {
//                     ctx.session.ageRange = null;
//                     await ctx.answerCbQuery("✅ Фильтр по возрасту сброшен");
//                 } else {
//                     const selectedRange = AGE_RANGES.find((r) => r.label === range);
//                     if (selectedRange) {
//                         ctx.session.ageRange = selectedRange;
//                         await ctx.answerCbQuery(`✅ Установлен фильтр: ${range} лет`);
//                     }
//                 }

//                 const currentCountry = ctx.session.filterCountry;
//                 const currentCity = ctx.session.filterCity;
//                 const chatId = ctx.chat.id;
//                 const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
//                 const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

//                 await messageManager.clear(ctx, true, true);
//                 if (countryKeyboardId) chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
//                 if (cityKeyboardId) chatStorage.cityKeyboard.set(chatId, cityKeyboardId);

//                 const profiles = await getProfilesPage(0, currentCountry, ctx.session.ageRange, currentCity);

//                 if (!profiles.length) {
//                     const msg = await ctx.reply("Анкет по выбранным критериям не найдено.");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return;
//                 }

//                 // Показываем примененные фильтры
//                 let filtersText = "🎯 Применены фильтры: ";
//                 if (ctx.session.ageRange) filtersText += `Возраст: ${ctx.session.ageRange.label}`;
//                 if (currentCountry) filtersText += `, Страна: ${currentCountry}`;
//                 if (currentCity) filtersText += `, Город: ${currentCity}`;
                
//                 const filtersMsg = await ctx.reply(filtersText);
//                 messageManager.track(ctx.chat.id, filtersMsg.message_id);

//                 // Отправляем профили
//                 for (let i = 0; i < profiles.length; i++) {
//                     const isLast = i === profiles.length - 1;
//                     await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                     if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                 }

//                 // Показываем соответствующую клавиатуру
//                 if (currentCountry && !currentCity) {
//                     await messageManager.sendCitiesKeyboard(ctx, currentCountry);
//                 } else {
//                     await messageManager.sendMainMenu(ctx);
//                 }
//             } catch (error) {
//                 console.error("❌ Ошибка обработки возрастного диапазона:", error);
//                 await ctx.answerCbQuery("❌ Ошибка применения фильтра");
//             }
//         });
//     });

//     // Обработчик текстовых сообщений (для ручного ввода страны)
//     bot.on("text", async (ctx) => {
//         const userId = ctx.from.id;
//         if (chatStorage.userState.get(userId) === "awaiting_country") {
//             await messageQueue.add(async () => {
//                 try {
//                     messageManager.track(ctx.chat.id, ctx.message.message_id);
//                     const countryInput = ctx.message.text.trim();

//                     if (!countryInput) {
//                         const msg = await ctx.reply("Вы не указали страну");
//                         messageManager.track(ctx.chat.id, msg.message_id);
//                         return;
//                     }

//                     await messageManager.clear(ctx);
//                     ctx.session = ctx.session || {};
//                     ctx.session.profilesPage = 0;

//                     const profiles = await getProfilesPage(0, countryInput, ctx.session.ageRange);

//                     let normalizedCountry = null;
//                     if (profiles.length > 0) {
//                         normalizedCountry = profiles[0].country;
//                     } else if (countryInput.toLowerCase() === "рос") {
//                         normalizedCountry = "Россия";
//                     } else {
//                         normalizedCountry = countryInput;
//                     }

//                     ctx.session.filterCountry = countryInput;
//                     ctx.session.displayCountry = normalizedCountry;

//                     if (profiles.length) {
//                         for (let i = 0; i < profiles.length; i++) {
//                             const isLast = i === profiles.length - 1;
//                             await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
//                             if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                         }
//                     } else {
//                         const msg = await ctx.reply(`Анкет из "${normalizedCountry}" не найдено`);
//                         messageManager.track(ctx.chat.id, msg.message_id);
//                     }

//                     await messageManager.sendMainMenu(ctx);
//                 } catch (error) {
//                     console.error("❌ Ошибка обработки страны:", error);
//                 }
//             });
//         }
//     });

//     // Действие: пагинация
//     bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const [_, action, currentPage] = ctx.match;
//                 let newPage = parseInt(currentPage);

//                 if (action === "first") newPage = 0;
//                 else if (action === "prev") newPage = Math.max(0, newPage - 1);
//                 else if (action === "next") newPage = newPage + 1;
//                 else if (action === "last") {
//                     const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
//                     const filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
//                     newPage = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE) - 1;
//                 } else {
//                     newPage = parseInt(action);
//                 }

//                 await messageManager.clear(ctx, true);
                
//                 ctx.session = ctx.session || {};
//                 const profiles = await getProfilesPage(newPage, ctx.session.filterCountry, ctx.session.ageRange, ctx.session.filterCity);

//                 if (profiles.length) {
//                     ctx.session.profilesPage = newPage;

//                     for (let i = 0; i < profiles.length; i++) {
//                         const isLast = i === profiles.length - 1;
//                         await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast);
//                         if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
//                     }
//                 } else {
//                     const msg = await ctx.reply("Больше анкет нет");
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                 }
//             } catch (error) {
//                 console.error("❌ Ошибка пагинации:", error);
//             }
//         });
//     });

//     // Действие: очистка экрана
//     bot.action("clear_screen", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 await messageManager.clear(ctx);
//                 await ctx.answerCbQuery("Экран очищен");
//             } catch (error) {
//                 console.error("❌ Ошибка очистки:", error);
//                 await ctx.answerCbQuery("Ошибка при очистке");
//             }
//         });
//     });

//     // ===================== ФУНКЦИЯ ОТПРАВКИ ПРОФИЛЯ =====================
//     /**
//      * Отправляет профиль пользователю с фото и информацией
//      * Использует уже очищенный от ссылок about из кэша
//      */
//     const sendProfile = async (ctx, profile, page, total, isLast) => {
//         return messageQueue.add(async () => {
//             try {
//                 // Используем уже очищенный about из кэша (обработан в cacheManager.cacheProfiles)
//                 // Обрезаем текст если он слишком длинный
//                 const about = profile.about?.length > SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH
//                     ? profile.about.substring(0, SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH - 3) + "..."
//                     : profile.about || "";

//                 /**
//                  * Форматирует username Telegram для создания ссылки
//                  */
//                 const formatTelegram = (username) => {
//                     if (!username) return "";
//                     if (/^[0-9+\-() ]+$/.test(username)) {
//                         const cleanDigits = username.replace(/[^0-9]/g, "");
//                         if (cleanDigits.startsWith('7') || cleanDigits.startsWith('8') || (cleanDigits.length >= 10 && !cleanDigits.startsWith('1'))) {
//                             let telegramNumber = cleanDigits;
//                             if (telegramNumber.startsWith('7') && telegramNumber.length === 11) telegramNumber = telegramNumber.substring(1);
//                             else if (telegramNumber.startsWith('8') && telegramNumber.length === 11) telegramNumber = telegramNumber.substring(1);
//                             return `🔵 <a href="https://t.me/${telegramNumber}">Telegram</a>`;
//                         }
//                     }
//                     if (username.startsWith("https://t.me/")) {
//                         const cleaned = decodeURIComponent(username).replace("https://t.me/", "").replace(/^%40/, "@").replace(/^\+/, "");
//                         return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
//                     }
//                     const cleaned = username.replace(/^[@+]/, "");
//                     return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
//                 };

//                 /**
//                  * Форматирует номер WhatsApp для создания ссылки
//                  */
//                 const formatWhatsApp = (url) => {
//                     if (!url) return "";
//                     if (/^[0-9+\-() ]+$/.test(url)) {
//                         let cleanDigits = url.replace(/[^0-9]/g, "");
//                         if (cleanDigits.startsWith('8') && cleanDigits.length === 11) cleanDigits = '7' + cleanDigits.substring(1);
//                         else if (cleanDigits.length === 10) cleanDigits = '7' + cleanDigits;
//                         if (cleanDigits.length === 11 && cleanDigits.startsWith('7')) return `🟢 <a href="https://wa.me/${cleanDigits}">WhatsApp</a>`;
//                     }
//                     return `🟢 <a href="${url}">WhatsApp</a>`;
//                 };

//                 /**
//                  * Форматирует номер телефона для отображения
//                  */
//                 const formatPhone = (phone) => {
//                     if (!phone) return "";
//                     let cleanDigits = phone.replace(/[^0-9]/g, "");
//                     if (!cleanDigits) return "";
//                     let formattedPhone = phone;
//                     if (cleanDigits.length === 11 || cleanDigits.length === 10) {
//                         if (cleanDigits.startsWith('7') && cleanDigits.length === 11) formattedPhone = `+${cleanDigits}`;
//                         else if (cleanDigits.startsWith('8') && cleanDigits.length === 11) formattedPhone = `+7${cleanDigits.substring(1)}`;
//                         else if (cleanDigits.length === 10) formattedPhone = `+7${cleanDigits}`;
//                     }
//                     return `📞 ${formattedPhone}`;
//                 };

//                 // Формируем полное описание профиля
//                 const fullCaption = `
// 👤 <b>${profile.name}</b>, ${profile.age}
// -------------------------------
// ${profile.country},📍${profile.city}
// -------------------------------
// <em>${about.length > 300 ? about.substring(0, 300) + `...<a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook">читать полностью в Эскорт💋Блокнот</a>` : about}</em>
// 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹
// <b>Контакты:</b>
// -------------------------------
// ${profile.phone ? formatPhone(profile.phone) : ""}${profile.telegram ? "\n-------------------------------\n" + formatTelegram(profile.telegram) : ""}${profile.whatsapp ? "\n-------------------------------\n" + formatWhatsApp(profile.whatsapp) : ""}${(profile.phone || profile.telegram || profile.whatsapp) ? "\n-------------------------------" : ""}
// ⚠️ <b>ЕСЛИ КТО-ТО ПРОСИТ: Криптовалюту наперед, деньги на такси🚕 или дорогу, предоплату любым способом, переводы на карты💳 или электронные кошельки, чеки или подтверждения оплаты</b>
// 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 
// <b>ЭТО 100% МОШЕННИКИ!
// НИ В КОЕМ СЛУЧАЕ НЕ ОТПРАВЛЯЙТЕ ПРЕДОПЛАТУ  🛑 ВАС ОБМАНУТ!</b>
// -------------------------------
// <a href="http://t.me/NotebookForWorldEscortBot/EscortNotebook"><b>Escort💋Notebook WebApp</b></a>
// `.trim();

//                 let keyboard = [];
//                 if (isLast) {
//                     const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
//                     const filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
//                     const totalPages = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
                    
//                     keyboard = createEnhancedPaginationKeyboard(page, totalPages, filterKey);

//                     // Добавляем информацию о примененных фильтрах
//                     if (ctx.session?.displayCountry || ctx.session?.ageRange?.label || ctx.session?.filterCity) {
//                         let filtersText = "";
//                         if (ctx.session.displayCountry) filtersText += ` ${ctx.session.displayCountry}`;
//                         if (ctx.session.filterCity) {
//                             if (ctx.session.displayCountry) filtersText += ", ";
//                             filtersText += ` ${ctx.session.filterCity}`;
//                         }
//                         if (ctx.session.ageRange?.label) {
//                             if (ctx.session.displayCountry || ctx.session.filterCity) filtersText += ", ";
//                             filtersText += ` ${ctx.session.ageRange.label}`;
//                         }
//                         keyboard.push([{ text: filtersText, callback_data: "filters_info" }]);
//                     }

//                     // Добавляем кнопки управления
//                     keyboard.push(
//                         [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
//                         [{ text: "🌍 Все страны", callback_data: "all_countries" }],
//                         [{ text: "❌ Очистить экран", callback_data: "clear_screen" }]
//                     );
//                 }

//                 // Подготовка фото для отправки
//                 let photosToSend = [];
//                 const seenUrls = new Set();
                
//                 // Обрабатываем массив photos (сохраняем оригинальные ссылки на фото)
//                 if (Array.isArray(profile.photos) && profile.photos.length > 0) {
//                     profile.photos.forEach(url => {
//                         if (typeof url === 'string' && url.trim() !== '') {
//                             try {
//                                 const urlObj = new URL(url.trim());
//                                 const cleanUrl = urlObj.href;
//                                 if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
//                                     seenUrls.add(cleanUrl);
//                                     photosToSend.push(cleanUrl);
//                                 }
//                             } catch (e) {}
//                         }
//                     });
//                 }
                
//                 // Добавляем основное фото (сохраняем оригинальную ссылку)
//                 if (profile.photoUrl && typeof profile.photoUrl === 'string' && profile.photoUrl.trim() !== '') {
//                     try {
//                         const urlObj = new URL(profile.photoUrl.trim());
//                         const cleanUrl = urlObj.href;
//                         if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
//                             seenUrls.add(cleanUrl);
//                             photosToSend.unshift(cleanUrl); // Основное фото в начало
//                         }
//                     } catch (e) {}
//                 }

//                 // Ограничиваем количество фото
//                 photosToSend = photosToSend.slice(0, 10);
                
//                 console.log(`📸 [PHOTO] Уникальные фото для ${profile.name}: ${photosToSend.length}`);

//                 /**
//                  * Безопасно отправляет фото с обработкой ошибок
//                  */
//                 const sendPhotoSafely = async (photoUrl, photoNumber, totalPhotos) => {
//                     try {
//                         const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
//                         const numberEmoji = photoNumber <= 10 ? emojiNumbers[photoNumber - 1] : `${photoNumber}.`;
//                         const photoCaption = `${numberEmoji} Фото ${photoNumber}/${totalPhotos}`;
//                         return await ctx.replyWithPhoto(photoUrl, { caption: photoCaption, parse_mode: "HTML" });
//                     } catch (error) {
//                         console.log(`❌ Ошибка отправки фото ${photoNumber}:`, error.message);
//                         return null;
//                     }
//                 };

//                 let infoMessage = null;
                
//                 // Если есть фото, отправляем информационное сообщение
//                 if (photosToSend.length > 0) {
//                     const profileInfo = `❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ \n <a href="https://t.me/escortnotebook"><b>Новые анкеты в нашем ➡️ канале</b></a>\n\n`;
//                     infoMessage = await ctx.reply(profileInfo, { parse_mode: "HTML" });
//                     messageManager.track(ctx.chat.id, infoMessage.message_id);
//                     await new Promise(resolve => setTimeout(resolve, 300));
//                 }

//                 const sentPhotoMessages = [];
                
//                 // Если фото нет, отправляем только текстовое описание
//                 if (photosToSend.length === 0) {
//                     console.log(`📭 [PHOTO] Нет валидных фото для ${profile.name}, отправляем только текст`);
//                     const msg = await ctx.reply(fullCaption, {
//                         parse_mode: "HTML",
//                         reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//                     });
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return msg;
//                 }
//                 else {
//                     // Отправляем все фото по очереди
//                     for (let i = 0; i < photosToSend.length; i++) {
//                         const photoUrl = photosToSend[i];
//                         const photoNumber = i + 1;
//                         const totalPhotos = photosToSend.length;
//                         const photoMsg = await sendPhotoSafely(photoUrl, photoNumber, totalPhotos);
//                         if (photoMsg) {
//                             sentPhotoMessages.push(photoMsg);
//                             messageManager.track(ctx.chat.id, photoMsg.message_id);
//                             if (i < photosToSend.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
//                         }
//                     }
                    
//                     // Если ни одно фото не отправилось
//                     if (sentPhotoMessages.length === 0) {
//                         console.log(`⚠️ [PHOTO] Все фото не удалось отправить для ${profile.name}`);
//                         const fallbackMsg = await ctx.reply(`📷 [Все фото недоступны]\n\n${fullCaption}`, { 
//                             parse_mode: "HTML",
//                             reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//                         });
//                         messageManager.track(ctx.chat.id, fallbackMsg.message_id);
//                         return fallbackMsg;
//                     }
//                 }

//                 // Задержка перед отправкой текстового описания
//                 await new Promise(resolve => setTimeout(resolve, 300));

//                 // Отправляем текстовое описание профиля
//                 const textMsg = await ctx.reply(fullCaption, {
//                     parse_mode: "HTML",
//                     reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
//                 });

//                 messageManager.track(ctx.chat.id, textMsg.message_id);
//                 console.log(`✅ [PROFILE] Анкета ${profile.name} отправлена: ${sentPhotoMessages.length} фото + текст`);

//                 return textMsg;

//             } catch (error) {
//                 console.error("❌ Критическая ошибка отправки анкеты:", error);
//                 try {
//                     // Fallback: отправляем упрощенную версию профиля
//                     const fallbackText = `👤 ${profile.name}, ${profile.age}\n📍 ${profile.city}, ${profile.country}\n\n${profile.about || 'Описание недоступно'}\n\n⚠️ Приносим извинения, возникли технические проблемы с отображением фото.`;
//                     const msg = await ctx.reply(fallbackText, { parse_mode: "HTML" });
//                     messageManager.track(ctx.chat.id, msg.message_id);
//                     return msg;
//                 } catch (finalError) {
//                     console.error("💥 Не удалось отправить даже текстовое сообщение:", finalError);
//                     return null;
//                 }
//             }
//         });
//     };

//     // ===================== ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ =====================
    
//     // Команда /stats - статистика системы
//     bot.command("stats", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 const stats = readingStats.getStats();
//                 const cacheStats = cacheManager.getCacheStats();
                
//                 const statsMessage = `
// 📊 **Статистика системы**

// **Операции чтения:**
// • Всего: ${stats.totalReads}
// • Профили: ${stats.operations.profiles}
// • Подписки: ${stats.operations.subscriptions}
// • Кэш попадания: ${stats.operations.cacheHits}
// • Кэш промахи: ${stats.operations.cacheMisses}
// • Эффективность кэша: ${stats.cacheEfficiency}

// **Пользователи:**
// • Уникальные: ${stats.uniqueUsers}
// • Чтений на пользователя: ${stats.readsPerUser.toFixed(2)}

// **Кэш:**
// • Профилей: ${cacheStats.profilesCount}
// • Ключей фильтров: ${cacheStats.filterKeysCount}/${cacheStats.filterCacheLimit}
// • Сессий: ${cacheStats.sessionsCount}

// **Очередь:**
// • Активные задачи: ${messageQueue.pending}
// • Задачи в ожидании: ${messageQueue.size}
//                 `;
                
//                 const msg = await ctx.reply(statsMessage, { parse_mode: "Markdown" });
//                 messageManager.track(ctx.chat.id, msg.message_id);
                
//             } catch (error) {
//                 console.error("❌ Ошибка команды stats:", error);
//             }
//         });
//     });

//     // Команда /reset_stats - сброс статистики
//     bot.command("reset_stats", async (ctx) => {
//         await messageQueue.add(async () => {
//             try {
//                 readingStats.resetStats();
//                 const msg = await ctx.reply("✅ Статистика сброшена");
//                 messageManager.track(ctx.chat.id, msg.message_id);
//             } catch (error) {
//                 console.error("❌ Ошибка сброса статистики:", error);
//             }
//         });
//     });

//     console.log(`✅ Бот инициализирован с оптимизациями для масштабирования`);
//     console.log(`✅ Функция очистки about от ссылок активирована`);
// };
// ===================== ИМПОРТЫ И ЗАВИСИМОСТИ =====================
const RateLimiter = require("telegraf-ratelimit");
const { default: PQueue } = require("p-queue");
const NodeCache = require("node-cache");
const fs = require('fs');
const path = require('path');

// ===================== БЛОКИРОВКА ОТ МНОЖЕСТВЕННОГО ЗАПУСКА =====================
const LOCK_FILE = path.join(__dirname, 'bot.lock');
if (fs.existsSync(LOCK_FILE)) {
    const existingPid = fs.readFileSync(LOCK_FILE, 'utf8');
    console.error(`❌ Бот уже запущен с PID: ${existingPid}`);
    console.error('❌ Остановите предыдущий процесс или удалите файл bot.lock');
    process.exit(1);
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());
process.on('exit', () => { 
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); 
});
process.on('SIGINT', () => { 
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); 
    process.exit(0); 
});

// ===================== СИСТЕМА БЛОКИРОВКИ ПОЛЬЗОВАТЕЛЯ =====================
const userLocks = new Map();

/**
 * Проверяет и устанавливает блокировку для пользователя
 * @param {number} userId - ID пользователя
 * @param {number} timeoutMs - время блокировки в мс
 * @returns {boolean} true - если блокировка установлена, false - если пользователь уже заблокирован
 */
const acquireUserLock = (userId, timeoutMs = 2500) => {
    const now = Date.now();
    const userLock = userLocks.get(userId);
    
    if (userLock && now < userLock.expires) {
        return false; // Пользователь уже выполняет действие
    }
    
    userLocks.set(userId, {
        expires: now + timeoutMs,
        timestamp: now
    });
    return true;
};

/**
 * Освобождает блокировку пользователя
 * @param {number} userId - ID пользователя
 */
const releaseUserLock = (userId) => {
    userLocks.delete(userId);
};

/**
 * Очищает старые блокировки (профилактика утечек памяти)
 */
setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    
    userLocks.forEach((lock, userId) => {
        if (now >= lock.expires) {
            userLocks.delete(userId);
            cleanedCount++;
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`🧹 [LOCKS] Очищено ${cleanedCount} старых блокировок`);
    }
}, 60000); // Каждую минуту

// ===================== КОНФИГУРАЦИЯ МАСШТАБИРОВАНИЯ =====================
const SCALING_CONFIG = {
    // Настройки очереди сообщений для 1000+ пользователей
    MESSAGE_QUEUE: {
        CONCURRENCY: 15, // Увеличиваем для обработки пиковой нагрузки
        INTERVAL: 1000,
        INTERVAL_CAP: 60, // 60 сообщений в секунду
        TIMEOUT: 30000,
    },
    
    // Настройки кэша
    CACHE: {
        PROFILES_TTL: 7 * 24 * 60 * 60, // 7 дней для профилей
        FILTERS_TTL: 600, // 10 минут для фильтров
        SESSIONS_TTL: 1800, // 30 минут для сессий
        MAX_FILTER_KEYS: 200, // Уменьшаем лимит ключей
        CHECKPERIOD: 300,
    },
    
    // Настройки производительности
    PERFORMANCE: {
        PROFILES_PER_PAGE: 1,
        MAX_CAPTION_LENGTH: 900,
        MESSAGE_TTL: 86400000,
        FILTER_CHUNK_SIZE: 1000,
        MAX_CONCURRENT_FILTERS: 3,
    }
};

// ===================== ВСПОМОГАТЕЛЬНЫЕ КОНСТАНТЫ =====================
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

const PAGINATION_JUMP_SECTIONS = [
    { label: "1-1000", start: 0, end: 999 },
    { label: "1000-2000", start: 1000, end: 1999 },
    { label: "2000-3000", start: 2000, end: 2999 },
];

// Карта нормализации украинских городов
const cityNormalizationMap = {
  // Украинские города - английские варианты
  kyiv: "Киев",
  kiev: "Киев",
  kiyv: "Киев",
  "kryvyi rih": "Кривой Рог",
  "kryvyi rig": "Кривой Рог",
  odesa: "Одесса",
  odessa: "Одесса",
  kharkiv: "Харьков",
  lviv: "Львов",
  dnipro: "Днепр",
  zaporizhzhia: "Запорожье",
  zaporozhye: "Запорожье",
  vinnytsia: "Винница",
  vinnitsa: "Винница",
  ternopil: "Тернополь",
  khmelnytskyi: "Хмельницкий",
  khmelnitsky: "Хмельницкий",
  cherkasy: "Черкассы",
  chernivtsi: "Черновцы",
  chernovtsy: "Черновцы",
  "ivano-frankivsk": "Ивано-Франковск",
  kropyvnytskyi: "Кропивницкий",
  mykolaiv: "Николаев",
  nikolaev: "Николаев",
  poltava: "Полтава",
  rivne: "Ровно",
  rovno: "Ровно",
  sumy: "Сумы",
  uzhhorod: "Ужгород",
  zhytomyr: "Житомир",
  kramatorsk: "Краматорск",
  slovyansk: "Славянск",
  lutsk: "Луцк",
  kherson: "Херсон",
  bukovel: "Буковель",

  // Украинские города - украинские варианты
  київ: "Киев",
  "кривий ріг": "Кривой Рог",
  одеса: "Одесса",
  харків: "Харьков",
  львів: "Львов",
  дніпро: "Днепр",
  дніпропетровськ: "Днепр",
  запоріжжя: "Запорожье",
  вінниця: "Винница",
  тернопіль: "Тернополь",
  хмельницький: "Хмельницкий",
  черкаси: "Черкассы",
  чернівці: "Черновцы",
  "івано-франківськ": "Ивано-Франковск",
  кропивницький: "Кропивницкий",
  миколаїв: "Николаев",
  полтава: "Полтава",
  рівне: "Ровно",
  суми: "Сумы",
  ужгород: "Ужгород",
  житомир: "Житомир",
  краматорськ: "Краматорск",
  "слов'янськ": "Славянск",
  луцьк: "Луцк",
  херсон: "Херсон",
  буковель: "Буковель",
};

// ===================== ФУНКЦИЯ ОЧИСТКИ ABOUT ОТ ССЫЛОК =====================
/**
 * Функция для очистки текста в поле about от ссылок на сторонние ресурсы
 * Удаляет предложения, содержащие URL, но сохраняет все остальные поля профиля
 * @param {string} aboutText - исходный текст из поля about
 * @returns {string} очищенный текст без предложений со ссылками
 */

const replaceSitesInAbout = (aboutText) => {
    if (!aboutText || typeof aboutText !== 'string') return aboutText;
    
    // Ищем любые названия сайтов (слова с точкой и доменной зоной)
    const siteRegex = /[a-zA-Z0-9-]+\.\s*[a-zA-Z]{2,}/g;
    
    // Заменяем все найденные сайты на ссылку на бота
    const cleanedAbout = aboutText.replace(siteRegex, 'https://t.me/NotebookForWorldEscortBot');
    
    return cleanedAbout;
};

// ===================== ИНИЦИАЛИЗАЦИЯ СИСТЕМ КЭШИРОВАНИЯ =====================
// Основной кэш для профилей с длительным временем жизни
const profilesCache = new NodeCache({ 
    stdTTL: SCALING_CONFIG.CACHE.PROFILES_TTL,
    checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD,
    useClones: false
});

// Специальный класс для ограниченного кэша фильтров
class LimitedFilterCache {
    constructor() {
        this.keys = new Set();
        this.maxKeys = SCALING_CONFIG.CACHE.MAX_FILTER_KEYS;
    }
    
    set(key, value) {
        // Если достигнут лимит ключей, удаляем самый старый
        if (this.keys.size >= this.maxKeys) {
            const firstKey = this.keys.values().next().value;
            profilesCache.del(`filtered:${firstKey}`);
            this.keys.delete(firstKey);
        }
        this.keys.add(key);
        return profilesCache.set(`filtered:${key}`, value, SCALING_CONFIG.CACHE.FILTERS_TTL);
    }
    
    get(key) {
        return profilesCache.get(`filtered:${key}`);
    }
}

const filterCache = new LimitedFilterCache();

// Кэш для сессий пользователей с коротким временем жизни
const sessionsCache = new NodeCache({
    stdTTL: SCALING_CONFIG.CACHE.SESSIONS_TTL,
    checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD
});

// ===================== СИСТЕМА МОНИТОРИНГА =====================
const readingStats = {
    totalReads: 0,
    operations: { profiles: 0, subscriptions: 0, other: 0, cacheHits: 0, cacheMisses: 0 },
    timestamps: [],
    users: new Map(),
    
    addRead(operationType = 'other', userId = null, count = 1) {
        this.totalReads += count;
        this.operations[operationType] = (this.operations[operationType] || 0) + count;
        this.timestamps.push({ time: Date.now(), type: operationType, count, userId });
        
        // Ограничиваем размер массива временных меток
        if (this.timestamps.length > 1000) {
            this.timestamps = this.timestamps.slice(-500);
        }
        
        // Собираем статистику по пользователям
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
    
    addCacheHit() { this.operations.cacheHits = (this.operations.cacheHits || 0) + 1; },
    addCacheMiss() { this.operations.cacheMisses = (this.operations.cacheMisses || 0) + 1; },
    
    getStats() {
        const cacheEfficiency = this.operations.cacheHits + this.operations.cacheMisses > 0 
            ? (this.operations.cacheHits / (this.operations.cacheHits + this.operations.cacheMisses)) * 100 
            : 0;
            
        return {
            totalReads: this.totalReads,
            operations: this.operations,
            uniqueUsers: this.users.size,
            readsPerUser: this.users.size > 0 ? this.totalReads / this.users.size : 0,
            cacheEfficiency: `${cacheEfficiency.toFixed(2)}%`,
            timeline: this.timestamps.slice(-100)
        };
    },
    
    resetStats() {
        this.totalReads = 0;
        this.operations = { profiles: 0, subscriptions: 0, other: 0, cacheHits: 0, cacheMisses: 0 };
        this.timestamps = [];
        this.users.clear();
    }
};

// ===================== ОПТИМИЗИРОВАННЫЙ КЭШ-МЕНЕДЖЕР =====================
const cacheManager = {
    /**
     * Кэширует профили в память с предварительной обработкой:
     * - Нормализует названия городов
     * - Очищает поле about от ссылок на сторонние ресурсы
     * - Сохраняет все остальные поля (включая фото) без изменений
     */
    async cacheProfiles(profiles) {
        try {
            console.log(`🔄 [CACHE] Загрузка ${profiles.length} анкет в кэш...`);
            
            // Обрабатываем каждый профиль:
            // - Сохраняем ВСЕ оригинальные поля с помощью spread оператора
            // - Нормализуем только город
            // - Очищаем ТОЛЬКО поле about от ссылок
            const normalizedProfiles = profiles.map(profile => ({
                ...profile, // Сохраняем все поля: id, name, age, photoUrl, photos, telegram, phone, whatsapp и т.д.
                city: this.normalizeCityName(profile.city),
                about: replaceSitesInAbout(profile.about) // ОЧИСТКА ТОЛЬКО ABOUT ОТ ССЫЛОК
            }));
            
            // Сохраняем обработанные профили в кэш
            profilesCache.set("profiles:all", normalizedProfiles);
            
            // Собираем уникальные страны и города для фильтров
            const countriesSet = new Set();
            const citiesMap = new Map();

            normalizedProfiles.forEach(profile => {
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

            // Кэшируем списки стран и городов
            profilesCache.set("profiles:countries", Array.from(countriesSet).sort());
            
            citiesMap.forEach((citiesSet, country) => {
                profilesCache.set(`profiles:cities:${country}`, Array.from(citiesSet).sort());
            });

            // Очищаем кэш фильтров при обновлении профилей
            filterCache.keys.clear();
            
            console.log(`✅ [CACHE] Кэш обновлен: ${normalizedProfiles.length} профилей, ${countriesSet.size} стран`);
            
        } catch (error) {
            console.error('❌ [CACHE] Ошибка кэширования:', error);
        }
    },

    /**
     * Нормализует название города используя карту нормализации
     */
    normalizeCityName(cityName) {
        if (!cityName || typeof cityName !== 'string') return cityName;
        const trimmedCity = cityName.trim();
        if (trimmedCity.length === 0) return cityName;
        
        const lowerCity = trimmedCity.toLowerCase();
        if (cityNormalizationMap[lowerCity]) {
            return cityNormalizationMap[lowerCity];
        }
        
        // Поиск частичного совпадения в карте нормализации
        for (const [key, value] of Object.entries(cityNormalizationMap)) {
            if (lowerCity.includes(key) || key.includes(lowerCity)) {
                return value;
            }
        }
        
        // Если совпадений нет, возвращаем оригинальное название с заглавной буквы
        return trimmedCity.charAt(0).toUpperCase() + trimmedCity.slice(1);
    },

    // Методы доступа к закэшированным данным
    getCachedProfiles() { return profilesCache.get("profiles:all") || null; },
    getCachedCountries() { return profilesCache.get("profiles:countries") || []; },
    getCachedCities(country) { return profilesCache.get(`profiles:cities:${country}`) || []; },
    
    // Методы для работы с подписками
    cacheSubscription(userId, isActive) { sessionsCache.set(`subscription:${userId}`, isActive); },
    getCachedSubscription(userId) { return sessionsCache.get(`subscription:${userId}`); },
    
    // Методы для работы с фильтрами
    cacheFilteredProfiles(filterKey, profiles) { filterCache.set(filterKey, profiles); readingStats.addCacheHit(); },
    getCachedFilteredProfiles(filterKey) { 
        const result = filterCache.get(filterKey); 
        if (result) readingStats.addCacheHit(); else readingStats.addCacheMiss();
        return result;
    },
    
    // Статистика кэша
    getCacheStats() {
        return {
            profilesCount: profilesCache.get("profiles:all")?.length || 0,
            filterKeysCount: filterCache.keys.size,
            sessionsCount: sessionsCache.keys().length,
            filterCacheLimit: SCALING_CONFIG.CACHE.MAX_FILTER_KEYS
        };
    }
};

// ===================== ОПТИМИЗИРОВАННАЯ СИСТЕМА ФИЛЬТРАЦИИ =====================
class AsyncFilterManager {
    constructor() {
        this.filterQueue = new PQueue({
            concurrency: SCALING_CONFIG.PERFORMANCE.MAX_CONCURRENT_FILTERS,
            timeout: SCALING_CONFIG.MESSAGE_QUEUE.TIMEOUT
        });
    }
    
    /**
     * Асинхронная фильтрация профилей с чанкированием для производительности
     */
    async filterProfilesAsync(profiles, filters) {
        return this.filterQueue.add(async () => {
            console.log(`🔍 [FILTER] Фильтрация ${profiles.length} профилей`);
            
            const chunkSize = SCALING_CONFIG.PERFORMANCE.FILTER_CHUNK_SIZE;
            const results = [];
            
            // Обрабатываем профили чанками для снижения нагрузки на память
            for (let i = 0; i < profiles.length; i += chunkSize) {
                const chunk = profiles.slice(i, i + chunkSize);
                const filteredChunk = this.applyFiltersToChunk(chunk, filters);
                results.push(...filteredChunk);
                
                // Периодически даем event loop возможность обработать другие задачи
                if (i % (chunkSize * 2) === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            
            console.log(`✅ [FILTER] Завершено: ${results.length} результатов`);
            return results;
        });
    }
    
    /**
     * Применяет фильтры к чанку профилей
     */
    applyFiltersToChunk(chunk, filters) {
        return chunk.filter(profile => {
            // Фильтр по стране
            if (filters.country && profile.country !== filters.country) return false;
            // Фильтр по городу
            if (filters.city && profile.city !== filters.city) return false;
            // Фильтр по возрасту
            if (filters.ageRange) {
                const age = parseInt(profile.age) || 0;
                if (age < filters.ageRange.min || age > filters.ageRange.max) return false;
            }
            return true;
        });
    }
}

const asyncFilterManager = new AsyncFilterManager();

// ===================== ГЛАВНЫЙ МОДУЛЬ БОТА =====================
module.exports = (bot, db) => {
    // ОЧЕРЕДЬ СООБЩЕНИЙ ДЛЯ МАСШТАБИРОВАНИЯ
    const messageQueue = new PQueue({
        concurrency: SCALING_CONFIG.MESSAGE_QUEUE.CONCURRENCY,
        interval: SCALING_CONFIG.MESSAGE_QUEUE.INTERVAL,
        intervalCap: SCALING_CONFIG.MESSAGE_QUEUE.INTERVAL_CAP,
        timeout: SCALING_CONFIG.MESSAGE_QUEUE.TIMEOUT,
        throwOnTimeout: false
    });

    // Мониторинг очереди
    messageQueue.on('active', () => {
        if (messageQueue.size > 10) {
            console.log(`📊 [QUEUE] Активные: ${messageQueue.pending} | Ожидание: ${messageQueue.size}`);
        }
    });

    // Rate Limiter для защиты от спама
    const limiter = new RateLimiter({
        window: 1000,
        limit: 8,
        keyGenerator: (ctx) => `${ctx.from.id}:${ctx.updateType}`,
        onLimitExceeded: (ctx) => {
            console.log(`⚠️ [RATE LIMIT] Лимит для ${ctx.from.id}`);
            return ctx.reply("⚠️ Слишком много запросов, подождите...");
        },
    });

    bot.use(limiter);

    // ===================== ЗАГРУЗКА КЭША =====================
    /**
     * Загружает все профили из базы данных в кэш
     * В процессе загрузки автоматически очищает поле about от ссылок
     */
    async function loadFullProfileCache(db) {
        try {
            console.log(`🔄 [CACHE] Загрузка анкет в кэш...`);
            readingStats.addRead('profiles', null, 1);
            
            const snapshot = await db.collection("profiles")
                .orderBy("createdAt", "desc")
                .select("id", "name", "age", "country", "city", "about", "photoUrl", "telegram", "phone", "whatsapp", "photos", "createdAt")
                .get();

            const allProfiles = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Загружаем профили в кэш с автоматической очисткой about от ссылок
            await cacheManager.cacheProfiles(allProfiles);
            console.log(`✅ [CACHE] Загружено ${allProfiles.length} анкет`);
            
        } catch (error) {
            console.error(`❌ [CACHE] Ошибка загрузки:`, error);
        }
    }

    // Инициализация кэша при запуске и периодическое обновление
    (async () => {
        await loadFullProfileCache(db);
        // Обновляем кэш каждые 6 дней
        setInterval(() => loadFullProfileCache(db), 6 * 24 * 60 * 60 * 1000);
    })();

    // ===================== СИСТЕМА УПРАВЛЕНИЯ СООБЩЕНИЯМИ =====================
    const chatStorage = {
        messages: new Map(),           // ID сообщений по чатам
        mainMenu: new Map(),           // ID главного меню по чатам  
        userState: new Map(),          // Состояния пользователей
        messageTimestamps: new Map(),  // Временные метки сообщений
        countryKeyboard: new Map(),    // ID клавиатур стран
        cityKeyboard: new Map(),       // ID клавиатур городов
    };

    // Очистка старых сообщений для управления памятью
    setInterval(() => {
        const now = Date.now();
        let cleanedCount = 0;
        
        chatStorage.messages.forEach((messages, chatId) => {
            messages.forEach(messageId => {
                if (now - (chatStorage.messageTimestamps.get(messageId) || 0) > SCALING_CONFIG.PERFORMANCE.MESSAGE_TTL) {
                    messages.delete(messageId);
                    chatStorage.messageTimestamps.delete(messageId);
                    cleanedCount++;
                }
            });
            
            if (messages.size === 0) {
                chatStorage.messages.delete(chatId);
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`🧹 [CLEANUP] Очищено ${cleanedCount} сообщений`);
        }
    }, 3600000); // Каждый час

    // ===================== ОСНОВНЫЕ ФУНКЦИИ =====================
    /**
     * Проверяет активность подписки пользователя
     * Использует кэш для снижения нагрузки на базу данных
     */
    const checkSubscription = async (userId) => {
        try {
            // Сначала проверяем кэш
            const cachedSubscription = cacheManager.getCachedSubscription(userId);
            if (cachedSubscription !== undefined) return cachedSubscription;
            
            // Если нет в кэше, загружаем из базы
            readingStats.addRead('subscriptions', userId, 1);
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
            console.error('❌ Ошибка проверки подписки:', error);
            return false;
        }
    };

    /**
     * Получает страницу профилей с применением фильтров
     * Использует кэширование результатов фильтрации для производительности
     */
    const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null, searchCity = null) => {
        try {
            // Нормализуем город для поиска
            const normalizedSearchCity = searchCity ? cacheManager.normalizeCityName(searchCity) : null;
            
            // Создаем ключ для кэша фильтров
            const filterKey = `country:${searchCountry || 'all'}:age:${ageRange?.label || 'all'}:city:${normalizedSearchCity || 'all'}`;
            
            // Пытаемся получить отфильтрованные профили из кэша
            let filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
            
            if (!filteredProfiles) {
                console.log(`🔍 [FILTER] Промах кэша: ${filterKey}`);
                const allProfiles = cacheManager.getCachedProfiles();
                if (!allProfiles) {
                    console.error("❌ [CACHE] Нет профилей в кэше");
                    return [];
                }

                // Фильтруем профили асинхронно
                filteredProfiles = await asyncFilterManager.filterProfilesAsync(allProfiles, {
                    country: searchCountry,
                    city: normalizedSearchCity,
                    ageRange: ageRange
                });

                // Кэшируем результаты фильтрации
                if (filteredProfiles.length > 0) {
                    cacheManager.cacheFilteredProfiles(filterKey, filteredProfiles);
                }
            }

            // Вычисляем диапазон для пагинации
            const startIndex = page * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            const endIndex = startIndex + SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
            return filteredProfiles.slice(startIndex, endIndex);

        } catch (error) {
            console.error("❌ Ошибка загрузки анкет:", error);
            return [];
        }
    };

    // Вспомогательные функции для получения данных
    const getUniqueCountries = async () => cacheManager.getCachedCountries();
    const getUniqueCitiesForCountry = async (country) => cacheManager.getCachedCities(country);

    /**
     * Форматирует название страны с добавлением флага
     */
    const formatCountryWithFlag = (countryName) => {
        if (!countryName) return countryName;
        const popularCountry = POPULAR_COUNTRIES.find(c => c.name === countryName);
        return popularCountry ? `${popularCountry.flag} ${countryName}` : countryName;
    };

    // ===================== СИСТЕМА ПАГИНАЦИИ =====================
    /**
     * Создает расширенную клавиатуру пагинации с быстрыми переходами
     */
    const createEnhancedPaginationKeyboard = (currentPage, totalPages, filterKey) => {
        const keyboard = [];
        
        // Основная навигация
        const navRow = [];
        if (currentPage > 0) {
            navRow.push({ text: "⏪", callback_data: `page_first_${currentPage}` });
            navRow.push({ text: "◀️", callback_data: `page_prev_${currentPage}` });
        }
        
        navRow.push({ text: `${currentPage + 1}/${totalPages}`, callback_data: "page_info" });
        
        if (currentPage < totalPages - 1) {
            navRow.push({ text: "▶️", callback_data: `page_next_${currentPage}` });
            navRow.push({ text: "⏩", callback_data: `page_last_${currentPage}` });
        }
        
        keyboard.push(navRow);

        // Быстрые переходы по секциям для большого количества страниц
        if (totalPages > 10) {
            const jumpRow = [];
            const totalProfiles = totalPages * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
            PAGINATION_JUMP_SECTIONS.forEach(section => {
                if (section.start < totalProfiles) {
                    const sectionPage = Math.floor(section.start / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
                    if (sectionPage < totalPages) {
                        jumpRow.push({ text: section.label, callback_data: `page_${sectionPage}_${currentPage}` });
                    }
                }
            });
            
            if (jumpRow.length > 0) keyboard.push(jumpRow);
        }

        // Быстрый выбор страниц
        if (totalPages > 1) {
            const quickPagesRow = [];
            const pagesToShow = Math.min(5, totalPages);
            let startPage = Math.max(0, currentPage - Math.floor(pagesToShow / 2));
            
            if (startPage + pagesToShow > totalPages) startPage = Math.max(0, totalPages - pagesToShow);

            for (let i = 0; i < pagesToShow; i++) {
                const pageNum = startPage + i;
                if (pageNum >= 0 && pageNum < totalPages) {
                    quickPagesRow.push({
                        text: pageNum === currentPage ? `• ${pageNum + 1} •` : `${pageNum + 1}`,
                        callback_data: `page_${pageNum}_${currentPage}`,
                    });
                }
            }
            
            if (quickPagesRow.length > 0) keyboard.push(quickPagesRow);
        }

        return keyboard;
    };

    // ===================== МЕНЕДЖЕР СООБЩЕНИЙ =====================
    const messageManager = {
        /**
         * Отслеживает сообщение для последующего управления
         */
        track: function (chatId, messageId) {
            if (!messageId) return;
            if (!chatStorage.messages.has(chatId)) chatStorage.messages.set(chatId, new Set());
            chatStorage.messages.get(chatId).add(messageId);
            chatStorage.messageTimestamps.set(messageId, Date.now());
        },

        /**
         * Очищает сообщения в чате с опциональным сохранением клавиатур
         */
        clear: async function (ctx, keepCityKeyboard = false, keepCountryKeyboard = false) {
            const chatId = ctx.chat.id;
            if (!chatStorage.messages.has(chatId)) return;

            const messages = [...chatStorage.messages.get(chatId)];
            const mainMenuId = chatStorage.mainMenu.get(chatId);
            const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
            const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

            let deletedCount = 0;

            // Удаляем все сообщения кроме исключенных
            for (const messageId of messages) {
                if (messageId !== mainMenuId && messageId !== countryKeyboardId && messageId !== cityKeyboardId) {
                    try {
                        await ctx.telegram.deleteMessage(chatId, messageId);
                        chatStorage.messages.get(chatId).delete(messageId);
                        chatStorage.messageTimestamps.delete(messageId);
                        deletedCount++;
                    } catch (e) {
                        if (e.response?.error_code !== 400) console.error(`❌ Ошибка удаления ${messageId}:`, e.message);
                    }
                }
            }

            // Удаляем клавиатуру городов если не нужно сохранять
            if (cityKeyboardId && !keepCityKeyboard) {
                try {
                    await ctx.telegram.deleteMessage(chatId, cityKeyboardId);
                    chatStorage.messages.get(chatId).delete(cityKeyboardId);
                    chatStorage.messageTimestamps.delete(cityKeyboardId);
                    chatStorage.cityKeyboard.delete(chatId);
                    deletedCount++;
                } catch (e) {
                    if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
                }
            }

            // Удаляем клавиатуру стран если не нужно сохранять
            if (countryKeyboardId && !keepCountryKeyboard) {
                try {
                    await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
                    chatStorage.messages.get(chatId).delete(countryKeyboardId);
                    chatStorage.messageTimestamps.delete(countryKeyboardId);
                    chatStorage.countryKeyboard.delete(chatId);
                    deletedCount++;
                } catch (e) {
                    if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
                }
            }

            // Очищаем состояние пользователя
            chatStorage.userState.delete(ctx.from.id);
            if (deletedCount > 0) console.log(`🧹 [CLEAN] Удалено ${deletedCount} сообщений для чата ${chatId}`);
        },

        /**
         * Отправляет главное меню
         */
        sendMainMenu: async function (ctx) {
            return messageQueue.add(async () => {
                const chatId = ctx.chat.id;
                const self = this;

                try {
                    // Удаляем предыдущее меню если есть
                    if (chatStorage.mainMenu.has(chatId)) {
                        try {
                            await ctx.telegram.deleteMessage(chatId, chatStorage.mainMenu.get(chatId));
                            chatStorage.messages.get(chatId)?.delete(chatStorage.mainMenu.get(chatId));
                            chatStorage.messageTimestamps.delete(chatStorage.mainMenu.get(chatId));
                        } catch (e) {
                            if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления меню:", e);
                        }
                    }

                    // Проверяем подписку для определения доступных функций
                    const hasSub = await checkSubscription(ctx.from.id);
                    const menuButtons = [];

                    menuButtons.push([{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }]);
                    if (hasSub) menuButtons.push([{ text: "🌍 Все страны", callback_data: "all_countries" }]);
                    menuButtons.push([{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]);

                    const menu = await ctx.reply("Главное меню:", { reply_markup: { inline_keyboard: menuButtons } });
                    chatStorage.mainMenu.set(chatId, menu.message_id);
                    self.track(chatId, menu.message_id);

                } catch (error) {
                    console.error("❌ Ошибка отправки меню:", error);
                    throw error;
                }
            });
        },
        
        /**
         * Отправляет клавиатуру выбора стран
         */
        sendCountriesKeyboard: async function (ctx) {
            return messageQueue.add(async () => {
                const chatId = ctx.chat.id;
                const self = this;

                try {
                    // Удаляем предыдущую клавиатуру стран если есть
                    if (chatStorage.countryKeyboard.has(chatId)) {
                        try {
                            await ctx.telegram.deleteMessage(chatId, chatStorage.countryKeyboard.get(chatId));
                            chatStorage.messages.get(chatId)?.delete(chatStorage.countryKeyboard.get(chatId));
                            chatStorage.messageTimestamps.delete(chatStorage.countryKeyboard.get(chatId));
                        } catch (e) {
                            if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
                        }
                    }

                    // Получаем список стран
                    const uniqueCountries = await getUniqueCountries();
                    const countriesToShow = uniqueCountries.length > 0 && uniqueCountries.length <= 50 ? uniqueCountries : POPULAR_COUNTRIES.map((c) => c.name);

                    // Создаем клавиатуру
                    const keyboard = [];
                    let row = [];

                    countriesToShow.forEach((country, index) => {
                        const countryWithFlag = formatCountryWithFlag(country);
                        row.push({ text: countryWithFlag, callback_data: `country_${country}` });

                        if (row.length === 3 || index === countriesToShow.length - 1) {
                            keyboard.push(row);
                            row = [];
                        }
                    });

                    keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

                    const msg = await ctx.reply("Выберите страну:", { reply_markup: { inline_keyboard: keyboard } });
                    chatStorage.countryKeyboard.set(chatId, msg.message_id);
                    self.track(chatId, msg.message_id);
                } catch (error) {
                    console.error("❌ Ошибка отправки клавиатуры стран:", error);
                    throw error;
                }
            });
        },

        /**
         * Отправляет клавиатуру выбора городов для указанной страны
         */
        sendCitiesKeyboard: async function (ctx, country) {
            return messageQueue.add(async () => {
                const chatId = ctx.chat.id;
                const self = this;

                try {
                    // Удаляем предыдущую клавиатуру городов если есть
                    if (chatStorage.cityKeyboard.has(chatId)) {
                        try {
                            await ctx.telegram.deleteMessage(chatId, chatStorage.cityKeyboard.get(chatId));
                            chatStorage.messages.get(chatId)?.delete(chatStorage.cityKeyboard.get(chatId));
                            chatStorage.messageTimestamps.delete(chatStorage.cityKeyboard.get(chatId));
                        } catch (e) {
                            if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
                        }
                    }

                    // Получаем список городов для страны
                    const cities = await getUniqueCitiesForCountry(country);
                    const keyboard = [];
                    let row = [];

                    cities.forEach((city, index) => {
                        row.push({ text: city, callback_data: `city_${city}` });
                        if (row.length === 3 || index === cities.length - 1) {
                            keyboard.push(row);
                            row = [];
                        }
                    });

                    keyboard.push([{ text: "🔙 Назад к странам", callback_data: "back_to_countries" }]);
                    const msg = await ctx.reply(`Города в ${country}:`, { reply_markup: { inline_keyboard: keyboard } });
                    chatStorage.cityKeyboard.set(chatId, msg.message_id);
                    self.track(chatId, msg.message_id);
                } catch (error) {
                    console.error("❌ Ошибка отправки клавиатуры городов:", error);
                    throw error;
                }
            });
        },
    };

    // ===================== ОБРАБОТЧИКИ КОМАНД =====================
    
    // Команда /start - инициализация бота
    bot.command("start", async (ctx) => {
        await messageQueue.add(async () => {
            try {
                await messageManager.clear(ctx);
                await messageManager.sendMainMenu(ctx);
            } catch (error) {
                console.error("❌ Ошибка команды start:", error);
            }
        });
    });

    // Действие: показать профили
    bot.action("show_profiles", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 3000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
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

                // Отправляем профили по одному с задержкой
                for (let i = 0; i < profiles.length; i++) {
                    const isLast = i === profiles.length - 1;
                    await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
                    if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
                }

                await messageManager.sendMainMenu(ctx);
            } catch (error) {
                console.error("❌ Ошибка показа анкет:", error);
                try {
                    await ctx.answerCbQuery("Ошибка загрузки");
                    const msg = await ctx.reply("Ошибка загрузки анкет, попробуйте ещё раз");
                    messageManager.track(ctx.chat.id, msg.message_id);
                } catch (e) {
                    console.error("❌ Дополнительная ошибка:", e);
                }
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // Действие: показать все страны (только для подписанных пользователей)
    bot.action("all_countries", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        try {
            const hasSub = await checkSubscription(ctx.from.id);
            if (!hasSub) {
                await ctx.answerCbQuery("❌ Требуется активная подписка");
                releaseUserLock(userId);
                return;
            }
            
            await ctx.answerCbQuery("Загружаем список стран...");
            return messageQueue.add(async () => {
                try {
                    await messageManager.clear(ctx);
                    await messageManager.sendCountriesKeyboard(ctx);
                } catch (error) {
                    console.error("❌ Ошибка обработки списка стран:", error);
                    await ctx.answerCbQuery("Ошибка загрузки");
                } finally {
                    releaseUserLock(userId);
                }
            });
        } catch (error) {
            console.error("❌ Ошибка в обработчике all_countries:", error);
            await ctx.answerCbQuery("Произошла ошибка");
            releaseUserLock(userId);
        }
    });

    // Действие: выбор страны
    bot.action(/^country_(.+)$/, async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2500)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
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
                console.error("❌ Ошибка обработки выбора страны:", error);
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // Действие: выбор города
    bot.action(/^city_(.+)$/, async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 3000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                const city = ctx.match[1];
                ctx.session = ctx.session || {};
                ctx.session.profilesPage = 0;
                ctx.session.filterCity = city;

                await messageManager.clear(ctx, true, true);
                await messageManager.sendMainMenu(ctx);

                const profiles = await getProfilesPage(0, ctx.session.filterCountry, ctx.session.ageRange, city);

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
                console.error("❌ Ошибка обработки выбора города:", error);
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // Действие: возврат к списку стран
    bot.action("back_to_countries", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                await messageManager.clear(ctx, false, true);
                await messageManager.sendCountriesKeyboard(ctx);
                await ctx.answerCbQuery();
            } catch (error) {
                console.error("❌ Ошибка возврата к странам:", error);
            } finally {
                releaseUserLock(userId);
            }
        });
    });
    
    // Действие: возврат в главное меню
    bot.action("back_to_menu", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                await messageManager.clear(ctx);
                await messageManager.sendMainMenu(ctx);
                await ctx.answerCbQuery();
            } catch (error) {
                console.error("❌ Ошибка возврата в меню:", error);
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // Действие: фильтр по возрасту
    bot.action("filter_by_age", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                const chatId = ctx.chat.id;
                const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
                const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

                await messageManager.clear(ctx, true, true);
                if (countryKeyboardId) chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
                if (cityKeyboardId) chatStorage.cityKeyboard.set(chatId, cityKeyboardId);

                const keyboard = AGE_RANGES.map((range) => [
                    { text: range.label, callback_data: `age_range_${range.label}` },
                ]);
                
                keyboard.push([{ text: "❌ Сбросить фильтр возраста", callback_data: "age_range_reset" }]);
                keyboard.push([{ text: "🔙 Назад в меню", callback_data: "back_to_menu" }]);

                const msg = await ctx.reply("Выберите возрастной диапазон:", { reply_markup: { inline_keyboard: keyboard } });
                messageManager.track(ctx.chat.id, msg.message_id);
                await ctx.answerCbQuery();
            } catch (error) {
                console.error("❌ Ошибка фильтра по возрасту:", error);
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // Действие: выбор возрастного диапазона
    bot.action(/^age_range_(.+)$/, async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 3000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                const [_, range] = ctx.match;
                ctx.session = ctx.session || {};
                ctx.session.profilesPage = 0;

                if (range === "reset") {
                    ctx.session.ageRange = null;
                    await ctx.answerCbQuery("✅ Фильтр по возрасту сброшен");
                } else {
                    const selectedRange = AGE_RANGES.find((r) => r.label === range);
                    if (selectedRange) {
                        ctx.session.ageRange = selectedRange;
                        await ctx.answerCbQuery(`✅ Установлен фильтр: ${range} лет`);
                    }
                }

                const currentCountry = ctx.session.filterCountry;
                const currentCity = ctx.session.filterCity;
                const chatId = ctx.chat.id;
                const countryKeyboardId = chatStorage.countryKeyboard.get(chatId);
                const cityKeyboardId = chatStorage.cityKeyboard.get(chatId);

                await messageManager.clear(ctx, true, true);
                if (countryKeyboardId) chatStorage.countryKeyboard.set(chatId, countryKeyboardId);
                if (cityKeyboardId) chatStorage.cityKeyboard.set(chatId, cityKeyboardId);

                const profiles = await getProfilesPage(0, currentCountry, ctx.session.ageRange, currentCity);

                if (!profiles.length) {
                    const msg = await ctx.reply("Анкет по выбранным критериям не найдено.");
                    messageManager.track(ctx.chat.id, msg.message_id);
                    return;
                }

                // Показываем примененные фильтры
                let filtersText = "🎯 Применены фильтры: ";
                if (ctx.session.ageRange) filtersText += `Возраст: ${ctx.session.ageRange.label}`;
                if (currentCountry) filtersText += `, Страна: ${currentCountry}`;
                if (currentCity) filtersText += `, Город: ${currentCity}`;
                
                const filtersMsg = await ctx.reply(filtersText);
                messageManager.track(ctx.chat.id, filtersMsg.message_id);

                // Отправляем профили
                for (let i = 0; i < profiles.length; i++) {
                    const isLast = i === profiles.length - 1;
                    await sendProfile(ctx, profiles[i], 0, profiles.length, isLast);
                    if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
                }

                // Показываем соответствующую клавиатуру
                if (currentCountry && !currentCity) {
                    await messageManager.sendCitiesKeyboard(ctx, currentCountry);
                } else {
                    await messageManager.sendMainMenu(ctx);
                }
            } catch (error) {
                console.error("❌ Ошибка обработки возрастного диапазона:", error);
                await ctx.answerCbQuery("❌ Ошибка применения фильтра");
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // Обработчик текстовых сообщений (для ручного ввода страны)
    bot.on("text", async (ctx) => {
        const userId = ctx.from.id;
        if (chatStorage.userState.get(userId) === "awaiting_country") {
            if (!acquireUserLock(userId, 3000)) {
                await ctx.reply("⏳ Подождите, обрабатываем предыдущий запрос...");
                return;
            }
            
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

                    const profiles = await getProfilesPage(0, countryInput, ctx.session.ageRange);

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
                        const msg = await ctx.reply(`Анкет из "${normalizedCountry}" не найдено`);
                        messageManager.track(ctx.chat.id, msg.message_id);
                    }

                    await messageManager.sendMainMenu(ctx);
                } catch (error) {
                    console.error("❌ Ошибка обработки страны:", error);
                } finally {
                    releaseUserLock(userId);
                }
            });
        }
    });

    // Действие: пагинация
    bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
        const userId = ctx.from.id;
        
        // Проверяем блокировку - если пользователь уже выполняет действие, игнорируем новый клик
        if (!acquireUserLock(userId, 2500)) {
            console.log(`⏳ [LOCK] Пользователь ${userId} уже выполняет действие, игнорируем клик`);
            try {
                await ctx.answerCbQuery("⏳ Подождите, загружаем...");
            } catch (e) {
                // Игнорируем ошибки ответа на callback
            }
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                const [_, action, currentPage] = ctx.match;
                let newPage = parseInt(currentPage);

                if (action === "first") newPage = 0;
                else if (action === "prev") newPage = Math.max(0, newPage - 1);
                else if (action === "next") newPage = newPage + 1;
                else if (action === "last") {
                    const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
                    const filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
                    newPage = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE) - 1;
                } else {
                    newPage = parseInt(action);
                }

                await messageManager.clear(ctx, true);
                
                ctx.session = ctx.session || {};
                const profiles = await getProfilesPage(newPage, ctx.session.filterCountry, ctx.session.ageRange, ctx.session.filterCity);

                if (profiles.length) {
                    ctx.session.profilesPage = newPage;

                    for (let i = 0; i < profiles.length; i++) {
                        const isLast = i === profiles.length - 1;
                        await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast);
                        if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                    
                    // Успешно обработали - отвечаем пользователю
                    await ctx.answerCbQuery(`📄 Страница ${newPage + 1}`);
                } else {
                    const msg = await ctx.reply("Больше анкет нет");
                    messageManager.track(ctx.chat.id, msg.message_id);
                    await ctx.answerCbQuery("❌ Больше анкет нет");
                }
                
            } catch (error) {
                console.error("❌ Ошибка пагинации:", error);
                try {
                    await ctx.answerCbQuery("❌ Ошибка загрузки");
                } catch (e) {
                    // Игнорируем ошибки ответа
                }
            } finally {
                // ВСЕГДА освобождаем блокировку в finally блоке
                releaseUserLock(userId);
            }
        });
    });

    // Действие: очистка экрана
    bot.action("clear_screen", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                await messageManager.clear(ctx);
                await ctx.answerCbQuery("Экран очищен");
            } catch (error) {
                console.error("❌ Ошибка очистки:", error);
                await ctx.answerCbQuery("Ошибка при очистке");
            } finally {
                releaseUserLock(userId);
            }
        });
    });

    // ===================== ФУНКЦИЯ ОТПРАВКИ ПРОФИЛЯ =====================
    /**
     * Отправляет профиль пользователю с фото и информацией
     * Использует уже очищенный от ссылок about из кэша
     */
    const sendProfile = async (ctx, profile, page, total, isLast) => {
        return messageQueue.add(async () => {
            try {
                // Используем уже очищенный about из кэша (обработан в cacheManager.cacheProfiles)
                // Обрезаем текст если он слишком длинный
                const about = profile.about?.length > SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH
                    ? profile.about.substring(0, SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH - 3) + "..."
                    : profile.about || "";

                /**
                 * Форматирует username Telegram для создания ссылки
                 */
                const formatTelegram = (username) => {
                    if (!username) return "";
                    if (/^[0-9+\-() ]+$/.test(username)) {
                        const cleanDigits = username.replace(/[^0-9]/g, "");
                        if (cleanDigits.startsWith('7') || cleanDigits.startsWith('8') || (cleanDigits.length >= 10 && !cleanDigits.startsWith('1'))) {
                            let telegramNumber = cleanDigits;
                            if (telegramNumber.startsWith('7') && telegramNumber.length === 11) telegramNumber = telegramNumber.substring(1);
                            else if (telegramNumber.startsWith('8') && telegramNumber.length === 11) telegramNumber = telegramNumber.substring(1);
                            return `🔵 <a href="https://t.me/${telegramNumber}">Telegram</a>`;
                        }
                    }
                    if (username.startsWith("https://t.me/")) {
                        const cleaned = decodeURIComponent(username).replace("https://t.me/", "").replace(/^%40/, "@").replace(/^\+/, "");
                        return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
                    }
                    const cleaned = username.replace(/^[@+]/, "");
                    return `🔵 <a href="https://t.me/${cleaned}">Telegram</a>`;
                };

                /**
                 * Форматирует номер WhatsApp для создания ссылки
                 */
                const formatWhatsApp = (url) => {
                    if (!url) return "";
                    if (/^[0-9+\-() ]+$/.test(url)) {
                        let cleanDigits = url.replace(/[^0-9]/g, "");
                        if (cleanDigits.startsWith('8') && cleanDigits.length === 11) cleanDigits = '7' + cleanDigits.substring(1);
                        else if (cleanDigits.length === 10) cleanDigits = '7' + cleanDigits;
                        if (cleanDigits.length === 11 && cleanDigits.startsWith('7')) return `🟢 <a href="https://wa.me/${cleanDigits}">WhatsApp</a>`;
                    }
                    return `🟢 <a href="${url}">WhatsApp</a>`;
                };

                /**
                 * Форматирует номер телефона для отображения
                 */
                const formatPhone = (phone) => {
                    if (!phone) return "";
                    let cleanDigits = phone.replace(/[^0-9]/g, "");
                    if (!cleanDigits) return "";
                    let formattedPhone = phone;
                    if (cleanDigits.length === 11 || cleanDigits.length === 10) {
                        if (cleanDigits.startsWith('7') && cleanDigits.length === 11) formattedPhone = `+${cleanDigits}`;
                        else if (cleanDigits.startsWith('8') && cleanDigits.length === 11) formattedPhone = `+7${cleanDigits.substring(1)}`;
                        else if (cleanDigits.length === 10) formattedPhone = `+7${cleanDigits}`;
                    }
                    return `📞 ${formattedPhone}`;
                };

                // Формируем полное описание профиля
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
<a href="http://t.me/magicboss_bot/magic"><b>✨Magic WebApp</b></a>
`.trim();

                let keyboard = [];
                if (isLast) {
                    const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
                    const filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
                    const totalPages = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
                    
                    keyboard = createEnhancedPaginationKeyboard(page, totalPages, filterKey);

                    // Добавляем информацию о примененных фильтрах
                    if (ctx.session?.displayCountry || ctx.session?.ageRange?.label || ctx.session?.filterCity) {
                        let filtersText = "";
                        if (ctx.session.displayCountry) filtersText += ` ${ctx.session.displayCountry}`;
                        if (ctx.session.filterCity) {
                            if (ctx.session.displayCountry) filtersText += ", ";
                            filtersText += ` ${ctx.session.filterCity}`;
                        }
                        if (ctx.session.ageRange?.label) {
                            if (ctx.session.displayCountry || ctx.session.filterCity) filtersText += ", ";
                            filtersText += ` ${ctx.session.ageRange.label}`;
                        }
                        keyboard.push([{ text: filtersText, callback_data: "filters_info" }]);
                    }

                    // Добавляем кнопки управления
                    keyboard.push(
                        [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
                        [{ text: "🌍 Все страны", callback_data: "all_countries" }],
                        [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]
                    );
                }

                // Подготовка фото для отправки
                let photosToSend = [];
                const seenUrls = new Set();
                
                // Обрабатываем массив photos (сохраняем оригинальные ссылки на фото)
                if (Array.isArray(profile.photos) && profile.photos.length > 0) {
                    profile.photos.forEach(url => {
                        if (typeof url === 'string' && url.trim() !== '') {
                            try {
                                const urlObj = new URL(url.trim());
                                const cleanUrl = urlObj.href;
                                if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
                                    seenUrls.add(cleanUrl);
                                    photosToSend.push(cleanUrl);
                                }
                            } catch (e) {}
                        }
                    });
                }
                
                // Добавляем основное фото (сохраняем оригинальную ссылку)
                if (profile.photoUrl && typeof profile.photoUrl === 'string' && profile.photoUrl.trim() !== '') {
                    try {
                        const urlObj = new URL(profile.photoUrl.trim());
                        const cleanUrl = urlObj.href;
                        if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
                            seenUrls.add(cleanUrl);
                            photosToSend.unshift(cleanUrl); // Основное фото в начало
                        }
                    } catch (e) {}
                }

                // Ограничиваем количество фото
                photosToSend = photosToSend.slice(0, 10);
                
                console.log(`📸 [PHOTO] Уникальные фото для ${profile.name}: ${photosToSend.length}`);

                /**
                 * Безопасно отправляет фото с обработкой ошибок
                 */
                const sendPhotoSafely = async (photoUrl, photoNumber, totalPhotos) => {
                    try {
                        const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                        const numberEmoji = photoNumber <= 10 ? emojiNumbers[photoNumber - 1] : `${photoNumber}.`;
                        const photoCaption = `${numberEmoji} Фото ${photoNumber}/${totalPhotos}`;
                        return await ctx.replyWithPhoto(photoUrl, { caption: photoCaption, parse_mode: "HTML" });
                    } catch (error) {
                        console.log(`❌ Ошибка отправки фото ${photoNumber}:`, error.message);
                        return null;
                    }
                };

                let infoMessage = null;
                
                // Если есть фото, отправляем информационное сообщение
                if (photosToSend.length > 0) {
                    const profileInfo = `❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ \n <a href="https://t.me/magicsuperboss"><b>Новые анкеты в нашем ➡️ канале</b></a>\n\n`;
                    infoMessage = await ctx.reply(profileInfo, { parse_mode: "HTML" });
                    messageManager.track(ctx.chat.id, infoMessage.message_id);
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                const sentPhotoMessages = [];
                
                // Если фото нет, отправляем только текстовое описание
                if (photosToSend.length === 0) {
                    console.log(`📭 [PHOTO] Нет валидных фото для ${profile.name}, отправляем только текст`);
                    const msg = await ctx.reply(fullCaption, {
                        parse_mode: "HTML",
                        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                    });
                    messageManager.track(ctx.chat.id, msg.message_id);
                    return msg;
                }
                else {
                    // Отправляем все фото по очереди
                    for (let i = 0; i < photosToSend.length; i++) {
                        const photoUrl = photosToSend[i];
                        const photoNumber = i + 1;
                        const totalPhotos = photosToSend.length;
                        const photoMsg = await sendPhotoSafely(photoUrl, photoNumber, totalPhotos);
                        if (photoMsg) {
                            sentPhotoMessages.push(photoMsg);
                            messageManager.track(ctx.chat.id, photoMsg.message_id);
                            if (i < photosToSend.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                    
                    // Если ни одно фото не отправилось
                    if (sentPhotoMessages.length === 0) {
                        console.log(`⚠️ [PHOTO] Все фото не удалось отправить для ${profile.name}`);
                        const fallbackMsg = await ctx.reply(`📷 [Все фото недоступны]\n\n${fullCaption}`, { 
                            parse_mode: "HTML",
                            reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                        });
                        messageManager.track(ctx.chat.id, fallbackMsg.message_id);
                        return fallbackMsg;
                    }
                }

                // Задержка перед отправкой текстового описания
                await new Promise(resolve => setTimeout(resolve, 300));

                // Отправляем текстовое описание профиля
                const textMsg = await ctx.reply(fullCaption, {
                    parse_mode: "HTML",
                    reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                });

                messageManager.track(ctx.chat.id, textMsg.message_id);
                console.log(`✅ [PROFILE] Анкета ${profile.name} отправлена: ${sentPhotoMessages.length} фото + текст`);

                return textMsg;

            } catch (error) {
                console.error("❌ Критическая ошибка отправки анкеты:", error);
                try {
                    // Fallback: отправляем упрощенную версию профиля
                    const fallbackText = `👤 ${profile.name}, ${profile.age}\n📍 ${profile.city}, ${profile.country}\n\n${profile.about || 'Описание недоступно'}\n\n⚠️ Приносим извинения, возникли технические проблемы с отображением фото.`;
                    const msg = await ctx.reply(fallbackText, { parse_mode: "HTML" });
                    messageManager.track(ctx.chat.id, msg.message_id);
                    return msg;
                } catch (finalError) {
                    console.error("💥 Не удалось отправить даже текстовое сообщение:", finalError);
                    return null;
                }
            }
        });
    };

    // ===================== ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ =====================
    
    // Команда /stats - статистика системы
    bot.command("stats", async (ctx) => {
        await messageQueue.add(async () => {
            try {
                const stats = readingStats.getStats();
                const cacheStats = cacheManager.getCacheStats();
                
                const statsMessage = `
📊 **Статистика системы**

**Операции чтения:**
• Всего: ${stats.totalReads}
• Профили: ${stats.operations.profiles}
• Подписки: ${stats.operations.subscriptions}
• Кэш попадания: ${stats.operations.cacheHits}
• Кэш промахи: ${stats.operations.cacheMisses}
• Эффективность кэша: ${stats.cacheEfficiency}

**Пользователи:**
• Уникальные: ${stats.uniqueUsers}
• Чтений на пользователя: ${stats.readsPerUser.toFixed(2)}

**Кэш:**
• Профилей: ${cacheStats.profilesCount}
• Ключей фильтров: ${cacheStats.filterKeysCount}/${cacheStats.filterCacheLimit}
• Сессий: ${cacheStats.sessionsCount}

**Очередь:**
• Активные задачи: ${messageQueue.pending}
• Задачи в ожидании: ${messageQueue.size}
                `;
                
                const msg = await ctx.reply(statsMessage, { parse_mode: "Markdown" });
                messageManager.track(ctx.chat.id, msg.message_id);
                
            } catch (error) {
                console.error("❌ Ошибка команды stats:", error);
            }
        });
    });

    // Команда /reset_stats - сброс статистики
    bot.command("reset_stats", async (ctx) => {
        await messageQueue.add(async () => {
            try {
                readingStats.resetStats();
                const msg = await ctx.reply("✅ Статистика сброшена");
                messageManager.track(ctx.chat.id, msg.message_id);
            } catch (error) {
                console.error("❌ Ошибка сброса статистики:", error);
            }
        });
    });

    console.log(`✅ Бот инициализирован с оптимизациями для масштабирования`);
    console.log(`✅ Функция очистки about от ссылок активирована`);
    console.log(`✅ Система блокировки пользователей активирована`);
};