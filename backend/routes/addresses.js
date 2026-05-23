const express = require('express');
const Address = require('../models/Address');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/addresses
router.get('/', async (req, res, next) => {
  try {
    const items = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ items });
  } catch (err) { next(err); }
});

// POST /api/addresses
router.post('/', async (req, res, next) => {
  try {
    const { label, name, line1, line2, city, state, pin, phone, country, isDefault } = req.body;
    if (!name || !line1 || !city || !state || !pin) {
      res.status(400);
      throw new Error('Name, address line 1, city, state and PIN are required');
    }
    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    }
    const existingCount = await Address.countDocuments({ user: req.user._id });
    const address = await Address.create({
      user: req.user._id,
      label: label || 'Home',
      name, line1, line2: line2 || '', city, state, pin,
      phone: phone || '',
      country: country || 'India',
      isDefault: isDefault || existingCount === 0,
    });
    res.status(201).json(address);
  } catch (err) { next(err); }
});

// PATCH /api/addresses/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
    if (!address) {
      res.status(404);
      throw new Error('Address not found');
    }
    if (req.body.isDefault) {
      await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    }
    const allowed = ['label', 'name', 'line1', 'line2', 'city', 'state', 'pin', 'phone', 'country', 'isDefault'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) address[key] = req.body[key];
    }
    await address.save();
    res.json(address);
  } catch (err) { next(err); }
});

// DELETE /api/addresses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!address) {
      res.status(404);
      throw new Error('Address not found');
    }
    if (address.isDefault) {
      const next = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }
    res.json({ message: 'Address removed' });
  } catch (err) { next(err); }
});

module.exports = router;
