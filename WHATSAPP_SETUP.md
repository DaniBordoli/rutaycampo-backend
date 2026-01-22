# 🤖 WhatsApp Bot - Guía de Configuración

## 📋 Requisitos Previos

1. **Cuenta de Twilio**
   - Crear cuenta en [Twilio](https://www.twilio.com/try-twilio)
   - Activar WhatsApp Business API

2. **Número de WhatsApp de Twilio**
   - Twilio proporciona un número sandbox para desarrollo
   - Para producción, necesitas un número propio aprobado

## 🔧 Configuración

### 1. Variables de Entorno

Agregar al archivo `.env` del backend:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# URLs
FRONTEND_URL=http://localhost:5174
NODE_ENV=development
```

### 2. Obtener Credenciales de Twilio

1. Ir a [Twilio Console](https://console.twilio.com/)
2. Copiar **Account SID** y **Auth Token**
3. Ir a **Messaging** → **Try it out** → **Send a WhatsApp message**
4. Copiar el número de WhatsApp (formato: `whatsapp:+14155238886`)

### 3. Configurar Webhook

El webhook debe ser accesible públicamente. Opciones:

#### Opción A: Desarrollo Local con ngrok

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto del backend
ngrok http 3000

# Copiar URL pública (ej: https://abc123.ngrok.io)
```

#### Opción B: Producción

Usar dominio real con HTTPS (requerido por Twilio)

### 4. Configurar Webhook en Twilio

1. Ir a Twilio Console → **Messaging** → **Settings** → **WhatsApp sandbox settings**
2. En **"When a message comes in"**, pegar:
   ```
   https://tu-dominio.com/api/whatsapp/webhook
   ```
   o con ngrok:
   ```
   https://abc123.ngrok.io/api/whatsapp/webhook
   ```
3. Método: **POST**
4. Guardar

### 5. Activar Sandbox (Desarrollo)

Para probar en desarrollo:

1. Ir a WhatsApp Sandbox en Twilio Console
2. Enviar mensaje de activación desde tu WhatsApp al número de Twilio
3. Mensaje: `join [código-sandbox]` (ej: `join happy-dog`)

## 🚀 Uso

### Flujo Completo

#### 1. Enviar Oferta de Viaje

**Endpoint:** `POST /api/whatsapp/send-offer`

**Body:**
```json
{
  "tripId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "transportistaIds": ["60f7b3b3b3b3b3b3b3b3b3b3"] // Opcional
}
```

**Transportista recibe:**
```
🚚 Nueva Oferta de Viaje #1234

📍 Origen: Pergamino, BA
📍 Destino: Puerto San Martín
📅 Fecha: 25/01/2026
💰 Pago: $150,000
📦 Carga: Soja - 30 tn

Responde con:
1️⃣ - Confirmo 1 camión
2️⃣ - Confirmo 2 camiones
3️⃣ - No tengo disponibilidad
```

#### 2. Transportista Confirma

**Transportista responde:** `1`

**Sistema:**
- Asigna viaje al transportista
- Cambia estado a "confirmado"
- Envía detalles completos del viaje

#### 3. Check-ins Durante el Viaje

**Transportista reporta:**
- `1` → Llegué a cargar
- `2` → Cargado, saliendo
- `3` → En camino
- `4` → Llegué a destino
- `5` → Descargado

**Después de cada check-in:**
- Sistema solicita ubicación
- Transportista comparte ubicación de WhatsApp
- Sistema registra check-in + ubicación

### Endpoints Disponibles

#### Enviar Oferta
```bash
POST /api/whatsapp/send-offer
Authorization: Bearer <token>
Content-Type: application/json

{
  "tripId": "viaje_id",
  "transportistaIds": ["trans_id_1", "trans_id_2"] // Opcional
}
```

#### Enviar Recordatorio
```bash
POST /api/whatsapp/send-reminder
Authorization: Bearer <token>
Content-Type: application/json

{
  "tripId": "viaje_id"
}
```

#### Enviar Actualización
```bash
POST /api/whatsapp/send-update
Authorization: Bearer <token>
Content-Type: application/json

{
  "tripId": "viaje_id",
  "message": "La fecha de carga cambió al 26/01"
}
```

## 📊 Modelos de Datos

### WhatsAppSession
Gestiona el contexto de conversación:
- `phoneNumber`: Número del transportista
- `transportistaId`: ID del transportista
- `viajeId`: ID del viaje asociado
- `status`: active, waiting_response, waiting_location, completed
- `context`: trip_offer, check_in, general

### WhatsAppMessage
Registra todos los mensajes:
- `messageId`: ID de Twilio
- `direction`: inbound/outbound
- `body`: Contenido del mensaje
- `location`: Coordenadas si es ubicación
- `parsed`: Mensaje parseado

## 🗺️ Live Tracking

El sistema registra ubicaciones en cada check-in:

1. Transportista reporta estado (ej: "2" - Cargado)
2. Sistema solicita ubicación
3. Transportista comparte ubicación desde WhatsApp
4. Sistema guarda coordenadas en `viaje.checkIns[].ubicacion`
5. Dashboard muestra en mapa en tiempo real

**Estructura de ubicación:**
```javascript
{
  tipo: 'cargado',
  descripcion: 'Cargado, saliendo',
  fecha: Date,
  ubicacion: {
    latitud: -33.4569,
    longitud: -60.2345
  }
}
```

## 🔍 Testing

### Probar Oferta de Viaje

1. Crear viaje en el dashboard
2. Asignar transportista con WhatsApp configurado
3. Enviar oferta desde dashboard o API
4. Verificar mensaje en WhatsApp del transportista

### Probar Check-ins

1. Responder "1" en WhatsApp
2. Verificar confirmación
3. Compartir ubicación cuando se solicite
4. Ver check-in en dashboard

### Logs

Verificar logs del backend:
```bash
# Mensajes enviados
WhatsApp enviado a whatsapp:+54911... : SMxxx

# Mensajes recibidos
Mensaje de número desconocido: +54911...
Check-in registrado: llegue_cargar
```

## ⚠️ Troubleshooting

### Error: WhatsApp no configurado
- Verificar que `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` estén en `.env`
- Reiniciar servidor después de agregar variables

### No recibo mensajes en el webhook
- Verificar que webhook esté configurado en Twilio
- Verificar que URL sea accesible públicamente
- Revisar logs de ngrok si usas desarrollo local

### Transportista no recibe mensajes
- Verificar formato de número: debe incluir código de país
- Verificar que número esté en sandbox (desarrollo)
- Verificar que transportista tenga `numeroWhatsapp` en la BD

### Ubicación no se registra
- Verificar que transportista comparta ubicación (no texto)
- Verificar que Twilio envíe `Latitude` y `Longitude` en webhook
- Revisar logs del backend

## 📱 Formato de Números

El sistema acepta múltiples formatos:
- `whatsapp:+5491112345678` ✅
- `+5491112345678` ✅ (se convierte automáticamente)
- `5491112345678` ✅ (se convierte automáticamente)
- `91112345678` ✅ (asume +54 Argentina)

## 🔐 Seguridad

- Webhook debe validar firma de Twilio (TODO)
- Usar HTTPS en producción
- No exponer credenciales en código
- Validar números de teléfono antes de enviar

## 📈 Próximos Pasos

- [ ] Validación de firma de Twilio en webhook
- [ ] Tracking activo (solicitar ubicación cada X minutos)
- [ ] Notificaciones automáticas de cambios de estado
- [ ] Sistema de adelantos por WhatsApp
- [ ] Reportes de problemas estructurados
- [ ] Integración con Google Maps para rutas
