/**
 * ui.js - Módulo de interfaz/renderizado para Rotador
 * Totalmente sincronizado con index.html y store.js
 * Incluye distinción cromática, diferenciación PLU/EAN, validación de cantidad y Catálogo Maestro
 */

import * as store from './store.js';
import * as scanner from './scanner.js';

// Estado de la interfaz
let currentSection = 'autoservicio';
let currentSort = 'date'; // 'date' | 'name'
let currentFilter = 'all'; // 'all' | 'expired' | 'today'
let searchQuery = '';
let editingProductId = null;
let productToDeleteId = null;
let currentViewId = 'view-inventory';

// ============================================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================================

export function showView(viewId) {
  currentViewId = viewId;
  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Mostrar la vista seleccionada
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  // Actualizar estado de navegación inferior
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-view') === viewId;
    if (isTarget) {
      btn.classList.add('text-action');
      btn.classList.remove('text-text-secondary');
    } else {
      btn.classList.remove('text-action');
      btn.classList.add('text-text-secondary');
    }
  });

  // Acciones al cambiar de vista
  if (viewId === 'view-inventory') {
    renderProductList();
  } else if (viewId === 'view-pedir-precios') {
    renderPedirPrecios();
  } else if (viewId === 'view-settings') {
    renderSettings();
  }
}

// ============================================================
// GESTIÓN DE FECHA EN HEADER
// ============================================================

export function updateHeaderDate() {
  const headerDateEl = document.getElementById('header-date');
  if (!headerDateEl) return;
  const now = new Date();
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  headerDateEl.textContent = now.toLocaleDateString('es-ES', options);
}

// ============================================================
// SECCIONES & DISTINCIÓN CROMÁTICA
// ============================================================

/**
 * Alterna dinámicamente entre Autoservicio y Atendida desde el botón de la barra superior
 */
export function toggleSection() {
  const nextSection = currentSection === 'autoservicio' ? 'atendida' : 'autoservicio';
  setSection(nextSection);
  showView(currentViewId === 'view-pedir-precios' ? 'view-pedir-precios' : 'view-inventory');
  showToast(nextSection === 'autoservicio' ? 'Sección: Autoservicio (🛒 AUT)' : 'Sección: Atendida (🥩 ATE)', 'info');
}

/**
 * Cambia la sección activa y actualiza estilos cromáticos:
 * - Botón de barra superior con abreviaturas: "AUT" (🛒) / "ATE" (🥩)
 * - Autoservicio: Azul / Índigo
 * - Atendida: Ámbar / Dorado
 * @param {'autoservicio'|'atendida'} section
 */
export function setSection(section) {
  currentSection = section;

  // Actualizar botón selector de sección en la barra superior con abreviaturas compactas
  const toggleBtn = document.getElementById('btn-toggle-section') || document.getElementById('active-section-indicator');
  if (toggleBtn) {
    if (section === 'autoservicio') {
      toggleBtn.innerHTML = `<span class="pointer-events-none text-xs">🛒</span><span class="pointer-events-none font-extrabold tracking-wider">AUT</span>`;
      toggleBtn.className = 'text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ml-1.5 mr-3 sm:mr-4 flex-shrink-0 select-none';
      toggleBtn.title = 'Sección: Autoservicio (AUT). Toca para cambiar a Atendida (ATE)';
      toggleBtn.setAttribute('aria-label', 'Alternar sección: actualmente Autoservicio (AUT)');
    } else {
      toggleBtn.innerHTML = `<span class="pointer-events-none text-xs">🥩</span><span class="pointer-events-none font-extrabold tracking-wider">ATE</span>`;
      toggleBtn.className = 'text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ml-1.5 mr-3 sm:mr-4 flex-shrink-0 select-none';
      toggleBtn.title = 'Sección: Atendida (ATE). Toca para cambiar a Autoservicio (AUT)';
      toggleBtn.setAttribute('aria-label', 'Alternar sección: actualmente Atendida (ATE)');
    }
  }

  // Actualizar tabs superiores con estilos diferenciados
  const tabAuto = document.querySelector('.inventory-tab[data-section="autoservicio"]');
  const tabAtend = document.querySelector('.inventory-tab[data-section="atendida"]');

  if (tabAuto && tabAtend) {
    if (section === 'autoservicio') {
      tabAuto.className = 'inventory-tab flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 border-blue-500 text-blue-400 bg-blue-950/30';
      tabAtend.className = 'inventory-tab flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 border-transparent text-text-secondary bg-transparent hover:text-text-primary';
    } else {
      tabAtend.className = 'inventory-tab flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 border-amber-500 text-amber-400 bg-amber-950/30';
      tabAuto.className = 'inventory-tab flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 border-transparent text-text-secondary bg-transparent hover:text-text-primary';
    }
  }

  updatePedirTabs(section);
  renderProductList();
  if (currentViewId === 'view-pedir-precios') renderPedirPrecios();
  updateCatalogDatalists();
  updateAlertBadge();
}

/**
 * Colorea las pestañas de sección de la vista Pedir Precios
 * @param {'autoservicio'|'atendida'} section
 */
function updatePedirTabs(section) {
  const base = 'pedir-tab flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 ';
  document.querySelectorAll('.pedir-tab').forEach(tab => {
    const sec = tab.getAttribute('data-section');
    if (sec === section) {
      tab.className = base + (sec === 'autoservicio'
        ? 'border-blue-400 text-blue-300 bg-blue-500/10'
        : 'border-amber-400 text-amber-300 bg-amber-500/10');
    } else {
      tab.className = base + 'border-transparent text-text-secondary';
    }
  });
}

export function getCurrentSection() {
  return currentSection;
}

export function setSearchQuery(query) {
  searchQuery = (query || '').trim().toLowerCase();
  renderProductList();
}

export function setSort(sortType) {
  currentSort = sortType;
  document.querySelectorAll('.sort-chip').forEach(chip => {
    if (chip.getAttribute('data-sort') === sortType) {
      chip.classList.add('bg-action/20', 'text-action', 'border-action/30');
      chip.classList.remove('bg-surface-light', 'text-text-secondary', 'border-transparent');
    } else {
      chip.classList.remove('bg-action/20', 'text-action', 'border-action/30');
      chip.classList.add('bg-surface-light', 'text-text-secondary', 'border-transparent');
    }
  });
  renderProductList();
}

export function setFilter(filterType) {
  if (currentFilter === filterType) {
    currentFilter = 'all';
  } else {
    currentFilter = filterType;
  }

  document.querySelectorAll('.filter-chip').forEach(chip => {
    if (chip.getAttribute('data-filter') === currentFilter) {
      chip.classList.add('bg-action/20', 'text-action', 'border-action/30');
      chip.classList.remove('bg-surface-light', 'text-text-secondary', 'border-transparent');
    } else {
      chip.classList.remove('bg-action/20', 'text-action', 'border-action/30');
      chip.classList.add('bg-surface-light', 'text-text-secondary', 'border-transparent');
    }
  });
  renderProductList();
}

// ============================================================
// LISTA DE PRODUCTOS (INVENTARIO)
// ============================================================

