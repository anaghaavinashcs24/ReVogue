const mongoose = require('mongoose');

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'];
const CONDITIONS = ['Like New', 'Excellent', 'Good', 'Fair'];
const GENDERS = ['Women', 'Men', 'Unisex'];

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  brand: { type: String, trim: true, default: 'Vintage' },
  description: { type: String, default: '', maxlength: 2000 },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, min: 0 },
  category: { type: String, enum: CATEGORIES, required: true, index: true },
  condition: { type: String, enum: CONDITIONS, required: true },
  size: { type: String, required: true, trim: true },
  gender: { type: String, enum: GENDERS, default: 'Unisex', index: true },
  tags: [{ type: String, trim: true }],
  images: [{ type: String }],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  sellerHandle: { type: String, trim: true, default: '' },
  sellerRating: { type: Number, default: 4.8, min: 0, max: 5 },
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'sold', 'archived'], default: 'active', index: true },
  isCurated: { type: Boolean, default: false },
}, { timestamps: true });

productSchema.index({ title: 'text', brand: 'text', tags: 'text', description: 'text' });

productSchema.virtual('discount').get(function () {
  if (!this.originalPrice || this.originalPrice <= 0) return 0;
  return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

productSchema.statics.CATEGORIES = CATEGORIES;
productSchema.statics.CONDITIONS = CONDITIONS;
productSchema.statics.GENDERS = GENDERS;

module.exports = mongoose.model('Product', productSchema);
