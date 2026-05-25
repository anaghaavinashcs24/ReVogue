const express = require('express');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/sustainability/me
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('itemsRescued co2SavedKg waterSavedLiters sustainabilityScore sellerSalesCount');

    const [orders, listingsCount, postsCount] = await Promise.all([
      Order.countDocuments({
        user: req.user._id,
        status: { $in: ['placed', 'confirmed', 'packed', 'shipped', 'delivered'] },
      }),
      Product.countDocuments({ seller: req.user._id }),
      Post.countDocuments({ user: req.user._id }),
    ]);

    const tier = (() => {
      const s = user.sustainabilityScore;
      if (s >= 500) return { label: 'Earth Hero', emoji: '🌍', next: null };
      if (s >= 250) return { label: 'Eco Champion', emoji: '🌱', next: 500 };
      if (s >= 100) return { label: 'Style Saver', emoji: '♻️', next: 250 };
      if (s >= 25)  return { label: 'Thrift Starter', emoji: '🌿', next: 100 };
      return { label: 'New Explorer', emoji: '✨', next: 25 };
    })();

    res.json({
      itemsRescued: user.itemsRescued,
      co2SavedKg: user.co2SavedKg,
      waterSavedLiters: user.waterSavedLiters,
      score: user.sustainabilityScore,
      ordersCount: orders,
      tier,
      breakdown: {
        purchases: { count: user.itemsRescued, points: user.itemsRescued * 12, pointsEach: 12 },
        sales:     { count: user.sellerSalesCount || 0, points: (user.sellerSalesCount || 0) * 15, pointsEach: 15 },
        listings:  { count: listingsCount, points: listingsCount * 8, pointsEach: 8 },
        posts:     { count: postsCount, points: postsCount * 3, pointsEach: 3 },
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
