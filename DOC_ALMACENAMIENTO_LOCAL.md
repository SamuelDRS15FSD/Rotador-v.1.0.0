# 📱 Documentación Técnica: Almacenamiento Local y Persistencia Offline en Rotador

Esta documentación describe la arquitectura técnica, los motores de base de datos, el formato exacto de los esquemas y las rutas físicas donde se almacenan los datos de la aplicación **Rotador** en dispositivos móviles y de escritorio.

---

## 1. Arquitectura de Almacenamiento (Offline-First)

Rotador opera bajo un esquema de **persistencia dual completamente local**, sin depender de conexión a internet ni servidores externos:

1. **Motor Primario Asíncrono (IndexedDB):**
   - Base de datos nativa del dispositivo de alta capacidad.
   - Nombre de la base de datos: `rotador_db_v1`
   - Versión: `1`
   - Motor: `js/db.js`

2. **Motor Secundario Síncrono (LocalStorage):**
   - Utilizado como caché síncrona en memoria para lectura inmediata en el ciclo de renderizado de la UI.
   - Clave principal: `rotadorData`
   - Clave heredada (migración automática): `elRotador`

3. **Caché de Aplicación Offline (Service Worker):**
   - Nombre de caché: `rotador-v3`
   - Pre-cachea todos los assets (`index.html`, scripts JS, manifest, iconos y librerías CDN como Tailwind, ZXing, PDF.js y jsPDF).

---

## 2. Estructura y Esquema de Datos

### 2.1. Almacenes de IndexedDB (`rotador_db_v1`)

| Almacén (Object Store) | Clave Primaria (`keyPath`) | Índices | Descripción |
|---|---|---|---|
| `products` | `id` | `section`, `expiryDate`, `plu` | Inventario activo de productos con fecha de vencimiento |
| `priceRequests` | `id` | `date`, `productId` | Registro de solicitudes de precio y cantidades pedidas |
| `masterCatalog` | `code` | `name` | Catálogo maestro de autocompletado rápido |
| `settings` | `key` | — | Preferencias de usuario (ej. regla de festivos) |

---

### 2.2. Esquema JSON de Cada Entidad

#### Producto (`products`)
```json
{
  "id": "ml4p2q9_k8s1",
  "name": "Bife de Chorizo Premium",
  "plu": "7791234567890",
  "expiryDate": "2026-11-15",
  "section": "autoservicio",
  "measureType": "kilogramos",
  "cantidad": 14.5,
  "quantity": 14.5,
  "provider": "Frigorífico Central",
  "proveedor": "Frigorífico Central",
  "lote": "Lote 1 (Cámara A)",
  "batch": "Lote 1 (Cámara A)",
  "notes": "Bandeja envasada al vacío",
  "isSimulation": false,
  "createdAt": "2026-11-10T20:00:00.000Z"
}
```

*Nota sobre gestión de múltiples lotes por producto:*
- Un mismo producto (mismo PLU o nombre) puede tener múltiples entradas en la base de datos, cada una con su propio identificador de lote (`lote`), cantidad y fecha de vencimiento individual.
- La aplicación evalúa las alertas de color de forma independiente por lote y señala automáticamente cuál lote es el próximo a vencer (**FIFO / Rotación Prioritaria**) para garantizar la rotación correcta de inventario en góndola o mostrador.

*Nota sobre diferenciación inteligente de código:*
- De 1 a 6 dígitos: se clasifica e identifica en la UI como **PLU**.
- 7 o más dígitos: se clasifica e identifica en la UI como **EAN**.

#### Solicitud de Precio (`priceRequests`)
```json
{
  "id": "pr_8f3a1z",
  "productId": "ml4p2q9_k8s1",
  "date": "2026-11-10",
  "quantity": 10.5,
  "unit": "kilogramos",
  "priceRequested": true,
  "priceGiven": false
}
```

#### Catálogo Maestro (`masterCatalog`)
```json
{
  "name": "Milanesas de Carne Preparadas",
  "code": "4011",
  "provider": "Elaboración Mostrador",
  "measureType": "kilogramos",
  "section": "atendida"
}
```

#### Preferencias (`settings`)
```json
{
  "mondayHoliday": false
}
```

---

## 3. Ubicación Física de los Archivos en el Teléfono

