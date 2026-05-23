const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
  },
});

const allowed = /image\/(jpe?g|png|webp|gif|svg\+xml|avif)/;

function fileFilter(_req, file, cb) {
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image uploads are allowed'));
}

const maxMb = Number(process.env.MAX_UPLOAD_MB || 8);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxMb * 1024 * 1024 },
});

module.exports = upload;
