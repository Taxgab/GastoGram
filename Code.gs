/**
 * GastoGram - Bot de Telegram para registro de gastos personales
 * Versión 2.0 - Con seguridad mejorada
 * 
 * CONFIGURACIÓN INICIAL:
 * 1. Ejecutar setup() la primera vez para guardar credenciales
 * 2. Agregar tu Telegram ID a la lista de usuarios autorizados
 */

// --- CONFIGURACIÓN ---
const ADMIN_IDS = [533617529]; // IDs de Telegram autorizados (agregar más si es necesario)
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// --- SETUP INICIAL (ejecutar una vez desde Apps Script) ---
function setup() {
  const props = PropertiesService.getUserProperties();
  
  // Guardar configuración
  props.setProperty('TELEGRAM_TOKEN', 'TU_TOKEN_DE_TELEGRAM_AQUI');
  props.setProperty('SHEET_ID', 'TU_ID_DE_HOJA_DE_CALCULO_AQUI');
  props.setProperty('WEBHOOK_URL', 'URL_DE_TU_WEB_APP_AQUI');
  
  // Inicializar hoja de cálculo con encabezados
  const sheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getActiveSheet();
  sheet.getRange('A1:E1').setValues([['Fecha', 'Monto', 'Descripción', 'Categoría', 'ID Chat']]);
  sheet.getRange('A1:E1').setFontWeight('bold');
  
  Logger.log('✅ Configuración completada');
}

// --- OBTENER CREDENTIALS ---
function getConfig() {
  const props = PropertiesService.getUserProperties();
  return {
    token: props.getProperty('TELEGRAM_TOKEN'),
    sheetId: props.getProperty('SHEET_ID'),
    webhookUrl: props.getProperty('WEBHOOK_URL')
  };
}

// --- VALIDAR USUARIO AUTORIZADO ---
function isAuthorized(chatId) {
  return ADMIN_IDS.includes(chatId);
}

// --- SET WEBHOOK ---
function setWebhook() {
  const config = getConfig();
  const url = `https://api.telegram.org/bot${config.token}/setWebhook?url=${config.webhookUrl}`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Webhook response: ' + response.getContentText());
}

// --- MANEJO DE COMANDOS ---
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
  }
  return HtmlService.createHtmlOutput('OK');
}

// --- PROCESAR MENSAJES ---
function procesarMensaje(message) {
  const chatId = message.chat.id;
  const username = message.from.username || message.from.first_name;
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
  
  // COMANDO /mes
  if (text.toLowerCase() === '/mes') {
    generarReporteMensual(chatId);
    return;
  }
  
  // COMANDO /historial (nuevo)
  if (text.startsWith('/historial')) {
    const partes = text.split(' ');
    const cantidad = partes.length > 1 ? parseInt(partes[1]) : 10;
    mostrarHistorial(chatId, cantidad);
    return;
  }
  
  // PROCESAR GASTO
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
    enviarTecladoCategorias(chatId, monto, descripcion, fila);
  } else {
    sendMessage(chatId, `⚠️ Formato incorrecto.\n\n👉 Ejemplo: 1500 cafe\n👉 Ejemplo: 2500.50 taxi al centro\n\n📊 Para ver tus gastos envía /mes\n📜 Para historial envía /historial\n❓ Para ayuda envía /ayuda`);
  }
}

// --- MENSAJE DE BIENVENIDA ---
function enviarBienvenida(chatId) {
  const mensaje = `👋 ¡Hola! Soy Gastogram, tu bot de gastos personales.\n\n` +
    `💡 *¿Cómo usarme?*\n` +
    `1️⃣ Envía un gasto: \`1500 cafe\`\n` +
    `2️⃣ Selecciona la categoría con los botones\n` +
    `3️⃣ ¡Listo! Tu gasto queda registrado\n\n` +
    `📊 *Comandos disponibles:*\n` +
    `/mes - Ver resumen del mes actual\n` +
    `/historial - Ver últimos 10 gastos\n` +
    `/historial 20 - Ver últimos 20 gastos\n` +
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
  
  // Obtener últimos N gastos (excluyendo encabezado)
  const ultimosGastos = data.slice(1).reverse().slice(0, cantidad);
  
  let mensaje = `📜 *Últimos ${ultimosGastos.length} gastos:*\n\n`;
  
  ultimosGastos.forEach((fila, index) => {
    const fecha = fila[0];
    const monto = fila[1];
    const descripcion = fila[2];
    const categoria = fila[3];
    
    // Formatear categoría
    const catIcon = categoria === '⏳ Pendiente' ? '⏳' : '✅';
    
    mensaje += `${index + 1}. *$${monto}* - ${descripcion}\n`;
    mensaje += `   ${catIcon} ${categoria}\n\n`;
  });
  
  sendMessageMarkdown(chatId, mensaje);
}

