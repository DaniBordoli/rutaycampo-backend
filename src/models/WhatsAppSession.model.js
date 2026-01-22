import mongoose from 'mongoose';

const whatsappSessionSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  transportistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista',
    required: true
  },
  viajeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Viaje'
  },
  status: {
    type: String,
    enum: ['active', 'waiting_response', 'waiting_location', 'completed', 'expired'],
    default: 'active'
  },
  context: {
    type: String,
    enum: ['trip_offer', 'check_in', 'general', 'problem_report'],
    default: 'general'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

whatsappSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('WhatsAppSession', whatsappSessionSchema);
