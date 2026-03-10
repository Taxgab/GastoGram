/**
 * GastoGram - Bot de Telegram para registro de gastos personales
 * Versión 4.0 - Fase 3: Reportes Avanzados
 * 
 * CONFIGURACIÓN INICIAL:
 * 1. Ejecutar setup() la primera vez para guardar credenciales
 * 2. Agregar tu Telegram ID a la lista de usuarios autorizados
 */

// --- CONFIGURACIÓN ---
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// --- CATEGORÍAS DEFAULT (Fix 13) ---
const CATEGORIAS_DEFAULT = [
  { nombre: 'Comida', emoji: '🍎' },
  { nombre: 'Transporte', emoji: '🚌' },
  { nombre: 'Hormiga', emoji: '☕' },
  { nombre: 'Súper', emoji: '🛒' },
  { nombre: 'Salud', emoji: '💊' },
  { nombre: 'Ocio', emoji: '🎬' },
  { nombre: 'Servicios', emoji: '💡' },
  { nombre: 'Otros', emoji: '📦' }
];

// --- SANITIZACIÓN PARA GRÁFICO HTML (Fix 2) ---
function sanitizeForJS(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

// --- OBTENER ADMIN IDS DESDE PROPERTIES (Fix 1) ---
function getAdminIds() {
  const props = PropertiesService.getUserProperties();
  const ids = props.getProperty('ADMIN_IDS');
  return ids ? JSON.parse(ids) : [];
}

// --- FUNCIÓN UTILITARIA PARA FILTRADO (Fix 12) ---
function filtrarGastosPorMes(data, mes, anio) {
  return data.filter(fila => {
    const fechaCelda = fila[0];
    let fechaGasto = fechaCelda instanceof Date ? fechaCelda : new Date(fechaCelda);
    
    if (isNaN(fechaGasto.getTime())) return false;
    
    return fechaGasto.getMonth() === mes && fechaGasto.getFullYear() === anio;
  });
}

// --- TIMEZONE EN PARSEO DE FECHAS (Fix 9) ---
function obtenerMesAnioEnTimezone(fechaCelda, timezone) {
  let fecha;
  if (fechaCelda instanceof Date) {
    fecha = fechaCelda;
  } else {
    fecha = new Date(fechaCelda);
  }
  
  const fechaStr = Utilities.formatDate(fecha, timezone, 'yyyy-MM');
  const [anio, mes] = fechaStr.split('-').map(Number);
  return { mes: mes - 1, anio };
}

// --- SETUP INICIAL (ejecutar una vez desde Apps Script) ---
function setup() {
  const props = PropertiesService.getUserProperties();
  
  // Guardar configuración
  props.setProperty('TELEGRAM_TOKEN', 'TU_TOKEN_DE_TELEGRAM_AQUI');
  props.setProperty('SHEET_ID', 'TU_ID_DE_HOJA_DE_CALCULO_AQUI');
  props.setProperty('WEBHOOK_URL', 'URL_DE_TU_WEB_APP_AQUI');
  
  // Fix 1: Guardar ADMIN_IDS en PropertiesService
  props.setProperty('ADMIN_IDS', JSON.stringify([533617529])); // ID real del usuario
  
  // Inicializar categorías por defecto (Fix 13)
  props.setProperty('CATEGORIAS', JSON.stringify(CATEGORIAS_DEFAULT));
  
  // Inicializar presupuesto default (0 = sin presupuesto)
  if (!props.getProperty('PRESUPUESTO')) {
    props.setProperty('PRESUPUESTO', '0');
  }
  
  // Inicializar hoja de cálculo con encabezados
  const sheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getActiveSheet();
  sheet.getRange('A1:E1').setValues([['Fecha', 'Monto', 'Descripción', 'Categoría', 'ID Chat']]);
  sheet.getRange('A1:E1').setFontWeight('bold');
  
  Logger.log('✅ Configuración completada');
}

// --- OBTENER CREDENTIALS (Fix 4: Validación de configuración) ---
function getConfig() {
  const props = PropertiesService.getUserProperties();
  const token = props.getProperty('TELEGRAM_TOKEN');
  const sheetId = props.getProperty('SHEET_ID');
  
  if (!token || !sheetId) {
    throw new Error('Configuración incompleta. Ejecutá setup() primero.');
  }
  
  return { token, sheetId, webhookUrl: props.getProperty('WEBHOOK_URL') };
}

// --- VALIDAR USUARIO AUTORIZADO (Fix 1) ---
function isAuthorized(chatId) {
  return getAdminIds().includes(chatId);
}

// --- SET WEBHOOK ---
function setWebhook() {
  const config = getConfig();
  const url = `https://api.telegram.org/bot${config.token}/setWebhook?url=${config.webhookUrl}`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Webhook response: ' + response.getContentText());
}

// --- MANEJO DE COMANDOS (Fix 15: Mensajes de error claros) ---
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    
    if (contents.message && contents.message.text) {
      procesarMensaje(contents.message);
    } else if (contents.callback_query) {
      procesarBoton(contents.callback_query);
    }
  } catch (error) {
    Logger.error('Error en doPost: ' + error.toString());
    // Fix 15: No podemos enviar mensaje aquí porque no tenemos chatId
  }
  return HtmlService.createHtmlOutput('OK');
}

