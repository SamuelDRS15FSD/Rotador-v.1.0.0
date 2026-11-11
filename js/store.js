/**
 * store.js - Módulo de datos/estado para Rotador PWA
 * Gestiona IndexedDB, LocalStorage, Catálogo Maestro y lógica de negocio
 */

import * as db from './db.js';

// Clave de almacenamiento en LocalStorage (compatibilidad y fallback)
const STORAGE_KEY = 'rotadorData';
const LEGACY_STORAGE_KEY = 'elRotador';

// Catálogo Maestro inicial predeterminado con productos de carnicería / supermercado
const DEFAULT_MASTER_CATALOG = [
  { name: 'Bife de Chorizo Premium', code: '7791234567890', provider: 'Frigorífico Central', measureType: 'kilogramos', section: 'autoservicio' },
  { name: 'Pechuga de Pollo Fresca', code: '7792345678901', provider: 'Avícola San Marcos', measureType: 'kilogramos', section: 'autoservicio' },
  { name: 'Hamburguesas Caseras x4', code: '7793456789012', provider: 'Elaboración Propia', measureType: 'unidades', section: 'autoservicio' },
  { name: 'Colita de Cuadril Envasada', code: '7794567890123', provider: 'Frigorífico Pampeano', measureType: 'kilogramos', section: 'autoservicio' },
  { name: 'Milanesas de Carne Preparadas', code: '4011', provider: 'Elaboración Mostrador', measureType: 'kilogramos', section: 'atendida' },
  { name: 'Chorizo Bombón Especial', code: '4022', provider: 'Embutidos Artesanales', measureType: 'kilogramos', section: 'atendida' },
  { name: 'Matambre de Cerdo', code: '4033', provider: 'Cabaña Porcina', measureType: 'kilogramos', section: 'atendida' },
  { name: 'Asado de Tira Especial', code: '4044', provider: 'Frigorífico Central', measureType: 'kilogramos', section: 'atendida' },
  { name: 'Lomo Fino Vacuno', code: '4055', provider: 'Frigorífico Pampeano', measureType: 'kilogramos', section: 'atendida' },
  { name: 'Bondiola de Cerdo', code: '4066', provider: 'Cabaña Porcina', measureType: 'kilogramos', section: 'atendida' },
  { name: 'Pollo Entero Grado A', code: '7795678901234', provider: 'Avícola San Marcos', measureType: 'unidades', section: 'autoservicio' },
  { name: 'Piqueo Parrillero x10', code: '7796789012345', provider: 'Elaboración Propia', measureType: 'unidades', section: 'autoservicio' }
];

// Estado en memoria
let currentState = null;

// ============================================================
// Helpers internos y Persistencia Local Dual (IndexedDB + LocalStorage)
// ============================================================

/**
 * Lee el estado completo desde LocalStorage o memoria
 * @returns {{ products: Array, priceRequests: Array, masterCatalog: Array, settings: Object }}
 */
function _loadState() {
  if (currentState) return currentState;

  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    // Migración transparente si existía bajo la clave previa
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.masterCatalog || !Array.isArray(parsed.masterCatalog)) {
        parsed.masterCatalog = [];
      }
      if (!Array.isArray(parsed.removals)) parsed.removals = [];
      if (!Array.isArray(parsed.products)) parsed.products = [];
      if (!Array.isArray(parsed.priceRequests)) parsed.priceRequests = [];
      if (!parsed.settings) parsed.settings = { mondayHoliday: false };
      currentState = parsed;
      return currentState;
    }
  } catch (e) {
    console.error('Error leyendo LocalStorage:', e);
  }

  // Estado inicial por defecto: Completamente limpio (0 productos precargados)
  currentState = {
    products: [],
    priceRequests: [],
    masterCatalog: [],
    removals: [],
    settings: { mondayHoliday: false }
  };
  return currentState;
}

/**
 * Persiste el estado completo en LocalStorage e IndexedDB
 * @param {Object} state
 */
function _saveState(state) {
  currentState = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error guardando en LocalStorage:', e);
  }

  // Sincronizar de forma asíncrona con IndexedDB
  try {
    db.dbSaveProducts(state.products || []);
    db.dbSavePriceRequests(state.priceRequests || []);
    db.dbSaveMasterCatalog(state.masterCatalog || []);
    db.dbSaveKV('removals', state.removals || []);
  } catch (e) {
    console.warn('Error sincronizando con IndexedDB:', e);
  }
}

/**
 * Inicializa la persistencia IndexedDB y recupera datos almacenados
 * @returns {Promise<void>}
 */
