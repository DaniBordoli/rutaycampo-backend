import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import producerRoutes from './routes/producer.routes.js';
import transportistaRoutes from './routes/transportista.routes.js';
import tripRoutes from './routes/trip.routes.js';
import rateRoutes from './routes/rate.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import trackingRoutes from './routes/tracking.routes.js';
import camionRoutes from './routes/camion.routes.js';
import choferRoutes from './routes/chofer.routes.js';
import auditoriaRoutes from './routes/auditoria.routes.js';
import cookieParser from 'cookie-parser';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { startReactivationJob } from './jobs/reactivateTransportistas.job.js';
import { startTripStartingJob } from './jobs/tripStarting.job.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
  .split(',')
  .map((o) => o.trim());

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

connectDB();

startReactivationJob();
startTripStartingJob();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);
app.use(csrfProtection);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/productores', producerRoutes);
app.use('/api/transportistas', transportistaRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/camiones', camionRoutes);
app.use('/api/choferes', choferRoutes);
app.use('/api/auditoria', auditoriaRoutes);

app.use(errorHandler);

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('join-trip', (tripId) => {
    socket.join(`trip-${tripId}`);
    console.log(`Socket ${socket.id} se unió a trip-${tripId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

export { io };