// --- PROCESAR MENSAJES ---
function procesarMensaje(message) {
  const chatId = message.chat.id;
  // Fix 7: Null reference fix
  const username = (message.from && message.from.username) || 
                   (message.from && message.from.first_name) || 
                   'Usuario';
  const text = message.text.trim();
  
  // VALIDACIÓN DE SEGURIDAD: Solo usuarios autorizados
  if (!isAuthorized(chatId)) {
    sendMessage(chatId, `🚫 Acceso denegado.\nEste bot es privado. Solo usuarios autorizados pueden usarlo.`);
    Logger.warning(`Intento de acceso no autorizado: ${chatId} (@${username})`);
    return;
  }
  
  // COMANDO /start
  if (text === '/start') {
    enviarBienvenida(chatId);
    return;
  }
  
  // COMANDO /ayuda
  if (text === '/ayuda' || text === '/help') {
    enviarAyuda(chatId);
    return;
  }
  
  // COMANDO /mes [MM-YYYY] (Fix 11: Handler extraído)
  if (text.toLowerCase().startsWith('/mes')) {
    handleComandoMes(chatId, text);
    return;
  }
  
  // COMANDO /historial [cantidad] (Fix 11: Handler extraído)
  if (text.startsWith('/historial')) {
    handleComandoHistorial(chatId, text);
    return;
  }
  
  // COMANDO /categorias (Fix 11: Handler extraído)
  if (text === '/categorias' || text.startsWith('/categorias ')) {
    handleComandoCategorias(chatId, text);
    return;
  }
  
  // COMANDO /exportar [MM-YYYY] (Fix 11: Handler extraído)
  if (text.startsWith('/exportar')) {
    handleComandoExportar(chatId, text);
    return;
  }
  
  // COMANDO /presupuesto [monto] (Fix 11: Handler extraído)
  if (text.startsWith('/presupuesto')) {
    handleComandoPresupuesto(chatId, text);
    return;
  }
  
  // COMANDO /grafico [MM-YYYY] (Fix 11: Handler extraído)
  if (text === '/grafico' || text.startsWith('/grafico ')) {
    handleComandoGrafico(chatId, text);
    return;
  }
  
  // COMANDO /alerta - Ver estado de alertas de presupuesto
  if (text === '/alerta') {
    verEstadoAlertas(chatId);
    return;
  }
  
  // PROCESAR GASTO (Fix 15: Manejo de errores claros)
  try {
    const date = new Date(message.date * 1000);
    const partes = text.split(' ');
    const monto = parseFloat(partes[0].replace(',', '.'));
    const config = getConfig();
    const sheet = SpreadsheetApp.openById(config.sheetId).getActiveSheet();

    if (!isNaN(monto) && partes.length > 1) {
      const descripcion = partes.slice(1).join(' ');
      
      // Usar timezone de Argentina
      const fechaAR = Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
      
      sheet.appendRow([fechaAR, monto, descripcion, '⏳ Pendiente', chatId]);
      const fila = sheet.getLastRow();
      
      // Verificar presupuesto después de registrar
      const mensajeGasto = enviarTecladoCategorias(chatId, monto, descripcion, fila);
      
      // Verificar si supera presupuesto
      verificarPresupuesto(chatId);
    } else {
      sendMessage(chatId, `⚠️ Formato incorrecto.\n\n👉 Ejemplo: 1500 cafe\n👉 Ejemplo: 2500.50 taxi al centro\n\n📊 Para ver tus gastos envía /mes\n📜 Para historial envía /historial\n🏷️ Para categorías envía /categorias\n📥 Para exportar envía /exportar\n💰 Para presupuesto envía /presupuesto\n📊 Para gráfico envía /grafico\n❓ Para ayuda envía /ayuda`);
    }
  } catch (error) {
    Logger.error('Error en procesarMensaje (procesar gasto): ' + error.toString());
    sendMessage(chatId, '⚠️ Ocurrió un error. Por favor intentá de nuevo en unos minutos.');
  }
}