export async function initStore() {
  try {
    await db.initDB();
    const idbProducts = await db.dbLoadProducts();
    const idbRequests = await db.dbLoadPriceRequests();
    const idbCatalog = await db.dbLoadMasterCatalog();
    const idbRemovals = await db.dbLoadKV('removals');

    const state = _loadState();

    // Si IndexedDB tiene más datos que LocalStorage, sincronizar
    if (idbProducts && idbProducts.length > state.products.length) {
      state.products = idbProducts;
    }
    if (idbRequests && idbRequests.length > state.priceRequests.length) {
      state.priceRequests = idbRequests;
    }
    if (idbCatalog && idbCatalog.length > state.masterCatalog.length) {
      state.masterCatalog = idbCatalog;
    }
    if (Array.isArray(idbRemovals) && idbRemovals.length > (state.removals || []).length) {
      state.removals = idbRemovals;
    }

    _saveState(state);
  } catch (err) {
    console.warn('Persistencia inicial usando LocalStorage:', err);
  }
}

/**
 * Genera un ID único basado en timestamp + aleatorio
 * @returns {string}
 */
function _generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ============================================================
// Secciones: Autoservicio y Atendida manejan mercancía por separado
// ============================================================

export const SECTIONS = ['autoservicio', 'atendida'];

/**
 * Normaliza el nombre de sección (cualquier valor desconocido es 'autoservicio')
 * @param {string} section
 * @returns {'autoservicio'|'atendida'}
 */
export function normalizeSection(section) {
  return section === 'atendida' ? 'atendida' : 'autoservicio';
}

/**
 * Dos registros son "el mismo producto" solo si están en la MISMA sección
 * y comparten código (PLU/EAN) o nombre. Así los lotes, el stock total y el
 * catálogo de una sección nunca se mezclan con los de la otra.
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
export function isSameProduct(a, b) {
  if (!a || !b) return false;
  if (normalizeSection(a.section) !== normalizeSection(b.section)) return false;
  const ca = (a.plu || a.code || '').trim().toLowerCase();
  const cb = (b.plu || b.code || '').trim().toLowerCase();
  if (ca && cb && ca === cb) return true;
  const na = (a.name || '').trim().toLowerCase();
  const nb = (b.name || '').trim().toLowerCase();
  return !!na && na === nb;
}

// ============================================================
// Diferenciación Inteligente de Códigos (PLU vs EAN)
// ============================================================

/**
 * Evalúa el código numérico:
 * - 1 a 6 dígitos: PLU (Product Look-Up)
 * - 7 o más dígitos: EAN (código de barras comercial)
 * @param {string|number} code - Código a evaluar
 * @returns {{ type: 'PLU'|'EAN'|null, label: string, code: string }}
 */
export function formatCodeInfo(code) {
  if (!code) return { type: null, label: 'Sin código', code: '' };
  const str = String(code).trim();
  const digits = str.replace(/\D/g, '');

  if (!digits) {
    return { type: null, label: 'Sin código', code: '' };
  }

  if (digits.length >= 1 && digits.length <= 6) {
    return { type: 'PLU', label: `PLU: ${digits}`, code: digits };
  }

  return { type: 'EAN', label: `EAN: ${digits}`, code: digits };
}

// ============================================================
// Catálogo Maestro de Productos
// ============================================================

/**
 * Obtiene el catálogo maestro (opcionalmente solo el de una sección)
 * @param {'autoservicio'|'atendida'} [section]
 * @returns {Array} Catálogo maestro
 */
export function getMasterCatalog(section) {
  const state = _loadState();
  const catalog = state.masterCatalog || [];
  if (!section) return catalog;
  const sec = normalizeSection(section);
  return catalog.filter(item => normalizeSection(item.section) === sec);
}

/**
 * Agrega o actualiza un ítem en el Catálogo Maestro.
 * La identidad de un ítem es (código o nombre) + sección: el mismo producto
 * puede existir en las dos secciones con datos independientes.
 * @param {{ name: string, code?: string, provider?: string, measureType?: string, section?: string }} item
 */
export function addToMasterCatalog(item) {
  if (!item || !item.name) return;
  const state = _loadState();
  if (!state.masterCatalog) state.masterCatalog = [];

  const cleanName = item.name.trim();
  const cleanCode = (item.code || item.plu || '').trim();
  const sameSection = (entry, sec) => normalizeSection(entry.section) === sec;

  const findIdx = (sec) => {
    let i = -1;
    if (cleanCode) {
      i = state.masterCatalog.findIndex(e => (sec === null || sameSection(e, sec)) && e.code && e.code.toLowerCase() === cleanCode.toLowerCase());
    }
    if (i === -1) {
      i = state.masterCatalog.findIndex(e => (sec === null || sameSection(e, sec)) && e.name.toLowerCase() === cleanName.toLowerCase());
    }
    return i;
  };

  // Si no se indica sección, se conserva la del ítem existente (o autoservicio)
  const idx = item.section ? findIdx(normalizeSection(item.section)) : findIdx(null);
  const section = item.section
    ? normalizeSection(item.section)
    : (idx !== -1 ? normalizeSection(state.masterCatalog[idx].section) : 'autoservicio');

  const catalogEntry = {
    name: cleanName,
    code: cleanCode || (idx !== -1 ? state.masterCatalog[idx].code : ''),
    provider: (item.provider || item.proveedor || (idx !== -1 ? state.masterCatalog[idx].provider : '') || '').trim(),
    measureType: item.measureType || (idx !== -1 ? state.masterCatalog[idx].measureType : 'unidades'),
    section
  };

  if (idx !== -1) {
    state.masterCatalog[idx] = { ...state.masterCatalog[idx], ...catalogEntry };
  } else {
    state.masterCatalog.push(catalogEntry);
  }

  _saveState(state);
  return catalogEntry;
}

