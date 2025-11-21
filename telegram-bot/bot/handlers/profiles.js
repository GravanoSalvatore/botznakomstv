const RateLimiter = require("telegraf-ratelimit");
const { default: PQueue } = require("p-queue");
const NodeCache = require("node-cache");
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
// В начале файла после импортов добавьте:
let startModule = null;
// ===== УДАЛЕНИЕ LOCK ФАЙЛА ПРИ ЗАПУСКЕ =====
const LOCK_FILE = path.join(__dirname, 'bot.lock');
try {
    if (fs.existsSync(LOCK_FILE)) {
        console.log('🗑️ УДАЛЯЕМ LOCK ФАЙЛ ДЛЯ RENDER');
        fs.unlinkSync(LOCK_FILE);
    }
} catch (error) {
    console.log('⚠️ Не удалось удалить lock файл:', error.message);
}

// ===================== БЛОКИРОВКА ОТ МНОЖЕСТВЕННОГО ЗАПУСКА =====================
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
// ===================== ФУНКЦИЯ ПРЕЛОАДЕРА =====================
const sendPreloader = async (ctx, action = "загрузка") => {
    try {
        const preloaderMessages = {
            'city': `🔍 <b>Поиск анкет в выбранном городе...</b>\n\n⏳ <i>База данных обновляется, это может занять до 2 минут</i>\n\n📊 <i>Ищем самые свежие анкеты для вас...</i>`,
            'country': `🌍 <b>Загружаем список городов...</b>\n\n⏳ <i>Обновляем географию анкет</i>`,
            'profiles': `📄 <b>Загружаем анкеты...</b>\n\n⏳ <i>Это может занять несколько секунд</i>`
        };

        const message = preloaderMessages[action] || `⏳ <b>${action}...</b>\n\n<em>Пожалуйста, подождите</em>`;
        
        const preloaderMsg = await ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔄 Обновляется база анкет", callback_data: "loading" }]
                ]
            }
        });
        
        return preloaderMsg;
    } catch (error) {
        console.log("❌ Не удалось отправить прелоадер:", error.message);
        return null;
    }
};

// Функция для удаления прелоадера
const removePreloader = async (ctx, preloaderMsg) => {
    if (preloaderMsg) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, preloaderMsg.message_id);
        } catch (error) {
            console.log("❌ Не удалось удалить прелоадер:", error.message);
        }
    }
};
// ===================== СИСТЕМА БЛОКИРОВКИ ПОЛЬЗОВАТЕЛЯ =====================
const userLocks = new Map();

const acquireUserLock = (userId, timeoutMs = 10000) => {
    const now = Date.now();
    const userLock = userLocks.get(userId);
    
    if (userLock && now < userLock.expires) {
        return false;
    }
    
    userLocks.set(userId, {
        expires: now + timeoutMs,
        timestamp: now
    });
    return true;
};

const releaseUserLock = (userId) => {
    userLocks.delete(userId);
};

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
}, 60000);

