// db/cache-manager.js

// Сначала импортируем нужные зависимости
const { SCALING_CONFIG } = require('../config/scaling');
const { FALLBACK_COUNTRIES } = require('../config/constants');
const { countryNormalizationMap, russianVariants } = require('../config/countries');
const { allCountryMaps } = require('./config/countries');
// Функция replaceSitesInAbout тоже нужна (выносим её или передаем как параметр)
const replaceSitesInAbout = (aboutText) => {
  if (!aboutText || typeof aboutText !== "string") return aboutText;
  const siteRegex = /[a-zA-Z0-9-]+\.\s*[a-zA-Z]{2,}/g;
  return aboutText.replace(siteRegex, "http://t.me/magicboss_bot/magic");
};
const cacheManager = {
  // ===================== ГЛОБАЛЬНЫЕ ФУНКЦИИ КЭША С LMDB =====================

// 1. ЗАГРУЗКА ПРОФИЛЕЙ В LMDB (ОПТИМИЗИРОВАННАЯ ДЛЯ RENDER)
async loadGlobalFullCache(db) {
    
    if (fullCacheLoading) {
        console.log("⏳ [LMDB FULL CACHE] Уже загружается...");
        return false;
    }

    fullCacheLoading = true;
    console.log("🚀 [LMDB FULL CACHE] НАЧИНАЕМ ЗАГРУЗКУ В LMDB");
    console.log("=".repeat(60));

    const globalStartTime = Date.now();
    let totalLoaded = 0;

    try {
        // 🔥 ПРЕЖДЕ ВСЕГО ОЧИЩАЕМ БАЗУ
        console.log("🧹 [LMDB CLEAN] Очищаем существующие данные...");
        profilesDB.clearSync(); // Очищаем базу
        
        // 🔥 ВАЖНО: Сбрасываем индексы
        indexesDB.clearSync();
        
        console.log("✅ [LMDB CLEAN] База очищена, начинаем загрузку...");

        // ==================== ЭТАП 1: ЗАГРУЗКА ПРОФИЛЕЙ ИЗ FIRESTORE В LMDB ====================
        console.log("📥 ЭТАП 1: ЗАГРУЗКА ПРОФИЛЕЙ В LMDB");
        console.log("-".repeat(40));

        let lastDoc = null;
        let batchCount = 0;
        const BATCH_SIZE = 5000;
        const MAX_PROFILES = 70000;
        const firestoreStartTime = Date.now();

        while (totalLoaded < MAX_PROFILES) {
            batchCount++;
            console.log(`📦 [ПАЧКА ${batchCount}] Загрузка ${BATCH_SIZE} анкет...`);

            // Строим запрос к Firestore
            let query = db
                .collection("profiles")
                .orderBy("createdAt", "desc")
                .limit(BATCH_SIZE)
                .select(
                    "id",
                    "name",
                    "age",
                    "country",
                    "city",
                    "about",
                    "photoUrl",
                    "telegram",
                    "phone",
                    "whatsapp",
                    "photos",
                    "createdAt"
                );

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            // Выполняем запрос
            const snapshot = await query.get();
            const docsCount = snapshot.docs.length;

            // Статистика чтений
            readingStats.addRead("profiles", "system", docsCount, "firestore");

            // Если больше нет документов
            if (docsCount === 0) {
                console.log(`✅ [ЗАВЕРШЕНО] Больше анкет нет`);
                break;
            }

            // 🔥 Обрабатываем документы и сохраняем в LMDB
            for (const doc of snapshot.docs) {
                const profile = {
                    id: doc.id,
                    ...doc.data(),
                };

                // Нормализуем данные
                const normalizedProfile = {
                    id: profile.id,
                    n: profile.name || "",
                    a: parseInt(profile.age) || 0,
                    c: profile.country
                        ? this.normalizeCountryName(profile.country)
                        : "",
                    ct: profile.city ? this.normalizeCityName(profile.city) : "",
                    ab: profile.about ? profile.about.substring(0, 500) : "",
                    p: profile.photoUrl || "",
                    phs: profile.photos || [],
                    tg: profile.telegram || "",
                    tel: profile.phone || "",
                    wa: profile.whatsapp || "",
                    ca: profile.createdAt || new Date(),
                    isDemo: false,
                };

                // 🔥 СОХРАНЯЕМ В LMDB (без транзакции)
                profilesDB.put(profile.id, normalizedProfile);
                totalLoaded++;

                // Прогресс
                if (totalLoaded % 1000 === 0) {
                    console.log(
                        `💾 [LMDB SAVE] Сохранено ${totalLoaded} профилей в LMDB`
                    );
                }
            }

            lastDoc = snapshot.docs[docsCount - 1];

            console.log(
                `📊 [ПАЧКА ${batchCount}] Загружено: ${docsCount} анкет | Всего: ${totalLoaded}`
            );

            // Пауза между пачками для снижения нагрузки
            if (docsCount === BATCH_SIZE) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        const firestoreTime = Date.now() - firestoreStartTime;
        console.log(
            `✅ ЭТАП 1 ЗАВЕРШЕН: ${totalLoaded} анкет за ${(
                firestoreTime / 1000
            ).toFixed(1)}с`
        );
        console.log("-".repeat(40));

        // 🔥 СРАЗУ ПОКАЗЫВАЕМ СТАТИСТИКУ
        const profileKeys = Array.from(profilesDB.getKeys());
        const actualCount = profileKeys.length;
        console.log(`📊 [LMDB VERIFICATION] В базе теперь: ${actualCount} профилей`);

        if (actualCount === 0) {
            console.log(`❌ [LMDB CRITICAL] БАЗА ПУСТА ПОСЛЕ ЗАГРУЗКИ!`);
            return false;
        }

        // ==================== ЭТАП 2: СОЗДАНИЕ ИНДЕКСОВ СТРАН И ГОРОДОВ ====================
        console.log("📇 ЭТАП 2: СОЗДАНИЕ ИНДЕКСОВ СТРАН И ГОРОДОВ");
        console.log("-".repeat(40));

        const indexStartTime = Date.now();
        
        // 🔥 ИЗВЛЕКАЕМ СТРАНЫ И ГОРОДА ИЗ ПРОФИЛЕЙ
        console.log(`🌍 Извлекаем страны и города из ${actualCount} профилей...`);
        
        const countriesSet = new Set();
        const citiesByCountry = new Map();
        let processed = 0;

        for (const profileId of profileKeys) {
            const profile = profilesDB.get(profileId);
            if (!profile) continue;

            if (profile.c && profile.c.trim() !== "" && profile.c !== "Не указана") {
                countriesSet.add(profile.c);

                if (profile.ct && profile.ct.trim() !== "" && profile.ct !== "Не указан") {
                    if (!citiesByCountry.has(profile.c)) {
                        citiesByCountry.set(profile.c, new Set());
                    }
                    citiesByCountry.get(profile.c).add(profile.ct);
                }
            }

            processed++;
            if (processed % 10000 === 0) {
                console.log(`📊 [INDEX PROGRESS] Обработано ${processed} профилей`);
            }
        }

        // Сохраняем страны
        const sortedCountries = Array.from(countriesSet).sort();
        indexesDB.put('countries:all', sortedCountries);
        console.log(`✅ Сохранено стран: ${sortedCountries.length}`);

        // Сохраняем города по странам
        let totalCities = 0;
        for (const [country, citiesSet] of citiesByCountry) {
            const citiesArray = Array.from(citiesSet).sort();
            indexesDB.put(`cities:${country}`, citiesArray);
            totalCities += citiesArray.length;
        }
        console.log(`✅ Сохранено ${totalCities} городов для ${citiesByCountry.size} стран`);

        const indexTime = Date.now() - indexStartTime;
        console.log(`✅ ЭТАП 2 ЗАВЕРШЕН за ${indexTime}мс`);
        console.log("-".repeat(40));

        // ==================== ЭТАП 3: СОЗДАНИЕ ИНДЕКСОВ ДЛЯ БЫСТРОГО ПОИСКА ====================
        console.log("⚡ ЭТАП 3: СОЗДАНИЕ ИНДЕКСОВ ДЛЯ БЫСТРОГО ПОИСКА");
        console.log("-".repeat(40));

        const fastIndexStartTime = Date.now();
        
        // Индексы для быстрого поиска
        const countryIndex = {};
        const countryCityIndex = {};
        const cityIndex = {};
        let indexedProfiles = 0;

        for (const profileId of profileKeys) {
            const profile = profilesDB.get(profileId);
            if (!profile) continue;

            const country = profile.c;
            const city = profile.ct;

            if (country && country.trim() !== "" && country !== "Не указана") {
                // Индекс по стране
                if (!countryIndex[country]) {
                    countryIndex[country] = [];
                }
                countryIndex[country].push(profileId);

                // Индекс по стране+городу
                if (city && city.trim() !== "" && city !== "Не указан") {
                    const key = `${country}:${city}`;
                    if (!countryCityIndex[key]) {
                        countryCityIndex[key] = [];
                    }
                    countryCityIndex[key].push(profileId);

                    // Индекс только по городу
                    if (!cityIndex[city]) {
                        cityIndex[city] = [];
                    }
                    cityIndex[city].push(profileId);
                }

                indexedProfiles++;
            }

            if (indexedProfiles % 10000 === 0) {
                console.log(`📊 [FAST INDEX PROGRESS] Индексировано ${indexedProfiles} профилей`);
            }
        }

        // Сохраняем индексы
        indexesDB.put('index:country', countryIndex);
        indexesDB.put('index:country_city', countryCityIndex);
        indexesDB.put('index:city', cityIndex);

        const fastIndexTime = Date.now() - fastIndexStartTime;
        console.log(`✅ ЭТАП 3 ЗАВЕРШЕН за ${fastIndexTime}мс`);
        console.log(`📊 [FAST INDEX STATS] Стран: ${Object.keys(countryIndex).length}, Городов: ${Object.keys(cityIndex).length}`);
        console.log("-".repeat(40));

        // ==================== ИТОГОВАЯ СТАТИСТИКА ====================
        const totalTime = Date.now() - globalStartTime;

        console.log("🎉 ========== ЗАГРУЗКА В LMDB ЗАВЕРШЕНА ==========");
        console.log(`⏱️  ОБЩЕЕ ВРЕМЯ: ${(totalTime / 1000).toFixed(1)} секунд`);
        console.log(`📊 ПРОФИЛЕЙ: ${totalLoaded}`);
        console.log(`🌍 СТРАН: ${countriesSet.size}`);
        console.log(`🌆 ГОРОДОВ: ${totalCities}`);
        console.log(`⚡ СКОРОСТЬ: ${(totalLoaded / (totalTime / 1000)).toFixed(0)} профилей/сек`);
        
        // Статистика памяти
        const mem = process.memoryUsage();
        console.log(`💾 ПАМЯТЬ: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log("=".repeat(60));

        return true;

    } catch (error) {
        console.error("❌ ОШИБКА ЗАГРУЗКИ В LMDB:", error);
        return false;
    } finally {
        fullCacheLoading = false;
        console.log(`🔓 [LMDB FULL CACHE] Блокировка загрузки снята`);
    }
},

 // 2. ЗАГРУЗКА ДЕМО-КЭША В LMDB
// 2. ЗАГРУЗКА ДЕМО-КЭША В LMDB (КОМПЛЕКТНОЕ ИСПРАВЛЕНИЕ)
async loadGlobalDemoCache(db) {
    if (demoCacheLoading) {
        console.log("⏳ [LMDB DEMO CACHE] Уже загружается...");
        return false;
    }

    demoCacheLoading = true;
    console.log("🚀 [LMDB DEMO CACHE] Начинаем загрузку демо-кэша в LMDB...");

    try {
        // 🔥 ШАГ 1: ПРОВЕРЯЕМ ЕСТЬ ЛИ ДЕМО-ДАННЫЕ
        const demoKeys = Array.from(demoDB.getKeys());
        console.log(`📊 [DEMO CHECK] Демо-LMDB уже содержит: ${demoKeys.length} профилей`);
        
        // 🔥 УВЕЛИЧИВАЕМ МИНИМАЛЬНЫЙ ПОРОГ
        if (demoKeys.length >= 30000) { // ← Было 1000, теперь 30000
            console.log(`✅ [DEMO EXISTS] Демо-кэш уже загружен: ${demoKeys.length} профилей`);
            
            const demoCountries = indexesDB.get('demo:countries');
            if (!demoCountries || demoCountries.length === 0) {
                console.log(`🔄 [DEMO NO COUNTRIES] Извлекаем страны...`);
                await this.extractCountriesFromDemoProfiles();
            }
            
            demoCacheLoading = false;
            return true;
        }

        // 🔥 🔥 🔥 ШАГ 2: ИСПОЛЬЗУЕМ ПОЛНЫЕ ПРОФИЛИ ИЗ LMDB (ГЛАВНОЕ ИСПРАВЛЕНИЕ!)
        console.log(`📥 [DEMO FROM FULL LMDB] Создаем демо-кэш из полной LMDB...`);
        
        const fullProfileKeys = Array.from(profilesDB.getKeys());
        console.log(`📊 [FULL PROFILES] Всего профилей в полной LMDB: ${fullProfileKeys.length}`);
        
        if (fullProfileKeys.length === 0) {
            console.log(`❌ [DEMO ERROR] Полная LMDB пуста! Загружаем полный кэш...`);
            
            // Загружаем сначала полный кэш
            await this.loadGlobalFullCache(db);
            
            // Обновляем список ключей
            const updatedKeys = Array.from(profilesDB.getKeys());
            console.log(`📊 [AFTER FULL LOAD] Теперь в полной LMDB: ${updatedKeys.length} профилей`);
        }

        // 🔥 ШАГ 3: ЗАГРУЖАЕМ ДАННЫЕ ИЗ FIRESTORE (ЕСЛИ НУЖНО)
        console.log(`📥 [DEMO FROM FIRESTORE] Загружаем профили из Firestore`);

        const startTime = Date.now();
        let allProfiles = [];
        let lastDoc = null;
        let batchCount = 0;
        const BATCH_SIZE = 5000;
        
        // 🔥 🔥 🔥 УВЕЛИЧИВАЕМ ДО 70000!
        const MAX_PROFILES = 70000; // ← ИСПРАВЛЕНО!
        
        console.log(`🎯 [DEMO TARGET] Цель: ${MAX_PROFILES} профилей для демо-кэша`);

        while (allProfiles.length < MAX_PROFILES) {
            batchCount++;
            console.log(`📦 [DEMO BATCH ${batchCount}] Загрузка ${BATCH_SIZE} анкет...`);

            let query = db
                .collection("profiles")
                .orderBy("createdAt", "desc")
                .limit(BATCH_SIZE)
                .select(
                    "id",
                    "name",
                    "age",
                    "country",
                    "city",
                    "about",
                    "photoUrl",
                    "telegram",
                    "phone",
                    "whatsapp",
                    "photos",
                    "createdAt"
                );

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            const docsCount = snapshot.docs.length;

            readingStats.addRead("profiles", "system", docsCount, "firestore");

            if (docsCount === 0) {
                console.log(`✅ [DEMO LOAD COMPLETE] Больше анкет нет. Всего: ${allProfiles.length}`);
                break;
            }

            const batchProfiles = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            allProfiles.push(...batchProfiles);
            lastDoc = snapshot.docs[docsCount - 1];

            console.log(`📊 [DEMO BATCH ${batchCount}] Загружено: ${docsCount} анкет | Всего: ${allProfiles.length}`);

            if (docsCount === BATCH_SIZE) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ [DEMO LOADED] Загружено ${allProfiles.length} профилей за ${loadTime}с`);

        // 🔥 ШАГ 4: СОЗДАЕМ ДЕМО-КЭШ
        const result = await this.createDemoCacheFromProfilesLMDB(allProfiles);
        
        if (result) {
            console.log(`✅ [DEMO CACHE CREATED] Демо-кэш создан успешно`);
            
            // Проверяем конкретные города
            console.log(`🔍 [DEMO VERIFICATION] Проверяем наличие городов...`);
            
            const demoStats = this.getLMDBStats();
            console.log(`📊 [DEMO STATS] Демо-профилей: ${demoStats.demoProfilesCount}`);
            
            // Проверяем наличие Костромы
            const russiaCities = this.getGlobalCities("Россия", true);
            console.log(`🏙️ [RUSSIA CITIES IN DEMO] ${russiaCities.length} городов`);
            
            if (russiaCities.includes("Кострома")) {
                console.log(`✅ [SUCCESS] Кострома найдена в демо-кэше!`);
            } else {
                console.log(`❌ [WARNING] Кострома не найдена в демо-кэше!`);
                console.log(`   Примеры городов: ${russiaCities.slice(0, 10).join(', ')}`);
            }
        }
        
        return result;

    } catch (error) {
        console.error(`❌ [LMDB DEMO CACHE] Ошибка:`, error);
        return false;
    } finally {
        demoCacheLoading = false;
    }
},
// 🔥 НОВЫЙ МЕТОД: ОТЛАДКА ВАРИАНТОВ НАПИСАНИЯ СТРАН
debugCountryVariants: function(countryName) {
    try {
        console.log(`🔍 [DEBUG COUNTRY] Анализируем варианты для: "${countryName}"`);
        
        const normalizedCountry = this.normalizeCountryName(countryName);
        console.log(`✅ Нормализовано: "${normalizedCountry}"`);
        
        const profileKeys = Array.from(profilesDB.getKeys());
        console.log(`📊 Всего профилей для анализа: ${profileKeys.length}`);
        
        const countryVariants = new Map();
        let totalProfiles = 0;
        
        // Собираем все варианты написания
        for (const profileId of profileKeys) {
            const profile = profilesDB.get(profileId);
            if (!profile || !profile.c) continue;
            
            const profileCountry = profile.c.trim();
            if (!profileCountry || profileCountry === 'Не указана') continue;
            
            const normalizedProfileCountry = this.normalizeCountryName(profileCountry);
            
            // Если совпадает с запрошенной страной
            if (normalizedProfileCountry === normalizedCountry) {
                totalProfiles++;
                
                if (!countryVariants.has(profileCountry)) {
                    countryVariants.set(profileCountry, 0);
                }
                countryVariants.set(profileCountry, countryVariants.get(profileCountry) + 1);
            }
            // Также проверяем по ключевым словам для Украины/России
            else if ((normalizedCountry.includes('Украин') && 
                     (profileCountry.includes('Украин') || profileCountry.includes('Ukrain'))) ||
                    (normalizedCountry.includes('Росс') && 
                     (profileCountry.includes('Росс') || profileCountry.includes('Russ')))) {
                totalProfiles++;
                
                if (!countryVariants.has(profileCountry)) {
                    countryVariants.set(profileCountry, 0);
                }
                countryVariants.set(profileCountry, countryVariants.get(profileCountry) + 1);
            }
        }
        
        // Сортируем по частоте
        const sortedVariants = Array.from(countryVariants.entries())
            .sort((a, b) => b[1] - a[1]);
        
        console.log(`📊 [DEBUG RESULT] Всего профилей с этой страной: ${totalProfiles}`);
        console.log(`📊 [DEBUG RESULT] Вариантов написания: ${sortedVariants.length}`);
        
        if (sortedVariants.length > 0) {
            console.log(`📋 Топ вариантов написания:`);
            sortedVariants.slice(0, 10).forEach(([variant, count], index) => {
                console.log(`   ${index + 1}. "${variant}": ${count} профилей`);
            });
        }
        
        return {
            normalized: normalizedCountry,
            totalProfiles: totalProfiles,
            variants: sortedVariants,
            allVariants: Array.from(countryVariants.keys())
        };
        
    } catch (error) {
        console.error(`❌ [DEBUG COUNTRY ERROR]:`, error);
        return null;
    }
},
 // 3. СОЗДАНИЕ ДЕМО-КЭША ИЗ ПРОФИЛЕЙ В LMDB
async createDemoCacheFromProfilesLMDB(profiles) {
    try {
        console.log(`🔧 [LMDB DEMO CREATION] Создаем демо-кэш из ${profiles.length} профилей...`);

        const demoCountries = new Set();
        const demoCitiesByCountry = new Map();
        const cityProfilesCount = new Map();
        let demoProfilesCount = 0;

        // 🔥 СОЗДАЕМ ДЕМО-ВЕРСИИ (3 анкеты на город, скрываем контакты)
        for (let i = 0; i < profiles.length; i++) {
            const profile = profiles[i];

            // Получаем данные
            const originalName = profile.name || "";
            const originalAge = profile.age || 0;
            const originalCountry = profile.country || "";
            const originalCity = profile.city || "";
            const originalAbout = profile.about || "";
            const originalPhotoUrl = profile.photoUrl || "";
            const originalPhotos = profile.photos || [];

            // Нормализуем
            const normalizedCountry = originalCountry
                ? this.normalizeCountryName(originalCountry)
                : "Не указана";
            const normalizedCity = originalCity
                ? this.normalizeCityName(originalCity)
                : "Не указан";

            // Сохраняем для списков
            if (normalizedCountry && normalizedCountry !== "Не указана") {
                demoCountries.add(normalizedCountry);

                if (!demoCitiesByCountry.has(normalizedCountry)) {
                    demoCitiesByCountry.set(normalizedCountry, new Set());
                }
                if (normalizedCity && normalizedCity !== "Не указан") {
                    demoCitiesByCountry.get(normalizedCountry).add(normalizedCity);
                }
            }

            // Проверяем лимит 3 анкеты на город
            const cityKey = `${normalizedCountry}_${normalizedCity}`;
            const currentCount = cityProfilesCount.get(cityKey) || 0;

            if (currentCount >= 3) {
                continue;
            }

            cityProfilesCount.set(cityKey, currentCount + 1);

            // 🔥 СОЗДАЕМ ДЕМО-ПРОФИЛЬ
            const demoProfile = {
                id: profile.id || `demo_${Date.now()}_${i}`,
                n: originalName || `Анкета ${i + 1}`,
                a: parseInt(originalAge) || 0,
                c: normalizedCountry,
                ct: normalizedCity,
                ab: replaceSitesInAbout(originalAbout),
                p: originalPhotoUrl,
                phs: originalPhotos,
                tg: null, // КОНТАКТЫ СКРЫТЫ
                tel: null,
                wa: null,
                ca: profile.createdAt || new Date(),
                isDemo: true,
            };

            // Проверяем наличие фото
            const hasPhoto = demoProfile.p && demoProfile.p.trim() !== "";
            const hasPhotos = demoProfile.phs && demoProfile.phs.length > 0;

            if (!hasPhoto && !hasPhotos) {
                continue;
            }

            // 🔥 СОХРАНЯЕМ В LMDB
            demoDB.put(demoProfile.id, demoProfile);
            demoProfilesCount++;

            // Прогресс
            if (demoProfilesCount % 1000 === 0) {
                console.log(`💾 [DEMO SAVE] Сохранено ${demoProfilesCount} демо-профилей`);
            }

            if (i % 5000 === 0 && i > 0) {
                console.log(`📊 [DEMO PROGRESS] Обработано ${i}/${profiles.length}, создано ${demoProfilesCount} демо-профилей`);
            }
        }

        console.log(`✅ [DEMO CREATION] Создано ${demoProfilesCount} демо-профилей`);

        if (demoProfilesCount === 0) {
            console.log(`❌ [DEMO CRITICAL] Не создано ни одного демо-профиля!`);
            return false;
        }

        // 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥
        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: СОХРАНЯЕМ СТРАНЫ И ГОРОДА ДЛЯ ДЕМО
        // 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥

        console.log(`📊 [DEMO GEO SAVE] Сохраняем ${demoCountries.size} стран и города в LMDB...`);

        // 1. СОХРАНЯЕМ СТРАНЫ
        const sortedCountries = Array.from(demoCountries).sort();
        
        // Удаляем старые данные
        indexesDB.remove('demo:countries');
        
        // Сохраняем новые
        indexesDB.put('demo:countries', sortedCountries);
        // 🔥 ДАЁМ ВРЕМЯ НА СОХРАНЕНИЕ (100мс)
await new Promise(resolve => setTimeout(resolve, 100));
        // ПРОВЕРЯЕМ
        const savedCountries = indexesDB.get('demo:countries');
        if (!savedCountries || savedCountries.length === 0) {
            console.log(`❌ [DEMO COUNTRIES FAILED] Страны не сохранились в LMDB!`);
        } else {
            console.log(`✅ [DEMO COUNTRIES SAVED] Сохранено ${savedCountries.length} стран в LMDB`);
        }

        // 2. СОХРАНЯЕМ ГОРОДА ПО СТРАНАМ
        let totalCitiesSaved = 0;
        
        for (const [country, citiesSet] of demoCitiesByCountry) {
            const citiesArray = Array.from(citiesSet).sort();
            
            if (citiesArray.length === 0) continue;
            
            // 🔥 КЛЮЧ ДОЛЖЕН БЫТЬ ТОЧНО demo:cities:${country}
            const cityKey = `demo:cities:${country}`;
            
            // Удаляем старые данные
            indexesDB.remove(cityKey);
            
            // Сохраняем новые
            indexesDB.put(cityKey, citiesArray);
            totalCitiesSaved += citiesArray.length;
            
            // 🔥 СРАЗУ ПРОВЕРЯЕМ СОХРАНИЛОСЬ ЛИ
            
        }

        console.log(`✅ [DEMO GEO FINAL] Всего сохранено: ${sortedCountries.length} стран, ${totalCitiesSaved} городов`);

        // 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥
        // 🔥 СОЗДАЕМ ИНДЕКСЫ ДЛЯ БЫСТРОГО ПОИСКА В ДЕМО-БАЗЕ
        // 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥

        console.log(`📇 [DEMO INDEX] Создание индексов для демо-кэша...`);

        // 🔥 ВАЖНО: getKeys() возвращает итератор, преобразуем в массив
const profileKeys = Array.from(demoDB.getKeys());
console.log(`📊 [DEMO INDEX] Всего профилей в демо-LMDB: ${profileKeys.length}`);

if (profileKeys.length === 0) {
    console.log(`❌ [DEMO INDEX ERROR] Демо-LMDB пуста!`);
    return false;
}
        const demoCountryCityIndex = {};
        const demoCountryIndex = {};
        const demoCityIndex = {};
        let indexedProfiles = 0;

        for (const profileId of profileKeys) {
            const profile = demoDB.get(profileId);
            if (!profile) continue;

            const country = profile.c;
            const city = profile.ct;

            if (country && country.trim() !== "" && country !== "Не указана") {
                // Индекс по стране
                if (!demoCountryIndex[country]) {
                    demoCountryIndex[country] = [];
                }
                demoCountryIndex[country].push(profileId);

                // Индекс по стране+городу
                if (city && city.trim() !== "" && city !== "Не указан") {
                    const key = `${country}:${city}`;
                    if (!demoCountryCityIndex[key]) {
                        demoCountryCityIndex[key] = [];
                    }
                    demoCountryCityIndex[key].push(profileId);

                    // Индекс только по городу
                    if (!demoCityIndex[city]) {
                        demoCityIndex[city] = [];
                    }
                    demoCityIndex[city].push(profileId);
                }

                indexedProfiles++;
            }

            if (indexedProfiles % 5000 === 0) {
                console.log(`📊 [DEMO INDEX PROGRESS] Индексировано ${indexedProfiles} профилей`);
            }
        }

        console.log(`📊 [DEMO INDEX STATS] Всего профилей с данными: ${indexedProfiles}`);
        console.log(`📊 [DEMO INDEX STATS] Уникальных стран: ${Object.keys(demoCountryIndex).length}`);
        console.log(`📊 [DEMO INDEX STATS] Уникальных городов: ${Object.keys(demoCityIndex).length}`);

        // 🔥 СОХРАНЯЕМ ИНДЕКСЫ В LMDB С ПРЕФИКСОМ demo:
        indexesDB.remove('demo:index:country_city');
        indexesDB.remove('demo:index:country');
        indexesDB.remove('demo:index:city');
        
        indexesDB.put('demo:index:country_city', demoCountryCityIndex);
        indexesDB.put('demo:index:country', demoCountryIndex);
        indexesDB.put('demo:index:city', demoCityIndex);

        console.log(`✅ [DEMO INDEX DONE] Индексы сохранены в LMDB`);

        // 🔥 ФИНАЛЬНАЯ ПРОВЕРКА
        console.log(`🔍 [DEMO FINAL CHECK] Проверяем сохраненные данные...`);
        
        const finalCountries = indexesDB.get('demo:countries');
        const testCountry = sortedCountries.length > 0 ? sortedCountries[0] : null;
        const testCities = testCountry ? indexesDB.get(`demo:cities:${testCountry}`) : null;
        
        console.log(`📊 [DEMO CHECK] Страны в LMDB: ${finalCountries?.length || 0}`);
        console.log(`📊 [DEMO CHECK] Тестовая страна "${testCountry}": ${testCities?.length || 0} городов`);
        
        if (testCountry && (!testCities || testCities.length === 0)) {
            console.log(`⚠️ [DEMO WARNING] Для тестовой страны "${testCountry}" нет городов!`);
            
            // 🔥 АВАРИЙНОЕ СОХРАНЕНИЕ: сохраняем города без префикса
            console.log(`🔄 [DEMO EMERGENCY] Сохраняем города без префикса...`);
            
            for (const [country, citiesSet] of demoCitiesByCountry) {
                const citiesArray = Array.from(citiesSet).sort();
                if (citiesArray.length > 0) {
                    indexesDB.put(`cities:${country}`, citiesArray);
                }
            }
        }

        return true;

    } catch (error) {
        console.error(`❌ [DEMO CREATION ERROR] Ошибка создания демо-кэша:`, error);
        return false;
    }
},

  // 4. СОЗДАНИЕ ДЕМО-КЭША ИЗ ПОЛНЫХ ПРОФИЛЕЙ В LMDB
  async createDemoCacheFromFullProfilesLMDB() {
    try {
      console.log(`🔧 [DEMO FROM FULL LMDB] Создаем демо-кэш из полного LMDB...`);

      const profileKeys = profilesDB.getKeys();
      console.log(`📊 [FULL PROFILES] Всего профилей в LMDB: ${profileKeys.length}`);

      if (profileKeys.length === 0) {
        console.log(`❌ [DEMO ERROR] Полный LMDB пуст!`);
        return false;
      }

      const transaction = demoDB.transaction();
      const demoCountries = new Set();
      const demoCitiesByCountry = new Map();
      const cityProfilesCount = new Map();
      let demoProfilesCount = 0;
      let processedProfiles = 0;

      // 🔥 ОБРАБАТЫВАЕМ ПРОФИЛИ ИЗ ПОЛНОГО LMDB
      for (const profileId of profileKeys) {
        processedProfiles++;
        const profile = profilesDB.get(profileId);
        if (!profile) continue;

        // Нормализуем
        const normalizedCountry = profile.c || "Не указана";
        const normalizedCity = profile.ct || "Не указан";

        // Сохраняем для списков
        if (normalizedCountry && normalizedCountry !== "Не указана") {
          demoCountries.add(normalizedCountry);

          if (!demoCitiesByCountry.has(normalizedCountry)) {
            demoCitiesByCountry.set(normalizedCountry, new Set());
          }
          if (normalizedCity && normalizedCity !== "Не указан") {
            demoCitiesByCountry.get(normalizedCountry).add(normalizedCity);
          }
        }

        // Проверяем лимит 3 анкеты на город
        const cityKey = `${normalizedCountry}_${normalizedCity}`;
        const currentCount = cityProfilesCount.get(cityKey) || 0;

        if (currentCount >= 3) {
          continue;
        }

        cityProfilesCount.set(cityKey, currentCount + 1);

        // 🔥 СОЗДАЕМ ДЕМО-ПРОФИЛЬ (скрываем контакты)
        const demoProfile = {
          id: profile.id || `demo_${profileId}`,
          n: profile.n || `Анкета ${demoProfilesCount + 1}`,
          a: parseInt(profile.a) || 0,
          c: normalizedCountry,
          ct: normalizedCity,
          ab: replaceSitesInAbout(profile.ab || ""),
          p: profile.p || "",
          phs: profile.phs || [],
          tg: null, // КОНТАКТЫ СКРЫТЫ
          tel: null,
          wa: null,
          ca: profile.ca || new Date(),
          isDemo: true,
        };

        // Проверяем наличие фото
        const hasPhoto = demoProfile.p && demoProfile.p.trim() !== "";
        const hasPhotos = demoProfile.phs && demoProfile.phs.length > 0;

        if (!hasPhoto && !hasPhotos) {
          continue;
        }

        // Сохраняем в LMDB
        transaction.put(demoProfile.id, demoProfile);
        demoProfilesCount++;

        // Периодически коммитим
        if (demoProfilesCount % 1000 === 0) {
          await transaction.commit();
          console.log(`💾 [DEMO SAVE] Сохранено ${demoProfilesCount} демо-профилей`);
          transaction = demoDB.transaction();
        }

        // Прогресс
        if (processedProfiles % 10000 === 0) {
          console.log(`📊 [DEMO PROGRESS] Обработано ${processedProfiles}/${profileKeys.length}, создано ${demoProfilesCount} демо-профилей`);
        }
      }

      // Финальный коммит
      await transaction.commit();

      console.log(`✅ [DEMO CREATION] Создано ${demoProfilesCount} демо-профилей из ${processedProfiles} полных`);

      if (demoProfilesCount === 0) {
        console.log(`❌ [DEMO CRITICAL] Не создано ни одного демо-профиля!`);
        return false;
      }

      // 🔥 СОХРАНЯЕМ СТРАНЫ И ГОРОДЫ ДЛЯ ДЕМО
      const sortedCountries = Array.from(demoCountries).sort();
      await indexesDB.put('demo:countries', sortedCountries);

      // Сохраняем города по странам
      for (const [country, citiesSet] of demoCitiesByCountry) {
        await indexesDB.put(`demo:cities:${country}`, Array.from(citiesSet).sort());
      }

      // 🔥 СОЗДАЕМ ИНДЕКСЫ ДЛЯ ДЕМО-КЭША
      console.log(`📇 [DEMO INDEX] Создание индексов для демо-кэша...`);
      await this.createDemoIndexesLMDB();

      return true;

    } catch (error) {
      console.error(`❌ [DEMO FROM FULL ERROR] Ошибка создания демо-кэша:`, error);
      return false;
    }
  },

  // 5. СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ДЕМО-КЭША В LMDB
  async createDemoIndexesLMDB() {
    try {
      console.log(`📇 [DEMO INDEX LMDB] Создание индексов для демо-кэша...`);

      const profileKeys = demoDB.getKeys();
      const transaction = indexesDB.transaction();

      const demoCountryCityIndex = {};
      const demoCountryIndex = {};
      const demoCityIndex = {};
      let indexedProfiles = 0;

      for (const profileId of profileKeys) {
        const profile = demoDB.get(profileId);
        if (!profile) continue;

        const country = profile.c;
        const city = profile.ct;

        if (country && country !== "Не указана") {
          // Индекс по стране
          if (!demoCountryIndex[country]) {
            demoCountryIndex[country] = [];
          }
          demoCountryIndex[country].push(profileId);

          // Индекс по стране+городу
          if (city && city !== "Не указан") {
            const key = `${country}:${city}`;
            if (!demoCountryCityIndex[key]) {
              demoCountryCityIndex[key] = [];
            }
            demoCountryCityIndex[key].push(profileId);

            // Индекс только по городу
            if (!demoCityIndex[city]) {
              demoCityIndex[city] = [];
            }
            demoCityIndex[city].push(profileId);
          }

          indexedProfiles++;
        }

        // Прогресс
        if (indexedProfiles % 5000 === 0) {
          console.log(`📊 [DEMO INDEX PROGRESS] Индексировано ${indexedProfiles} профилей`);
        }
      }

      // Сохраняем индексы в LMDB
      transaction.put('demo:index:country_city', demoCountryCityIndex);
      transaction.put('demo:index:country', demoCountryIndex);
      transaction.put('demo:index:city', demoCityIndex);

      await transaction.commit();

      console.log(`✅ [DEMO INDEX DONE] Индексы созданы: ${Object.keys(demoCountryIndex).length} стран, ${Object.keys(demoCountryCityIndex).length} пар страна+город`);

      return true;
    } catch (error) {
      console.error(`❌ [DEMO INDEX ERROR] Ошибка создания индексов:`, error);
      return false;
    }
  },

  // 6. ПОЛУЧЕНИЕ ПРОФИЛЕЙ ИЗ LMDB
  getGlobalProfiles(isDemo = false) {
    try {
      lmdbMemoryUsage.reads++;
      
      if (isDemo) {
        const profileKeys = demoDB.getKeys();
        const profiles = [];
        
        for (const key of profileKeys) {
          const profile = demoDB.get(key);
          if (profile) {
            profiles.push(profile);
          }
        }
        
        console.log(`✅ [LMDB DEMO] Загружено ${profiles.length} профилей из LMDB`);
        return profiles;
      } else {
        const profileKeys = profilesDB.getKeys();
        const profiles = [];
        
        for (const key of profileKeys) {
          const profile = profilesDB.get(key);
          if (profile) {
            profiles.push(profile);
          }
        }
        
        console.log(`✅ [LMDB FULL] Загружено ${profiles.length} профилей из LMDB`);
        return profiles;
      }
    } catch (error) {
      console.error(`❌ [LMDB GET PROFILES] Ошибка:`, error);
      return [];
    }
  },

  // 7. ПОЛУЧЕНИЕ ОДНОГО ПРОФИЛЯ ИЗ LMDB ПО ID
  getProfileById(profileId, isDemo = false) {
    try {
      lmdbMemoryUsage.reads++;
      
      if (isDemo) {
        return demoDB.get(profileId);
      } else {
        return profilesDB.get(profileId);
      }
    } catch (error) {
      console.error(`❌ [LMDB GET BY ID] Ошибка:`, error);
      return null;
    }
  },

// 8. ПОЛУЧЕНИЕ СТРАН ИЗ LMDB
getGlobalCountries(isDemo = false) {
    try {
        lmdbMemoryUsage.reads++;
        
        if (isDemo) {
            const countries = indexesDB.get('demo:countries');
            if (countries && countries.length > 0) {
                console.log(`✅ [DEMO COUNTRIES] Из LMDB: ${countries.length} стран`);
                return countries;
            }
            const alternativeCountries = indexesDB.get('demo:all_countries');
            if (alternativeCountries && alternativeCountries.length > 0) {
                console.log(`✅ [DEMO COUNTRIES ALT] Из альтернативного ключа: ${alternativeCountries.length} стран`);
                return alternativeCountries;
            }
            // 🔥 ЕСЛИ НЕТ В ИНДЕКСАХ - ПРОБУЕМ ИЗ ПРОФИЛЕЙ
            console.log(`🔍 [DEMO COUNTRIES MISSING] Извлекаем из профилей...`);
            return this.extractCountriesFromDemoProfiles();
        } else {
            const countries = indexesDB.get('countries:all');
            if (countries && countries.length > 0) {
                console.log(`✅ [FULL COUNTRIES] Из LMDB: ${countries.length} стран`);
                return countries;
            }
            
            // 🔥 ЕСЛИ НЕТ В ИНДЕКСАХ - ПРОБУЕМ ИЗ ПРОФИЛЕЙ
            console.log(`🔍 [FULL COUNTRIES MISSING] Извлекаем из профилей...`);
            return this.extractCountriesFromFullProfiles();
        }
    } catch (error) {
        console.error(`❌ [LMDB GET COUNTRIES] Ошибка:`, error);
        return FALLBACK_COUNTRIES;
    }
},

// 🔥 НОВАЯ ФУНКЦИЯ: извлекаем страны из демо-профилей
extractCountriesFromDemoProfiles() {
    try {
        console.log(`🌍 [EXTRACT COUNTRIES] Извлекаем страны из демо-профилей...`);
        
        // 🔥 ИСПРАВЛЕНИЕ: getKeys() возвращает итератор
        const profileKeys = Array.from(demoDB.getKeys());
        console.log(`📊 [EXTRACT COUNTRIES] Всего профилей в демо-LMDB: ${profileKeys.length}`);
        
        if (profileKeys.length === 0) {
            console.log(`⚠️ [EXTRACT COUNTRIES] Демо-LMDB пуст`);
            return [];
        }
        
        const countriesSet = new Set();
        let processed = 0;
        let validProfiles = 0;
        
        for (const profileId of profileKeys) {
            const profile = demoDB.get(profileId);
            if (profile && profile.c && profile.c.trim() !== "" && profile.c !== "Не указана") {
                countriesSet.add(profile.c);
                validProfiles++;
            }
            
            processed++;
            if (processed % 10000 === 0) {
                console.log(`🌍 [EXTRACT COUNTRIES] Обработано ${processed} профилей`);
            }
        }
        
        const countries = Array.from(countriesSet).sort();
        console.log(`✅ [EXTRACTED COUNTRIES] Найдено ${validProfiles} валидных профилей с ${countries.length} странами`);
        
        if (countries.length === 0) {
            console.log(`⚠️ [EXTRACT COUNTRIES] Не найдено ни одной страны в профилях!`);
            // Возвращаем fallback
            const fallback = FALLBACK_COUNTRIES || [];
            console.log(`🔄 [EXTRACT COUNTRIES] Возвращаем ${fallback.length} fallback стран`);
            indexesDB.put('demo:countries', fallback);
            return fallback;
        }
        
        // Сохраняем в indexesDB на будущее
        indexesDB.put('demo:countries', countries);
        console.log(`✅ [EXTRACTED COUNTRIES] Сохранено ${countries.length} стран в индексы`);
        
        return countries;
    } catch (error) {
        console.error(`❌ [EXTRACT COUNTRIES ERROR]:`, error);
        // Всегда возвращаем fallback при ошибке
        const fallback = FALLBACK_COUNTRIES || [];
        console.log(`🔄 [EXTRACT COUNTRIES ERROR] Возвращаем ${fallback.length} fallback стран при ошибке`);
        return fallback;
    }
},
// 🔥 НОВАЯ ФУНКЦИЯ: извлекаем страны из полных профилей
extractCountriesFromFullProfiles() {
    try {
        const profileKeys = profilesDB.getKeys();
        const countriesSet = new Set();
        let processed = 0;
        
        for (const profileId of profileKeys) {
            const profile = profilesDB.get(profileId);
            if (profile && profile.c && profile.c !== "Не указана") {
                countriesSet.add(profile.c);
            }
            
            processed++;
            if (processed % 10000 === 0) {
                console.log(`🌍 [EXTRACT FULL COUNTRIES] Обработано ${processed} профилей`);
            }
        }
        
        const countries = Array.from(countriesSet).sort();
        console.log(`✅ [EXTRACTED FULL COUNTRIES] Найдено ${countries.length} стран из полных профилей`);
        
        // Сохраняем в indexesDB на будущее
        indexesDB.put('countries:all', countries);
        
        return countries;
    } catch (error) {
        console.error(`❌ [EXTRACT FULL COUNTRIES ERROR]:`, error);
        return [];
    }
},

// 9. ПОЛУЧЕНИЕ ГОРОДОВ ИЗ LMDB (УПРОЩЕННАЯ РАБОЧАЯ ВЕРСИЯ)
getGlobalCities: function(country, isDemo = false) {
    try {
        console.log(`🌆 [GET CITIES] Запрос городов для: "${country}" (демо: ${isDemo})`);
        
        lmdbMemoryUsage.reads++;
        
        // 🔥 ВАЖНО: Нормализуем название страны
        const normalizedCountry = this.normalizeCountryName(country);
        console.log(`🔍 [NORMALIZED] "${country}" → "${normalizedCountry}"`);
        
        if (isDemo) {
            // 🔥 ДЛЯ ДЕМО: сначала пробуем демо-индекс
            const demoKey = `demo:cities:${normalizedCountry}`;
            let cities = indexesDB.get(demoKey);
            
            if (cities && cities.length > 0) {
                console.log(`✅ [DEMO CITIES] Из индекса: ${cities.length} городов`);
                return cities;
            }
            
            // 🔥 Если нет в демо - пробуем общий индекс
            const generalKey = `cities:${normalizedCountry}`;
            cities = indexesDB.get(generalKey);
            
            if (cities && cities.length > 0) {
                console.log(`✅ [DEMO FROM GENERAL] Из общего индекса: ${cities.length} городов`);
                indexesDB.put(demoKey, cities); // Сохраняем в демо на будущее
                return cities;
            }
            
            // 🔥 Если нет в индексах - извлекаем
            console.log(`🔄 [DEMO EXTRACT] Извлекаем города из демо-профилей`);
            return this.extractCitiesFromDemoProfiles(normalizedCountry);
            
        } else {
            // 🔥 ДЛЯ ПОЛНОГО ДОСТУПА
            const fullKey = `cities:${normalizedCountry}`;
            let cities = indexesDB.get(fullKey);
            
            if (cities && cities.length > 0) {
                console.log(`✅ [FULL CITIES] Из индекса: ${cities.length} городов`);
                return cities;
            }
            
            // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Пробуем разные варианты ключей
            console.log(`🔍 [FULL NOT FOUND] Не найден ключ: ${fullKey}`);
            
            // Вариант 1: Пробуем ключ без нормализации
            const rawKey = `cities:${country}`;
            cities = indexesDB.get(rawKey);
            if (cities && cities.length > 0) {
                console.log(`✅ [RAW KEY] Нашли по сырому ключу: ${rawKey} → ${cities.length} городов`);
                indexesDB.put(fullKey, cities); // Сохраняем под нормализованным ключом
                return cities;
            }
            
            // Вариант 2: Ищем все ключи с городами
            console.log(`🔍 [SEARCH ALL KEYS] Ищем ключи содержащие "cities:"`);
            const allKeys = Array.from(indexesDB.getKeys());
            const cityKeys = allKeys.filter(key => 
                key.startsWith('cities:') && key.includes('Украин')
            );
            
            console.log(`🔍 [KEYS FOUND] Найдено ключей: ${cityKeys.length}`);
            cityKeys.forEach(key => {
                const data = indexesDB.get(key);
                console.log(`   ${key}: ${data?.length || 0} городов`);
            });
            
            // 🔥 ИЗВЛЕКАЕМ ЗАНОВО
            console.log(`🔄 [FULL EXTRACT] Запускаем извлечение городов`);
            cities = this.extractCitiesFromFullProfiles(normalizedCountry);
            
            if (cities.length > 0) {
                console.log(`✅ [EXTRACTED] Извлечено ${cities.length} городов`);
                
                // 🔥 СОХРАНЯЕМ ПОД РАЗНЫМИ КЛЮЧАМИ НА ВСЯКИЙ СЛУЧАЙ
                indexesDB.put(fullKey, cities);
                indexesDB.put(`cities:${country}`, cities);
                
                // Также сохраняем для демо на будущее
                indexesDB.put(`demo:cities:${normalizedCountry}`, cities.slice(0, 30)); // 30 городов для демо
                
                return cities;
            }
            
            return [];
        }
        
    } catch (error) {
        console.error(`❌ [GET CITIES ERROR] Для "${country}":`, error);
        
        // Fallback для популярных стран
        const fallback = {
            '🇺🇦 Украина': ['Киев', 'Одесса', 'Харьков', 'Львов', 'Днепр', 'Запорожье', 'Винница', 'Тернополь', 
                          'Хмельницкий', 'Черкассы', 'Черновцы', 'Ивано-Франковск', 'Николаев', 'Полтава', 
                          'Ровно', 'Сумы', 'Ужгород', 'Житомир', 'Краматорск', 'Славянск', 'Луцк', 'Херсон'],
            '🇷🇺 Россия': ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород']
        };
        
        if (fallback[country]) {
            console.log(`⚠️ [FALLBACK] Используем fallback для ${country}`);
            return fallback[country];
        }
        
        return [];
    }
},
// 🔥 ПЕРЕПИСАННЫЙ МЕТОД: ИЗВЛЕЧЕНИЕ ГОРОДОВ ИЗ ДЕМО-ПРОФИЛЕЙ
extractCitiesFromDemoProfiles: function(country) {
    try {
        console.log(`🌆 [DEMO EXTRACT] Извлекаем города для: "${country}" (демо-режим)`);
        
        // ШАГ 1: НОРМАЛИЗАЦИЯ
        const normalizedCountry = this.normalizeCountryName(country);
        console.log(`🔍 Нормализовано: "${country}" → "${normalizedCountry}"`);
        
        // ШАГ 2: ПРОВЕРЯЕМ ЕСТЬ ЛИ УЖЕ ВСЕ ГОРОДА В ПОЛНЫХ ИНДЕКСАХ
        const fullCitiesKey = `cities:${normalizedCountry}`;
        const allCities = indexesDB.get(fullCitiesKey);
        
        if (allCities && allCities.length > 0) {
            console.log(`✅ [DEMO FROM FULL] Найдено ${allCities.length} городов в полных индексах`);
            
            // 🔥 ВАЖНО: В ДЕМО-РЕЖИМЕ ПОКАЗЫВАЕМ ВСЕ ГОРОДА, НО ОГРАНИЧИВАЕМ 3 АНКЕТЫ НА ГОРОД
            // Это делается на уровне фильтрации анкет, а не ограничения городов!
            
            // Сохраняем все города для демо-режима
            indexesDB.put(`demo:cities:${normalizedCountry}`, allCities);
            console.log(`💾 Сохранено ${allCities.length} городов для демо-режима`);
            
            return allCities;
        }
        
        // ШАГ 3: ЕСЛИ НЕТ В ПОЛНЫХ ИНДЕКСАХ - ИЩЕМ В ДЕМО-БАЗЕ
        const profileKeys = Array.from(demoDB.getKeys());
        console.log(`📊 Всего демо-профилей: ${profileKeys.length}`);
        
        if (profileKeys.length === 0) {
            console.log(`❌ Демо-LMDB пуста!`);
            return [];
        }
        
        // ШАГ 4: ПАТТЕРНЫ ПОИСКА (ТАКИЕ ЖЕ КАК ДЛЯ ПОЛНОГО ДОСТУПА)
        const countryWithoutFlag = normalizedCountry.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
        let searchPatterns = [];
        
        if (countryWithoutFlag.includes('Украин') || countryWithoutFlag.includes('Ukrain')) {
            searchPatterns = ['Украин', 'Ukrain', 'Укр', 'Ukraine', 'UA'];
        } else if (countryWithoutFlag.includes('Росс') || countryWithoutFlag.includes('Russ')) {
            searchPatterns = ['Росс', 'Russ', 'Росси', 'Russia', 'RU'];
        } else {
            searchPatterns = [countryWithoutFlag];
        }
        
        // ШАГ 5: ИЩЕМ ГОРОДА В ДЕМО-БАЗЕ
        const citiesSet = new Set();
        let processed = 0;
        
        for (const profileId of profileKeys) {
            processed++;
            
            const profile = demoDB.get(profileId);
            if (!profile) continue;
            
            const profileCountry = profile.c || '';
            const profileCity = profile.ct || '';
            
            // Пропускаем если нет города
            if (!profileCity || profileCity.trim() === '' || 
                profileCity === 'Не указан' || profileCity === 'Не указано') {
                continue;
            }
            
            // ПРОВЕРЯЕМ СТРАНУ
            let countryMatch = false;
            const normalizedProfileCountry = this.normalizeCountryName(profileCountry);
            
            // Вариант 1: Точное совпадение
            if (normalizedProfileCountry === normalizedCountry) {
                countryMatch = true;
            }
            
            // Вариант 2: По паттернам
            if (!countryMatch) {
                const profileCountryLower = profileCountry.toLowerCase();
                for (const pattern of searchPatterns) {
                    if (profileCountryLower.includes(pattern.toLowerCase())) {
                        countryMatch = true;
                        break;
                    }
                }
            }
            
            if (countryMatch) {
                // Нормализуем и добавляем город
                let normalizedCity = profileCity.trim()
                    .replace(/^["'«»]+/, '')
                    .replace(/["'«»]+$/, '')
                    .trim();
                
                if (normalizedCity.length >= 2) {
                    citiesSet.add(normalizedCity);
                }
            }
            
            // Прогресс
            if (processed % 1000 === 0) {
                console.log(`📊 Демо-прогресс: ${processed}/${profileKeys.length}, городов: ${citiesSet.size}`);
            }
        }
        
        const cities = Array.from(citiesSet).sort();
        
        console.log(`✅ [DEMO RESULT] Для "${country}":`);
        console.log(`   • Обработано демо-профилей: ${processed}`);
        console.log(`   • Уникальных городов: ${cities.length}`);
        
        if (cities.length > 0) {
            console.log(`   • Примеры: ${cities.slice(0, 10).join(', ')}`);
        }
        
        // 🔥 ВАЖНО: Сохраняем города для демо-режима
        if (cities.length > 0) {
            indexesDB.put(`demo:cities:${normalizedCountry}`, cities);
            
            // Также сохраняем под другими ключами
            indexesDB.put(`demo:cities:${country}`, cities);
            
            if (normalizedCountry.includes('Украин')) {
                indexesDB.put('demo:cities:Украина', cities);
            }
        }
        
        return cities;
        
    } catch (error) {
        console.error(`❌ [DEMO EXTRACT ERROR] для "${country}":`, error);
        return [];
    }
},

// 🔥 ПЕРЕПИСАННЫЙ МЕТОД: ИЗВЛЕЧЕНИЕ ГОРОДОВ ИЗ ПОЛНЫХ ПРОФИЛЕЙ
extractCitiesFromFullProfiles: function(country) {
    try {
        console.log(`🌆 [EXTRACT CITIES] Начинаем извлечение городов для: "${country}"`);
        
        // ШАГ 1: НОРМАЛИЗАЦИЯ СТРАНЫ
        const normalizedCountry = this.normalizeCountryName(country);
        console.log(`🔍 Нормализовано: "${country}" → "${normalizedCountry}"`);
        
        // ШАГ 2: ПОЛУЧАЕМ ВСЕ ПРОФИЛИ
        const profileKeys = Array.from(profilesDB.getKeys());
        console.log(`📊 Всего профилей в LMDB: ${profileKeys.length}`);
        
        if (profileKeys.length === 0) {
            console.log(`❌ LMDB пуста!`);
            return [];
        }
        
        // ШАГ 3: СОЗДАЕМ КЛЮЧЕВЫЕ СЛОВА ДЛЯ ПОИСКА
        let searchPatterns = [];
        
        // Убираем флаг для поиска
        const countryWithoutFlag = normalizedCountry.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
        
        if (countryWithoutFlag.includes('Украин') || countryWithoutFlag.includes('Ukrain')) {
            searchPatterns = ['Украин', 'Ukrain', 'Укр', 'Ukraine', 'UA'];
        } else if (countryWithoutFlag.includes('Росс') || countryWithoutFlag.includes('Russ')) {
            searchPatterns = ['Росс', 'Russ', 'Росси', 'Russia', 'RU'];
        } else {
            searchPatterns = [countryWithoutFlag];
        }
        
        console.log(`🔑 Паттерны поиска: ${searchPatterns.join(', ')}`);
        
        // ШАГ 4: ИЩЕМ ГОРОДА
        const citiesMap = new Map(); // Для сбора уникальных городов
        const countryVariants = new Set(); // Для отладки вариантов страны
        let processed = 0;
        let matchedProfiles = 0;
        
        for (const profileId of profileKeys) {
            processed++;
            
            const profile = profilesDB.get(profileId);
            if (!profile) continue;
            
            const profileCountry = profile.c || '';
            const profileCity = profile.ct || '';
            
            // Пропускаем если нет города
            if (!profileCity || 
                profileCity.trim() === '' || 
                profileCity === 'Не указан' ||
                profileCity === 'Не указано') {
                continue;
            }
            
            // ПРОВЕРЯЕМ СТРАНУ
            let countryMatch = false;
            
            // Вариант 1: Точное совпадение нормализованных названий
            const normalizedProfileCountry = this.normalizeCountryName(profileCountry);
            if (normalizedProfileCountry === normalizedCountry) {
                countryMatch = true;
            }
            
            // Вариант 2: Совпадение по паттернам (без учета регистра)
            if (!countryMatch) {
                const profileCountryLower = profileCountry.toLowerCase();
                const normalizedProfileCountryLower = normalizedProfileCountry.toLowerCase();
                
                for (const pattern of searchPatterns) {
                    const patternLower = pattern.toLowerCase();
                    if (profileCountryLower.includes(patternLower) || 
                        normalizedProfileCountryLower.includes(patternLower)) {
                        countryMatch = true;
                        break;
                    }
                }
            }
            
            // Вариант 3: Для Украины - дополнительная проверка
            if (!countryMatch && searchPatterns.includes('Украин')) {
                const ukrainePatterns = ['Украин', 'Ukrain', 'Укр'];
                const hasUkraine = ukrainePatterns.some(pattern => 
                    profileCountry.toLowerCase().includes(pattern.toLowerCase()) ||
                    normalizedProfileCountry.toLowerCase().includes(pattern.toLowerCase())
                );
                if (hasUkraine) countryMatch = true;
            }
            
            if (countryMatch) {
                matchedProfiles++;
                countryVariants.add(profileCountry); // Сохраняем вариант написания
                
                // НОРМАЛИЗУЕМ ГОРОД
                let normalizedCity = profileCity.trim();
                
                // Убираем кавычки и лишние символы
                normalizedCity = normalizedCity
                    .replace(/^["'«»]+/, '')
                    .replace(/["'«»]+$/, '')
                    .trim();
                
                // Пропускаем слишком короткие названия
                if (normalizedCity.length < 2) continue;
                
                // Добавляем город в карту
                if (!citiesMap.has(normalizedCity)) {
                    citiesMap.set(normalizedCity, {
                        original: profileCity,
                        count: 1
                    });
                } else {
                    citiesMap.get(normalizedCity).count++;
                }
            }
            
            // Прогресс
            if (processed % 10000 === 0) {
                console.log(`📊 Прогресс: ${processed}/${profileKeys.length}, найдено ${citiesMap.size} городов`);
            }
        }
        
        // ШАГ 5: СОРТИРОВКА РЕЗУЛЬТАТОВ
        const sortedCities = Array.from(citiesMap.entries())
            .sort((a, b) => b[1].count - a[1].count) // Сначала города с большим количеством анкет
            .map(([city, data]) => city);
        
        // ШАГ 6: ВЫВОД СТАТИСТИКИ
        console.log(`✅ [РЕЗУЛЬТАТ] Для "${country}":`);
        console.log(`   • Обработано профилей: ${processed}`);
        console.log(`   • Соответствует стране: ${matchedProfiles}`);
        console.log(`   • Уникальных городов: ${sortedCities.length}`);
        console.log(`   • Вариантов написания страны в БД: ${countryVariants.size}`);
        
        if (countryVariants.size > 0) {
            console.log(`   • Примеры вариантов: ${Array.from(countryVariants).slice(0, 5).join(', ')}`);
        }
        
        if (sortedCities.length > 0) {
            console.log(`   • Топ-10 городов: ${sortedCities.slice(0, 10).join(', ')}`);
            if (sortedCities.length > 100) {
                console.log(`   • Всего более 100 городов, показываем первые 100`);
            }
        } else {
            console.log(`   ⚠️ Городов не найдено!`);
        }
        
        // ШАГ 7: СОХРАНЕНИЕ В ИНДЕКСЫ (КРИТИЧЕСКИ ВАЖНО!)
        if (sortedCities.length > 0) {
            // СОХРАНЯЕМ ПОД РАЗНЫМИ КЛЮЧАМИ, ЧТОБЫ ГАРАНТИРОВАТЬ НАХОЖДЕНИЕ
            
            // 1. Основной ключ (нормализованная страна)
            const mainKey = `cities:${normalizedCountry}`;
            indexesDB.put(mainKey, sortedCities);
            console.log(`💾 Сохранено под ключом: ${mainKey}`);
            
            // 2. Ключ без флага
            const countryNoFlag = normalizedCountry.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
            if (countryNoFlag && countryNoFlag !== normalizedCountry) {
                indexesDB.put(`cities:${countryNoFlag}`, sortedCities);
                console.log(`💾 Сохранено под ключом: cities:${countryNoFlag}`);
            }
            
            // 3. Оригинальный запрос (как пришел)
            if (country !== normalizedCountry) {
                indexesDB.put(`cities:${country}`, sortedCities);
                console.log(`💾 Сохранено под ключом: cities:${country}`);
            }
            
            // 4. Специальные ключи для Украины и России
            if (normalizedCountry.includes('Украин') || searchPatterns.includes('Украин')) {
                indexesDB.put('cities:Украина', sortedCities);
                indexesDB.put('cities:Ukraine', sortedCities);
                indexesDB.put('cities:UA', sortedCities);
                console.log(`💾 Сохранено дополнительные ключи для Украины`);
            }
            
            if (normalizedCountry.includes('Росс') || searchPatterns.includes('Росс')) {
                indexesDB.put('cities:Россия', sortedCities);
                indexesDB.put('cities:Russia', sortedCities);
                indexesDB.put('cities:RU', sortedCities);
                console.log(`💾 Сохранено дополнительные ключи для России`);
            }
            
            // 5. Также сохраняем ограниченную версию для демо (первые 50 городов)
            const demoCities = sortedCities.slice(0, Math.min(50, sortedCities.length));
            indexesDB.put(`demo:cities:${normalizedCountry}`, demoCities);
            console.log(`💾 Сохранено ${demoCities.length} городов для демо-режима`);
        }
        
        return sortedCities;
        
    } catch (error) {
        console.error(`❌ [EXTRACT ERROR] Ошибка извлечения городов для "${country}":`, error);
        return [];
    }
},




  // 10. КЭШ ФИЛЬТРОВ В LMDB
  cacheGlobalFilter(filterKey, profiles, isDemo = false) {
    try {
      lmdbMemoryUsage.writes++;
      
      const cacheKey = isDemo ? `demo:filter:${filterKey}` : `filter:${filterKey}`;
      
      // Сохраняем в LMDB с TTL
      const ttl = Date.now() + (SCALING_CONFIG.CACHE.FILTERS_TTL * 1000);
      filtersCacheDB.put(cacheKey, {
        profiles: profiles,
        expires: ttl
      });
      
      console.log(`💾 [LMDB FILTER CACHE] Сохранен фильтр: ${cacheKey}, профилей: ${profiles.length}`);
      return true;
    } catch (error) {
      console.error(`❌ [LMDB FILTER CACHE] Ошибка:`, error);
      return false;
    }
  },

  getGlobalFilter(filterKey, isDemo = false) {
    try {
      lmdbMemoryUsage.reads++;
      
      const cacheKey = isDemo ? `demo:filter:${filterKey}` : `filter:${filterKey}`;
      const cached = filtersCacheDB.get(cacheKey);
      
      if (!cached) {
        lmdbMemoryUsage.cacheMisses++;
        return null;
      }
      
      // Проверяем TTL
      if (cached.expires && cached.expires < Date.now()) {
        filtersCacheDB.remove(cacheKey);
        lmdbMemoryUsage.cacheMisses++;
        return null;
      }
      
      lmdbMemoryUsage.cacheHits++;
      return cached.profiles || [];
    } catch (error) {
      console.error(`❌ [LMDB GET FILTER] Ошибка:`, error);
      lmdbMemoryUsage.cacheMisses++;
      return null;
    }
  },

  // 11. ПОЛУЧЕНИЕ ПРОФИЛЕЙ ПО ИНДЕКСУ (ОПТИМИЗИРОВАННОЕ)
  getProfilesByIndex(indexKey, isDemo = false) {
    try {
      lmdbMemoryUsage.reads++;
      
      let indexes;
      if (isDemo) {
        if (indexKey.startsWith('country_city:')) {
          const countryCityIndex = indexesDB.get('demo:index:country_city') || {};
          const key = indexKey.replace('country_city:', '');
          indexes = countryCityIndex[key] || [];
        } else if (indexKey.startsWith('country:')) {
          const countryIndex = indexesDB.get('demo:index:country') || {};
          const key = indexKey.replace('country:', '');
          indexes = countryIndex[key] || [];
        } else if (indexKey.startsWith('city:')) {
          const cityIndex = indexesDB.get('demo:index:city') || {};
          const key = indexKey.replace('city:', '');
          indexes = cityIndex[key] || [];
        }
      } else {
        indexes = indexesDB.get(indexKey) || [];
      }
      
      if (!indexes || indexes.length === 0) {
        return [];
      }
      
      // Получаем профили по ID
      const profiles = [];
      const db = isDemo ? demoDB : profilesDB;
      
      for (const profileId of indexes) {
        const profile = db.get(profileId);
        if (profile) {
          profiles.push(profile);
        }
      }
      
      return profiles;
    } catch (error) {
      console.error(`❌ [LMDB GET BY INDEX] Ошибка:`, error);
      return [];
    }
  },

  // 12. НОРМАЛИЗАЦИЯ ГОРОДОВ И СТРАН (остаются без изменений)
  normalizeCityName(cityName) {
    if (!cityName || typeof cityName !== "string") return cityName;

    const trimmedCity = cityName.trim();
    if (trimmedCity.length === 0) return cityName;

    // ТОЛЬКО УБИРАЕМ КАВЫЧКИ, НО НЕ ВСЕ СИМВОЛЫ!
    const cleanCity = trimmedCity
      .replace(/^["'«»]+/, "") // удаляем в начале
      .replace(/["'«»]+$/, "") // удаляем в конце
      .trim();

    return cleanCity;
  },

  normalizeCountryName(countryName) {
    if (!countryName || typeof countryName !== "string") return countryName;

    const trimmedCountry = countryName.trim();
    if (trimmedCountry.length === 0) return countryName;

    const lowerCountry = trimmedCountry.toLowerCase();

    if (countryNormalizationMap[lowerCountry]) {
      return countryNormalizationMap[lowerCountry];
    }

    for (const [key, value] of Object.entries(countryNormalizationMap)) {
      if (lowerCountry.includes(key) || key.includes(lowerCountry)) {
        return value;
      }
    }

    return trimmedCountry.charAt(0).toUpperCase() + trimmedCountry.slice(1);
  },

  // 13. СТАТИСТИКА LMDB
getLMDBStats() {
    try {
        // 🔥 ИСПРАВЛЕНИЕ: getKeys() возвращает итератор, преобразуем в массив
        const profilesCount = Array.from(profilesDB.getKeys()).length;
        const demoProfilesCount = Array.from(demoDB.getKeys()).length;
        const filtersCount = Array.from(filtersCacheDB.getKeys()).length;
        
        return {
            profilesCount: profilesCount,
            demoProfilesCount: demoProfilesCount,
            filtersCount: filtersCount,
            memoryUsage: lmdbMemoryUsage,
            lmdbDir: LMDB_DIR,
            totalReads: lmdbMemoryUsage.reads,
            totalWrites: lmdbMemoryUsage.writes,
            cacheHitRate: lmdbMemoryUsage.reads > 0 
                ? (lmdbMemoryUsage.cacheHits / lmdbMemoryUsage.reads * 100).toFixed(2) + '%'
                : '0%'
        };
    } catch (error) {
        console.error(`❌ [LMDB STATS ERROR]:`, error);
        return {
            profilesCount: 0,
            demoProfilesCount: 0,
            filtersCount: 0,
            error: error.message
        };
    }
},

  // 14. ОЧИСТКА ПРОСРОЧЕННЫХ ФИЛЬТРОВ
  cleanupExpiredFilters() {
    try {
      const now = Date.now();
      let cleanedCount = 0;
      const filterKeys = filtersCacheDB.getKeys();
      
      for (const key of filterKeys) {
        const cached = filtersCacheDB.get(key);
        if (cached && cached.expires && cached.expires < now) {
          filtersCacheDB.remove(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 [LMDB CLEANUP] Очищено ${cleanedCount} просроченных фильтров`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error(`❌ [LMDB CLEANUP] Ошибка:`, error);
      return 0;
    }
  },

  // 15. ИНИЦИАЛИЗАЦИЯ LMDB ПРИ СТАРТЕ
  async initializeLMDB(db) {
    console.log("🚀 [LMDB INIT] Инициализация LMDB...");

    try {
      // Проверяем, есть ли уже данные в LMDB
      const hasDemoData = demoDB.getKeys().length > 0;
      const hasFullData = profilesDB.getKeys().length > 0;

      if (!hasDemoData) {
        console.log("🔄 [LMDB INIT] Загружаем демо-кэш...");
        await this.loadGlobalDemoCache(db);
      } else {
        console.log(`✅ [LMDB INIT] Демо-кэш уже загружен: ${demoDB.getKeys().length} профилей`);
      }

      // Периодическая очистка фильтров
      setInterval(() => {
        this.cleanupExpiredFilters();
      }, 3600000); // Каждый час

      // Мониторинг памяти
      setInterval(() => {
        const stats = this.getLMDBStats();
        console.log(`📊 [LMDB STATS] Профили: ${stats.profilesCount}/Демо: ${stats.demoProfilesCount}, Чтения: ${stats.totalReads}, Попадания: ${stats.cacheHitRate}`);
      }, 300000); // Каждые 5 минут

      globalCacheInitialized = true;
      console.log("✅ [LMDB INIT] Инициализация завершена");

      return true;
    } catch (error) {
      console.error("❌ [LMDB INIT] Ошибка инициализации:", error);
      return false;
    }
  }
};
module.exports = cacheManager;