// --- GENERAR REPORTE MENSUAL ---
function generarReporteMensual(chatId) {
  const config = getConfig();
  const sheet = SpreadsheetApp.openById(config.sheetId).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Obtener fecha actual en timezone AR
  const fechaActual = new Date();
  const fechaAR = new Date(fechaActual.toLocaleString('en-US', {timeZone: TIMEZONE}));
  const mesActual = fechaAR.getMonth();
  const anioActual = fechaAR.getFullYear();
  
  let totalMes = 0;
  let categorias = {};
  let gastosContabilizados = 0;

  for (let i = 1; i < data.length; i++) { // Empezar en 1 para saltar encabezado
    const fila = data[i];
    const fechaCelda = fila[0];
    
    // Parsear fecha (puede ser string o Date)
    let fechaGasto;
    if (fechaCelda instanceof Date) {
      fechaGasto = fechaCelda;
    } else {
      fechaGasto = new Date(fechaCelda);
    }
    
    if (!isNaN(fechaGasto.getTime())) {
      if (fechaGasto.getMonth() === mesActual && fechaGasto.getFullYear() === anioActual) {
        const monto = parseFloat(fila[1]);
        const categoria = fila[3] || 'Sin categoría';
        
        if (!isNaN(monto)) {
          totalMes += monto;
          categorias[categoria] = (categorias[categoria] || 0) + monto;
          gastosContabilizados++;
        }
      }
    }
  }

  if (totalMes === 0) {
    sendMessage(chatId, `📊 No hay gastos registrados en ${obtenerNombreMes(mesActual)}.`);
    return;
  }

  let mensaje = `📊 *Resumen de ${obtenerNombreMes(mesActual)} ${anioActual}*\n\n`;
  mensaje += `💰 *Total Gastado: $${totalMes.toFixed(2)}*\n`;
  mensaje += `📦 Gastos: ${gastosContabilizados}\n\n`;
  mensaje += `📈 *Por Categoría:*\n`;
  
  // Ordenar categorías por monto (mayor a menor)
  const categoriasOrdenadas = Object.entries(categorias).sort((a, b) => b[1] - a[1]);
  
  categoriasOrdenadas.forEach(([cat, monto]) => {
    const porcentaje = ((monto / totalMes) * 100).toFixed(1);
    mensaje += `🔹 ${cat}: $${monto.toFixed(2)} (${porcentaje}%)\n`;
  });

  sendMessageMarkdown(chatId, mensaje);
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
  
  // Obtener categorías guardadas o usar default
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

// --- OBTENER CATEGORÍAS ---
function getCategorias() {
  const props = PropertiesService.getUserProperties();
  const categoriasGuardadas = props.getProperty('CATEGORIAS');
  
  if (categoriasGuardadas) {
    return JSON.parse(categoriasGuardadas);
  }
  
  // Categorías por defecto
  return [
    { nombre: 'Comida', emoji: '🍎' },
    { nombre: 'Transporte', emoji: '🚌' },
    { nombre: 'Hormiga', emoji: '☕' },
    { nombre: 'Súper', emoji: '🛒' },
    { nombre: 'Salud', emoji: '💊' },
    { nombre: 'Ocio', emoji: '🎬' },
    { nombre: 'Servicios', emoji: '💡' },
    { nombre: 'Otros', emoji: '📦' }
  ];
}

// --- PROCESAR BOTÓN ---
function procesarBoton(callbackQuery) {
  const data = callbackQuery.data; 
  const messageId = callbackQuery.message.message_id;
  const chatId = callbackQuery.message.chat.id;

  if (data.startsWith('cat_')) {
    const partesData = data.split('_');
    const categoria = partesData[1];
    const fila = parseInt(partesData[2]);

    const config = getConfig();
    const sheet = SpreadsheetApp.openById(config.sheetId).getActiveSheet();
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
  }
}

// --- FUNCIONES DE ENVÍO ---
function sendMessage(chatId, text) {
  const config = getConfig();
  UrlFetchApp.fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text })
  });
}

function sendMessageMarkdown(chatId, text) {
  const config = getConfig();
  UrlFetchApp.fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ 
      chat_id: chatId, 
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

function sendMessageWithKeyboard(chatId, text, keyboard) {
  const config = getConfig();
  UrlFetchApp.fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ 
      chat_id: chatId, 
      text: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  });
}
