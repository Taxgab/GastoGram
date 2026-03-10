# 💸 Gastogram - Bot de Gastos Personales

**Versión:** 2.0 (Con seguridad mejorada)

Un bot de Telegram serverless para registrar gastos diarios y "gastos hormiga" sin fricción, conectado directamente a Google Sheets.

---

## 🎯 Objetivo del proyecto

Crear un sistema que permita organizar los gastos por categorías personalizables y consultar reportes mensuales. El objetivo principal es entender en qué se gasta el dinero, prestando especial atención a los "gastos hormiga" que individualmente parecen insignificantes pero se acumulan a fin de mes.

## 💡 Problema que resuelve

Las aplicaciones de finanzas personales suelen ser complejas de usar en el momento del gasto. Este bot elimina esa fricción aprovechando la inmediatez de Telegram: ingresas el monto, el detalle, y luego categorizas con un solo botón.

## ✨ Características Principales

* **🔒 Seguro:** Solo usuarios autorizados pueden usar el bot
* **🚀 Ingreso sin fricción:** Escribe el monto y el detalle en un solo mensaje (ej: `1500 cafe`)
* **📱 Categorización Rápida:** Botones integrados (Inline Keyboards) en el chat para clasificar el gasto al instante
* **📊 Reportes en tiempo real:** Comando `/mes` para obtener un resumen del total gastado en el mes actual y un desglose por categoría
* **📜 Historial:** Comando `/historial` para ver los últimos gastos
* **🇦🇷 Timezone Argentina:** Todas las fechas en hora local (ART)
* **💾 Credenciales seguras:** Usando PropertiesService de Google Apps Script
* **100% Serverless y Gratuito:** Utiliza Google Apps Script como puente, alojando la base de datos en Google Sheets

---

## 🚀 Instalación y Configuración

### Paso 1: Preparar Google Sheets

