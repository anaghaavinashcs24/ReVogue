const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// PATCH /api/users/me  (profile / username / role)
router.patch('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, username, role, profile, email, phone } = req.body;
    if (name !== undefined) user.name = String(name).trim();
    if (username !== undefined) {
      const u = String(username).trim();
      if (u && await User.findOne({ username: u, _id: { $ne: user._id } })) {
        res.status(409);
        throw new Error('Username is taken');
      }
      user.username = u;
    }
    if (role && ['buyer', 'seller', 'both'].includes(role)) user.role = role;
    if (profile && typeof profile === 'object') {
      user.profile = { ...user.profile.toObject(), ...profile };
    }
    if (email !== undefined) user.email = email ? String(email).toLowerCase().trim() : undefined;
    if (phone !== undefined) user.phone = phone ? String(phone).trim() : undefined;
    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (err) { next(err); }
});

// PATCH /api/users/me/settings
router.patch('/me/settings', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.settings = { ...user.settings.toObject(), ...req.body };
    await user.save();
    res.json({ settings: user.settings });
  } catch (err) { next(err); }
});

// PATCH /api/users/me/avatar  { avatarUrl, avatarColor }
router.patch('/me/avatar', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.avatarUrl !== undefined) user.profile.avatarUrl = req.body.avatarUrl;
    if (req.body.avatarColor !== undefined) user.profile.avatarColor = req.body.avatarColor;
    await user.save();
    res.json({ profile: user.profile });
  } catch (err) { next(err); }
});

// GET /api/users/:idOrUsername — public profile
router.get('/:idOrUsername', async (req, res, next) => {
  try {
    const key = req.params.idOrUsername;
    const user = await User.findOne({
      $or: [{ username: key }, ...(key.match(/^[0-9a-f]{24}$/i) ? [{ _id: key }] : [])],
    }).select('name username profile sellerRating sellerSalesCount sustainabilityScore itemsRescued co2SavedKg waterSavedLiters settings.privateProfile createdAt flagCount deactivated flaggedBy');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    if (user.settings?.privateProfile) {
      return res.json({
        user: { username: user.username, profile: { bio: user.profile.bio }, isPrivate: true },
      });
    }
    const listingsCount = await Product.countDocuments({ seller: user._id, status: 'active' });
    res.json({ user, listingsCount });
  } catch (err) { next(err); }
});

// POST /api/users/:idOrUsername/flag — flag a user for selling fakes
router.post('/:idOrUsername/flag', protect, async (req, res, next) => {
  try {
    const key = req.params.idOrUsername;
    const target = await User.findOne({
      $or: [{ username: key }, ...(key.match(/^[0-9a-f]{24}$/i) ? [{ _id: key }] : [])],
    });
    if (!target) {
      res.status(404);
      throw new Error('User not found');
    }
    if (String(target._id) === String(req.user._id)) {
      res.status(400);
      throw new Error('You cannot flag yourself');
    }
    const already = target.flaggedBy.some(id => String(id) === String(req.user._id));
    if (already) {
      res.status(409);
      throw new Error('You have already flagged this user');
    }
    target.flaggedBy.push(req.user._id);
    target.flagCount = target.flaggedBy.length;
    if (target.flagCount >= 3 && !target.deactivated) {
      target.deactivated = true;
      target.deactivatedAt = new Date();
    }
    await target.save();
    res.json({
      flagged: true,
      flagCount: target.flagCount,
      deactivated: target.deactivated,
      message: target.deactivated
        ? `Reported. This account has been deactivated after ${target.flagCount} flags.`
        : `Reported. ${3 - target.flagCount} more flag${3 - target.flagCount === 1 ? '' : 's'} until deactivation.`,
    });
  } catch (err) { next(err); }
});

// POST /api/users/:idOrUsername/unflag — withdraw your flag
router.post('/:idOrUsername/unflag', protect, async (req, res, next) => {
  try {
    const key = req.params.idOrUsername;
    const target = await User.findOne({
      $or: [{ username: key }, ...(key.match(/^[0-9a-f]{24}$/i) ? [{ _id: key }] : [])],
    });
    if (!target) {
      res.status(404);
      throw new Error('User not found');
    }
    const before = target.flaggedBy.length;
    target.flaggedBy = target.flaggedBy.filter(id => String(id) !== String(req.user._id));
    if (target.flaggedBy.length === before) {
      res.status(409);
      throw new Error("You haven't flagged this user");
    }
    target.flagCount = target.flaggedBy.length;
    // Reinstate if they were deactivated and now drop below threshold
    if (target.deactivated && target.flagCount < 3) {
      target.deactivated = false;
      target.deactivatedAt = undefined;
    }
    await target.save();
    res.json({ flagged: false, flagCount: target.flagCount, deactivated: target.deactivated });
  } catch (err) { next(err); }
});

// DELETE /api/users/me — delete account
router.delete('/me', protect, async (req, res, next) => {
  try {
    await User.deleteOne({ _id: req.user._id });
    res.json({ message: 'Account deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
