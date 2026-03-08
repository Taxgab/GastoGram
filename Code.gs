const TOKEN = 'TU_TOKEN_DE_TELEGRAM_AQUI'; 
const SHEET_ID = 'TU_ID_DE_HOJA_DE_CALCULO_AQUI'; 
const WEBHOOK_URL = 'URL_DE_TU_WEB_APP_AQUI'; 

function setWebhook() {
  const url = `https://api.telegram.org/bot${TOKEN}/setWebhook?url=${WEBHOOK_URL}`;
  UrlFetchApp.fetch(url);
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);

    if (contents.message && contents.message.text) {
      procesarMensaje(contents.message);
    } else if (contents.callback_query) {
      procesarBoton(contents.callback_query);
    }
  } catch (error) {
    console.error(error);
  }
  return HtmlService.createHtmlOutput('OK');
}

// --- PROCESAR EL TEXTO ---
function procesarMensaje(message) {
  const chatId = message.chat.id;
  const text = message.text.trim();
  
  // NUEVO: Detectar el comando /mes
  if (text.toLowerCase() === '/mes') {
    generarReporteMensual(chatId);
    return; // Detenemos la ejecución aquí
  }

  const date = new Date(message.date * 1000);
  const partes = text.split(' ');
  const monto = parseFloat(partes[0].replace(',', '.'));
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();

  if (!isNaN(monto) && partes.length > 1) {
    const descripcion = partes.slice(1).join(' ');
    sheet.appendRow([date, monto, descripcion, "⏳ Pendiente", chatId]);
    const fila = sheet.getLastRow();
    enviarTecladoCategorias(chatId, monto, descripcion, fila);
  } else {
    sendMessage(chatId, `⚠️ Formato incorrecto.\n👉 Ejemplo: 1500 cafe\n📊 Para ver tus gastos envía /mes`);
  }
}

// --- GENERAR REPORTE DEL MES ---
function generarReporteMensual(chatId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues(); // Obtiene todos los datos de la hoja
  
  const fechaActual = new Date();
  const mesActual = fechaActual.getMonth();
  const anioActual = fechaActual.getFullYear();
  
  let totalMes = 0;
  let categorias = {};

  // Recorremos todas las filas
  for (let i = 0; i < data.length; i++) {
    const fila = data[i];
    const fechaCelda = fila[0];
    
    // Validamos que la celda A tenga una fecha válida (ignorando encabezados si los hay)
    if (fechaCelda instanceof Date) {
      if (fechaCelda.getMonth() === mesActual && fechaCelda.getFullYear() === anioActual) {
        const monto = parseFloat(fila[1]);
        const categoria = fila[3] || "Sin categoría";
        
        if (!isNaN(monto)) {
          totalMes += monto;
          // Sumamos al total de la categoría correspondiente
          categorias[categoria] = (categorias[categoria] || 0) + monto;
        }
      }
    }
  }

  // Armamos el mensaje visual
  let mensaje = `📊 *Resumen del Mes*\n\n`;
  mensaje += `💰 *Total Gastado: $${totalMes.toFixed(2)}*\n\n`;
  mensaje += `📈 *Por Categoría:*\n`;
  
  // Ordenamos las categorías
  for (let cat in categorias) {
    mensaje += `🔹 ${cat}: $${categorias[cat].toFixed(2)}\n`;
  }

  // Enviamos el mensaje con parse_mode Markdown para que se vean las negritas
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: mensaje,
      parse_mode: 'Markdown'
    })
  });
}

// --- ENVIAR LOS BOTONES ---
function enviarTecladoCategorias(chatId, monto, descripcion, fila) {
  const texto = `💸 Gasto de $${monto} en "${descripcion}".\n👇 Selecciona la categoría:`;
  const teclado = {
    inline_keyboard: [
      [
        { text: "🍎 Comida", callback_data: `cat_Comida_${fila}` },
        { text: "🚌 Transporte", callback_data: `cat_Transporte_${fila}` }
      ],
      [
        { text: "☕ Hormiga", callback_data: `cat_Hormiga_${fila}` },
        { text: "🛒 Súper", callback_data: `cat_Super_${fila}` }
      ]
    ]
  };

  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: texto, reply_markup: teclado })
  });
}

// --- PROCESAR EL CLIC EN EL BOTÓN ---
function procesarBoton(callbackQuery) {
  const data = callbackQuery.data; 
  const messageId = callbackQuery.message.message_id;
  const chatId = callbackQuery.message.chat.id;

  if (data.startsWith('cat_')) {
    const partesData = data.split('_');
    const categoria = partesData[1];
    const fila = parseInt(partesData[2]);

    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    sheet.getRange(fila, 4).setValue(categoria);

    const url = `https://api.telegram.org/bot${TOKEN}/editMessageText`;
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: `✅ Gasto registrado en *${categoria}*.`,
        parse_mode: 'Markdown'
      })
    });
  }
}

function sendMessage(chatId, text) {
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text })
  });
}