1. Crea una nueva hoja de cálculo en [Google Sheets](https://sheets.google.com)
2. **No hace falta poner encabezados** - el bot los crea automáticamente
3. Copia el **ID de tu hoja de cálculo** de la URL (la cadena larga entre `/d/` y `/edit`)

   Ejemplo: `https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit` → El ID es `1ABC123xyz...`

### Paso 2: Crear el Bot de Telegram

1. Abre Telegram y busca a **[@BotFather](https://t.me/botfather)**
2. Envía `/newbot` y sigue las instrucciones
3. Poné un nombre y username para tu bot (ej: `GastogramBot`)
4. Copia el **Token HTTP API** que te da BotFather

### Paso 3: Configurar Google Apps Script

1. En tu hoja de cálculo, ve a **Extensiones > Apps Script**
2. Borra todo el código que haya y pegá el contenido del archivo `Code.gs` de este repositorio
3. **IMPORTANTE:** Actualizá estas líneas al principio del archivo:

```javascript
const ADMIN_IDS = [533617529]; // Tu Telegram ID (el tuyo es 533617529)
```

4. Reemplazá los valores en la función `setup()`:

```javascript
function setup() {
  const props = PropertiesService.getUserProperties();
  
  props.setProperty('TELEGRAM_TOKEN', 'PEGÁ_ACÁ_EL_TOKEN_DE_BOTFATHER');
  props.setProperty('SHEET_ID', 'PEGÁ_ACÁ_EL_ID_DE_TU_HOJA');
  props.setProperty('WEBHOOK_URL', 'LA_URL QUE_VAS_A_OBTENER_EN_EL_PASO_4');
  
  // ... resto del código
}
```

### Paso 4: Ejecutar setup inicial

1. En la barra superior de Apps Script, seleccioná la función `setup`
2. Hacé clic en **Ejecutar**
3. **Importante:** Google te va a pedir permisos - aceptalos todos
4. Esto va a:
   - Guardar tus credenciales de forma segura
   - Crear los encabezados en la hoja de cálculo

### Paso 5: Desplegar como Web App

1. En Apps Script, hacé clic en **Implementar > Nueva implementación**
2. Seleccioná **Tipo: Aplicación web**
3. Configurar:
   - **Descripción:** Gastogram v2
   - **Ejecutar como: Yo** (tu cuenta de Google)
   - **Quién tiene acceso: Cualquier persona**
4. Hacé clic en **Implementar**
5. Copiá la **URL de la aplicación web** que te da

### Paso 6: Actualizar Webhook URL

1. Volvé al código de Apps Script
2. En la función `setup()`, actualizá `WEBHOOK_URL` con la URL que acabás de copiar
3. Ejecutá `setup()` nuevamente para guardar la URL
4. Ahora ejecutá la función `setWebhook()` (seleccionala y dale a Ejecutar)
5. Esto conecta Telegram con tu bot

### Paso 7: ¡Probalo!

1. En Telegram, buscá tu bot por el username que creaste
2. Enviá `/start` para ver el mensaje de bienvenida
3. Probá registrar un gasto: `1500 cafe`

---

## 📖 Cómo usarlo

### Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/start` | Mensaje de bienvenida con instrucciones |
| `/ayuda` o `/help` | Mostrar ayuda completa |
| `/mes` | Ver resumen del mes actual con total y desglose por categoría |
| `/historial` | Ver últimos 10 gastos |
| `/historial 20` | Ver últimos 20 gastos (o cualquier número) |

### Registrar un gasto

1. **Envía un mensaje** con el formato: `[Monto] [Descripción]`
   - Ejemplo: `2500 taxi al centro`
   - Ejemplo: `1500.50 cafe con medialunas`

2. **El bot te responde** con botones de categorías
   - Tocá la categoría correspondiente
   - La hoja de cálculo se actualiza automáticamente

3. **¡Listo!** Tu gasto queda registrado con:
   - Fecha y hora (timezone Argentina)
   - Monto
   - Descripción
   - Categoría
   - ID de chat (para auditoría)

### Ver reportes

- **`/mes`**: Te muestra el total gastado en el mes actual + desglose por categoría con porcentajes
- **`/historial`**: Últimos 10 gastos con su estado (pendiente o categorizado)

---

## 🔒 Seguridad

### Usuarios autorizados

El bot incluye una lista blanca de usuarios. Solo los Telegram IDs en `ADMIN_IDS` pueden usarlo.

```javascript
const ADMIN_IDS = [533617529]; // Agregar más IDs separados por coma
```

Si alguien no autorizado intenta usar el bot, recibe un mensaje de "Acceso denegado".

### Credenciales seguras

Las credenciales se guardan en **PropertiesService** de Google Apps Script, no en el código fuente. Esto significa que:

- ✅ Podés compartir el código sin exponer tus tokens
- ✅ Los tokens están encriptados por Google
- ✅ Fácil de rotar si es necesario

---

## 📁 Estructura del proyecto

```
Gastogram/
├── Code.gs          # Código principal del bot
├── README.md        # Este archivo
└── LICENSE          # Licencia MIT
```

---

## 🛠️ Personalización

### Agregar más categorías

En la función `getCategorias()`, podés agregar o modificar categorías:

```javascript
return [
  { nombre: 'Comida', emoji: '🍎' },
  { nombre: 'Transporte', emoji: '🚌' },
  { nombre: 'Hormiga', emoji: '☕' },
  // Agregar las que quieras...
];
```

### Agregar más usuarios autorizados

```javascript
const ADMIN_IDS = [533617529, 123456789, 987654321];
```

Para obtener tu Telegram ID, podés usar el bot [@userinfobot](https://t.me/userinfobot).

---

## 🐛 Solución de problemas

### El bot no responde

1. Verificá que el webhook esté configurado: ejecutá `setWebhook()` en Apps Script
2. Verificá que tu Telegram ID esté en `ADMIN_IDS`
3. Revisá los logs de Apps Script (Ver > Registros de ejecución)

### Error de permisos

1. Asegurate de ejecutar `setup()` primero
2. Aceptá todos los permisos que pide Google
3. Verificá que la Web App esté desplegada como "Cualquier persona"

### Los gastos no se guardan

1. Verificá que el `SHEET_ID` sea correcto
2. Asegurate de tener permisos de edición en la hoja
3. Revisá que la hoja no esté llena (límite: 5 millones de celdas)

---

## 📝 Changelog

### v2.0 (2026-03-10)
- ✅ Seguridad: Lista blanca de usuarios autorizados
- ✅ Credenciales en PropertiesService (no hardcodeadas)
- ✅ Comando `/start` con bienvenida
- ✅ Comando `/ayuda` con instrucciones
- ✅ Comando `/historial` para ver últimos gastos
- ✅ Timezone Argentina (America/Argentina/Buenos_Aires)
- ✅ Más categorías por defecto (8 en total)
- ✅ Reporte mensual con porcentajes
- ✅ Mejor manejo de errores y logs

### v1.0 (Original)
- Registro básico de gastos
- Categorización con botones
- Reporte mensual simple

---

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

---

## 💡 Tips

- **Gastos hormiga:** Usá la categoría "Hormiga" para esos gastos chiquitos que se acumulan (café, golosinas, etc.)
- **Revisión semanal:** Usá `/historial` una vez por semana para ver en qué estás gastando
- **Presupuesto mental:** Cuando veas el `/mes`, comparalo con tu presupuesto ideal
- **Categorías personalizadas:** Adaptá las categorías a TU realidad (ej: "Carpintería" si comprás herramientas)

---

**Hecho con ❤️ por Taxgab**