export function renderProductList() {
  const container = document.getElementById('product-list');
  const emptyState = document.getElementById('inventory-empty');
  if (!container) return;

  let products = store.getProductsBySection(currentSection);

  // Filtro por texto de búsqueda
  if (searchQuery) {
    products = products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = (p.plu || p.code || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      const provider = (p.provider || p.proveedor || '').toLowerCase();
      return name.includes(searchQuery) || code.includes(searchQuery) || notes.includes(searchQuery) || provider.includes(searchQuery);
    });
  }

  // Filtro por estado de vencimiento
  if (currentFilter === 'expired') {
    products = products.filter(p => store.getDaysUntilExpiry(p.expiryDate) < 0);
  } else if (currentFilter === 'today') {
    products = products.filter(p => store.getDaysUntilExpiry(p.expiryDate) === 0);
  } else if (currentFilter === 'critical') {
    products = products.filter(p => store.getDaysUntilExpiry(p.expiryDate) <= 2);
  } else if (currentFilter === 'pedir') {
    products = products.filter(p => store.getDaysUntilExpiry(p.expiryDate) <= 7);
  }

  // Ordenamiento
  if (currentSort === 'name') {
    products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else {
    // Por vencimiento (más urgente primero)
    products.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }

  // Manejo de estado vacío
  if (products.length === 0) {
    container.innerHTML = '';
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
  }

  // Configuración de colores según nivel de alerta
  const alertStyles = {
    ok: {
      border: 'border-exp-green',
      badgeBg: 'bg-exp-green/20',
      badgeText: 'text-exp-green'
    },
    warning: {
      border: 'border-exp-yellow',
      badgeBg: 'bg-exp-yellow/20',
      badgeText: 'text-exp-yellow'
    },
    urgent: {
      border: 'border-exp-orange',
      badgeBg: 'bg-exp-orange/20',
      badgeText: 'text-exp-orange'
    },
    critical: {
      border: 'border-exp-red',
      badgeBg: 'bg-exp-red/20',
      badgeText: 'text-exp-red'
    }
  };

  const isAuto = currentSection === 'autoservicio';

  container.innerHTML = products.map(p => {
    const days = store.getDaysUntilExpiry(p.expiryDate);
    const alertLevel = store.getAlertLevel(days);
    const style = alertStyles[alertLevel] || alertStyles.ok;

    let daysLabel = '';
    if (days < 0) {
      daysLabel = `Venció (${Math.abs(days)}d)`;
    } else if (days === 0) {
      daysLabel = 'Vence HOY (Retirar)';
    } else if (days === 1) {
      daysLabel = '1 día (Retirar)';
    } else if (days === 2) {
      daysLabel = '2 días (Crítico / Retiro)';
    } else if (days <= 4) {
      daysLabel = `${days} días (Urgente)`;
    } else if (days <= 7) {
      daysLabel = `${days} días (Pedir Precios)`;
    } else {
      daysLabel = `${days} días (Óptimo)`;
    }

    const formattedDate = formatDateDisplay(p.expiryDate);
    const isKg = p.measureType === 'kilogramos' || p.measureType === 'kg';
    const unitLabel = isKg ? 'kg' : 'uds';
    const cantidadVal = (p.cantidad !== undefined && p.cantidad !== null) ? p.cantidad : (p.quantity || 0);

    // Diferenciación inteligente PLU vs EAN (1-6 dígitos vs 7+)
    const codeInfo = store.formatCodeInfo(p.plu || p.code);
    let codeBadgeHtml = '';
    if (codeInfo.type === 'PLU') {
      codeBadgeHtml = `<span class="font-mono text-xs font-bold text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/40">PLU: ${escapeHtml(codeInfo.code)}</span>`;
    } else if (codeInfo.type === 'EAN') {
      codeBadgeHtml = `<span class="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/40">EAN: ${escapeHtml(codeInfo.code)}</span>`;
    }

    // Información de Lotes y Rotación Prioritaria (FIFO)
    const batchInfo = store.getProductBatchInfo(p);
    const loteName = p.lote || p.batch || (batchInfo.hasMultipleBatches ? `Lote ${batchInfo.batchIndex}` : 'Lote 1');
    const loteBadgeHtml = `<span class="font-mono text-xs font-bold text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/40" title="Identificador de lote">🏷️ ${escapeHtml(loteName)}</span>`;

    let rotationBanner = '';
    if (batchInfo.hasMultipleBatches) {
      if (batchInfo.isNextToExpire) {
        rotationBanner = `
          <div class="mt-2.5 py-1 px-2.5 rounded-lg bg-exp-red/15 border border-exp-red/40 flex items-center justify-between gap-1 text-[11px]">
            <span class="font-extrabold text-exp-red flex items-center gap-1">
              ⚡ LOTE PRÓXIMO A VENCER (Rotación Prioritaria / FIFO)
            </span>
            <span class="text-text-secondary text-[10px] font-semibold bg-surface/80 px-1.5 py-0.5 rounded border border-exp-red/20">
              Lote ${batchInfo.batchIndex} de ${batchInfo.totalBatches}
            </span>
          </div>
        `;
      } else {
        rotationBanner = `
          <div class="mt-2.5 py-1 px-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-1 text-[11px]">
            <span class="font-bold text-blue-300 flex items-center gap-1">
              📦 Lote posterior (${batchInfo.batchIndex} de ${batchInfo.totalBatches}) • Vence después
            </span>
            <span class="text-text-secondary text-[10px] bg-surface/80 px-1.5 py-0.5 rounded">
              Stock total: ${batchInfo.totalStock} ${unitLabel}
            </span>
          </div>
        `;
      }
    }

    // Distinción cromática de tarjeta según sección
    const cardBgClass = isAuto
      ? 'bg-[#182338] hover:bg-[#1d2b45] border-accent/30'
      : 'bg-[#282017] hover:bg-[#32281e] border-amber-900/30';

    const sectionBadge = isAuto
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">🛒 Autoservicio</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">🥩 Atendida</span>`;

    const providerHtml = (p.provider || p.proveedor)
      ? `<span class="text-[11px] text-text-secondary/80 truncate">🏭 ${escapeHtml(p.provider || p.proveedor)}</span>`
      : '';

    return `
      <div class="product-card rounded-xl p-4 border-l-4 ${style.border} ${cardBgClass} active:scale-[0.99] transition-all cursor-pointer shadow-lg border"
           data-id="${p.id}">
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 mb-1">
              ${sectionBadge}
              ${codeBadgeHtml}
              ${loteBadgeHtml}
            </div>
            <h3 class="font-bold text-base text-white truncate">${escapeHtml(p.name)}</h3>
            <div class="flex flex-wrap items-center gap-2 mt-1.5">
              <span class="px-2.5 py-0.5 rounded bg-surface text-xs font-bold text-white border border-accent/40">
                Cant: <strong class="text-action">${cantidadVal}</strong> ${unitLabel}
              </span>
              ${providerHtml}
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full ${style.badgeBg} ${style.badgeText} shadow-sm">
              ${daysLabel}
            </span>
          </div>
        </div>
        ${rotationBanner}
        <div class="flex flex-wrap justify-between items-center gap-2 mt-3 pt-2.5 border-t border-accent/20 text-xs text-text-secondary">
          <div class="flex items-center gap-2 min-w-0">
            <span>📅 Vence: <strong class="text-text-primary font-medium">${formattedDate}</strong></span>
            ${p.notes ? `<span class="italic truncate max-w-[120px] text-text-secondary/70">📝 ${escapeHtml(p.notes)}</span>` : ''}
          </div>
          <button type="button" class="btn-quick-new-lot text-[11px] font-bold text-purple-300 bg-purple-950/60 hover:bg-purple-900/80 active:scale-95 border border-purple-500/40 rounded px-2.5 py-1 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
            data-id="${p.id}"
            title="Registrar un nuevo lote con fecha de vencimiento diferente para este producto">
            ➕ Nuevo Lote
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Actualizar conteo de alertas prioritarias en la campana
  updateAlertBadge();
}

// ============================================================
// FORMULARIO AGREGAR / EDITAR PRODUCTO & AUTOCOMPLETADO
// ============================================================

/**
 * Actualiza las reglas del input de cantidad según la unidad:
 * - Unidades: step="1", solo enteros
 * - Kilogramos: step="any", decimales permitidos
 * @param {'unidades'|'kilogramos'} measureType
 */
export function updateQuantityInputRules(measureType) {
  const isKg = measureType === 'kilogramos' || measureType === 'kg';
  const qtyInput = document.getElementById('product-quantity');
  const unitBadge = document.getElementById('product-quantity-unit');
  const typeLabel = document.getElementById('product-quantity-type-label');
  const hintEl = document.getElementById('product-quantity-hint');

  if (qtyInput) {
    if (isKg) {
      qtyInput.step = 'any';
      qtyInput.inputMode = 'decimal';
      qtyInput.placeholder = 'Ej: 2.5 (permite decimales)';
    } else {
      qtyInput.step = '1';
      qtyInput.inputMode = 'numeric';
      qtyInput.placeholder = 'Ej: 10 (piezas enteras)';
      // Si el valor actual tenía decimales, truncar
      if (qtyInput.value && qtyInput.value.includes('.')) {
        qtyInput.value = Math.floor(Number(qtyInput.value));
      }
    }
  }

  if (unitBadge) {
    unitBadge.textContent = isKg ? 'Kg' : 'Uds';
  }

  if (typeLabel) {
    typeLabel.textContent = isKg ? 'Permite decimales (kg)' : 'Solo enteros (piezas)';
    typeLabel.className = isKg ? 'text-[11px] font-semibold text-sec-atend' : 'text-[11px] font-semibold text-sec-auto';
  }

  if (hintEl) {
    hintEl.textContent = isKg
      ? 'Para kilogramos puedes ingresar números con decimales (ej. 1.25, 3.5 kg).'
      : 'Para unidades se requieren números enteros sin decimales (ej. 1, 5, 20).';
  }
}

/**
 * Rellena los <datalist> del Catálogo Maestro para autocompletado nativo
 */
export function updateCatalogDatalists() {
  // Las sugerencias son las de la sección elegida en el formulario (o la sección activa)
  const formSection = document.getElementById('product-section')?.value;
  const catalog = store.getMasterCatalog(formSection || currentSection);
  const datalistNames = document.getElementById('catalogo-nombres');
  const datalistCodes = document.getElementById('catalogo-codigos');
  const datalistProviders = document.getElementById('catalogo-proveedores');

  if (datalistNames) {
    datalistNames.innerHTML = catalog.map(item => `
      <option value="${escapeHtml(item.name)}">${item.code ? `[${escapeHtml(item.code)}] ` : ''}${escapeHtml(item.provider || '')}</option>
    `).join('');
  }

  if (datalistCodes) {
    datalistCodes.innerHTML = catalog
      .filter(item => item.code)
      .map(item => `
        <option value="${escapeHtml(item.code)}">${escapeHtml(item.name)}</option>
      `).join('');
  }

  if (datalistProviders) {
    // Proveedores únicos del catálogo
    const providers = Array.from(new Set(
      catalog.map(item => (item.provider || '').trim()).filter(Boolean)
    ));
    // Agregar proveedores comunes si no están
    const defaultProviders = [
      'Frigorífico Central',
      'Avícola San Marcos',
      'Cabaña Porcina',
      'Frigorífico Pampeano',
      'Elaboración Propia',
      'Embutidos Artesanales',
      'Distribuidora La Pradera'
    ];
    defaultProviders.forEach(dp => {
      if (!providers.includes(dp)) providers.push(dp);
    });

    datalistProviders.innerHTML = providers.map(p => `
      <option value="${escapeHtml(p)}"></option>
    `).join('');
  }

  // Actualizar contador en ajustes
  const catalogCountEl = document.getElementById('master-catalog-count');
  if (catalogCountEl) {
    catalogCountEl.textContent = catalogCountText();
  }
}

function catalogCountText() {
  const all = store.getMasterCatalog();
  const aut = store.getMasterCatalog('autoservicio').length;
  return `${all.length} productos (Autoservicio: ${aut} | Atendida: ${all.length - aut})`;
}

/**
 * Intenta autocompletar el formulario buscando en el Catálogo Maestro
 * @param {string} value - Valor buscado
 * @param {'code'|'name'} source - Origen del input
 */
export function handleCatalogAutocomplete(value, source) {
  if (!value || value.length < 2) return;
  const matchHint = document.getElementById('catalog-match-hint');

  const formSection = document.getElementById('product-section')?.value || currentSection;
  let match = null;
  if (source === 'code') {
    match = store.findMasterCatalogByCode(value, formSection);
  } else if (source === 'name') {
    match = store.findMasterCatalogByName(value, formSection);
  }

  if (match) {
    const nameInput = document.getElementById('product-name');
    const codeInput = document.getElementById('product-code');
    const providerInput = document.getElementById('product-provider');
    if (source === 'code' && nameInput && !nameInput.value) {
      nameInput.value = match.name || '';
    }
    if (source === 'name' && codeInput && !codeInput.value && match.code) {
      codeInput.value = match.code;
    }
    if (providerInput && (!providerInput.value || providerInput.value === '')) {
      providerInput.value = match.provider || '';
    }

    if (match.measureType) {
      const isKg = match.measureType === 'kilogramos' || match.measureType === 'kg';
      document.querySelectorAll('input[name="measure"]').forEach(r => {
        r.checked = isKg ? r.value === 'kilogramos' : r.value === 'unidades';
      });
      updateQuantityInputRules(match.measureType);
    }

    // Actualizar badge de código
    updateCodeBadge(document.getElementById('product-code')?.value);

    if (matchHint) {
      matchHint.classList.remove('hidden');
      matchHint.textContent = `✓ Coincidencia: "${match.name}" (${match.provider || 'Sin proveedor'})`;
    }
  } else {
    if (matchHint) matchHint.classList.add('hidden');
  }
}

/**
 * Actualiza el indicador visual de PLU vs EAN en el input de código
 */
export function updateCodeBadge(code) {
  const badge = document.getElementById('product-code-type-badge');
  if (!badge) return;

  const info = store.formatCodeInfo(code);
  if (info.type === 'PLU') {
    badge.textContent = 'Tipo: PLU (1-6 dígitos)';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300';
  } else if (info.type === 'EAN') {
    badge.textContent = 'Tipo: EAN (Código Largo)';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300';
  } else {
    badge.textContent = '1-6: PLU | 7+: EAN';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-surface border border-accent/30 text-text-secondary';
  }
}

export function openAddProductForm(productId = null, mode = 'edit') {
  editingProductId = mode === 'new-batch' ? null : productId;
  const form = document.getElementById('product-form');
  const title = document.getElementById('add-product-title');
  const btnDelete = document.getElementById('btn-delete-product');
  const matchHint = document.getElementById('catalog-match-hint');
  if (matchHint) matchHint.classList.add('hidden');

  if (!form) return;

  updateCatalogDatalists();

  if (productId && mode === 'new-batch') {
    const parentProduct = store.getProduct(productId);
    if (!parentProduct) return;

    form.reset();
    if (btnDelete) btnDelete.classList.add('hidden');

    const batchInfo = store.getProductBatchInfo(parentProduct);
    const nextBatchNum = batchInfo.totalBatches + 1;

    if (title) title.textContent = `Nuevo Lote: ${parentProduct.name}`;

    document.getElementById('product-name').value = parentProduct.name || '';
    document.getElementById('product-code').value = parentProduct.plu || parentProduct.code || '';
    document.getElementById('product-provider').value = parentProduct.provider || parentProduct.proveedor || '';
    document.getElementById('product-section').value = parentProduct.section || currentSection;

    const loteInput = document.getElementById('product-lote');
    if (loteInput) loteInput.value = `Lote ${nextBatchNum}`;

    const notesInput = document.getElementById('product-notes');
    if (notesInput) notesInput.value = '';

    const qtyInput = document.getElementById('product-quantity');
    if (qtyInput) qtyInput.value = '';

    const dateInput = document.getElementById('product-expiry');
    if (dateInput) dateInput.value = '';

    const isKg = parentProduct.measureType === 'kilogramos' || parentProduct.measureType === 'kg';
    const measureRadios = form.querySelectorAll('input[name="measure"]');
    measureRadios.forEach(radio => {
      radio.checked = isKg ? radio.value === 'kilogramos' : radio.value === 'unidades';
    });

    updateQuantityInputRules(parentProduct.measureType);
    updateCodeBadge(parentProduct.plu || parentProduct.code);
  } else if (productId) {
    const product = store.getProduct(productId);
    if (!product) return;

    if (title) title.textContent = 'Editar Producto / Lote';
    if (btnDelete) btnDelete.classList.remove('hidden');

    document.getElementById('product-name').value = product.name || '';
    document.getElementById('product-code').value = product.plu || product.code || '';
    document.getElementById('product-provider').value = product.provider || product.proveedor || '';

    const loteInput = document.getElementById('product-lote');
    if (loteInput) loteInput.value = product.lote || product.batch || 'Lote 1';

    document.getElementById('product-expiry').value = product.expiryDate || '';
    document.getElementById('product-section').value = product.section || currentSection;
    document.getElementById('product-notes').value = product.notes || '';

    const cantidadVal = (product.cantidad !== undefined && product.cantidad !== null) ? product.cantidad : (product.quantity || '');
    const qtyInput = document.getElementById('product-quantity');
    if (qtyInput) qtyInput.value = cantidadVal;

    const isKg = product.measureType === 'kilogramos' || product.measureType === 'kg';
    const measureRadios = form.querySelectorAll('input[name="measure"]');
    measureRadios.forEach(radio => {
      radio.checked = isKg ? radio.value === 'kilogramos' : radio.value === 'unidades';
    });

    updateQuantityInputRules(product.measureType);
    updateCodeBadge(product.plu || product.code);
  } else {
    form.reset();
    if (title) title.textContent = 'Agregar Producto';
    if (btnDelete) btnDelete.classList.add('hidden');

    const qtyInput = document.getElementById('product-quantity');
    if (qtyInput) qtyInput.value = '';

    const loteInput = document.getElementById('product-lote');
    if (loteInput) loteInput.value = 'Lote 1';

    // Preseleccionar sección actual
    const sectionSelect = document.getElementById('product-section');
    if (sectionSelect) sectionSelect.value = currentSection;

    // Medida por defecto: Unidades
    const measureRadios = form.querySelectorAll('input[name="measure"]');
    measureRadios.forEach(radio => {
      radio.checked = radio.value === 'unidades';
    });
    updateQuantityInputRules('unidades');
    updateCodeBadge('');

    // Fecha por defecto: hoy + 3 días
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    const dateInput = document.getElementById('product-expiry');
    if (dateInput) {
      dateInput.value = store.toLocalDateStr(defaultDate);
    }
  }

  showView('view-add-product');
  setTimeout(() => {
    const focusEl = (productId && mode === 'new-batch')
      ? document.getElementById('product-expiry')
      : document.getElementById('product-name');
    if (focusEl) focusEl.focus();
  }, 100);
}

export function saveProductFromForm() {
  const name = document.getElementById('product-name').value.trim();
  const plu = document.getElementById('product-code').value.trim();
  const provider = document.getElementById('product-provider').value.trim();
  const lote = (document.getElementById('product-lote')?.value || '').trim();
  const expiryDate = document.getElementById('product-expiry').value;
  const section = document.getElementById('product-section').value;
  const notes = document.getElementById('product-notes').value.trim();
  const quantityRaw = document.getElementById('product-quantity').value;

  const selectedMeasure = document.querySelector('input[name="measure"]:checked');
  const measureType = selectedMeasure ? selectedMeasure.value : 'unidades';
  const isKg = measureType === 'kilogramos' || measureType === 'kg';

  // 1. Validar Nombre
  if (!name) {
    showToast('Ingresa el nombre del producto', 'warning');
    document.getElementById('product-name')?.focus();
    return false;
  }

  // 2. Validar Proveedor OBLIGATORIO
  if (!provider) {
    showToast('El campo Proveedor es obligatorio', 'warning');
    document.getElementById('product-provider')?.focus();
    return false;
  }

  // 3. Validar Fecha
  if (!expiryDate) {
    showToast('Selecciona la fecha de vencimiento', 'warning');
    document.getElementById('product-expiry')?.focus();
    return false;
  }

  // 4. Validar Campo OBLIGATORIO de Cantidad / Peso
  if (quantityRaw === '' || isNaN(Number(quantityRaw)) || Number(quantityRaw) <= 0) {
    showToast('El campo Cantidad / Peso es obligatorio y debe ser mayor a 0', 'warning');
    document.getElementById('product-quantity')?.focus();
    return false;
  }

  const cantidad = Number(quantityRaw);

  // Si es Unidades: rechazar decimales
  if (!isKg && !Number.isInteger(cantidad)) {
    showToast('Para Unidades debes ingresar números enteros (sin decimales)', 'warning');
    document.getElementById('product-quantity')?.focus();
    return false;
  }

  const productData = {
    name,
    plu,
    provider,
    proveedor: provider,
    lote,
    batch: lote,
    expiryDate,
    section,
    measureType,
    cantidad: cantidad,
    quantity: cantidad,
    notes
  };

  if (editingProductId) {
    store.updateProduct(editingProductId, productData);
    showToast('Lote de producto actualizado correctamente', 'success');
  } else {
    store.addProduct(productData);
    showToast('Lote de producto guardado en inventario', 'success');
  }

  // Actualizar datalists del catálogo maestro
  updateCatalogDatalists();

  // Cambiar a la sección del producto y mostrar inventario
  setSection(section);
  showView('view-inventory');
  return true;
}

// ============================================================
// CONFIRMACIÓN DE ELIMINACIÓN
// ============================================================

export function promptDeleteProduct(productId) {
  productToDeleteId = productId || editingProductId;
  if (!productToDeleteId) return;

  const product = store.getProduct(productToDeleteId);
  const modal = document.getElementById('modal-confirm-delete');
  const nameEl = document.getElementById('confirm-delete-name');
  const reasonEl = document.getElementById('confirm-delete-reason');
  const noteEl = document.getElementById('confirm-delete-note');

  if (nameEl && product) {
    nameEl.textContent = `¿Retirar "${product.name}" del inventario? Quedará anotado en Retiros y merma.`;
  }
  if (reasonEl && product) {
    reasonEl.value = store.getDaysUntilExpiry(product.expiryDate) <= 0 ? 'vencido' : 'rotacion';
  }
  if (noteEl) noteEl.value = '';

  if (modal) modal.classList.remove('hidden');
}

export function closeDeleteConfirm() {
  productToDeleteId = null;
  const modal = document.getElementById('modal-confirm-delete');
  if (modal) modal.classList.add('hidden');
}

export function executeDeleteProduct() {
  if (!productToDeleteId) return;
  const reason = document.getElementById('confirm-delete-reason')?.value || 'otro';
  const note = document.getElementById('confirm-delete-note')?.value || '';

  if (reason === 'error') {
    store.deleteProduct(productToDeleteId);
    showToast('Producto eliminado (sin registrar en merma)', 'info');
  } else {
    const record = store.withdrawProduct(productToDeleteId, reason, note);
    showToast(record ? `Retiro registrado: ${store.REMOVAL_REASONS[record.reason]}` : 'Producto eliminado', 'info');
  }

  closeDeleteConfirm();
  updateAlertBadge();
  showView('view-inventory');
}

// ============================================================
// ESCÁNER DE CÓDIGO DE BARRAS
// ============================================================

export async function openScanner() {
  const modal = document.getElementById('modal-scanner');
  const video = document.getElementById('scanner-video');
  const statusEl = document.getElementById('scanner-status');

  if (!modal || !video) return;

  modal.classList.remove('hidden');
  if (statusEl) statusEl.textContent = 'Iniciando cámara...';

  try {
    await scanner.startScanner(video, (code) => {
      const codeInput = document.getElementById('product-code');
      if (codeInput) {
        codeInput.value = code;
        updateCodeBadge(code);
        handleCatalogAutocomplete(code, 'code');
      }
      closeScanner();
      const codeInfo = store.formatCodeInfo(code);
      showToast(`${codeInfo.label || 'Código'} capturado`, 'success');

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    });
    if (statusEl) statusEl.textContent = 'Apunte la cámara al código de barras';
  } catch (err) {
    console.error('Error al abrir scanner:', err);
    closeScanner();
    showToast('No se pudo acceder a la cámara. Ingrese el código manualmente.', 'error');
  }
}

export function closeScanner() {
  scanner.stopScanner();
  const modal = document.getElementById('modal-scanner');
  if (modal) modal.classList.add('hidden');
}

// ============================================================
// MÓDULO DE PEDIR PRECIOS & FESTIVOS
// ============================================================

export function renderPedirPrecios() {
  updatePedirTabs(currentSection);
  const settings = store.getSettings();
  const today = new Date();
  const todayStr = store.toLocalDateStr(today);
  const isTodayPriceDay = store.isPriceRequestDay(today, settings.mondayHoliday);

  // 1. Encabezado de fecha y estado de pedido
  const dayNameEl = document.getElementById('pedir-day-name');
  const dayStatusEl = document.getElementById('pedir-day-status');
  const dayBadgeEl = document.getElementById('pedir-day-badge');
  const toggleHoliday = document.getElementById('toggle-holiday');

  if (toggleHoliday) {
    toggleHoliday.checked = !!settings.mondayHoliday;
  }

  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayName = daysOfWeek[today.getDay()];

  if (dayNameEl) {
    dayNameEl.textContent = `${dayName}, ${formatDateDisplay(todayStr)}`;
  }

  if (dayStatusEl && dayBadgeEl) {
    if (isTodayPriceDay) {
      dayStatusEl.textContent = 'Día programado para solicitud de precios';
      dayBadgeEl.textContent = '¡Día de Pedir!';
      dayBadgeEl.className = 'text-xs font-bold px-3 py-1.5 rounded-full bg-exp-green/20 text-exp-green border border-exp-green/30';
    } else {
      const nextDate = store.getNextPriceRequestDay(today, settings.mondayHoliday);
      const nextDayName = daysOfWeek[nextDate.getDay()];
      dayStatusEl.textContent = `Próximo pedido: ${nextDayName} (${formatDateDisplay(store.toLocalDateStr(nextDate))})`;
      dayBadgeEl.textContent = 'No programado';
      dayBadgeEl.className = 'text-xs font-bold px-3 py-1.5 rounded-full bg-accent/30 text-text-secondary border border-accent/40';
    }
  }

  // 1.1 Estado del badge de Modo Simulación
  const simBadge = document.getElementById('simulation-badge');
  if (simBadge) {
    if (store.isSimulationActive()) {
      simBadge.textContent = '● Simulación Activa';
      simBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold animate-pulse';
    } else {
      simBadge.textContent = 'Pruebas Rápidas';
      simBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30';
    }
  }

  // 2. Filtrado de productos para pedir
  const container = document.getElementById('pedir-product-list');
  const emptyState = document.getElementById('pedir-empty');
  if (!container) return;

  const filterSinPrecio = document.getElementById('filter-sin-precio');
  const onlySinPrecio = filterSinPrecio ? filterSinPrecio.checked : false;

  // Productos con <= 6 días de vencimiento
  let products = store.getProductsNeedingPrices(currentSection);

  // Obtener solicitudes registradas hoy
  const todayRequests = store.getPriceRequests(todayStr);

  // Obtener solicitudes registradas ayer
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = store.toLocalDateStr(yesterday);
  const yesterdayRequests = store.getPriceRequests(yesterdayStr);

  // Si el filtro "Sin precio del día anterior" está activo:
  // Mostrar productos que ayer NO se les dio precio
  if (onlySinPrecio) {
    products = products.filter(p => {
      const yReq = yesterdayRequests.find(r => r.productId === p.id);
      return !yReq || !yReq.priceGiven;
    });
  }

  if (products.length === 0) {
    container.innerHTML = '';
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
  }

  container.innerHTML = products.map(p => {
    const days = store.getDaysUntilExpiry(p.expiryDate);
    const alertLevel = store.getAlertLevel(days);
    const req = todayRequests.find(r => r.productId === p.id);
    const quantity = req ? req.quantity : '';
    const isRequested = req ? req.priceRequested : false;

    // Comprobar si ayer no se le dio precio
    const yReq = yesterdayRequests.find(r => r.productId === p.id);
    const sinPrecioAyer = !yReq || !yReq.priceGiven;

    const alertBadges = {
      ok: 'bg-exp-green/20 text-exp-green border-exp-green/30',
      warning: 'bg-exp-yellow/20 text-exp-yellow border-exp-yellow/30',
      urgent: 'bg-exp-orange/20 text-exp-orange border-exp-orange/30',
      critical: 'bg-exp-red/20 text-exp-red border-exp-red/30'
    };
    const badgeClass = alertBadges[alertLevel] || alertBadges.warning;

    const activeUnit = (req && req.unit) ? req.unit : (p.measureType || 'kilogramos');
    const isKg = activeUnit === 'kilogramos' || activeUnit === 'kg';
    const unitLabel = isKg ? 'kg' : 'und';
    const stepVal = isKg ? 'any' : '1';
    const prodUnit = (p.measureType === 'kilogramos' || p.measureType === 'kg') ? 'kg' : 'und';
    const stockActual = (p.cantidad !== undefined && p.cantidad !== null) ? p.cantidad : (p.quantity || 0);

    // Diferenciación inteligente PLU / EAN
    const codeInfo = store.formatCodeInfo(p.plu || p.code);
    let codeBadge = '';
    if (codeInfo.type === 'PLU') {
      codeBadge = `<span class="font-mono text-[11px] font-bold text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded">PLU: ${escapeHtml(codeInfo.code)}</span>`;
    } else if (codeInfo.type === 'EAN') {
      codeBadge = `<span class="font-mono text-[11px] font-bold text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded">EAN: ${escapeHtml(codeInfo.code)}</span>`;
    }

    const isAuto = p.section === 'autoservicio';
    const secBadge = isAuto
      ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">🛒 Autoservicio</span>`
      : `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">🥩 Atendida</span>`;

    return `
      <div class="pedir-card bg-surface-light rounded-xl p-4 border border-accent/20 shadow-md" data-product-id="${p.id}">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1 min-w-0 pr-2">
            <div class="flex items-center gap-1.5 mb-1">
              ${secBadge}
              ${codeBadge}
            </div>
            <h3 class="font-bold text-sm text-white truncate">${escapeHtml(p.name)}</h3>
            <p class="text-xs text-text-secondary mt-1 flex items-center gap-2">
              <span>Existencia: <strong class="text-white">${stockActual} ${prodUnit}</strong></span>
              ${sinPrecioAyer ? '<span class="text-exp-red font-bold">⚠️ Sin precio ayer</span>' : ''}
            </p>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full font-bold border ${badgeClass}">
            ${days <= 0 ? 'Vence HOY' : `${days} días`}
          </span>
        </div>

        <div class="flex items-center gap-3 mt-3 pt-3 border-t border-accent/20">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <label class="text-xs text-text-secondary font-medium mr-1 flex-shrink-0">Cantidad:</label>
            <input
              type="number"
              step="${stepVal}"
              min="0"
              placeholder="${stockActual}"
              value="${quantity !== undefined && quantity !== null ? quantity : ''}"
              data-product-id="${p.id}"
              class="pedir-quantity w-20 sm:w-24 bg-surface rounded-lg px-2.5 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-action/50 border border-accent/30 font-semibold"
            >
            <!-- Selector interactivo de unidad de medida (Kilogramos kg vs Unidades und según naturaleza del producto) -->
            <select
              data-product-id="${p.id}"
              class="pedir-unit-select bg-surface rounded-lg px-2 py-2 text-xs font-extrabold text-white border border-accent/40 focus:outline-none focus:ring-2 focus:ring-action/50 cursor-pointer shadow-sm hover:border-accent transition-colors"
              title="Selecciona la unidad de medida para el pedido: Kilogramos (kg) o Unidades (und)"
              aria-label="Unidad de medida del pedido">
              <option value="kilogramos" ${isKg ? 'selected' : ''}>kg</option>
              <option value="unidades" ${!isKg ? 'selected' : ''}>und</option>
            </select>
          </div>

          <label class="flex items-center gap-2 cursor-pointer bg-surface/70 px-3.5 py-2 rounded-lg border border-accent/30 active:scale-95 transition-transform flex-shrink-0">
            <input
              type="checkbox"
              data-product-id="${p.id}"
              ${isRequested ? 'checked' : ''}
              class="pedir-checkbox w-4 h-4 rounded bg-surface border-accent/40 text-action accent-action focus:ring-action/50"
            >
            <span class="text-xs font-bold ${isRequested ? 'text-exp-green' : 'text-text-secondary'}">
              ${isRequested ? '✓ Precio Pedido' : 'Marcar Pedido'}
            </span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Actualizar conteo de alertas prioritarias en la campana
  updateAlertBadge();
}

/**
 * Gestiona el cambio dinámico de la unidad de medida (kg / und) en el módulo de precios
 * @param {string} productId
 * @param {string} newUnit
 */
export function handlePedirUnitChange(productId, newUnit) {
  const todayStr = store.toLocalDateStr(new Date());
  const todayRequests = store.getPriceRequests(todayStr);
  const existing = todayRequests.find(r => r.productId === productId);

  const cleanUnit = (newUnit === 'kilogramos' || newUnit === 'kg') ? 'kilogramos' : 'unidades';

  if (existing) {
    store.updatePriceRequest(existing.id, { unit: cleanUnit });
  } else {
    store.savePriceRequest({
      productId,
      date: todayStr,
      quantity: 0,
      unit: cleanUnit,
      priceRequested: false,
      priceGiven: false
    });
  }

  // Actualizar las reglas del input de cantidad en la tarjeta del producto
  const card = document.querySelector(`.pedir-card[data-product-id="${productId}"]`);
  if (card) {
    const qtyInput = card.querySelector('.pedir-quantity');
    if (qtyInput) {
      const isKg = cleanUnit === 'kilogramos';
      qtyInput.step = isKg ? 'any' : '1';
      qtyInput.inputMode = isKg ? 'decimal' : 'numeric';
      if (!isKg && qtyInput.value && qtyInput.value.includes('.')) {
        qtyInput.value = Math.floor(Number(qtyInput.value));
        handlePedirQuantityChange(productId, qtyInput.value);
      }
    }
  }

  showToast(cleanUnit === 'kilogramos' ? 'Unidad de pedido: Kilogramos (kg)' : 'Unidad de pedido: Unidades (und)', 'info');
}

export function handlePedirQuantityChange(productId, quantityVal) {
  const todayStr = store.toLocalDateStr(new Date());
  const todayRequests = store.getPriceRequests(todayStr);
  const existing = todayRequests.find(r => r.productId === productId);
  const card = document.querySelector(`.pedir-card[data-product-id="${productId}"]`);
  const unitSelect = card?.querySelector('.pedir-unit-select');
  const product = store.getProduct(productId);
  const unit = unitSelect ? unitSelect.value : (existing?.unit || product?.measureType || 'kilogramos');

  if (existing) {
    store.updatePriceRequest(existing.id, { quantity: Number(quantityVal) || 0, unit });
  } else {
    store.savePriceRequest({
      productId,
      date: todayStr,
      quantity: Number(quantityVal) || 0,
      unit,
      priceRequested: false,
      priceGiven: false
    });
  }
}

export function handlePedirStatusChange(productId, isRequested) {
  const todayStr = store.toLocalDateStr(new Date());
  const todayRequests = store.getPriceRequests(todayStr);
  const existing = todayRequests.find(r => r.productId === productId);
  const card = document.querySelector(`.pedir-card[data-product-id="${productId}"]`);
  const unitSelect = card?.querySelector('.pedir-unit-select');
  const product = store.getProduct(productId);
  const unit = unitSelect ? unitSelect.value : (existing?.unit || product?.measureType || 'kilogramos');

  if (existing) {
    store.updatePriceRequest(existing.id, { priceRequested: isRequested, unit });
  } else {
    store.savePriceRequest({
      productId,
      date: todayStr,
      quantity: 0,
      unit,
      priceRequested: isRequested,
      priceGiven: false
    });
  }

  showToast(isRequested ? 'Precio marcado como pedido' : 'Precio desmarcado', 'info');
  renderPedirPrecios();
}

export function generateAndShareReport() {
  const today = new Date();
  const todayStr = store.toLocalDateStr(today);
  const products = store.getProductsNeedingPrices(currentSection);
  const requests = store.getPriceRequests(todayStr);

  if (products.length === 0) {
    showToast('No hay productos próximos a vencer para reportar', 'info');
    return;
  }

  let reportText = `🥩 *ROTADOR - PEDIDO DE PRECIOS*\n`;
  reportText += `📅 Fecha: ${formatDateDisplay(todayStr)}\n\n`;

  const sections = [currentSection];

  sections.forEach(sec => {
    const secProducts = products.filter(p => p.section === sec);
    if (secProducts.length > 0) {
      reportText += `📌 *${sec.toUpperCase()}*:\n`;
      secProducts.forEach((p, index) => {
        const days = store.getDaysUntilExpiry(p.expiryDate);
        const req = requests.find(r => r.productId === p.id);
        const stock = (p.cantidad !== undefined && p.cantidad !== null) ? p.cantidad : (p.quantity || '0');
        const qtyToOrder = (req && req.quantity !== undefined && req.quantity !== null && req.quantity !== '') ? req.quantity : stock;
        const reqUnit = (req && req.unit)
          ? (req.unit === 'kilogramos' || req.unit === 'kg' ? 'kg' : 'und')
          : (p.measureType === 'kilogramos' || p.measureType === 'kg' ? 'kg' : 'und');
        const prodUnit = (p.measureType === 'kilogramos' || p.measureType === 'kg') ? 'kg' : 'und';
        const status = req && req.priceRequested ? '✅ PEDIDO' : '⏳ PENDIENTE';

        const codeInfo = store.formatCodeInfo(p.plu || p.code);
        const codeText = codeInfo.code ? `[${codeInfo.type || 'COD'}: ${codeInfo.code}]` : '';

        reportText += `${index + 1}. ${p.name} ${codeText}\n`;
        reportText += `   Stock: ${stock} ${prodUnit} | Cantidad a pedir: ${qtyToOrder} ${reqUnit} | Vence en ${days}d -> ${status}\n`;
        if (p.provider || p.proveedor) {
          reportText += `   Proveedor: ${p.provider || p.proveedor}\n`;
        }
      });
      reportText += '\n';
    }
  });

  if (navigator.share) {
    navigator.share({
      title: 'Pedido de Precios - Rotador',
      text: reportText
    }).catch(() => {
      copyToClipboard(reportText);
    });
  } else {
    copyToClipboard(reportText);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Reporte copiado al portapapeles', 'success');
    }).catch(() => {
      showToast('No se pudo copiar el reporte', 'error');
    });
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Reporte copiado al portapapeles', 'success');
  }
}

// ============================================================
// EXPORTACIÓN A PDF (PEDIDO DE PRECIOS)
// ============================================================

/**
 * Genera y descarga el Reporte Oficial en PDF de los productos
 * a los que se les pidió precio, con los campos exactos requeridos:
 * - Nombre del Producto
 * - PLU o EAN (según aplique)
 * - Fecha de Vencimiento
 * - Cantidad (ingresada manualmente al pedir)
 * - Proveedor
 */
export async function generatePDFReport(options = { share: false }) {
  const today = new Date();
  const todayStr = store.toLocalDateStr(today);
  const settings = store.getSettings();
  const allProducts = store.getAllProducts();
  const requests = store.getPriceRequests(todayStr);

  // Criterio estricto de rotación: Únicamente productos cuya fecha/días restantes sean de 5 a 7 días o menos (≤ 7 días)
  const productsWith7DaysOrLess = store.getProductsNeedingPrices(currentSection);

  if (productsWith7DaysOrLess.length === 0) {
    showToast('No hay productos con 7 días o menos de vencimiento para generar el reporte.', 'info');
    return;
  }

  // Filtrar productos: Si hay productos con precio pedido explícito, priorizarlos (que cumplan ≤ 7 días)
  const markedRequests = requests.filter(r => r.priceRequested);
  let itemsToReport = [];

  if (markedRequests.length > 0) {
    markedRequests.forEach(req => {
      const p = allProducts.find(prod => prod.id === req.productId);
      if (p && store.normalizeSection(p.section) === currentSection) {
        const days = store.getDaysUntilExpiry(p.expiryDate);
        if (days <= 7) {
          itemsToReport.push({
            product: p,
            request: req,
            cantidadPedida: (req.quantity !== undefined && req.quantity !== null && req.quantity !== '')
              ? Number(req.quantity)
              : (p.cantidad || 0),
            days
          });
        }
      }
    });
  }

  // Si no se marcó ninguno explícitamente, incluir todos los productos filtrados con ≤ 7 días
  if (itemsToReport.length === 0) {
    itemsToReport = productsWith7DaysOrLess.map(p => {
      const req = requests.find(r => r.productId === p.id);
      return {
        product: p,
        request: req,
        cantidadPedida: (req && req.quantity !== undefined && req.quantity !== null && req.quantity !== '')
          ? Number(req.quantity)
          : (p.cantidad || 0),
        days: store.getDaysUntilExpiry(p.expiryDate)
      };
    });
  }

  // Ordenar productos: por días restantes (urgentes y de retiro primero) y luego por nombre
  itemsToReport.sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days;
    return (a.product.name || '').localeCompare(b.product.name || '');
  });

  const formattedDate = formatDateDisplay(todayStr);

  // Comprobar si jsPDF está disponible
  const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : null;

  if (jsPDFClass) {
    try {
      const doc = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Encabezado corporativo oscuro
      doc.setFillColor(26, 26, 46); // #1a1a2e
      doc.rect(0, 0, 210, 32, 'F');

      // Título principal
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('ROTADOR - CONTROL DE VENCIMIENTOS', 14, 13);

      // Subtítulo en rojo carnicero
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(233, 69, 96); // #e94560
      doc.text('REPORTE OFICIAL DE PRECIOS Y ROTACIÓN (PRODUCTOS ≤ 7 DÍAS)', 14, 20);

      // Metadatos
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 180, 195);
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayNames[today.getDay()];
      const ruleText = settings.mondayHoliday ? 'Corte: Martes (Festivo activado)' : 'Corte: Lunes / Jueves';
      doc.text(`Fecha: ${dayName}, ${formattedDate}  |  ${ruleText}  |  Total Ítems: ${itemsToReport.length}`, 14, 27);

      // Construir filas de la tabla con las columnas clave requeridas:
      // PLU, Nombre del Producto, Sección, Existencia, Días Restantes (+ F. Vencimiento y Proveedor)
      const tableRows = itemsToReport.map((item, index) => {
        const p = item.product;
        const reqUnit = (item.request && item.request.unit)
          ? (item.request.unit === 'kilogramos' || item.request.unit === 'kg' ? 'kg' : 'und')
          : (p.measureType === 'kilogramos' || p.measureType === 'kg' ? 'kg' : 'und');
        const prodUnit = (p.measureType === 'kilogramos' || p.measureType === 'kg') ? 'kg' : 'und';

        const codeInfo = store.formatCodeInfo(p.plu || p.code);
        const pluText = codeInfo.type ? `${codeInfo.type}: ${codeInfo.code}` : 'Sin código';
        const nombre = p.name || 'Sin nombre';
        const seccion = p.section === 'autoservicio' ? 'Autoservicio' : 'Atendida';
        const existencia = (item.request && item.request.quantity)
          ? `${p.cantidad || 0} ${prodUnit} (Pedir: ${item.cantidadPedida} ${reqUnit})`
          : `${p.cantidad || 0} ${prodUnit}`;

        let diasText = '';
        if (item.days < 0) diasText = `Vencido (${Math.abs(item.days)}d)`;
        else if (item.days === 0) diasText = 'Vence HOY (Retirar)';
        else if (item.days === 1) diasText = '1 día (Retirar)';
        else if (item.days === 2) diasText = '2 días (Crítico/Retiro)';
        else if (item.days <= 4) diasText = `${item.days} días (Urgente)`;
        else diasText = `${item.days} días (Pedir Precios)`;

        const fechaVenc = formatDateDisplay(p.expiryDate);
        const proveedor = (p.provider || p.proveedor || 'Sin proveedor').trim();

        return [
          index + 1,
          pluText,
          nombre,
          seccion,
          existencia,
          diasText,
          fechaVenc,
          proveedor
        ];
      });

      // Generar tabla profesional con AutoTable
      doc.autoTable({
        startY: 36,
        head: [['#', 'PLU / EAN', 'Nombre del Producto', 'Sección', 'Existencia', 'Días Restantes', 'F. Venc.', 'Proveedor']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [233, 69, 96], // #e94560
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left'
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: 'middle',
          textColor: [40, 40, 40]
        },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' },
          1: { cellWidth: 25, font: 'courier', fontStyle: 'bold' }, // PLU / EAN
          2: { fontStyle: 'bold', cellWidth: 42 },                 // Nombre
          3: { cellWidth: 22, fontSize: 7 },                       // Sección
          4: { cellWidth: 22, fontStyle: 'bold', halign: 'right' }, // Existencia
          5: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }, // Días Restantes
          6: { cellWidth: 20, halign: 'center' },                  // F. Venc
          7: { cellWidth: 24 }                                     // Proveedor
        },
        alternateRowStyles: {
          fillColor: [248, 249, 251]
        },
        didDrawPage: function (data) {
          // Pie de página
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(140, 140, 140);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 8);
          doc.text('Rotador - Sistema de Control de Vencimientos y Precios', doc.internal.pageSize.width - 90, doc.internal.pageSize.height - 8);
        }
      });

      const fileName = `Reporte_Precios_Pedidos_${todayStr}.pdf`;

      if (options && options.share) {
        try {
          const pdfBlob = doc.output('blob');
          const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

          if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
              title: 'Reporte de Precios - Rotador',
              text: `Reporte de productos con 7 días o menos (${formattedDate})`,
              files: [pdfFile]
            });
            showToast('Reporte PDF compartido exitosamente', 'success');
            return;
          }
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return; // Cancelado por usuario
          console.warn('No se pudo compartir archivo directamente:', shareErr);
        }
      }

      // Descarga directa del PDF
      doc.save(fileName);
      showToast('PDF generado y descargado exitosamente', 'success');
      return;
    } catch (err) {
      console.error('Error generando jsPDF:', err);
    }
  }

  // Fallback si jsPDF no estuviese cargado por falta de red
  printPDFReportFallback(itemsToReport, formattedDate);
}

/**
 * Comparte el reporte en PDF mediante la Web Share API nativa (WhatsApp, Email, etc.)
 */
export async function sharePDFReport() {
  await generatePDFReport({ share: true });
}

/**
 * Fallback de impresión nativa en caso de que jsPDF falle
 */
function printPDFReportFallback(requestedItems, formattedDate) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Habilita las ventanas emergentes para exportar el reporte', 'warning');
    return;
  }

  const rowsHtml = requestedItems.map((item, index) => {
    const p = item.product;
    const reqUnit = (item.request && item.request.unit)
      ? (item.request.unit === 'kilogramos' || item.request.unit === 'kg' ? 'kg' : 'und')
      : (p.measureType === 'kilogramos' || p.measureType === 'kg' ? 'kg' : 'und');
    const prodUnit = (p.measureType === 'kilogramos' || p.measureType === 'kg') ? 'kg' : 'und';
    const codeInfo = store.formatCodeInfo(p.plu || p.code);
    const codeText = codeInfo.type ? `${codeInfo.type}: ${codeInfo.code}` : 'Sin código';

    let diasText = '';
    if (item.days < 0) diasText = `Vencido (${Math.abs(item.days)}d)`;
    else if (item.days === 0) diasText = 'Vence HOY (Retirar)';
    else if (item.days === 1) diasText = '1 día (Retirar)';
    else if (item.days === 2) diasText = '2 días (Crítico/Retiro)';
    else if (item.days <= 4) diasText = `${item.days} días (Urgente)`;
    else diasText = `${item.days} días (Pedir Precios)`;

    const cantDisplay = (item.request && item.request.quantity)
      ? `${p.cantidad || 0} ${prodUnit} (Pedir: ${item.cantidadPedida} ${reqUnit})`
      : `${p.cantidad || 0} ${prodUnit}`;

    return `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td><code>${escapeHtml(codeText)}</code></td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${p.section === 'autoservicio' ? 'Autoservicio' : 'Atendida'}</td>
        <td style="text-align:right;"><strong>${cantDisplay}</strong></td>
        <td style="text-align:center;">${diasText}</td>
        <td style="text-align:center;">${formatDateDisplay(p.expiryDate)}</td>
        <td>${escapeHtml(p.provider || p.proveedor || 'Sin proveedor')}</td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reporte de Precios - Rotador</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
        h1 { color: #1a1a2e; margin-bottom: 2px; }
        h2 { color: #e94560; margin-top: 0; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 7px; }
        th { background: #e94560; color: white; text-align: left; }
        tr:nth-child(even) { background: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>🥩 ROTADOR - CONTROL DE VENCIMIENTOS</h1>
      <h2>REPORTE OFICIAL DE PRECIOS Y ROTACIÓN (PRODUCTOS ≤ 7 DÍAS) (${formattedDate})</h2>
      <p style="font-size: 12px; color: #666;">Total ítems: ${requestedItems.length}</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>PLU / EAN</th>
            <th>Nombre del Producto</th>
            <th>Sección</th>
            <th>Existencia</th>
            <th>Días Restantes</th>
            <th>F. Vencimiento</th>
            <th>Proveedor</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ============================================================
// MODAL: CATÁLOGO MAESTRO
// ============================================================

export function openCatalogModal() {
  const modal = document.getElementById('modal-catalog');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderCatalogModalList('');
}

export function closeCatalogModal() {
  const modal = document.getElementById('modal-catalog');
  if (modal) modal.classList.add('hidden');
}

export function renderCatalogModalList(searchFilter = '') {
  const container = document.getElementById('catalog-modal-list');
  if (!container) return;

  const catalog = store.getMasterCatalog();
  const filter = (searchFilter || '').toLowerCase().trim();

  const filtered = catalog.filter(item => {
    if (!filter) return true;
    return (item.name || '').toLowerCase().includes(filter) ||
      (item.code || '').toLowerCase().includes(filter) ||
      (item.provider || '').toLowerCase().includes(filter);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-text-secondary text-sm">
        No se encontraron productos en el catálogo maestro
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const codeInfo = store.formatCodeInfo(item.code);
    let codeBadge = '';
    if (codeInfo.type === 'PLU') {
      codeBadge = `<span class="font-mono text-[10px] font-bold text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/30">PLU: ${escapeHtml(codeInfo.code)}</span>`;
    } else if (codeInfo.type === 'EAN') {
      codeBadge = `<span class="font-mono text-[10px] font-bold text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">EAN: ${escapeHtml(codeInfo.code)}</span>`;
    }

    const isKg = item.measureType === 'kilogramos' || item.measureType === 'kg';

    return `
      <div class="p-3 bg-surface rounded-xl border border-accent/20 flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-xs font-bold text-white truncate">${escapeHtml(item.name)}</span>
            ${codeBadge}
          </div>
          <p class="text-[11px] text-text-secondary truncate">
            🏭 ${escapeHtml(item.provider || 'Sin proveedor')} · <span class="text-text-primary">${isKg ? 'Kilogramos' : 'Unidades'}</span>
          </p>
        </div>
        <button class="btn-use-catalog-item px-2.5 py-1 rounded bg-accent/40 hover:bg-accent text-white text-xs font-semibold border border-accent/50"
          data-name="${escapeHtml(item.name)}" data-code="${escapeHtml(item.code || '')}" data-provider="${escapeHtml(item.provider || '')}" data-measure="${item.measureType || 'unidades'}" data-section="${item.section || 'autoservicio'}">
          Usar
        </button>
      </div>
    `;
  }).join('');
}

// ============================================================
// CONFIGURACIÓN Y RESPALDO
// ============================================================

export function renderSettings() {
  const products = store.getAllProducts();
  const countEl = document.getElementById('settings-product-count');
  if (countEl) {
    const autoCount = products.filter(p => p.section === 'autoservicio').length;
    const atendidaCount = products.filter(p => p.section === 'atendida').length;
    countEl.textContent = `Productos almacenados: ${products.length} (Autoservicio: ${autoCount} | Atendida: ${atendidaCount})`;
  }

  const catalogCountEl = document.getElementById('master-catalog-count');
  if (catalogCountEl) catalogCountEl.textContent = catalogCountText();

  // Respaldo
  const backupEl = document.getElementById('backup-status-text');
  if (backupEl) {
    const st = store.getBackupStatus();
    let text = '⚠️ Aún no has hecho ningún respaldo';
    if (st.daysSince !== null) {
      text = st.daysSince === 0 ? '✓ Último respaldo: hoy' : `Último respaldo: hace ${st.daysSince} día(s)`;
    }
    backupEl.textContent = text;
    backupEl.className = 'text-xs font-medium ' + (st.needsReminder ? 'text-exp-orange' : 'text-exp-green');
  }

  const persistEl = document.getElementById('storage-persist-text');
  if (persistEl) {
    persistEl.textContent = store.getSettings().storagePersisted
      ? '✓ El navegador protege estos datos contra borrado automático'
      : 'El navegador podría borrar los datos si le falta espacio: descarga respaldos con frecuencia';
  }

  // Avisos
  const notifOn = !!store.getSettings().notificationsEnabled && ('Notification' in window) && Notification.permission === 'granted';
  const notifText = document.getElementById('notif-status-text');
  const notifBtn = document.getElementById('btn-toggle-notifications');
  if (notifText) {
    notifText.textContent = !('Notification' in window)
      ? 'Este navegador no admite notificaciones'
      : (notifOn ? '✓ Activado' : (Notification.permission === 'denied' ? 'Bloqueado en el navegador' : 'Desactivado'));
  }
  if (notifBtn) notifBtn.textContent = notifOn ? 'Desactivar' : 'Activar';

  // Resumen de retiros (30 días)
  const remEl = document.getElementById('removals-summary-text');
  if (remEl) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = store.toLocalDateStr(cutoff);
    const recent = store.getRemovals().filter(r => r.date >= cutoffStr);
    const aut = recent.filter(r => r.section === 'autoservicio').length;
    remEl.textContent = recent.length > 0
      ? `Últimos 30 días: ${recent.length} retiros (Autoservicio: ${aut} | Atendida: ${recent.length - aut})`
      : 'Consulta lo retirado por sección, motivo y proveedor';
  }
}

export function exportBackup() {
  const data = store.exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = store.toLocalDateStr(new Date());
  a.href = url;
  a.download = `rotador-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  store.markBackupDone();
  renderSettings();
  showToast('Respaldo descargado exitosamente', 'success');
}

/**
 * Comparte la base de datos completa mediante Web Share API o descarga directa
 */
export async function shareDatabaseBackup() {
  const data = store.exportData();
  const dateStr = store.toLocalDateStr(new Date());
  const fileName = `rotador-backup-${dateStr}.json`;

  try {
    const blob = new Blob([data], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Copia de Seguridad - Rotador',
        text: `Respaldo de base de datos local de Rotador (${dateStr})`,
        files: [file]
      });
      store.markBackupDone();
      renderSettings();
      showToast('Copia de seguridad compartida exitosamente', 'success');
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('Error al compartir archivo JSON:', err);
  }

  // Fallback a descarga si el navegador no soporta compartir archivos
  exportBackup();
}

/**
 * Solicita confirmación y vacía por completo el almacenamiento local
 */
export async function promptClearAllData() {
  const confirmed = window.confirm(
    '¿Estás seguro de que deseas vaciar toda la base de datos?\n\n' +
    'Se eliminarán todos los productos, retiros, solicitudes de precio y catálogos en este dispositivo (IndexedDB y LocalStorage).\n' +
    'La app iniciará completamente limpia.'
  );

  if (confirmed) {
    await store.clearAllData();
    updateCatalogDatalists();
    renderProductList();
    renderPedirPrecios();
    renderSettings();
    updateAlertBadge();
    showToast('Almacenamiento vaciado. La app está 100% limpia.', 'info');
  }
}

// ============================================================
// ACCIONES DE SIMULACIÓN Y TESTING RÁPIDO
// ============================================================

export function handleRunSimulation() {
  const created = store.loadSimulationScenario();
  renderPedirPrecios();
  renderProductList();
  updateAlertBadge();
  showToast(`¡Simulación activada! Se cargaron ${created.length} productos y 4 precios pedidos`, 'success');
}

export function handleClearSimulation() {
  const removedCount = store.clearSimulationScenario();
  renderPedirPrecios();
  renderProductList();
  updateAlertBadge();
  if (removedCount > 0) {
    showToast(`Simulación finalizada (${removedCount} productos de prueba eliminados)`, 'info');
  } else {
    showToast('No había productos de simulación activos', 'info');
  }
}

export function importBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      store.importData(e.target.result);
      showToast('Datos restaurados correctamente', 'success');
      updateCatalogDatalists();
      renderProductList();
      renderSettings();
    } catch (err) {
      console.error(err);
      showToast('Error al importar el archivo JSON', 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

let toastTimeout = null;

export function showToast(message, type = 'info') {
  const toastEl = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  if (!toastEl || !toastMsg) return;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const iconColors = {
    success: 'text-exp-green',
    error: 'text-exp-red',
    warning: 'text-exp-yellow',
    info: 'text-action'
  };

  if (toastIcon) {
    toastIcon.textContent = icons[type] || 'ℹ';
    toastIcon.className = `text-lg font-bold ${iconColors[type] || 'text-white'}`;
  }

  toastMsg.textContent = message;
  toastEl.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

// ============================================================
// HELPERS
// ============================================================

function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// SISTEMA DE ALERTAS Y NOTIFICACIONES DE PRODUCTOS PRIORITARIOS
// ============================================================

export function updateAlertBadge() {
  const badge = document.getElementById('badge-alerts-count');
  if (!badge) return;
  const urgentItems = store.getPriorityProducts(currentSection);
  const count = urgentItems.length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

export function showPriorityAlertsModal() {
  const modal = document.getElementById('modal-priority-alerts');
  if (!modal) return;
  renderPriorityAlertsList();
  modal.classList.remove('hidden');
}

export function closePriorityAlertsModal() {
  const modal = document.getElementById('modal-priority-alerts');
  if (modal) modal.classList.add('hidden');
}

export function renderPriorityAlertsList() {
  const list = document.getElementById('priority-alerts-list');
  const subtitle = document.getElementById('priority-alerts-subtitle');
  if (!list) return;

  const urgentItems = store.getPriorityProducts(currentSection);
  const otherSection = currentSection === 'autoservicio' ? 'atendida' : 'autoservicio';
  const otherCount = store.getPriorityProducts(otherSection).length;
  const otherLabel = otherSection === 'autoservicio' ? '🛒 Autoservicio' : '🥩 Atendida';
  const banner = otherCount > 0
    ? `<button type="button" data-switch-section="${otherSection}" class="w-full text-left text-[11px] px-3 py-2 rounded-lg bg-exp-orange/15 text-exp-orange border border-exp-orange/30 font-semibold active:scale-[0.98]">${otherLabel} tiene ${otherCount} producto(s) urgente(s) → ver</button>`
    : '';

  if (!list.dataset.bound) {
    list.dataset.bound = '1';
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-switch-section]');
      if (btn) {
        setSection(btn.getAttribute('data-switch-section'));
        renderPriorityAlertsList();
      }
    });
  }

  const secName = currentSection === 'autoservicio' ? 'Autoservicio' : 'Atendida';
  if (subtitle) {
    subtitle.textContent = urgentItems.length > 0
      ? `${secName}: ${urgentItems.length} producto(s) crítico(s) o urgente(s)`
      : `${secName}: no hay alertas urgentes pendientes`;
  }

  if (urgentItems.length === 0) {
    list.innerHTML = banner + `
      <div class="text-center py-8 text-text-secondary">
        <div class="text-3xl mb-2">🎉</div>
        <p class="text-xs font-semibold text-white">¡Todo bajo control!</p>
        <p class="text-[11px] mt-1">No hay productos que requieran retiro o atención urgente (≤ 4 días).</p>
      </div>
    `;
    return;
  }

  list.innerHTML = banner + urgentItems.map(p => {
    const days = store.getDaysUntilExpiry(p.expiryDate);
    const codeInfo = store.formatCodeInfo(p.plu || p.code);
    const isAuto = p.section === 'autoservicio';

    let dayBadge = '';
    if (days < 0) {
      dayBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/60 text-red-200 border border-red-500/40">VENCIDO (${Math.abs(days)}d)</span>`;
    } else if (days === 0) {
      dayBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">VENCE HOY (RETIRAR)</span>`;
    } else if (days === 1) {
      dayBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/90 text-white">1 DÍA (RETIRAR)</span>`;
    } else if (days === 2) {
      dayBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/90 text-white">2 DÍAS (CRÍTICO)</span>`;
    } else {
      dayBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600/90 text-white">${days} DÍAS (URGENTE)</span>`;
    }

    const sectionBadge = isAuto
      ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30">🛒 Autoservicio</span>`
      : `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">🥩 Atendida</span>`;

    let codeBadge = '';
    if (codeInfo.type === 'PLU') {
      codeBadge = `<span class="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/30">PLU: ${escapeHtml(codeInfo.code)}</span>`;
    } else if (codeInfo.type === 'EAN') {
      codeBadge = `<span class="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">EAN: ${escapeHtml(codeInfo.code)}</span>`;
    }

    const unit = (p.measureType === 'kilogramos' || p.measureType === 'kg') ? 'kg' : 'uds';
    const cantDisplay = (p.cantidad !== undefined && p.cantidad !== null) ? `${p.cantidad} ${unit}` : '';

    return `
      <div class="p-3 rounded-xl bg-surface-light border ${days <= 1 ? 'border-exp-red/50 bg-red-950/20' : 'border-exp-yellow/40 bg-amber-950/20'} flex flex-col gap-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="font-bold text-xs text-white leading-tight flex-1">${escapeHtml(p.name)}</div>
          ${dayBadge}
        </div>
        <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
          ${sectionBadge}
          ${codeBadge}
          <span class="text-white font-medium">📅 ${formatDateDisplay(p.expiryDate)}</span>
          ${cantDisplay ? `<span class="font-bold text-white">(${cantDisplay})</span>` : ''}
        </div>
        <div class="text-[10px] text-text-secondary truncate">
          🏭 Proveedor: <span class="text-text-primary">${escapeHtml(p.provider || p.proveedor || 'Sin especificar')}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// MODAL: CARGA MASIVA DE PRODUCTOS DESDE PDF
// ============================================================

let parsedPDFItemsCache = [];

export function showPDFPreviewModal(parsedResult) {
  const modal = document.getElementById('modal-pdf-preview');
  if (!modal) return;

  // La sección se propone según donde estás trabajando (cada ítem se puede cambiar en la vista previa)
  parsedPDFItemsCache = (Array.isArray(parsedResult.items) ? parsedResult.items : [])
    .map(item => ({ ...item, section: currentSection }));

  const providerInput = document.getElementById('pdf-batch-provider');
  if (providerInput) {
    providerInput.value = parsedResult.detectedProvider || 'Proveedor General';
  }

  const expiryInput = document.getElementById('pdf-batch-expiry');
  if (expiryInput) {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    expiryInput.value = store.toLocalDateStr(d);
  }

  const statsEl = document.getElementById('pdf-preview-stats');
  if (statsEl) {
    statsEl.textContent = `${parsedPDFItemsCache.length} producto(s) extraído(s) del documento PDF`;
  }

  const selectAll = document.getElementById('pdf-preview-select-all');
  if (selectAll) selectAll.checked = true;

  renderPDFPreviewList(parsedPDFItemsCache);
  modal.classList.remove('hidden');
}

export function closePDFPreviewModal() {
  const modal = document.getElementById('modal-pdf-preview');
  if (modal) modal.classList.add('hidden');
  parsedPDFItemsCache = [];
}

export function renderPDFPreviewList(items) {
  const container = document.getElementById('pdf-preview-list');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-text-secondary text-xs">
        No se pudieron identificar productos con código o formato reconocible en el PDF.
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const code = item.plu || item.code || '';
    const codeInfo = store.formatCodeInfo(code);
    const isKg = item.measureType === 'kilogramos' || item.measureType === 'kg';
    const isAtendida = item.section === 'atendida';

    return `
      <div class="pdf-preview-item p-2.5 bg-surface-light rounded-xl border border-accent/20 flex flex-col gap-2" data-index="${idx}">
        <div class="flex items-center gap-2">
          <input type="checkbox" class="pdf-item-checkbox w-4 h-4 rounded accent-action cursor-pointer" checked data-index="${idx}">
          <input type="text" class="pdf-item-name flex-1 bg-surface px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white border border-accent/30 focus:ring-1 focus:ring-action"
            value="${escapeHtml(item.name || '')}" placeholder="Nombre del producto">
          <span class="text-[10px] font-mono px-2 py-1 rounded bg-surface border border-accent/30 text-purple-300 font-bold whitespace-nowrap">
            ${codeInfo.type}: ${escapeHtml(code || 'N/A')}
          </span>
          <input type="hidden" class="pdf-item-code" value="${escapeHtml(code)}">
        </div>
        <div class="grid grid-cols-3 gap-2 text-[11px] pl-6">
          <div>
            <label class="block text-[10px] text-text-secondary mb-0.5">Sección</label>
            <select class="pdf-item-section w-full bg-surface px-2 py-1 rounded border border-accent/30 text-white text-[11px]">
              <option value="autoservicio" ${!isAtendida ? 'selected' : ''}>🛒 Autoservicio</option>
              <option value="atendida" ${isAtendida ? 'selected' : ''}>🥩 Atendida</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] text-text-secondary mb-0.5">Medida</label>
            <select class="pdf-item-measure w-full bg-surface px-2 py-1 rounded border border-accent/30 text-white text-[11px]">
              <option value="kilogramos" ${isKg ? 'selected' : ''}>Kilogramos (kg)</option>
              <option value="unidades" ${!isKg ? 'selected' : ''}>Unidades (uds)</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] text-text-secondary mb-0.5">Cantidad</label>
            <input type="number" step="any" min="0" class="pdf-item-quantity w-full bg-surface px-2 py-1 rounded border border-accent/30 text-white text-[11px]"
              value="${item.cantidad || (isKg ? 10 : 1)}" placeholder="Cant.">
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function confirmPDFImport() {
  const container = document.getElementById('pdf-preview-list');
  if (!container) return;

  const batchProvider = (document.getElementById('pdf-batch-provider')?.value || '').trim() || 'Proveedor Carnicería';
  const batchExpiry = document.getElementById('pdf-batch-expiry')?.value || '';

  if (!batchExpiry) {
    showToast('Por favor selecciona una fecha de vencimiento general para el lote', 'warning');
    return;
  }

  const cards = container.querySelectorAll('.pdf-preview-item');
  const productsToImport = [];

  cards.forEach(card => {
    const checkbox = card.querySelector('.pdf-item-checkbox');
    if (checkbox && checkbox.checked) {
      const name = (card.querySelector('.pdf-item-name')?.value || '').trim();
      const code = (card.querySelector('.pdf-item-code')?.value || '').trim();
      const section = card.querySelector('.pdf-item-section')?.value || 'autoservicio';
      const measureType = card.querySelector('.pdf-item-measure')?.value || 'kilogramos';
      const qtyVal = Number(card.querySelector('.pdf-item-quantity')?.value) || 0;

      if (name) {
        productsToImport.push({
          name: name,
          plu: code,
          code: code,
          section: section,
          measureType: measureType,
          cantidad: qtyVal,
          quantity: qtyVal,
          provider: batchProvider,
          proveedor: batchProvider,
          expiryDate: batchExpiry,
          notes: 'Importado masivamente vía documento PDF'
        });
      }
    }
  });

  if (productsToImport.length === 0) {
    showToast('No has seleccionado ningún producto para importar', 'warning');
    return;
  }

  const importedCount = store.addBatchProducts(productsToImport);
  closePDFPreviewModal();

  renderProductList();
  updateAlertBadge();
  updateCatalogDatalists();
  renderSettings();

  showToast(`¡Importación exitosa! Se guardaron ${importedCount} productos`, 'success');
}

// ============================================================
// INDICADOR DE ESTADO DE CONEXIÓN (ONLINE / OFFLINE EN TIEMPO REAL)
// ============================================================

export function updateConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  const dotEl = document.getElementById('connection-dot');
  const textEl = document.getElementById('connection-text');

  if (!statusEl || !dotEl || !textEl) return;

  if (navigator.onLine) {
    statusEl.className = 'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 transition-all';
    dotEl.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
    textEl.textContent = 'Online';
    statusEl.title = 'Modo Online (Persistencia local activa)';
  } else {
    statusEl.className = 'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 transition-all';
    dotEl.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse';
    textEl.textContent = 'Offline (Local)';
    statusEl.title = 'Modo Offline: Operando 100% autónomo en el dispositivo';
  }
}


// ============================================================
// HISTORIAL: PEDIDOS DE PRECIO Y RETIROS / MERMA
// ============================================================

let historyTab = 'pedidos'; // 'pedidos' | 'retiros'
let historySection = null;

export function openHistoryModal(tab = 'pedidos') {
  const modal = document.getElementById('modal-history');
  if (!modal) return;
  historyTab = tab;
  historySection = currentSection;
  modal.classList.remove('hidden');
  renderHistoryModal();
}

export function closeHistoryModal() {
  const modal = document.getElementById('modal-history');
  if (modal) modal.classList.add('hidden');
}

/**
 * Conecta los botones del modal de historial (una sola vez)
 */
export function bindHistoryModal() {
  const modal = document.getElementById('modal-history');
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = '1';

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-history-close]')) {
      closeHistoryModal();
      return;
    }
    const sec = e.target.closest('[data-history-section]');
    if (sec) {
      historySection = sec.getAttribute('data-history-section');
      renderHistoryModal();
      return;
    }
    const tab = e.target.closest('[data-history-tab]');
    if (tab) {
      historyTab = tab.getAttribute('data-history-tab');
      renderHistoryModal();
    }
  });

  document.getElementById('history-period')?.addEventListener('change', renderHistoryModal);
}

function historyUnitLabel(unit) {
  return (unit === 'kilogramos' || unit === 'kg') ? 'kg' : 'und';
}

export function renderHistoryModal() {
  const content = document.getElementById('history-content');
  if (!content) return;
  const sec = historySection || currentSection;

  const on = 'bg-action/20 text-white border-action/50';
  const off = 'bg-surface-light text-text-secondary border-transparent';
  document.querySelectorAll('.history-sec').forEach(btn => {
    btn.className = 'history-sec flex-1 text-xs font-bold py-2 rounded-lg border ' +
      (btn.getAttribute('data-history-section') === sec ? on : off);
  });
  document.querySelectorAll('.history-tab').forEach(btn => {
    btn.className = 'history-tab flex-1 text-xs font-bold py-2 rounded-lg border ' +
      (btn.getAttribute('data-history-tab') === historyTab ? on : off);
  });

  const periodRow = document.getElementById('history-period-row');
  if (periodRow) periodRow.classList.toggle('hidden', historyTab !== 'retiros');

  content.innerHTML = historyTab === 'retiros' ? renderRemovalsHtml(sec) : renderPriceHistoryHtml(sec);
}

function renderPriceHistoryHtml(sec) {
  const history = store.getPriceHistory(sec);
  if (history.length === 0) {
    return `<div class="text-center py-10 text-text-secondary text-xs">Aún no hay pedidos de precio registrados en esta sección.</div>`;
  }

  // Productos que más veces se han pedido (ayuda a detectar sobrepedidos)
  const freq = new Map();
  history.forEach(day => day.items.forEach(it => {
    const key = it.name;
    freq.set(key, (freq.get(key) || 0) + 1);
  }));
  const top = Array.from(freq.entries()).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topHtml = top.length > 0
    ? `<div class="bg-surface-light rounded-xl p-3 border border-accent/20">
         <p class="text-xs font-bold text-white mb-1.5">🔁 Pedidos más repetidos</p>
         ${top.map(([name, n]) => `<div class="flex justify-between text-[11px] py-0.5"><span class="truncate pr-2">${escapeHtml(name)}</span><span class="font-bold text-exp-yellow flex-shrink-0">${n} veces</span></div>`).join('')}
       </div>`
    : '';

  const days = history.map(day => `
    <div class="bg-surface-light rounded-xl p-3 border border-accent/20">
      <p class="text-xs font-bold text-white mb-1.5">📅 ${formatDateDisplay(day.date)} <span class="text-text-secondary font-normal">· ${day.items.length} producto(s)</span></p>
      ${day.items.map(it => `
        <div class="flex items-center justify-between gap-2 text-[11px] py-1 border-t border-accent/10">
          <span class="truncate">${escapeHtml(it.name)}</span>
          <span class="font-bold flex-shrink-0 ${it.priceGiven ? 'text-exp-green' : 'text-text-secondary'}">${Number(it.quantity) || 0} ${historyUnitLabel(it.unit)}${it.priceGiven ? ' · con precio' : ''}</span>
        </div>`).join('')}
    </div>`).join('');

  return topHtml + days;
}

function renderRemovalsHtml(sec) {
  const periodDays = Number(document.getElementById('history-period')?.value ?? 30);
  let list = store.getRemovals(sec);
  if (periodDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffStr = store.toLocalDateStr(cutoff);
    list = list.filter(r => r.date >= cutoffStr);
  }

  if (list.length === 0) {
    return `<div class="text-center py-10 text-text-secondary text-xs">No hay retiros registrados en este periodo.</div>`;
  }

  const sum = store.summarizeRemovals(list);
  const reasonsHtml = Object.entries(sum.byReason)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-primary border border-accent/30">${escapeHtml(store.REMOVAL_REASONS[key] || key)}: ${n}</span>`)
    .join(' ');
  const providersHtml = Object.entries(sum.byProvider)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([prov, n]) => `<div class="flex justify-between text-[11px] py-0.5"><span class="truncate pr-2">🏭 ${escapeHtml(prov)}</span><span class="font-bold flex-shrink-0">${n}</span></div>`)
    .join('');

  const summaryHtml = `
    <div class="bg-surface-light rounded-xl p-3 border border-accent/20">
      <p class="text-xs font-bold text-white mb-1">${sum.total} retiro(s) · ${sum.kg} kg · ${sum.und} und</p>
      <div class="flex flex-wrap gap-1.5 mb-2">${reasonsHtml}</div>
      <p class="text-[11px] font-bold text-text-secondary mb-0.5">Proveedores con más retiros</p>
      ${providersHtml}
    </div>`;

  const items = list.map(r => `
    <div class="bg-surface-light rounded-xl p-3 border border-accent/20 text-[11px]">
      <div class="flex justify-between gap-2">
        <span class="font-bold text-white truncate">${escapeHtml(r.name)}</span>
        <span class="font-bold flex-shrink-0">${Number(r.quantity) || 0} ${historyUnitLabel(r.measureType)}</span>
      </div>
      <div class="text-text-secondary mt-0.5">📅 ${formatDateDisplay(r.date)} · ${escapeHtml(store.REMOVAL_REASONS[r.reason] || r.reason)}${r.lote ? ' · ' + escapeHtml(r.lote) : ''}</div>
      <div class="text-text-secondary truncate">🏭 ${escapeHtml(r.provider || 'Sin proveedor')}${r.note ? ' · ' + escapeHtml(r.note) : ''}</div>
    </div>`).join('');

  return summaryHtml + items;
}

