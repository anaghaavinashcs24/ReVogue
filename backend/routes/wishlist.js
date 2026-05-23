const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// GET /api/wishlist
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');
    res.json({ items: user.wishlist });
  } catch (err) { next(err); }
});

// POST /api/wishlist/:productId
router.post('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      res.status(400);
      throw new Error('Invalid product id');
    }
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { wishlist: productId } }
    );
    const user = await User.findById(req.user._id).populate('wishlist');
    res.json({ items: user.wishlist });
  } catch (err) { next(err); }
});

// DELETE /api/wishlist/:productId
router.delete('/:productId', async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { wishlist: req.params.productId } }
    );
    const user = await User.findById(req.user._id).populate('wishlist');
    res.json({ items: user.wishlist });
  } catch (err) { next(err); }
});

// DELETE /api/wishlist
router.delete('/', async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { wishlist: [] } });
    res.json({ items: [] });
  } catch (err) { next(err); }
});

module.exports = router;
