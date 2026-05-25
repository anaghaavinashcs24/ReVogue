const express = require('express');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

function diskUrl(req, filename) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/uploads/${filename}`;
}

function fileToPayload(req, file) {
  // Cloudinary's multer storage sets file.path to the secure URL and file.filename to the public_id.
  const url = upload.isCloudinary ? file.path : diskUrl(req, file.filename);
  return {
    url,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
  };
}

// POST /api/uploads  (multipart/form-data; field "image")
router.post('/', protect, upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No image uploaded');
    }
    res.status(201).json(fileToPayload(req, req.file));
  } catch (err) { next(err); }
});

// POST /api/uploads/multiple  (field "images", up to 6)
router.post('/multiple', protect, upload.array('images', 6), (req, res, next) => {
  try {
    if (!req.files || !req.files.length) {
      res.status(400);
      throw new Error('No images uploaded');
    }
    res.status(201).json({
      files: req.files.map(f => fileToPayload(req, f)),
    });
  } catch (err) { next(err); }
});

module.exports = router;
