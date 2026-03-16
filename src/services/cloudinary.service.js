import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const isPdf = file.mimetype === 'application/pdf';
    const baseName = file.originalname
      .replace(/\.[^/.]+$/, '')        // quitar extensión
      .replace(/[^a-zA-Z0-9_-]/g, '_') // solo caracteres seguros
      .slice(0, 80);
    return {
      folder: `rutaycampo/camiones/${req.params.id}`,
      resource_type: isPdf ? 'raw' : 'image',
      public_id: `${Date.now()}-${baseName}`,
      ...(isPdf ? {} : { allowed_formats: ['jpg', 'jpeg', 'png'] }),
    };
  },
});

export const uploadDocumentos = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo PDF, JPG o PNG.'));
    }
  },
}).array('documentos', 10);

export { cloudinary };
