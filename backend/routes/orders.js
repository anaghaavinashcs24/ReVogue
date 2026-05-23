const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Address = require('../models/Address');
const PaymentMethod = require('../models/PaymentMethod');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

const SHIPPING_FEE = 49;
const FREE_SHIPPING_THRESHOLD = 999;

function sustainabilityImpact(items) {
  const itemsCount = items.reduce((s, i) => s + i.qty, 0);
  return {
    itemsRescued: itemsCount,
    co2SavedKg: +(itemsCount * 5.4).toFixed(2),
    waterSavedLiters: +(itemsCount * 2700).toFixed(0),
  };
}

// GET /api/orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.product', 'title images price');
    res.json({ items: orders });
  } catch (err) { next(err); }
});

// GET /api/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid order id');
    }
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .populate('items.product', 'title images price');
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    res.json(order);
  } catch (err) { next(err); }
});

// POST /api/orders  { addressId | shippingAddress, paymentMethodId | paymentMethod, items? }
router.post('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('cart.product');

    let orderItems;
    if (Array.isArray(req.body.items) && req.body.items.length) {
      const ids = req.body.items.map(i => i.productId);
      const products = await Product.find({ _id: { $in: ids }, status: 'active' });
      const map = new Map(products.map(p => [String(p._id), p]));
      orderItems = req.body.items.map(i => {
        const p = map.get(String(i.productId));
        if (!p) throw new Error('One or more items are no longer available');
        return {
          product: p._id, title: p.title, brand: p.brand, image: (p.images || [])[0] || '',
          price: p.price, qty: Math.max(1, Number(i.qty) || 1), size: i.size || p.size, seller: p.seller,
        };
      });
    } else {
      if (!user.cart.length) {
        res.status(400);
        throw new Error('Your bag is empty');
      }
      orderItems = user.cart
        .filter(c => c.product && c.product.status === 'active')
        .map(c => ({
          product: c.product._id, title: c.product.title, brand: c.product.brand,
          image: (c.product.images || [])[0] || '', price: c.product.price,
          qty: c.qty, size: c.size || c.product.size, seller: c.product.seller,
        }));
    }

    if (!orderItems.length) {
      res.status(400);
      throw new Error('No purchasable items in this order');
    }

    let shippingAddress;
    if (req.body.addressId) {
      const a = await Address.findOne({ _id: req.body.addressId, user: req.user._id });
      if (!a) {
        res.status(400);
        throw new Error('Address not found');
      }
      shippingAddress = {
        label: a.label, name: a.name, line1: a.line1, line2: a.line2,
        city: a.city, state: a.state, pin: a.pin, phone: a.phone, country: a.country,
      };
    } else if (req.body.shippingAddress) {
      shippingAddress = req.body.shippingAddress;
    } else {
      res.status(400);
      throw new Error('Shipping address is required');
    }

    let paymentMethod;
    if (req.body.paymentMethodId) {
      const pm = await PaymentMethod.findOne({ _id: req.body.paymentMethodId, user: req.user._id });
      if (!pm) {
        res.status(400);
        throw new Error('Payment method not found');
      }
      paymentMethod = { type: pm.type, label: pm.label, detail: pm.detail };
    } else if (req.body.paymentMethod) {
      paymentMethod = req.body.paymentMethod;
    } else {
      res.status(400);
      throw new Error('Payment method is required');
    }

    const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const tax = 0;
    const total = subtotal + shippingFee + tax;

    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 5);

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal, shippingFee, tax, total,
      shippingAddress, paymentMethod,
      trackingNumber: 'RV' + Date.now().toString().slice(-9),
      expectedDelivery,
    });

    // mark sold + clear cart of ordered items
    const productIds = orderItems.map(i => i.product);
    await Product.updateMany({ _id: { $in: productIds } }, { $set: { status: 'sold' } });
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { cart: { product: { $in: productIds } } } }
    );

    // bump sustainability stats for buyer
    const impact = sustainabilityImpact(orderItems);
    await User.updateOne({ _id: req.user._id }, {
      $inc: {
        itemsRescued: impact.itemsRescued,
        co2SavedKg: impact.co2SavedKg,
        waterSavedLiters: impact.waterSavedLiters,
        sustainabilityScore: impact.itemsRescued * 12,
      },
    });

    // bump seller sales count
    const sellerCount = orderItems.reduce((m, i) => {
      if (!i.seller) return m;
      const k = String(i.seller);
      m.set(k, (m.get(k) || 0) + i.qty);
      return m;
    }, new Map());
    for (const [sid, qty] of sellerCount) {
      await User.updateOne({ _id: sid }, { $inc: { sellerSalesCount: qty } });
    }

    res.status(201).json(order);
  } catch (err) { next(err); }
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    if (['delivered', 'shipped', 'cancelled', 'returned'].includes(order.status)) {
      res.status(400);
      throw new Error(`Cannot cancel an order in "${order.status}" state`);
    }
    order.status = 'cancelled';
    await order.save();
    // restock items
    await Product.updateMany(
      { _id: { $in: order.items.map(i => i.product).filter(Boolean) } },
      { $set: { status: 'active' } }
    );
    res.json(order);
  } catch (err) { next(err); }
});

module.exports = router;