/**
 * Busca un producto en el catálogo maestro por su código exacto.
 * Con `section`, prioriza la coincidencia de esa sección.
 * @param {string} code - Código PLU o EAN
 * @param {'autoservicio'|'atendida'} [section]
 * @returns {Object|null}
 */
export function findMasterCatalogByCode(code, section) {
  if (!code) return null;
  const clean = String(code).trim().toLowerCase();
  const matches = getMasterCatalog().filter(item => item.code && item.code.toLowerCase() === clean);
  if (!section) return matches[0] || null;
  const sec = normalizeSection(section);
  return matches.find(m => normalizeSection(m.section) === sec) || matches[0] || null;
}

/**
 * Busca un producto en el catálogo maestro por nombre exacto.
 * Con `section`, prioriza la coincidencia de esa sección.
 * @param {string} name - Nombre o término
 * @param {'autoservicio'|'atendida'} [section]
 * @returns {Object|null}
 */
export function findMasterCatalogByName(name, section) {
  if (!name) return null;
  const clean = String(name).trim().toLowerCase();
  const matches = getMasterCatalog().filter(item => item.name.toLowerCase() === clean);
  if (!section) return matches[0] || null;
  const sec = normalizeSection(section);
  return matches.find(m => normalizeSection(m.section) === sec) || matches[0] || null;
}

// ============================================================
// Productos - CRUD
// ============================================================

/**
 * Obtiene todos los productos
 * @returns {Array} Lista de productos
 */
export function getAllProducts() {
  const state = _loadState();
  return state.products;
}

/**
 * Obtiene productos filtrados por sección
 * @param {'autoservicio'|'atendida'} section - Sección del supermercado
 * @returns {Array} Productos de la sección indicada
 */
export function getProductsBySection(section) {
  const products = getAllProducts();
  return products.filter(p => p.section === section);
}

/**
 * Agrega un nuevo producto
 * @param {Object} product - Datos del producto
 * @returns {Object} Producto creado
 */
export function addProduct(product) {
  const state = _loadState();
  const rawQuantity = product.cantidad !== undefined ? product.cantidad : (product.quantity !== undefined ? product.quantity : 0);
  const parsedQuantity = Number(rawQuantity) || 0;
  const provider = (product.provider || product.proveedor || '').trim();
  const rawLote = (product.lote || product.batch || '').trim();

  // Si no se especificó un lote explícito, verificar si ya existen otros lotes del mismo producto
  let lote = rawLote;
  if (!lote) {
    const existing = state.products.filter(p => isSameProduct(p, product));
    lote = existing.length > 0 ? `Lote ${existing.length + 1}` : 'Lote 1';
  }

  const newProduct = {
    id: _generateId(),
    name: (product.name || '').trim(),
    plu: (product.plu || product.code || '').trim(),
    expiryDate: product.expiryDate || '',
    section: product.section || 'autoservicio',
    measureType: product.measureType || 'unidades',
    cantidad: parsedQuantity,
    quantity: parsedQuantity,
    provider: provider,
    proveedor: provider,
    lote: lote,
    batch: lote,
    notes: (product.notes || '').trim(),
    isSimulation: !!product.isSimulation,
    createdAt: new Date().toISOString()
  };

  state.products.push(newProduct);
  _saveState(state);

  // Auto-alimentar el Catálogo Maestro (únicamente productos reales, no de simulación)
  if (newProduct.name && !newProduct.isSimulation) {
    addToMasterCatalog({
      name: newProduct.name,
      code: newProduct.plu,
      provider: provider,
      measureType: newProduct.measureType,
      section: newProduct.section
    });
  }

  return newProduct;
}

/**
 * Agrega múltiples productos en lote (ej. importación desde PDF)
 * @param {Array<Object>} productsList
 * @returns {number} Cantidad de productos importados
 */
export function addBatchProducts(productsList) {
  if (!Array.isArray(productsList) || productsList.length === 0) return 0;
  let count = 0;
  for (const item of productsList) {
    if (item.name && item.name.trim()) {
      addProduct(item);
      count++;
    }
  }
  return count;
}

