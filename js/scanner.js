/**
 * scanner.js - Módulo de escaneo de código de barras
 * Utiliza la librería ZXing Browser (cargada vía CDN en el HTML)
 */

// Referencia al lector activo para poder detenerlo
let codeReader = null;
let activeControls = null;

/**
 * Inicia el escáner de código de barras usando la cámara
 * @param {HTMLVideoElement} videoElement - Elemento <video> para mostrar la cámara
 * @param {Function} onDetected - Callback que recibe el código detectado (string)
 * @returns {Promise<void>}
 */
export async function startScanner(videoElement, onDetected) {
  try {
    // Verificar que ZXing esté disponible globalmente
    if (typeof ZXing === 'undefined') {
      throw new Error('La librería ZXing no está cargada. Verifica la conexión a internet.');
    }

    // Crear instancia del lector de códigos de barras
    codeReader = new ZXing.BrowserMultiFormatReader();

    // Obtener lista de dispositivos de video disponibles
    const devices = await codeReader.listVideoInputDevices();

    if (!devices || devices.length === 0) {
      throw new Error('No se encontraron cámaras disponibles.');
    }

    // Preferir la cámara trasera (environment) para escaneo
    let selectedDeviceId = devices[0].deviceId;
    for (const device of devices) {
      if (device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('trasera') ||
          device.label.toLowerCase().includes('environment')) {
        selectedDeviceId = device.deviceId;
        break;
      }
    }

    // Iniciar decodificación continua desde la cámara
    activeControls = await codeReader.decodeFromVideoDevice(
      selectedDeviceId,
      videoElement,
      (result, error) => {
        if (result) {
          const code = result.getText();
          if (code && typeof onDetected === 'function') {
            onDetected(code);
          }
        }
        // Los errores de tipo NotFoundException son normales (no se detectó código aún)
        if (error && !(error instanceof ZXing.NotFoundException)) {
          console.warn('Error de escaneo:', error);
        }
      }
    );

  } catch (error) {
    console.error('Error iniciando el escáner:', error);
    throw error;
  }
}

/**
 * Detiene el escáner y libera la cámara
 */
export function stopScanner() {
  try {
    // Detener los controles activos si existen
    if (activeControls && typeof activeControls.stop === 'function') {
      activeControls.stop();
      activeControls = null;
    }

    // Resetear el lector
    if (codeReader && typeof codeReader.reset === 'function') {
      codeReader.reset();
    }
    codeReader = null;
  } catch (error) {
    console.warn('Error deteniendo el escáner:', error);
  }
}