// --- MENSAJE DE BIENVENIDA ---
function enviarBienvenida(chatId) {
  const mensaje = `👋 ¡Hola! Soy Gastogram, tu bot de gastos personales.\n\n` +
    `💡 *¿Cómo usarme?*\n` +
    `1️⃣ Envía un gasto: \`1500 cafe\`\n` +
    `2️⃣ Selecciona la categoría con los botones\n` +
    `3️⃣ ¡Listo! Tu gasto queda registrado\n\n` +
    `📊 *Comandos disponibles:*\n\n` +
    `*Reportes:*\n` +
    `/mes - Resumen del mes actual\n` +
    `/mes 03-2026 - Resumen de marzo 2026\n` +
    `/historial - Últimos 10 gastos\n` +
    `/historial 20 - Últimos 20 gastos\n` +
    `/exportar - Descargar CSV del mes actual\n` +
    `/exportar 03-2026 - CSV de marzo 2026\n` +
    `/grafico - Gráfico de categorías del mes\n` +
    `/grafico 03-2026 - Gráfico de marzo 2026\n\n` +
    `*Presupuesto:*\n` +
    `/presupuesto - Ver presupuesto y progreso\n` +
    `/presupuesto 50000 - Establecer presupuesto de $50000\n` +
    `/presupuesto reset - Eliminar presupuesto\n` +
    `/alerta - Ver estado de alertas\n\n` +
    `*Categorías:*\n` +
    `/categorias - Ver todas las categorías\n` +
    `/categorias agregar 🍕 Comida Rápida - Agregar nueva\n` +
    `/categorias eliminar Comida Rápida - Eliminar\n` +
    `/categorias reset - Volver a las originales\n\n` +
    `*Otros:*\n` +
    `/ayuda - Mostrar esta ayuda\n\n` +
    `🔒 Bot privado y seguro - Solo vos podés usarlo`;
  
  sendMessageMarkdown(chatId, mensaje);
}

// --- MENSAJE DE AYUDA ---
function enviarAyuda(chatId) {
  enviarBienvenida(chatId);
}

// --- MOSTRAR HISTORIAL ---
function mostrarHistorial(chatId, cantidad) {
  const config = getConfig();
  const sheet = SpreadsheetApp.openById(config.sheetId).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    sendMessage(chatId, '📭 No hay gastos registrados aún.');
    return;
  }
  
  const ultimosGastos = data.slice(1).reverse().slice(0, cantidad);
  
  let mensaje = `📜 *Últimos ${ultimosGastos.length} gastos:*\n\n`;
  
  ultimosGastos.forEach((fila, index) => {
    const fecha = fila[0];
    const monto = fila[1];
    const descripcion = fila[2];
    const categoria = fila[3];
    
    const catIcon = categoria === '⏳ Pendiente' ? '⏳' : '✅';
    
    mensaje += `${index + 1}. *$${monto}* - ${descripcion}\n`;
    mensaje += `   ${catIcon} ${categoria}\n\n`;
  });
  
  sendMessageMarkdown(chatId, mensaje);
}

// --- LECTURA POR BLOQUES PARA SHEETS GRANDES (Fix 5) ---
function getGastosDelMes(mes, anio) {
  const config = getConfig();
  const sheet = SpreadsheetApp.openById(config.sheetId).getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return [];
  
  const datos = [];
  const batchSize = 1000;
  
  for (let start = 2; start <= lastRow; start += batchSize) {
    const end = Math.min(start + batchSize - 1, lastRow);
    const batch = sheet.getRange(start, 1, end - start + 1, 5).getValues();
    
    batch.forEach(fila => {
      const fecha = new Date(fila[0]);
      if (fecha.getMonth() === mes && fecha.getFullYear() === anio) {
        datos.push(fila);
      }
    });
  }
  
  return datos;
}

// --- GENERAR REPORTE MENSUAL (Fix 5: Usa getGastosDelMes) ---
function generarReporteMensual(chatId, mes = null, anio = null) {
  if (mes === null || anio === null) {
    const fechaActual = new Date();
    const fechaAR = new Date(fechaActual.toLocaleString('en-US', {timeZone: TIMEZONE}));
    mes = fechaAR.getMonth();
    anio = fechaAR.getFullYear();
  }
  
  const gastosDelMes = getGastosDelMes(mes, anio);
  
  if (gastosDelMes.length === 0) {
    sendMessage(chatId, `📊 No hay gastos registrados en ${obtenerNombreMes(mes)} ${anio}.`);
    return;
  }
  
  let totalMes = 0;
  let categorias = {};

  gastosDelMes.forEach(fila => {
    const monto = parseFloat(fila[1]);
    const categoria = fila[3] || 'Sin categoría';
    
    if (!isNaN(monto)) {
      totalMes += monto;
      categorias[categoria] = (categorias[categoria] || 0) + monto;
    }
  });

  let mensaje = `📊 *Resumen de ${obtenerNombreMes(mes)} ${anio}*\n\n`;
  mensaje += `💰 *Total Gastado: $${totalMes.toFixed(2)}*\n`;
  mensaje += `📦 Gastos: ${gastosDelMes.length}\n\n`;
  mensaje += `📈 *Por Categoría:*\n`;
  
  const categoriasOrdenadas = Object.entries(categorias).sort((a, b) => b[1] - a[1]);
  
  categoriasOrdenadas.forEach(([cat, monto]) => {
    const porcentaje = ((monto / totalMes) * 100).toFixed(1);
    mensaje += `🔹 ${cat}: $${monto.toFixed(2)} (${porcentaje}%)\n`;
  });

  sendMessageMarkdown(chatId, mensaje);
}