/**
 * Actualiza un producto existente
 * @param {string} id - ID del producto
 * @param {Object} data - Campos a actualizar
 * @returns {Object|null} Producto actualizado o null si no existe
 */
export function updateProduct(id, data) {
  const state = _loadState();
  const index = state.products.findIndex(p => p.id === id);
  if (index === -1) return null;

  const updatedData = { ...data };
  if (updatedData.cantidad !== undefined || updatedData.quantity !== undefined) {
    const qty = Number(updatedData.cantidad !== undefined ? updatedData.cantidad : updatedData.quantity) || 0;
    updatedData.cantidad = qty;
    updatedData.quantity = qty;
  }
  if (updatedData.provider !== undefined || updatedData.proveedor !== undefined) {
    const prov = (updatedData.provider || updatedData.proveedor || '').trim();
    updatedData.provider = prov;
    updatedData.proveedor = prov;
  }
  if (updatedData.lote !== undefined || updatedData.batch !== undefined) {
    const lotVal = (updatedData.lote || updatedData.batch || '').trim();
    updatedData.lote = lotVal;
    updatedData.batch = lotVal;
  }

  state.products[index] = { ...state.products[index], ...updatedData };
  _saveState(state);

  if (state.products[index].name) {
    addToMasterCatalog({
      name: state.products[index].name,
      code: state.products[index].plu,
      provider: state.products[index].provider,
      measureType: state.products[index].measureType,
      section: state.products[index].section
    });
  }

  return state.products[index];
}

/**
 * Elimina un producto por ID
 * @param {string} id - ID del producto a eliminar
 * @returns {boolean} true si se eliminó, false si no existía
 */
export function deleteProduct(id) {
  const state = _loadState();
  const initialLength = state.products.length;
  state.products = state.products.filter(p => p.id !== id);
  if (state.products.length < initialLength) {
    _saveState(state);
    return true;
  }
  return false;
}

// ============================================================
// Retiros / Merma (registro de producto retirado de la góndola)
// ============================================================

export const REMOVAL_REASONS = {
  vencido: 'Vencido',
  danado: 'Dañado / mal estado',
  rotacion: 'Retirado por rotación',
  otro: 'Otro motivo'
};

/**
 * Retira un producto del inventario dejando constancia (para medir pérdidas).
 * Los productos de simulación no se registran.
 * @param {string} id - ID del producto
 * @param {string} [reason='vencido'] - Clave de REMOVAL_REASONS
 * @param {string} [note] - Nota opcional
 * @returns {Object|null} Registro creado o null si no existe el producto
 */
export function withdrawProduct(id, reason = 'vencido', note = '') {
  const state = _loadState();
  const product = state.products.find(p => p.id === id);
  if (!product) return null;

  const cleanReason = REMOVAL_REASONS[reason] ? reason : 'otro';
  let record = null;
  if (!product.isSimulation) {
    record = {
      id: _generateId(),
      date: toLocalDateStr(new Date()),
      productId: product.id,
      name: product.name,
      plu: product.plu || product.code || '',
      provider: product.provider || product.proveedor || '',
      section: normalizeSection(product.section),
      quantity: Number(product.cantidad !== undefined ? product.cantidad : product.quantity) || 0,
      measureType: product.measureType === 'kilogramos' || product.measureType === 'kg' ? 'kilogramos' : 'unidades',
      lote: product.lote || '',
      expiryDate: product.expiryDate || '',
      reason: cleanReason,
      note: (note || '').trim()
    };
    if (!Array.isArray(state.removals)) state.removals = [];
    state.removals.push(record);
  }

  state.products = state.products.filter(p => p.id !== id);
  _saveState(state);
  return record;
}

/**
 * Obtiene el registro de retiros (más reciente primero)
 * @param {'autoservicio'|'atendida'} [section]
 * @returns {Array<Object>}
 */
export function getRemovals(section) {
  const state = _loadState();
  let list = Array.isArray(state.removals) ? [...state.removals] : [];
  if (section) {
    const sec = normalizeSection(section);
    list = list.filter(r => normalizeSection(r.section) === sec);
  }
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || ''));
}

/**
 * Resume retiros: totales por motivo y por proveedor
 * @param {Array<Object>} removals
 * @returns {{ total: number, kg: number, und: number, byReason: Object, byProvider: Object }}
 */
export function summarizeRemovals(removals) {
  const summary = { total: removals.length, kg: 0, und: 0, byReason: {}, byProvider: {} };
  for (const r of removals) {
    if (r.measureType === 'kilogramos') summary.kg += Number(r.quantity) || 0;
    else summary.und += Number(r.quantity) || 0;
    summary.byReason[r.reason] = (summary.byReason[r.reason] || 0) + 1;
    const prov = r.provider || 'Sin proveedor';
    summary.byProvider[prov] = (summary.byProvider[prov] || 0) + 1;
  }
  summary.kg = Math.round(summary.kg * 100) / 100;
  return summary;
}

