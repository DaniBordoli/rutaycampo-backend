import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const updateViajeCoords = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const result = await mongoose.connection.db.collection('viajes').updateOne(
      { numeroViaje: 'VJ-000001' },
      { 
        $set: { 
          'origen.coordenadas': {
            latitud: -34.6983,  // Wilde, Buenos Aires
            longitud: -58.3208
          },
          'destino.coordenadas': {
            latitud: -32.9442,  // Rosario, Santa Fe
            longitud: -60.6505
          }
        } 
      }
    );

    console.log('✅ Viaje actualizado:', result);
    console.log('  - Matched:', result.matchedCount);
    console.log('  - Modified:', result.modifiedCount);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

updateViajeCoords();