Al instalarse como PWA o ejecutarse desde el navegador del dispositivo, los datos se almacenan en el sandbox de seguridad del sistema operativo en las siguientes rutas físicas:

### 3.1. Dispositivos Android (Google Chrome / PWA WebAPK)
En Android, IndexedDB se guarda mediante LevelDB en el almacenamiento privado de la app:
```
/data/data/com.android.chrome/app_chrome/Default/IndexedDB/https_samueldrs15fsd.github.io_0.indexeddb.leveldb/
```
Archivos contenidos:
- `*.ldb` / `*.log` (Tablas y registros LevelDB de IndexedDB)
- `MANIFEST-*` (Metadatos de versión y estado)
- `CURRENT` (Puntero activo del motor de base de datos)

Para LocalStorage:
```
/data/data/com.android.chrome/app_chrome/Default/Local Storage/leveldb/
```

### 3.2. Dispositivos iOS (Apple Safari / PWA en Pantalla de Inicio)
En iOS (WebKit), la base de datos se almacena en el contenedor seguro de WebKit Sandbox:
```
/private/var/mobile/Containers/Data/Application/<UUID>/Library/WebKit/WebsiteData/Default/IndexedDB/
```
Y para la PWA anclada al inicio:
```
/private/var/mobile/Containers/Data/Application/<UUID>/Library/WebKit/WebsiteData/Default/WebStorage/
```

### 3.3. Escritorio (Windows / macOS / Linux)
- **Windows (Chrome/Edge):** `%LOCALAPPDATA%\Google\Chrome\User Data\Default\IndexedDB\`
- **macOS:** `~/Library/Application Support/Google/Chrome/Default/IndexedDB/`
- **Linux:** `~/.config/google-chrome/Default/IndexedDB/`

---

## 4. Política de Base de Datos Limpia (Zero-Seed Policy) y Cero Permisos Innecesarios

Para garantizar total transparencia en el punto de venta y privacidad del operador:
1. **Inicio 100% Limpio:** La aplicación **no** incluye productos precargados ni semillas en inventario al instalarse o abrirse por primera vez.
2. **Cero Permisos Intrusivos:** IndexedDB y LocalStorage son APIs nativas del navegador móvil que no solicitan permisos al usuario, permitiendo lectura y guardado silencioso, privado y seguro.
3. **Indicador de Conexión en Tiempo Real:** Monitor visual sutil en el encabezado que valida la autonomía de la app en modo Online u Offline.
4. **Modo Simulación:** Si el operador o supervisor desea testear el sistema, puede presionar **"▶️ Iniciar Simulación"** en la sección *Pedir Precios*. Esto inyecta un escenario de prueba aislado (`isSimulation: true`), permitiendo verificar el marcado de precios, la selección de cantidades y la generación/compartición del PDF.
5. **Limpieza con un Clic:** La simulación se puede eliminar al instante con **"🗑️ Limpiar Simulación"**, dejando el inventario intacto.
6. **Vaciado Total:** Desde *Configuración*, el botón **"Vaciar / Restablecer Almacenamiento"** borra simultáneamente IndexedDB y LocalStorage.

---

## 5. Escala Oficial Ajustada de Control de Vencimientos por Colores

- 🟢 **Verde (> 7 días):** Producto en estado óptimo.
- 🟡 **Amarillo (5 a 7 días):** Alerta para pedir precios en los días de corte (Lunes / Jueves o Martes si hay festivo). Criterio estricto de rotación en el módulo de precios ($\le 7$ días).
- 🟠 **Naranja (3 a 4 días):** Atención urgente de rotación o descuento en mostrador.
- 🔴 **Rojo (≤ 2 días / Vencido):** Crítico / Retiro. Diseñado para retirar el producto del lineal o mostrador **1 día antes** de su vencimiento efectivo.

---

## 6. Portabilidad y Compartición Nativa (Web Share API)

Rotador implementa la pasarela nativa del sistema operativo (`navigator.share`):
- **Reportes PDF:** Se compilan en memoria como `Blob` y se transfieren a WhatsApp, Gmail o Drive con la función *Compartir Reporte PDF*.
- **Base de Datos Completa:** Se exporta como archivo JSON estructurado y se comparte con *Compartir Base de Datos* para sincronizar entre dispositivos o realizar respaldos manuales.