/**
 * Obtiene un producto por su ID
 * @param {string} id
 * @returns {Object|null} Producto encontrado o null
 */
export function getProduct(id) {
  const products = getAllProducts();
  return products.find(p => p.id === id) || null;
}

/**
 * Obtiene información de agrupación por lotes para un producto determinado.
 * Permite gestionar múltiples fechas de vencimiento para un mismo producto/PLU
 * de forma independiente e identificar de forma precisa cuál lote es el
 * próximo a vencer (Rotación Prioritaria / FIFO: First In, First Out).
 * 
 * @param {Object|string} productOrId - Objeto de producto o su ID
 * @returns {{
 *   hasMultipleBatches: boolean,
 *   totalBatches: number,
 *   batchIndex: number,
 *   isNextToExpire: boolean,
 *   earliestExpiryDate: string,
 *   totalStock: number,
 *   siblingBatches: Array
 * }}
 */
export function getProductBatchInfo(productOrId) {
  const defaultInfo = {
    hasMultipleBatches: false,
    totalBatches: 1,
    batchIndex: 1,
    isNextToExpire: true,
    earliestExpiryDate: '',
    totalStock: 0,
    siblingBatches: []
  };

  if (!productOrId) return defaultInfo;

  const product = typeof productOrId === 'string' ? getProduct(productOrId) : productOrId;
  if (!product) return defaultInfo;

  const all = getAllProducts();
  const siblings = all.filter(p => isSameProduct(p, product));

  const totalStock = siblings.reduce((sum, s) => sum + (Number(s.cantidad !== undefined ? s.cantidad : s.quantity) || 0), 0);

  if (siblings.length <= 1) {
    return {
      hasMultipleBatches: false,
      totalBatches: 1,
      batchIndex: 1,
      isNextToExpire: true,
      earliestExpiryDate: product.expiryDate || '',
      totalStock: totalStock,
      siblingBatches: siblings
    };
  }

  // Ordenar cronológicamente por fecha de vencimiento (más antigua primero = primero en vencer / FIFO)
  // En caso de empate, por orden de registro (createdAt)
  siblings.sort((a, b) => {
    const dateA = a.expiryDate || '9999-99-99';
    const dateB = b.expiryDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  const myIndex = siblings.findIndex(s => s.id === product.id);
  const isNextToExpire = myIndex === 0;

  return {
    hasMultipleBatches: true,
    totalBatches: siblings.length,
    batchIndex: myIndex !== -1 ? myIndex + 1 : 1,
    isNextToExpire: isNextToExpire,
    earliestExpiryDate: siblings[0]?.expiryDate || '',
    totalStock: totalStock,
    siblingBatches: siblings
  };
}

// ============================================================
// Vencimientos - Cálculos, Alertas por Colores y Prioridades
// ============================================================

/**
 * Devuelve la fecha LOCAL en formato YYYY-MM-DD.
 * (toISOString() usa UTC y en Colombia, UTC-5, adelanta el día después de las 7:00 p. m.)
 * @param {Date} [date] - Fecha a formatear (por defecto, ahora)
 * @returns {string}
 */
export function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula los días restantes hasta el vencimiento
 * @param {string} expiryDate - Fecha de vencimiento en formato ISO (YYYY-MM-DD)
 * @returns {number} Días restantes (negativo si ya venció)
 */
export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  const diffMs = expiry - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determina el nivel de alerta cromática según la escala oficial ajustada:
 * - > 7 días: 'ok' (Verde - Óptimo)
 * - 5 a 7 días: 'warning' (Amarillo - Alerta para pedir precios)
 * - 3 a 4 días: 'urgent' (Naranja - Urgente)
 * - ≤ 2 días o vencido: 'critical' (Rojo - Crítico / Retiro: pensado para retirar 1 día antes)
 * @param {number} daysRemaining - Días hasta el vencimiento
 * @returns {'ok'|'warning'|'urgent'|'critical'} Nivel de alerta
 */
export function getAlertLevel(daysRemaining) {
  if (daysRemaining <= 2) return 'critical'; // Rojo (Crítico / Retiro: 2 días o menos / Vencido)
  if (daysRemaining <= 4) return 'urgent';   // Naranja: 3 a 4 días
  if (daysRemaining <= 7) return 'warning';  // Amarillo: Entre 5 y 7 días (Alerta para pedir precios)
  return 'ok';                              // Verde: Más de 7 días
}

/**
 * Obtiene los productos prioritarios que requieren mayor atención urgente (≤ 4 días o vencidos)
 * @param {'autoservicio'|'atendida'} [section] - Sección opcional para filtrar
 * @returns {Array<Object>} Lista de productos críticos y urgentes ordenados por fecha
 */
export function getPriorityProducts(section) {
  const products = section ? getProductsBySection(section) : getAllProducts();
  const urgentItems = products.filter(p => {
    const days = getDaysUntilExpiry(p.expiryDate);
    return days <= 4; // Críticos (≤2 días/vencidos) y urgentes (3-4 días)
  });

  urgentItems.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  return urgentItems;
}

// ============================================================
// Pedir Precios
// ============================================================

/**
 * Obtiene las solicitudes de precios de una fecha específica
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Array} Solicitudes de precio para esa fecha
 */
export function getPriceRequests(date) {
  const state = _loadState();
  return state.priceRequests.filter(pr => pr.date === date);
}

/**
 * Guarda una nueva solicitud de precio
 * @param {Object} request - Datos de la solicitud
 * @returns {Object} Solicitud creada con ID
 */
export function savePriceRequest(request) {
  const state = _loadState();
  const prod = request.productId ? getProduct(request.productId) : null;
  const newRequest = {
    id: _generateId(),
    productId: request.productId || '',
    // Copia de los datos del producto: el historial se conserva aunque luego se retire
    name: request.name || (prod ? prod.name : ''),
    plu: request.plu || (prod ? (prod.plu || prod.code || '') : ''),
    provider: request.provider || (prod ? (prod.provider || prod.proveedor || '') : ''),
    section: normalizeSection(request.section || (prod ? prod.section : 'autoservicio')),
    date: request.date || toLocalDateStr(new Date()),
    quantity: Number(request.quantity) || 0,
    unit: request.unit || 'unidades',
    priceRequested: !!request.priceRequested,
    priceGiven: !!request.priceGiven
  };
  state.priceRequests.push(newRequest);
  _saveState(state);
  return newRequest;
}

/**
 * Actualiza una solicitud de precio existente
 * @param {string} id - ID de la solicitud
 * @param {Object} data - Campos a actualizar
 * @returns {Object|null} Solicitud actualizada o null
 */
export function updatePriceRequest(id, data) {
  const state = _loadState();
  const index = state.priceRequests.findIndex(pr => pr.id === id);
  if (index === -1) return null;

  state.priceRequests[index] = { ...state.priceRequests[index], ...data };
  _saveState(state);
  return state.priceRequests[index];
}

/**
 * Historial de pedidos de precio agrupado por día (más reciente primero).
 * Solo incluye solicitudes marcadas como pedidas o con cantidad.
 * @param {'autoservicio'|'atendida'} [section] - Filtra por sección
 * @param {number} [limitDays=60] - Máximo de días a devolver
 * @returns {Array<{ date: string, items: Array<Object> }>}
 */
export function getPriceHistory(section, limitDays = 60) {
  const state = _loadState();
  const byDate = new Map();
  for (const r of state.priceRequests) {
    if (!r.priceRequested && !(Number(r.quantity) > 0)) continue;
    const prod = r.productId ? getProduct(r.productId) : null;
    const sec = normalizeSection(r.section || (prod ? prod.section : 'autoservicio'));
    if (section && sec !== normalizeSection(section)) continue;
    const item = {
      ...r,
      section: sec,
      name: r.name || (prod ? prod.name : '(producto retirado)'),
      plu: r.plu || (prod ? (prod.plu || prod.code || '') : ''),
      provider: r.provider || (prod ? (prod.provider || prod.proveedor || '') : '')
    };
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(item);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limitDays)
    .map(([date, items]) => ({ date, items }));
}

/**
 * Obtiene productos que necesitan solicitar precio (≤7 días de vencimiento)
 * Criterio de rotación: Únicamente productos cuya fecha/días restantes sean de 5 a 7 días o menos (≤ 7 días)
 * @param {string} [section] - Sección opcional para filtrar
 * @returns {Array} Productos que necesitan precio
 */
export function getProductsNeedingPrices(section) {
  let products = section ? getProductsBySection(section) : getAllProducts();
  return products.filter(p => {
    const days = getDaysUntilExpiry(p.expiryDate);
    // Filtrado estricto: únicamente productos con 7 días o menos (oculta cualquier producto > 7 días)
    return days <= 7;
  });
}

/**
 * Determina si la fecha dada es un día de pedir precios
 * Regla de negocio:
 * - Días habituales: Lunes (1) y Jueves (4)
 * - Si lunes es festivo: el lunes se traslada al martes (2) y se mantiene el jueves (4)
 * @param {Date} date - Fecha a evaluar
 * @param {boolean} mondayHoliday - Si el lunes es festivo
 * @returns {boolean}
 */
export function isPriceRequestDay(date, mondayHoliday) {
  const day = date.getDay();

  if (day === 4) return true;
  if (!mondayHoliday && day === 1) return true;
  if (mondayHoliday && day === 2) return true;

  return false;
}

/**
 * Calcula el próximo día de pedir precios a partir de una fecha
 * @param {Date} date - Fecha de referencia
 * @param {boolean} mondayHoliday - Si el lunes es festivo
 * @returns {Date} Próximo día de pedir
 */
export function getNextPriceRequestDay(date, mondayHoliday) {
  const next = new Date(date);
  for (let i = 0; i < 7; i++) {
    next.setDate(next.getDate() + 1);
    if (isPriceRequestDay(next, mondayHoliday)) {
      return next;
    }
  }
  return next;
}

// ============================================================
// Configuración
// ============================================================

/**
 * Obtiene la configuración actual
 * @returns {Object} Configuración
 */
export function getSettings() {
  const state = _loadState();
  return state.settings || { mondayHoliday: false };
}

/**
 * Guarda la configuración
 * @param {Object} settings - Nueva configuración
 */
export function saveSettings(settings) {
  const state = _loadState();
  state.settings = { ...state.settings, ...settings };
  _saveState(state);
}

// ============================================================
// Respaldo y avisos
// ============================================================

/**
 * Anota que se hizo un respaldo ahora
 */
export function markBackupDone() {
  saveSettings({ lastBackupAt: new Date().toISOString() });
}

/**
 * Estado del respaldo: avisa si nunca se hizo o pasaron más de `maxDays` días
 * y hay datos que proteger.
 * @param {number} [maxDays=7]
 * @returns {{ lastBackupAt: string|null, daysSince: number|null, needsReminder: boolean }}
 */
export function getBackupStatus(maxDays = 7) {
  const state = _loadState();
  const last = (state.settings && state.settings.lastBackupAt) || null;
  const hasData = state.products.length > 0 || (state.removals || []).length > 0;
  let daysSince = null;
  if (last) {
    daysSince = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }
  const needsReminder = hasData && (daysSince === null || daysSince >= maxDays);
  return { lastBackupAt: last, daysSince, needsReminder };
}

// ============================================================
// Exportar / Importar datos
// ============================================================

/**
 * Exporta todos los datos como string JSON
 * @returns {string} JSON con todos los datos
 */
export function exportData() {
  const state = _loadState();
  return JSON.stringify(state, null, 2);
}

/**
 * Importa datos desde un string JSON
 * Reemplaza completamente el estado actual
 * @param {string} jsonString - Datos en formato JSON
 * @returns {boolean} true si la importación fue exitosa
 * @throws {Error} Si el JSON es inválido o la estructura no es correcta
 */
export function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      throw new Error('Formato de datos inválido');
    }

    const state = {
      products: Array.isArray(data.products) ? data.products : [],
      priceRequests: Array.isArray(data.priceRequests) ? data.priceRequests : [],
      masterCatalog: Array.isArray(data.masterCatalog) ? data.masterCatalog : [],
      removals: Array.isArray(data.removals) ? data.removals : [],
      settings: data.settings || { mondayHoliday: false }
    };

    _saveState(state);
    return true;
  } catch (e) {
    console.error('Error importando datos:', e);
    throw new Error('No se pudieron importar los datos: ' + e.message);
  }
}