// --- MOSTRAR CATEGORÍAS ---
function mostrarCategorias(chatId) {
  const categorias = getCategorias();
  
  let mensaje = `🏷️ *Tus categorías:*\n\n`;
  
  categorias.forEach((cat, index) => {
    mensaje += `${index + 1}. ${cat.emoji} ${cat.nombre}\n`;
  });
  
  mensaje += `\n💡 *Consejo:* Usá /categorias agregar 🍕 Pizza para agregar una nueva.`;
  
  sendMessageMarkdown(chatId, mensaje);
}

// --- AGREGAR CATEGORÍA ---
function agregarCategoria(chatId, emoji, nombre) {
  const props = PropertiesService.getUserProperties();
  const categorias = getCategorias();
  
  const existe = categorias.some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
  if (existe) {
    sendMessage(chatId, `⚠️ La categoría "${nombre}" ya existe.`);
    return;
  }
  
  categorias.push({ nombre: nombre, emoji: emoji });
  props.setProperty('CATEGORIAS', JSON.stringify(categorias));
  
  sendMessage(chatId, `✅ Categoría agregada: ${emoji} ${nombre}\n\nAhora tenés ${categorias.length} categorías.`);
}

// --- ELIMINAR CATEGORÍA ---
function eliminarCategoria(chatId, nombre) {
  const props = PropertiesService.getUserProperties();
  const categorias = getCategorias();
  
  const nuevasCategorias = categorias.filter(c => c.nombre.toLowerCase() !== nombre.toLowerCase());
  
  if (nuevasCategorias.length === categorias.length) {
    sendMessage(chatId, `⚠️ La categoría "${nombre}" no existe.`);
    return;
  }
  
  props.setProperty('CATEGORIAS', JSON.stringify(nuevasCategorias));
  
  sendMessage(chatId, `🗑️ Categoría eliminada: ${nombre}\n\nAhora tenés ${nuevasCategorias.length} categorías.`);
}

// --- RESETEAR CATEGORÍAS (Fix 13: Usa CATEGORIAS_DEFAULT) ---
function resetearCategorias(chatId) {
  const props = PropertiesService.getUserProperties();
  
  props.setProperty('CATEGORIAS', JSON.stringify(CATEGORIAS_DEFAULT));
  
  sendMessage(chatId, `🔄 Categorías reseteadas a las originales (${CATEGORIAS_DEFAULT.length} categorías).`);
}

// --- EXPORTAR CSV (Fix 5: Usa getGastosDelMes) ---
function exportarCSV(chatId, mes = null, anio = null) {
  const config = getConfig();
  
  if (mes === null || anio === null) {
    const fechaActual = new Date();
    const fechaAR = new Date(fechaActual.toLocaleString('en-US', {timeZone: TIMEZONE}));
    mes = fechaAR.getMonth();
    anio = fechaAR.getFullYear();
  }
  
  const gastosDelMes = getGastosDelMes(mes, anio);
  
  if (gastosDelMes.length === 0) {
    sendMessage(chatId, `📊 No hay gastos para exportar en ${obtenerNombreMes(mes)} ${anio}.`);
    return;
  }
  
  const gastosFiltrados = [['Fecha', 'Monto', 'Descripción', 'Categoría'], ...gastosDelMes];
  
  let csv = '';
  gastosFiltrados.forEach(fila => {
    csv += fila.map(celda => {
      const texto = String(celda).replace(/"/g, '""');
      return `"${texto}"`;
    }).join(',') + '\n';
  });
  
  const nombreArchivo = `gastos_${obtenerNombreMes(mes).toLowerCase()}_${anio}.csv`;
  const blob = Utilities.newBlob(csv, 'text/csv', nombreArchivo);
  const archivo = DriveApp.createFile(blob);
  
  const url = `https://api.telegram.org/bot${config.token}/sendDocument`;
  const formData = {
    chat_id: chatId,
    document: archivo.getBlob()
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'multipart/form-data',
    payload: formData
  });
  
  archivo.setTrashed(true);
  
  sendMessage(chatId, `📥 Archivo exportado: ${nombreArchivo}\n\n📊 Total de gastos: ${gastosDelMes.length}`);
}

// --- ESTABLECER PRESUPUESTO ---
function establecerPresupuesto(chatId, monto) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('PRESUPUESTO', monto.toString());
  
  sendMessageMarkdown(chatId, `💰 *Presupuesto establecido: $${monto.toLocaleString('es-AR')}*\n\n📊 Te avisaré cuando:\n• Alcanzes el 80% ($${(monto * 0.8).toLocaleString('es-AR')})\n• Alcanzes el 100% ($${monto.toLocaleString('es-AR')})\n\nUsá /presupuesto para ver tu progreso.`);
}

