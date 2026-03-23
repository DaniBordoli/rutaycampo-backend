import multer from 'multer';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

let supabase = null;
const getSupabase = () => {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
};

export const uploadToSupabase = (bucket = 'documentos') => async (req, res, next) => {
  if (!req.file) return next();

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(req.file.originalname);
  const filename = `${req.file.fieldname}-${uniqueSuffix}${ext}`;

  const client = getSupabase();
  const { error } = await client.storage
    .from(bucket)
    .upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (error) return next(error);

  const { data } = client.storage.from(bucket).getPublicUrl(filename);
  req.file.publicUrl = data.publicUrl;
  next();
};

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido'));
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter,
});

export const uploadToSupabaseMultiple = (bucket = 'documentos', folder = '') => async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  const client = getSupabase();
  try {
    const uploaded = await Promise.all(
      req.files.map(async (file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const prefix = folder ? `${folder}/` : '';
        const filename = `${prefix}${file.fieldname}-${uniqueSuffix}${ext}`;

        const { error } = await client.storage
          .from(bucket)
          .upload(filename, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) throw error;

        const { data } = client.storage.from(bucket).getPublicUrl(filename);
        return { ...file, publicUrl: data.publicUrl, storagePath: filename };
      })
    );
    req.files = uploaded;
    next();
  } catch (err) {
    next(err);
  }
};