// ============================================================
// SIMULACIÓN Y TESTING RÁPIDO DE PEDIDO DE PRECIOS
// ============================================================

/**
 * Carga un conjunto completo de productos y pedidos simulados para testing
 * Permite probar de inmediato:
 * - Selección visual de productos
 * - Indicadores por colores de cercanía de vencimiento
 * - Cantidades a pedir pre-cargadas
 * - Generación y descarga/compartición de reportes en PDF
 * @returns {Array<Object>} Productos simulados creados
 */
export function loadSimulationScenario() {
  const today = new Date();
  const todayStr = toLocalDateStr(today);

  const addDays = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return toLocalDateStr(d);
  };

  // Limpiar cualquier simulación previa para evitar duplicados
  clearSimulationScenario();

  const simulationProducts = [
    {
      name: '[SIMULACIÓN] Bife de Chorizo Premium',
      plu: '7791234567890', // EAN
      provider: 'Frigorífico Central',
      lote: 'Lote 1 (Cámara A)',
      expiryDate: addDays(1), // Crítico (1 día) - Rojo (FIFO: Vender Primero)
      section: 'autoservicio',
      measureType: 'kilogramos',
      cantidad: 14.5,
      notes: 'Lote de prueba A1 - vence primero',
      isSimulation: true
    },
    {
      name: '[SIMULACIÓN] Bife de Chorizo Premium',
      plu: '7791234567890', // Mismo producto y EAN con distinta fecha de vencimiento
      provider: 'Frigorífico Central',
      lote: 'Lote 2 (Cámara B)',
      expiryDate: addDays(10), // Verde (> 7 días) - Lote posterior
      section: 'autoservicio',
      measureType: 'kilogramos',
      cantidad: 28.0,
      notes: 'Lote posterior recibido hoy',
      isSimulation: true
    },
    {
      name: '[SIMULACIÓN] Pechuga de Pollo Fresca',
      plu: '7792345678901', // EAN
      provider: 'Avícola San Marcos',
      lote: 'Lote 1',
      expiryDate: addDays(2), // Urgente (2 días) - Naranja
      section: 'autoservicio',
      measureType: 'kilogramos',
      cantidad: 20.0,
      notes: 'Lote de prueba San Marcos',
      isSimulation: true
    },
    {
      name: '[SIMULACIÓN] Milanesas de Carne Preparadas',
      plu: '4011', // PLU
      provider: 'Elaboración Mostrador',
      lote: 'Lote Mostrador',
      expiryDate: addDays(0), // Vence HOY - Rojo
      section: 'atendida',
      measureType: 'kilogramos',
      cantidad: 18.5,
      notes: 'Mostrador atendido test',
      isSimulation: true
    },
    {
      name: '[SIMULACIÓN] Chorizo Bombón Especial',
      plu: '4022', // PLU
      provider: 'Embutidos Artesanales',
      lote: 'Lote 1',
      expiryDate: addDays(3), // Urgente (3 días) - Naranja
      section: 'atendida',
      measureType: 'kilogramos',
      cantidad: 12.0,
      notes: 'Test embutido',
      isSimulation: true
    },
    {
      name: '[SIMULACIÓN] Hamburguesas Caseras x4',
      plu: '7793456789012', // EAN
      provider: 'Elaboración Propia',
      lote: 'Lote 1',
      expiryDate: addDays(6), // Amarillo (5 a 7 días: alerta pedir precios)
      section: 'autoservicio',
      measureType: 'unidades',
      cantidad: 25,
      notes: 'Test unidades',
      isSimulation: true
    },
    {
      name: '[SIMULACIÓN] Asado de Tira Especial',
      plu: '4044', // PLU
      provider: 'Frigorífico Central',
      lote: 'Lote 1',
      expiryDate: addDays(12), // Verde (> 7 días: no requiere pedir precio)
      section: 'atendida',
      measureType: 'kilogramos',
      cantidad: 35.0,
      notes: 'Test verde óptimo',
      isSimulation: true
    }
  ];

  const createdProducts = [];
  simulationProducts.forEach(pData => {
    const p = addProduct(pData);
    createdProducts.push(p);
  });

  // Marcar automáticamente 4 de ellos con precios pedidos y cantidades ingresadas
  if (createdProducts.length >= 4) {
    savePriceRequest({
      productId: createdProducts[0].id,
      date: todayStr,
      quantity: 10.5,
      unit: 'kilogramos',
      priceRequested: true
    });
    savePriceRequest({
      productId: createdProducts[1].id,
      date: todayStr,
      quantity: 15.0,
      unit: 'kilogramos',
      priceRequested: true
    });
    savePriceRequest({
      productId: createdProducts[2].id,
      date: todayStr,
      quantity: 18.5,
      unit: 'kilogramos',
      priceRequested: true
    });
    savePriceRequest({
      productId: createdProducts[3].id,
      date: todayStr,
      quantity: 8.0,
      unit: 'kilogramos',
      priceRequested: true
    });
  }

  return createdProducts;
}