// --- VER PRESUPUESTO ---
function verPresupuesto(chatId) {
  const props = PropertiesService.getUserProperties();
  const presupuesto = parseFloat(props.getProperty('PRESUPUESTO') || '0');
  
  if (presupuesto <= 0) {
    sendMessage(chatId, '📊 No tenés un presupuesto establecido.\n\nUsá /presupuesto [monto] para establecer uno.\nEjemplo: /presupuesto 50000');
    return;
  }
  
  const fechaActual = new Date();
  const fechaAR = new Date(fechaActual.toLocaleString('en-US', {timeZone: TIMEZONE}));
  const mesActual = fechaAR.getMonth();
  const anioActual = fechaAR.getFullYear();
  
  const gastosDelMes = getGastosDelMes(mesActual, anioActual);
  
  let totalMes = 0;
  gastosDelMes.forEach(fila => {
    const monto = parseFloat(fila[1]);
    if (!isNaN(monto)) {
      totalMes += monto;
    }
  });
  
  const porcentaje = ((totalMes / presupuesto) * 100).toFixed(1);
  const restante = presupuesto - totalMes;
  
  let estado = '';
  if (porcentaje >= 100) {
    estado = '🚨 *¡PRESUPUESTO AGOTADO!*';
  } else if (porcentaje >= 80) {
    estado = '⚠️ *Atención: 80% alcanzado*';
  } else if (porcentaje >= 50) {
    estado = '📊 *Mitad del presupuesto usado*';
  } else {
    estado = '✅ *Presupuesto en rango seguro*';
  }
  
  let mensaje = `💰 *Estado del Presupuesto*\n\n`;
  mensaje += `${estado}\n\n`;
  mensaje += `📊 Gastado: *$${totalMes.toLocaleString('es-AR')}* (${porcentaje}%)\n`;
  mensaje += `💵 Presupuesto: *$${presupuesto.toLocaleString('es-AR')}*\n`;
  mensaje += `📈 Restante: *$${restante.toLocaleString('es-AR')}*\n\n`;
  
  // Barra de progreso
  const barrasLlenas = Math.floor(porcentaje / 10);
  const barrasVacias = 10 - barrasLlenas;
  mensaje += `🔵 ${'█'.repeat(barrasLlenas)}${'░'.repeat(barrasVacias)} ${porcentaje}%\n`;
  
  sendMessageMarkdown(chatId, mensaje);
}

// --- RESETEAR PRESUPUESTO ---
function resetearPresupuesto(chatId) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('PRESUPUESTO', '0');
  
  sendMessage(chatId, '🔄 Presupuesto eliminado.\n\nYa no recibirás alertas de presupuesto.');
}

// --- VERIFICAR PRESUPUESTO (después de cada gasto) (Fix 5: Usa getGastosDelMes) ---
function verificarPresupuesto(chatId) {
  const props = PropertiesService.getUserProperties();
  const presupuesto = parseFloat(props.getProperty('PRESUPUESTO') || '0');
  if (presupuesto <= 0) return;
  
  const fechaAR = new Date(new Date().toLocaleString('en-US', {timeZone: TIMEZONE}));
  const mesActual = fechaAR.getMonth();
  const anioActual = fechaAR.getFullYear();
  
  // Resetear alertas si es otro mes
  const alerta80Mes = props.getProperty('ALERTA_80_MONTH');
  const alerta80Anio = props.getProperty('ALERTA_80_YEAR');
  const alerta100Mes = props.getProperty('ALERTA_100_MONTH');
  const alerta100Anio = props.getProperty('ALERTA_100_YEAR');
  
  if (alerta80Mes !== mesActual.toString() || alerta80Anio !== anioActual.toString()) {
    props.setProperty('ALERTA_80_ENVIADA', 'false');
    props.setProperty('ALERTA_80_MONTH', mesActual.toString());
    props.setProperty('ALERTA_80_YEAR', anioActual.toString());
  }
  
  if (alerta100Mes !== mesActual.toString() || alerta100Anio !== anioActual.toString()) {
    props.setProperty('ALERTA_100_ENVIADA', 'false');
    props.setProperty('ALERTA_100_MONTH', mesActual.toString());
    props.setProperty('ALERTA_100_YEAR', anioActual.toString());
  }
  
  const gastosDelMes = getGastosDelMes(mesActual, anioActual);
  
  let totalMes = 0;
  gastosDelMes.forEach(fila => {
    const monto = parseFloat(fila[1]);
    if (!isNaN(monto)) {
      totalMes += monto;
    }
  });
  
  const porcentaje = (totalMes / presupuesto) * 100;
  
  const alerta80Enviada = props.getProperty('ALERTA_80_ENVIADA') === 'true';
  const alerta100Enviada = props.getProperty('ALERTA_100_ENVIADA') === 'true';
  
  if (porcentaje >= 100 && !alerta100Enviada) {
    sendMessageMarkdown(chatId, `🚨 *¡ALERTA CRÍTICA!*\n\n💸 Alcanzaste el 100% de tu presupuesto.\n\n📊 Total gastado: *$${totalMes.toLocaleString('es-AR')}*\n💰 Presupuesto: *$${presupuesto.toLocaleString('es-AR')}*\n\n⚠️ Cada gasto adicional será fuera de presupuesto.`);
    props.setProperty('ALERTA_100_ENVIADA', 'true');
  } else if (porcentaje >= 80 && !alerta80Enviada) {
    sendMessageMarkdown(chatId, `⚠️ *ALERTA DE PRESUPUESTO*\n\n📊 Alcanzaste el 80% de tu presupuesto.\n\n💵 Gastado: *$${totalMes.toLocaleString('es-AR')}*\n💰 Presupuesto: *$${presupuesto.toLocaleString('es-AR')}*\n📈 Restante: *$${(presupuesto - totalMes).toLocaleString('es-AR')}*\n\n💡 Revisá tus gastos con /mes para ver en qué estás gastando más.`);
    props.setProperty('ALERTA_80_ENVIADA', 'true');
  }
}

