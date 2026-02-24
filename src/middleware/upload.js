import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream', // curl and some clients send this for .csv
]);

function csvFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext !== '.csv') {
    return cb(Object.assign(new Error('Only .csv files are accepted'), { status: 400 }), false);
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(Object.assign(new Error('Only .csv files are accepted'), { status: 400 }), false);
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter: csvFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