// ============================================================
// AVISOS, RESPALDO Y ALMACENAMIENTO PROTEGIDO
// ============================================================

/**
 * Activa o desactiva los avisos de vencimiento del sistema
 */
export async function toggleNotifications() {
  if (!('Notification' in window)) {
    showToast('Este navegador no admite notificaciones', 'warning');
    return;
  }

  if (store.getSettings().notificationsEnabled && Notification.permission === 'granted') {
    store.saveSettings({ notificationsEnabled: false });
    showToast('Avisos de vencimiento desactivados', 'info');
    renderSettings();
    return;
  }

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();

  if (permission === 'granted') {
    store.saveSettings({ notificationsEnabled: true, lastNotifiedDate: '' });
    showToast('Avisos de vencimiento activados', 'success');
    notifyUrgentProducts(true);
  } else {
    showToast('Permiso de notificaciones denegado en el navegador', 'warning');
  }
  renderSettings();
}

/**
 * Muestra una notificación del sistema (una vez al día) con los productos
 * críticos o urgentes de cada sección. Solo funciona con la app abierta.
 * @param {boolean} [force=false]
 */
export async function notifyUrgentProducts(force = false) {
  const settings = store.getSettings();
  if (!settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;

  const today = store.toLocalDateStr(new Date());
  if (!force && settings.lastNotifiedDate === today) return;

  const aut = store.getPriorityProducts('autoservicio').length;
  const ate = store.getPriorityProducts('atendida').length;
  if (aut + ate === 0) return;

  const title = '⚠️ Rotador: productos por vencer';
  const body = `🛒 Autoservicio: ${aut} · 🥩 Atendida: ${ate} (vencidos o a 4 días o menos)`;

  try {
    const reg = ('serviceWorker' in navigator) ? await navigator.serviceWorker.ready : null;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, { body, icon: 'icons/icon.svg', tag: 'rotador-vencimientos' });
    } else {
      new Notification(title, { body });
    }
    store.saveSettings({ lastNotifiedDate: today });
  } catch (err) {
    console.warn('No se pudo mostrar la notificación:', err);
  }
}

/**
 * Recuerda hacer un respaldo (máximo una vez al día)
 */
export function checkBackupReminder() {
  const st = store.getBackupStatus();
  if (!st.needsReminder) return;

  const today = store.toLocalDateStr(new Date());
  if (store.getSettings().lastBackupReminderDate === today) return;
  store.saveSettings({ lastBackupReminderDate: today });

  showToast(
    st.daysSince === null
      ? 'Aún no has hecho un respaldo. Ve a Ajustes → Respaldo.'
      : `Hace ${st.daysSince} días sin respaldo. Ve a Ajustes → Respaldo.`,
    'warning'
  );
}

/**
 * Pide al navegador que no borre automáticamente los datos de la app
 */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const granted = already || await navigator.storage.persist();
      if (store.getSettings().storagePersisted !== !!granted) {
        store.saveSettings({ storagePersisted: !!granted });
      }
    }
  } catch (err) {
    console.warn('No se pudo solicitar almacenamiento persistente:', err);
  }
}
