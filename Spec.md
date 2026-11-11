Actúa como un desarrollador experto en frontend y arquitecto de Progressive Web Apps (PWA) móviles. 

Necesito construir y estructurar un aplicativo web móvil ("Mobile-First") optimizado para navegadores móviles (Chrome/Safari) y preparado para GitHub Pages, enfocado en el control estricto de fechas de vencimiento y gestión de precios para un supermercado/carnicería.

La aplicación debe contar con los siguientes módulos, lógica de negocio y requerimientos específicos:

1. Estructura y Secciones Principales:
   - Separación clara entre dos áreas de trabajo independientes con idénticas funciones: 
     • AUTOSERVICIO
     • ATENDIDA
   - Cada sección gestiona su propio inventario de productos de forma aislada.

2. Estructura de Datos y Métodos de Entrada:
   - Cada registro debe almacenar:
     • Nombre del producto
     • PLU o Código de Barras (EAN)
     • Fecha de Vencimiento
     • Sección (Autoservicio / Atendida)
     • Tipo de Medida (Seleccionable entre: Unidades o Kilogramos / Kg)
     • Notas adicionales o lote.
   - *Métodos de Entrada:*
     • *Manual:* Ingresando directamente los datos por teclado.
     • *Escaneo por cámara:* Integrar una función de lectura de códigos de barras mediante la cámara del dispositivo móvil (usando librerías web ligeras como ZXing o QuaggaJS vía CDN) para capturar el código EAN/PLU de forma automática y agilizar el registro.

3. Sistema de Alertas Visuales por Vencimiento:
   - Cálculo automático de días restantes hasta la fecha de vencimiento.
   - Indicadores de alerta con código de colores para:
     • 6 días de anticipación (Próximo a vencer / Precaución)
     • 3 días de anticipación (Urgente / Revisar rotación)
     • 1 día de anticipación / Vencido (Crítico)

4. Módulo Especial de Reportes ("Pedir Precios" / Pedidos y Seguimiento):
   - *Regla de Días y Festivos:* Por defecto, los días de pedir precios son *lunes y jueves. Sin embargo, la app debe incluir un selector o lógica para indicar **si el lunes es festivo, trasladando automáticamente la tarea de pedido para el **día martes* (manteniendo el jueves).
   - *Filtro de Reporte:* El sistema debe filtrar y mostrar un listado consolidado de los productos próximos a vencer en ese rango de días crítico.
   - *Ingreso de cantidades y Estado de Pedido (¡Muy Importante!):*
     • En la vista de reporte se debe poder ingresar directamente la cantidad a pedir (respetando si es Unidades o Kg).
     • Debe existir una casilla o botón para *marcar los productos a los que ya se les pidió precio*.
     • Al día siguiente (o en el siguiente corte), la app debe permitir identificar o filtrar claramente *los productos a los que NO se les dio precio* del día anterior para relanzar la gestión.

5. Persistencia y Portabilidad:
   - Almacenamiento local mediante LocalStorage para que los datos persistan de forma segura en el dispositivo móvil sin necesidad de backend.
   - Funcionalidad de Exportar e Importar respaldos en formato JSON.
   - Configuración de PWA (manifest.json y Service Worker) para permitir instalar el aplicativo en la pantalla de inicio del celular.

Por favor, genérame el código completo y funcional (HTML, Tailwind CSS vía CDN, y JavaScript modular) con una interfaz sumamente fluida, limpia y diseñada para uso rápido con una sola mano en dispositivos móviles.