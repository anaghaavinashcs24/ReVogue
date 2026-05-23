const express = require('express');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

function publicUrl(req, filename) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/uploads/${filename}`;
}

// POST /api/uploads  (multipart/form-data; field "image")
router.post('/', protect, upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No image uploaded');
    }
    res.status(201).json({
      url: publicUrl(req, req.file.filename),
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
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
      files: req.files.map(f => ({
        url: publicUrl(req, f.filename),
        filename: f.filename,
        mimetype: f.mimetype,
        size: f.size,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
