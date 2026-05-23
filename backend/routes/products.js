const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products?category=&gender=&vibe=&q=&minPrice=&maxPrice=&sort=&page=&limit=&seller=&mine=
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      category, gender, vibe, q,
      minPrice, maxPrice,
      sort = 'newest',
      page = 1, limit = 24,
      seller, mine,
    } = req.query;

    const filter = { status: 'active' };

    if (category && Product.CATEGORIES.includes(category)) filter.category = category;
    if (gender && gender !== 'All' && Product.GENDERS.includes(gender)) {
      filter.gender = { $in: [gender, 'Unisex'] };
    }
    if (vibe) filter.tags = vibe;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (seller && mongoose.isValidObjectId(seller)) filter.seller = seller;
    if (mine === 'true' && req.user) filter.seller = req.user._id;

    if (q) {
      const safe = String(q).trim();
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { brand: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }

    const sortMap = {
      newest: { createdAt: -1 },
      'price-low': { price: 1 },
      'price-high': { price: -1 },
      popular: { likes: -1 },
    };
    const sortBy = sortMap[sort] || sortMap.newest;

    const lim = Math.min(Number(limit) || 24, 100);
    const skip = (Math.max(Number(page), 1) - 1) * lim;

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sortBy).skip(skip).limit(lim).populate('seller', 'username name profile.avatarUrl sellerRating'),
      Product.countDocuments(filter),
    ]);

    res.json({
      items,
      page: Number(page),
      limit: lim,
      total,
      pages: Math.ceil(total / lim),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/meta — categories, conditions, vibes
router.get('/meta', (_req, res) => {
  res.json({
    categories: Product.CATEGORIES,
    conditions: Product.CONDITIONS,
    genders: Product.GENDERS,
    vibes: ['Street Style', 'Old Money', 'Y2K', 'Cottagecore', 'Grunge', 'Preppy', 'Minimal'],
  });
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid product id');
    }
    const product = await Product.findById(req.params.id)
      .populate('seller', 'username name profile.avatarUrl sellerRating sellerSalesCount');
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    Product.updateOne({ _id: product._id }, { $inc: { views: 1 } }).catch(() => {});
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post('/', protect, async (req, res, next) => {
  try {
    const {
      title, brand, description, price, originalPrice,
      category, condition, size, gender, tags, images,
    } = req.body;

    if (!title || !price || !category || !condition || !size) {
      res.status(400);
      throw new Error('Title, price, category, condition and size are required');
    }
    if (!Product.CATEGORIES.includes(category)) {
      res.status(400);
      throw new Error('Invalid category');
    }
    if (!Product.CONDITIONS.includes(condition)) {
      res.status(400);
      throw new Error('Invalid condition');
    }

    const product = await Product.create({
      title, brand, description,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      category, condition, size,
      gender: Product.GENDERS.includes(gender) ? gender : 'Unisex',
      tags: Array.isArray(tags) ? tags : [],
      images: Array.isArray(images) ? images : [],
      seller: req.user._id,
      sellerHandle: req.user.username || req.user.name,
      sellerRating: req.user.sellerRating || 4.8,
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id
router.patch('/:id', protect, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    if (!product.seller || String(product.seller) !== String(req.user._id)) {
      res.status(403);
      throw new Error('You can only edit your own listings');
    }
    const allowed = ['title', 'brand', 'description', 'price', 'originalPrice', 'category', 'condition', 'size', 'gender', 'tags', 'images', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) product[key] = req.body[key];
    }
    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    if (!product.seller || String(product.seller) !== String(req.user._id)) {
      res.status(403);
      throw new Error('You can only delete your own listings');
    }
    await product.deleteOne();
    res.json({ message: 'Listing removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/like  (toggle increments only — likes are non-auth counters)
router.post('/:id/like', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    res.json({ likes: product.likes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
