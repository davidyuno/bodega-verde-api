import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

function csvFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ext !== '.csv' || !['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'].includes(mime)) {
    return cb(Object.assign(new Error('Only .csv files are accepted'), { status: 400 }), false);
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter: csvFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
