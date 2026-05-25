const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/posts
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tag, user, q } = req.query;
    const filter = {};
    if (tag) filter.tags = tag;
    if (user && mongoose.isValidObjectId(user)) filter.user = user;
    if (q) {
      const safe = String(q).trim();
      filter.$or = [
        { caption: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
      ];
    }

    const lim = Math.min(Number(limit) || 20, 50);
    const skip = (Math.max(Number(page), 1) - 1) * lim;

    const [items, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim)
        .populate('products', 'title price images brand category')
        .populate('user', 'username profile.avatarUrl profile.avatarColor'),
      Post.countDocuments(filter),
    ]);

    const enriched = items.map(p => {
      const o = p.toObject();
      o.likedByMe = req.user ? p.likedBy.some(id => String(id) === String(req.user._id)) : false;
      o.savedByMe = req.user ? p.savedBy.some(id => String(id) === String(req.user._id)) : false;
      o.commentCount = p.comments.length;
      // Live avatar from the user document (so profile pic updates are reflected)
      if (o.user && o.user.profile && o.user.profile.avatarUrl) {
        o.avatarUrl = o.user.profile.avatarUrl;
      }
      delete o.likedBy;
      delete o.savedBy;
      return o;
    });

    res.json({ items: enriched, total, page: Number(page), pages: Math.ceil(total / lim) });
  } catch (err) { next(err); }
});

// GET /api/posts/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid post id');
    }
    const p = await Post.findById(req.params.id)
      .populate('products', 'title price images brand category')
      .populate('user', 'username profile.avatarUrl profile.avatarColor');
    if (!p) {
      res.status(404);
      throw new Error('Post not found');
    }
    const o = p.toObject();
    if (o.user && o.user.profile && o.user.profile.avatarUrl) {
      o.avatarUrl = o.user.profile.avatarUrl;
    }
    o.likedByMe = req.user ? p.likedBy.some(id => String(id) === String(req.user._id)) : false;
    o.savedByMe = req.user ? p.savedBy.some(id => String(id) === String(req.user._id)) : false;
    res.json(o);
  } catch (err) { next(err); }
});

// POST /api/posts
router.post('/', protect, async (req, res, next) => {
  try {
    const { caption, image, fallbackImage, tags, products } = req.body;
    if (!image) {
      res.status(400);
      throw new Error('An image is required to post');
    }
    const post = await Post.create({
      user: req.user._id,
      username: req.user.username || req.user.name,
      avatar: req.user.profile?.avatarUrl ? '' : '✨',
      caption: caption || '',
      image,
      fallbackImage: fallbackImage || '',
      tags: Array.isArray(tags) ? tags : [],
      products: Array.isArray(products) ? products : [],
    });
    res.status(201).json(post);
  } catch (err) { next(err); }
});

// PATCH /api/posts/:id  — owner only
router.patch('/:id', protect, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }
    if (String(post.user) !== String(req.user._id)) {
      res.status(403);
      throw new Error('You can only edit your own posts');
    }
    const allowed = ['caption', 'image', 'fallbackImage', 'tags', 'products'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) post[key] = req.body[key];
    }
    await post.save();
    res.json(post);
  } catch (err) { next(err); }
});

// POST /api/posts/:id/like
router.post('/:id/like', protect, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }
    const has = post.likedBy.some(id => String(id) === String(req.user._id));
    if (has) {
      post.likedBy.pull(req.user._id);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(req.user._id);
      post.likes += 1;
    }
    await post.save();
    res.json({ liked: !has, likes: post.likes });
  } catch (err) { next(err); }
});

// POST /api/posts/:id/save
router.post('/:id/save', protect, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }
    const has = post.savedBy.some(id => String(id) === String(req.user._id));
    if (has) post.savedBy.pull(req.user._id);
    else post.savedBy.push(req.user._id);
    await post.save();
    res.json({ saved: !has });
  } catch (err) { next(err); }
});

// POST /api/posts/:id/comments
router.post('/:id/comments', protect, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400);
      throw new Error('Comment cannot be empty');
    }
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }
    const comment = {
      user: req.user._id,
      username: req.user.username || req.user.name,
      avatar: '✨',
      text: text.trim(),
    };
    post.comments.push(comment);
    await post.save();
    res.status(201).json(post.comments[post.comments.length - 1]);
  } catch (err) { next(err); }
});

// DELETE /api/posts/:id/comments/:commentId
router.delete('/:id/comments/:commentId', protect, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }
    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      res.status(404);
      throw new Error('Comment not found');
    }
    const isAuthor = String(comment.user) === String(req.user._id);
    const isPostOwner = String(post.user) === String(req.user._id);
    if (!isAuthor && !isPostOwner) {
      res.status(403);
      throw new Error('You cannot remove this comment');
    }
    comment.deleteOne();
    await post.save();
    res.json({ message: 'Comment removed' });
  } catch (err) { next(err); }
});

// DELETE /api/posts/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }
    if (String(post.user) !== String(req.user._id)) {
      res.status(403);
      throw new Error('You can only delete your own posts');
    }
    await post.deleteOne();
    res.json({ message: 'Post removed' });
  } catch (err) { next(err); }
});

module.exports = router;