// --- VER ESTADO DE ALERTAS ---
function verEstadoAlertas(chatId) {
  const props = PropertiesService.getUserProperties();
  const presupuesto = parseFloat(props.getProperty('PRESUPUESTO') || '0');
  
  if (presupuesto <= 0) {
    sendMessage(chatId, '📊 No tenés presupuesto configurado.\n\nLas alertas se activan cuando establecés un presupuesto con /presupuesto [monto].');
    return;
  }
  
  const alerta80 = props.getProperty('ALERTA_80_ENVIADA') === 'true';
  const alerta100 = props.getProperty('ALERTA_100_ENVIADA') === 'true';
  
  let mensaje = `🔔 *Estado de Alertas*\n\n`;
  mensaje += `💰 Presupuesto: $${presupuesto.toLocaleString('es-AR')}\n\n`;
  mensaje += `⚠️ Alerta 80%: ${alerta80 ? '✅ Enviada' : '⏳ Pendiente'}\n`;
  mensaje += `🚨 Alerta 100%: ${alerta100 ? '✅ Enviada' : '⏳ Pendiente'}\n\n`;
  mensaje += `💡 Las alertas se resetean automáticamente cada mes.`;
  
  sendMessageMarkdown(chatId, mensaje);
}

// --- ENVIAR GRÁFICO (Fix 2: Sanitización + Fix 5: getGastosDelMes) ---
function enviarGrafico(chatId, mes = null, anio = null) {
  const config = getConfig();
  
  if (mes === null || anio === null) {
    const fechaActual = new Date();
    const fechaAR = new Date(fechaActual.toLocaleString('en-US', {timeZone: TIMEZONE}));
    mes = fechaAR.getMonth();
    anio = fechaAR.getFullYear();
  }
  
  const gastosDelMes = getGastosDelMes(mes, anio);
  
  if (gastosDelMes.length === 0) {
    sendMessage(chatId, `📊 No hay gastos para graficar en ${obtenerNombreMes(mes)} ${anio}.`);
    return;
  }
  
  let categorias = {};
  let totalMes = 0;

  gastosDelMes.forEach(fila => {
    const monto = parseFloat(fila[1]);
    const categoria = fila[3] || 'Sin categoría';
    
    if (!isNaN(monto)) {
      totalMes += monto;
      categorias[categoria] = (categorias[categoria] || 0) + monto;
    }
  });

  if (totalMes === 0) {
    sendMessage(chatId, `📊 No hay gastos para graficar en ${obtenerNombreMes(mes)} ${anio}.`);
    return;
  }

  // Ordenar categorías
  const categoriasOrdenadas = Object.entries(categorias).sort((a, b) => b[1] - a[1]);
  
  // Crear gráfico de barras con Google Charts
  const categoriasNombres = categoriasOrdenadas.map(c => c[0]);
  const categoriasMontos = categoriasOrdenadas.map(c => c[1]);
  
  // HTML del gráfico (Fix 2: Sanitización para prevenir XSS)
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load('current', {'packages':['corechart']});
      google.charts.setOnLoadCallback(drawChart);

      function drawChart() {
        var data = google.visualization.arrayToDataTable([
          ['Categoría', 'Monto'],
          ${categoriasOrdenadas.map(c => `['${sanitizeForJS(c[0])}', ${c[1]}]`).join(',\n          ')}
        ]);

        var options = {
          title: '${obtenerNombreMes(mes)} ${anio} - $${totalMes.toFixed(2)}',
          pieHole: 0.4,
          pieSliceTextStyle: {
            color: 'white',
          },
          backgroundColor: 'transparent',
          chartArea: {
            width: '90%',
            height: '90%'
          },
          colors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225']
        };

        var chart = new google.visualization.PieChart(document.getElementById('piechart'));
        chart.draw(data, options);
      }
    </script>
  </head>
  <body style="margin:0;padding:10px;">
    <div id="piechart" style="width: 400px; height: 400px;"></div>
  </body>
</html>
  `;
  
  // Guardar HTML temporalmente y convertir a imagen
  const htmlBlob = Utilities.newBlob(html, 'text/html', 'grafico.html');
  const archivoHtml = DriveApp.createFile(htmlBlob);
  
  // Nota: Google Apps Script no puede convertir HTML a imagen directamente
  // Enviamos un mensaje con los datos del gráfico en formato texto
  let mensaje = `📊 *Gráfico de ${obtenerNombreMes(mes)} ${anio}*\n\n`;
  mensaje += `💰 Total: *$${totalMes.toFixed(2)}*\n\n`;
  
  const maxMonto = Math.max(...categoriasMontos);
  
  categoriasOrdenadas.forEach(([cat, monto]) => {
    const barra = '█'.repeat(Math.round((monto / maxMonto) * 20));
    const porcentaje = ((monto / totalMes) * 100).toFixed(1);
    mensaje += `${barra} ${cat}: $${monto.toFixed(2)} (${porcentaje}%)\n`;
  });
  
  sendMessageMarkdown(chatId, mensaje);
  
  // Limpieza: eliminar archivo HTML temporal
  archivoHtml.setTrashed(true);
}

// --- OBTENER NOMBRE DEL MES ---
function obtenerNombreMes(mes) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return meses[mes];
}

// --- ENVIAR TECLADO DE CATEGORÍAS ---
function enviarTecladoCategorias(chatId, monto, descripcion, fila) {
  const texto = `💸 Gasto de *$${monto}* en "${descripcion}".\n👇 Selecciona la categoría:`;
  
  const categorias = getCategorias();
  
  const keyboard = [];
  for (let i = 0; i < categorias.length; i += 2) {
    const row = [];
    row.push({ text: categorias[i].emoji + ' ' + categorias[i].nombre, callback_data: `cat_${categorias[i].nombre}_${fila}` });
    if (i + 1 < categorias.length) {
      row.push({ text: categorias[i+1].emoji + ' ' + categorias[i+1].nombre, callback_data: `cat_${categorias[i+1].nombre}_${fila}` });
    }
    keyboard.push(row);
  }
  
  const teclado = { inline_keyboard: keyboard };

  sendMessageWithKeyboard(chatId, texto, teclado);
}

// --- OBTENER CATEGORÍAS (Fix 13: Usa CATEGORIAS_DEFAULT) ---
function getCategorias() {
  const props = PropertiesService.getUserProperties();
  const categoriasGuardadas = props.getProperty('CATEGORIAS');
  
  if (categoriasGuardadas) {
    return JSON.parse(categoriasGuardadas);
  }
  
  return CATEGORIAS_DEFAULT;
}

// --- PROCESAR BOTÓN (Fix 3: Validación completa + Fix 8: LockService + Fix 14: Validación callback data) ---
function procesarBoton(callbackQuery) {
  const lock = LockService.getUserLock();
  lock.waitLock(10000);
  
  try {
    const chatId = callbackQuery.message.chat.id;
    
    // Fix 3: Validación completa con notificación al usuario
    if (!isAuthorized(chatId)) {
      Logger.warning(`Intento no autorizado en botón: ${chatId}`);
      sendMessage(chatId, '🚫 Acceso denegado. Este bot es privado.');
      return;
    }
    
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    
    // Fix 14: Validación de callback data
    if (!data || !data.startsWith('cat_')) {
      Logger.warning('Callback data inválido: ' + data);
      return;
    }
    
    const partesData = data.split('_');
    if (partesData.length !== 3) {
      Logger.warning('Formato de callback inválido: ' + data);
      return;
    }
    
    const categoria = partesData[1];
    const fila = parseInt(partesData[2]);
    
    // Validar rango de fila
    const config = getConfig();
    const sheet = SpreadsheetApp.openById(config.sheetId).getActiveSheet();
    const maxFila = sheet.getLastRow();
    if (fila < 2 || fila > maxFila) {
      Logger.warning(`Intento de escribir fila inválida: ${fila}`);
      return;
    }
    
    sheet.getRange(fila, 4).setValue(categoria);
    
    const url = `https://api.telegram.org/bot${config.token}/editMessageText`;
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: `✅ Gasto registrado en *${categoria}*.\n💰 Listo para el próximo gasto.`,
        parse_mode: 'Markdown'
      })
    });
  } finally {
    lock.releaseLock();
  }
}

