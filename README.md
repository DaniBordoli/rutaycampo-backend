# 🚚 Ruta y Campo - Backend API

API REST para el sistema de orquestación de viajes de logística rural. Sistema completo de gestión de transporte con tracking en tiempo real, notificaciones por WhatsApp y gestión de productores, transportistas y viajes.

## 📋 Tabla de Contenidos

- [Stack Tecnológico](#stack-tecnológico)
- [Características Principales](#características-principales)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecución](#ejecución)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [API Endpoints](#api-endpoints)
- [Modelos de Datos](#modelos-de-datos)
- [WebSocket](#websocket)
- [Scripts Útiles](#scripts-útiles)
- [Documentación Adicional](#documentación-adicional)

## 🛠️ Stack Tecnológico

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express 4.18
- **Database:** MongoDB + Mongoose 8.1
- **Authentication:** JWT (jsonwebtoken)
- **Validation:** Joi 17.12
- **Security:** Helmet + CORS + Rate Limiting
- **File Upload:** Multer
- **WhatsApp:** Twilio API
- **Email:** Nodemailer
- **Real-time:** Socket.io 4.6
- **Logging:** Morgan
- **Password Hashing:** bcryptjs

## ✨ Características Principales

### 🔐 Autenticación y Autorización
- Sistema de roles (superadmin, operador, productor, transportista)
- JWT con refresh tokens
- Recuperación de contraseña por email
- Sistema de invitaciones con establecimiento de contraseña

### 📍 Tracking en Tiempo Real
- Generación de tokens únicos por viaje
- Actualizaciones de ubicación cada 5-10 minutos
- WebSocket para actualizaciones en vivo
- Historial completo de ruta recorrida
- PWA para transportistas (sin autenticación)

### 💬 Integración WhatsApp (Twilio)
- Envío automático de ofertas de viaje
- Sistema conversacional para confirmaciones
- Check-ins por WhatsApp con ubicación
- Recordatorios y notificaciones automáticas
- Gestión de sesiones de conversación

### 📧 Sistema de Emails
- Invitaciones a productores con link de registro
- Recuperación de contraseña
- Notificaciones de cambios de estado

### 📦 Gestión de Documentos
- Upload de Carta de Porte
- Upload de Cupo
- Almacenamiento local de archivos

## 🚀 Instalación

```bash
# Clonar repositorio
git clone <repository-url>

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
```

## ⚙️ Configuración

### Variables de Entorno

Editar `.env` con tus credenciales:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/rutaycampo

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@rutaycampo.com

# WhatsApp API (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# URLs
FRONTEND_URL=http://localhost:5173
TRACKING_URL=http://localhost:5175

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Base de Datos

Asegurarse de tener MongoDB corriendo:

```bash
# Opción 1: MongoDB local
mongod

# Opción 2: MongoDB en Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

## 🏃 Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

### Health Check
```bash
curl http://localhost:5000/health
```

## 📁 Estructura del Proyecto

```
rutaycampo-backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Conexión MongoDB
│   │   └── jwt.js               # Configuración JWT
│   ├── controllers/
│   │   ├── auth.controller.js   # Autenticación y registro
│   │   ├── producer.controller.js
│   │   ├── transportista.controller.js
│   │   ├── trip.controller.js
│   │   ├── rate.controller.js
│   │   ├── tracking.controller.js
│   │   └── whatsapp.controller.js
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── upload.js            # Multer config
│   ├── models/
│   │   ├── Usuario.model.js
│   │   ├── Productor.model.js
│   │   ├── Transportista.model.js
│   │   ├── Viaje.model.js
│   │   ├── Tarifa.model.js
│   │   ├── WhatsAppSession.model.js
│   │   └── WhatsAppMessage.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── producer.routes.js
│   │   ├── transportista.routes.js
│   │   ├── trip.routes.js
│   │   ├── rate.routes.js
│   │   ├── tracking.routes.js
│   │   └── whatsapp.routes.js
│   ├── services/
│   │   └── email.service.js     # Nodemailer service
│   └── server.js                # Punto de entrada
├── uploads/                      # Archivos subidos
├── create-admin.js              # Script crear superadmin
├── update-viaje-coords.js       # Script migración coordenadas
├── .env                         # Variables de entorno
├── .env.example
├── package.json
├── README.md
├── TRACKING_API.md              # Documentación tracking
└── WHATSAPP_SETUP.md            # Guía WhatsApp
```

## 🌐 API Endpoints

### Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Registro de usuario | No |
| POST | `/login` | Login | No |
| GET | `/profile` | Obtener perfil | Sí |
| POST | `/forgot-password` | Solicitar reset de contraseña | No |
| POST | `/reset-password` | Resetear contraseña | No |
| POST | `/set-password` | Establecer contraseña desde invitación | No |

### Productores (`/api/productores`)

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear productor | superadmin, operador |
| GET | `/` | Listar productores | Todos |
| GET | `/:id` | Obtener productor | Todos |
| PUT | `/:id` | Actualizar productor | superadmin, operador |
| DELETE | `/:id` | Eliminar productor | superadmin |
| POST | `/:id/create-access` | Crear acceso para productor | superadmin, operador |

### Transportistas (`/api/transportistas`)

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear transportista | superadmin, operador |
| GET | `/` | Listar transportistas | Todos |
| GET | `/:id` | Obtener transportista (incluye camiones) | Todos |
| PUT | `/:id` | Actualizar transportista | superadmin, operador |
| DELETE | `/:id` | Eliminar transportista | superadmin |
| PATCH | `/:id/toggle-availability` | Cambiar disponibilidad | superadmin, operador |

### Camiones (`/api/camiones`)

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear camión | superadmin, operador |
| GET | `/` | Listar camiones | Todos |
| GET | `/:id` | Obtener camión | Todos |
| PUT | `/:id` | Actualizar camión | superadmin, operador |
| DELETE | `/:id` | Eliminar camión | superadmin |
| PATCH | `/:id/toggle-disponibilidad` | Cambiar disponibilidad | superadmin, operador |
| GET | `/transportista/:transportistaId` | Camiones de un transportista | Todos |
| PATCH | `/:camionId/assign` | Asignar a transportista | superadmin, operador |

### Viajes (`/api/trips`)

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear viaje | productor, superadmin, operador |
| GET | `/` | Listar viajes | Todos |
| GET | `/:id` | Obtener viaje | Todos |
| PUT | `/:id` | Actualizar viaje | superadmin, operador |
| PATCH | `/:id/status` | Cambiar estado | superadmin, operador |
| PATCH | `/:id/propose-price` | Proponer precio | productor, superadmin, operador |
| POST | `/:id/assign` | Asignar transportista | superadmin, operador |
| POST | `/:id/checkin` | Registrar check-in | transportista, superadmin, operador |
| PATCH | `/:id/location` | Actualizar ubicación | transportista |
| DELETE | `/:id` | Eliminar viaje | superadmin, operador |
| POST | `/:id/upload/carta-porte` | Subir carta de porte | Autenticado |
| POST | `/:id/upload/cupo` | Subir cupo | Autenticado |

### Tarifas (`/api/rates`)

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear tarifa | superadmin, operador |
| GET | `/` | Listar tarifas | Todos |
| GET | `/:id` | Obtener tarifa | Todos |
| PUT | `/:id` | Actualizar tarifa | superadmin, operador |
| DELETE | `/:id` | Eliminar tarifa | superadmin |
| POST | `/calculate` | Calcular precio | Todos |

### Tracking (`/api/tracking`)

**Rutas Autenticadas:**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/:id/generate-token` | Generar token de tracking |
| GET | `/:id/ruta` | Obtener ruta completa |

**Rutas Públicas (usan token):**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/viaje/:token` | Obtener info del viaje |
| POST | `/viaje/:token/start` | Iniciar tracking |
| POST | `/viaje/:token/stop` | Detener tracking |
| POST | `/viaje/:token/location` | Actualizar ubicación |

### WhatsApp (`/api/whatsapp`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/send-offer` | Enviar oferta a transportistas | Sí |
| POST | `/webhook` | Webhook de Twilio | No |
| POST | `/send-reminder` | Enviar recordatorio | Sí |
| POST | `/send-update` | Enviar actualización | Sí |

## 📊 Modelos de Datos

### Usuario
- email, password (hashed)
- rol: `superadmin`, `operador`, `productor`, `transportista`
- resetPasswordToken, resetPasswordExpire
- invitationToken, invitationExpire

### Productor
- razonSocial, cuit, direccion
- contacto (nombre, telefono, email)
- usuarioId (referencia a Usuario)

### Transportista
- razonSocial, cuit
- nombreConductor, licenciaConductor
- numeroWhatsapp, email
- patente, capacidad (campos legacy)
- activo, disponible (boolean)

### Camion
- patente (única, uppercase)
- marca, modelo, año
- tipo: `chasis`, `acoplado`, `batea`, `tolva`, `tanque`, `otro`
- capacidad, unidadCapacidad
- transportista (referencia a Transportista)
- conductor (nombre, licencia, telefono)
- seguro (compania, numeroPoliza, vencimiento)
- vtv (fecha, vencimiento)
- activo, disponible (boolean)

### Viaje
- numeroViaje (auto-generado)
- productor, transportista (referencias)
- origen, destino (ciudad, provincia, direccion)
- carga (tipo, cantidad, unidad)
- fechaProgramada, fechaReal
- estado: `solicitado`, `cotizando`, `confirmado`, `en_asignacion`, `en_curso`, `finalizado`, `cancelado`
- precio (monto, moneda, formaPago)
- checkIns (tipo, descripcion, fecha, ubicacion)
- cartaDePorte, cupo (archivos)
- **Tracking:**
  - trackingToken
  - trackingActivo
  - ubicacionActual (latitud, longitud, ultimaActualizacion)
  - rutaCompleta (array de puntos con timestamp, velocidad, precisión)

### Tarifa
- origen, destino
- precioPorTonelada, precioFijo
- vigenciaDesde, vigenciaHasta

### WhatsAppSession
- phoneNumber, transportistaId, viajeId
- status: `active`, `waiting_response`, `waiting_location`, `completed`
- context: `trip_offer`, `check_in`, `general`

### WhatsAppMessage
- sessionId, messageId (Twilio)
- direction: `inbound`, `outbound`
- body, location, parsed

## 🔌 WebSocket

### Conexión
```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:5000');
```

### Eventos

**Unirse a room de viaje:**
```javascript
socket.emit('join-trip', tripId);
```

**Escuchar actualizaciones:**
```javascript
// Tracking iniciado
socket.on('tracking-started', (data) => {
  console.log('Tracking iniciado:', data);
});

// Tracking detenido
socket.on('tracking-stopped', (data) => {
  console.log('Tracking detenido:', data);
});

// Nueva ubicación
socket.on('location-updated', (data) => {
  console.log('Nueva ubicación:', data);
  // { tripId, location: { latitude, longitude, timestamp, speed, accuracy } }
});
```

## 🔧 Scripts Útiles

### Crear Superadmin
```bash
node create-admin.js
```

### Migrar Coordenadas de Viajes
```bash
node update-viaje-coords.js
```

## 📚 Documentación Adicional

- **[TRACKING_API.md](./TRACKING_API.md)** - Documentación completa del sistema de tracking
- **[WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md)** - Guía de configuración de WhatsApp con Twilio
- **[CAMIONES_API.md](./CAMIONES_API.md)** - API de gestión de camiones y flota

## 🔐 Seguridad

- Passwords hasheados con bcryptjs
- JWT para autenticación
- Helmet para headers de seguridad
- CORS configurado
- Rate limiting (100 requests / 15 min)
- Validación de inputs con Joi
- Archivos servidos desde carpeta protegida

## 🌍 Estados del Viaje

1. **solicitado** - Productor creó el pedido
2. **cotizando** - Ruta y Campo está validando
3. **confirmado** - Precio y condiciones cerradas
4. **en_asignacion** - Buscando transportistas
5. **en_curso** - Viaje en progreso
6. **finalizado** - Viaje completado
7. **cancelado** - Viaje cancelado

## 👥 Roles de Usuario

- **superadmin** - Administrador total del sistema
- **operador** - Operador de Ruta y Campo
- **productor** - Productores que solicitan transporte
- **transportista** - Transportistas que realizan viajes

## 🚀 Próximos Pasos

- [ ] Validación de firma de Twilio en webhook
- [ ] Sistema de adelantos y pagos
- [ ] Reportes y analytics
- [ ] Notificaciones push
- [ ] Integración con Google Maps API
- [ ] Sistema de calificaciones
- [ ] Optimización de rutas

## 📄 Licencia

ISC
