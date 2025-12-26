// db/lmdb.js
const lmdb = require("lmdb");
const fs = require("fs");
const path = require("path");

class LMDBManager {
  constructor() {
    this.LMDB_DIR = this.getLmdbDir();
    this.initDirectory();
    
    this.databases = {
      profiles: null,
      demo: null,
      indexes: null,
      filters: null
    };
    
    this.stats = {
      opened: Date.now(),
      reads: 0,
      writes: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.initDatabases();
  }
  
  getLmdbDir() {
    return fs.existsSync('/tmp') 
      ? path.join('/tmp', 'magicbot_lmdb') 
      : path.join(__dirname, '..', 'lmdb_storage');
  }
  
  initDirectory() {
    if (!fs.existsSync(this.LMDB_DIR)) {
      fs.mkdirSync(this.LMDB_DIR, { recursive: true });
      console.log(`📁 Создана папка LMDB: ${this.LMDB_DIR}`);
    }
  }
  
  initDatabases() {
    this.databases.profiles = lmdb.open({
      path: path.join(this.LMDB_DIR, 'profiles'),
      compression: true,
      maxReaders: 500,
      maxDbs: 10,
      noMemInit: true,
      mapSize: 1024 * 1024 * 500,
      noSync: true,
    });

    this.databases.demo = lmdb.open({
      path: path.join(this.LMDB_DIR, 'demo_profiles'),
      compression: true,
      maxReaders: 500,
      noMemInit: true,
      mapSize: 1024 * 1024 * 200,
      noSync: true,
    });

    this.databases.indexes = lmdb.open({
      path: path.join(this.LMDB_DIR, 'indexes'),
      compression: false,
      maxReaders: 1000,
      noMemInit: true,
      mapSize: 1024 * 1024 * 100,
      noSync: true,
    });

    this.databases.filters = lmdb.open({
      path: path.join(this.LMDB_DIR, 'filters_cache'),
      compression: true,
      maxReaders: 1000,
      noMemInit: true,
      mapSize: 1024 * 1024 * 300,
      noSync: true,
    });
    
    console.log(`✅ LMDB базы инициализированы в ${this.LMDB_DIR}`);
  }
  
  getProfilesDB() {
    return this.databases.profiles;
  }
  
  getDemoDB() {
    return this.databases.demo;
  }
  
  getIndexesDB() {
    return this.databases.indexes;
  }
  
  getFiltersDB() {
    return this.databases.filters;
  }
  
  incrementReads() {
    this.stats.reads++;
  }
  
  incrementWrites() {
    this.stats.writes++;
  }
  
  incrementCacheHits() {
    this.stats.cacheHits++;
  }
  
  incrementCacheMisses() {
    this.stats.cacheMisses++;
  }
  
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.opened,
      cacheHitRate: this.stats.reads > 0 
        ? (this.stats.cacheHits / this.stats.reads * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  clearAll() {
    Object.values(this.databases).forEach(db => {
      if (db) db.clearSync();
    });
    console.log("🧹 Все LMDB базы очищены");
  }
}

module.exports = new LMDBManager();