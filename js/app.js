/**
 * app.js - Punto de entrada principal para Rotador
 * Inicializa PWA, Service Worker, IndexedDB, Catálogo Maestro y enlaza todos los eventos del DOM
 */

import * as store from './store.js';
import * as ui from './ui.js';
import * as pdfImporter from './pdf-importer.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar almacenamiento local persistente (IndexedDB + LocalStorage)
  await store.initStore();

  // 2. Inicializar fecha del encabezado y estado de conexión en tiempo real
  ui.updateHeaderDate();
  ui.updateConnectionStatus();

  // 3. Registrar Service Worker para PWA offline
  registerServiceWorker();

  // 4. Cargar datalists del Catálogo Maestro
  ui.updateCatalogDatalists();

  // 5. Actualizar contador de alertas prioritarias en la campana
  ui.updateAlertBadge();

  // 6. Configurar todos los event listeners
  setupNavigationEvents();
  setupInventoryEvents();
  setupProductFormEvents();
  setupScannerEvents();
  setupPedirPreciosEvents();
  setupSettingsEvents();
  setupCatalogModalEvents();
  setupPriorityAlertsEvents();
  setupPDFImportEvents();
  setupConnectionEvents();

  // 7. Mostrar vista inicial: Autoservicio, salvo que solo Atendida tenga productos urgentes
  const urgentAut = store.getPriorityProducts('autoservicio').length;
  const urgentAte = store.getPriorityProducts('atendida').length;
  ui.showView('view-inventory');
  ui.setSection(urgentAut === 0 && urgentAte > 0 ? 'atendida' : 'autoservicio');

  // 8. Sistema de aviso emergente al iniciar si existen productos prioritarios (vencidos o ≤ 4 días)
  if (urgentAut + urgentAte > 0) {
    setTimeout(() => {
      ui.showPriorityAlertsModal();
    }, 700);
  }

  // 9. Protección de datos: almacenamiento persistente + recordatorio de respaldo
  ui.requestPersistentStorage();
  setTimeout(() => ui.checkBackupReminder(), 2500);

  // 10. Aviso del sistema (si el usuario lo activó): al abrir y al volver a la app
  ui.notifyUrgentProducts();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ui.updateAlertBadge();
      ui.notifyUrgentProducts();
    }
  });
});

/**
 * Monitoreo de conectividad (Online / Offline) en tiempo real
 */
function setupConnectionEvents() {
  window.addEventListener('online', () => {
    ui.updateConnectionStatus();
    ui.showToast('Conexión reanudada (Modo Online)', 'info');
  });

  window.addEventListener('offline', () => {
    ui.updateConnectionStatus();
    ui.showToast('Sin internet: Operando 100% en modo Offline local', 'warning');
  });
}

/**
 * Registro de Service Worker
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('Service Worker registrado con éxito:', reg.scope);
        })
        .catch(err => {
          console.warn('Fallo en registro de Service Worker:', err);
        });
    });
  }
}

/**
 * Eventos de la barra inferior de navegación
 */
function setupNavigationEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view');
      if (viewId) {
        ui.showView(viewId);
      }
    });
  });
}

/**
 * Eventos de la vista de inventario (tabs, filtros, búsqueda, click en tarjeta)
 */
function setupInventoryEvents() {
  // Botón selector compacto en la barra superior (alterna dinámicamente entre AUT y ATE)
  // Con soporte para click directo y delegación global para máxima confiabilidad táctil en móviles
  const toggleBtn = document.getElementById('btn-toggle-section') || document.getElementById('active-section-indicator');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ui.toggleSection();
    });
  }

  // Delegación global por si el botón o sus hijos son recreados dinámicamente
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-toggle-section') || e.target.closest('#active-section-indicator');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      ui.toggleSection();
    }
  });

  // Tabs: Autoservicio (Azul) / Atendida (Ámbar)
  document.querySelectorAll('.inventory-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.getAttribute('data-section');
      if (section) {
        ui.setSection(section);
      }
    });
  });

  // Búsqueda en tiempo real
  const searchInput = document.getElementById('inventory-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      ui.setSearchQuery(e.target.value);
    });
  }

  // Chips de ordenamiento
  document.querySelectorAll('.sort-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sort = chip.getAttribute('data-sort');
      if (sort) ui.setSort(sort);
    });
  });

  // Chips de filtro
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter');
      if (filter) ui.setFilter(filter);
    });
  });

  // Botón flotante (+) Agregar producto
  const fab = document.getElementById('fab-add-product');
  if (fab) {
    fab.addEventListener('click', () => {
      ui.openAddProductForm(null);
    });
  }

  // Delegación de click en tarjetas de producto para editar o agregar nuevo lote
  const productList = document.getElementById('product-list');
  if (productList) {
    productList.addEventListener('click', (e) => {
      const newLotBtn = e.target.closest('.btn-quick-new-lot');
      if (newLotBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = newLotBtn.getAttribute('data-id');
        if (id) {
          ui.openAddProductForm(id, 'new-batch');
        }
        return;
      }

      const card = e.target.closest('.product-card');
      if (card) {
        const id = card.getAttribute('data-id');
        if (id) {
          ui.openAddProductForm(id, 'edit');
        }
      }
    });
  }
}

