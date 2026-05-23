const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  title: { type: String, required: true },
  brand: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: Number, required: true },
  qty: { type: Number, default: 1, min: 1 },
  size: { type: String, default: '' },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  name: { type: String, required: true },
  line1: { type: String, required: true },
  line2: { type: String, default: '' },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pin: { type: String, required: true },
  phone: { type: String, default: '' },
  country: { type: String, default: 'India' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
  shippingFee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  shippingAddress: { type: shippingAddressSchema, required: true },
  paymentMethod: {
    type: { type: String, enum: ['upi', 'card', 'netbanking', 'cod'], required: true },
    label: { type: String, default: '' },
    detail: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'placed',
    index: true,
  },
  trackingNumber: { type: String, default: '' },
  expectedDelivery: { type: Date },
  placedAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