// ===================== КОНФИГУРАЦИЯ МАСШТАБИРОВАНИЯ =====================
const SCALING_CONFIG = {
    MESSAGE_QUEUE: {
        CONCURRENCY: 50,
        INTERVAL: 1000,
        INTERVAL_CAP: 200,
        TIMEOUT: 30000,
    },
    
    CACHE: {
        PROFILES_TTL: 7 * 24 * 60 * 60,
        FILTERS_TTL: 600,
        SESSIONS_TTL: 1800,
        MAX_FILTER_KEYS: 500,
        CHECKPERIOD: 300,
    },
    
    PERFORMANCE: {
        PROFILES_PER_PAGE: 1,
        MAX_CAPTION_LENGTH: 900,
        MESSAGE_TTL: 86400000,
        FILTER_CHUNK_SIZE: 500,
        MAX_CONCURRENT_FILTERS: 10,
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
  kyiv: "Киев", kiev: "Киев", kiyv: "Киев",
  "kryvyi rih": "Кривой Рог", "kryvyi rig": "Кривой Рог",
  odesa: "Одесса", odessa: "Одесса",
  kharkiv: "Харьков", lviv: "Львов", dnipro: "Днепр",
  zaporizhzhia: "Запорожье", zaporozhye: "Запорожье",
  vinnytsia: "Винница", vinnitsa: "Винница",
  ternopil: "Тернополь",
  khmelnytskyi: "Хмельницкий", khmelnitsky: "Хмельницкий",
  cherkasy: "Черкассы", chernivtsi: "Черновцы", chernovtsy: "Черновцы",
  "ivano-frankivsk": "Ивано-Франковск",
  kropyvnytskyi: "Кропивницкий",
  mykolaiv: "Николаев", nikolaev: "Николаев",
  poltava: "Полтава", rivne: "Ровно", rovno: "Ровно",
  sumy: "Сумы", uzhhorod: "Ужгород", zhytomyr: "Житомир",
  kramatorsk: "Краматорск", slovyansk: "Славянск",
  lutsk: "Луцк", kherson: "Херсон", bukovel: "Буковель",

  київ: "Киев", "кривий ріг": "Кривой Рог", одеса: "Одесса",
  харків: "Харьков", львів: "Львов", дніпро: "Днепр",
  дніпропетровськ: "Днепр", запоріжжя: "Запорожье",
  вінниця: "Винница", тернопіль: "Тернополь",
  хмельницький: "Хмельницкий", черкаси: "Черкассы",
  чернівці: "Черновцы", "івано-франківськ": "Ивано-Франковск",
  кропивницький: "Кропивницкий", миколаїв: "Николаев",
  полтава: "Полтава", рівне: "Ровно", суми: "Сумы",
  ужгород: "Ужгород", житомир: "Житомир",
  краматорськ: "Краматорск", "слов'янськ": "Славянск",
  луцьк: "Луцк", херсон: "Херсон", буковель: "Буковель",
};

// ===================== ФУНКЦИЯ ОЧИСТКИ ABOUT ОТ ССЫЛОК =====================
const replaceSitesInAbout = (aboutText) => {
    if (!aboutText || typeof aboutText !== 'string') return aboutText;
    
    const siteRegex = /[a-zA-Z0-9-]+\.\s*[a-zA-Z]{2,}/g;
    const cleanedAbout = aboutText.replace(siteRegex, 'https://t.me/NotebookForWorldEscortBot');
    
    return cleanedAbout;
};

// ===================== ИНИЦИАЛИЗАЦИЯ СИСТЕМ КЭШИРОВАНИЯ =====================
const profilesCache = new NodeCache({ 
    stdTTL: SCALING_CONFIG.CACHE.PROFILES_TTL,
    checkperiod: SCALING_CONFIG.CACHE.CHECKPERIOD,
    useClones: false,
    maxKeys: 50000  // ← ОТЛИЧНО!

    
});

// ДЕМО-КЭШ для пользователей без подписки
const demoCache = new NodeCache({
    stdTTL: 3600, // 1 час
    checkperiod: 600
});

// КЭШ для хранения информации о том, какой тип кэша загружен для каждого пользователя
const userCacheStatus = new NodeCache({
    stdTTL: 1800, // 30 минут
    checkperiod: 300
});

class LimitedFilterCache {
    constructor() {
        this.keys = new Set();
        this.maxKeys = SCALING_CONFIG.CACHE.MAX_FILTER_KEYS;
    }
    
    set(key, value) {
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
        
        if (this.timestamps.length > 1000) {
            this.timestamps = this.timestamps.slice(-500);
        }
        
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
    async cacheProfiles(profiles, isDemo = false) {
    try {
        console.log(`🔄 [${isDemo ? 'DEMO' : 'FULL'} CACHE] Загрузка ${profiles.length} анкет...`);
        
       const normalizedProfiles = profiles.map(profile => ({
    id: profile.id,
    n: profile.name,
    a: profile.age,
    c: profile.country,
    ct: profile.city,
    ab: profile.about ? profile.about.substring(0, 500) : "",
    p: profile.photoUrl,
    phs: profile.photos || [],          // ← photos (уникальный ключ)
    tg: profile.telegram,
    tel: profile.phone,                 // ← telephone (уникальный ключ)  
    wa: profile.whatsapp,
    ca: profile.createdAt
}));

        // СЖАТИЕ ДАННЫХ
        const jsonString = JSON.stringify(normalizedProfiles);
        const compressed = zlib.gzipSync(jsonString);
        
        if (isDemo) {
            demoCache.set("demo:profiles", compressed);
        } else {
            profilesCache.set("profiles:all", compressed);
        }

        console.log(`✅ [CACHE] Сжатие: ${jsonString.length} → ${compressed.length} bytes (${Math.round((1 - compressed.length/jsonString.length) * 100)}% экономии)`);
        
        // КЭШИРУЕМ СТРАНЫ И ГОРОДА
        const countriesSet = new Set();
        const citiesMap = new Map();

        normalizedProfiles.forEach(profile => {
            if (profile.c) {
                countriesSet.add(profile.c);
                if (!citiesMap.has(profile.c)) {
                    citiesMap.set(profile.c, new Set());
                }
                if (profile.ct) {
                    citiesMap.get(profile.c).add(profile.ct);
                }
            }
        });

        if (isDemo) {
            demoCache.set("demo:countries", Array.from(countriesSet).sort());
            citiesMap.forEach((citiesSet, country) => {
                demoCache.set(`demo:cities:${country}`, Array.from(citiesSet).sort());
            });
        } else {
            profilesCache.set("profiles:countries", Array.from(countriesSet).sort());
            citiesMap.forEach((citiesSet, country) => {
                profilesCache.set(`profiles:cities:${country}`, Array.from(citiesSet).sort());
            });
        }

        if (!isDemo) {
            filterCache.keys.clear();
        }
        
        console.log(`✅ [${isDemo ? 'DEMO' : 'FULL'} CACHE] Обновлен: ${normalizedProfiles.length} профилей, ${countriesSet.size} стран`);
        
    } catch (error) {
        console.error(`❌ [${isDemo ? 'DEMO' : 'FULL'} CACHE] Ошибка:`, error);
    }
},

// ПОЛНОСТЬЮ ПЕРЕПИСЫВАЙ getCachedProfiles функцию:
getCachedProfiles(isDemo = false) { 
    try {
        let compressed;
        if (isDemo) {
            compressed = demoCache.get("demo:profiles");
            console.log(`🔍 [DEMO CACHE] Запрос демо-профилей: ${compressed ? 'сжатые данные найдены' : 'нет данных'}`);
        } else {
            compressed = profilesCache.get("profiles:all");
            console.log(`🔍 [FULL CACHE] Запрос полных профилей: ${compressed ? 'сжатые данные найдены' : 'нет данных'}`);
        }
        
        if (!compressed) return null;
        
        // РАСПАКОВКА ДАННЫХ
        const decompressed = zlib.gunzipSync(compressed);
        const profiles = JSON.parse(decompressed.toString());
        
        console.log(`✅ [CACHE] Распаковано: ${profiles.length} профилей`);
        return profiles;
        
    } catch (error) {
        console.error(`❌ [CACHE] Ошибка распаковки:`, error);
        return null;
    }
},
    // ФУНКЦИЯ СОЗДАНИЯ ДЕМО-КЭША (1 анкета на город)
    async createDemoCache(profiles) {
        try {
            console.log(`🔄 [DEMO CACHE] Создание демо-кэша из ${profiles.length} анкет...`);
            
            // Создаем демо-профили: 1 анкета на город
            const demoProfiles = [];
            const seenCities = new Set();
            
            profiles.forEach(profile => {
                const normalizedCity = this.normalizeCityName(profile.city);
                const cityKey = `${profile.country}_${normalizedCity}`;
                
                if (!seenCities.has(cityKey)) {
                    seenCities.add(cityKey);
                    // Создаем демо-профиль с скрытыми контактами
                    const demoProfile = {
                        ...profile,
                        city: normalizedCity,
                        about: replaceSitesInAbout(profile.about),
                        // Заменяем контакты на сообщение о необходимости подписки
                        phone: null,
                        telegram: null,
                        whatsapp: null,
                        isDemo: true // Маркер демо-профиля
                    };
                    demoProfiles.push(demoProfile);
                }
            });
            
            await this.cacheProfiles(demoProfiles, true);
            
            console.log(`✅ [DEMO CACHE] Создан демо-кэш: ${demoProfiles.length} профилей`);
            
            return demoProfiles;
            
        } catch (error) {
            console.error('❌ [DEMO CACHE] Ошибка создания демо-кэша:', error);
            return [];
        }
    },

    normalizeCityName(cityName) {
        if (!cityName || typeof cityName !== 'string') return cityName;
        const trimmedCity = cityName.trim();
        if (trimmedCity.length === 0) return cityName;
        
        const lowerCity = trimmedCity.toLowerCase();
        if (cityNormalizationMap[lowerCity]) {
            return cityNormalizationMap[lowerCity];
        }
        
        for (const [key, value] of Object.entries(cityNormalizationMap)) {
            if (lowerCity.includes(key) || key.includes(lowerCity)) {
                return value;
            }
        }
        
        return trimmedCity.charAt(0).toUpperCase() + trimmedCity.slice(1);
    },

    
    
    getCachedCountries(isDemo = false) { 
        if (isDemo) {
            const countries = demoCache.get("demo:countries") || [];
            console.log(`🔍 [DEMO CACHE] Запрос демо-стран: ${countries.length} стран`);
            return countries;
        } else {
            const countries = profilesCache.get("profiles:countries") || [];
            console.log(`🔍 [FULL CACHE] Запрос полных стран: ${countries.length} стран`);
            return countries;
        }
    },
    
    getCachedCities(country, isDemo = false) { 
        if (isDemo) {
            const cities = demoCache.get(`demo:cities:${country}`) || [];
            console.log(`🔍 [DEMO CACHE] Запрос демо-городов для ${country}: ${cities.length} городов`);
            return cities;
        } else {
            const cities = profilesCache.get(`profiles:cities:${country}`) || [];
            console.log(`🔍 [FULL CACHE] Запрос полных городов для ${country}: ${cities.length} городов`);
            return cities;
        }
    },
    
    cacheSubscription(userId, isActive) { 
        console.log(`💾 [CACHE] Сохранение подписки для ${userId}: ${isActive}`);
        return sessionsCache.set(`subscription:${userId}`, isActive); 
    },
    
    getCachedSubscription(userId) { 
        const subscription = sessionsCache.get(`subscription:${userId}`);
        console.log(`🔍 [CACHE] Запрос подписки для ${userId}: ${subscription}`);
        return subscription;
    },
    
    cacheFilteredProfiles(filterKey, profiles) { 
        console.log(`💾 [CACHE] Сохранение фильтрованных профилей: ${filterKey} (${profiles.length} профилей)`);
        filterCache.set(filterKey, profiles); 
        readingStats.addCacheHit(); 
    },
    
    getCachedFilteredProfiles(filterKey) { 
        const result = filterCache.get(filterKey); 
        console.log(`🔍 [CACHE] Запрос фильтрованных профилей: ${filterKey} (${result ? result.length : 0} профилей)`);
        if (result) readingStats.addCacheHit(); else readingStats.addCacheMiss();
        return result;
    },
    
    // Демо-фильтры
    cacheDemoFilteredProfiles(filterKey, profiles) { 
        console.log(`💾 [DEMO CACHE] Сохранение демо-фильтра: ${filterKey} (${profiles.length} профилей)`);
        demoCache.set(`filtered:${filterKey}`, profiles); 
    },
    
    getCachedDemoFilteredProfiles(filterKey) { 
        const result = demoCache.get(`filtered:${filterKey}`);
        console.log(`🔍 [DEMO CACHE] Запрос демо-фильтра: ${filterKey} (${result ? result.length : 0} профилей)`);
        return result;
    },
    
    // Новые методы для управления статусом кэша пользователя
    setUserCacheStatus(userId, cacheType) {
        console.log(`💾 [USER CACHE] Установка статуса кэша для ${userId}: ${cacheType}`);
        userCacheStatus.set(`cache_status:${userId}`, cacheType);
    },
    
    getUserCacheStatus(userId) {
        const status = userCacheStatus.get(`cache_status:${userId}`);
        console.log(`🔍 [USER CACHE] Статус кэша для ${userId}: ${status}`);
        return status;
    },
    
    // Функция проверки наличия полного кэша
    isFullCacheLoaded() {
        const fullProfiles = this.getCachedProfiles(false);
        return !!(fullProfiles && fullProfiles.length > 0);
    },
    
    getCacheStats() {
        return {
            profilesCount: profilesCache.get("profiles:all")?.length || 0,
            demoProfilesCount: demoCache.get("demo:profiles")?.length || 0,
            filterKeysCount: filterCache.keys.size,
            sessionsCount: sessionsCache.keys().length,
            userCacheStatusCount: userCacheStatus.keys().length,
            filterCacheLimit: SCALING_CONFIG.CACHE.MAX_FILTER_KEYS,
            fullCacheLoaded: this.isFullCacheLoaded()
        };
    },
    // ДОБАВЬТЕ В КОНЕЦ cacheManager ЭТУ ФУНКЦИЮ:
// ЗАМЕНИТЕ getCacheMemoryUsage:
getCacheMemoryUsage() {
    const fullCompressed = profilesCache.get("profiles:all");
    const demoCompressed = demoCache.get("demo:profiles");
    
    let fullSize = 0;
    let demoSize = 0;
    
    if (fullCompressed) {
        try {
            const decompressed = zlib.gunzipSync(fullCompressed);
            const originalSize = decompressed.length;
            const compressedSize = fullCompressed.length;
            fullSize = compressedSize;
        } catch (e) {}
    }
    
    if (demoCompressed) {
        try {
            const decompressed = zlib.gunzipSync(demoCompressed);
            const originalSize = decompressed.length;
            const compressedSize = demoCompressed.length;
            demoSize = compressedSize;
        } catch (e) {}
    }
    
    return {
        fullCacheSize: fullSize,
        demoCacheSize: demoSize,
        totalKeys: profilesCache.keys().length + demoCache.keys().length,
        memoryUsage: process.memoryUsage()
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
    
    async filterProfilesAsync(profiles, filters, isDemo = false) {
        return this.filterQueue.add(async () => {
            console.log(`🔍 [FILTER] Фильтрация ${profiles.length} профилей (демо: ${isDemo})`);
            
            const chunkSize = SCALING_CONFIG.PERFORMANCE.FILTER_CHUNK_SIZE;
            const results = [];
            
            for (let i = 0; i < profiles.length; i += chunkSize) {
                const chunk = profiles.slice(i, i + chunkSize);
                const filteredChunk = this.applyFiltersToChunk(chunk, filters);
                results.push(...filteredChunk);
                
                if (i % (chunkSize * 2) === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            
            console.log(`✅ [FILTER] Завершено: ${results.length} результатов`);
            return results;
        });
    }
    
    applyFiltersToChunk(chunk, filters) {
    return chunk.filter(profile => {
        // ПРЕОБРАЗУЕМ СОКРАЩЕННЫЕ КЛЮЧИ ОБРАТНО В ЧИТАЕМЫЕ
        const fullProfile = {
            id: profile.id,
            name: profile.n,        // n → name
            age: profile.a,         // a → age  
            country: profile.c,     // c → country
            city: profile.ct,       // ct → city
            about: profile.ab,      // ab → about
            photoUrl: profile.p,    // p → photoUrl
            photos: profile.phs,    // phs → photos (исправлено!)
            telegram: profile.tg,   // tg → telegram
            phone: profile.tel,     // tel → phone (исправлено!)
            whatsapp: profile.wa,   // wa → whatsapp
            createdAt: profile.ca   // ca → createdAt
        };

        if (filters.country && fullProfile.country !== filters.country) return false;
        if (filters.city && fullProfile.city !== filters.city) return false;
        if (filters.ageRange) {
            const age = parseInt(fullProfile.age) || 0;
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

    // ===================== ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ НА КАНАЛ =====================
    const checkChannelSubscription = async (ctx) => {
        try {
            const userId = ctx.from.id;
            const channelUsername = "@MagicYourClub";
            
            const chatMember = await ctx.telegram.getChatMember(channelUsername, userId);
            
            const isSubscribed = 
                chatMember.status === 'member' || 
                chatMember.status === 'administrator' || 
                chatMember.status === 'creator';
            
            return isSubscribed;
        } catch (error) {
            console.error("❌ Ошибка проверки подписки на канал:", error);
            return false;
        }
    };

    // ===================== ФУНКЦИЯ ПРОВЕРКИ ПОДПИСКИ =====================
    const checkSubscription = async (userId) => {
        try {
            console.log(`🔍 [SUBSCRIPTION] Проверка подписки для пользователя ${userId}`);
            
            // Сначала пробуем получить из кэша
            const cachedSubscription = cacheManager.getCachedSubscription(userId);
            if (cachedSubscription !== undefined) {
                console.log(`✅ [SUBSCRIPTION] Подписка из кэша: ${cachedSubscription}`);
                return cachedSubscription;
            }
            
            readingStats.addRead('subscriptions', userId, 1);
            const subRef = db.collection('subscriptions').doc(userId.toString());
            const doc = await subRef.get();
            
            if (!doc.exists) {
                console.log(`❌ [SUBSCRIPTION] Подписка не найдена в БД для ${userId}`);
                cacheManager.cacheSubscription(userId, false);
                return false;
            }
            
            const subData = doc.data();
            const isActive = subData.isActive && subData.endDate.toDate() > new Date();
            
            console.log(`✅ [SUBSCRIPTION] Подписка из БД для ${userId}: ${isActive}`);
            
            cacheManager.cacheSubscription(userId, isActive);
            return isActive;
            
        } catch (error) {
            console.error('❌ Ошибка проверки подписки:', error);
            return false;
        }
    };

    // ===================== ФУНКЦИЯ ПРОВЕРКИ ПОЛНОГО ДОСТУПА =====================
    const checkFullAccess = async (ctx) => {
        const hasSubscription = await checkSubscription(ctx.from.id);
        const hasChannelSubscription = await checkChannelSubscription(ctx);
        
        return hasSubscription && hasChannelSubscription;
    };

    // ===================== ФУНКЦИЯ ЗАГРУЗКИ ПРОФИЛЕЙ В КЭШ =====================
    async function loadProfileCache(db, loadFullCache = false) {
        try {
            console.log(`🔄 [CACHE] Загрузка анкет в ${loadFullCache ? 'ПОЛНЫЙ' : 'ДЕМО'} кэш...`);
            readingStats.addRead('profiles', null, 1);
            
            const snapshot = await db.collection("profiles")
                .orderBy("createdAt", "desc")
                .select("id", "name", "age", "country", "city", "about", "photoUrl", "telegram", "phone", "whatsapp", "photos", "createdAt")
                .get();

            const allProfiles = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`📊 [CACHE] Получено ${allProfiles.length} анкет из БД`);

            if (loadFullCache) {
                // ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ
                console.log(`💾 [FULL CACHE] Загружаем ПОЛНЫЙ кэш...`);
                await cacheManager.cacheProfiles(allProfiles, false);
                console.log(`✅ [FULL CACHE] Загружено ${allProfiles.length} анкет в полный кэш`);
            } else {
                // ЗАГРУЖАЕМ ТОЛЬКО ДЕМО-КЭШ
                console.log(`💾 [DEMO CACHE] Загружаем ДЕМО кэш...`);
                await cacheManager.createDemoCache(allProfiles);
                console.log(`✅ [DEMO CACHE] Создан демо-кэш из ${allProfiles.length} анкет`);
            }
            
        } catch (error) {
            console.error(`❌ [CACHE] Ошибка загрузки:`, error);
        }
    }

    // ===================== ФУНКЦИЯ ЗАГРУЗКИ ПОЛНОГО КЭША ПОСЛЕ ОПЛАТЫ =====================
    const loadFullCacheAfterPayment = async (userId) => {
        console.log(`💰 [PAYMENT] Загрузка полного кэша после оплаты для пользователя ${userId}...`);
        
        // Проверяем, не загружен ли уже полный кэш
        if (!cacheManager.isFullCacheLoaded()) {
            await loadProfileCache(db, true);
            console.log(`✅ [PAYMENT] Полный кэш загружен для пользователя ${userId}`);
        } else {
            console.log(`✅ [PAYMENT] Полный кэш уже загружен, используем существующий`);
        }
        
        cacheManager.setUserCacheStatus(userId, 'full');
    };

    // ===================== ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ КЭША ДЛЯ ПОЛЬЗОВАТЕЛЯ =====================
const ensureUserCache = async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        console.log(`🎯 [USER INIT] Инициализация кэша для пользователя ${userId}`);
        
        // Обновляем статистику посещений
        if (!startModule) {
            startModule = require('./start');
        }
        if (startModule && startModule.updateUserVisit) {
            await startModule.updateUserVisit(userId);
        }
        
        // Проверяем, не инициализирован ли уже кэш для этого пользователя
        const currentCacheStatus = cacheManager.getUserCacheStatus(userId);
        if (currentCacheStatus) {
            console.log(`✅ [USER INIT] Кэш уже инициализирован для ${userId}: ${currentCacheStatus}`);
            return currentCacheStatus;
        }
        
        // Проверяем полный доступ пользователя
        const hasFullAccess = await checkFullAccess(ctx);
        const cacheType = hasFullAccess ? 'full' : 'demo';
        
        console.log(`🔄 [USER INIT] Установлен тип кэша для ${userId}: ${cacheType}`);
        
        // ЕСЛИ ПОЛЬЗОВАТЕЛЬ С ПОЛНЫМ ДОСТУПОМ - ЗАГРУЖАЕМ ПОЛНЫЙ КЭШ В ФОНЕ
        if (hasFullAccess && !cacheManager.isFullCacheLoaded()) {
            console.log(`💰 [CACHE] Пользователь с подпиской - загружаем полный кэш в фоне...`);
            // Загружаем в фоне, не ждем завершения
            loadProfileCache(db, true).catch(e => console.error("Ошибка загрузки полного кэша:", e));
        }
        
        // Сохраняем статус кэша для пользователя
        cacheManager.setUserCacheStatus(userId, cacheType);
        
        console.log(`✅ [USER INIT] Кэш инициализирован для ${userId}: ${cacheType}`);
        
        return cacheType;
        
    } catch (error) {
        console.error(`❌ [USER INIT] Ошибка инициализации кэша для ${userId}:`, error);
        // В случае ошибки устанавливаем демо-кэш по умолчанию
        cacheManager.setUserCacheStatus(userId, 'demo');
        return 'demo';
    }
};
    // ===================== ФУНКЦИЯ ПРОВЕРКИ И ОБНОВЛЕНИЯ КЭША =====================
    const ensureProperCache = async (ctx) => {
        const userId = ctx.from.id;
        
        try {
            const hasFullAccess = await checkFullAccess(ctx);
            const currentCacheStatus = cacheManager.getUserCacheStatus(userId);
            const requiredCacheType = hasFullAccess ? 'full' : 'demo';
            
            console.log(`🔍 [CACHE CHECK] Пользователь ${userId}: текущий=${currentCacheStatus}, требуется=${requiredCacheType}`);
            
            // Если кэш еще не инициализирован или тип не соответствует
            if (!currentCacheStatus || currentCacheStatus !== requiredCacheType) {
                console.log(`🔄 [CACHE CHECK] Обновляем кэш для ${userId} с ${currentCacheStatus} на ${requiredCacheType}`);
                cacheManager.setUserCacheStatus(userId, requiredCacheType);
            }
            
            return requiredCacheType;
            
        } catch (error) {
            console.error(`❌ [CACHE CHECK] Ошибка проверки кэша для ${userId}:`, error);
            return 'demo';
        }
    };

    // ===================== ФУНКЦИЯ ЛЕНИВОЙ ЗАГРУЗКИ ПОЛНОГО КЭША =====================
    const lazyLoadFullCache = async () => {
        if (!cacheManager.isFullCacheLoaded()) {
            console.log(`🔄 [LAZY LOAD] Ленивая загрузка полного кэша...`);
            await loadProfileCache(db, true);
            return true;
        }
        return false;
    };

    


    // ===================== СИСТЕМА УПРАВЛЕНИЯ СООБЩЕНИЯМИ =====================
    const chatStorage = {
        messages: new Map(),
        mainMenu: new Map(),
        userState: new Map(),
        messageTimestamps: new Map(),
        countryKeyboard: new Map(),
        cityKeyboard: new Map(),
    };

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
    }, 3600000);

    const getProfilesPage = async (page = 0, searchCountry = null, ageRange = null, searchCity = null, isDemo = false) => {
        try {
            // ЕСЛИ нужен полный доступ, но полного кэша нет - загружаем ЛЕНИВО
            if (!isDemo && !cacheManager.isFullCacheLoaded()) {
                console.log(`🔄 [LAZY LOAD] Ленивая загрузка полного кэша для пользователя с доступом...`);
                await lazyLoadFullCache();
            }

            const normalizedSearchCity = searchCity ? cacheManager.normalizeCityName(searchCity) : null;
            
            const filterKey = `country:${searchCountry || 'all'}:age:${ageRange?.label || 'all'}:city:${normalizedSearchCity || 'all'}`;
            
            let filteredProfiles;
            
            if (isDemo) {
                filteredProfiles = cacheManager.getCachedDemoFilteredProfiles(filterKey);
            } else {
                filteredProfiles = cacheManager.getCachedFilteredProfiles(filterKey);
            }
            
            if (!filteredProfiles) {
                console.log(`🔍 [FILTER] Промах кэша: ${filterKey} (демо: ${isDemo})`);
                let allProfiles = cacheManager.getCachedProfiles(isDemo);
                
                console.log(`📊 [FILTER] Всего профилей в кэше: ${allProfiles ? allProfiles.length : 0} (демо: ${isDemo})`);
                
                if (!allProfiles || allProfiles.length === 0) {
                    console.error("❌ [CACHE] Нет профилей в кэше, перезагружаем кэш...");
                    await loadProfileCache(db, isDemo ? false : true);
                    allProfiles = cacheManager.getCachedProfiles(isDemo);
                    console.log(`🔄 [CACHE] Перезагружено профилей: ${allProfiles ? allProfiles.length : 0}`);
                    
                    if (!allProfiles || allProfiles.length === 0) {
                        console.error("❌ [CACHE] Не удалось загрузить профили в кэш");
                        return [];
                    }
                }

                filteredProfiles = await asyncFilterManager.filterProfilesAsync(allProfiles, {
                    country: searchCountry,
                    city: normalizedSearchCity,
                    ageRange: ageRange
                }, isDemo);

                console.log(`✅ [FILTER] Отфильтровано: ${filteredProfiles.length} профилей`);

                if (filteredProfiles.length > 0) {
                    if (isDemo) {
                        cacheManager.cacheDemoFilteredProfiles(filterKey, filteredProfiles);
                    } else {
                        cacheManager.cacheFilteredProfiles(filterKey, filteredProfiles);
                    }
                }
            }

            const startIndex = page * SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            const endIndex = startIndex + SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE;
            
            const result = filteredProfiles.slice(startIndex, endIndex);
            console.log(`📄 [PAGE] Возвращаем страницу ${page}: ${result.length} профилей`);
            
            return result;

        } catch (error) {
            console.error("❌ Ошибка загрузки анкет:", error);
            return [];
        }
    };

    // ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СТРАН
const getUniqueCountries = async (isDemo = false) => {
    try {
        const cachedCountries = cacheManager.getCachedCountries(isDemo);
        if (cachedCountries && cachedCountries.length > 0) {
            return cachedCountries;
        }
        
        // Если в кэше нет, используем быстрый запрос
        console.log(`🔍 Быстрая загрузка стран... (демо: ${isDemo})`);
        
        // Используем только популярные страны для быстрого ответа
        const popularCountries = POPULAR_COUNTRIES.map(c => c.name);
        
        // А полную загрузку делаем в фоне
        setTimeout(async () => {
            try {
                const snapshot = await db.collection("profiles")
                    .select("country")
                    .limit(1000) // Ограничиваем для скорости
                    .get();

                const countriesSet = new Set();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.country && data.country.trim() !== "") {
                        countriesSet.add(data.country.trim());
                    }
                });

                const uniqueCountries = Array.from(countriesSet).sort();
                console.log(`✅ Фоновая загрузка: ${uniqueCountries.length} стран`);
                
                // Сохраняем в кэш
                if (isDemo) {
                    demoCache.set("demo:countries", uniqueCountries);
                } else {
                    profilesCache.set("profiles:countries", uniqueCountries);
                }
            } catch (error) {
                console.error("❌ Ошибка фоновой загрузки стран:", error);
            }
        }, 100);
        
        return popularCountries; // Сразу возвращаем популярные страны
        
    } catch (error) {
        console.error("❌ Ошибка загрузки стран:", error);
        return POPULAR_COUNTRIES.map(c => c.name); // Возвращаем популярные страны при ошибке
    }
};

// ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ГОРОДОВ
const getUniqueCitiesForCountry = async (country, isDemo = false) => {
    try {
        const cachedCities = cacheManager.getCachedCities(country, isDemo);
        if (cachedCities && cachedCities.length > 0) {
            return cachedCities;
        }
        
        // Если в кэше нет, используем быстрый запрос
        console.log(`🔍 Быстрая загрузка городов для: ${country} (демо: ${isDemo})`);
        
        // Ограничиваем количество городов для быстрого ответа
        const quickSnapshot = await db.collection("profiles")
            .where("country", "==", country)
            .select("city")
            .limit(100) // Увеличили лимит для лучшего покрытия
            .get();

        const citiesSet = new Set();
        
        quickSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.city && data.city.trim() !== "") {
                const normalizedCity = cacheManager.normalizeCityName(data.city.trim());
                citiesSet.add(normalizedCity);
            }
        });

        const quickCities = Array.from(citiesSet).sort();
        console.log(`✅ Быстрая загрузка: ${quickCities.length} городов для ${country}`);
        
        // Полную загрузку делаем в фоне
        setTimeout(async () => {
            try {
                const fullSnapshot = await db.collection("profiles")
                    .where("country", "==", country)
                    .select("city")
                    .get();

                const fullCitiesSet = new Set();
                
                fullSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.city && data.city.trim() !== "") {
                        const normalizedCity = cacheManager.normalizeCityName(data.city.trim());
                        fullCitiesSet.add(normalizedCity);
                    }
                });

                const fullCities = Array.from(fullCitiesSet).sort();
                console.log(`✅ Фоновая загрузка: ${fullCities.length} городов для ${country}`);
                
                // Сохраняем в кэш
                if (isDemo) {
                    demoCache.set(`demo:cities:${country}`, fullCities);
                } else {
                    profilesCache.set(`profiles:cities:${country}`, fullCities);
                }
            } catch (error) {
                console.error(`❌ Ошибка фоновой загрузки городов для ${country}:`, error);
            }
        }, 100);
        
        return quickCities; // Сразу возвращаем быстрый результат
        
    } catch (error) {
        console.error(`❌ Ошибка загрузки городов для ${country}:`, error);
        return [];
    }
};

    const formatCountryWithFlag = (countryName) => {
        if (!countryName) return countryName;
        const popularCountry = POPULAR_COUNTRIES.find(c => c.name === countryName);
        return popularCountry ? `${popularCountry.flag} ${countryName}` : countryName;
    };

    // ===================== СИСТЕМА ПАГИНАЦИИ =====================
    const createEnhancedPaginationKeyboard = (currentPage, totalPages, filterKey, currentFilters = {}, isDemo = false) => {
        const keyboard = [];
        
        if (currentFilters.country || currentFilters.city || currentFilters.ageRange) {
            let filtersText = "";
            const filters = [];
            if (currentFilters.country) filters.push(currentFilters.country);
            if (currentFilters.city) filters.push(currentFilters.city);
            if (currentFilters.ageRange) filters.push(currentFilters.ageRange.label);
            filtersText += filters.join(", ");
            
            keyboard.push([{ text: filtersText, callback_data: "filters_info" }]);
        }
        
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

        // Добавляем кнопку для получения полного доступа в демо-режиме
        if (isDemo) {
            keyboard.push([
                { text: "💎 ПОЛУЧИТЬ ПОЛНЫЙ ДОСТУП", callback_data: "get_full_access" }
            ]);
        }

        return keyboard;
    };

    // ===================== МЕНЕДЖЕР СООБЩЕНИЙ =====================
    const messageManager = {
        track: function (chatId, messageId) {
            if (!messageId) return;
            if (!chatStorage.messages.has(chatId)) chatStorage.messages.set(chatId, new Set());
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

            let deletedCount = 0;

            for (const messageId of messages) {
                const shouldKeep = 
                    (keepCountryKeyboard && messageId === countryKeyboardId) ||
                    (keepCityKeyboard && messageId === cityKeyboardId) ||
                    messageId === mainMenuId;
                    
                if (!shouldKeep) {
                    try {
                        await ctx.telegram.deleteMessage(chatId, messageId);
                        chatStorage.messages.get(chatId).delete(messageId);
                        chatStorage.messageTimestamps.delete(messageId);
                        deletedCount++;
                    } catch (e) {
                        if (e.response?.error_code !== 400) {
                            console.error(`❌ Ошибка удаления ${messageId}:`, e.message);
                        }
                    }
                }
            }

            if (cityKeyboardId && !keepCityKeyboard) {
                try {
                    await ctx.telegram.deleteMessage(chatId, cityKeyboardId);
                    chatStorage.messages.get(chatId)?.delete(cityKeyboardId);
                    chatStorage.messageTimestamps.delete(cityKeyboardId);
                    chatStorage.cityKeyboard.delete(chatId);
                    deletedCount++;
                } catch (e) {
                    if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
                }
            }

            if (countryKeyboardId && !keepCountryKeyboard) {
                try {
                    await ctx.telegram.deleteMessage(chatId, countryKeyboardId);
                    chatStorage.messages.get(chatId)?.delete(countryKeyboardId);
                    chatStorage.messageTimestamps.delete(countryKeyboardId);
                    chatStorage.countryKeyboard.delete(chatId);
                    deletedCount++;
                } catch (e) {
                    if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
                }
            }

            chatStorage.userState.delete(ctx.from.id);
            if (deletedCount > 0) console.log(`🧹 [CLEAN] Удалено ${deletedCount} сообщений для чата ${chatId}`);
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
                            if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления меню:", e);
                        }
                    }

                    const hasFullAccess = await checkFullAccess(ctx);
                    const menuButtons = [];

                    menuButtons.push([{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }]);
                    menuButtons.push([{ text: "🌍 Все страны", callback_data: "all_countries_with_check" }]);
                    menuButtons.push([{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]);

                    // Если нет полного доступа, добавляем кнопку для получения доступа
                    if (!hasFullAccess) {
                        menuButtons.push([{ text: "💎 ПОЛУЧИТЬ ПОЛНЫЙ ДОСТУП", callback_data: "get_full_access" }]);
                    }

                    const menu = await ctx.reply("Главное меню:", { reply_markup: { inline_keyboard: menuButtons } });
                    chatStorage.mainMenu.set(chatId, menu.message_id);
                    self.track(chatId, menu.message_id);

                } catch (error) {
                    console.error("❌ Ошибка отправки меню:", error);
                    throw error;
                }
            });
        },
        
     sendCountriesKeyboard: async function (ctx, isDemo = false) {
    return messageQueue.add(async () => {
        const chatId = ctx.chat.id;
        const self = this;

        try {
            if (chatStorage.countryKeyboard.has(chatId)) {
                try {
                    await ctx.telegram.deleteMessage(chatId, chatStorage.countryKeyboard.get(chatId));
                    chatStorage.messages.get(chatId)?.delete(chatStorage.countryKeyboard.get(chatId));
                    chatStorage.messageTimestamps.delete(chatStorage.countryKeyboard.get(chatId));
                } catch (e) {
                    if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры стран:", e);
                }
            }

            const uniqueCountries = await getUniqueCountries(isDemo);
            const countriesToShow = uniqueCountries.length > 0 && uniqueCountries.length <= 50 ? uniqueCountries : POPULAR_COUNTRIES.map((c) => c.name);

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

            // Добавляем кнопку для получения полного доступа в демо-режиме
            if (isDemo) {
                keyboard.push([{ text: "💎 ПОЛУЧИТЬ ПОЛНЫЙ ДОСТУП", callback_data: "get_full_access" }]);
            }

            keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_menu" }]);

            const msgText = isDemo ? 
                "👀 ДЕМО-РЕЖИМ: Выберите страну (показано по 1 анкете на город)\n\n💎 Для полного доступа Вы должны быть подписаны на наш канал @MagicYourClub и оплатить подписку" : 
                "Выберите страну:";

            const msg = await ctx.reply(msgText, { reply_markup: { inline_keyboard: keyboard } });
            chatStorage.countryKeyboard.set(chatId, msg.message_id);
            self.track(chatId, msg.message_id);
        } catch (error) {
            console.error("❌ Ошибка отправки клавиатуры стран:", error);
            throw error;
        }
    });
},

       sendCitiesKeyboard: async function (ctx, country, isDemo = false) {
    return messageQueue.add(async () => {
        const chatId = ctx.chat.id;
        const self = this;

        try {
            if (chatStorage.cityKeyboard.has(chatId)) {
                try {
                    await ctx.telegram.deleteMessage(chatId, chatStorage.cityKeyboard.get(chatId));
                    chatStorage.messages.get(chatId)?.delete(chatStorage.cityKeyboard.get(chatId));
                    chatStorage.messageTimestamps.delete(chatStorage.cityKeyboard.get(chatId));
                } catch (e) {
                    if (e.response?.error_code !== 400) console.error("❌ Ошибка удаления клавиатуры городов:", e);
                }
            }

            const cities = await getUniqueCitiesForCountry(country, isDemo);
            
            if (!cities || cities.length === 0) {
                const msg = await ctx.reply(`❌ Для страны "${country}" нет доступных городов`);
                self.track(chatId, msg.message_id);
                return;
            }

            const keyboard = [];
            let row = [];

            cities.forEach((city, index) => {
                row.push({ text: city, callback_data: `city_${city}` });
                if (row.length === 3 || index === cities.length - 1) {
                    keyboard.push(row);
                    row = [];
                }
            });

            // Добавляем кнопку для получения полного доступа в демо-режиме
            if (isDemo) {
                keyboard.push([{ text: "💎 ПОЛУЧИТЬ ПОЛНЫЙ ДОСТУП", callback_data: "get_full_access" }]);
            }

            keyboard.push([{ text: "🔙 Назад к странам", callback_data: "back_to_countries" }]);

            const msgText = isDemo ?
                `👀 ДЕМО-РЕЖИМ: Выберите город в ${country} (показано по 1 анкете на город)\n\n💎 Для полного доступа ко всем анкетам получите подписку!` :
                `🏙️ Выберите город в ${country}:`;

            const msg = await ctx.reply(msgText, { 
                reply_markup: { inline_keyboard: keyboard } 
            });
            
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
    
    bot.command("start", async (ctx) => {
        await messageQueue.add(async () => {
            try {
                console.log(`🚀 Пользователь ${ctx.from.id} запустил бота через /start`);
                
                // Быстрая инициализация кэша пользователя
                await ensureUserCache(ctx);
                
                await messageManager.clear(ctx);
                await messageManager.sendMainMenu(ctx);
                
            } catch (error) {
                console.error("❌ Ошибка команды start:", error);
                await ctx.reply("⚠️ Произошла ошибка при запуске. Попробуйте еще раз.");
            }
        });
    });

    // ОБРАБОТЧИК ДЛЯ ПОЛУЧЕНИЯ ПОЛНОГО ДОСТУПА
    bot.action("get_full_access", async (ctx) => {
        await messageQueue.add(async () => {
            try {
                await ctx.answerCbQuery("💎 Переходим к оплате...");
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: "💎 Купить подписку", callback_data: "choose_payment_method" }
                        ],
                        [
                            { text: "📢 Подписаться на канал", url: "https://t.me/MagicYourClub" }
                        ],
                        [
                            { text: "🔙 Назад", callback_data: "back_to_menu" }
                        ]
                    ]
                };

                await ctx.reply(`
💎 <b>ПОЛУЧИТЬ ПОЛНЫЙ ДОСТУП</b>

Для получения полного доступа ко всем анкетам необходимо:

✅ <b>1. Активная подписка</b>
   • Доступ ко всем анкетам
   • Все контакты профилей
   • Полная функциональность

✅ <b>2. Подписка на канал @MagicYourClub</b>
   • Новые анкеты и обновления
   • Эксклюзивный контент
   • Специальные предложения

<b>После оплаты подписки и подписки на канал вы получите:</b>
• 🔓 Полный доступ ко всем анкетам
• 📞 Все контакты профилей  
• 🌍 Неограниченный поиск по странам и городам
• ⚡ Максимальную скорость работы

Нажмите "Купить подписку" чтобы начать!
                `, {
                    parse_mode: "HTML",
                    reply_markup: keyboard
                });
                
            } catch (error) {
                console.error("❌ Ошибка обработки получения доступа:", error);
            }
        });
    });

   // ОБРАБОТЧИК ДЛЯ СТРАН
