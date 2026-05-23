const express = require('express');
const PaymentMethod = require('../models/PaymentMethod');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/payment-methods
router.get('/', async (req, res, next) => {
  try {
    const items = await PaymentMethod.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ items });
  } catch (err) { next(err); }
});

// POST /api/payment-methods
router.post('/', async (req, res, next) => {
  try {
    const { type, label, detail, brand, last4, expiry, isDefault } = req.body;
    if (!type || !['upi', 'card', 'netbanking', 'cod'].includes(type)) {
      res.status(400);
      throw new Error('Valid payment type is required');
    }
    if (!label) {
      res.status(400);
      throw new Error('Label is required');
    }
    if (isDefault) {
      await PaymentMethod.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    }
    const existingCount = await PaymentMethod.countDocuments({ user: req.user._id });
    const pm = await PaymentMethod.create({
      user: req.user._id,
      type, label,
      detail: detail || '',
      brand: brand || '',
      last4: last4 || '',
      expiry: expiry || '',
      isDefault: isDefault || existingCount === 0,
    });
    res.status(201).json(pm);
  } catch (err) { next(err); }
});

// PATCH /api/payment-methods/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const pm = await PaymentMethod.findOne({ _id: req.params.id, user: req.user._id });
    if (!pm) {
      res.status(404);
      throw new Error('Payment method not found');
    }
    if (req.body.isDefault) {
      await PaymentMethod.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    }
    const allowed = ['type', 'label', 'detail', 'brand', 'last4', 'expiry', 'isDefault'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) pm[key] = req.body[key];
    }
    await pm.save();
    res.json(pm);
  } catch (err) { next(err); }
});

// DELETE /api/payment-methods/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const pm = await PaymentMethod.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!pm) {
      res.status(404);
      throw new Error('Payment method not found');
    }
    if (pm.isDefault) {
      const next = await PaymentMethod.findOne({ user: req.user._id }).sort({ createdAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }
    res.json({ message: 'Payment method removed' });
  } catch (err) { next(err); }
});

module.exports = router;