// --- FUNCIONES DE ENVÍO (Fix 10: Manejo de errores en UrlFetchApp) ---
function sendMessage(chatId, text) {
  try {
    const config = getConfig();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.error('Error enviando mensaje: ' + response.getContentText());
    }
  } catch (error) {
    Logger.error('Excepción en sendMessage: ' + error.toString());
  }
}

function sendMessageMarkdown(chatId, text) {
  try {
    const config = getConfig();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ 
        chat_id: chatId, 
        text: text,
        parse_mode: 'Markdown'
      }),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.error('Error enviando mensaje Markdown: ' + response.getContentText());
    }
  } catch (error) {
    Logger.error('Excepción en sendMessageMarkdown: ' + error.toString());
  }
}

function sendMessageWithKeyboard(chatId, text, keyboard) {
  try {
    const config = getConfig();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ 
        chat_id: chatId, 
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.error('Error enviando mensaje con teclado: ' + response.getContentText());
    }
  } catch (error) {
    Logger.error('Excepción en sendMessageWithKeyboard: ' + error.toString());
  }
}

// ============================================================================
// FIX 11: HANDLERS DE COMANDOS EXTRAÍDOS
// ============================================================================

// --- HANDLER /mes ---
function handleComandoMes(chatId, text) {
  const partes = text.split(' ');
  if (partes.length > 1) {
    const fechaPartes = partes[1].split('-');
    if (fechaPartes.length === 2) {
      const mes = parseInt(fechaPartes[0]) - 1;
      const anio = parseInt(fechaPartes[1]);
      if (!isNaN(mes) && !isNaN(anio) && mes >= 0 && mes <= 11 && anio >= 2020 && anio <= 2100) {
        generarReporteMensual(chatId, mes, anio);
        return;
      }
    }
    sendMessage(chatId, '⚠️ Formato inválido. Usá: /mes MM-YYYY\nEjemplo: /mes 03-2026');
    return;
  }
  generarReporteMensual(chatId);
}

