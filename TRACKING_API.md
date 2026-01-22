# 📍 API de Tracking en Tiempo Real

## Descripción General

Sistema de tracking en tiempo real para transportistas que permite:
- Generar links únicos de tracking por viaje
- Recibir actualizaciones de ubicación cada 5-10 minutos
- Visualizar ruta completa en el dashboard
- Actualizaciones en vivo via WebSocket

---

## 🔐 Autenticación

### Rutas Autenticadas (Dashboard)
Requieren header: `Authorization: Bearer <token>`

### Rutas Públicas (PWA de Tracking)
Usan `trackingToken` en la URL (sin autenticación)

---

## 📡 Endpoints

### 1. Generar Token de Tracking
**POST** `/api/tracking/:id/generate-token`

**Autenticación:** Requerida

**Descripción:** Genera un token único para tracking del viaje

**Respuesta:**
```json
{
  "trackingToken": "abc123...",
  "trackingUrl": "http://localhost:5175/track/abc123...",
  "viaje": {
    "_id": "...",
    "numeroViaje": "VJ-000001"
  }
}
```

---

### 2. Obtener Información del Viaje (por token)
**GET** `/api/tracking/viaje/:token`

**Autenticación:** No requerida (usa token)

**Descripción:** Obtiene información básica del viaje para mostrar en PWA

**Respuesta:**
```json
{
  "viaje": {
    "_id": "...",
    "numeroViaje": "VJ-000001",
    "origen": {
      "ciudad": "Pergamino",
      "provincia": "Buenos Aires"
    },
    "destino": {
      "ciudad": "Puerto San Martín",
      "provincia": "Santa Fe"
    },
    "fechaProgramada": "2026-01-25",
    "estado": "confirmado",
    "productor": "Productor SA",
    "transportista": "Transportista SA",
    "trackingActivo": false
  }
}
```

---

### 3. Iniciar Tracking
**POST** `/api/tracking/viaje/:token/start`

**Autenticación:** No requerida (usa token)

**Descripción:** Activa el tracking para el viaje

**Respuesta:**
```json
{
  "message": "Tracking iniciado",
  "trackingActivo": true
}
```

**WebSocket Event:** Emite `tracking-started` a `trip-{tripId}`

---

### 4. Detener Tracking
**POST** `/api/tracking/viaje/:token/stop`

**Autenticación:** No requerida (usa token)

**Descripción:** Desactiva el tracking para el viaje

**Respuesta:**
```json
{
  "message": "Tracking detenido",
  "trackingActivo": false
}
```

**WebSocket Event:** Emite `tracking-stopped` a `trip-{tripId}`

---

### 5. Actualizar Ubicación
**POST** `/api/tracking/viaje/:token/location`

**Autenticación:** No requerida (usa token)

**Body:**
```json
{
  "latitude": -33.8688,
  "longitude": -60.5578,
  "speed": 80.5,
  "accuracy": 10.2
}
```

**Descripción:** Envía ubicación actual del transportista

**Respuesta:**
```json
{
  "message": "Ubicación actualizada",
  "location": {
    "latitud": -33.8688,
    "longitud": -60.5578,
    "ultimaActualizacion": "2026-01-21T15:30:00.000Z"
  },
  "totalPoints": 42
}
```

**WebSocket Event:** Emite `location-updated` a `trip-{tripId}` con:
```json
{
  "tripId": "...",
  "location": {
    "latitude": -33.8688,
    "longitude": -60.5578,
    "timestamp": "2026-01-21T15:30:00.000Z",
    "speed": 80.5,
    "accuracy": 10.2
  }
}
```

---

### 6. Obtener Ruta Completa
**GET** `/api/tracking/:id/ruta`

**Autenticación:** Requerida

**Descripción:** Obtiene toda la ruta recorrida del viaje

**Respuesta:**
```json
{
  "rutaCompleta": [
    {
      "latitud": -33.8688,
      "longitud": -60.5578,
      "timestamp": "2026-01-21T15:00:00.000Z",
      "velocidad": 75.5,
      "precision": 8.3
    },
    {
      "latitud": -33.8700,
      "longitud": -60.5600,
      "timestamp": "2026-01-21T15:10:00.000Z",
      "velocidad": 80.0,
      "precision": 9.1
    }
  ],
  "ubicacionActual": {
    "latitud": -33.8700,
    "longitud": -60.5600,
    "ultimaActualizacion": "2026-01-21T15:10:00.000Z"
  },
  "trackingActivo": true,
  "totalPoints": 2
}
```

---

## 🔌 WebSocket

### Conexión
```javascript
const socket = io('http://localhost:5000');
```

### Unirse a Room de Viaje
```javascript
socket.emit('join-trip', tripId);
```

### Eventos

#### tracking-started
```javascript
socket.on('tracking-started', (data) => {
  console.log('Tracking iniciado:', data);
  // { tripId: '...', timestamp: '...' }
});
```

#### tracking-stopped
```javascript
socket.on('tracking-stopped', (data) => {
  console.log('Tracking detenido:', data);
  // { tripId: '...', timestamp: '...' }
});
```

#### location-updated
```javascript
socket.on('location-updated', (data) => {
  console.log('Nueva ubicación:', data);
  // { tripId: '...', location: { latitude, longitude, timestamp, speed, accuracy } }
});
```

---

## 📊 Modelo de Datos

### Campos Agregados al Modelo Viaje

```javascript
{
  trackingToken: String,        // Token único para acceso sin auth
  trackingActivo: Boolean,       // Si el tracking está activo
  ubicacionActual: {
    latitud: Number,
    longitud: Number,
    ultimaActualizacion: Date
  },
  rutaCompleta: [{
    latitud: Number,
    longitud: Number,
    timestamp: Date,
    velocidad: Number,           // km/h
    precision: Number            // metros
  }]
}
```

---

## 🔄 Flujo Completo

1. **Dashboard genera token:**
   ```
   POST /api/tracking/:id/generate-token
   → Recibe trackingUrl
   ```

2. **WhatsApp envía link al transportista:**
   ```
   "Para tracking en tiempo real: http://localhost:5175/track/abc123..."
   ```

3. **Transportista abre PWA:**
   ```
   GET /api/tracking/viaje/abc123
   → Muestra info del viaje
   ```

4. **Transportista inicia tracking:**
   ```
   POST /api/tracking/viaje/abc123/start
   → trackingActivo = true
   → WebSocket: tracking-started
   ```

5. **PWA envía ubicación cada 5-10 min:**
   ```
   POST /api/tracking/viaje/abc123/location
   → Actualiza ubicacionActual
   → Agrega punto a rutaCompleta
   → WebSocket: location-updated
   ```

6. **Dashboard recibe actualizaciones en tiempo real:**
   ```
   WebSocket: location-updated
   → Actualiza mapa
   ```

7. **Transportista detiene tracking:**
   ```
   POST /api/tracking/viaje/abc123/stop
   → trackingActivo = false
   → WebSocket: tracking-stopped
   ```

---

## 🛠️ Variables de Entorno

```env
TRACKING_URL=http://localhost:5175
```

---

## 🚀 Próximos Pasos

1. **Desarrollar PWA de Tracking** (frontend-tracking)
2. **Integrar mapa en Dashboard** (Leaflet o Google Maps)
3. **Optimizar almacenamiento** (limitar puntos de ruta)
4. **Agregar notificaciones** (alertas de desvío, paradas largas, etc.)