/**
 * Eventos del formulario de agregar/editar producto
 */
function setupProductFormEvents() {
  // Al cambiar la sección del formulario, las sugerencias del catálogo son las de esa sección
  const formSectionSelect = document.getElementById('product-section');
  if (formSectionSelect) {
    formSectionSelect.addEventListener('change', () => ui.updateCatalogDatalists());
  }

  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ui.saveProductFromForm();
    });

    // Actualizar reglas de cantidad al alternar entre Unidades y Kilogramos
    form.querySelectorAll('input[name="measure"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        ui.updateQuantityInputRules(e.target.value);
      });
    });
  }

  // Autocompletado del Catálogo Maestro al tipear código
  const codeInput = document.getElementById('product-code');
  if (codeInput) {
    codeInput.addEventListener('input', (e) => {
      ui.updateCodeBadge(e.target.value);
      ui.handleCatalogAutocomplete(e.target.value, 'code');
    });
    codeInput.addEventListener('change', (e) => {
      ui.handleCatalogAutocomplete(e.target.value, 'code');
    });
  }

  // Autocompletado del Catálogo Maestro al tipear o seleccionar nombre
  const nameInput = document.getElementById('product-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      ui.handleCatalogAutocomplete(e.target.value, 'name');
    });
    nameInput.addEventListener('change', (e) => {
      ui.handleCatalogAutocomplete(e.target.value, 'name');
    });
  }

  // Botones de cancelar
  const btnCancelTop = document.getElementById('btn-cancel-product');
  const btnCancelBottom = document.getElementById('btn-cancel-product-bottom');

  const handleCancel = () => {
    ui.showView('view-inventory');
  };

  if (btnCancelTop) btnCancelTop.addEventListener('click', handleCancel);
  if (btnCancelBottom) btnCancelBottom.addEventListener('click', handleCancel);

  // Botón eliminar dentro del formulario
  const btnDelete = document.getElementById('btn-delete-product');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      ui.promptDeleteProduct();
    });
  }

  // Modal de confirmación de eliminación
  const btnConfirmCancel = document.getElementById('btn-confirm-delete-cancel');
  const btnConfirmOk = document.getElementById('btn-confirm-delete-ok');

  if (btnConfirmCancel) {
    btnConfirmCancel.addEventListener('click', () => {
      ui.closeDeleteConfirm();
    });
  }

  if (btnConfirmOk) {
    btnConfirmOk.addEventListener('click', () => {
      ui.executeDeleteProduct();
    });
  }
}

/**
 * Eventos del escáner de códigos de barras
 */
function setupScannerEvents() {
  const btnOpen = document.getElementById('btn-open-scanner');
  const btnClose = document.getElementById('btn-close-scanner');
  const btnCancel = document.getElementById('btn-cancel-scanner');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      ui.openScanner();
    });
  }

  const handleCloseScanner = () => {
    ui.closeScanner();
  };

  if (btnClose) btnClose.addEventListener('click', handleCloseScanner);
  if (btnCancel) btnCancel.addEventListener('click', handleCloseScanner);
}

/**
 * Eventos del módulo de pedir precios y festivos
 */
