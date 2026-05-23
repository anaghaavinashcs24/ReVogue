const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

async function loadCart(userId) {
  const user = await User.findById(userId).populate('cart.product');
  const items = user.cart
    .filter(c => c.product)
    .map(c => ({
      product: c.product,
      qty: c.qty,
      size: c.size,
      addedAt: c.addedAt,
    }));
  const subtotal = items.reduce((s, i) => s + (i.product.price * i.qty), 0);
  return { items, subtotal, count: items.reduce((s, i) => s + i.qty, 0) };
}

// GET /api/cart
router.get('/', async (req, res, next) => {
  try {
    res.json(await loadCart(req.user._id));
  } catch (err) { next(err); }
});

// POST /api/cart  { productId, qty, size }
router.post('/', async (req, res, next) => {
  try {
    const { productId, qty = 1, size } = req.body;
    if (!mongoose.isValidObjectId(productId)) {
      res.status(400);
      throw new Error('Invalid product id');
    }
    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      res.status(404);
      throw new Error('Product not available');
    }
    const user = await User.findById(req.user._id);
    const existing = user.cart.find(c => String(c.product) === String(productId));
    if (existing) {
      existing.qty = Math.max(1, Number(qty) || existing.qty);
      if (size) existing.size = size;
    } else {
      user.cart.push({ product: productId, qty: Math.max(1, Number(qty) || 1), size: size || product.size });
    }
    await user.save();
    res.status(201).json(await loadCart(req.user._id));
  } catch (err) { next(err); }
});

// PATCH /api/cart/:productId  { qty }
router.patch('/:productId', async (req, res, next) => {
  try {
    const { qty } = req.body;
    if (!qty || qty < 1) {
      res.status(400);
      throw new Error('Quantity must be at least 1');
    }
    await User.updateOne(
      { _id: req.user._id, 'cart.product': req.params.productId },
      { $set: { 'cart.$.qty': Number(qty) } }
    );
    res.json(await loadCart(req.user._id));
  } catch (err) { next(err); }
});

// DELETE /api/cart/:productId
router.delete('/:productId', async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { cart: { product: req.params.productId } } }
    );
    res.json(await loadCart(req.user._id));
  } catch (err) { next(err); }
});

// DELETE /api/cart — clear all
router.delete('/', async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { cart: [] } });
    res.json({ items: [], subtotal: 0, count: 0 });
  } catch (err) { next(err); }
});

module.exports = router;