/**
 * Limpia y elimina todos los productos y pedidos de la simulación
 * @returns {number} Cantidad de productos de simulación eliminados
 */
export function clearSimulationScenario() {
  const state = _loadState();
  const simProducts = state.products.filter(p => p.isSimulation || (p.name && p.name.startsWith('[SIMULACIÓN]')));
  const simIds = new Set(simProducts.map(p => p.id));

  state.products = state.products.filter(p => !simIds.has(p.id));
  state.priceRequests = state.priceRequests.filter(req => !simIds.has(req.productId));

  _saveState(state);
  return simProducts.length;
}

/**
 * Retorna true si hay productos de simulación activos actualmente en memoria o almacenamiento
 * @returns {boolean}
 */
export function isSimulationActive() {
  const state = _loadState();
  return state.products.some(p => p.isSimulation || (p.name && p.name.startsWith('[SIMULACIÓN]')));
}

/**
 * Elimina totalmente todos los datos del almacenamiento local (IndexedDB + LocalStorage)
 * Deja la app en estado 100% virgen (0 productos, 0 pedidos, 0 catálogo)
 */
export async function clearAllData() {
  currentState = {
    products: [],
    priceRequests: [],
    masterCatalog: [],
    removals: [],
    settings: { mondayHoliday: false }
  };
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  try {
    await db.dbSaveProducts([]);
    await db.dbSavePriceRequests([]);
    await db.dbSaveMasterCatalog([]);
    await db.dbSaveKV('removals', []);
  } catch (e) {
    console.warn('Error limpiando IndexedDB:', e);
  }
  _saveState(currentState);
}