function setupPedirPreciosEvents() {
  // Toggle lunes festivo (traslada tarea de pedir del lunes al martes)
  const toggleHoliday = document.getElementById('toggle-holiday');
  if (toggleHoliday) {
    toggleHoliday.addEventListener('change', (e) => {
      store.saveSettings({ mondayHoliday: e.target.checked });
      ui.renderPedirPrecios();
      ui.showToast(e.target.checked ? 'Regla festivo activa: Pedido trasladado a martes' : 'Regla normal: Lunes y jueves', 'info');
    });
  }

  // Pestañas de sección (Autoservicio / Atendida) y botón de historial
  document.querySelectorAll('.pedir-tab').forEach(tab => {
    tab.addEventListener('click', () => ui.setSection(tab.getAttribute('data-section')));
  });
  const btnHistory = document.getElementById('btn-open-history');
  if (btnHistory) {
    btnHistory.addEventListener('click', () => ui.openHistoryModal('pedidos'));
  }
  ui.bindHistoryModal();

  // Filtro "Sin precio del día anterior"
  const filterSinPrecio = document.getElementById('filter-sin-precio');
  if (filterSinPrecio) {
    filterSinPrecio.addEventListener('change', () => {
      ui.renderPedirPrecios();
    });
  }

  // Botones de Modo Simulación (Testing)
  const btnRunSim = document.getElementById('btn-run-simulation');
  const btnClearSim = document.getElementById('btn-clear-simulation');

  if (btnRunSim) {
    btnRunSim.addEventListener('click', () => {
      ui.handleRunSimulation();
    });
  }

  if (btnClearSim) {
    btnClearSim.addEventListener('click', () => {
      ui.handleClearSimulation();
    });
  }

  // Delegación de inputs de cantidad y checkboxes de pedido
  const pedirList = document.getElementById('pedir-product-list');
  if (pedirList) {
    // Cambio en input de cantidad a pedir
    pedirList.addEventListener('input', (e) => {
      if (e.target.classList.contains('pedir-quantity')) {
        const productId = e.target.getAttribute('data-product-id');
        ui.handlePedirQuantityChange(productId, e.target.value);
      }
    });

    // Checkbox de estado pedido y selector de unidad de medida (kg / und)
    pedirList.addEventListener('change', (e) => {
      if (e.target.classList.contains('pedir-checkbox')) {
        const productId = e.target.getAttribute('data-product-id');
        ui.handlePedirStatusChange(productId, e.target.checked);
      } else if (e.target.classList.contains('pedir-unit-select')) {
        const productId = e.target.getAttribute('data-product-id');
        ui.handlePedirUnitChange(productId, e.target.value);
      }
    });
  }

  // Botón compartir reporte en PDF (Web Share API nativa o WhatsApp)
  const btnSharePdf = document.getElementById('btn-share-pdf');
  if (btnSharePdf) {
    btnSharePdf.addEventListener('click', () => {
      ui.sharePDFReport();
    });
  }

  // Botón generar / descargar reporte en PDF
  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      ui.generatePDFReport();
    });
  }

  // Botón copiar resumen de texto
  const btnReport = document.getElementById('btn-generate-report');
  if (btnReport) {
    btnReport.addEventListener('click', () => {
      ui.generateAndShareReport();
    });
  }
}

/**
 * Eventos de la vista de configuración y respaldo
 */
function setupSettingsEvents() {
  // Compartir Base de Datos mediante Web Share API
  const btnShareBackup = document.getElementById('btn-share-backup');
  if (btnShareBackup) {
    btnShareBackup.addEventListener('click', () => {
      ui.shareDatabaseBackup();
    });
  }

  // Exportar / Descargar JSON
  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      ui.exportBackup();
    });
  }

  // Importar JSON
  const btnImport = document.getElementById('btn-import-json');
  const fileInput = document.getElementById('import-file-input');

  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        ui.importBackupFile(e.target.files[0]);
        fileInput.value = '';
      }
    });
  }

  // Avisos de vencimiento del sistema
  const btnNotif = document.getElementById('btn-toggle-notifications');
  if (btnNotif) {
    btnNotif.addEventListener('click', () => ui.toggleNotifications());
  }

  // Retiros y merma
  const btnRemovals = document.getElementById('btn-open-removals');
  if (btnRemovals) {
    btnRemovals.addEventListener('click', () => ui.openHistoryModal('retiros'));
  }

  // Vaciar y restablecer toda la base de datos (iniciar 100% limpia)
  const btnClearAll = document.getElementById('btn-clear-all-data');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      ui.promptClearAllData();
    });
  }
}

/**
 * Eventos del Modal del Catálogo Maestro
 */