// --- HANDLER /historial ---
function handleComandoHistorial(chatId, text) {
  const partes = text.split(' ');
  const cantidad = Math.min(
    partes.length > 1 ? parseInt(partes[1]) : 10,
    50
  );
  mostrarHistorial(chatId, cantidad);
}

// --- HANDLER /exportar ---
function handleComandoExportar(chatId, text) {
  const partes = text.split(' ');
  if (partes.length > 1) {
    const fechaPartes = partes[1].split('-');
    if (fechaPartes.length === 2) {
      const mes = parseInt(fechaPartes[0]) - 1;
      const anio = parseInt(fechaPartes[1]);
      if (!isNaN(mes) && !isNaN(anio) && mes >= 0 && mes <= 11 && anio >= 2020 && anio <= 2100) {
        exportarCSV(chatId, mes, anio);
        return;
      }
    }
    sendMessage(chatId, '⚠️ Formato: /exportar MM-YYYY\nEjemplo: /exportar 03-2026');
    return;
  }
  exportarCSV(chatId);
}

// --- HANDLER /presupuesto ---
function handleComandoPresupuesto(chatId, text) {
  const partes = text.split(' ');
  if (partes.length > 1) {
    if (partes[1] === 'reset') {
      resetearPresupuesto(chatId);
      return;
    }
    const monto = parseFloat(partes[1].replace(',', '.'));
    if (!isNaN(monto) && monto > 0) {
      establecerPresupuesto(chatId, monto);
      return;
    }
    sendMessage(chatId, '⚠️ Monto inválido. Ejemplo: /presupuesto 50000');
    return;
  }
  verPresupuesto(chatId);
}

// --- HANDLER /grafico ---
function handleComandoGrafico(chatId, text) {
  const partes = text.split(' ');
  if (partes.length > 1) {
    const fechaPartes = partes[1].split('-');
    if (fechaPartes.length === 2) {
      const mes = parseInt(fechaPartes[0]) - 1;
      const anio = parseInt(fechaPartes[1]);
      if (!isNaN(mes) && !isNaN(anio) && mes >= 0 && mes <= 11 && anio >= 2020 && anio <= 2100) {
        enviarGrafico(chatId, mes, anio);
        return;
      }
    }
    sendMessage(chatId, '⚠️ Formato: /grafico MM-YYYY\nEjemplo: /grafico 03-2026');
    return;
  }
  enviarGrafico(chatId);
}

// --- HANDLER /categorias ---
function handleComandoCategorias(chatId, text) {
  if (text === '/categorias') {
    mostrarCategorias(chatId);
    return;
  }
  
  if (text.startsWith('/categorias agregar')) {
    const match = text.match(/\/categorias agregar\s+(\S+)\s+(.+)/);
    if (match && match.length === 3) {
      agregarCategoria(chatId, match[1], match[2].trim());
      return;
    }
    sendMessage(chatId, '⚠️ Formato: /categorias agregar 🍕 Comida Rápida');
    return;
  }
  
  if (text.startsWith('/categorias eliminar')) {
    const nombre = text.replace('/categorias eliminar', '').trim();
    if (nombre) {
      eliminarCategoria(chatId, nombre);
      return;
    }
    sendMessage(chatId, '⚠️ Formato: /categorias eliminar Comida Rápida');
    return;
  }
  
  if (text === '/categorias reset') {
    resetearCategorias(chatId);
    return;
  }
}
