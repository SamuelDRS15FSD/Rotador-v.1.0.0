/**
 * db.js - Capa de persistencia nativa IndexedDB para Rotador PWA
 * Garantiza funcionamiento 100% offline y almacenamiento interno robusto en el móvil.
 */

const DB_NAME = 'RotadorDB';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Inicializa y abre la base de datos IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB no está disponible en este navegador. Se usará LocalStorage como fallback.');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Almacén de productos
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('section', 'section', { unique: false });
        productStore.createIndex('expiryDate', 'expiryDate', { unique: false });
        productStore.createIndex('plu', 'plu', { unique: false });
      }

      // Almacén de solicitudes de precios
      if (!db.objectStoreNames.contains('priceRequests')) {
        const prStore = db.createObjectStore('priceRequests', { keyPath: 'id' });
        prStore.createIndex('date', 'date', { unique: false });
        prStore.createIndex('productId', 'productId', { unique: false });
      }

      // Almacén de catálogo maestro
      if (!db.objectStoreNames.contains('masterCatalog')) {
        const catStore = db.createObjectStore('masterCatalog', { keyPath: 'id', autoIncrement: true });
        catStore.createIndex('name', 'name', { unique: false });
        catStore.createIndex('code', 'code', { unique: false });
      }

      // Almacén de configuración
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('✓ IndexedDB inicializada correctamente (RotadorDB)');
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error abriendo IndexedDB:', event.target.error);
      resolve(null); // Fallback a LocalStorage
    };
  });
}

/**
 * Guarda todos los productos en IndexedDB
 * @param {Array} products
 * @returns {Promise<void>}
 */
export async function dbSaveProducts(products) {
  try {
    const db = await initDB();
    if (!db) return;

    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    await store.clear();

    for (const p of products) {
      store.put(p);
    }
  } catch (err) {
    console.warn('Error sincronizando productos con IndexedDB:', err);
  }
}

/**
 * Carga todos los productos desde IndexedDB
 * @returns {Promise<Array>}
 */
export async function dbLoadProducts() {
  try {
    const db = await initDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Error leyendo productos desde IndexedDB:', err);
    return [];
  }
}

/**
 * Guarda las solicitudes de precios en IndexedDB
 * @param {Array} requests
 * @returns {Promise<void>}
 */
export async function dbSavePriceRequests(requests) {
  try {
    const db = await initDB();
    if (!db) return;

    const tx = db.transaction('priceRequests', 'readwrite');
    const store = tx.objectStore('priceRequests');
    await store.clear();

    for (const r of requests) {
      store.put(r);
    }
  } catch (err) {
    console.warn('Error sincronizando solicitudes con IndexedDB:', err);
  }
}

/**
 * Carga las solicitudes de precios desde IndexedDB
 * @returns {Promise<Array>}
 */
export async function dbLoadPriceRequests() {
  try {
    const db = await initDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('priceRequests', 'readonly');
      const store = tx.objectStore('priceRequests');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Error leyendo solicitudes desde IndexedDB:', err);
    return [];
  }
}

/**
 * Guarda el catálogo maestro en IndexedDB
 * @param {Array} catalog
 * @returns {Promise<void>}
 */
export async function dbSaveMasterCatalog(catalog) {
  try {
    const db = await initDB();
    if (!db) return;

    const tx = db.transaction('masterCatalog', 'readwrite');
    const store = tx.objectStore('masterCatalog');
    await store.clear();

    for (const item of catalog) {
      store.put(item);
    }
  } catch (err) {
    console.warn('Error sincronizando catálogo con IndexedDB:', err);
  }
}

/**
 * Carga el catálogo maestro desde IndexedDB
 * @returns {Promise<Array>}
 */
export async function dbLoadMasterCatalog() {
  try {
    const db = await initDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('masterCatalog', 'readonly');
      const store = tx.objectStore('masterCatalog');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Error leyendo catálogo desde IndexedDB:', err);
    return [];
  }
}



// ============================================================
// Almacén clave-valor genérico (usa el almacén 'settings')
// Sirve para datos extra como el registro de retiros (merma).
// ============================================================

/**
 * Guarda un valor arbitrario bajo una clave
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function dbSaveKV(key, value) {
  try {
    const db = await initDB();
    if (!db) return;
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
  } catch (err) {
    console.warn('Error guardando dato en IndexedDB:', err);
  }
}

/**
 * Lee un valor guardado con dbSaveKV
 * @param {string} key
 * @returns {Promise<*>} Valor o null
 */
export async function dbLoadKV(key) {
  try {
    const db = await initDB();
    if (!db) return null;
    return await new Promise((resolve) => {
      const req = db.transaction('settings', 'readonly').objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}
