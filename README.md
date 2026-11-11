# 🏷️ Rotador

**Control de Vencimientos de Mercancía y Gestión de Precios**

PWA diseñada para el control diario de fechas de vencimiento de productos y la gestión de solicitudes de precios en carnicerías y supermercados. Pensada para uso en dispositivos móviles con arquitectura 100% offline nativa.

---

## ✨ Características Principales

- 🧹 **Inicio 100% Limpio (Zero-Seed Policy)** — La aplicación inicia completamente vacía, sin productos de ejemplo ni semillas precargadas.
- 🧪 **Modo Simulación de Pedido de Precios (Testing)** — Permite cargar un escenario de prueba aislado para testear visualmente la selección de productos, cantidades y la generación/compartición de reportes PDF sin alterar el inventario real.
- 💾 **Persistencia Local Offline (IndexedDB + LocalStorage)** — Almacenamiento local seguro en el dispositivo que garantiza funcionamiento autónomo sin conexión a internet.
  - Documentación técnica detallada: consulta [DOC_ALMACENAMIENTO_LOCAL.md](./DOC_ALMACENAMIENTO_LOCAL.md).
- 📄 **Carga Masiva mediante PDF** — Extrae automáticamente Nombre, Código PLU/EAN y Proveedor desde listas o facturas PDF con visor interactivo de confirmación.
- 🔴🟠🟡🟢 **Control Dinámico de Vencimientos por Colores (Escala Oficial Ajustada)** — Alertas visuales dinámicas actualizadas en tiempo real desde el día del registro:
  - 🟢 **Verde:** Más de 7 días (Estado óptimo).
  - 🟡 **Amarillo:** Entre 5 y 7 días (Alerta para pedir precios / rotación programada).
  - 🟠 **Naranja:** 3 a 4 días restantes (Atención urgente).
  - 🔴 **Rojo (Crítico / Retiro):** 2 días o menos / Vencido (Pensado para retirar el producto 1 día antes de su vencimiento).
- 🌐 **Indicador de Conexión en Tiempo Real y Cero Permisos Innecesarios** — Monitor sutil en el encabezado (Online / Offline) que garantiza funcionamiento 100% autónomo sin solicitar permisos intrusivos al usuario.
- 🔔 **Notificaciones y Alertas Prioritarias** — Panel y aviso emergente automático al iniciar con los productos que requieren atención urgente o retiro (≤ 4 días).
- 🎨 **Diferenciación Visual Cromática y Ergonomía Móvil** — Separación estricta entre **🛒 Autoservicio (Azul)** y **🥩 Atendida (Ámbar)**, con espaciado táctil optimizado para evitar toques accidentales en teléfonos.
- 🔢 **Diferenciación Exclusiva PLU vs EAN** — Detección inteligente de códigos (1 a 6 dígitos: `PLU: [código]`; 7+ dígitos: `EAN: [código]`).
- 📄 **Reportes PDF Oficiales y Compartición Nativa** — Exportación formateada de productos con ≤ 7 días con columnas clave: PLU, Nombre del Producto, Sección, Existencia y Días Restantes. Botón directo de compartición vía Web Share API (WhatsApp, Correo, Drive).
- 📸 **Escáner de Códigos de Barras** — Lectura con la cámara del móvil mediante ZXing.

- 🛒🥩 **Dos secciones independientes (Autoservicio y Atendida)** — Cada sección maneja su mercancía por separado con las mismas funciones: inventario, lotes y stock, catálogo maestro, pedido de precios (con su propia pestaña), alertas, reportes PDF/texto, retiros e historial. El mismo producto puede existir en ambas secciones sin mezclarse.
- 📉 **Retiros y merma** — Al retirar un producto se registra el motivo (vencido, dañado, rotación, otro), cantidad, lote y proveedor. Resumen por motivo y proveedor en Ajustes → Retiros y merma.
- 📜 **Historial de pedidos de precio** — Consulta días anteriores por sección y detecta los productos que más se repiten.
- 💾 **Protección de datos** — Solicita almacenamiento persistente al navegador, recuerda hacer respaldo si pasan 7 días o nunca se hizo, y el respaldo incluye retiros.
- 🔔 **Aviso del sistema** (opcional) — Notificación diaria al abrir la app si hay productos vencidos o a 4 días o menos, desglosada por sección. No funciona con la app cerrada.
- 🧪 **Pruebas automáticas** — `npm test` (Node 18+) valida fechas, escala de alertas, separación por sección, retiros, historial y respaldo.

---

## 🚀 Instalación

### Opción 1: GitHub Pages

1. Haz fork de este repositorio.
2. Ve a **Settings → Pages**.
3. En **Source**, selecciona la rama `main` y la carpeta `/ (root)`.
4. Haz clic en **Save**.
5. Accede a la URL generada: `https://samueldrs15fsd.github.io/El_Rotador/`
6. En tu dispositivo móvil, abre la URL y selecciona **"Agregar a pantalla de inicio"**.

### Opción 2: Servidor local

```bash
# Clona el repositorio
git clone https://github.com/SamuelDRS15FSD/El_Rotador.git
cd El_Rotador

# Sirve con cualquier servidor estático, por ejemplo:
npx serve .
# o
python -m http.server 8000
```

> **Nota:** El Service Worker requiere HTTPS o `localhost` para funcionar.

---

## 🛠️ Tecnologías

| Tecnología | Uso |
|---|---|
| **HTML5 & Vanilla JS** | Estructura semántica y módulos ES sin bundler |
| **Tailwind CSS** | Framework de utilidades CSS para diseño responsive y dark-mode |
| **IndexedDB (`rotador_db_v1`)** | Base de datos local transaccional para almacenamiento offline masivo |
| **LocalStorage (`rotadorData`)** | Caché síncrona en memoria para renderizado instantáneo |
| **PDF.js (Mozilla)** | Extracción de texto y análisis heurístico de documentos PDF |
| **jsPDF + AutoTable** | Generación de reportes PDF oficiales para impresión y descarga |
| **Web Share API** | Compartición nativa de archivos PDF y respaldos JSON hacia WhatsApp, Mail, etc. |
| **ZXing** | Lectura de códigos de barras EAN/UPC desde la cámara |
| **PWA (Service Worker v7)** | Funcionamiento 100% offline e instalación como app nativa |

---

## 📁 Estructura del Proyecto

```
El_Rotador/
├── index.html                   # Interfaz PWA completa y vistas
├── manifest.json                # Manifiesto PWA (Rotador)
├── sw.js                        # Service Worker (Cache offline rotador-v7)
├── README.md                    # Guía general del proyecto
├── DOC_ALMACENAMIENTO_LOCAL.md  # Especificación técnica del almacenamiento local
├── js/
│   ├── app.js                   # Inicialización, orquestación y eventos
│   ├── store.js                 # Capa de datos, estado y lógica de simulación
│   ├── db.js                    # Motor nativo IndexedDB (offline-first)
│   ├── ui.js                    # Renderizado reactivo, modales y reportes PDF
│   ├── pdf-importer.js          # Extractor y parser de documentos PDF
│   └── scanner.js               # Integración de escaneo con cámara (ZXing)
└── icons/
    └── icon.svg                 # Icono oficial de la aplicación
```

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](https://opensource.org/licenses/MIT).

```
Aquí tienes la actualización de la licencia adaptada para reflejar el cambio de nombre del proyecto a **Rotador** (actualizando el año y el titular del copyright según corresponda):

```
MIT License

Copyright (c) 2026 Rotador

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```