bot.action("all_countries_with_check", async (ctx) => {
    const userId = ctx.from.id;
    
    if (!acquireUserLock(userId, 2000)) {
        await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
        return;
    }
    
    await messageQueue.add(async () => {
        let preloaderMsg = null;
        
        try {
            // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КЭШ
            const cacheType = await ensureProperCache(ctx);
            const isDemo = cacheType === 'demo';
            
            console.log(`🌍 [COUNTRIES] Пользователь ${userId}: демо=${isDemo}`);
            
            await ctx.answerCbQuery(isDemo ? "👀 Демо-режим" : "✅ Полный доступ");
            
            await messageManager.clear(ctx);
            
            // ПОКАЗЫВАЕМ ПРЕЛОАДЕР ПЕРЕД ЗАГРУЗКОЙ СТРАН
            preloaderMsg = await sendPreloader(ctx, 'country');
            
            // ЗАГРУЖАЕМ СТРАНЫ
            await messageManager.sendCountriesKeyboard(ctx, isDemo);
            
            // УДАЛЯЕМ ПРЕЛОАДЕР ПОСЛЕ ЗАГРУЗКИ
            await removePreloader(ctx, preloaderMsg);
            
        } catch (error) {
            console.error("❌ Ошибка обработки списка стран:", error);
            await removePreloader(ctx, preloaderMsg);
            await ctx.answerCbQuery("Ошибка загрузки");
        } finally {
            releaseUserLock(userId);
        }
    });
});

