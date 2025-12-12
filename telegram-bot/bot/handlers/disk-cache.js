const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// Конфигурация дискового кэша
const CACHE_CONFIG = {
    BASE_DIR: path.join(__dirname, 'cache'),
    COMPRESSION: true,
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB максимум на файл
    CLEANUP_INTERVAL: 3600000, // Очистка каждые 1 час
    BACKUP_DIR: path.join(__dirname, 'cache_backup'),
    USE_MEMORY_CACHE: true, // Используем двухуровневый кэш
    MEMORY_LIMIT: 500 // Лимит ключей в памяти
};

// Создаем директории кэша
const createCacheDirectories = () => {
    const dirs = [
        CACHE_CONFIG.BASE_DIR,
        path.join(CACHE_CONFIG.BASE_DIR, 'full'),
        path.join(CACHE_CONFIG.BASE_DIR, 'demo'), 
        path.join(CACHE_CONFIG.BASE_DIR, 'filter'),
        path.join(CACHE_CONFIG.BASE_DIR, 'user'),
        path.join(CACHE_CONFIG.BASE_DIR, 'meta'),
        path.join(CACHE_CONFIG.BASE_DIR, 'temp'),
        CACHE_CONFIG.BACKUP_DIR
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Создана директория: ${dir}`);
        }
    });
    
    console.log('✅ Структура дискового кэша создана');
};

// Создаем директории сразу
createCacheDirectories();

class DiskCacheManager {
    constructor() {
        console.log('💾 Инициализация дискового кэша (без зависимостей)');
        
        // Двухуровневый кэш: память + диск
        this.memoryCache = new Map();
        this.stats = {
            disk: { reads: 0, writes: 0, hits: 0, misses: 0 },
            memory: { hits: 0, misses: 0 },
            compression: { savedBytes: 0, ratio: 0 }
        };
        
        this.fileLocks = new Map();
        this.cleanupInterval = null;
        
        // Запускаем периодическую очистку
        this.startCleanupInterval();
    }
    
    // ===================== ОСНОВНЫЕ МЕТОДЫ =====================
    
    /**
     * Генерация имени файла из ключа
     */
    getFilePath(category, key) {
        // Создаем безопасное имя файла из ключа
        const hash = crypto.createHash('md5').update(key).digest('hex');
        const safeKey = key.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const filename = `${safeKey}_${hash}.cache`;
        
        return path.join(CACHE_CONFIG.BASE_DIR, category, filename);
    }
    
    /**
     * Получить метаданные файла
     */
    getMetaFilePath(category, key) {
        const filePath = this.getFilePath(category, key);
        return `${filePath}.meta`;
    }
    
    /**
     * Проверить, не устарели ли данные (TTL)
     */
    isExpired(metaData) {
        if (!metaData || !metaData.expires) return true;
        return Date.now() > metaData.expires;
    }
    
    /**
     * Сохранить данные на диск
     */
    async set(category, key, data, ttlSeconds = 86400) {
        const startTime = Date.now();
        const filePath = this.getFilePath(category, key);
        const metaPath = this.getMetaFilePath(category, key);
        
        // Создаем блокировку для этого файла
        const lockKey = `${category}:${key}`;
        if (this.fileLocks.has(lockKey)) {
            console.log(`⏳ Файл ${lockKey} уже обрабатывается`);
            return false;
        }
        
        this.fileLocks.set(lockKey, true);
        
        try {
            // Подготовка метаданных
            const metaData = {
                key: key,
                category: category,
                created: Date.now(),
                expires: Date.now() + (ttlSeconds * 1000),
                size: 0,
                compressed: CACHE_CONFIG.COMPRESSION
            };
            
            let dataToWrite;
            let originalSize;
            
            // Подготовка данных
            if (CACHE_CONFIG.COMPRESSION && data !== null && data !== undefined) {
                const jsonString = JSON.stringify(data);
                originalSize = Buffer.byteLength(jsonString, 'utf8');
                
                // Сжимаем только если данные достаточно большие
                if (originalSize > 1024) {
                    dataToWrite = await this.compressData(jsonString);
                    this.stats.compression.savedBytes += (originalSize - dataToWrite.length);
                    metaData.compressed = true;
                    metaData.originalSize = originalSize;
                    metaData.compressedSize = dataToWrite.length;
                } else {
                    dataToWrite = Buffer.from(jsonString, 'utf8');
                    metaData.compressed = false;
                }
            } else {
                const jsonString = JSON.stringify(data);
                dataToWrite = Buffer.from(jsonString, 'utf8');
                metaData.compressed = false;
            }
            
            metaData.size = dataToWrite.length;
            
            // Записываем данные в файл
            await fsPromises.writeFile(filePath, dataToWrite);
            
            // Записываем метаданные
            await fsPromises.writeFile(metaPath, JSON.stringify(metaData, null, 2));
            
            // Сохраняем в память (если включено)
            if (CACHE_CONFIG.USE_MEMORY_CACHE) {
                this.setToMemory(category, key, {
                    data: data,
                    meta: metaData,
                    timestamp: Date.now()
                });
            }
            
            this.stats.disk.writes++;
            const writeTime = Date.now() - startTime;
            
            console.log(`💾 [DISK WRITE] ${category}/${key}: ${metaData.size} bytes, ${writeTime}ms`);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Ошибка записи на диск ${category}/${key}:`, error.message);
            return false;
        } finally {
            this.fileLocks.delete(lockKey);
        }
    }
    
    /**
     * Получить данные с диска
     */
    async get(category, key) {
        const startTime = Date.now();
        
        // Сначала проверяем память
        if (CACHE_CONFIG.USE_MEMORY_CACHE) {
            const memoryData = this.getFromMemory(category, key);
            if (memoryData) {
                this.stats.memory.hits++;
                
                // Проверяем TTL в памяти
                if (!this.isExpired(memoryData.meta)) {
                    const memoryTime = Date.now() - startTime;
                    console.log(`⚡ [MEMORY HIT] ${category}/${key}: ${memoryTime}ms`);
                    return memoryData.data;
                } else {
                    // Удаляем устаревшие данные из памяти
                    this.deleteFromMemory(category, key);
                }
            } else {
                this.stats.memory.misses++;
            }
        }
        
        const filePath = this.getFilePath(category, key);
        const metaPath = this.getMetaFilePath(category, key);
        
        try {
            // Проверяем существование файлов
            if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
                this.stats.disk.misses++;
                return null;
            }
            
            // Читаем метаданные
            const metaContent = await fsPromises.readFile(metaPath, 'utf8');
            const metaData = JSON.parse(metaContent);
            
            // Проверяем TTL
            if (this.isExpired(metaData)) {
                console.log(`🗑️ [EXPIRED] ${category}/${key}: TTL истек`);
                await this.delete(category, key);
                this.stats.disk.misses++;
                return null;
            }
            
            // Читаем данные
            const fileData = await fsPromises.readFile(filePath);
            let result;
            
            if (metaData.compressed) {
                result = await this.decompressData(fileData);
                result = JSON.parse(result);
            } else {
                result = JSON.parse(fileData.toString('utf8'));
            }
            
            // Сохраняем в память для будущих запросов
            if (CACHE_CONFIG.USE_MEMORY_CACHE) {
                this.setToMemory(category, key, {
                    data: result,
                    meta: metaData,
                    timestamp: Date.now()
                });
            }
            
            this.stats.disk.hits++;
            this.stats.disk.reads++;
            
            const readTime = Date.now() - startTime;
            console.log(`📖 [DISK READ] ${category}/${key}: ${metaData.size} bytes, ${readTime}ms`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Ошибка чтения с диска ${category}/${key}:`, error.message);
            this.stats.disk.misses++;
            return null;
        }
    }
    
    /**
     * Удалить данные с диска
     */
    async delete(category, key) {
        try {
            const filePath = this.getFilePath(category, key);
            const metaPath = this.getMetaFilePath(category, key);
            
            // Удаляем из памяти
            this.deleteFromMemory(category, key);
            
            // Удаляем файлы с диска
            const promises = [];
            if (fs.existsSync(filePath)) {
                promises.push(fsPromises.unlink(filePath));
            }
            if (fs.existsSync(metaPath)) {
                promises.push(fsPromises.unlink(metaPath));
            }
            
            await Promise.all(promises);
            console.log(`🗑️ [DELETE] ${category}/${key}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Ошибка удаления ${category}/${key}:`, error.message);
            return false;
        }
    }
    
    /**
     * Проверить наличие ключа
     */
    async has(category, key) {
        const filePath = this.getFilePath(category, key);
        const metaPath = this.getMetaFilePath(category, key);
        
        if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
            return false;
        }
        
        try {
            const metaContent = await fsPromises.readFile(metaPath, 'utf8');
            const metaData = JSON.parse(metaContent);
            
            return !this.isExpired(metaData);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Получить все ключи в категории
     */
    async keys(category) {
        const dirPath = path.join(CACHE_CONFIG.BASE_DIR, category);
        
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        
        try {
            const files = await fsPromises.readdir(dirPath);
            // Фильтруем только файлы .meta для получения ключей
            const metaFiles = files.filter(f => f.endsWith('.meta'));
            
            const keys = [];
            for (const metaFile of metaFiles) {
                const metaPath = path.join(dirPath, metaFile);
                try {
                    const metaContent = await fsPromises.readFile(metaPath, 'utf8');
                    const metaData = JSON.parse(metaContent);
                    
                    if (!this.isExpired(metaData)) {
                        keys.push(metaData.key);
                    }
                } catch (error) {
                    continue;
                }
            }
            
            return keys;
        } catch (error) {
            console.error(`❌ Ошибка получения ключей ${category}:`, error.message);
            return [];
        }
    }
    
    /**
     * Очистить всю категорию
     */
    async clearCategory(category) {
        const dirPath = path.join(CACHE_CONFIG.BASE_DIR, category);
        
        if (!fs.existsSync(dirPath)) {
            return true;
        }
        
        try {
            const files = await fsPromises.readdir(dirPath);
            const deletePromises = files.map(file => 
                fsPromises.unlink(path.join(dirPath, file))
            );
            
            await Promise.all(deletePromises);
            
            // Очищаем память
            if (CACHE_CONFIG.USE_MEMORY_CACHE) {
                this.clearMemoryByCategory(category);
            }
            
            console.log(`🧹 [CLEAR CATEGORY] ${category}: удалено ${files.length} файлов`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка очистки категории ${category}:`, error.message);
            return false;
        }
    }
    
    /**
     * Получить статистику кэша
     */
    getStats() {
        const totalMemoryKeys = this.memoryCache.size;
        
        return {
            disk: this.stats.disk,
            memory: {
                ...this.stats.memory,
                totalKeys: totalMemoryKeys,
                hitRate: this.stats.memory.hits + this.stats.memory.misses > 0 
                    ? (this.stats.memory.hits / (this.stats.memory.hits + this.stats.memory.misses) * 100).toFixed(2) + '%'
                    : '0%'
            },
            compression: {
                savedMB: (this.stats.compression.savedBytes / 1024 / 1024).toFixed(2),
                files: Object.keys(this.stats.compression).length
            },
            fileLocks: this.fileLocks.size
        };
    }
    
    /**
     * Сделать backup кэша
     */
    async backup() {
        const backupDir = path.join(CACHE_CONFIG.BACKUP_DIR, `backup_${Date.now()}`);
        await fsPromises.mkdir(backupDir, { recursive: true });
        
        try {
            await fsPromises.cp(CACHE_CONFIG.BASE_DIR, backupDir, { recursive: true });
            console.log(`💾 [BACKUP] Создан бэкап в ${backupDir}`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка создания бэкапа:', error.message);
            return false;
        }
    }
    
    // ===================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====================
    
    /**
     * Сжатие данных
     */
    async compressData(data) {
        return new Promise((resolve, reject) => {
            zlib.gzip(data, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }
    
    /**
     * Распаковка данных
     */
    async decompressData(data) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(data, (error, result) => {
                if (error) reject(error);
                else resolve(result.toString('utf8'));
            });
        });
    }
    
    /**
     * Работа с двухуровневым кэшем (память)
     */
    getMemoryKey(category, key) {
        return `${category}:${key}`;
    }
    
    setToMemory(category, key, value) {
        const memoryKey = this.getMemoryKey(category, key);
        
        // Ограничиваем размер памяти
        if (this.memoryCache.size >= CACHE_CONFIG.MEMORY_LIMIT) {
            // Удаляем самые старые записи
            const oldestKey = Array.from(this.memoryCache.keys())[0];
            this.memoryCache.delete(oldestKey);
        }
        
        this.memoryCache.set(memoryKey, value);
    }
    
    getFromMemory(category, key) {
        const memoryKey = this.getMemoryKey(category, key);
        return this.memoryCache.get(memoryKey);
    }
    
    deleteFromMemory(category, key) {
        const memoryKey = this.getMemoryKey(category, key);
        this.memoryCache.delete(memoryKey);
    }
    
    clearMemoryByCategory(category) {
        const prefix = `${category}:`;
        for (const key of this.memoryCache.keys()) {
            if (key.startsWith(prefix)) {
                this.memoryCache.delete(key);
            }
        }
    }
    
    /**
     * Периодическая очистка устаревших файлов
     */
    async cleanupExpired() {
        console.log('🧹 [CLEANUP] Начинаем очистку устаревшего кэша...');
        
        const categories = ['full', 'demo', 'filter', 'user', 'meta'];
        let totalDeleted = 0;
        
        for (const category of categories) {
            const dirPath = path.join(CACHE_CONFIG.BASE_DIR, category);
            
            if (!fs.existsSync(dirPath)) continue;
            
            try {
                const files = await fsPromises.readdir(dirPath);
                const metaFiles = files.filter(f => f.endsWith('.meta'));
                
                for (const metaFile of metaFiles) {
                    const metaPath = path.join(dirPath, metaFile);
                    const filePath = metaPath.replace('.meta', '');
                    
                    try {
                        const metaContent = await fsPromises.readFile(metaPath, 'utf8');
                        const metaData = JSON.parse(metaContent);
                        
                        if (this.isExpired(metaData)) {
                            // Удаляем оба файла
                            await Promise.all([
                                fsPromises.unlink(filePath).catch(() => {}),
                                fsPromises.unlink(metaPath).catch(() => {})
                            ]);
                            
                            // Удаляем из памяти
                            this.deleteFromMemory(category, metaData.key);
                            totalDeleted++;
                        }
                    } catch (error) {
                        // Если ошибка чтения метаданных, удаляем файл
                        await fsPromises.unlink(metaPath).catch(() => {});
                        await fsPromises.unlink(filePath).catch(() => {});
                        totalDeleted++;
                    }
                }
            } catch (error) {
                console.error(`❌ Ошибка очистки категории ${category}:`, error.message);
            }
        }
        
        console.log(`✅ [CLEANUP] Очистка завершена. Удалено ${totalDeleted} файлов`);
        return totalDeleted;
    }
    
    /**
     * Запустить интервал очистки
     */
    startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpired();
        }, CACHE_CONFIG.CLEANUP_INTERVAL);
        
        console.log('⏰ Интервал очистки кэша запущен');
    }
    
    /**
     * Остановить интервал очистки
     */
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    /**
     * Получить информацию о размере кэша
     */
    async getCacheSize() {
        const categories = ['full', 'demo', 'filter', 'user', 'meta'];
        let totalSize = 0;
        let fileCount = 0;
        
        for (const category of categories) {
            const dirPath = path.join(CACHE_CONFIG.BASE_DIR, category);
            
            if (!fs.existsSync(dirPath)) continue;
            
            try {
                const files = await fsPromises.readdir(dirPath);
                
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    try {
                        const stats = await fsPromises.stat(filePath);
                        totalSize += stats.size;
                        fileCount++;
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return {
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            fileCount: fileCount,
            categories: categories.length
        };
    }
}

// Создаем глобальный экземпляр
const diskCache = new DiskCacheManager();

// Экспорт
module.exports = diskCache;