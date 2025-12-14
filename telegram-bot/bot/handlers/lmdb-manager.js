const lmdb = require('lmdb');
const fs = require('fs');
const path = require('path');

// Папка для LMDB
const LMDB_DIR = fs.existsSync('/tmp') 
  ? path.join('/tmp', 'magicbot_lmdb') 
  : path.join(__dirname, 'lmdb_storage');

// Убедимся что папка существует
if (!fs.existsSync(LMDB_DIR)) {
  fs.mkdirSync(LMDB_DIR, { recursive: true });
}

// ===== LMDB ДЛЯ ПОЛНЫХ ПРОФИЛЕЙ =====
const profilesDB = lmdb.open({
  path: path.join(LMDB_DIR, 'profiles'),
  compression: true,
  maxReaders: 500,
  maxDbs: 10,
  noMemInit: true,
  mapSize: 1024 * 1024 * 500,
  noSync: true,
});

// ===== LMDB ДЛЯ ДЕМО-ПРОФИЛЕЙ =====
const demoDB = lmdb.open({
  path: path.join(LMDB_DIR, 'demo_profiles'),
  compression: true,
  maxReaders: 500,
  noMemInit: true,
  mapSize: 1024 * 1024 * 200,
  noSync: true,
});

// ===== LMDB ДЛЯ ИНДЕКСОВ =====
const indexesDB = lmdb.open({
  path: path.join(LMDB_DIR, 'indexes'),
  compression: false,
  maxReaders: 1000,
  noMemInit: true,
  mapSize: 1024 * 1024 * 100,
  noSync: true,
});

// ===== LMDB ДЛЯ КЭША ФИЛЬТРОВ =====
const filtersCacheDB = lmdb.open({
  path: path.join(LMDB_DIR, 'filters_cache'),
  compression: true,
  maxReaders: 1000,
  noMemInit: true,
  mapSize: 1024 * 1024 * 300,
  noSync: true,
});

console.log(`✅ LMDB базы инициализированы в ${LMDB_DIR}`);

module.exports = {
  profilesDB,
  demoDB,
  indexesDB,
  filtersCacheDB,
  LMDB_DIR
}