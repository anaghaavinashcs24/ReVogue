const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, default: 1, min: 1 },
  size: { type: String },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  notifications: { type: Boolean, default: true },
  promotions: { type: Boolean, default: false },
  privateProfile: { type: Boolean, default: false },
  showLocation: { type: Boolean, default: true },
  darkMode: { type: Boolean, default: false },
}, { _id: false });

const profileSchema = new mongoose.Schema({
  bio: { type: String, default: 'Curating pre-loved treasures ✨', maxlength: 280 },
  location: { type: String, default: '' },
  avatarColor: { type: String, default: 'terracotta' },
  avatarUrl: { type: String, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true, index: true, sparse: true, unique: true },
  phone: { type: String, trim: true, index: true, sparse: true, unique: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['buyer', 'seller', 'both'], default: 'buyer' },
  username: { type: String, unique: true, sparse: true, index: true, trim: true },
  profile: { type: profileSchema, default: () => ({}) },
  settings: { type: settingsSchema, default: () => ({}) },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  cart: [cartItemSchema],
  sellerRating: { type: Number, default: 5.0, min: 0, max: 5 },
  sellerSalesCount: { type: Number, default: 0 },
  sustainabilityScore: { type: Number, default: 0 },
  itemsRescued: { type: Number, default: 0 },
  co2SavedKg: { type: Number, default: 0 },
  waterSavedLiters: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
