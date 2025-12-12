// diskCache.js - Модуль для сохранения и загрузки кэша с диска
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class DiskCache {
    constructor() {
        // Папка для кэша будет в корне проекта
        this.CACHE_DIR = path.join(__dirname, '.render_cache');
        this.CACHE_FILE = path.join(this.CACHE_DIR, 'cache_backup.bin');
        
        // Создаем папку, если её нет
        if (!fs.existsSync(this.CACHE_DIR)) {
            fs.mkdirSync(this.CACHE_DIR, { recursive: true });
        }
        
        console.log(`💾 Дисковый кэш: ${this.CACHE_DIR}`);
    }
    
    // 🔧 СОХРАНИТЬ ВСЕ КЭШИ НА ДИСК
    async saveAllCaches(globalProfilesCache, globalDemoCache, globalFilterCache) {
        try {
            console.log('💾 Начинаем сохранение кэша на диск...');
            const startTime = Date.now();
            
            // 1. Собираем ВСЕ данные из всех кэшей
            const allCacheData = {
                timestamp: Date.now(),
                version: '1.0',
                data: {
                    // ВАЖНО: Сохраняем ВСЕ ключи, которые есть в кэше
                    globalProfilesCache: this.extractAllCacheKeys(globalProfilesCache),
                    globalDemoCache: this.extractAllCacheKeys(globalDemoCache),
                    globalFilterCache: this.extractAllCacheKeys(globalFilterCache),
                    
                    // Сохраняем также индексы из демо-кэша
                    demoIndexes: {
                        countryCity: this.mapToArray(globalDemoCache.get('demo:index:country_city')),
                        country: this.mapToArray(globalDemoCache.get('demo:index:country')),
                        city: this.mapToArray(globalDemoCache.get('demo:index:city'))
                    }
                }
            };
            
            // 2. Сжимаем данные (экономия до 80% места)
            const jsonData = JSON.stringify(allCacheData);
            const compressed = zlib.gzipSync(jsonData);
            
            // 3. Сохраняем во временный файл, затем атомарно переименовываем
            const tempFile = this.CACHE_FILE + '.tmp';
            fs.writeFileSync(tempFile, compressed);
            fs.renameSync(tempFile, this.CACHE_FILE);
            
            const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
            const timeMs = Date.now() - startTime;
            
            console.log(`✅ Кэш сохранен: ${sizeMB} MB за ${timeMs}ms`);
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка сохранения кэша:', error.message);
            return false;
        }
    }
    
    // 🔧 ЗАГРУЗИТЬ КЭШ С ДИСКА
    async loadFromDisk(globalProfilesCache, globalDemoCache, globalFilterCache) {
        try {
            if (!fs.existsSync(this.CACHE_FILE)) {
                console.log('📭 Файл кэша не найден, начинаем с чистого листа');
                return false;
            }
            
            console.log('🔄 Загружаем кэш с диска...');
            const startTime = Date.now();
            
            // 1. Читаем и распаковываем данные
            const compressed = fs.readFileSync(this.CACHE_FILE);
            const decompressed = zlib.gunzipSync(compressed);
            const cacheData = JSON.parse(decompressed.toString());
            
            // 2. Проверяем версию и свежесть (не старше 3 дней)
            const cacheAge = Date.now() - cacheData.timestamp;
            const MAX_CACHE_AGE = 3 * 24 * 60 * 60 * 1000; // 3 дня
            
            if (cacheAge > MAX_CACHE_AGE) {
                console.log(`⚠️ Кэш устарел (${Math.round(cacheAge/(24*60*60*1000))} дней), игнорируем`);
                return false;
            }
            
            // 3. Восстанавливаем ВСЕ кэши
            this.restoreCache(globalProfilesCache, cacheData.data.globalProfilesCache);
            this.restoreCache(globalDemoCache, cacheData.data.globalDemoCache);
            this.restoreCache(globalFilterCache, cacheData.data.globalFilterCache);
            
            // 4. Восстанавливаем индексы демо-кэша
            if (cacheData.data.demoIndexes) {
                globalDemoCache.set('demo:index:country_city', 
                    this.arrayToMap(cacheData.data.demoIndexes.countryCity));
                globalDemoCache.set('demo:index:country', 
                    this.arrayToMap(cacheData.data.demoIndexes.country));
                globalDemoCache.set('demo:index:city', 
                    this.arrayToMap(cacheData.data.demoIndexes.city));
            }
            
            const timeMs = Date.now() - startTime;
            console.log(`✅ Кэш восстановлен за ${timeMs}ms (возраст: ${Math.round(cacheAge/(60*60*1000))}ч)`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки кэша:', error.message);
            return false;
        }
    }
    
    // 🔧 ИЗВЛЕЧЬ ВСЕ КЛЮЧИ ИЗ КЭША
    extractAllCacheKeys(cacheInstance) {
        const result = {};
        const keys = cacheInstance.keys();
        
        for (const key of keys) {
            try {
                const value = cacheInstance.get(key);
                // Сохраняем только если значение существует
                if (value !== undefined) {
                    result[key] = value;
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось извлечь ключ ${key}:`, error.message);
            }
        }
        
        return result;
    }
    
    // 🔧 ВОССТАНОВИТЬ КЭШ ИЗ ДАННЫХ
    restoreCache(cacheInstance, cacheData) {
        if (!cacheData) return;
        
        Object.entries(cacheData).forEach(([key, value]) => {
            try {
                cacheInstance.set(key, value);
            } catch (error) {
                console.warn(`⚠️ Не удалось восстановить ключ ${key}:`, error.message);
            }
        });
    }
    
    // 🔧 КОНВЕРТИРОВАТЬ Map В МАССИВ для сериализации
    mapToArray(mapInstance) {
        if (!mapInstance || !(mapInstance instanceof Map)) return [];
        return Array.from(mapInstance.entries());
    }
    
    // 🔧 КОНВЕРТИРОВАТЬ МАССИВ В Map
    arrayToMap(arrayData) {
        if (!Array.isArray(arrayData)) return new Map();
        return new Map(arrayData);
    }
    
    // 🔧 ПОЛУЧИТЬ ИНФОРМАЦИЮ О КЭШЕ
    getCacheInfo() {
        try {
            if (!fs.existsSync(this.CACHE_FILE)) {
                return { exists: false, size: '0 MB', age: 'неизвестно' };
            }
            
            const stats = fs.statSync(this.CACHE_FILE);
            const cacheData = JSON.parse(zlib.gunzipSync(fs.readFileSync(this.CACHE_FILE)).toString());
            
            const ageMs = Date.now() - cacheData.timestamp;
            const ageHours = Math.round(ageMs / (60 * 60 * 1000));
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            
            return {
                exists: true,
                size: `${sizeMB} MB`,
                age: `${ageHours} часов`,
                timestamp: cacheData.timestamp,
                date: new Date(cacheData.timestamp).toLocaleString(),
                keys: {
                    profiles: Object.keys(cacheData.data?.globalProfilesCache || {}).length,
                    demo: Object.keys(cacheData.data?.globalDemoCache || {}).length,
                    filters: Object.keys(cacheData.data?.globalFilterCache || {}).length
                }
            };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }
}

module.exports = DiskCache;