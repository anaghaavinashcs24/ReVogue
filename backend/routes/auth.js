const express = require('express');
const User = require('../models/User');
const { signToken, protect } = require('../middleware/auth');

const router = express.Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
const isPhone = (v) => /^\+?[\d\s-]{7,15}$/.test(String(v).trim());

function validateContact(contact) {
  if (!contact || !String(contact).trim()) return 'Please enter your email or phone';
  if (/[a-zA-Z]/.test(contact) && !isEmail(contact)) return 'Enter a valid email (must include @)';
  if (!/[a-zA-Z]/.test(contact) && !isPhone(contact)) return 'Enter a valid phone number';
  return '';
}

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { name, contact, password, role, securityQuestion, securityAnswer } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400);
      throw new Error('Please enter your name');
    }
    const contactErr = validateContact(contact);
    if (contactErr) {
      res.status(400);
      throw new Error(contactErr);
    }
    if (!password || password.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }

    const query = isEmail(contact)
      ? { email: contact.toLowerCase().trim() }
      : { phone: contact.trim() };

    const existing = await User.findOne(query);
    if (existing) {
      res.status(409);
      throw new Error('An account already exists with this email/phone');
    }

    const securityAnswerHash = securityQuestion && securityAnswer
      ? await User.hashSecurityAnswer(securityAnswer)
      : '';

    const user = await User.create({
      name: name.trim(),
      ...query,
      password,
      role: ['buyer', 'seller', 'both'].includes(role) ? role : 'buyer',
      username: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) +
        '_' + Math.random().toString(36).slice(2, 6),
      securityQuestion: securityQuestion || '',
      securityAnswerHash,
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password — step 1: returns the user's security question
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { contact } = req.body;
    const contactErr = validateContact(contact);
    if (contactErr) {
      res.status(400);
      throw new Error(contactErr);
    }
    const query = isEmail(contact)
      ? { email: contact.toLowerCase().trim() }
      : { phone: contact.trim() };
    const user = await User.findOne(query);
    if (!user || !user.securityQuestion) {
      // Generic message so we don't leak which emails exist
      res.status(404);
      throw new Error('No reset option found for this account');
    }
    res.json({ securityQuestion: user.securityQuestion });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — step 2: verifies answer + sets new password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { contact, securityAnswer, newPassword } = req.body;
    const contactErr = validateContact(contact);
    if (contactErr) {
      res.status(400);
      throw new Error(contactErr);
    }
    if (!securityAnswer || !String(securityAnswer).trim()) {
      res.status(400);
      throw new Error('Please answer the security question');
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
    }
    const query = isEmail(contact)
      ? { email: contact.toLowerCase().trim() }
      : { phone: contact.trim() };
    const user = await User.findOne(query).select('+securityAnswerHash +password');
    if (!user || !user.securityAnswerHash) {
      res.status(401);
      throw new Error('Could not verify your account');
    }
    const ok = await user.compareSecurityAnswer(securityAnswer);
    if (!ok) {
      res.status(401);
      throw new Error('That answer is not correct');
    }
    user.password = newPassword;
    await user.save();
    const token = signToken(user._id);
    res.json({ message: 'Password updated', token, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/signin
router.post('/signin', async (req, res, next) => {
  try {
    const { contact, password } = req.body;
    const contactErr = validateContact(contact);
    if (contactErr) {
      res.status(400);
      throw new Error(contactErr);
    }
    if (!password) {
      res.status(400);
      throw new Error('Password is required');
    }
    const query = isEmail(contact)
      ? { email: contact.toLowerCase().trim() }
      : { phone: contact.trim() };

    const user = await User.findOne(query).select('+password');
    if (!user) {
      res.status(401);
      throw new Error('Invalid credentials');
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      res.status(401);
      throw new Error('Invalid credentials');
    }
    if (user.deactivated) {
      res.status(403);
      throw new Error('This account has been deactivated due to community reports.');
    }
    const token = signToken(user._id);
    res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// POST /api/auth/change-password
router.post('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
    }
    const user = await User.findById(req.user._id).select('+password');
    const ok = await user.comparePassword(currentPassword || '');
    if (!ok) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
