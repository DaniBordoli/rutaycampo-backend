# Ruta y Campo - Backend API

API REST para el sistema de orquestación de viajes de logística rural.

## Stack Tecnológico

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT
- **Validation:** Joi
- **File Upload:** Multer
- **WhatsApp:** Twilio API
- **Real-time:** Socket.io

## Instalación

```bash
npm install
```

## Configuración

1. Copiar `.env.example` a `.env`
2. Configurar variables de entorno
3. Asegurarse de tener MongoDB corriendo

## Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

## Estructura del Proyecto

```
backend/
├── src/
│   ├── config/          # Configuraciones (DB, JWT, etc.)
│   ├── models/          # Modelos de Mongoose
│   ├── controllers/     # Controladores de rutas
│   ├── routes/          # Definición de rutas
│   ├── middleware/      # Middlewares (auth, validation, etc.)
│   ├── services/        # Lógica de negocio
│   ├── utils/           # Utilidades
│   └── server.js        # Punto de entrada
├── uploads/             # Archivos subidos
├── .env                 # Variables de entorno
└── package.json
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Productores
- `GET /api/producers` - Listar productores
- `POST /api/producers` - Crear productor
- `GET /api/producers/:id` - Obtener productor
- `PUT /api/producers/:id` - Actualizar productor
- `DELETE /api/producers/:id` - Eliminar productor

### Transportistas
- `GET /api/carriers` - Listar transportistas
- `POST /api/carriers` - Crear transportista
- `GET /api/carriers/:id` - Obtener transportista
- `PUT /api/carriers/:id` - Actualizar transportista
- `DELETE /api/carriers/:id` - Eliminar transportista

### Viajes
- `GET /api/trips` - Listar viajes
- `POST /api/trips` - Crear viaje
- `GET /api/trips/:id` - Obtener viaje
- `PUT /api/trips/:id` - Actualizar viaje
- `PATCH /api/trips/:id/status` - Cambiar estado
- `POST /api/trips/:id/assign` - Asignar transportista
- `POST /api/trips/:id/checkin` - Registrar check-in

### Tarifas
- `GET /api/rates` - Listar tarifas
- `POST /api/rates` - Crear tarifa
- `PUT /api/rates/:id` - Actualizar tarifa

### WhatsApp
- `POST /api/whatsapp/send-offer` - Enviar oferta a transportista
- `POST /api/whatsapp/webhook` - Webhook para respuestas

## Estados del Viaje

1. `solicitado` - Productor creó el pedido
2. `cotizando` - Ruta y Campo está validando
3. `confirmado` - Precio y condiciones cerradas
4. `en_asignacion` - Buscando transportistas
5. `en_curso` - Viaje en progreso
6. `finalizado` - Viaje completado

## Roles de Usuario

- `productor` - Productores que solicitan transporte
- `rc_superadmin` - Administrador de Ruta y Campo
- `rc_operador` - Operador de Ruta y Campo
- `transportista` - Transportistas que realizan viajes
