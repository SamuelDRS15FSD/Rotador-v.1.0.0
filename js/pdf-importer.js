/**
 * pdf-importer.js - Módulo de extracción y carga masiva mediante documentos PDF
 * Utiliza Mozilla PDF.js en el cliente sin requerir ningún backend externo.
 */
import { toLocalDateStr } from './store.js';


/**
 * Extrae texto plano completo de un archivo PDF usando PDF.js
 * @param {ArrayBuffer} arrayBuffer - Contenido del PDF
 * @returns {Promise<{ fullText: string, lines: Array<string> }>}
 */
export async function extractTextFromPDF(arrayBuffer) {
  if (typeof window.pdfjsLib === 'undefined') {
    throw new Error('La librería PDF.js no está cargada. Verifica tu conexión a internet.');
  }

  // Configurar worker de PDF.js
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let allLines = [];
  let fullTextParts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    // Reconstruir líneas ordenadas según posición vertical Y
    const items = textContent.items;
    let currentLineY = null;
    let lineText = '';

    for (const item of items) {
      const itemStr = item.str || '';
      if (!itemStr.trim() && itemStr !== ' ') continue;

      if (currentLineY === null || Math.abs(item.transform[5] - currentLineY) < 5) {
        lineText += ' ' + itemStr;
        currentLineY = item.transform[5];
      } else {
        if (lineText.trim()) {
          allLines.push(lineText.trim());
          fullTextParts.push(lineText.trim());
        }
        lineText = itemStr;
        currentLineY = item.transform[5];
      }
    }

    if (lineText.trim()) {
      allLines.push(lineText.trim());
      fullTextParts.push(lineText.trim());
    }
  }

  return {
    fullText: fullTextParts.join('\n'),
    lines: allLines
  };
}

/**
 * Analiza las líneas del PDF y extrae automáticamente Proveedor, Nombre, PLU/EAN y Cantidad
 * @param {Array<string>} lines - Líneas extraídas del PDF
 * @param {string} fullText - Texto completo
 * @returns {{ detectedProvider: string, items: Array<Object> }}
 */
export function parseCarniceriaPDF(lines, fullText) {
  let detectedProvider = 'Proveedor General';

  // 1. Detectar Proveedor en cabeceras
  const providerRegexes = [
    /proveedor[:\s]+([^\n\r,;|]+)/i,
    /raz[oó]n\s+social[:\s]+([^\n\r,;|]+)/i,
    /empresa[:\s]+([^\n\r,;|]+)/i,
    /frigor[ií]fico\s+([^\n\r,;|]+)/i,
    /av[ií]cola\s+([^\n\r,;|]+)/i,
    /distribuidora\s+([^\n\r,;|]+)/i,
    /caba[ñn]a\s+([^\n\r,;|]+)/i
  ];

  for (const rx of providerRegexes) {
    const match = fullText.match(rx);
    if (match && match[1]) {
      const clean = match[1].trim().replace(/[.:-]+$/, '');
      if (clean.length > 2 && clean.length < 50) {
        detectedProvider = clean;
        break;
      }
    }
  }

  // Si no se encontró por regex, buscar en las primeras 5 líneas
  if (detectedProvider === 'Proveedor General' && lines.length > 0) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (/frigor|carn|av[ií]c|alimento|comercial|distrib/i.test(line)) {
        detectedProvider = line.replace(/^[#\d\s\-:.]+/g, '').trim();
        break;
      }
    }
  }

  const items = [];
  const defaultExpiry = new Date();
  defaultExpiry.setDate(defaultExpiry.getDate() + 5);
  const defaultExpiryStr = toLocalDateStr(defaultExpiry);

  // Términos comunes cárnicos para ayudar a identificar nombres
  const meatTerms = /bife|pollo|milanesa|carne|chorizo|asado|lomo|vacio|cuadril|cerdo|matambre|costilla|pechuga|hamburguesa|molida|bondiola|piqueo|embutido|alitas|muslo|paleta/i;

  for (const line of lines) {
    // Descartar cabeceras típicas de facturas
    if (/^(página|page|fecha|total|subtotal|iva|cuit|nit|dirección|telefono|tel|remisión|factura|orden)/i.test(line.trim())) {
      continue;
    }

    // Buscar código (PLU o EAN): secuencias numéricas de 3 a 14 dígitos
    const codeMatch = line.match(/\b(\d{3,14})\b/);
    if (!codeMatch) continue;

    const code = codeMatch[1];

    // Descartar si el número parece ser un año (ej. 2024, 2025, 2026, 2027) aislado
    if ((code === '2024' || code === '2025' || code === '2026' || code === '2027') && line.length < 20) {
      continue;
    }

    // Extraer texto restante eliminando el código
    let textWithoutCode = line.replace(code, ' ').trim();

    // Buscar si hay cantidad y unidad en la línea (ej. 12.5 kg, 20 uds, 15.00)
    let detectedQty = 1;
    let measureType = 'unidades';

    const qtyKgMatch = textWithoutCode.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos|kilogramos)/i);
    const qtyUdsMatch = textWithoutCode.match(/(\d+)\s*(?:uds|unid|unidades|pzas|piezas)/i);

    if (qtyKgMatch) {
      detectedQty = parseFloat(qtyKgMatch[1].replace(',', '.'));
      measureType = 'kilogramos';
      textWithoutCode = textWithoutCode.replace(qtyKgMatch[0], ' ');
    } else if (qtyUdsMatch) {
      detectedQty = parseInt(qtyUdsMatch[1], 10);
      measureType = 'unidades';
      textWithoutCode = textWithoutCode.replace(qtyUdsMatch[0], ' ');
    } else {
      // Buscar cualquier número decimal que represente peso
      const genericNumMatch = textWithoutCode.match(/\b(\d+[.,]\d{1,3})\b/);
      if (genericNumMatch) {
        detectedQty = parseFloat(genericNumMatch[1].replace(',', '.'));
        measureType = 'kilogramos';
        textWithoutCode = textWithoutCode.replace(genericNumMatch[0], ' ');
      }
    }

    // Limpiar nombre del producto
    let name = textWithoutCode
      .replace(/[\$€]/g, '')
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[-\s.:,;|]+|[-\s.:,;|]+$/g, '')
      .trim();

    // Si tiene palabras cárnicas o una longitud razonable
    if (name.length >= 3 && !/^(total|subtotal|iva|precio|importe|descuento)/i.test(name)) {
      // Determinar sección tentativa según si es por peso o unidades o términos
      const isAtendida = /milanesa|chorizo|mostrador|molida|corte/i.test(name);
      const section = isAtendida ? 'atendida' : 'autoservicio';

      items.push({
        id: 'pdf_' + Math.random().toString(36).substring(2, 9),
        name: name,
        plu: code,
        provider: detectedProvider,
        measureType: measureType,
        cantidad: detectedQty > 0 ? detectedQty : (measureType === 'kilogramos' ? 5.0 : 10),
        section: section,
        expiryDate: defaultExpiryStr,
        selected: true
      });
    }
  }

  // Eliminar duplicados por código o nombre
  const uniqueItems = [];
  const seenCodes = new Set();
  const seenNames = new Set();

  for (const item of items) {
    const key = item.plu + '_' + item.name.toLowerCase();
    if (!seenCodes.has(item.plu) && !seenNames.has(item.name.toLowerCase())) {
      seenCodes.add(item.plu);
      seenNames.add(item.name.toLowerCase());
      uniqueItems.push(item);
    }
  }

  return {
    detectedProvider,
    items: uniqueItems
  };
}

