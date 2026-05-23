const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String, default: 'user' },
  avatar: { type: String, default: '✨' },
  text: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  username: { type: String, required: true, trim: true },
  avatar: { type: String, default: '✨' },
  caption: { type: String, default: '', maxlength: 1000 },
  image: { type: String, required: true },
  fallbackImage: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema],
}, { timestamps: true });

postSchema.index({ caption: 'text', tags: 'text', username: 'text' });

module.exports = mongoose.model('Post', postSchema);