function setupCatalogModalEvents() {
  const btnOpen = document.getElementById('btn-open-catalog-modal');
  const btnClose = document.getElementById('btn-close-catalog-modal');
  const searchInput = document.getElementById('catalog-modal-search');
  const listContainer = document.getElementById('catalog-modal-list');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      ui.openCatalogModal();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      ui.closeCatalogModal();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      ui.renderCatalogModalList(e.target.value);
    });
  }

  if (listContainer) {
    listContainer.addEventListener('click', (e) => {
      const btnUse = e.target.closest('.btn-use-catalog-item');
      if (btnUse) {
        const name = btnUse.getAttribute('data-name');
        const code = btnUse.getAttribute('data-code');
        const provider = btnUse.getAttribute('data-provider');
        const measure = btnUse.getAttribute('data-measure');
        const section = btnUse.getAttribute('data-section');

        ui.closeCatalogModal();
        ui.openAddProductForm(null);

        // Rellenar formulario con los datos del catálogo
        const nameInput = document.getElementById('product-name');
        const codeInput = document.getElementById('product-code');
        const providerInput = document.getElementById('product-provider');
        const sectionSelect = document.getElementById('product-section');

        if (nameInput) nameInput.value = name || '';
        if (codeInput) codeInput.value = code || '';
        if (providerInput) providerInput.value = provider || '';
        if (sectionSelect) sectionSelect.value = section || 'autoservicio';

        const isKg = measure === 'kilogramos' || measure === 'kg';
        document.querySelectorAll('input[name="measure"]').forEach(r => {
          r.checked = isKg ? r.value === 'kilogramos' : r.value === 'unidades';
        });
        ui.updateQuantityInputRules(measure);
        ui.updateCodeBadge(code);

        // Enfocar el campo obligatorio de cantidad
        setTimeout(() => {
          document.getElementById('product-quantity')?.focus();
        }, 150);

        ui.showToast(`Cargado desde catálogo: "${name}"`, 'success');
      }
    });
  }
}

/**
 * Eventos del sistema de alertas prioritarias (Campana y Modal)
 */
function setupPriorityAlertsEvents() {
  const btnBell = document.getElementById('btn-open-alerts');
  const btnClose = document.getElementById('btn-close-priority-alerts');
  const btnGoPrecios = document.getElementById('btn-priority-go-precios');
  const btnDismiss = document.getElementById('btn-priority-dismiss');

  if (btnBell) {
    btnBell.addEventListener('click', () => {
      ui.showPriorityAlertsModal();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      ui.closePriorityAlertsModal();
    });
  }

  if (btnGoPrecios) {
    btnGoPrecios.addEventListener('click', () => {
      ui.closePriorityAlertsModal();
      ui.showView('view-pedir-precios');
    });
  }

  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      ui.closePriorityAlertsModal();
      ui.showView('view-inventory');
    });
  }
}

/**
 * Eventos de la carga masiva mediante documentos PDF
 */
function setupPDFImportEvents() {
  const btnOpenInventory = document.getElementById('btn-open-pdf-import');
  const btnOpenSettings = document.getElementById('btn-settings-pdf-import');
  const fileInput = document.getElementById('pdf-file-input');
  const btnClosePreview = document.getElementById('btn-close-pdf-preview');
  const btnCancelPreview = document.getElementById('btn-cancel-pdf-preview');
  const btnConfirm = document.getElementById('btn-confirm-pdf-import');
  const selectAll = document.getElementById('pdf-preview-select-all');

  const triggerFileInput = () => {
    if (fileInput) fileInput.click();
  };

  if (btnOpenInventory) btnOpenInventory.addEventListener('click', triggerFileInput);
  if (btnOpenSettings) btnOpenSettings.addEventListener('click', triggerFileInput);

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        ui.showToast('Procesando documento PDF...', 'info');
        const buffer = await file.arrayBuffer();
        const extracted = await pdfImporter.extractTextFromPDF(buffer);
        const parsed = pdfImporter.parseCarniceriaPDF(extracted.fullText, extracted.lines);

        ui.showPDFPreviewModal(parsed);
      } catch (err) {
        console.error('Error importando PDF:', err);
        ui.showToast('No se pudo leer el documento PDF: ' + (err.message || 'Error desconocido'), 'error');
      } finally {
        fileInput.value = '';
      }
    });
  }

  if (btnClosePreview) {
    btnClosePreview.addEventListener('click', () => {
      ui.closePDFPreviewModal();
    });
  }

  if (btnCancelPreview) {
    btnCancelPreview.addEventListener('click', () => {
      ui.closePDFPreviewModal();
    });
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      ui.confirmPDFImport();
    });
  }

  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.pdf-item-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
      });
    });
  }
}
