// Pruebas de la lógica de negocio de Rotador (sin navegador).
// Ejecutar con:  npm test   (requiere Node 18 o superior)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Simulación mínima de localStorage para poder importar store.js en Node
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};

const store = await import('../js/store.js');

const daysFromToday = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return store.toLocalDateStr(d);
};

beforeEach(() => {
  store.importData(JSON.stringify({ products: [], priceRequests: [], masterCatalog: [], removals: [], settings: {} }));
});

// ---------- Fechas ----------
test('toLocalDateStr usa la fecha local, no UTC (9:30 p. m. sigue siendo el mismo día)', () => {
  assert.equal(store.toLocalDateStr(new Date(2026, 10, 10, 21, 30)), '2026-11-10');
  assert.equal(store.toLocalDateStr(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});

test('getDaysUntilExpiry: hoy = 0, mañana = 1, ayer = -1, sin fecha = 999', () => {
  assert.equal(store.getDaysUntilExpiry(daysFromToday(0)), 0);
  assert.equal(store.getDaysUntilExpiry(daysFromToday(1)), 1);
  assert.equal(store.getDaysUntilExpiry(daysFromToday(-1)), -1);
  assert.equal(store.getDaysUntilExpiry(''), 999);
});

test('getAlertLevel respeta la escala oficial (rojo ≤2, naranja 3-4, amarillo 5-7, verde >7)', () => {
  assert.equal(store.getAlertLevel(-3), 'critical');
  assert.equal(store.getAlertLevel(2), 'critical');
  assert.equal(store.getAlertLevel(3), 'urgent');
  assert.equal(store.getAlertLevel(4), 'urgent');
  assert.equal(store.getAlertLevel(5), 'warning');
  assert.equal(store.getAlertLevel(7), 'warning');
  assert.equal(store.getAlertLevel(8), 'ok');
});

test('isPriceRequestDay: jueves siempre; lunes, o martes si el lunes es festivo', () => {
  const lunes = new Date(2026, 10, 9);
  const martes = new Date(2026, 10, 10);
  const jueves = new Date(2026, 10, 12);
  assert.equal(store.isPriceRequestDay(jueves, false), true);
  assert.equal(store.isPriceRequestDay(lunes, false), true);
  assert.equal(store.isPriceRequestDay(martes, false), false);
  assert.equal(store.isPriceRequestDay(lunes, true), false);
  assert.equal(store.isPriceRequestDay(martes, true), true);
});

// ---------- Secciones separadas ----------
test('el mismo producto en Autoservicio y Atendida no comparte lotes ni stock', () => {
  const a1 = store.addProduct({ name: 'Pollo entero', plu: '101', section: 'autoservicio', cantidad: 10, expiryDate: daysFromToday(5) });
  const t1 = store.addProduct({ name: 'Pollo entero', plu: '101', section: 'atendida', cantidad: 4, expiryDate: daysFromToday(3) });
  const a2 = store.addProduct({ name: 'Pollo entero', plu: '101', section: 'autoservicio', cantidad: 6, expiryDate: daysFromToday(9) });

  assert.equal(a1.lote, 'Lote 1');
  assert.equal(t1.lote, 'Lote 1', 'Atendida empieza su propio Lote 1');
  assert.equal(a2.lote, 'Lote 2');

  const infoAut = store.getProductBatchInfo(a1.id);
  assert.equal(infoAut.totalBatches, 2);
  assert.equal(infoAut.totalStock, 16);

  const infoAte = store.getProductBatchInfo(t1.id);
  assert.equal(infoAte.totalBatches, 1);
  assert.equal(infoAte.totalStock, 4);
});

test('el catálogo maestro guarda una entrada independiente por sección', () => {
  store.addToMasterCatalog({ name: 'Lomo', code: '55', provider: 'Proveedor A', section: 'autoservicio' });
  store.addToMasterCatalog({ name: 'Lomo', code: '55', provider: 'Proveedor B', section: 'atendida' });

  assert.equal(store.getMasterCatalog().length, 2);
  assert.equal(store.getMasterCatalog('autoservicio').length, 1);
  assert.equal(store.findMasterCatalogByCode('55', 'atendida').provider, 'Proveedor B');
  assert.equal(store.findMasterCatalogByName('lomo', 'autoservicio').provider, 'Proveedor A');
});

test('productos prioritarios y para pedir precio se filtran por sección', () => {
  store.addProduct({ name: 'A-crítico', section: 'autoservicio', expiryDate: daysFromToday(1) });
  store.addProduct({ name: 'T-crítico', section: 'atendida', expiryDate: daysFromToday(2) });
  store.addProduct({ name: 'T-lejano', section: 'atendida', expiryDate: daysFromToday(20) });

  assert.deepEqual(store.getPriorityProducts('autoservicio').map(p => p.name), ['A-crítico']);
  assert.deepEqual(store.getPriorityProducts('atendida').map(p => p.name), ['T-crítico']);
  assert.equal(store.getPriorityProducts().length, 2);
  assert.equal(store.getProductsNeedingPrices('atendida').length, 1);
});

// ---------- Retiros / merma ----------
test('withdrawProduct registra el retiro y quita el producto del inventario', () => {
  const p = store.addProduct({ name: 'Costilla', plu: '9', section: 'atendida', cantidad: 2.5, measureType: 'kilogramos', provider: 'Frigo', expiryDate: daysFromToday(-1) });
  const rec = store.withdrawProduct(p.id, 'vencido', ' sobró ');

  assert.equal(rec.reason, 'vencido');
  assert.equal(rec.note, 'sobró');
  assert.equal(rec.section, 'atendida');
  assert.equal(store.getProduct(p.id), null);
  assert.equal(store.getRemovals('atendida').length, 1);
  assert.equal(store.getRemovals('autoservicio').length, 0);

  const sum = store.summarizeRemovals(store.getRemovals());
  assert.equal(sum.kg, 2.5);
  assert.equal(sum.byProvider['Frigo'], 1);
});

test('un motivo desconocido se guarda como "otro" y la simulación no genera registro', () => {
  const p = store.addProduct({ name: 'X', section: 'autoservicio', expiryDate: daysFromToday(1) });
  assert.equal(store.withdrawProduct(p.id, 'inventado').reason, 'otro');

  const sim = store.addProduct({ name: 'Sim', section: 'autoservicio', isSimulation: true, expiryDate: daysFromToday(1) });
  assert.equal(store.withdrawProduct(sim.id, 'vencido'), null);
  assert.equal(store.getRemovals().length, 1);
});

// ---------- Historial de pedidos de precio ----------
test('el historial de precios agrupa por día, filtra por sección y sobrevive al retiro del producto', () => {
  const a = store.addProduct({ name: 'Chorizo', section: 'autoservicio', expiryDate: daysFromToday(3) });
  const t = store.addProduct({ name: 'Morcilla', section: 'atendida', expiryDate: daysFromToday(3) });
  store.savePriceRequest({ productId: a.id, date: '2026-11-09', quantity: 3, unit: 'kilogramos', priceRequested: true });
  store.savePriceRequest({ productId: t.id, date: '2026-11-09', quantity: 5, unit: 'unidades', priceRequested: true });
  store.savePriceRequest({ productId: a.id, date: '2026-11-05', quantity: 1, unit: 'unidades', priceRequested: true });

  store.withdrawProduct(a.id, 'rotacion');

  const todo = store.getPriceHistory();
  assert.equal(todo.length, 2);
  assert.equal(todo[0].date, '2026-11-09', 'más reciente primero');

  const aut = store.getPriceHistory('autoservicio');
  assert.equal(aut.length, 2);
  assert.equal(aut[0].items[0].name, 'Chorizo', 'conserva el nombre aunque el producto ya no exista');

  assert.equal(store.getPriceHistory('atendida').length, 1);
});

// ---------- Respaldo ----------
test('getBackupStatus avisa solo si hay datos y no hay respaldo reciente', () => {
  assert.equal(store.getBackupStatus().needsReminder, false, 'sin datos no hay nada que respaldar');

  store.addProduct({ name: 'Algo', section: 'autoservicio', expiryDate: daysFromToday(4) });
  assert.equal(store.getBackupStatus().needsReminder, true);

  store.markBackupDone();
  const st = store.getBackupStatus();
  assert.equal(st.needsReminder, false);
  assert.equal(st.daysSince, 0);
});

test('exportar e importar conserva productos, retiros y catálogo', () => {
  const p = store.addProduct({ name: 'Y', section: 'atendida', expiryDate: daysFromToday(1) });
  store.withdrawProduct(p.id, 'danado');
  const json = store.exportData();

  store.importData(JSON.stringify({ products: [], priceRequests: [], masterCatalog: [], removals: [], settings: {} }));
  assert.equal(store.getRemovals().length, 0);

  store.importData(json);
  assert.equal(store.getRemovals().length, 1);
  assert.equal(store.getMasterCatalog('atendida').length, 1);
});