// ОБРАБОТЧИК ДЛЯ ВЫБОРА СТРАНЫ
bot.action(/^country_(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    
    if (!acquireUserLock(userId, 2500)) {
        await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
        return;
    }
    
    await messageQueue.add(async () => {
        let preloaderMsg = null;
        
        try {
            const country = ctx.match[1];
            
            // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КЭШ
            const cacheType = await ensureProperCache(ctx);
            const isDemo = cacheType === 'demo';
            
            ctx.session = ctx.session || {};
            ctx.session.profilesPage = 0;
            ctx.session.filterCountry = country;
            ctx.session.displayCountry = country;
            ctx.session.filterCity = null;
            ctx.session.isDemo = isDemo;

            await messageManager.clear(ctx);
            
            // ПОКАЗЫВАЕМ ПРЕЛОАДЕР ПЕРЕД ЗАГРУЗКОЙ ГОРОДОВ
            preloaderMsg = await sendPreloader(ctx, 'country');
            
            // ЗАГРУЖАЕМ ГОРОДА
            await messageManager.sendCitiesKeyboard(ctx, country, isDemo);
            
            // УДАЛЯЕМ ПРЕЛОАДЕР ПОСЛЕ ЗАГРУЗКИ
            await removePreloader(ctx, preloaderMsg);
            
            await ctx.answerCbQuery();
        } catch (error) {
            console.error("❌ Ошибка обработки выбора страны:", error);
            await removePreloader(ctx, preloaderMsg);
        } finally {
            releaseUserLock(userId);
        }
    });
});

    // bot.action(/^country_(.+)$/, async (ctx) => {
    //     const userId = ctx.from.id;
        
    //     if (!acquireUserLock(userId, 2500)) {
    //         await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
    //         return;
    //     }
        
    //     await messageQueue.add(async () => {
    //         try {
    //             const country = ctx.match[1];
                
    //             // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КЭШ
    //             const cacheType = await ensureProperCache(ctx);
    //             const isDemo = cacheType === 'demo';
                
    //             ctx.session = ctx.session || {};
    //             ctx.session.profilesPage = 0;
    //             ctx.session.filterCountry = country;
    //             ctx.session.displayCountry = country;
    //             ctx.session.filterCity = null;
    //             ctx.session.isDemo = isDemo;

    //             await messageManager.clear(ctx);
    //             await messageManager.sendCitiesKeyboard(ctx, country, isDemo);
    //             await ctx.answerCbQuery();
    //         } catch (error) {
    //             console.error("❌ Ошибка обработки выбора страны:", error);
    //         } finally {
    //             releaseUserLock(userId);
    //         }
    //     });
    // });

    bot.action(/^city_(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    
    if (!acquireUserLock(userId, 30000)) { // УВЕЛИЧИЛИ до 30 секунд
        await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
        return;
    }
    
    await messageQueue.add(async () => {
        let preloaderMsg = null;
        
        try {
            const city = ctx.match[1];
            
            // НЕМЕДЛЕННО отвечаем на callback чтобы избежать таймаута
            await ctx.answerCbQuery("🔍 Ищем анкеты...");
            
            // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КЭШ
            const cacheType = await ensureProperCache(ctx);
            const isDemo = cacheType === 'demo';
            
            console.log(`🏙️ [CITY] Пользователь ${userId} выбрал город ${city}, демо=${isDemo}`);
            
            ctx.session = ctx.session || {};
            ctx.session.profilesPage = 0;
            ctx.session.filterCity = city;
            ctx.session.isDemo = isDemo;

            await messageManager.clear(ctx, true, true);
            
            // ОТПРАВЛЯЕМ ПРЕЛОАДЕР
            preloaderMsg = await sendPreloader(ctx, 'city');
            
            console.log(`🔍 [CITY] Загружаем анкеты для города ${city}...`);
            const profiles = await getProfilesPage(0, ctx.session.filterCountry, ctx.session.ageRange, city, isDemo);

            // УДАЛЯЕМ ПРЕЛОАДЕР ПЕРЕД ОТПРАВКОЙ РЕЗУЛЬТАТОВ
            await removePreloader(ctx, preloaderMsg);
            preloaderMsg = null;

            if (!profiles.length) {
                const msg = await ctx.reply(`❌ Анкет из города "${city}" не найдено`);
                messageManager.track(ctx.chat.id, msg.message_id);
                return;
            }

            console.log(`✅ [CITY] Найдено ${profiles.length} анкет для города ${city}`);

            // Отправляем информацию о количестве найденных анкет
            const foundMsg = await ctx.reply(

                `📍 <b>Город:</b> ${city}\n` +
                `🌍 <b>Страна:</b> ${ctx.session.filterCountry}\n` +
                `👀 <b>Режим:</b> ${isDemo ? 'Демо (1 анкета на город)' : 'Полный доступ'}`,
                { parse_mode: "HTML" }
            );
            messageManager.track(ctx.chat.id, foundMsg.message_id);

            // Отправляем анкеты с прогрессом
            for (let i = 0; i < profiles.length; i++) {
                const isLast = i === profiles.length - 1;
                
                // Показываем прогресс для первой анкеты
                if (i === 0 && profiles.length > 1) {
                    const progressMsg = await ctx.reply(
                        `📤 <b>Отправляем анкеты...</b>\n` +
                        `📊 <i>Прогресс: 1/${profiles.length}</i>`,
                        { parse_mode: "HTML" }
                    );
                    messageManager.track(ctx.chat.id, progressMsg.message_id);
                }
                
                await sendProfile(ctx, profiles[i], 0, profiles.length, isLast, isDemo);
                
                if (!isLast) {
                    // Задержка между анкетами
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }

        } catch (error) {
            console.error("❌ Ошибка обработки выбора города:", error);
            
            // УДАЛЯЕМ ПРЕЛОАДЕР В СЛУЧАЕ ОШИБКИ
            await removePreloader(ctx, preloaderMsg);
            
            try {
                await ctx.reply(
                    "❌ <b>Произошла ошибка при загрузке анкет</b>\n\n" +
                    "⚠️ <i>Попробуйте еще раз через несколько секунд</i>",
                    { parse_mode: "HTML" }
                );
            } catch (e) {
                console.error("Не удалось отправить сообщение об ошибке:", e);
            }
        } finally {
            releaseUserLock(userId);
        }
    });
});

    bot.action("back_to_countries", async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КЭШ
                const cacheType = await ensureProperCache(ctx);
                const isDemo = cacheType === 'demo';
                
                await messageManager.clear(ctx, false, true);
                await messageManager.sendCountriesKeyboard(ctx, isDemo);
                await ctx.answerCbQuery("✅ Возврат к странам");
                
            } catch (error) {
                console.error("❌ Ошибка возврата к странам:", error);
                try {
                    await ctx.answerCbQuery("❌ Ошибка возврата");
                } catch (e) {
                }
            } finally {
                releaseUserLock(userId);
            }
        });
    });
    
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
                
                const hasFullAccess = await checkFullAccess(ctx);
                if (!hasFullAccess) {
                    keyboard.push([{ text: "💎 ПОЛУЧИТЬ ПОЛНЫЙ ДОСТУП", callback_data: "get_full_access" }]);
                }
                
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

    bot.action(/^age_range_(.+)$/, async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 3000)) {
            await ctx.answerCbQuery("⏳ Подождите, обрабатываем предыдущий запрос...");
            return;
        }
        
        await messageQueue.add(async () => {
            try {
                const [_, range] = ctx.match;
                
                // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КЭШ
                const cacheType = await ensureProperCache(ctx);
                const isDemo = cacheType === 'demo';
                
                ctx.session = ctx.session || {};
                ctx.session.profilesPage = 0;
                ctx.session.isDemo = isDemo;

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

                const profiles = await getProfilesPage(0, currentCountry, ctx.session.ageRange, currentCity, isDemo);

                if (!profiles.length) {
                    const msg = await ctx.reply("Анкет по выбранным критериям не найдено.");
                    messageManager.track(ctx.chat.id, msg.message_id);
                    return;
                }

                let filtersText = "🎯 Применены фильтры: ";
                if (ctx.session.ageRange) filtersText += `Возраст: ${ctx.session.ageRange.label}`;
                if (currentCountry) filtersText += `, Страна: ${currentCountry}`;
                if (currentCity) filtersText += `, Город: ${currentCity}`;
                
                if (isDemo) {
                    filtersText += "\n👀 ДЕМО-РЕЖИМ: показано по 1 анкете на город";
                }
                
                const filtersMsg = await ctx.reply(filtersText);
                messageManager.track(ctx.chat.id, filtersMsg.message_id);

                for (let i = 0; i < profiles.length; i++) {
                    const isLast = i === profiles.length - 1;
                    await sendProfile(ctx, profiles[i], 0, profiles.length, isLast, isDemo);
                    if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
                }

                if (currentCountry && !currentCity) {
                    await messageManager.sendCitiesKeyboard(ctx, currentCountry, isDemo);
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
                            { text: "🌍 Смотреть анкеты", callback_data: "all_countries_with_check" }
                        ],
                        [
                            { text: "🔙 Назад", callback_data: "back_to_menu" },
                            { text: "🧹 Очистить экран", callback_data: "clear_screen" }
                        ]
                    ]
                };
                
                await ctx.reply(`
🎉 <b>ПОДПИСКА ПОДТВЕРЖДЕНА!</b>

✅ Теперь у вас есть доступ к анкетам в демо-режиме!
✨ Благодарим за подписку на наш канал @MagicYourClub

👀 <b>Сейчас вы в демо-режиме:</b>
• Показано по 1 анкете на город  
• Контакты скрыты
• ✨ Для полного доступа Вы должны быть подписаны на наш канал @MagicYourClub и оплатить подписку

<b>Нажмите "Смотреть анкеты" чтобы начать!</b>
                `, {
                    parse_mode: "HTML",
                    reply_markup: successKeyboard
                });
                
            } else {
                await ctx.answerCbQuery("❌ Вы не подписаны на канал");
                
                const notSubscribedKeyboard = {
                    inline_keyboard: [
                        [
                            { text: "✅ Я ПОДПИСАЛСЯ", callback_data: "check_channel_subscription" }
                        ],
                        [
                            { text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ", url: "https://t.me/MagicYourClub" }
                        ],
                        [
                            { text: "🔙 Назад", callback_data: "back_to_menu" }
                        ]
                    ]
                };
                
                await ctx.reply(`
❌ <b>ПОДПИСКА НЕ НАЙДЕНА</b>

Мы не видим вашу подписку на канал @MagicYourClub

<b>Пожалуйста:</b>
1. Убедитесь, что вы подписались на канал
2. Нажмите кнопку "Я ПОДПИСАЛСЯ" для повторной проверки

Если проблема persists, попробуйте:
• Перезагрузить Telegram
• Убедиться, что вы используете тот же аккаунт
• Написать в поддержку @MagicAdd
                `, {
                    parse_mode: "HTML",
                    reply_markup: notSubscribedKeyboard
                });
            }
        } catch (error) {
            console.error("Ошибка проверки подписки на канал:", error);
            await ctx.answerCbQuery("❌ Ошибка проверки подписки");
        }
    });

    bot.action(/^page_(first|prev|next|last|\d+)_(\d+)$/, async (ctx) => {
        const userId = ctx.from.id;
        
        if (!acquireUserLock(userId, 2500)) {
            console.log(`⏳ [LOCK] Пользователь ${userId} уже выполняет действие, игнорируем клик`);
            try {
                await ctx.answerCbQuery("⏳ Подождите, загружаем...");
            } catch (e) {
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
                    const isDemo = ctx.session?.isDemo || false;
                    const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
                    const filteredProfiles = isDemo ? 
                        cacheManager.getCachedDemoFilteredProfiles(filterKey) : 
                        cacheManager.getCachedFilteredProfiles(filterKey);
                    newPage = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE) - 1;
                } else {
                    newPage = parseInt(action);
                }

                await messageManager.clear(ctx, true);
                
                ctx.session = ctx.session || {};
                const isDemo = ctx.session.isDemo || false;
                const profiles = await getProfilesPage(newPage, ctx.session.filterCountry, ctx.session.ageRange, ctx.session.filterCity, isDemo);

                if (profiles.length) {
                    ctx.session.profilesPage = newPage;

                    for (let i = 0; i < profiles.length; i++) {
                        const isLast = i === profiles.length - 1;
                        await sendProfile(ctx, profiles[i], newPage, profiles.length, isLast, isDemo);
                        if (!isLast) await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                    
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
                }
            } finally {
                releaseUserLock(userId);
            }
        });
    });

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

  const sendProfile = async (ctx, profile, page, total, isLast, isDemo = false) => {
    return messageQueue.add(async () => {
        try {
            // ПРЕОБРАЗУЕМ СОКРАЩЕННЫЕ КЛЮЧИ ОБРАТНО В ПОЛНЫЕ
            const fullProfile = {
                id: profile.id,
                name: profile.n || profile.name,
                age: profile.a || profile.age, 
                country: profile.c || profile.country,
                city: profile.ct || profile.city,
                about: profile.ab || profile.about,
                photoUrl: profile.p || profile.photoUrl,
                photos: profile.phs || profile.photos || [],
                telegram: profile.tg || profile.telegram,
                phone: profile.tel || profile.phone,
                whatsapp: profile.wa || profile.whatsapp,
                createdAt: profile.ca || profile.createdAt,
                isDemo: profile.isDemo
            };
            // 🔍 ДОБАВЬТЕ ОТЛАДОЧНУЮ ИНФОРМАЦИЮ ЗДЕСЬ
            console.log(`🔍 [DEBUG] Профиль ${fullProfile.name}: фото URL=${fullProfile.photoUrl}, галерея=${fullProfile.photos?.length || 0} фото`);
            console.log(`🔍 [DEBUG] Ключи профиля:`, Object.keys(profile));
            console.log(`🔍 [DEBUG] Данные фото:`, {
                photoUrl: fullProfile.photoUrl,
                photos: fullProfile.photos,
                hasPhotoUrl: !!fullProfile.photoUrl,
                photosCount: fullProfile.photos?.length || 0
            });
            const about = fullProfile.about?.length > SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH
                ? fullProfile.about.substring(0, SCALING_CONFIG.PERFORMANCE.MAX_CAPTION_LENGTH - 3) + "..."
                : fullProfile.about || "";

            // ДЕМО-РЕЖИМ: скрываем контакты и показываем сообщение о необходимости подписки
            if (isDemo || fullProfile.isDemo) {
                const demoCaption = `
👤 <b>${fullProfile.name}</b>, ${fullProfile.age}
-------------------------------
${fullProfile.country},📍${fullProfile.city}
-------------------------------
<em>${about.length > 300 ? about.substring(0, 300) + `...<a href="http://t.me/magicboss_bot/magic">читать полностью в ✨Magic</a>` : about}</em>
🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹
🚫 <b>КОНТАКТЫ СКРЫТЫ</b>
-------------------------------
💎 <b>Для получения контактов и полного доступа ко всем анкетам необходимо:</b>

✅ <b>1. Активная подписка</b>
✅ <b>2. Подписка на канал @MagicYourClub</b>

✨ После получения доступа вы увидите:
• Все контакты профилей (Telegram, WhatsApp, телефон)
• Полные описания анкет
• Неограниченный доступ ко всем анкетам
• Максимальную скорость работы

-------------------------------
<a href="http://t.me/magicboss_bot/magic"><b>✨Magic WebApp</b></a>
`.trim();

                let keyboard = [];
                if (isLast) {
                    const filterKey = `country:${ctx.session.filterCountry || 'all'}:age:${ctx.session.ageRange?.label || 'all'}:city:${ctx.session.filterCity || 'all'}`;
                    const filteredProfiles = isDemo ? 
                        cacheManager.getCachedDemoFilteredProfiles(filterKey) : 
                        cacheManager.getCachedFilteredProfiles(filterKey);
                    const totalPages = Math.ceil((filteredProfiles?.length || 0) / SCALING_CONFIG.PERFORMANCE.PROFILES_PER_PAGE);
                    
                    const currentFilters = {
                        country: ctx.session?.displayCountry,
                        city: ctx.session?.filterCity,
                        ageRange: ctx.session?.ageRange
                    };
                    
                    keyboard = createEnhancedPaginationKeyboard(page, totalPages, filterKey, currentFilters, isDemo);

                    keyboard.push(
                        [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
                        [{ text: "🌍 Все страны", callback_data: "all_countries_with_check" }],
                        [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]
                    );
                }

                // 🔧 ИСПРАВЛЕНИЕ БАГА С ФОТО - ОБРАБОТКА ВСЕХ ФОТО
                let photosToSend = [];
                const seenUrls = new Set();

                // Обрабатываем основное фото
                if (fullProfile.photoUrl && typeof fullProfile.photoUrl === 'string' && fullProfile.photoUrl.trim() !== '') {
                    try {
                        const urlObj = new URL(fullProfile.photoUrl.trim());
                        const cleanUrl = urlObj.href;
                        if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
                            seenUrls.add(cleanUrl);
                            photosToSend.push(cleanUrl);
                        }
                    } catch (e) {
                        console.log(`❌ Ошибка обработки основного фото:`, e.message);
                    }
                }

                // Обрабатываем галерею фото
                if (Array.isArray(fullProfile.photos) && fullProfile.photos.length > 0) {
                    fullProfile.photos.forEach((url, index) => {
                        if (typeof url === 'string' && url.trim() !== '') {
                            try {
                                const urlObj = new URL(url.trim());
                                const cleanUrl = urlObj.href;
                                if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
                                    seenUrls.add(cleanUrl);
                                    photosToSend.push(cleanUrl);
                                }
                            } catch (e) {
                                console.log(`❌ Ошибка обработки фото ${index + 1}:`, e.message);
                            }
                        }
                    });
                }

                photosToSend = photosToSend.slice(0, 10);
                
                console.log(`📸 [DEMO PHOTO] Уникальные фото для ${fullProfile.name}: ${photosToSend.length} (из ${fullProfile.photos?.length || 0} в галерее)`);

                const sendPhotoSafely = async (photoUrl, photoNumber, totalPhotos) => {
                    try {
                        const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                        const numberEmoji = photoNumber <= 10 ? emojiNumbers[photoNumber - 1] : `${photoNumber}.`;
                        const photoCaption = `${numberEmoji} Фото ${photoNumber}/${totalPhotos}`;
                        
                        return await ctx.replyWithPhoto(photoUrl, { 
                            caption: photoCaption, 
                            parse_mode: "HTML" 
                        });
                    } catch (error) {
                        console.log(`❌ Ошибка отправки фото ${photoNumber}:`, error.message);
                        
                        try {
                            return await ctx.replyWithPhoto(photoUrl);
                        } catch (e) {
                            console.log(`❌ Не удалось отправить фото ${photoNumber} даже без caption:`, e.message);
                            return null;
                        }
                    }
                };

                let infoMessage = null;
                
                if (photosToSend.length > 0) {
                    const profileInfo = `✨✨✨✨✨✨✨✨✨✨ \n <a href="http://t.me/MagicYourClub"><b>Новые анкеты в нашем ➡️ канале</b></a>\n\n`;
                    infoMessage = await ctx.reply(profileInfo, { parse_mode: "HTML" });
                    messageManager.track(ctx.chat.id, infoMessage.message_id);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const sentPhotoMessages = [];
                
                if (photosToSend.length === 0) {
                    console.log(`📭 [DEMO PHOTO] Нет валидных фото для ${fullProfile.name}, отправляем только текст`);
                    const msg = await ctx.reply(demoCaption, {
                        parse_mode: "HTML",
                        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                    });
                    messageManager.track(ctx.chat.id, msg.message_id);
                    return msg;
                }
                else {
                    for (let i = 0; i < photosToSend.length; i++) {
                        const photoUrl = photosToSend[i];
                        const photoNumber = i + 1;
                        const totalPhotos = photosToSend.length;
                        
                        console.log(`🔄 [PHOTO] Отправляем фото ${photoNumber}/${totalPhotos} для ${fullProfile.name}`);
                        
                        const photoMsg = await sendPhotoSafely(photoUrl, photoNumber, totalPhotos);
                        if (photoMsg) {
                            sentPhotoMessages.push(photoMsg);
                            messageManager.track(ctx.chat.id, photoMsg.message_id);
                            
                            if (i < photosToSend.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 800));
                            }
                        }
                    }
                    
                    if (sentPhotoMessages.length === 0) {
                        console.log(`⚠️ [DEMO PHOTO] Все фото не удалось отправить для ${fullProfile.name}`);
                        const fallbackMsg = await ctx.reply(`📷 [Все фото недоступны]\n\n${demoCaption}`, { 
                            parse_mode: "HTML",
                            reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                        });
                        messageManager.track(ctx.chat.id, fallbackMsg.message_id);
                        return fallbackMsg;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));

                const textMsg = await ctx.reply(demoCaption, {
                    parse_mode: "HTML",
                    reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                });

                messageManager.track(ctx.chat.id, textMsg.message_id);
                console.log(`✅ [DEMO PROFILE] Анкета ${fullProfile.name} отправлена: ${sentPhotoMessages.length} фото + текст`);

                return textMsg;

            } else {
                // ПОЛНЫЙ ДОСТУП: оригинальная логика отправки профиля
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

                const fullCaption = `
👤 <b>${fullProfile.name}</b>, ${fullProfile.age}
-------------------------------
${fullProfile.country},📍${fullProfile.city}
-------------------------------
<em>${about.length > 300 ? about.substring(0, 300) + `...<a href="http://t.me/magicboss_bot/magic">читать полностью в ✨Magic</a>` : about}</em>
🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹
<b>Контакты:</b>
-------------------------------
${fullProfile.phone ? formatPhone(fullProfile.phone) : ""}${fullProfile.telegram ? "\n-------------------------------\n" + formatTelegram(fullProfile.telegram) : ""}${fullProfile.whatsapp ? "\n-------------------------------\n" + formatWhatsApp(fullProfile.whatsapp) : ""}${(fullProfile.phone || fullProfile.telegram || fullProfile.whatsapp) ? "\n-------------------------------" : ""}
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
                    
                    const currentFilters = {
                        country: ctx.session?.displayCountry,
                        city: ctx.session?.filterCity,
                        ageRange: ctx.session?.ageRange
                    };
                    
                    keyboard = createEnhancedPaginationKeyboard(page, totalPages, filterKey, currentFilters);

                    keyboard.push(
                        [{ text: "🎂 Фильтр по возрасту", callback_data: "filter_by_age" }],
                        [{ text: "🌍 Все страны", callback_data: "all_countries_with_check" }],
                        [{ text: "🧹 Очистить экран", callback_data: "clear_screen" }]
                    );
                }

                // 🔧 ИСПРАВЛЕНИЕ БАГА С ФОТО - ОБРАБОТКА ВСЕХ ФОТО (ТАК ЖЕ КАК В ДЕМО-РЕЖИМЕ)
                let photosToSend = [];
                const seenUrls = new Set();

                // Обрабатываем основное фото
                if (fullProfile.photoUrl && typeof fullProfile.photoUrl === 'string' && fullProfile.photoUrl.trim() !== '') {
                    try {
                        const urlObj = new URL(fullProfile.photoUrl.trim());
                        const cleanUrl = urlObj.href;
                        if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
                            seenUrls.add(cleanUrl);
                            photosToSend.push(cleanUrl);
                        }
                    } catch (e) {
                        console.log(`❌ Ошибка обработки основного фото:`, e.message);
                    }
                }

                // Обрабатываем галерею фото
                if (Array.isArray(fullProfile.photos) && fullProfile.photos.length > 0) {
                    fullProfile.photos.forEach((url, index) => {
                        if (typeof url === 'string' && url.trim() !== '') {
                            try {
                                const urlObj = new URL(url.trim());
                                const cleanUrl = urlObj.href;
                                if ((urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && !seenUrls.has(cleanUrl)) {
                                    seenUrls.add(cleanUrl);
                                    photosToSend.push(cleanUrl);
                                }
                            } catch (e) {
                                console.log(`❌ Ошибка обработки фото ${index + 1}:`, e.message);
                            }
                        }
                    });
                }

                photosToSend = photosToSend.slice(0, 10);
                
                console.log(`📸 [PHOTO] Уникальные фото для ${fullProfile.name}: ${photosToSend.length} (из ${fullProfile.photos?.length || 0} в галерее)`);

                const sendPhotoSafely = async (photoUrl, photoNumber, totalPhotos) => {
                    try {
                        const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                        const numberEmoji = photoNumber <= 10 ? emojiNumbers[photoNumber - 1] : `${photoNumber}.`;
                        const photoCaption = `${numberEmoji} Фото ${photoNumber}/${totalPhotos}`;
                        
                        return await ctx.replyWithPhoto(photoUrl, { 
                            caption: photoCaption, 
                            parse_mode: "HTML" 
                        });
                    } catch (error) {
                        console.log(`❌ Ошибка отправки фото ${photoNumber}:`, error.message);
                        
                        try {
                            return await ctx.replyWithPhoto(photoUrl);
                        } catch (e) {
                            console.log(`❌ Не удалось отправить фото ${photoNumber} даже без caption:`, e.message);
                            return null;
                        }
                    }
                };

                let infoMessage = null;
                
                if (photosToSend.length > 0) {
                    const profileInfo = `✨✨✨✨✨✨✨✨✨✨ \n <a href="http://t.me/MagicYourClub"><b>Новые анкеты в нашем ➡️ канале</b></a>\n\n`;
                    infoMessage = await ctx.reply(profileInfo, { parse_mode: "HTML" });
                    messageManager.track(ctx.chat.id, infoMessage.message_id);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const sentPhotoMessages = [];
                
                if (photosToSend.length === 0) {
                    console.log(`📭 [PHOTO] Нет валидных фото для ${fullProfile.name}, отправляем только текст`);
                    const msg = await ctx.reply(fullCaption, {
                        parse_mode: "HTML",
                        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                    });
                    messageManager.track(ctx.chat.id, msg.message_id);
                    return msg;
                }
                else {
                    for (let i = 0; i < photosToSend.length; i++) {
                        const photoUrl = photosToSend[i];
                        const photoNumber = i + 1;
                        const totalPhotos = photosToSend.length;
                        
                        console.log(`🔄 [PHOTO] Отправляем фото ${photoNumber}/${totalPhotos} для ${fullProfile.name}`);
                        
                        const photoMsg = await sendPhotoSafely(photoUrl, photoNumber, totalPhotos);
                        if (photoMsg) {
                            sentPhotoMessages.push(photoMsg);
                            messageManager.track(ctx.chat.id, photoMsg.message_id);
                            
                            if (i < photosToSend.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 800));
                            }
                        }
                    }
                    
                    if (sentPhotoMessages.length === 0) {
                        console.log(`⚠️ [PHOTO] Все фото не удалось отправить для ${fullProfile.name}`);
                        const fallbackMsg = await ctx.reply(`📷 [Все фото недоступны]\n\n${fullCaption}`, { 
                            parse_mode: "HTML",
                            reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                        });
                        messageManager.track(ctx.chat.id, fallbackMsg.message_id);
                        return fallbackMsg;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));

                const textMsg = await ctx.reply(fullCaption, {
                    parse_mode: "HTML",
                    reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
                });

                messageManager.track(ctx.chat.id, textMsg.message_id);
                console.log(`✅ [PROFILE] Анкета ${fullProfile.name} отправлена: ${sentPhotoMessages.length} фото + текст`);

                return textMsg;
            }

        } catch (error) {
            console.error("❌ Критическая ошибка отправки анкеты:", error);
            try {
                const fallbackText = `👤 ${fullProfile.name}, ${fullProfile.age}\n📍 ${fullProfile.city}, ${fullProfile.country}\n\n${fullProfile.about || 'Описание недоступно'}\n\n⚠️ Приносим извинения, возникли технические проблемы с отображением фото.`;
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
• Полных профилей: ${cacheStats.profilesCount}
• Демо профилей: ${cacheStats.demoProfilesCount}
• Полный кэш загружен: ${cacheStats.fullCacheLoaded ? '✅' : '❌'}
• Ключей фильтров: ${cacheStats.filterKeysCount}/${cacheStats.filterCacheLimit}
• Сессий: ${cacheStats.sessionsCount}
• Статусов пользователей: ${cacheStats.userCacheStatusCount}

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

    // Экспорт функции для загрузки полного кэша после оплаты
    module.exports.loadFullCacheAfterPayment = loadFullCacheAfterPayment;
    module.exports.ensureUserCache = ensureUserCache;
// Инициализация ТОЛЬКО демо-кэша при запуске бота
    let globalCacheInitialized = false;

    // ЗАГРУЖАЕМ КЭШ ПРИ СТАРТЕ БОТА В ФОНЕ
    setTimeout(async () => {
        if (!globalCacheInitialized) {
            console.log('🚀 [BOT START] Фоновая инициализация демо-кэша...');
            try {
                await loadProfileCache(db, false);
                globalCacheInitialized = true;
                console.log('✅ [BOT START] Демо-кэш загружен в фоне');
            } catch (error) {
                console.error('❌ [BOT START] Ошибка загрузки демо-кэша:', error);
            }
            
            // Периодическое обновление только демо-кэша
            setInterval(async () => {
                console.log('🔄 [CACHE] Периодическое обновление демо-кэша...');
                await loadProfileCache(db, false);
            }, 6 * 24 * 60 * 60 * 1000);
        }
    }, 3000); // Задержка 3 секунды чтобы бот успел запуститься

    console.log(`✅ Модуль профилей инициализирован с ЭКОНОМНОЙ загрузкой кэша`);
    console.log(`✅ При старте загружается ТОЛЬКО демо-кэш (280 профилей)`);
    console.log(`✅ Полный кэш загружается ТОЛЬКО после оплаты или по требованию`);
    console.log(`✅ Автоматическое переключение между демо и полным кэшем`);
};