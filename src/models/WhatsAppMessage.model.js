import mongoose from 'mongoose';

const whatsappMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppSession'
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  body: {
    type: String
  },
  mediaUrl: {
    type: String
  },
  mediaType: {
    type: String
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  transportistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transportista'
  },
  viajeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Viaje'
  },
  parsed: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

whatsappMessageSchema.index({ messageId: 1 });
whatsappMessageSchema.index({ transportistaId: 1, createdAt: -1 });
whatsappMessageSchema.index({ viajeId: 1, createdAt: -1 });

export default mongoose.model('WhatsAppMessage', whatsappMessageSchema);
