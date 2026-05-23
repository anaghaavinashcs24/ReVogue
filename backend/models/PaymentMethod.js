const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['upi', 'card', 'netbanking', 'cod'], required: true },
  label: { type: String, required: true, trim: true },
  detail: { type: String, default: '', trim: true },
  brand: { type: String, default: '' },
  last4: { type: String, default: '' },
  expiry: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
