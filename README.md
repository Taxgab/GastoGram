# GastoGram
Un bot de Telegram serverless para registrar gastos diarios y "gastos hormiga" sin fricción, conectado directamente a Google Sheets.
# 💸 Bot de Gastos Personales (Telegram + Google Sheets)

## 🎯 Objetivo del proyecto
Crear un sistema que permita organizar los gastos por categorías personalizables y consultar reportes mensuales. El objetivo principal es entender en qué se gasta el dinero, prestando especial atención a los "gastos hormiga" que individualmente parecen insignificantes pero se acumulan a fin de mes.

## 💡 Problema que resuelve
Las aplicaciones de finanzas personales suelen ser complejas de usar en el momento del gasto. Este bot elimina esa fricción aprovechando la inmediatez de Telegram: ingresas el monto, el detalle, y luego categorizas con un solo botón.

## ✨ Características Principales
* **Ingreso sin fricción:** Escribe el monto y el detalle en un solo mensaje (ej: `1500 cafe`).
* **Categorización Rápida:** Botones integrados (Inline Keyboards) en el chat para clasificar el gasto al instante sin escribir de más.
* **Reportes en tiempo real:** Comando `/mes` para obtener un resumen del total gastado en el mes actual y un desglose por categoría.
* **100% Serverless y Gratuito:** Utiliza Google Apps Script como puente, alojando la base de datos en Google Sheets.

---

## 🚀 Instalación y Configuración

### Paso 1: Preparar Google Sheets
1. Crea una nueva hoja de cálculo en [Google Sheets](https://sheets.google.com).
2. Opcional: Define tus encabezados en la primera fila (A: Fecha, B: Monto, C: Descripción, D: Categoría, E: ID Chat).
3. Copia el **ID de tu hoja de cálculo** de la URL (la cadena larga entre `/d/` y `/edit`).

### Paso 2: Crear el Bot de Telegram
1. Abre Telegram y busca a **[@BotFather](https://t.me/botfather)**.
2. Envía `/newbot` y sigue las instrucciones.
3. Copia el **Token HTTP API**.

### Paso 3: Configurar Google Apps Script
1. En tu hoja de cálculo, ve a **Extensiones > Apps Script**.
2. Pega el contenido del archivo `Code.gs` de este repositorio.
3. Reemplaza `TU_TOKEN_DE_TELEGRAM_AQUI` y `TU_ID_DE_HOJA_DE_CALCULO_AQUI` con tus datos.

### Paso 4: Desplegar y conectar el Webhook
1. En Apps Script, haz clic en **Implementar > Nueva implementación**.
2. Selecciona **Aplicación web**. Configura: *Ejecutar como: Yo* | *Quién tiene acceso: Cualquier persona*.
3. Haz clic en **Implementar** y copia la **URL de la aplicación web**.
4. Pega esa URL en la variable `WEBHOOK_URL` de tu código en Apps Script y **guarda**.
5. En la barra superior, selecciona la función `setWebhook` y haz clic en **Ejecutar**.

---

## 📖 Cómo usarlo

1. **Registrar un gasto:** Envía un mensaje con el formato `[Monto] [Descripción]`.
   * *Ejemplo:* `2500 taxi al centro`
2. **Categorizar:** El bot te responderá con botones. Toca la categoría correspondiente (Transporte, Comida, etc.) y la hoja de cálculo se actualizará.
3. **Ver reporte:** Envía el comando `/mes` y el bot calculará todos los gastos del mes en curso, dándote el total y el resumen por categoría.
