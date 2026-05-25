import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Heart, ShoppingBag, Home, User, Sparkles, Plus, ArrowLeft, Star, Filter, Check, Camera, MessageCircle, Share2, Bookmark, ChevronRight, Trash2, MapPin, CreditCard, Truck, Shield, X, Eye, EyeOff, TrendingUp, Award, Zap, Package, Edit3 } from 'lucide-react';
import { api, getToken, setToken } from './api';

// ----- API helpers: normalize backend shapes to what the UI already expects -----
const normalizeProduct = (p) => {
  if (!p) return null;
  return {
    ...p,
    id: p._id || p.id,
    img: (p.images && p.images[0]) || p.img || '',
    imgs: p.images || p.imgs || [],
    seller: typeof p.seller === 'string' ? p.seller : (p.sellerHandle || p.seller?.username || 'seller'),
    sellerRating: p.sellerRating ?? p.seller?.sellerRating ?? 4.8,
    tags: p.tags || [],
    originalPrice: p.originalPrice ?? p.price,
    title: p.title || 'Untitled',
    brand: p.brand || '',
    price: p.price ?? 0,
    condition: p.condition || 'Good',
    size: p.size || 'M',
    category: p.category || 'Tops',
    gender: p.gender || 'Unisex',
  };
};

const normalizePost = (p) => {
  if (!p) return null;
  // Backend populates the author and exposes the live avatarUrl on the post itself.
  const liveAvatarUrl = p.avatarUrl || (p.user && typeof p.user === 'object' && p.user.profile && p.user.profile.avatarUrl) || '';
  return {
    ...p,
    id: p._id || p.id,
    user: p.username || (typeof p.user === 'string' ? p.user : p.user?.username) || '',
    img: p.image || p.img,
    fallbackImg: p.fallbackImage || p.fallbackImg,
    products: (p.products || []).map(pp => (typeof pp === 'string' ? pp : pp?._id || pp?.id)).filter(Boolean),
    comments: p.comments || [],
    tags: p.tags || [],
    likes: p.likes ?? 0,
    avatar: p.avatar || '✨',
    avatarUrl: liveAvatarUrl,
    caption: p.caption || '',
  };
};

const normalizeOrder = (o) => {
  if (!o) return null;
  return {
    ...o,
    id: o._id || o.id,
    num: o.trackingNumber || (o._id ? `RV${String(o._id).slice(-8).toUpperCase()}` : 'RV------'),
    total: o.total ?? 0,
    items: (o.items || []).map(it => ({
      ...it,
      img: it.image || it.img || '',
      id: it.product?._id || it.product || it.id,
      title: it.title || 'Item',
      price: it.price ?? 0,
    })),
    placedAt: o.placedAt || o.createdAt || new Date().toISOString(),
    status: typeof o.status === 'string' ? (o.status.charAt(0).toUpperCase() + o.status.slice(1)) : 'Placed',
  };
};

const normalizeAddress = (a) => (a ? { ...a, id: a._id || a.id } : null);
const normalizePayment = (p) => (p ? { ...p, id: p._id || p.id } : null);

// ============ SVG IMAGE GENERATOR ============
// Detailed, item-specific inline SVG illustrations — guaranteed to render
const PALETTES = {
  sage: { bg1: '#dce7d3', bg2: '#b8cdb0', main: '#8fa08a', dark: '#5a6d56', accent: '#f5efe3', light: '#e8efe2' },
  terracotta: { bg1: '#f2dcc8', bg2: '#e8bfa3', main: '#c4704a', dark: '#8a4a2e', accent: '#f5efe3', light: '#f8e3d0' },
  cream: { bg1: '#f5eedb', bg2: '#e8d5b7', main: '#d4c094', dark: '#9a8560', accent: '#faf6ed', light: '#faf2dd' },
  rust: { bg1: '#f0cfc0', bg2: '#e0a898', main: '#a0492d', dark: '#6e2e18', accent: '#f5efe3', light: '#f5d5c5' },
  navy: { bg1: '#c5d1df', bg2: '#8fa3bc', main: '#3d5875', dark: '#1f304a', accent: '#f5efe3', light: '#dbe4ee' },
  olive: { bg1: '#d8d5b0', bg2: '#b8b286', main: '#7a7543', dark: '#4a4625', accent: '#f5efe3', light: '#e3e0c0' },
  pink: { bg1: '#f5d8d0', bg2: '#e8b5a8', main: '#c97a7a', dark: '#8a4848', accent: '#f5efe3', light: '#f8e0d8' },
  gold: { bg1: '#f0e0b0', bg2: '#dcc474', main: '#c4a456', dark: '#7a6530', accent: '#f5efe3', light: '#f5e8c0' },
  brown: { bg1: '#d8c4a8', bg2: '#b89570', main: '#6b4226', dark: '#3d2614', accent: '#e8d5b7', light: '#e0d0b8' },
  ink: { bg1: '#b8b0a8', bg2: '#7a7068', main: '#2a241d', dark: '#1a1410', accent: '#d6cab4', light: '#c4bcb0' },
  plum: { bg1: '#d9c5d8', bg2: '#b890b5', main: '#7a4a78', dark: '#4a2a48', accent: '#f5efe3', light: '#dccddc' },
  mint: { bg1: '#cce8d8', bg2: '#99c9b0', main: '#5a9778', dark: '#2e5a4a', accent: '#f5efe3', light: '#d8eee0' },
  red: { bg1: '#f0c5c0', bg2: '#dc8a85', main: '#c83a30', dark: '#8a1c14', accent: '#f5efe3', light: '#f5cdc8' },
  butter: { bg1: '#faedb5', bg2: '#e8d680', main: '#d8b440', dark: '#9a7820', accent: '#faf6ed', light: '#f5e8b8' },
  ocean: { bg1: '#b8d6dc', bg2: '#7aa8b0', main: '#3a6870', dark: '#1c4045', accent: '#f5efe3', light: '#cce0e5' },
  lilac: { bg1: '#e0cfe5', bg2: '#b89cc4', main: '#7858a0', dark: '#4a3068', accent: '#f5efe3', light: '#e8dbe8' },
};

// SHAPE BUILDERS — each is item-specific, detailed enough to read as that thing
const SHAPES = {
  // ===== TOPS =====
  'crew-sweater': (c) => `<path d="M55 80 L100 62 L145 80 L162 100 L152 110 L142 105 L142 215 L58 215 L58 105 L48 110 L38 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 75 Q100 88 115 75" fill="none" stroke="${c.dark}" stroke-width="2" stroke-linecap="round"/><line x1="60" y1="120" x2="140" y2="120" stroke="${c.dark}" stroke-width="0.5" opacity="0.4"/><line x1="60" y1="160" x2="140" y2="160" stroke="${c.dark}" stroke-width="0.5" opacity="0.4"/><line x1="60" y1="200" x2="140" y2="200" stroke="${c.dark}" stroke-width="0.5" opacity="0.4"/>`,
  'tshirt': (c) => `<path d="M60 75 L100 60 L140 75 L160 95 L150 105 L140 100 L140 215 L60 215 L60 100 L50 105 L40 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 70 Q100 80 115 70" fill="${c.bg1}" stroke="${c.dark}" stroke-width="2"/>`,
  'graphic-tee': (c) => `<path d="M60 75 L100 60 L140 75 L160 95 L150 105 L140 100 L140 215 L60 215 L60 100 L50 105 L40 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 70 Q100 80 115 70" fill="${c.bg1}" stroke="${c.dark}" stroke-width="2"/><rect x="78" y="125" width="44" height="50" rx="2" fill="${c.accent}" opacity="0.85" stroke="${c.dark}" stroke-width="1"/><circle cx="100" cy="145" r="8" fill="${c.dark}" opacity="0.7"/><rect x="86" y="160" width="28" height="3" fill="${c.dark}" opacity="0.7"/><rect x="92" y="167" width="16" height="3" fill="${c.dark}" opacity="0.7"/>`,
  'quarter-zip': (c) => `<path d="M58 80 L100 62 L142 80 L160 100 L150 110 L140 105 L140 215 L60 215 L60 105 L50 110 L40 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M88 70 L88 130 L100 138 L112 130 L112 70" fill="${c.light}" stroke="${c.dark}" stroke-width="1.5"/><line x1="100" y1="70" x2="100" y2="130" stroke="${c.dark}" stroke-width="2"/><circle cx="100" cy="80" r="2" fill="${c.dark}"/><circle cx="100" cy="92" r="2" fill="${c.dark}"/><circle cx="100" cy="104" r="2" fill="${c.dark}"/><circle cx="100" cy="116" r="2" fill="${c.dark}"/>`,
  'turtleneck': (c) => `<path d="M58 90 L100 75 L142 90 L160 110 L150 120 L140 115 L140 215 L60 215 L60 115 L50 120 L40 110 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M82 60 L82 90 L118 90 L118 60 Q100 52 82 60 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="82" y1="68" x2="118" y2="68" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/><line x1="82" y1="76" x2="118" y2="76" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/><line x1="82" y1="84" x2="118" y2="84" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/>`,
  'flannel': (c) => `<path d="M58 80 L100 62 L142 80 L160 100 L150 110 L140 105 L140 215 L60 215 L60 105 L50 110 L40 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="100" y1="62" x2="100" y2="215" stroke="${c.dark}" stroke-width="1.5"/><line x1="60" y1="120" x2="140" y2="120" stroke="${c.dark}" stroke-width="1" opacity="0.6"/><line x1="60" y1="160" x2="140" y2="160" stroke="${c.dark}" stroke-width="1" opacity="0.6"/><line x1="80" y1="105" x2="80" y2="215" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><line x1="120" y1="105" x2="120" y2="215" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><circle cx="100" cy="135" r="1.5" fill="${c.accent}"/><circle cx="100" cy="180" r="1.5" fill="${c.accent}"/>`,
  'polo': (c) => `<path d="M60 80 L100 62 L140 80 L160 100 L150 110 L140 105 L140 215 L60 215 L60 105 L50 110 L40 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M88 64 L100 80 L112 64 L100 60 Z" fill="${c.light}" stroke="${c.dark}" stroke-width="1.5"/><line x1="100" y1="80" x2="100" y2="115" stroke="${c.dark}" stroke-width="1.5"/><circle cx="100" cy="95" r="1.5" fill="${c.dark}"/><circle cx="100" cy="108" r="1.5" fill="${c.dark}"/>`,
  'blouse': (c) => `<path d="M60 80 L100 62 L140 80 L162 100 L155 110 L142 105 L142 220 L58 220 L58 105 L45 110 L38 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 70 Q100 78 115 70" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.7"/><path d="M70 130 Q100 138 130 130" fill="none" stroke="${c.dark}" stroke-width="0.5" opacity="0.4"/><path d="M70 170 Q100 178 130 170" fill="none" stroke="${c.dark}" stroke-width="0.5" opacity="0.4"/>`,

  // ===== BOTTOMS =====
  'jeans': (c) => `<path d="M68 65 L132 65 L138 105 L144 220 L113 220 L104 115 L100 115 L96 115 L87 220 L56 220 L62 105 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="68" y1="78" x2="132" y2="78" stroke="${c.dark}" stroke-width="1.5" opacity="0.6"/><rect x="74" y="86" width="14" height="18" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><rect x="112" y="86" width="14" height="18" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><line x1="100" y1="65" x2="100" y2="115" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/><circle cx="100" cy="73" r="1.5" fill="${c.dark}"/>`,
  'wide-leg': (c) => `<path d="M65 65 L135 65 L142 110 L155 220 L113 220 L104 120 L100 120 L96 120 L87 220 L45 220 L58 110 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="65" y1="78" x2="135" y2="78" stroke="${c.dark}" stroke-width="1.5" opacity="0.6"/><line x1="100" y1="65" x2="100" y2="120" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/>`,
  'cargo': (c) => `<path d="M68 65 L132 65 L138 105 L144 220 L113 220 L104 115 L100 115 L96 115 L87 220 L56 220 L62 105 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="68" y1="78" x2="132" y2="78" stroke="${c.dark}" stroke-width="1.5" opacity="0.6"/><rect x="64" y="125" width="22" height="28" fill="none" stroke="${c.dark}" stroke-width="1" opacity="0.7"/><rect x="114" y="125" width="22" height="28" fill="none" stroke="${c.dark}" stroke-width="1" opacity="0.7"/><line x1="100" y1="65" x2="100" y2="115" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/>`,
  'mom-jeans': (c) => `<path d="M68 60 L132 60 L138 100 L144 220 L113 220 L104 110 L100 110 L96 110 L87 220 L56 220 L62 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="68" y1="80" x2="132" y2="80" stroke="${c.dark}" stroke-width="2" opacity="0.7"/><rect x="76" y="88" width="12" height="16" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><rect x="112" y="88" width="12" height="16" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><circle cx="100" cy="68" r="1.5" fill="${c.dark}"/>`,
  'mini-skirt': (c) => `<path d="M70 70 L130 70 L142 130 L150 175 L50 175 L58 130 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="70" y1="80" x2="130" y2="80" stroke="${c.dark}" stroke-width="1.5" opacity="0.6"/>`,
  'pleated-skirt': (c) => `<path d="M70 70 L130 70 L142 130 L150 180 L50 180 L58 130 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="70" y1="80" x2="130" y2="80" stroke="${c.dark}" stroke-width="1.5"/><line x1="80" y1="80" x2="74" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><line x1="90" y1="80" x2="86" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><line x1="100" y1="80" x2="100" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><line x1="110" y1="80" x2="114" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/><line x1="120" y1="80" x2="126" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/>`,
  'plaid-skirt': (c) => `<path d="M70 70 L130 70 L142 130 L150 180 L50 180 L58 130 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="70" y1="80" x2="130" y2="80" stroke="${c.dark}" stroke-width="1"/><line x1="80" y1="70" x2="68" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/><line x1="100" y1="70" x2="100" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/><line x1="120" y1="70" x2="132" y2="180" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/><line x1="63" y1="105" x2="138" y2="105" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/><line x1="56" y1="140" x2="146" y2="140" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/>`,
  'shorts': (c) => `<path d="M68 70 L132 70 L138 100 L132 150 L108 150 L102 105 L100 105 L98 105 L92 150 L68 150 L62 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="68" y1="80" x2="132" y2="80" stroke="${c.dark}" stroke-width="1.5" opacity="0.6"/>`,

  // ===== DRESSES =====
  'midi-dress': (c) => `<path d="M75 65 L125 65 L130 95 L145 110 L135 115 L160 220 L40 220 L65 115 L55 110 L70 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M88 78 Q100 86 112 78" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.7"/><path d="M70 150 Q100 160 130 150" fill="none" stroke="${c.dark}" stroke-width="0.5" opacity="0.3"/>`,
  'tea-dress': (c) => `<path d="M75 65 L125 65 L130 95 L145 110 L138 115 L155 220 L45 220 L62 115 L55 110 L70 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M88 78 Q100 88 112 78" fill="none" stroke="${c.dark}" stroke-width="1.5"/><circle cx="80" cy="135" r="3" fill="${c.accent}" opacity="0.7"/><circle cx="120" cy="155" r="3" fill="${c.accent}" opacity="0.7"/><circle cx="95" cy="175" r="3" fill="${c.accent}" opacity="0.7"/><circle cx="115" cy="195" r="3" fill="${c.accent}" opacity="0.7"/><circle cx="85" cy="200" r="3" fill="${c.accent}" opacity="0.7"/>`,
  'slip-dress': (c) => `<path d="M78 70 L122 70 L125 95 L135 220 L65 220 L75 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="1.5"/><path d="M82 64 L82 70 M118 64 L118 70" stroke="${c.dark}" stroke-width="1.5"/><path d="M85 80 Q100 88 115 80" fill="none" stroke="${c.dark}" stroke-width="1" opacity="0.6"/>`,
  'maxi-dress': (c) => `<path d="M75 65 L125 65 L132 95 L148 110 L140 115 L168 230 L32 230 L60 115 L52 110 L68 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M88 78 Q100 86 112 78" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity="0.7"/>`,
  'wrap-dress': (c) => `<path d="M75 65 L125 65 L130 95 L145 110 L135 115 L160 220 L40 220 L65 115 L55 110 L70 95 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 78 L100 130 L115 78" fill="none" stroke="${c.dark}" stroke-width="1.8"/><path d="M80 130 L120 130" stroke="${c.dark}" stroke-width="2"/><path d="M120 130 L155 145" stroke="${c.dark}" stroke-width="1.5"/>`,

  // ===== SHOES =====
  'oxford': (c) => `<path d="M28 148 Q28 122 52 122 L138 122 Q168 122 172 148 Q176 168 156 174 L40 174 Q20 174 28 148 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M52 122 L60 102 Q90 96 130 96 Q145 96 145 122" fill="${c.dark}" stroke="${c.dark}" stroke-width="1.5"/><line x1="80" y1="135" x2="125" y2="135" stroke="${c.accent}" stroke-width="1.5"/><circle cx="85" cy="135" r="2" fill="${c.dark}"/><circle cx="100" cy="135" r="2" fill="${c.dark}"/><circle cx="115" cy="135" r="2" fill="${c.dark}"/><line x1="55" y1="160" x2="155" y2="160" stroke="${c.dark}" stroke-width="0.8" opacity="0.4"/>`,
  'sneakers': (c) => `<path d="M22 158 Q22 132 48 132 L138 132 Q172 132 178 158 Q182 178 158 184 L36 184 Q14 184 22 158 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M48 132 L52 110 Q88 102 130 102 Q148 102 148 132" fill="${c.light}" stroke="${c.dark}" stroke-width="1.8"/><ellipse cx="100" cy="118" rx="20" ry="6" fill="${c.dark}"/><line x1="22" y1="170" x2="178" y2="170" stroke="${c.accent}" stroke-width="3"/><circle cx="70" cy="120" r="2" fill="${c.dark}"/><circle cx="100" cy="120" r="2" fill="${c.dark}"/><circle cx="130" cy="120" r="2" fill="${c.dark}"/>`,
  'platform-boots': (c) => `<path d="M55 60 L130 60 L130 150 L160 150 L168 178 L25 178 L32 150 L55 150 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><rect x="22" y="178" width="148" height="14" fill="${c.dark}"/><line x1="60" y1="80" x2="125" y2="80" stroke="${c.accent}" stroke-width="1"/><line x1="60" y1="100" x2="125" y2="100" stroke="${c.accent}" stroke-width="1"/><circle cx="92" cy="80" r="1.5" fill="${c.dark}"/><circle cx="92" cy="100" r="1.5" fill="${c.dark}"/><circle cx="92" cy="120" r="1.5" fill="${c.dark}"/><circle cx="92" cy="140" r="1.5" fill="${c.dark}"/>`,
  'heels': (c) => `<path d="M30 150 L130 150 Q160 150 168 168 L168 175 L120 175 L115 145 Q90 140 70 145 L40 175 L20 175 Q22 158 30 150 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><rect x="115" y="170" width="6" height="40" fill="${c.dark}"/>`,
  'sandals': (c) => `<ellipse cx="100" cy="160" rx="60" ry="14" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M70 130 L130 130 L120 160 L80 160 Z" fill="none" stroke="${c.dark}" stroke-width="2"/><line x1="100" y1="130" x2="100" y2="160" stroke="${c.dark}" stroke-width="2"/>`,
  'loafers': (c) => `<path d="M30 150 Q30 128 55 128 L140 128 Q170 128 174 152 Q178 168 158 174 L42 174 Q22 174 30 150 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M55 128 L60 110 Q88 104 128 104 Q142 104 142 128" fill="${c.dark}" stroke="${c.dark}" stroke-width="1.5"/><rect x="86" y="138" width="28" height="6" rx="1" fill="${c.accent}"/><circle cx="92" cy="141" r="1.5" fill="${c.dark}"/><circle cx="108" cy="141" r="1.5" fill="${c.dark}"/>`,

  // ===== OUTERWEAR =====
  'bomber': (c) => `<path d="M55 78 L100 60 L145 78 L165 105 L155 115 L145 110 L145 200 L130 215 L70 215 L55 200 L55 110 L45 115 L35 105 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M80 70 Q100 80 120 70" fill="none" stroke="${c.dark}" stroke-width="1.5"/><line x1="100" y1="80" x2="100" y2="215" stroke="${c.dark}" stroke-width="1.5"/><line x1="55" y1="195" x2="145" y2="195" stroke="${c.dark}" stroke-width="2"/><line x1="35" y1="180" x2="55" y2="195" stroke="${c.dark}" stroke-width="1"/><line x1="165" y1="180" x2="145" y2="195" stroke="${c.dark}" stroke-width="1"/><circle cx="93" cy="115" r="2" fill="${c.accent}"/><circle cx="93" cy="135" r="2" fill="${c.accent}"/><circle cx="93" cy="155" r="2" fill="${c.accent}"/>`,
  'leather-jacket': (c) => `<path d="M55 75 L100 58 L145 75 L165 100 L155 115 L142 108 L142 215 L58 215 L58 108 L45 115 L35 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 65 L100 130 L115 65" fill="${c.dark}" opacity="0.7" stroke="${c.dark}" stroke-width="1.5"/><line x1="120" y1="80" x2="120" y2="215" stroke="${c.dark}" stroke-width="1.5"/><circle cx="115" cy="100" r="1.5" fill="${c.accent}"/><circle cx="115" cy="125" r="1.5" fill="${c.accent}"/><circle cx="115" cy="150" r="1.5" fill="${c.accent}"/><rect x="62" y="155" width="20" height="25" fill="none" stroke="${c.dark}" stroke-width="1" opacity="0.6"/>`,
  'overshirt': (c) => `<path d="M55 78 L100 60 L145 78 L162 100 L152 110 L142 105 L142 220 L58 220 L58 105 L48 110 L38 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="100" y1="65" x2="100" y2="220" stroke="${c.dark}" stroke-width="1.5"/><circle cx="93" cy="100" r="2" fill="${c.accent}"/><circle cx="93" cy="125" r="2" fill="${c.accent}"/><circle cx="93" cy="150" r="2" fill="${c.accent}"/><circle cx="93" cy="175" r="2" fill="${c.accent}"/><circle cx="93" cy="200" r="2" fill="${c.accent}"/><rect x="68" y="115" width="22" height="26" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/><rect x="110" y="115" width="22" height="26" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.6"/>`,
  'trench': (c) => `<path d="M55 75 L100 58 L145 75 L168 105 L158 115 L148 108 L148 230 L52 230 L52 108 L42 115 L32 105 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M75 90 L100 75 L100 230 L75 230 Z" fill="none" stroke="${c.dark}" stroke-width="1.5" opacity="0.7"/><line x1="55" y1="170" x2="148" y2="170" stroke="${c.dark}" stroke-width="2.5"/><circle cx="86" cy="170" r="3" fill="${c.dark}"/><circle cx="114" cy="170" r="3" fill="${c.dark}"/><circle cx="86" cy="195" r="3" fill="${c.dark}"/><circle cx="114" cy="195" r="3" fill="${c.dark}"/>`,
  'puffer': (c) => `<path d="M55 80 L100 62 L145 80 L162 105 L152 115 L142 110 L142 220 L58 220 L58 110 L48 115 L38 105 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><line x1="58" y1="115" x2="142" y2="115" stroke="${c.dark}" stroke-width="1" opacity="0.6"/><line x1="58" y1="140" x2="142" y2="140" stroke="${c.dark}" stroke-width="1" opacity="0.6"/><line x1="58" y1="165" x2="142" y2="165" stroke="${c.dark}" stroke-width="1" opacity="0.6"/><line x1="58" y1="190" x2="142" y2="190" stroke="${c.dark}" stroke-width="1" opacity="0.6"/><line x1="100" y1="62" x2="100" y2="220" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/>`,
  'blazer': (c) => `<path d="M55 78 L100 60 L145 78 L162 100 L152 110 L142 105 L142 220 L58 220 L58 105 L48 110 L38 100 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M85 70 L100 145 L115 70" fill="${c.light}" stroke="${c.dark}" stroke-width="1.5"/><rect x="73" y="160" width="14" height="3" fill="${c.dark}"/><rect x="113" y="160" width="14" height="3" fill="${c.dark}"/><circle cx="100" cy="148" r="2" fill="${c.dark}"/><circle cx="100" cy="170" r="2" fill="${c.dark}"/>`,

  // ===== ACCESSORIES =====
  'tote-bag': (c) => `<path d="M50 110 L150 110 L160 220 L40 220 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M70 110 Q70 70 100 70 Q130 70 130 110" fill="none" stroke="${c.dark}" stroke-width="3"/><line x1="55" y1="130" x2="145" y2="130" stroke="${c.dark}" stroke-width="0.5" opacity="0.5"/>`,
  'crossbody': (c) => `<rect x="50" y="100" width="100" height="80" rx="8" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M55 100 Q60 50 100 50 Q140 50 145 100" fill="none" stroke="${c.dark}" stroke-width="2"/><rect x="85" y="130" width="30" height="6" rx="1" fill="${c.accent}"/><circle cx="90" cy="133" r="1.5" fill="${c.dark}"/><circle cx="110" cy="133" r="1.5" fill="${c.dark}"/>`,
  'straw-tote': (c) => `<path d="M48 110 L152 110 L162 215 L38 215 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M70 110 Q70 70 100 70 Q130 70 130 110" fill="none" stroke="${c.dark}" stroke-width="3"/><line x1="48" y1="130" x2="152" y2="130" stroke="${c.dark}" stroke-width="0.5"/><line x1="50" y1="150" x2="152" y2="150" stroke="${c.dark}" stroke-width="0.5"/><line x1="52" y1="170" x2="151" y2="170" stroke="${c.dark}" stroke-width="0.5"/><line x1="55" y1="190" x2="150" y2="190" stroke="${c.dark}" stroke-width="0.5"/><line x1="60" y1="110" x2="60" y2="215" stroke="${c.dark}" stroke-width="0.5"/><line x1="80" y1="110" x2="80" y2="215" stroke="${c.dark}" stroke-width="0.5"/><line x1="100" y1="110" x2="100" y2="215" stroke="${c.dark}" stroke-width="0.5"/><line x1="120" y1="110" x2="120" y2="215" stroke="${c.dark}" stroke-width="0.5"/><line x1="140" y1="110" x2="140" y2="215" stroke="${c.dark}" stroke-width="0.5"/>`,
  'sunglasses': (c) => `<ellipse cx="68" cy="130" rx="30" ry="22" fill="${c.dark}" stroke="${c.main}" stroke-width="2.5"/><ellipse cx="132" cy="130" rx="30" ry="22" fill="${c.dark}" stroke="${c.main}" stroke-width="2.5"/><line x1="98" y1="130" x2="102" y2="130" stroke="${c.main}" stroke-width="3"/><line x1="38" y1="125" x2="20" y2="115" stroke="${c.main}" stroke-width="2.5"/><line x1="162" y1="125" x2="180" y2="115" stroke="${c.main}" stroke-width="2.5"/><ellipse cx="60" cy="120" rx="6" ry="3" fill="${c.accent}" opacity="0.5"/><ellipse cx="124" cy="120" rx="6" ry="3" fill="${c.accent}" opacity="0.5"/>`,
  'chain-necklace': (c) => `<path d="M70 75 Q100 70 130 75 L140 90 Q130 95 100 95 Q70 95 60 90 Z" fill="${c.light}" stroke="${c.dark}" stroke-width="1"/><circle cx="65" cy="100" r="4" fill="${c.main}" stroke="${c.dark}" stroke-width="1"/><circle cx="78" cy="115" r="4" fill="${c.main}" stroke="${c.dark}" stroke-width="1"/><circle cx="92" cy="128" r="4" fill="${c.main}" stroke="${c.dark}" stroke-width="1"/><circle cx="108" cy="128" r="4" fill="${c.main}" stroke="${c.dark}" stroke-width="1"/><circle cx="122" cy="115" r="4" fill="${c.main}" stroke="${c.dark}" stroke-width="1"/><circle cx="135" cy="100" r="4" fill="${c.main}" stroke="${c.dark}" stroke-width="1"/><path d="M92 132 Q100 145 108 132 Q108 155 100 165 Q92 155 92 132 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="1.5"/>`,
  'silk-scarf': (c) => `<path d="M50 80 L150 80 L160 200 L100 220 L40 200 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M60 100 Q100 110 140 100" fill="none" stroke="${c.accent}" stroke-width="1" opacity="0.7"/><path d="M55 130 Q100 140 145 130" fill="none" stroke="${c.accent}" stroke-width="1" opacity="0.7"/><path d="M50 160 Q100 170 150 160" fill="none" stroke="${c.accent}" stroke-width="1" opacity="0.7"/><circle cx="80" cy="115" r="3" fill="${c.dark}" opacity="0.5"/><circle cx="120" cy="145" r="3" fill="${c.dark}" opacity="0.5"/><circle cx="90" cy="180" r="3" fill="${c.dark}" opacity="0.5"/>`,
  'belt': (c) => `<rect x="30" y="120" width="140" height="22" rx="3" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><rect x="92" y="113" width="22" height="36" rx="2" fill="${c.light}" stroke="${c.dark}" stroke-width="2"/><rect x="98" y="125" width="10" height="12" fill="none" stroke="${c.dark}" stroke-width="1"/><circle cx="50" cy="131" r="2" fill="${c.dark}"/><circle cx="65" cy="131" r="2" fill="${c.dark}"/><circle cx="80" cy="131" r="2" fill="${c.dark}"/>`,
  'cap': (c) => `<path d="M40 130 Q40 80 100 80 Q160 80 160 130 L155 140 L45 140 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M40 135 L175 145 L170 158 L45 152 Z" fill="${c.dark}"/><circle cx="100" cy="105" r="6" fill="${c.accent}" opacity="0.8"/>`,
  'watch': (c) => `<rect x="80" y="75" width="40" height="14" fill="${c.main}" stroke="${c.dark}" stroke-width="1.5"/><rect x="80" y="170" width="40" height="14" fill="${c.main}" stroke="${c.dark}" stroke-width="1.5"/><rect x="65" y="89" width="70" height="80" rx="14" fill="${c.light}" stroke="${c.dark}" stroke-width="2.5"/><circle cx="100" cy="129" r="22" fill="${c.accent}" stroke="${c.dark}" stroke-width="1"/><line x1="100" y1="129" x2="100" y2="115" stroke="${c.dark}" stroke-width="2"/><line x1="100" y1="129" x2="112" y2="129" stroke="${c.dark}" stroke-width="1.5"/>`,
};

// Map category → list of available shapes for that category
const CATEGORY_SHAPES = {
  Tops: ['crew-sweater', 'tshirt', 'graphic-tee', 'quarter-zip', 'turtleneck', 'flannel', 'polo', 'blouse'],
  Bottoms: ['jeans', 'wide-leg', 'cargo', 'mom-jeans', 'mini-skirt', 'pleated-skirt', 'plaid-skirt', 'shorts'],
  Dresses: ['midi-dress', 'tea-dress', 'slip-dress', 'maxi-dress', 'wrap-dress'],
  Shoes: ['oxford', 'sneakers', 'platform-boots', 'heels', 'sandals', 'loafers'],
  Outerwear: ['bomber', 'leather-jacket', 'overshirt', 'trench', 'puffer', 'blazer'],
  Accessories: ['tote-bag', 'crossbody', 'straw-tote', 'sunglasses', 'chain-necklace', 'silk-scarf', 'belt', 'cap', 'watch'],
};

const productImg = (shapeName, palette) => {
  const c = PALETTES[palette] || PALETTES.sage;
  const shapeFn = SHAPES[shapeName] || SHAPES['crew-sweater'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0%" stop-color="${c.bg1}"/><stop offset="100%" stop-color="${c.bg2}"/></linearGradient></defs><rect width="200" height="260" fill="url(%23g)"/>${shapeFn(c)}</svg>`;
  return `data:image/svg+xml;utf8,${svg.replace(/#/g, '%23').replace(/"/g, "'")}`;
};

// Outfit vignette SVG — full-body silhouette for style posts
const outfitImg = (palette) => {
  const c = PALETTES[palette] || PALETTES.sage;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c.bg1}"/><stop offset="100%" stop-color="${c.bg2}"/></linearGradient></defs><rect width="300" height="300" fill="url(%23bg)"/><circle cx="150" cy="85" r="22" fill="${c.accent}" opacity="0.7"/><path d="M120 108 L180 108 L195 130 L210 150 L200 158 L190 150 L190 210 L110 210 L110 150 L100 158 L90 150 L105 130 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><path d="M115 210 L120 260 L140 260 L145 215 L155 215 L160 260 L180 260 L185 210 Z" fill="${c.dark}" opacity="0.85"/><circle cx="150" cy="170" r="3" fill="${c.accent}"/><circle cx="150" cy="185" r="3" fill="${c.accent}"/><ellipse cx="150" cy="278" rx="45" ry="6" fill="${c.dark}" opacity="0.15"/></svg>`;
  return `data:image/svg+xml;utf8,${svg.replace(/#/g, '%23').replace(/"/g, "'")}`;
};

// ============ DATA ============
const PRODUCTS = [
  // === TOPS (6) ===
  { id: 1, title: "Cream Cable Knit Sweater", brand: "Zara", price: 749, originalPrice: 2799, condition: "Like New", size: "M", category: "Tops", gender: "Women", seller: "anaya_thrifts", sellerRating: 4.9, img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&h=800&fit=crop&q=80", tags: ["Cottagecore", "Winter"], likes: 234 },
  { id: 2, title: "Brown Plaid Flannel Shirt", brand: "UNIQLO", price: 599, originalPrice: 2299, condition: "Good", size: "L", category: "Tops", gender: "Unisex", seller: "grunge_gallery", sellerRating: 4.7, img: "https://sangiev.com/cdn/shop/files/Front_3151992c-0e31-4aaf-8d0e-e126b4b95852.jpg?v=1730451373", tags: ["Grunge", "Streetwear"], likes: 203 },
  { id: 3, title: "Ribbed Cream Turtleneck", brand: "COS", price: 599, originalPrice: 2499, condition: "Like New", size: "M", category: "Tops", gender: "Women", seller: "minimalist_m", sellerRating: 4.8, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUkq3pGQ2H0ycHMB-ztXTPmkSt1CBlm4v4TQ&s", tags: ["Minimal", "Old Money"], likes: 167 },
  { id: 4, title: "White Tee Classic Fit", brand: "H&M", price: 199, originalPrice: 799, condition: "Good", size: "S", category: "Tops", gender: "Unisex", seller: "tshirt_temple", sellerRating: 4.6, img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop&q=80", tags: ["Streetwear", "Minimal"], likes: 142 },
  { id: 5, title: "Striped Breton Long Sleeve", brand: "Marks & Spencer", price: 549, originalPrice: 1899, condition: "Like New", size: "M", category: "Tops", gender: "Women", seller: "vintage_vault", sellerRating: 4.7, img: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcR0xJXh73Jhf8hyBcAe1QwShcFjNjMHLXC1oWqf0zj6N-ogImvyhKQ-W8TXNypvF90oLecokt9mKRADo3VC8QknVOY9xEmO_h9dVfo1HIKlrPHdVEIdk-3411Y", tags: ["Old Money", "Minimal"], likes: 198 },
  { id: 6, title: "Navy Polo Shirt", brand: "Wrogn", price: 449, originalPrice: 1799, condition: "Good", size: "L", category: "Tops", gender: "Men", seller: "preppy_kolkata", sellerRating: 4.5, img: "https://wrogn.com/cdn/shop/files/WUTS1210S_1.jpg?v=1754396652", tags: ["Preppy", "Old Money"], likes: 98 },

  // === BOTTOMS (5) ===
  { id: 7, title: "Wide-Leg Blue Denim", brand: "Levi's", price: 799, originalPrice: 3999, condition: "Good", size: "30", category: "Bottoms", gender: "Unisex", seller: "denim_diary", sellerRating: 4.8, img: "https://www.only.in/cdn/shop/files/902124001_g5_c879d080-16ad-4ca3-9413-529405913d03.jpg?v=1752845764&width=1080", tags: ["Y2K", "Vintage"], likes: 156 },
  { id: 8, title: "Mom-Fit Light Wash Jeans", brand: "Levi's", price: 749, originalPrice: 2999, condition: "Good", size: "28", category: "Bottoms", gender: "Women", seller: "denim_diary", sellerRating: 4.8, img: "https://image.hm.com/assets/hm/d4/93/d493fec2a73e1da187eddd49add7ec4efaa191be.jpg?imwidth=2160", tags: ["Y2K", "Retro"], likes: 412 },
  { id: 9, title: "Olive Cargo Pants", brand: "H&M", price: 699, originalPrice: 2499, condition: "Like New", size: "32", category: "Bottoms", gender: "Men", seller: "utility_club", sellerRating: 4.7, img: "https://limitededt.in/cdn/shop/files/62471933_1.jpg?v=1757160923&width=2048", tags: ["Streetwear", "Y2K"], likes: 221 },
  { id: 10, title: "Pleated Mini Skirt", brand: "Forever 21", price: 399, originalPrice: 1499, condition: "Like New", size: "S", category: "Bottoms", gender: "Women", seller: "preppy_pari", sellerRating: 4.9, img: "https://littleboxindia.com/cdn/shop/products/back_view_of_High_Waisted_Pleated_Tennis_Skirt_In_Black.jpg?v=1742285473", tags: ["Preppy", "Y2K"], likes: 267 },
  { id: 11, title: "Plaid Mini Skirt", brand: "Urban Outfitters", price: 499, originalPrice: 1999, condition: "Like New", size: "S", category: "Bottoms", gender: "Women", seller: "preppy_pari", sellerRating: 4.9, img: "https://media.karousell.com/media/photos/products/2024/10/2/thrifted_y2k_plaid_skirt_1727836594_36d9c355_progressive.jpg", tags: ["Preppy", "Y2K"], likes: 298 },

  // === DRESSES (5) ===
  { id: 12, title: "Beige Linen Midi Dress", brand: "Fabindia", price: 1299, originalPrice: 4500, condition: "Like New", size: "M", category: "Dresses", gender: "Women", seller: "sari_stories", sellerRating: 4.9, img: "https://www.na-kd.com/globalassets/linen_blend_seam_detail_midi_dress_1100-011361-0005_0005_flatlay.jpg?ref=464C8E1F4F", tags: ["Cottagecore", "Summer"], likes: 298 },
  { id: 13, title: "Floral Tea Dress", brand: "Cotton On", price: 699, originalPrice: 2799, condition: "Like New", size: "M", category: "Dresses", gender: "Women", seller: "bloom_boutique", sellerRating: 4.9, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAo2RDzyO9-EMFojxP4XMGEMZMyrhAp-9D9Q&s", tags: ["Cottagecore", "Spring"], likes: 334 },
  { id: 14, title: "Black Satin Slip Dress", brand: "Zara", price: 899, originalPrice: 2999, condition: "Like New", size: "S", category: "Dresses", gender: "Women", seller: "soiree_seconds", sellerRating: 4.9, img: "https://img01.ztat.net/article/spp-media-p1/a38ecda94db44c86be627f2817bef03b/bb330f70f9f247918e11ab98e35e953e.jpg?imwidth=800&filter=packshot", tags: ["Y2K", "Luxe"], likes: 389 },
  { id: 15, title: "Yellow Sundress", brand: "Mango", price: 849, originalPrice: 2999, condition: "Excellent", size: "M", category: "Dresses", gender: "Women", seller: "summer_circles", sellerRating: 4.7, img: "https://i.etsystatic.com/6058764/r/il/c7e54f/1593043620/il_fullxfull.1593043620_kzp2.jpg", tags: ["Cottagecore", "Summer"], likes: 256 },
  { id: 16, title: "Red Wrap Dress", brand: "Zara", price: 999, originalPrice: 3499, condition: "Like New", size: "M", category: "Dresses", gender: "Women", seller: "noir_closet", sellerRating: 4.9, img: "https://i.etsystatic.com/6017977/r/il/f137f2/5076826342/il_fullxfull.5076826342_350e.jpg", tags: ["Y2K", "Luxe"], likes: 312 },

  // === SHOES (5) ===
  { id: 17, title: "Brown Leather Oxford Shoes", brand: "Clarks", price: 1499, originalPrice: 5999, condition: "Good", size: "9", category: "Shoes", gender: "Men", seller: "sole_society", sellerRating: 4.6, img: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&h=800&fit=crop&q=80", tags: ["Old Money", "Formal"], likes: 87 },
  { id: 18, title: "Retro White Sneakers", brand: "Adidas", price: 999, originalPrice: 3999, condition: "Good", size: "8", category: "Shoes", gender: "Unisex", seller: "kicks_karma", sellerRating: 4.7, img: "https://d1pdzcnm6xgxlz.cloudfront.net/footwear/8905875429074-9.jpg", tags: ["Streetwear", "Retro"], likes: 342 },
  { id: 19, title: "Black Combat Boots", brand: "Dr. Martens", price: 1899, originalPrice: 6499, condition: "Excellent", size: "7", category: "Shoes", gender: "Women", seller: "platform_princess", sellerRating: 4.9, img: "https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/D23054s.jpg?im=Resize,width=750", tags: ["Y2K", "Grunge"], likes: 456 },
  { id: 20, title: "Tan Leather Loafers", brand: "Bata", price: 1199, originalPrice: 3999, condition: "Like New", size: "8", category: "Shoes", gender: "Unisex", seller: "preppy_kolkata", sellerRating: 4.5, img: "https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/G12546s.jpg?im=Resize,width=750", tags: ["Old Money", "Preppy"], likes: 134 },
  { id: 21, title: "Strappy Heeled Sandals", brand: "Steve Madden", price: 1099, originalPrice: 4499, condition: "Excellent", size: "7", category: "Shoes", gender: "Women", seller: "soiree_seconds", sellerRating: 4.9, img: "https://images-static.nykaa.com/media/catalog/product/8/6/862bd46Lux-A-White_1.jpg?tr=w-500", tags: ["Y2K", "Luxe"], likes: 287 },

  // === OUTERWEAR (4) ===
  { id: 22, title: "Red Cropped Bomber", brand: "Urbanic", price: 899, originalPrice: 3499, condition: "Excellent", size: "S", category: "Outerwear", gender: "Women", seller: "retro_rani", sellerRating: 5.0, img: "https://assets.ajio.com/medias/sys_master/root/20221019/2tFr/634ef522f997ddfdbd314e3a/-473Wx593H-410339290-4900-MODEL.jpg", tags: ["Y2K", "Streetwear"], likes: 412 },
  { id: 23, title: "Black Leather Jacket", brand: "Mango", price: 1899, originalPrice: 6999, condition: "Excellent", size: "M", category: "Outerwear", gender: "Women", seller: "noir_closet", sellerRating: 4.9, img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop&q=80", tags: ["Grunge", "Streetwear"], likes: 523 },
  { id: 24, title: "Camel Trench Coat", brand: "H&M", price: 1499, originalPrice: 5499, condition: "Like New", size: "M", category: "Outerwear", gender: "Women", seller: "vintage_vault", sellerRating: 4.7, img: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&h=800&fit=crop&q=80", tags: ["Old Money", "Minimal"], likes: 367 },
  { id: 25, title: "Brown Corduroy Jacket", brand: "Roadster", price: 749, originalPrice: 2499, condition: "Good", size: "L", category: "Outerwear", gender: "Men", seller: "thrift_thakur", sellerRating: 4.5, img: "https://m.media-amazon.com/images/I/A18T3boO-FL._AC_UY1100_.jpg", tags: ["Retro", "Autumn"], likes: 142 },

  // === ACCESSORIES (5) ===
  { id: 26, title: "Tortoise-Shell Sunglasses", brand: "Ray-Ban", price: 849, originalPrice: 3500, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Unisex", seller: "shades_shelf", sellerRating: 4.8, img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=800&fit=crop&q=80", tags: ["Old Money", "Vintage"], likes: 287 },
  { id: 27, title: "Woven Straw Tote Bag", brand: "Accessorize", price: 549, originalPrice: 1999, condition: "Like New", size: "One Size", category: "Accessories", gender: "Women", seller: "beach_bazaar", sellerRating: 4.8, img: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=800&fit=crop&q=80", tags: ["Cottagecore", "Summer"], likes: 198 },
  { id: 28, title: "Chunky Gold Chain Necklace", brand: "Vintage", price: 249, originalPrice: 899, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Unisex", seller: "gold_rush", sellerRating: 4.8, img: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=800&fit=crop&q=80", tags: ["Y2K", "Streetwear"], likes: 178 },
  { id: 29, title: "Silk Printed Scarf", brand: "Vintage", price: 349, originalPrice: 1200, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Women", seller: "silk_road", sellerRating: 4.8, img: "https://www.studiodecorai.com/cdn/shop/products/studio-decorai-scarf-dahlia-dawn-silk-scarf-39900743598376.jpg?v=1677827884&width=1946", tags: ["Vintage", "Luxe"], likes: 145 },
  { id: 30, title: "Vintage Leather Watch", brand: "Fossil", price: 1299, originalPrice: 4999, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Unisex", seller: "time_keeper", sellerRating: 4.7, img: "https://viange.in/cdn/shop/files/3809D631-7F4D-4897-A71A-D7E55960CE2B_1024x1024@2x.jpg?v=1750847934", tags: ["Old Money", "Vintage"], likes: 198 },
];

const STYLE_POSTS = [
  { id: 1, user: "anaya_thrifts", avatar: "🌸", caption: "Paired this vintage knit with wide-leg denim for a cozy cottagecore morning ☕", img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80", fallbackImg: outfitImg("sage"), likes: 1243, comments: 87, tags: ["#cottagecore", "#thriftedfit"], products: [1, 4] },
  { id: 2, user: "retro_rani", avatar: "🎀", caption: "Red bomber season is officially open. Going full Y2K maximalist this week", img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80", fallbackImg: outfitImg("rust"), likes: 2891, comments: 156, tags: ["#y2k", "#streetstyle"], products: [3] },
  { id: 3, user: "vintage_vault", avatar: "🍂", caption: "Old money energy with this cream quarter-zip. Thrifted, timeless, tenderly loved", img: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80", fallbackImg: outfitImg("cream"), likes: 1567, comments: 94, tags: ["#oldmoney", "#quietluxury"], products: [2] },
  { id: 4, user: "grunge_gallery", avatar: "⚡", caption: "Oversized flannel + chunky chain = the uniform. Thrifting > fast fashion always", img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80", fallbackImg: outfitImg("brown"), likes: 987, comments: 62, tags: ["#grunge", "#sustainable"], products: [8, 11] },
  { id: 5, user: "noir_closet", avatar: "🖤", caption: "Leather jacket + platform boots. Pre-loved pieces, post-punk mood", img: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80", fallbackImg: outfitImg("ink"), likes: 2134, comments: 112, tags: ["#grunge", "#vintage"], products: [14, 19] },
  { id: 6, user: "soiree_seconds", avatar: "✨", caption: "Slip dress season. Found this gem for ₹899 and I'm obsessed", img: " https://images.squarespace-cdn.com/content/v1/52fd631be4b04956087905ff/1481550321800-63E61O4T2OMWG72EG6VX/image-asset.jpeg", fallbackImg: outfitImg("plum"), likes: 1789, comments: 98, tags: ["#y2k", "#luxe"], products: [21] },
];

const VIBES = [
  { id: 1, name: "Street Style", emoji: "🔥", color: "#f4c9a3" },
  { id: 2, name: "Old Money", emoji: "🎩", color: "#e8d5b7" },
  { id: 3, name: "Y2K", emoji: "💫", color: "#e0c8e8" },
  { id: 4, name: "Cottagecore", emoji: "🌿", color: "#c8dcc4" },
  { id: 5, name: "Grunge", emoji: "⚡", color: "#d4c4b0" },
  { id: 6, name: "Preppy", emoji: "🎾", color: "#f0d4d4" },
  { id: 7, name: "Minimal", emoji: "◻️", color: "#e0e0d8" },
];

const CATEGORIES = [
  { name: "Tops", emoji: "👕" },
  { name: "Bottoms", emoji: "👖" },
  { name: "Shoes", emoji: "👟" },
  { name: "Accessories", emoji: "👜" },
  { name: "Dresses", emoji: "👗" },
  { name: "Outerwear", emoji: "🧥" },
];

// ============ MAIN APP ============
export default function Revogue() {
  const [screen, setScreen] = useState('splash');
  const [userRole, setUserRole] = useState(null); // 'buyer' | 'seller'
  const [userName, setUserName] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewingUser, setViewingUser] = useState(null); // { username, name, profile, listings, posts, ... }
  const [viewingUserLoading, setViewingUserLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // url string when open, null when closed
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGender, setSelectedGender] = useState('All');
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orderConfirmed, setOrderConfirmed] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [userContact, setUserContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [userListings, setUserListings] = useState([]);
  const [userAvatar, setUserAvatar] = useState(null); // data URL or remote URL for the signed-in user's avatar
  const [myUsername, setMyUsername] = useState(''); // backend-generated username, used to match own posts
  const emptyListing = { title: '', brand: '', price: '', originalPrice: '', category: '', condition: '', size: 'M', gender: 'Unisex', description: '', tags: [], imgs: [] };
  const [listingDraft, setListingDraft] = useState(emptyListing);
  const [listingError, setListingError] = useState('');
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | 'forgot-email' | 'forgot-answer'
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const SECURITY_QUESTIONS = [
    'What is your favorite city?',
    'What was the name of your first pet?',
    "What is your mother's maiden name?",
    'What was your childhood nickname?',
    'What is the name of your favorite teacher?',
  ];
  const [signupSecurityQuestion, setSignupSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [signupSecurityAnswer, setSignupSecurityAnswer] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([
    { id: 1, label: 'Home', name: 'You', line1: '2nd Cross Rd, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pin: '560038', phone: '+91 98XXX XXXXX', isDefault: true },
  ]);
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 1, type: 'upi', label: 'GPay UPI', detail: 'you@oksbi', isDefault: true },
  ]);
  const [settings, setSettings] = useState({
    notifications: true,
    promotions: false,
    privateProfile: false,
    showLocation: true,
    darkMode: false,
  });
  const [editingAddress, setEditingAddress] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [postLikes, setPostLikes] = useState({}); // { postId: true }
  const [postSaves, setPostSaves] = useState({});
  const [postComments, setPostComments] = useState({}); // { postId: [{ user, text, time }] }
  const [openComments, setOpenComments] = useState(null); // postId
  const [commentDraft, setCommentDraft] = useState('');
  // Search tab has its own query so Home's chips (gender/vibe/category) + search bar
  // don't leak into Search. The Search tab uses ONLY this query and ignores Home's filters.
  const [searchTabQuery, setSearchTabQuery] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const emptyFilters = { gender: 'All', category: null, vibe: null, condition: 'All', maxPrice: null, sortBy: 'newest' };
  const [searchFilters, setSearchFilters] = useState(emptyFilters);
  // ----- Backend-sourced state -----
  const [remoteProducts, setRemoteProducts] = useState([]);
  const [remotePosts, setRemotePosts] = useState([]);
  const [sustainStats, setSustainStats] = useState(null);
  const [bootError, setBootError] = useState('');
  // Edit-in-place: when set, renderSell pre-fills + becomes Update; renderPostStyle does the same
  const [editingListingId, setEditingListingId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);

  // ---- Toast helper ----
  const pushToast = (msg, kind = 'info') => {
    if (!settings.notifications) return;
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  };

  // ---- Dark mode tokens ----
  const themeVars = settings.darkMode ? {
    '--cream': '#2a2520', '--cream-deep': '#1f1b17', '--paper': '#1a1612', '--ink': '#f0e8d8',
    '--ink-soft': '#a89e8e', '--terracotta': '#e89870', '--rust': '#c97a52', '--sage': '#a8b8a4',
    '--sage-deep': '#8fa08a', '--gold': '#d8b86c', '--pink': '#e8b5a8',
  } : {};
  const [userProfile, setUserProfile] = useState({
    bio: 'Curating pre-loved treasures ✨',
    location: 'Bengaluru, IN',
    avatarColor: 'terracotta',
    email: '',
    phone: '',
  });
  const [editDraft, setEditDraft] = useState(null);

  // ---- Validation helpers ----
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const isPhone = (v) => /^\+?[\d\s-]{7,15}$/.test(v.trim());
  const validateContact = (v) => {
    if (!v.trim()) return 'Please enter your email or phone';
    if (/[a-zA-Z]/.test(v) && !isEmail(v)) return 'Enter a valid email (must include @)';
    if (!/[a-zA-Z]/.test(v) && !isPhone(v)) return 'Enter a valid phone number';
    return '';
  };
  const handleForgotEmail = async () => {
    setAuthError('');
    const err = validateContact(userContact);
    if (err) { setContactError(err); return; }
    setContactError('');
    try {
      const { securityQuestion } = await api.forgotPassword(userContact);
      setForgotQuestion(securityQuestion);
      setForgotAnswer('');
      setForgotNewPassword('');
      setAuthMode('forgot-answer');
    } catch (e) {
      setAuthError(e.message || 'Could not find that account');
    }
  };
  const handleResetPassword = async () => {
    setAuthError('');
    if (!forgotAnswer.trim()) { setAuthError('Please answer the security question'); return; }
    if (!forgotNewPassword || forgotNewPassword.length < 6) { setAuthError('New password must be at least 6 characters'); return; }
    try {
      await api.resetPassword({ contact: userContact, securityAnswer: forgotAnswer.trim(), newPassword: forgotNewPassword });
      pushToast('Password updated · sign in with your new password', 'success');
      setAuthPassword('');
      setForgotAnswer('');
      setForgotNewPassword('');
      setForgotQuestion('');
      setAuthMode('signin');
    } catch (e) {
      setAuthError(e.message || 'Could not reset password');
    }
  };
  const handleLogin = async () => {
    setAuthError('');
    if (authMode === 'signup' && !userName.trim()) { setAuthError('Please enter your name'); return; }
    const err = validateContact(userContact);
    if (err) { setContactError(err); return; }
    setContactError('');
    if (!authPassword || authPassword.length < 6) { setAuthError('Password must be at least 6 characters'); return; }
    if (authMode === 'signup' && !signupSecurityAnswer.trim()) { setAuthError('Please answer the security question'); return; }
    try {
      const payload = authMode === 'signup'
        ? { name: userName.trim(), contact: userContact, password: authPassword, securityQuestion: signupSecurityQuestion, securityAnswer: signupSecurityAnswer.trim() }
        : { contact: userContact, password: authPassword };
      const { token, user } = await (authMode === 'signup' ? api.signup(payload) : api.signin(payload));
      setToken(token);
      setUserName(user.name);
      setMyUsername(user.username || '');
      setUserProfile(p => ({
        ...p,
        email: user.email || '',
        phone: user.phone || '',
        bio: user.profile?.bio || p.bio,
        location: user.profile?.location || p.location,
        avatarColor: user.profile?.avatarColor || p.avatarColor,
      }));
      if (user.profile?.avatarUrl) setUserAvatar(user.profile.avatarUrl);
      setUserRole(user.role === 'seller' ? 'seller' : 'buyer');
      if (user.settings) setSettings(s => ({ ...s, ...user.settings }));
      setScreen('app');
    } catch (e) {
      setAuthError(e.message || 'Could not sign in');
    }
  };

  // ---- Image upload helper (File -> data URL) ----
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Inject mobile viewport + PWA meta tags + match document background to prevent white flash
  useEffect(() => {
    const set = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement(selector.startsWith('meta') ? 'meta' : 'link');
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };
    set('meta[name="viewport"]', { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no' });
    set('meta[name="theme-color"]', { name: 'theme-color', content: settings.darkMode ? '#1a1612' : '#faf6ed' });
    set('meta[name="apple-mobile-web-app-capable"]', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    set('meta[name="apple-mobile-web-app-status-bar-style"]', { name: 'apple-mobile-web-app-status-bar-style', content: settings.darkMode ? 'black-translucent' : 'default' });
    set('meta[name="apple-mobile-web-app-title"]', { name: 'apple-mobile-web-app-title', content: 'Revogue' });
    set('meta[name="mobile-web-app-capable"]', { name: 'mobile-web-app-capable', content: 'yes' });
    document.title = 'Revogue · Thrift · Style · Repeat';
    document.documentElement.style.background = settings.darkMode ? '#1a1612' : '#d4c4a8';
    document.body.style.background = settings.darkMode ? '#1a1612' : '#d4c4a8';
    document.body.style.margin = '0';
    document.body.style.overscrollBehavior = 'none';
  }, [settings.darkMode]);

  useEffect(() => {
    if (screen === 'splash') {
      const t = setTimeout(() => setScreen('role'), 2200);
      return () => clearTimeout(t);
    }
  }, [screen]);

  // ----- Public catalog: load products + posts whenever the app screen mounts -----
  const loadCatalog = useCallback(async () => {
    try {
      const [pr, po] = await Promise.all([
        api.listProducts({ limit: 60 }),
        api.listPosts({ limit: 30 }),
      ]);
      setRemoteProducts((pr.items || []).map(normalizeProduct));
      setRemotePosts((po.items || []).map(normalizePost));
    } catch (e) {
      setBootError(e.message);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // ----- Auto-login if a token already exists -----
  useEffect(() => {
    if (!getToken() || screen !== 'role') return;
    (async () => {
      try {
        const { user } = await api.me();
        setUserName(user.name);
        setMyUsername(user.username || '');
        setUserProfile(p => ({
          ...p,
          email: user.email || '',
          phone: user.phone || '',
          bio: user.profile?.bio || p.bio,
          location: user.profile?.location || p.location,
          avatarColor: user.profile?.avatarColor || p.avatarColor,
        }));
        if (user.profile?.avatarUrl) setUserAvatar(user.profile.avatarUrl);
        setUserRole(user.role === 'seller' ? 'seller' : 'buyer');
        if (user.settings) setSettings(s => ({ ...s, ...user.settings }));
        setScreen('app');
      } catch {
        setToken(null);
      }
    })();
  }, [screen]);

  // ----- Hydrate authenticated data when the user lands on the app -----
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (screen !== 'app' || !getToken() || hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const [wl, ct, od, ad, pm, mine, su] = await Promise.all([
          api.getWishlist().catch(() => ({ items: [] })),
          api.getCart().catch(() => ({ items: [] })),
          api.listOrders().catch(() => ({ items: [] })),
          api.listAddresses().catch(() => ({ items: [] })),
          api.listPayments().catch(() => ({ items: [] })),
          api.listProducts({ mine: 'true', limit: 50 }).catch(() => ({ items: [] })),
          api.getSustainability().catch(() => null),
        ]);
        if (cancelled) return;
        setHydrated(true);
        setWishlist((wl.items || []).filter(Boolean).map(p => p._id || p.id));
        setCart((ct.items || [])
          .filter(c => c && c.product) // drop entries whose product was deleted server-side
          .map(c => ({ ...normalizeProduct(c.product), qty: c.qty })));
        setOrders((od.items || []).map(normalizeOrder).filter(Boolean));
        setAddresses((ad.items || []).map(normalizeAddress).filter(Boolean));
        setPaymentMethods((pm.items || []).map(normalizePayment).filter(Boolean));
        setUserListings((mine.items || [])
          .map(p => normalizeProduct(p))
          .filter(Boolean)
          .map(p => ({ ...p, isMine: true })));
        if (su) setSustainStats(su);
      } catch (e) {
        if (!cancelled) console.warn('hydrate failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [screen]);

  // Pre-fetch dummyjson pool used as fallback if any hardcoded Unsplash URL fails to load
  useEffect(() => {
    const dummyMap = {
      Tops: ['tops', 'mens-shirts'], Bottoms: ['mens-shirts'], Dresses: ['womens-dresses'],
      Shoes: ['mens-shoes', 'womens-shoes'], Outerwear: ['mens-shirts'],
      Accessories: ['womens-bags', 'womens-jewellery', 'sunglasses', 'mens-watches'],
    };
    (async () => {
      const fallback = {};
      for (const [ourCat, dummyCats] of Object.entries(dummyMap)) {
        const urls = [];
        for (const dc of dummyCats) {
          try {
            const res = await fetch(`https://dummyjson.com/products/category/${dc}?limit=20&select=images,thumbnail`);
            if (!res.ok) continue;
            const data = await res.json();
            for (const p of data.products || []) {
              if (p.thumbnail) urls.push(p.thumbnail);
            }
          } catch {}
        }
        if (urls.length) fallback[ourCat] = urls;
      }
      window.__revogueFallbackImgs = fallback;
    })();
  }, []);

  // Each product already ships with its correct image URL hardcoded.
  // This passthrough exists only so user listings can keep their uploaded photos.
  const productWithImg = (p) => p;

  // Smart <img> that gracefully falls back through: Unsplash → dummyjson pool → SVG
  const handleImgError = (e, product) => {
    const el = e.currentTarget;
    if (el.dataset.tried === 'fallback2') return; // already tried everything
    if (el.dataset.tried === 'fallback1') {
      // Final fallback: original SVG
      if (product?._fallbackImg) {
        el.dataset.tried = 'fallback2';
        el.src = product._fallbackImg;
      }
      return;
    }
    // First failure: try dummyjson pool
    const fb = window.__revogueFallbackImgs?.[product?.category];
    if (fb && fb.length) {
      el.dataset.tried = 'fallback1';
      el.src = fb[(product?.id || 0) % fb.length];
    } else if (product?._fallbackImg) {
      el.dataset.tried = 'fallback2';
      el.src = product._fallbackImg;
    }
  };

  const toggleWishlist = async (id) => {
    const wasOn = wishlist.includes(id);
    setWishlist(prev => wasOn ? prev.filter(x => x !== id) : [...prev, id]);
    pushToast(wasOn ? 'Removed from wishlist' : '♡ Saved to wishlist', wasOn ? 'info' : 'success');
    if (!getToken()) return;
    try {
      if (wasOn) await api.removeWishlist(id);
      else await api.addWishlist(id);
    } catch (e) {
      // rollback
      setWishlist(prev => wasOn ? [...prev, id] : prev.filter(x => x !== id));
      pushToast(e.message || 'Could not update wishlist', 'info');
    }
  };

  const addToCart = async (product) => {
    if (cart.find(p => p.id === product.id)) {
      pushToast('Already in your bag', 'info');
      return;
    }
    setCart(prev => [...prev, { ...product, qty: 1 }]);
    pushToast(`Added "${product.title}" to bag`, 'success');
    if (!getToken()) return;
    try {
      await api.addCart(product.id, 1, product.size);
    } catch (e) {
      setCart(prev => prev.filter(p => p.id !== product.id));
      pushToast(e.message || 'Could not add to bag', 'info');
    }
  };

  const removeFromCart = async (id) => {
    const removed = cart.find(p => p.id === id);
    setCart(prev => prev.filter(p => p.id !== id));
    pushToast('Removed from bag', 'info');
    if (!getToken()) return;
    try { await api.removeCart(id); }
    catch (e) {
      if (removed) setCart(prev => [...prev, removed]);
      pushToast(e.message || 'Could not remove', 'info');
    }
  };

  // Stable shuffle so home doesn't show 16 tops then 14 bottoms in a row
  const SHUFFLED_PRODUCTS = useMemo(() => {
    const arr = [...PRODUCTS];
    return arr.sort((a, b) => ((a.id * 31) % 7) - ((b.id * 31) % 7));
  }, []);
  const allProducts = useMemo(() => {
    const merged = remoteProducts.length ? remoteProducts : SHUFFLED_PRODUCTS;
    // de-dupe by id (user's own listings already appear in remoteProducts after publishing)
    const seen = new Set();
    return [...userListings, ...merged].filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).map(productWithImg);
  }, [userListings, remoteProducts, SHUFFLED_PRODUCTS]);

  // Use remote posts when available, otherwise fall back to seed data shipped in this file
  const visiblePosts = remotePosts.length ? remotePosts : STYLE_POSTS;

  // Search helper: does a product mention this token in any of its searchable fields?
  // Used to make multi-word search work (e.g. "Y2K tops" matches Y2K-tagged products in Tops category)
  const fieldsInclude = (p, tok) => {
    if (!tok) return true;
    return (
      (p.title || '').toLowerCase().includes(tok) ||
      (p.brand || '').toLowerCase().includes(tok) ||
      (p.category || '').toLowerCase().includes(tok) ||
      (p.gender || '').toLowerCase().includes(tok) ||
      (p.condition || '').toLowerCase().includes(tok) ||
      (p.tags || []).some(t => (t || '').toLowerCase().includes(tok))
    );
  };

  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      if (selectedGender !== 'All' && p.gender !== selectedGender && p.gender !== 'Unisex') return false;
      if (selectedVibe && !p.tags.includes(selectedVibe)) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (searchQuery) {
        const raw = searchQuery.toLowerCase().trim();
        // Detect "under ₹500" / "under 500" / "below 1000" as a price filter
        const priceMatch = raw.match(/(?:under|below|less than|<)\s*[₹$]?\s*(\d+)/);
        if (priceMatch) {
          if (p.price > Number(priceMatch[1])) return false;
          // After applying the price filter, drop the price phrase and treat the rest as keywords
          const rest = raw.replace(priceMatch[0], '').trim();
          if (!rest) return true;
          const tokens = rest.split(/\s+/).filter(Boolean);
          return tokens.every(tok => fieldsInclude(p, tok));
        }
        // Multi-word search: every token must appear in at least one field
        // (so "Y2K tops" matches Y2K-tagged products in the Tops category, not just literal "y2k tops" in title)
        const tokens = raw.split(/\s+/).filter(Boolean);
        return tokens.every(tok => fieldsInclude(p, tok));
      }
      return true;
    });
  }, [searchQuery, selectedGender, selectedVibe, selectedCategory, allProducts]);

  // Search tab uses searchTabQuery + searchFilters (independent from Home filters).
  const searchTabProducts = useMemo(() => {
    const raw = (searchTabQuery || '').toLowerCase().trim();
    const priceMatch = raw.match(/(?:under|below|less than|<)\s*[₹$]?\s*(\d+)/);
    const queryTokens = (() => {
      if (!raw) return [];
      const stripped = priceMatch ? raw.replace(priceMatch[0], '').trim() : raw;
      return stripped.split(/\s+/).filter(Boolean);
    })();
    const filtered = allProducts.filter(p => {
      if (priceMatch && p.price > Number(priceMatch[1])) return false;
      if (queryTokens.length && !queryTokens.every(tok => fieldsInclude(p, tok))) return false;
      if (searchFilters.gender !== 'All' && p.gender !== searchFilters.gender) return false;
      if (searchFilters.category && p.category !== searchFilters.category) return false;
      if (searchFilters.vibe && !(p.tags || []).includes(searchFilters.vibe)) return false;
      if (searchFilters.condition !== 'All' && p.condition !== searchFilters.condition) return false;
      if (searchFilters.maxPrice != null && p.price > searchFilters.maxPrice) return false;
      return true;
    });
    const sorted = [...filtered];
    if (searchFilters.sortBy === 'priceAsc') sorted.sort((a, b) => a.price - b.price);
    else if (searchFilters.sortBy === 'priceDesc') sorted.sort((a, b) => b.price - a.price);
    else if (searchFilters.sortBy === 'popular') sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return sorted;
  }, [searchTabQuery, searchFilters, allProducts]);

  const activeFilterCount = (
    (searchFilters.gender !== 'All' ? 1 : 0) +
    (searchFilters.category ? 1 : 0) +
    (searchFilters.vibe ? 1 : 0) +
    (searchFilters.condition !== 'All' ? 1 : 0) +
    (searchFilters.maxPrice != null ? 1 : 0) +
    (searchFilters.sortBy !== 'newest' ? 1 : 0)
  );

  // ============ STYLES ============
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400&family=Outfit:wght@300;400;500;600;700&display=swap');

    .revogue-root { --cream: #f5efe3; --cream-deep: #ede3d0; --sage: #8fa08a; --sage-deep: #6b7f67; --terracotta: #c4704a; --rust: #a0492d; --ink: #2a241d; --ink-soft: #5a4f42; --paper: #faf6ed; --gold: #c4a456; --pink: #e8b5a8; }
    .revogue-root * { box-sizing: border-box; margin: 0; padding: 0; }
    .revogue-root { font-family: 'Outfit', sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
    .rv-serif { font-family: 'Fraunces', serif; font-optical-sizing: auto; }

    .rv-screen-wrap { min-height: 100vh; min-height: 100dvh; background: radial-gradient(ellipse at top, #e8dcc4 0%, #d4c4a8 100%); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Outfit', sans-serif; }
    .rv-phone { width: 100%; max-width: 400px; height: 850px; max-height: 95vh; background: var(--paper); border-radius: 44px; overflow: hidden; position: relative; box-shadow: 0 40px 80px -20px rgba(42,36,29,0.4), 0 0 0 10px #1a1410, 0 0 0 12px #3a2f26; display: flex; flex-direction: column; }
    .rv-phone::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 120px; height: 28px; background: #1a1410; border-radius: 0 0 18px 18px; z-index: 100; }

    /* MOBILE: drop the desktop phone frame, become a real fullscreen webapp */
    @media (max-width: 640px) {
      .rv-screen-wrap { padding: 0; min-height: 100vh; min-height: 100dvh; background: var(--paper); align-items: stretch; }
      .rv-phone { max-width: 100%; height: 100vh; height: 100dvh; max-height: none; border-radius: 0; box-shadow: none; }
      .rv-phone::before { display: none; }
      .rv-content { padding-top: env(safe-area-inset-top, 0px) !important; }
      .rv-tab { padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); height: calc(74px + env(safe-area-inset-bottom, 0px)); }
      .rv-detail-back, .rv-detail-share { top: calc(16px + env(safe-area-inset-top, 0px)) !important; }
    }

    /* Touch & tap improvements */
    .revogue-root * { -webkit-tap-highlight-color: transparent; }
    .revogue-root button, .revogue-root [role='button'], .revogue-root input, .revogue-root textarea, .revogue-root select { font-family: inherit; touch-action: manipulation; }
    .revogue-root input, .revogue-root textarea, .revogue-root select { font-size: 16px; } /* prevents iOS auto-zoom on focus */
    @media (min-width: 641px) { .revogue-root input, .revogue-root textarea { font-size: 14px; } }

    .rv-paper-texture { position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.4 0 0 0 0 0.3 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)'/%3E%3C/svg%3E"); pointer-events: none; opacity: 0.4; z-index: 1; }

    .rv-content { flex: 1; overflow-y: auto; overflow-x: hidden; padding-top: 44px; position: relative; z-index: 2; scrollbar-width: none; }
    .rv-content::-webkit-scrollbar { display: none; }

    /* SPLASH */
    .rv-splash { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(ellipse at center, #f5efe3 0%, #d4c4a8 100%); position: relative; }
    .rv-splash-logo { font-family: 'Fraunces', serif; font-size: 72px; font-weight: 400; font-style: italic; color: var(--ink); letter-spacing: -3px; animation: rvFadeUp 1s ease; }
    .rv-splash-logo span { color: var(--terracotta); }
    .rv-splash-tag { font-size: 11px; letter-spacing: 8px; text-transform: uppercase; color: var(--ink-soft); margin-top: 8px; animation: rvFadeUp 1.4s ease; }
    .rv-splash-ornament { position: absolute; width: 200px; height: 200px; border: 1px solid var(--sage); border-radius: 50%; opacity: 0.3; animation: rvPulse 3s ease infinite; }
    .rv-splash-ornament:nth-child(2) { width: 300px; height: 300px; animation-delay: 0.5s; }
    .rv-splash-ornament:nth-child(3) { width: 400px; height: 400px; animation-delay: 1s; }

    @keyframes rvFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes rvPulse { 0%,100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.05); opacity: 0.1; } }
    @keyframes rvSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes rvScaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

    /* ROLE SELECT */
    .rv-role { flex: 1; padding: 60px 28px 40px; display: flex; flex-direction: column; background: linear-gradient(180deg, var(--paper) 0%, var(--cream) 100%); }
    .rv-role-header { text-align: center; margin-bottom: 40px; }
    .rv-role-brand { font-family: 'Fraunces', serif; font-style: italic; font-size: 36px; color: var(--ink); }
    .rv-role-brand span { color: var(--terracotta); }
    .rv-role-sub { font-size: 13px; color: var(--ink-soft); margin-top: 4px; letter-spacing: 0.5px; }
    .rv-role-title { font-family: 'Fraunces', serif; font-size: 28px; line-height: 1.1; margin-bottom: 8px; font-weight: 500; }
    .rv-role-desc { font-size: 13px; color: var(--ink-soft); margin-bottom: 28px; line-height: 1.5; }

    .rv-role-card { background: var(--paper); border: 1px solid #e0d5c0; border-radius: 24px; padding: 24px; margin-bottom: 14px; cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden; }
    .rv-role-card:hover, .rv-role-card.active { border-color: var(--terracotta); transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(196,112,74,0.3); }
    .rv-role-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; font-size: 24px; }
    .rv-role-card-title { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; margin-bottom: 4px; }
    .rv-role-card-desc { font-size: 12px; color: var(--ink-soft); line-height: 1.5; }

    .rv-input { width: 100%; padding: 16px 18px; border: 1px solid #d6cab4; border-radius: 14px; font-family: inherit; font-size: 14px; background: var(--paper); color: var(--ink); margin-bottom: 12px; transition: border 0.2s; }
    .rv-input:focus { outline: none; border-color: var(--terracotta); }

    .rv-btn-primary { width: 100%; padding: 16px; background: var(--ink); color: var(--paper); border: none; border-radius: 14px; font-family: inherit; font-size: 14px; font-weight: 500; letter-spacing: 0.5px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
    .rv-btn-primary:hover { background: var(--terracotta); transform: translateY(-1px); }
    .rv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    .rv-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--ink-soft); font-size: 11px; letter-spacing: 2px; }
    .rv-divider::before, .rv-divider::after { content: ''; flex: 1; height: 1px; background: #d6cab4; }

    /* HEADER */
    .rv-header { padding: 16px 20px 12px; display: flex; align-items: center; justify-content: space-between; background: var(--paper); position: sticky; top: 0; z-index: 10; }
    .rv-logo { font-family: 'Fraunces', serif; font-style: italic; font-size: 26px; color: var(--ink); }
    .rv-logo span { color: var(--terracotta); }
    .rv-header-actions { display: flex; gap: 10px; }
    .rv-icon-btn { width: 38px; height: 38px; border-radius: 50%; background: var(--cream); border: 1px solid #e0d5c0; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: all 0.2s; color: var(--ink); }
    .rv-icon-btn:hover { background: var(--cream-deep); transform: scale(1.05); }
    .rv-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; background: var(--terracotta); color: white; border-radius: 9px; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 600; }

    /* SEARCH */
    .rv-search-wrap { padding: 4px 20px 14px; }
    .rv-search { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #e0d5c0; border-radius: 30px; padding: 12px 18px; transition: all 0.2s; }
    .rv-search:focus-within { border-color: var(--terracotta); box-shadow: 0 0 0 3px rgba(196,112,74,0.1); }
    .rv-search input { border: none; outline: none; flex: 1; font-family: inherit; font-size: 13px; background: transparent; color: var(--ink); }
    .rv-search input::placeholder { color: var(--ink-soft); font-style: italic; }

    /* GENDER TABS */
    .rv-gender-row { display: flex; gap: 8px; padding: 0 20px 14px; overflow-x: auto; scrollbar-width: none; }
    .rv-gender-row::-webkit-scrollbar { display: none; }
    .rv-gender-chip { padding: 8px 18px; border-radius: 20px; border: 1px solid #d6cab4; background: var(--paper); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
    .rv-gender-chip.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

    /* SECTION */
    .rv-section { padding: 16px 20px; }
    .rv-section-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; }
    .rv-section-title { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; letter-spacing: -0.5px; }
    .rv-section-title em { color: var(--terracotta); font-weight: 400; }
    .rv-section-link { font-size: 12px; color: var(--sage-deep); cursor: pointer; display: flex; align-items: center; gap: 2px; }

    /* VIBES */
    .rv-vibes-row { display: flex; gap: 10px; padding: 0 20px 8px; overflow-x: auto; scrollbar-width: none; }
    .rv-vibes-row::-webkit-scrollbar { display: none; }
    .rv-vibe { padding: 10px 16px; border-radius: 24px; font-size: 12px; font-weight: 500; white-space: nowrap; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1px solid transparent; transition: all 0.2s; }
    .rv-vibe.active { border-color: var(--ink); transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

    /* CATEGORIES GRID */
    .rv-cats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 20px 8px; }
    .rv-cat { aspect-ratio: 1; border-radius: 20px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s; border: 1px solid #e0d5c0; background: linear-gradient(145deg, var(--cream) 0%, var(--cream-deep) 100%); }
    .rv-cat.active { border-color: var(--terracotta); background: linear-gradient(145deg, #faf2e3 0%, #e8d5b7 100%); }
    .rv-cat-emoji { font-size: 28px; }
    .rv-cat-name { font-size: 11px; font-weight: 500; }

    /* HERO */
    .rv-hero { margin: 8px 20px 4px; border-radius: 24px; overflow: hidden; background: linear-gradient(120deg, #c8d8c4 0%, #8fa08a 100%); padding: 24px; position: relative; min-height: 140px; display: flex; align-items: center; }
    .rv-hero-content { flex: 1; z-index: 2; }
    .rv-hero-kicker { display: inline-block; padding: 4px 10px; background: rgba(255,255,255,0.3); backdrop-filter: blur(10px); border-radius: 12px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; color: var(--ink); font-weight: 600; }
    .rv-hero-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 500; color: var(--ink); line-height: 1.1; margin-bottom: 12px; }
    .rv-hero-title em { font-style: italic; color: #fff; }
    .rv-hero-btn { padding: 8px 16px; background: var(--ink); color: var(--paper); border: none; border-radius: 20px; font-size: 11px; font-weight: 500; cursor: pointer; letter-spacing: 0.5px; }
    .rv-hero-emoji { position: absolute; right: 16px; bottom: 16px; font-size: 80px; opacity: 0.9; transform: rotate(-12deg); }

    /* PRODUCT GRID */
    .rv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 20px 20px; }
    .rv-card { background: var(--paper); border-radius: 20px; overflow: hidden; cursor: pointer; transition: all 0.25s; animation: rvSlideUp 0.5s ease backwards; border: 1px solid #eae0cc; }
    .rv-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px -12px rgba(42,36,29,0.2); }
    .rv-card-img { aspect-ratio: 3/4; position: relative; overflow: hidden; background: var(--cream); }
    .rv-card-photo { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
    .rv-card:hover .rv-card-photo { transform: scale(1.05); }
    .rv-card-cond { position: absolute; top: 10px; left: 10px; padding: 4px 10px; background: rgba(250,246,237,0.95); border-radius: 12px; font-size: 9px; font-weight: 600; letter-spacing: 0.5px; z-index: 2; }
    .rv-card-heart { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; background: rgba(250,246,237,0.95); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; transition: all 0.2s; border: none; }
    .rv-card-heart:hover { transform: scale(1.1); background: white; }
    .rv-card-heart.active { background: var(--terracotta); }
    .rv-card-body { padding: 10px 12px 14px; }
    .rv-card-brand { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 2px; }
    .rv-card-title { font-family: 'Fraunces', serif; font-size: 14px; font-weight: 500; line-height: 1.2; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rv-card-price-row { display: flex; align-items: baseline; gap: 6px; }
    .rv-card-price { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: var(--ink); }
    .rv-card-original { font-size: 11px; color: var(--ink-soft); text-decoration: line-through; }
    .rv-card-size { font-size: 10px; color: var(--ink-soft); margin-top: 2px; }

    /* PRODUCT DETAIL */
    .rv-detail-back { position: absolute; top: 60px; left: 16px; z-index: 20; width: 40px; height: 40px; border-radius: 50%; background: rgba(250,246,237,0.95); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; color: var(--ink); }
    .rv-detail-img { aspect-ratio: 1; position: relative; background: var(--cream); overflow: hidden; }
    .rv-detail-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .rv-detail-share { position: absolute; top: 60px; right: 16px; z-index: 20; width: 40px; height: 40px; border-radius: 50%; background: rgba(250,246,237,0.95); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; color: var(--ink); }
    .rv-detail-body { padding: 20px; }
    .rv-detail-meta { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .rv-detail-brand { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 4px; }
    .rv-detail-title { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 500; line-height: 1.1; margin-bottom: 10px; }
    .rv-detail-price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eae0cc; }
    .rv-detail-price { font-family: 'Fraunces', serif; font-size: 32px; font-weight: 600; color: var(--terracotta); }
    .rv-detail-original { font-size: 14px; color: var(--ink-soft); text-decoration: line-through; }
    .rv-detail-discount { padding: 3px 8px; background: #e8d5b7; border-radius: 8px; font-size: 10px; font-weight: 600; color: var(--rust); }

    .rv-spec-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .rv-spec { background: var(--cream); border-radius: 14px; padding: 12px 14px; border: 1px solid #eae0cc; }
    .rv-spec-label { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 2px; }
    .rv-spec-val { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 500; }

    .rv-seller-card { background: var(--cream); border-radius: 16px; padding: 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border: 1px solid #eae0cc; }
    .rv-seller-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--terracotta), var(--gold)); display: flex; align-items: center; justify-content: center; color: white; font-family: 'Fraunces', serif; font-weight: 600; font-size: 18px; }
    .rv-seller-info { flex: 1; }
    .rv-seller-name { font-weight: 500; font-size: 13px; }
    .rv-seller-rating { font-size: 11px; color: var(--ink-soft); display: flex; align-items: center; gap: 3px; margin-top: 2px; }

    .rv-desc-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; margin-bottom: 6px; }
    .rv-desc-text { font-size: 13px; color: var(--ink-soft); line-height: 1.6; margin-bottom: 20px; }

    .rv-detail-actions { position: sticky; bottom: 72px; padding: 14px 20px; background: linear-gradient(180deg, rgba(250,246,237,0) 0%, var(--paper) 40%); display: flex; gap: 10px; }
    .rv-btn-wish { width: 52px; height: 52px; border-radius: 14px; border: 1px solid #d6cab4; background: var(--paper); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: var(--ink); }
    .rv-btn-wish.active { background: var(--terracotta); color: white; border-color: var(--terracotta); }
    .rv-btn-bag { flex: 1; padding: 16px; background: var(--ink); color: var(--paper); border: none; border-radius: 14px; font-family: inherit; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
    .rv-btn-bag:hover { background: var(--terracotta); }
    .rv-btn-bag.in-cart { background: var(--sage-deep); }

    /* EMPTY STATE */
    .rv-empty { padding: 60px 30px; text-align: center; color: var(--ink-soft); }
    .rv-empty-icon { font-size: 60px; margin-bottom: 12px; }
    .rv-empty-title { font-family: 'Fraunces', serif; font-size: 20px; color: var(--ink); margin-bottom: 6px; }
    .rv-empty-text { font-size: 13px; line-height: 1.5; }

    /* BAG */
    .rv-bag-item { display: flex; gap: 12px; padding: 14px; background: var(--paper); border-radius: 16px; margin-bottom: 10px; border: 1px solid #eae0cc; }
    .rv-bag-img { width: 80px; aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; flex-shrink: 0; background: var(--cream); }
    .rv-bag-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .rv-bag-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    .rv-bag-del { color: var(--ink-soft); background: none; border: none; cursor: pointer; padding: 4px; }

    .rv-summary { margin: 14px 20px; padding: 16px; background: var(--cream); border: 1px solid #eae0cc; border-radius: 16px; }
    .rv-summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: var(--ink-soft); }
    .rv-summary-row.total { padding-top: 12px; margin-top: 8px; border-top: 1px dashed #d6cab4; font-family: 'Fraunces', serif; font-size: 18px; color: var(--ink); font-weight: 600; }

    /* PAYMENT */
    .rv-pay-section { padding: 14px 20px; }
    .rv-pay-label { font-family: 'Fraunces', serif; font-size: 14px; font-weight: 500; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-soft); }
    .rv-pay-option { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--paper); border: 1px solid #e0d5c0; border-radius: 14px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
    .rv-pay-option.active { border-color: var(--terracotta); background: #faf2e8; }
    .rv-pay-radio { width: 18px; height: 18px; border: 1px solid #d6cab4; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .rv-pay-radio.active { background: var(--terracotta); border-color: var(--terracotta); }
    .rv-pay-radio-dot { width: 6px; height: 6px; background: white; border-radius: 50%; }
    .rv-pay-method-name { font-size: 13px; font-weight: 500; }
    .rv-pay-method-desc { font-size: 11px; color: var(--ink-soft); margin-top: 1px; }

    /* STYLE FEED */
    .rv-post { background: var(--paper); border: 1px solid #eae0cc; border-radius: 20px; margin: 0 20px 16px; overflow: hidden; }
    .rv-post-head { padding: 14px; display: flex; align-items: center; gap: 10px; }
    .rv-post-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--pink), var(--gold)); display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .rv-post-user { font-weight: 500; font-size: 13px; }
    .rv-post-time { font-size: 10px; color: var(--ink-soft); }
    .rv-post-img { aspect-ratio: 1; overflow: hidden; background: var(--cream); }
    .rv-post-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .rv-post-actions { padding: 12px 14px 8px; display: flex; gap: 16px; align-items: center; }
    .rv-post-action { background: none; border: none; cursor: pointer; color: var(--ink); display: flex; align-items: center; gap: 4px; font-size: 12px; }
    .rv-post-caption { padding: 0 14px 10px; font-size: 13px; line-height: 1.5; }
    .rv-post-caption strong { font-weight: 600; margin-right: 6px; }
    .rv-post-tags { padding: 0 14px 14px; font-size: 12px; color: var(--sage-deep); }

    /* PROFILE */
    .rv-prof-head { padding: 30px 20px 20px; text-align: center; background: linear-gradient(180deg, var(--cream) 0%, var(--paper) 100%); }
    .rv-prof-avatar { width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 12px; background: linear-gradient(135deg, var(--terracotta), var(--gold)); display: flex; align-items: center; justify-content: center; color: white; font-family: 'Fraunces', serif; font-size: 36px; font-weight: 500; border: 3px solid var(--paper); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
    .rv-prof-name { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; }
    .rv-prof-handle { font-size: 12px; color: var(--ink-soft); margin-bottom: 4px; }
    .rv-prof-role { display: inline-block; padding: 3px 10px; background: var(--sage); color: white; border-radius: 10px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; }
    .rv-prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin: 18px 20px; padding: 16px; background: var(--cream); border: 1px solid #eae0cc; border-radius: 16px; }
    .rv-prof-stat { text-align: center; }
    .rv-prof-stat-num { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; }
    .rv-prof-stat-label { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-soft); }
    .rv-menu-item { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #eae0cc; cursor: pointer; }
    .rv-menu-item:hover { background: var(--cream); }
    .rv-menu-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--cream); display: flex; align-items: center; justify-content: center; color: var(--terracotta); }
    .rv-menu-text { flex: 1; font-size: 13px; font-weight: 500; }

    /* SELL PAGE */
    .rv-sell-upload { aspect-ratio: 16/10; border: 2px dashed #d6cab4; border-radius: 20px; margin: 0 20px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--ink-soft); background: var(--cream); cursor: pointer; transition: all 0.2s; }
    .rv-sell-upload:hover { border-color: var(--terracotta); background: #faf2e8; }
    .rv-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 6px; display: block; }
    .rv-field { margin-bottom: 14px; padding: 0 20px; }

    /* TABBAR */
    /* TOASTS */
    .rv-toast-stack { position: absolute; bottom: 90px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 200; pointer-events: none; width: calc(100% - 32px); align-items: center; }
    .rv-toast { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 22px; font-size: 12px; font-weight: 500; backdrop-filter: blur(12px); animation: rvToastIn 0.35s cubic-bezier(0.2, 0.8, 0.4, 1.2); box-shadow: 0 8px 24px -6px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.08); max-width: 100%; }
    .rv-toast-success { background: rgba(143, 160, 138, 0.95); color: white; }
    .rv-toast-info { background: rgba(42, 36, 29, 0.92); color: var(--paper); }
    @keyframes rvToastIn { from { opacity: 0; transform: translateY(20px) scale(0.92); } to { opacity: 1; transform: translateY(0) scale(1); } }

    /* MODAL SHEET (comments) */
    .rv-modal-backdrop { position: absolute; inset: 0; background: rgba(26, 20, 16, 0.5); z-index: 150; display: flex; align-items: flex-end; animation: rvFadeIn 0.25s ease; }
    .rv-modal-sheet { width: 100%; max-height: 75%; background: var(--paper); border-radius: 24px 24px 0 0; display: flex; flex-direction: column; animation: rvSheetUp 0.32s cubic-bezier(0.2, 0.8, 0.4, 1); overflow: hidden; }
    .rv-modal-handle { width: 38px; height: 4px; background: #d6cab4; border-radius: 2px; margin: 10px auto 8px; }
    @keyframes rvFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes rvSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

    .rv-post-action-liked { animation: rvPop 0.3s ease; }
    @keyframes rvPop { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }

    .rv-tab { height: 74px; background: var(--paper); border-top: 1px solid #eae0cc; display: flex; justify-content: space-around; align-items: center; padding-bottom: 6px; position: relative; z-index: 5; }
    .rv-tab-btn { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: none; border: none; cursor: pointer; color: var(--ink-soft); font-family: inherit; font-size: 10px; font-weight: 500; transition: color 0.2s; }
    .rv-tab-btn.active { color: var(--terracotta); }
    .rv-tab-sell { width: 54px; height: 54px; background: var(--ink); color: var(--paper); border-radius: 50%; margin-top: -20px; display: flex; align-items: center; justify-content: center; border: 4px solid var(--paper); cursor: pointer; transition: all 0.2s; }
    .rv-tab-sell:hover { background: var(--terracotta); transform: scale(1.05); }

    /* CONFIRMATION */
    .rv-confirm { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; text-align: center; background: linear-gradient(180deg, var(--cream) 0%, var(--paper) 100%); }
    .rv-confirm-icon { width: 90px; height: 90px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 20px; animation: rvScaleIn 0.5s ease; }
    .rv-confirm-title { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 500; margin-bottom: 8px; }
    .rv-confirm-text { font-size: 13px; color: var(--ink-soft); margin-bottom: 20px; line-height: 1.5; max-width: 280px; }
    .rv-confirm-order { padding: 14px 20px; background: var(--paper); border: 1px dashed #d6cab4; border-radius: 14px; margin-bottom: 20px; }
    .rv-confirm-order-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-soft); }
    .rv-confirm-order-num { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; margin-top: 4px; }
  `;

  // ============ SCREENS ============
  if (screen === 'splash') {
    return (
      <div className="revogue-root">
        <style>{styles}</style>
        <div className="rv-screen-wrap">
          <div className="rv-phone">
            <div className="rv-paper-texture" />
            <div className="rv-content" style={{ display: 'flex', padding: 0 }}>
              <div className="rv-splash">
                <div className="rv-splash-ornament" />
                <div className="rv-splash-ornament" />
                <div className="rv-splash-ornament" />
                <div className="rv-splash-logo rv-serif">Re<span>vogue</span></div>
                <div className="rv-splash-tag">Thrift · Style · Repeat</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'role') {
    const isSignUp = authMode === 'signup';
    const isForgotEmail = authMode === 'forgot-email';
    const isForgotAnswer = authMode === 'forgot-answer';
    const isForgot = isForgotEmail || isForgotAnswer;
    return (
      <div className="revogue-root">
        <style>{styles}</style>
        <div className="rv-screen-wrap">
          <div className="rv-phone">
            <div className="rv-paper-texture" />
            <div className="rv-content">
              <div className="rv-role">
                <div className="rv-role-header">
                  <div className="rv-role-brand">Re<span>vogue</span></div>
                  <div className="rv-role-sub">THRIFT · STYLE · REPEAT</div>
                </div>
                <div className="rv-role-title rv-serif">
                  {isForgot ? <>Reset <em style={{color:'var(--terracotta)',fontStyle:'italic'}}>password</em>.</> :
                   isSignUp ? <>Join the <em style={{color:'var(--terracotta)',fontStyle:'italic'}}>circle</em>.</> :
                   <>Welcome <em style={{color:'var(--terracotta)',fontStyle:'italic'}}>back</em>.</>}
                </div>
                <div className="rv-role-desc">
                  {isForgotEmail ? "Enter your email or phone — we'll show your security question." :
                   isForgotAnswer ? "Answer your security question to set a new password." :
                   isSignUp ? "Create an account to shop, sell, and share your pre-loved style." :
                   "Sign in to pick up where you left off — your wishlist is waiting."}
                </div>

                {!isForgot && (
                  <div style={{display:'flex',background:'var(--cream)',padding:4,borderRadius:14,marginBottom:20,border:'1px solid #e0d5c0'}}>
                    <button onClick={() => { setAuthMode('signin'); setAuthError(''); setContactError(''); }} style={{flex:1,padding:'10px 0',background: !isSignUp ? 'var(--paper)' : 'transparent',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer',color: !isSignUp ? 'var(--ink)' : 'var(--ink-soft)',boxShadow: !isSignUp ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',transition:'all 0.2s'}}>Sign in</button>
                    <button onClick={() => { setAuthMode('signup'); setAuthError(''); setContactError(''); }} style={{flex:1,padding:'10px 0',background: isSignUp ? 'var(--paper)' : 'transparent',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer',color: isSignUp ? 'var(--ink)' : 'var(--ink-soft)',boxShadow: isSignUp ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',transition:'all 0.2s'}}>Create account</button>
                  </div>
                )}

                {isSignUp && (
                  <input className="rv-input" placeholder="Your name" value={userName} onChange={e => setUserName(e.target.value)} />
                )}

                {!isForgotAnswer && (
                  <>
                    <input
                      className="rv-input"
                      placeholder="Email or phone"
                      value={userContact}
                      onChange={e => { setUserContact(e.target.value); if (contactError) setContactError(''); }}
                      style={{ borderColor: contactError ? '#c94848' : undefined, marginBottom: contactError ? 4 : 12 }}
                    />
                    {contactError && <div style={{ fontSize: 11, color: '#c94848', marginBottom: 12, paddingLeft: 4 }}>⚠ {contactError}</div>}
                  </>
                )}

                {!isForgot && (
                  <div style={{position:'relative',marginBottom:12}}>
                    <input
                      className="rv-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isSignUp ? "Create a password (min. 6 chars)" : "Password"}
                      value={authPassword}
                      onChange={e => { setAuthPassword(e.target.value); if (authError) setAuthError(''); }}
                      style={{ paddingRight: 44, marginBottom: 0, borderColor: authError ? '#c94848' : undefined }}
                    />
                    <button onClick={() => setShowPassword(!showPassword)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',padding:4,display:'flex'}}>
                      {showPassword ? <EyeOff size={16} strokeWidth={1.8}/> : <Eye size={16} strokeWidth={1.8}/>}
                    </button>
                  </div>
                )}

                {isSignUp && (
                  <>
                    <div style={{fontSize:11,color:'var(--ink-soft)',marginBottom:6,marginTop:4,paddingLeft:4}}>Security question (used to reset password)</div>
                    <select className="rv-input" value={signupSecurityQuestion} onChange={e => setSignupSecurityQuestion(e.target.value)} style={{cursor:'pointer'}}>
                      {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <input className="rv-input" placeholder="Your answer (case-insensitive)" value={signupSecurityAnswer} onChange={e => setSignupSecurityAnswer(e.target.value)} />
                  </>
                )}

                {isForgotAnswer && (
                  <>
                    <div style={{padding:14,background:'var(--cream)',borderRadius:12,marginBottom:12,fontSize:13,fontFamily:'Fraunces, serif',fontStyle:'italic'}}>"{forgotQuestion}"</div>
                    <input className="rv-input" placeholder="Your answer" value={forgotAnswer} onChange={e => { setForgotAnswer(e.target.value); if (authError) setAuthError(''); }} />
                    <div style={{position:'relative',marginBottom:12}}>
                      <input
                        className="rv-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New password (min. 6 chars)"
                        value={forgotNewPassword}
                        onChange={e => { setForgotNewPassword(e.target.value); if (authError) setAuthError(''); }}
                        style={{ paddingRight: 44, marginBottom: 0 }}
                      />
                      <button onClick={() => setShowPassword(!showPassword)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',padding:4,display:'flex'}}>
                        {showPassword ? <EyeOff size={16} strokeWidth={1.8}/> : <Eye size={16} strokeWidth={1.8}/>}
                      </button>
                    </div>
                  </>
                )}

                {authError && <div style={{ fontSize: 11, color: '#c94848', marginBottom: 12, paddingLeft: 4 }}>⚠ {authError}</div>}

                {isForgotEmail ? (
                  <button className="rv-btn-primary" disabled={!userContact} onClick={handleForgotEmail}>Continue</button>
                ) : isForgotAnswer ? (
                  <button className="rv-btn-primary" disabled={!forgotAnswer || !forgotNewPassword} onClick={handleResetPassword}>Update password</button>
                ) : (
                  <button className="rv-btn-primary" disabled={!userContact || !authPassword || (isSignUp && (!userName || !signupSecurityAnswer))} onClick={handleLogin}>
                    {isSignUp ? 'Create account' : 'Sign in'}
                  </button>
                )}

                {!isSignUp && !isForgot && (
                  <div style={{textAlign:'center',marginTop:12}}>
                    <button onClick={() => { setAuthMode('forgot-email'); setAuthError(''); setContactError(''); }} style={{background:'none',border:'none',color:'var(--ink-soft)',fontFamily:'inherit',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Forgot password?</button>
                  </div>
                )}

                {isForgot && (
                  <div style={{textAlign:'center',marginTop:14}}>
                    <button onClick={() => { setAuthMode('signin'); setAuthError(''); setContactError(''); setForgotAnswer(''); setForgotNewPassword(''); }} style={{background:'none',border:'none',color:'var(--ink-soft)',fontFamily:'inherit',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>← Back to sign in</button>
                  </div>
                )}

                {!isForgot && (
                  <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                    {isSignUp ? <>By creating an account, you agree to our <span style={{color:'var(--ink)',textDecoration:'underline'}}>Terms</span> & <span style={{color:'var(--ink)',textDecoration:'underline'}}>Privacy</span> ♡</> : <>Don't have an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); setContactError(''); }} style={{background:'none',border:'none',color:'var(--terracotta)',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:11}}>Create one</button></>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ MAIN APP ============
  const wishlistItems = allProducts.filter(p => wishlist.includes(p.id));
  const cartTotal = cart.reduce((s, i) => s + i.price, 0);
  const shipping = cartTotal > 999 ? 0 : 49;
  const platformFee = Math.round(cartTotal * 0.02);
  const grandTotal = cartTotal + shipping + platformFee;

  const renderHome = () => (
    <>
      <div className="rv-header">
        <div className="rv-logo rv-serif">Re<span>vogue</span></div>
        <div className="rv-header-actions">
          <button className="rv-icon-btn" onClick={() => setActiveTab('wishlist')}>
            <Heart size={16} fill={wishlist.length ? 'var(--terracotta)' : 'none'} strokeWidth={1.8} />
            {wishlist.length > 0 && <span className="rv-badge">{wishlist.length}</span>}
          </button>
          <button className="rv-icon-btn" onClick={() => setActiveTab('bag')}>
            <ShoppingBag size={16} strokeWidth={1.8} />
            {cart.length > 0 && <span className="rv-badge">{cart.length}</span>}
          </button>
        </div>
      </div>

      <div className="rv-search-wrap">
        <div className="rv-search">
          <Search size={16} color="var(--ink-soft)" strokeWidth={1.8} />
          <input placeholder="Search thrift finds…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && <button onClick={() => setSearchQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',display:'flex'}}><X size={14}/></button>}
        </div>
      </div>

      <div className="rv-gender-row">
        {['All', 'Women', 'Men', 'Unisex'].map(g => (
          <button key={g} className={`rv-gender-chip ${selectedGender === g ? 'active' : ''}`} onClick={() => setSelectedGender(g)}>{g}</button>
        ))}
      </div>

      {!searchQuery && (
        <>
          <div className="rv-section" style={{ paddingBottom: 8 }}>
            <div className="rv-section-head">
              <div className="rv-section-title rv-serif">Your <em>vibe</em>, your closet</div>
            </div>
          </div>

          <div className="rv-vibes-row">
            {VIBES.map(v => (
              <button key={v.id} className={`rv-vibe ${selectedVibe === v.name ? 'active' : ''}`} style={{ background: v.color }} onClick={() => setSelectedVibe(selectedVibe === v.name ? null : v.name)}>
                <span>{v.emoji}</span>
                <span>{v.name}</span>
              </button>
            ))}
          </div>

          <div className="rv-section" style={{ paddingBottom: 8 }}>
            <div className="rv-section-head">
              <div className="rv-section-title rv-serif">Shop by <em>piece</em></div>
            </div>
          </div>
          <div className="rv-cats">
            {CATEGORIES.map(c => (
              <div key={c.name} className={`rv-cat ${selectedCategory === c.name ? 'active' : ''}`} onClick={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}>
                <div className="rv-cat-emoji">{c.emoji}</div>
                <div className="rv-cat-name">{c.name}</div>
              </div>
            ))}
          </div>

          <div className="rv-hero">
            <div className="rv-hero-content">
              <div className="rv-hero-kicker">⚡ Fresh Drops</div>
              <div className="rv-hero-title rv-serif">Just In.<br/><em>Loved before.</em></div>
              <button className="rv-hero-btn" onClick={() => { setSelectedVibe(null); setSelectedCategory(null); setSelectedGender('All'); setActiveTab('search'); }}>Shop now →</button>
            </div>
            <div className="rv-hero-emoji">👗</div>
          </div>
        </>
      )}

      {!searchQuery && userListings.length > 0 && (
        <>
          <div className="rv-section" style={{ paddingBottom: 8 }}>
            <div className="rv-section-head">
              <div className="rv-section-title rv-serif">Listed by <em>you</em></div>
              <button onClick={() => setScreen('my-listings')} style={{background:'none',border:'none',fontSize:11,color:'var(--terracotta)',cursor:'pointer',fontFamily:'inherit',fontWeight:500,display:'flex',alignItems:'center',gap:2}}>See all <ChevronRight size={12}/></button>
            </div>
          </div>
          <div style={{display:'flex',gap:12,overflowX:'auto',padding:'0 20px 16px',scrollbarWidth:'none'}}>
            {userListings.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(productWithImg(p)); setScreen('detail'); }} style={{flex:'0 0 auto',width:140,cursor:'pointer'}}>
                <div style={{aspectRatio:'3/4',borderRadius:14,overflow:'hidden',background:'var(--cream)',position:'relative',border:'1px solid #eae0cc'}}>
                  <img src={p.img} alt={p.title} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} onError={(e) => handleImgError(e, p)}/>
                  <span style={{position:'absolute',top:8,left:8,padding:'3px 8px',background:'var(--sage-deep)',color:'white',borderRadius:10,fontSize:9,fontWeight:600,letterSpacing:0.5}}>LIVE</span>
                </div>
                <div style={{paddingTop:6}}>
                  <div style={{fontFamily:'Fraunces, serif',fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title}</div>
                  <div style={{fontFamily:'Fraunces, serif',fontSize:13,fontWeight:600,color:'var(--terracotta)',marginTop:1}}>₹{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="rv-section" style={{ paddingBottom: 8 }}>
        <div className="rv-section-head">
          <div className="rv-section-title rv-serif">
            {searchQuery ? `Results for "${searchQuery}"` : <>Trending <em>now</em></>}
          </div>
          {(selectedVibe || selectedCategory || selectedGender !== 'All') && (
            <button onClick={() => { setSelectedVibe(null); setSelectedCategory(null); setSelectedGender('All'); }} style={{background:'none',border:'none',fontSize:11,color:'var(--terracotta)',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Clear filters</button>
          )}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon">🔍</div>
          <div className="rv-empty-title rv-serif">No finds yet</div>
          <div className="rv-empty-text">Try a different vibe or search term — more drops land daily.</div>
        </div>
      ) : (
        <div className="rv-grid">
          {filteredProducts.map((p, i) => (
            <div key={p.id} className="rv-card" style={{ animationDelay: `${i * 0.04}s` }} onClick={() => { setSelectedProduct(p); setScreen('detail'); }}>
              <div className="rv-card-img">
                <img src={p.img} alt={p.title} className="rv-card-photo" loading="lazy" onError={(e) => handleImgError(e, p)} />
                <span className="rv-card-cond">{p.condition}</span>
                {p.isMine && <span style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',padding:'3px 9px',background:'var(--sage-deep)',color:'white',borderRadius:10,fontSize:8.5,fontWeight:700,letterSpacing:0.8,zIndex:2}}>YOURS</span>}
                <button className={`rv-card-heart ${wishlist.includes(p.id) ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleWishlist(p.id); }}>
                  <Heart size={14} fill={wishlist.includes(p.id) ? 'white' : 'none'} color={wishlist.includes(p.id) ? 'white' : 'var(--ink)'} strokeWidth={2}/>
                </button>
              </div>
              <div className="rv-card-body">
                <div className="rv-card-brand">{p.brand}</div>
                <div className="rv-card-title rv-serif">{p.title}</div>
                <div className="rv-card-price-row">
                  <span className="rv-card-price rv-serif">₹{p.price}</span>
                  <span className="rv-card-original">₹{p.originalPrice}</span>
                </div>
                <div className="rv-card-size">Size {p.size}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderSearch = () => (
    <>
      <div className="rv-header">
        <div className="rv-logo rv-serif">Discover</div>
        <button className="rv-icon-btn" onClick={() => setFilterSheetOpen(true)} style={{position:'relative'}}>
          <Filter size={16} strokeWidth={1.8}/>
          {activeFilterCount > 0 && (
            <span style={{position:'absolute',top:-2,right:-2,background:'var(--terracotta)',color:'white',borderRadius:'50%',width:16,height:16,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600}}>{activeFilterCount}</span>
          )}
        </button>
      </div>
      <div className="rv-search-wrap">
        <div className="rv-search">
          <Search size={16} color="var(--ink-soft)" strokeWidth={1.8} />
          <input placeholder="Brand, vibe, or piece…" value={searchTabQuery} onChange={e => setSearchTabQuery(e.target.value)} autoFocus />
          {searchTabQuery && <button onClick={() => setSearchTabQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',display:'flex'}}><X size={14}/></button>}
        </div>
      </div>

      {!searchTabQuery && (
        <div className="rv-section">
          <div className="rv-label">Trending searches</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
            {['Cottagecore dresses','Old Money','Under ₹500','Cream sweater'].map(q => (
              <button key={q} onClick={() => setSearchTabQuery(q)} style={{padding:'8px 14px',borderRadius:20,border:'1px solid #d6cab4',background:'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{q}</button>
            ))}
          </div>
        </div>
      )}

      <div className="rv-section" style={{paddingBottom:8}}>
        <div className="rv-section-title rv-serif">{searchTabQuery ? `${searchTabProducts.length} finds` : <>Popular <em>right now</em></>}</div>
      </div>

      {searchTabProducts.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon">🔍</div>
          <div className="rv-empty-title rv-serif">Nothing found</div>
          <div className="rv-empty-text">Try fewer words or a different search.</div>
        </div>
      ) : (
        <div className="rv-grid">
          {searchTabProducts.map((p, i) => (
            <div key={p.id} className="rv-card" style={{animationDelay:`${i*0.04}s`}} onClick={() => { setSelectedProduct(p); setScreen('detail'); }}>
              <div className="rv-card-img">
                <img src={p.img} alt={p.title} className="rv-card-photo" loading="lazy" onError={(e) => handleImgError(e, p)} />
                <span className="rv-card-cond">{p.condition}</span>
                <button className={`rv-card-heart ${wishlist.includes(p.id) ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleWishlist(p.id); }}>
                  <Heart size={14} fill={wishlist.includes(p.id) ? 'white' : 'none'} color={wishlist.includes(p.id) ? 'white' : 'var(--ink)'} strokeWidth={2}/>
                </button>
              </div>
              <div className="rv-card-body">
                <div className="rv-card-brand">{p.brand}</div>
                <div className="rv-card-title rv-serif">{p.title}</div>
                <div className="rv-card-price-row">
                  <span className="rv-card-price rv-serif">₹{p.price}</span>
                  <span className="rv-card-original">₹{p.originalPrice}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filterSheetOpen && (
        <div onClick={() => setFilterSheetOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center',animation:'rvFadeIn 0.2s ease'}}>
          <div onClick={(e) => e.stopPropagation()} style={{background:'var(--paper)',width:'100%',maxWidth:480,borderRadius:'20px 20px 0 0',padding:'20px 20px 30px',maxHeight:'85vh',overflowY:'auto',animation:'rvSlideUp 0.3s ease'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div className="rv-logo rv-serif" style={{fontSize:20}}>Filters</div>
              <button onClick={() => setFilterSheetOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',display:'flex',padding:4}}><X size={20}/></button>
            </div>

            <div className="rv-label" style={{marginTop:8}}>Gender</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {['All','Women','Men','Unisex'].map(g => (
                <button key={g} onClick={() => setSearchFilters(f => ({...f, gender: g}))} style={{padding:'8px 14px',borderRadius:20,border: searchFilters.gender === g ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: searchFilters.gender === g ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: searchFilters.gender === g ? 'var(--terracotta)' : 'var(--ink)',fontWeight:500}}>{g}</button>
              ))}
            </div>

            <div className="rv-label" style={{marginTop:18}}>Category</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {CATEGORIES.map(c => (
                <button key={c.name} onClick={() => setSearchFilters(f => ({...f, category: f.category === c.name ? null : c.name}))} style={{padding:'8px 14px',borderRadius:20,border: searchFilters.category === c.name ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: searchFilters.category === c.name ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: searchFilters.category === c.name ? 'var(--terracotta)' : 'var(--ink)',fontWeight:500}}>{c.emoji} {c.name}</button>
              ))}
            </div>

            <div className="rv-label" style={{marginTop:18}}>Vibe</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {VIBES.map(v => (
                <button key={v.name} onClick={() => setSearchFilters(f => ({...f, vibe: f.vibe === v.name ? null : v.name}))} style={{padding:'8px 14px',borderRadius:20,border: searchFilters.vibe === v.name ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: searchFilters.vibe === v.name ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: searchFilters.vibe === v.name ? 'var(--terracotta)' : 'var(--ink)',fontWeight:500}}>{v.emoji} {v.name}</button>
              ))}
            </div>

            <div className="rv-label" style={{marginTop:18}}>Condition</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {['All','Like New','Excellent','Good'].map(c => (
                <button key={c} onClick={() => setSearchFilters(f => ({...f, condition: c}))} style={{padding:'8px 14px',borderRadius:20,border: searchFilters.condition === c ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: searchFilters.condition === c ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: searchFilters.condition === c ? 'var(--terracotta)' : 'var(--ink)',fontWeight:500}}>{c}</button>
              ))}
            </div>

            <div className="rv-label" style={{marginTop:18}}>Max price</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {[{label:'Any',v:null},{label:'Under ₹500',v:500},{label:'Under ₹1000',v:1000},{label:'Under ₹2000',v:2000}].map(opt => (
                <button key={opt.label} onClick={() => setSearchFilters(f => ({...f, maxPrice: opt.v}))} style={{padding:'8px 14px',borderRadius:20,border: searchFilters.maxPrice === opt.v ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: searchFilters.maxPrice === opt.v ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: searchFilters.maxPrice === opt.v ? 'var(--terracotta)' : 'var(--ink)',fontWeight:500}}>{opt.label}</button>
              ))}
            </div>

            <div className="rv-label" style={{marginTop:18}}>Sort by</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {[{label:'Newest',v:'newest'},{label:'Price ↑',v:'priceAsc'},{label:'Price ↓',v:'priceDesc'},{label:'Popular',v:'popular'}].map(opt => (
                <button key={opt.v} onClick={() => setSearchFilters(f => ({...f, sortBy: opt.v}))} style={{padding:'8px 14px',borderRadius:20,border: searchFilters.sortBy === opt.v ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: searchFilters.sortBy === opt.v ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: searchFilters.sortBy === opt.v ? 'var(--terracotta)' : 'var(--ink)',fontWeight:500}}>{opt.label}</button>
              ))}
            </div>

            <div style={{display:'flex',gap:8,marginTop:24}}>
              <button onClick={() => setSearchFilters(emptyFilters)} style={{flex:1,padding:14,borderRadius:24,border:'1px solid #d6cab4',background:'var(--paper)',fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Clear all</button>
              <button onClick={() => setFilterSheetOpen(false)} style={{flex:2,padding:14,borderRadius:24,border:'none',background:'var(--ink)',color:'var(--paper)',fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Show {searchTabProducts.length} {searchTabProducts.length === 1 ? 'item' : 'items'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderStyleFeed = () => {
    // ----- Like / Save / Comment plumbing -----
    // Source of truth for backend posts is remotePosts[i] itself (likes, likedByMe, savedByMe, comments).
    // postLikes/postSaves local overlays only matter for offline fallback STYLE_POSTS (numeric IDs).
    const toggleLike = async (postId) => {
      const isBackendPost = typeof postId === 'string';
      if (!isBackendPost) {
        // Local fallback post (numeric ID)
        const wasLiked = !!postLikes[postId];
        setPostLikes(prev => ({ ...prev, [postId]: !wasLiked }));
        pushToast(wasLiked ? 'Unliked' : '♡ Liked', wasLiked ? 'info' : 'success');
        return;
      }
      const post = remotePosts.find(p => p.id === postId);
      if (!post) return;
      const wasLiked = !!post.likedByMe;
      // Optimistic: update count + flag
      setRemotePosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        likes: Math.max(0, (p.likes || 0) + (wasLiked ? -1 : 1)),
        likedByMe: !wasLiked,
      } : p));
      pushToast(wasLiked ? 'Unliked' : '♡ Liked', wasLiked ? 'info' : 'success');
      if (!getToken()) return;
      try {
        const r = await api.likePost(postId);
        // Replace optimistic state with server truth
        setRemotePosts(prev => prev.map(p => p.id === postId ? { ...p, likes: r.likes, likedByMe: r.liked } : p));
      } catch (e) {
        // Rollback
        setRemotePosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          likes: Math.max(0, (p.likes || 0) + (wasLiked ? 1 : -1)),
          likedByMe: wasLiked,
        } : p));
        pushToast(e.message || 'Like failed', 'info');
      }
    };
    const toggleSave = async (postId) => {
      const isBackendPost = typeof postId === 'string';
      if (!isBackendPost) {
        const wasSaved = !!postSaves[postId];
        setPostSaves(prev => ({ ...prev, [postId]: !wasSaved }));
        pushToast(wasSaved ? 'Removed from saved' : '🔖 Saved to your collection', wasSaved ? 'info' : 'success');
        return;
      }
      const post = remotePosts.find(p => p.id === postId);
      if (!post) return;
      const wasSaved = !!post.savedByMe;
      setRemotePosts(prev => prev.map(p => p.id === postId ? { ...p, savedByMe: !wasSaved } : p));
      pushToast(wasSaved ? 'Removed from saved' : '🔖 Saved to your collection', wasSaved ? 'info' : 'success');
      if (!getToken()) return;
      try { await api.savePost(postId); }
      catch (e) {
        setRemotePosts(prev => prev.map(p => p.id === postId ? { ...p, savedByMe: wasSaved } : p));
        pushToast(e.message || 'Save failed', 'info');
      }
    };
    const openUserProfile = async (username) => {
      if (!username) return;
      const myHandle = (userName || '').toLowerCase().replace(/\s/g, '_');
      // Tapping your own handle → take you to your profile tab, not the public view
      if (username === myUsername || username === myHandle || username === userName?.toLowerCase()) {
        setActiveTab('profile');
        return;
      }
      setViewingUserLoading(true);
      setViewingUser({ username, name: username, profile: {}, listings: [], posts: [] });
      setScreen('public-profile');
      try {
        const profileRes = await api.getPublicProfile(username);
        const u = profileRes.user || profileRes;
        const isPrivate = u.isPrivate || u.settings?.privateProfile || false;
        const userId = u._id;
        let listings = [];
        let posts = [];
        if (!isPrivate && userId) {
          const [lRes, pRes] = await Promise.all([
            api.listProducts({ seller: userId, limit: 30 }).catch(() => ({ items: [] })),
            api.listPosts({ user: userId, limit: 30 }).catch(() => ({ items: [] })),
          ]);
          listings = lRes.items || lRes || [];
          posts = pRes.items || [];
        }
        setViewingUser({
          username: u.username,
          name: u.name,
          profile: u.profile || {},
          sellerRating: u.sellerRating,
          sellerSalesCount: u.sellerSalesCount,
          sustainabilityScore: u.sustainabilityScore,
          isPrivate,
          listingsCount: profileRes.listingsCount || 0,
          listings,
          posts,
        });
      } catch (e) {
        pushToast(e.message || 'Could not load profile', 'info');
        setScreen('app');
      } finally {
        setViewingUserLoading(false);
      }
    };
    const sharePost = async (post) => {
      const url = `${window.location.origin}/?look=${post.id}`;
      const text = `Check out this look on Revogue ✨\n"${post.caption || ''}"\n@${post.user} · ${url}`;
      // On mobile, use the native share sheet (lets user pick WhatsApp, Insta DM, anything)
      if (navigator.share) {
        try { await navigator.share({ title: 'Revogue Lookbook', text, url }); return; }
        catch { /* user cancelled */ return; }
      }
      // Desktop fallback: open WhatsApp Web directly
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };
    // Like count: for backend posts the source of truth is post.likes (we update it optimistically).
    // For fallback STYLE_POSTS (numeric IDs), apply the local overlay on top.
    const getCount = (post) => {
      const isBackend = typeof post.id === 'string';
      const baseLikes = Number(post.likes) || 0;
      if (isBackend) return baseLikes;
      return baseLikes + (postLikes[post.id] ? 1 : 0);
    };
    // Comment count: post.comments is always an array now. Add any locally-added comments not yet flushed to backend.
    const getCommentCount = (post) => {
      const serverCount = Array.isArray(post.comments) ? post.comments.length : (Number(post.comments) || 0);
      const localExtra = postComments[post.id]?.length || 0;
      const isBackend = typeof post.id === 'string';
      // For backend posts, locally-added comments are already merged into post.comments by submitComment,
      // so don't double-count them.
      return isBackend ? serverCount : (serverCount + localExtra);
    };

    return (
      <>
        <div className="rv-header">
          <div className="rv-logo rv-serif">The <span style={{color:'var(--terracotta)',fontStyle:'italic'}}>Look</span>book</div>
          <button className="rv-icon-btn" onClick={() => setScreen('post-style')}><Plus size={18} strokeWidth={2}/></button>
        </div>
        <div style={{padding:'6px 20px 14px',fontSize:12,color:'var(--ink-soft)',fontStyle:'italic'}}>How the community styles their thrifted finds ✨</div>

        {visiblePosts.map((post, i) => {
          const liked = postLikes[post.id] !== undefined ? !!postLikes[post.id] : !!post.likedByMe;
          const saved = postSaves[post.id] !== undefined ? !!postSaves[post.id] : !!post.savedByMe;
          // A post is "mine" if its username matches my username — works for both backend posts and edited ones
          const myHandle = (userName || '').toLowerCase().replace(/\s/g, '_');
          const isMyPost = !!getToken() && (post.user === myUsername || post.user === myHandle || post.user === userName?.toLowerCase());
          return (
            <div key={post.id} className="rv-post" style={{animation:`rvSlideUp 0.5s ease ${i*0.1}s backwards`}}>
              <div className="rv-post-head">
                <div className="rv-post-avatar" onClick={() => openUserProfile(post.user)} style={{cursor:'pointer', overflow:'hidden', padding:0}}>
                  {(() => {
                    // If this is my post, show MY current local avatar so it updates instantly when I change it.
                    const liveUrl = isMyPost ? (userAvatar || post.avatarUrl) : post.avatarUrl;
                    return liveUrl
                      ? <img src={liveUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : post.avatar;
                  })()}
                </div>
                <div style={{flex:1}}>
                  <div className="rv-post-user" onClick={() => openUserProfile(post.user)} style={{cursor:'pointer'}}>@{post.user}{isMyPost && <span style={{marginLeft:6,padding:'1px 6px',background:'var(--sage)',color:'white',borderRadius:6,fontSize:8,fontWeight:600,letterSpacing:0.5}}>YOU</span>}</div>
                  <div className="rv-post-time">{post.createdAt ? new Date(post.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short' }) : '2h ago'} · {post.tags[0] || ''}</div>
                </div>
                {isMyPost && (
                  <>
                    <button onClick={() => {
                      // Open edit screen pre-filled with this post's data
                      setListingDraft({
                        ...emptyListing,
                        description: post.caption || '',
                        tags: post.tags || [],
                        postImg: post.img,
                        postFile: null,  // no new file picked yet
                        taggedProducts: post.products || [],
                      });
                      setEditingPostId(post.id);
                      setScreen('post-style');
                    }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',padding:4}}>
                      <Edit3 size={16} strokeWidth={1.8}/>
                    </button>
                    <button onClick={async () => {
                      if (!confirm('Delete this post?')) return;
                      const prevPosts = remotePosts;
                      setRemotePosts(prev => prev.filter(p => p.id !== post.id));
                      try {
                        await api.deletePost(post.id);
                        pushToast('Post deleted', 'success');
                      } catch (e) {
                        setRemotePosts(prevPosts);
                        pushToast(e.message || 'Could not delete', 'info');
                      }
                    }} style={{background:'none',border:'none',cursor:'pointer',color:'#c94848',padding:4}}>
                      <Trash2 size={16} strokeWidth={1.8}/>
                    </button>
                  </>
                )}
                <button onClick={() => toggleSave(post.id)} style={{background:'none',border:'none',cursor:'pointer',color: saved ? 'var(--terracotta)' : 'var(--ink)',padding:4,transition:'color 0.2s'}}>
                  <Bookmark size={18} strokeWidth={1.8} fill={saved ? 'var(--terracotta)' : 'none'}/>
                </button>
              </div>
              <div className="rv-post-img" onDoubleClick={() => { if (!liked) toggleLike(post.id); }} onClick={() => setLightboxImage(post.img)} style={{cursor:'zoom-in'}}>
                <img src={post.img} alt="outfit" loading="lazy" onError={(e) => { if (e.currentTarget.src !== post.fallbackImg && post.fallbackImg) e.currentTarget.src = post.fallbackImg; }}/>
              </div>
              <div className="rv-post-actions">
                <button className={`rv-post-action ${liked ? 'rv-post-action-liked' : ''}`} onClick={() => toggleLike(post.id)}>
                  <Heart size={18} strokeWidth={1.8} fill={liked ? 'var(--terracotta)' : 'none'} color={liked ? 'var(--terracotta)' : 'currentColor'}/>
                  <span>{getCount(post).toLocaleString()}</span>
                </button>
                <button className="rv-post-action" onClick={() => { setOpenComments(post.id); setCommentDraft(''); }}>
                  <MessageCircle size={18} strokeWidth={1.8}/>
                  <span>{getCommentCount(post)}</span>
                </button>
                <button className="rv-post-action" style={{marginLeft:'auto'}} onClick={() => sharePost(post)}>
                  <Share2 size={18} strokeWidth={1.8}/>
                </button>
              </div>
              <div className="rv-post-caption"><strong onClick={() => openUserProfile(post.user)} style={{cursor:'pointer'}}>@{post.user}</strong>{post.caption}</div>
              <div className="rv-post-tags">{post.tags.join(' · ')}</div>
              {post.products.length > 0 && (
                <div style={{padding:'0 14px 14px',display:'flex',gap:8,overflowX:'auto'}}>
                  {post.products.map(pid => {
                    const p = allProducts.find(x => x.id === pid);
                    if (!p) return null;
                    return (
                      <div key={pid} onClick={() => { setSelectedProduct(p); setScreen('detail'); }} style={{flex:'0 0 auto',display:'flex',gap:8,padding:8,background:'var(--cream)',borderRadius:12,cursor:'pointer',minWidth:180,border:'1px solid #eae0cc'}}>
                        <div style={{width:40,height:50,borderRadius:8,overflow:'hidden',flexShrink:0}}><img src={p.img} alt={p.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e) => handleImgError(e, p)}/></div>
                        <div>
                          <div style={{fontSize:10,color:'var(--ink-soft)',textTransform:'uppercase',letterSpacing:1}}>Shop the look</div>
                          <div style={{fontFamily:'Fraunces, serif',fontSize:12,fontWeight:500,marginTop:2}}>{p.title}</div>
                          <div style={{fontFamily:'Fraunces, serif',fontSize:13,color:'var(--terracotta)',fontWeight:600}}>₹{p.price}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div style={{height:20}}/>

        {/* Comments overlay */}
        {openComments !== null && (() => {
          const post = visiblePosts.find(p => p.id === openComments);
          if (!post) return null;
          const isBackendPost = typeof openComments === 'string';
          // Normalize all comments to {user, text, time} for display
          const serverComments = (post.comments || []).map(c => ({
            user: c.username || c.user || 'user',
            text: c.text,
            time: c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'now',
          }));
          // For local-fallback (numeric-ID) posts we use postComments overlay; backend posts already merge into post.comments
          const localExtra = isBackendPost ? [] : (postComments[openComments] || []);
          const allComments = [...serverComments, ...localExtra];
          const submitComment = async () => {
            if (!commentDraft.trim()) return;
            const draft = commentDraft.trim();
            const myHandle = (userName || 'you').toLowerCase().replace(/\s/g, '_');
            setCommentDraft('');
            if (!isBackendPost) {
              // Local-only post — keep tracking in postComments overlay
              setPostComments(prev => ({
                ...prev,
                [openComments]: [...(prev[openComments] || []), { user: myHandle, text: draft, time: 'now' }],
              }));
              pushToast('💬 Comment posted', 'success');
              return;
            }
            // Backend post: optimistically append to post.comments so the feed count updates immediately
            const optimisticId = `tmp-${Date.now()}`;
            const optimistic = {
              _id: optimisticId,
              username: myHandle,
              avatar: '✨',
              text: draft,
              createdAt: new Date().toISOString(),
            };
            setRemotePosts(prev => prev.map(p => p.id === openComments
              ? { ...p, comments: [...(p.comments || []), optimistic] }
              : p));
            pushToast('💬 Comment posted', 'success');
            if (!getToken()) return;
            try {
              const saved = await api.commentPost(openComments, draft);
              // Replace optimistic with server version
              setRemotePosts(prev => prev.map(p => p.id === openComments
                ? { ...p, comments: (p.comments || []).map(c => c._id === optimisticId ? saved : c) }
                : p));
            } catch (e) {
              // Rollback
              setRemotePosts(prev => prev.map(p => p.id === openComments
                ? { ...p, comments: (p.comments || []).filter(c => c._id !== optimisticId) }
                : p));
              pushToast(e.message || 'Comment failed', 'info');
            }
          };
          return (
            <div className="rv-modal-backdrop" onClick={() => setOpenComments(null)}>
              <div className="rv-modal-sheet" onClick={e => e.stopPropagation()}>
                <div className="rv-modal-handle"/>
                <div style={{padding:'4px 20px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #eae0cc'}}>
                  <div style={{fontFamily:'Fraunces, serif',fontSize:18,fontWeight:600}}>Comments</div>
                  <button onClick={() => setOpenComments(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-soft)',padding:4}}><X size={18}/></button>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'10px 20px'}}>
                  {allComments.length === 0 ? (
                    <div style={{textAlign:'center',padding:'40px 20px',color:'var(--ink-soft)'}}>
                      <div style={{fontSize:32,marginBottom:8}}>💬</div>
                      <div style={{fontSize:13}}>No comments yet</div>
                      <div style={{fontSize:11,marginTop:4,fontStyle:'italic'}}>Be the first to drop one</div>
                    </div>
                  ) : allComments.map((c, idx) => (
                    <div key={idx} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid #f0e8d0'}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg, var(--sage), var(--terracotta))',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'Fraunces, serif',fontWeight:600,fontSize:12}}>{c.user[0].toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600}}>@{c.user} <span style={{color:'var(--ink-soft)',fontWeight:400,marginLeft:6,fontSize:10}}>{c.time}</span></div>
                        <div style={{fontSize:13,marginTop:2,lineHeight:1.4}}>{c.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{padding:'10px 16px 14px',borderTop:'1px solid #eae0cc',display:'flex',gap:8,alignItems:'center',background:'var(--paper)'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg, var(--terracotta), var(--gold))',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'Fraunces, serif',fontWeight:600,fontSize:12,overflow:'hidden'}}>{userAvatar ? <img src={userAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (userName || 'Y')[0].toUpperCase()}</div>
                  <input
                    value={commentDraft}
                    onChange={e => setCommentDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
                    placeholder="Add a comment…"
                    style={{flex:1,padding:'10px 14px',border:'1px solid #d6cab4',borderRadius:20,background:'var(--cream)',fontFamily:'inherit',fontSize:13,outline:'none',color:'var(--ink)'}}
                  />
                  <button onClick={submitComment} disabled={!commentDraft.trim()} style={{padding:'8px 14px',background: commentDraft.trim() ? 'var(--terracotta)' : '#d6cab4',color:'white',border:'none',borderRadius:18,fontFamily:'inherit',fontSize:12,fontWeight:600,cursor: commentDraft.trim() ? 'pointer' : 'not-allowed'}}>Post</button>
                </div>
              </div>
            </div>
          );
        })()}
      </>
    );
  };

  const renderWishlist = () => (
    <>
      <div className="rv-header">
        <div className="rv-logo rv-serif">Wish<span style={{fontStyle:'italic'}}>list</span></div>
        <div style={{fontSize:12,color:'var(--ink-soft)'}}>{wishlist.length} saved</div>
      </div>
      {wishlistItems.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon">💌</div>
          <div className="rv-empty-title rv-serif">Nothing saved yet</div>
          <div className="rv-empty-text">Tap the heart on any piece to keep it here for later.</div>
        </div>
      ) : (
        <div className="rv-grid" style={{paddingTop:8}}>
          {wishlistItems.map((p, i) => (
            <div key={p.id} className="rv-card" style={{animationDelay:`${i*0.05}s`}} onClick={() => { setSelectedProduct(p); setScreen('detail'); }}>
              <div className="rv-card-img">
                <img src={p.img} alt={p.title} className="rv-card-photo" loading="lazy" onError={(e) => handleImgError(e, p)} />
                <span className="rv-card-cond">{p.condition}</span>
                <button className="rv-card-heart active" onClick={(e) => { e.stopPropagation(); toggleWishlist(p.id); }}>
                  <Heart size={14} fill="white" color="white" strokeWidth={2}/>
                </button>
              </div>
              <div className="rv-card-body">
                <div className="rv-card-brand">{p.brand}</div>
                <div className="rv-card-title rv-serif">{p.title}</div>
                <div className="rv-card-price-row">
                  <span className="rv-card-price rv-serif">₹{p.price}</span>
                  <span className="rv-card-original">₹{p.originalPrice}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderBag = () => (
    <>
      <div className="rv-header">
        <div className="rv-logo rv-serif">Your <span style={{fontStyle:'italic'}}>Bag</span></div>
        <div style={{fontSize:12,color:'var(--ink-soft)'}}>{cart.length} items</div>
      </div>
      {cart.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon">🛍️</div>
          <div className="rv-empty-title rv-serif">Bag is empty</div>
          <div className="rv-empty-text">Find something pre-loved to call your own.</div>
          <button onClick={() => setActiveTab('home')} style={{marginTop:20,padding:'12px 24px',background:'var(--ink)',color:'var(--paper)',border:'none',borderRadius:24,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Start browsing</button>
        </div>
      ) : (
        <>
          <div style={{padding:'8px 20px 0'}}>
            {cart.map((item, i) => (
              <div key={item.id} className="rv-bag-item" style={{animation:`rvSlideUp 0.4s ease ${i*0.05}s backwards`}}>
                <div className="rv-bag-img"><img src={item.img} alt={item.title} onError={(e) => handleImgError(e, item)}/></div>
                <div className="rv-bag-info">
                  <div>
                    <div style={{fontSize:9,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)'}}>{item.brand}</div>
                    <div style={{fontFamily:'Fraunces, serif',fontSize:14,fontWeight:500,marginTop:2}}>{item.title}</div>
                    <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:4}}>Size {item.size} · {item.condition}</div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginTop:8}}>
                    <span style={{fontFamily:'Fraunces, serif',fontSize:16,fontWeight:600,color:'var(--terracotta)'}}>₹{item.price}</span>
                    <button className="rv-bag-del" onClick={() => removeFromCart(item.id)}><Trash2 size={15}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rv-summary">
            <div className="rv-summary-row"><span>Subtotal</span><span>₹{cartTotal}</span></div>
            <div className="rv-summary-row"><span>Shipping {shipping === 0 && '(FREE 🎉)'}</span><span>{shipping === 0 ? 'FREE' : `₹${shipping}`}</span></div>
            <div className="rv-summary-row"><span>Platform fee (2%)</span><span>₹{platformFee}</span></div>
            <div className="rv-summary-row total"><span className="rv-serif">Total</span><span className="rv-serif">₹{grandTotal}</span></div>
          </div>

          <div style={{padding:'0 20px 20px'}}>
            <button className="rv-btn-primary" onClick={() => setScreen('payment')}>Proceed to Payment →</button>
          </div>
        </>
      )}
    </>
  );

  const openEditProfile = () => {
    setEditDraft({ name: userName, ...userProfile });
    setScreen('edit-profile');
  };

  const renderProfile = () => {
    const avatarColors = {
      terracotta: 'linear-gradient(135deg, var(--terracotta), var(--gold))',
      sage: 'linear-gradient(135deg, var(--sage), var(--sage-deep))',
      pink: 'linear-gradient(135deg, var(--pink), var(--terracotta))',
      ink: 'linear-gradient(135deg, var(--ink-soft), var(--ink))',
    };
    return (
    <>
      <div className="rv-header">
        <div className="rv-logo rv-serif">Profile</div>
        <button className="rv-icon-btn" onClick={openEditProfile}><Edit3 size={15} strokeWidth={1.8}/></button>
      </div>
      <div className="rv-prof-head">
        <div className="rv-prof-avatar" style={{background: avatarColors[userProfile.avatarColor] || avatarColors.terracotta, overflow: 'hidden', padding: 0}}>
          {userAvatar ? <img src={userAvatar} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (userName ? userName[0].toUpperCase() : '✨')}
        </div>
        <div className="rv-prof-name rv-serif">{userName || 'Guest'}</div>
        <div className="rv-prof-handle">@{(userName || 'guest').toLowerCase().replace(/\s/g,'_')}</div>
        <div className="rv-prof-role">{userRole === 'seller' ? 'Seller' : 'Buyer'}</div>
        {userProfile.bio && <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:10,padding:'0 30px',lineHeight:1.5,fontStyle:'italic'}}>"{userProfile.bio}"</div>}
        {userProfile.location && <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:6,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><MapPin size={11} strokeWidth={1.8}/> {userProfile.location}</div>}
      </div>

      <div className="rv-prof-stats">
        <div className="rv-prof-stat"><div className="rv-prof-stat-num rv-serif">{wishlist.length}</div><div className="rv-prof-stat-label">Saved</div></div>
        <div className="rv-prof-stat" style={{borderLeft:'1px solid #d6cab4',borderRight:'1px solid #d6cab4'}}><div className="rv-prof-stat-num rv-serif">{userListings.length}</div><div className="rv-prof-stat-label">{userRole === 'seller' ? 'Listed' : 'Listed'}</div></div>
        <div className="rv-prof-stat"><div className="rv-prof-stat-num rv-serif">{userRole === 'seller' ? '4.8' : remotePosts.filter(p => p.user === (userName || '').toLowerCase().replace(/\s/g, '_') || p.user === userName?.toLowerCase()).length}</div><div className="rv-prof-stat-label">{userRole === 'seller' ? 'Rating' : 'Styled'}</div></div>
      </div>

      <div style={{padding:'0 20px 14px'}}>
        <button onClick={openEditProfile} style={{width:'100%',padding:12,background:'var(--paper)',border:'1px solid var(--terracotta)',borderRadius:14,fontFamily:'inherit',fontSize:12,letterSpacing:1,textTransform:'uppercase',color:'var(--terracotta)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}><Edit3 size={13} strokeWidth={2}/> Edit Profile</button>
      </div>

      <div style={{marginTop:4}}>
        {[
          { icon: <Package size={16} strokeWidth={1.8}/>, label: 'My Listings', action: () => setScreen('my-listings') },
          { icon: <ShoppingBag size={16} strokeWidth={1.8}/>, label: 'My Orders', action: () => setScreen('my-orders') },
          { icon: <Heart size={16} strokeWidth={1.8}/>, label: 'Wishlist', action: () => setActiveTab('wishlist') },
          { icon: <Sparkles size={16} strokeWidth={1.8}/>, label: 'My Looks', action: () => setScreen('my-looks') },
          { icon: <Bookmark size={16} strokeWidth={1.8}/>, label: 'Saved Looks', action: () => setScreen('saved-looks') },
          { icon: <MapPin size={16} strokeWidth={1.8}/>, label: 'Shipping Addresses', action: () => setScreen('addresses') },
          { icon: <CreditCard size={16} strokeWidth={1.8}/>, label: 'Payment Methods', action: () => setScreen('payment-methods') },
          { icon: <Award size={16} strokeWidth={1.8}/>, label: 'Sustainability Score', action: () => setScreen('sustainability') },
          { icon: <Shield size={16} strokeWidth={1.8}/>, label: 'Privacy & Settings', action: () => setScreen('settings') },
        ].map((item, i) => (
          <div key={i} className="rv-menu-item" onClick={item.action}>
            <div className="rv-menu-icon">{item.icon}</div>
            <div className="rv-menu-text">{item.label}</div>
            <ChevronRight size={16} color="var(--ink-soft)"/>
          </div>
        ))}
      </div>

      <div style={{padding:20}}>
        <button onClick={() => {
          setToken(null);
          setScreen('role'); setUserRole(null); setUserName(''); setUserContact('');
          setAuthPassword(''); setAuthMode('signin');
          setWishlist([]); setCart([]); setUserListings([]); setOrders([]);
          setAddresses([]); setPaymentMethods([]); setSustainStats(null);
          setPostLikes({}); setPostSaves({}); setPostComments({}); setOpenComments(null);
          setHydrated(false);
          setUserAvatar(null); setMyUsername(''); setActiveTab('home');
          setUserProfile({ bio: 'Curating pre-loved treasures ✨', location: 'Bengaluru, IN', avatarColor: 'terracotta', email: '', phone: '' });
        }} style={{width:'100%',padding:14,background:'transparent',border:'1px solid #d6cab4',borderRadius:14,fontFamily:'inherit',fontSize:12,letterSpacing:1,textTransform:'uppercase',color:'var(--ink-soft)',cursor:'pointer'}}>Sign out</button>
      </div>
    </>
    );
  };

  const renderEditProfile = () => {
    if (!editDraft) return null;
    const avatarColors = [
      { id: 'terracotta', gradient: 'linear-gradient(135deg, #c4704a, #c4a456)' },
      { id: 'sage', gradient: 'linear-gradient(135deg, #8fa08a, #6b7f67)' },
      { id: 'pink', gradient: 'linear-gradient(135deg, #e8b5a8, #c4704a)' },
      { id: 'ink', gradient: 'linear-gradient(135deg, #5a4f42, #2a241d)' },
    ];
    const handleAvatarUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
      try {
        // Show local preview immediately
        const dataUrl = await fileToDataUrl(file);
        setEditDraft(d => ({ ...d, avatarImg: dataUrl }));
        // Upload to the backend so it persists
        if (getToken()) {
          try {
            const { url } = await api.uploadImage(file);
            setEditDraft(d => ({ ...d, avatarImg: url }));
          } catch (err) {
            pushToast(err.message || 'Avatar upload failed — using local preview', 'info');
          }
        }
      } catch { alert('Could not read image'); }
    };
    const removeAvatarImg = () => setEditDraft({ ...editDraft, avatarImg: null });
    const saveProfile = async () => {
      const nextAvatar = editDraft.avatarImg !== undefined ? editDraft.avatarImg : userAvatar;
      setUserName(editDraft.name || userName);
      setUserAvatar(nextAvatar);
      setUserProfile({
        bio: editDraft.bio,
        location: editDraft.location,
        avatarColor: editDraft.avatarColor,
        email: editDraft.email,
        phone: editDraft.phone,
      });
      if (getToken()) {
        try {
          await api.updateProfile({
            name: editDraft.name,
            email: editDraft.email || undefined,
            phone: editDraft.phone || undefined,
            profile: {
              bio: editDraft.bio,
              location: editDraft.location,
              avatarColor: editDraft.avatarColor,
              avatarUrl: typeof nextAvatar === 'string' && !nextAvatar.startsWith('data:') ? nextAvatar : '',
            },
          });
          pushToast('Profile saved', 'success');
        } catch (e) { pushToast(e.message || 'Could not save profile', 'info'); }
      }
      setScreen('app');
      setActiveTab('profile');
    };
    const currentAvatarImg = editDraft.avatarImg !== undefined ? editDraft.avatarImg : userAvatar;
    return (
      <>
        <div className="rv-header">
          <button className="rv-icon-btn" onClick={() => { setScreen('app'); setActiveTab('profile'); }}><ArrowLeft size={16} strokeWidth={1.8}/></button>
          <div className="rv-logo rv-serif">Edit <span style={{fontStyle:'italic'}}>profile</span></div>
          <button onClick={saveProfile} style={{background:'none',border:'none',color:'var(--terracotta)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',padding:'8px 4px'}}>Save</button>
        </div>

        <div style={{textAlign:'center',padding:'14px 20px 20px'}}>
          <label style={{display:'inline-block',cursor:'pointer',position:'relative'}}>
            <div style={{width:100,height:100,borderRadius:'50%',margin:'0 auto 10px',background:avatarColors.find(c => c.id === editDraft.avatarColor)?.gradient || avatarColors[0].gradient,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'Fraunces, serif',fontSize:40,fontWeight:500,border:'3px solid var(--paper)',boxShadow:'0 8px 24px -8px rgba(0,0,0,0.25)',position:'relative',overflow:'hidden'}}>
              {currentAvatarImg ? <img src={currentAvatarImg} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (editDraft.name || userName || 'R')[0].toUpperCase()}
            </div>
            <div style={{position:'absolute',bottom:6,right:'calc(50% - 50px)',width:30,height:30,background:'var(--ink)',color:'var(--paper)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'3px solid var(--paper)',cursor:'pointer'}}><Camera size={13} strokeWidth={2}/></div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{display:'none'}}/>
          </label>
          <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:2}}>
            {currentAvatarImg ? (
              <button onClick={removeAvatarImg} style={{background:'none',border:'none',color:'var(--terracotta)',fontSize:11,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Remove photo</button>
            ) : 'Tap to upload photo'}
          </div>
          <div style={{fontSize:11,letterSpacing:2,textTransform:'uppercase',color:'var(--ink-soft)',marginTop:14,marginBottom:10}}>Or pick a colour</div>
          <div style={{display:'flex',justifyContent:'center',gap:10}}>
            {avatarColors.map(c => (
              <button key={c.id} onClick={() => setEditDraft({...editDraft, avatarColor: c.id})} style={{width:34,height:34,borderRadius:'50%',background:c.gradient,border: editDraft.avatarColor === c.id ? '2.5px solid var(--ink)' : '2.5px solid transparent',cursor:'pointer',padding:0,transition:'transform 0.15s',transform: editDraft.avatarColor === c.id ? 'scale(1.1)' : 'scale(1)'}} aria-label={c.id}/>
            ))}
          </div>
        </div>

        <div style={{height:1,background:'#eae0cc',margin:'4px 20px 18px'}}/>

        <div className="rv-field">
          <div className="rv-label">Display name</div>
          <input className="rv-input" value={editDraft.name || ''} onChange={e => setEditDraft({...editDraft, name: e.target.value})} placeholder="Your name"/>
        </div>

        <div className="rv-field">
          <div className="rv-label">Handle</div>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:18,top:'50%',transform:'translateY(-50%)',color:'var(--ink-soft)',fontSize:14,pointerEvents:'none'}}>@</span>
            <input className="rv-input" value={(editDraft.name || '').toLowerCase().replace(/\s/g,'_')} readOnly style={{paddingLeft:32,color:'var(--ink-soft)',marginBottom:0}}/>
          </div>
          <div style={{fontSize:10,color:'var(--ink-soft)',marginTop:4,fontStyle:'italic'}}>Auto-generated from your name</div>
        </div>

        <div className="rv-field">
          <div className="rv-label">Bio</div>
          <textarea className="rv-input" value={editDraft.bio || ''} onChange={e => setEditDraft({...editDraft, bio: e.target.value})} placeholder="Tell the community about your style…" rows={3} maxLength={120} style={{resize:'none',fontFamily:'inherit'}}/>
          <div style={{fontSize:10,color:'var(--ink-soft)',marginTop:-8,textAlign:'right'}}>{(editDraft.bio || '').length}/120</div>
        </div>

        <div className="rv-field">
          <div className="rv-label">Location</div>
          <input className="rv-input" value={editDraft.location || ''} onChange={e => setEditDraft({...editDraft, location: e.target.value})} placeholder="e.g. Mumbai, IN"/>
        </div>

        <div className="rv-field">
          <div className="rv-label">Email</div>
          <input className="rv-input" type="email" value={editDraft.email || ''} onChange={e => setEditDraft({...editDraft, email: e.target.value})} placeholder="you@example.com"/>
        </div>

        <div className="rv-field">
          <div className="rv-label">Phone</div>
          <input className="rv-input" type="tel" value={editDraft.phone || ''} onChange={e => setEditDraft({...editDraft, phone: e.target.value})} placeholder="+91 98XXX XXXXX"/>
        </div>

        <div className="rv-field">
          <div className="rv-label">Account type</div>
          <div style={{display:'flex',gap:8}}>
            {['buyer','seller'].map(r => (
              <button key={r} onClick={() => setUserRole(r)} style={{flex:1,padding:12,borderRadius:12,border: userRole === r ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: userRole === r ? '#faf2e8' : 'var(--paper)',fontFamily:'inherit',fontSize:13,fontWeight:500,cursor:'pointer',textTransform:'capitalize',color: userRole === r ? 'var(--terracotta)' : 'var(--ink)'}}>{r}</button>
            ))}
          </div>
        </div>

        <div style={{padding:'20px 20px 30px'}}>
          <button className="rv-btn-primary" onClick={saveProfile}>Save changes</button>
        </div>
      </>
    );
  };

  // ===== Helper: standard sub-page header =====
  const SubHeader = ({ title, onBack, action }) => (
    <div className="rv-header">
      <button className="rv-icon-btn" onClick={onBack || (() => { setScreen('app'); setActiveTab('profile'); })}><ArrowLeft size={16} strokeWidth={1.8}/></button>
      <div className="rv-logo rv-serif">{title}</div>
      <div style={{minWidth:38,display:'flex',justifyContent:'flex-end'}}>{action || <div style={{width:38}}/>}</div>
    </div>
  );

  // ===== My Listings =====
  const renderMyListings = () => (
    <>
      <SubHeader title={<>My <span style={{fontStyle:'italic'}}>Listings</span></>} action={<button className="rv-icon-btn" onClick={() => { setActiveTab('sell'); setScreen('app'); }}><Plus size={16} strokeWidth={2}/></button>}/>
      <div style={{padding:'4px 20px 14px',fontSize:12,color:'var(--ink-soft)',fontStyle:'italic'}}>Items you've put up for re-loving</div>
      {userListings.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon">📦</div>
          <div className="rv-empty-title rv-serif">Nothing listed yet</div>
          <div className="rv-empty-text">Turn your closet into cash. Tap the + above to get started.</div>
          <button onClick={() => { setActiveTab('sell'); setScreen('app'); }} style={{marginTop:20,padding:'12px 24px',background:'var(--ink)',color:'var(--paper)',border:'none',borderRadius:24,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>List your first item</button>
        </div>
      ) : (
        <div className="rv-grid" style={{paddingTop:8}}>
          {userListings.map((p, i) => (
            <div key={p.id} className="rv-card" style={{animationDelay:`${i*0.04}s`}}>
              <div className="rv-card-img" onClick={() => { setSelectedProduct(p); setScreen('detail'); }} style={{cursor:'pointer'}}>
                <img src={p.img} alt={p.title} className="rv-card-photo" onError={(e) => handleImgError(e, p)} />
                <span className="rv-card-cond">{p.condition}</span>
                <span style={{position:'absolute',top:10,right:10,padding:'4px 10px',background:'var(--sage-deep)',color:'white',borderRadius:12,fontSize:9,fontWeight:600,letterSpacing:0.5,zIndex:2}}>LIVE</span>
              </div>
              <div className="rv-card-body">
                <div onClick={() => { setSelectedProduct(p); setScreen('detail'); }} style={{cursor:'pointer'}}>
                  <div className="rv-card-brand">{p.brand}</div>
                  <div className="rv-card-title rv-serif">{p.title}</div>
                  <div className="rv-card-price-row">
                    <span className="rv-card-price rv-serif">₹{p.price}</span>
                    <span className="rv-card-original">₹{p.originalPrice}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:10,color:'var(--ink-soft)'}}>
                    <span>👁 {p.views || 0} views</span>
                    <span>♡ {p.likes || 0}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6,marginTop:10,paddingTop:10,borderTop:'1px solid #eae0cc'}}>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    // Pre-fill the Sell screen with this listing's data and switch to edit mode
                    setListingDraft({
                      title: p.title,
                      brand: p.brand,
                      price: String(p.price),
                      originalPrice: String(p.originalPrice ?? p.price),
                      category: p.category,
                      condition: p.condition,
                      size: p.size,
                      gender: p.gender,
                      description: p.description || '',
                      tags: p.tags || [],
                      imgs: p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []),
                    });
                    setEditingListingId(p.id);
                    setListingError('');
                    setActiveTab('sell');
                    setScreen('app');
                  }} style={{flex:1,padding:'7px 10px',background:'var(--cream)',border:'1px solid #d6cab4',borderRadius:8,fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:4,color:'var(--ink)'}}><Edit3 size={11} strokeWidth={2}/> Edit</button>
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Remove "${p.title}" from your listings?`)) return;
                    const prevListings = userListings;
                    setUserListings(prev => prev.filter(x => x.id !== p.id));
                    setRemoteProducts(prev => prev.filter(x => x.id !== p.id));
                    if (getToken() && typeof p.id === 'string') {
                      try {
                        await api.deleteProduct(p.id);
                        pushToast('Listing removed', 'success');
                      } catch (err) {
                        setUserListings(prevListings);
                        pushToast(err.message || 'Could not remove', 'info');
                      }
                    } else {
                      pushToast('Listing removed', 'success');
                    }
                  }} style={{flex:1,padding:'7px 10px',background:'var(--paper)',border:'1px solid #d6cab4',borderRadius:8,fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:4,color:'#c94848'}}><Trash2 size={11} strokeWidth={2}/> Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ===== Public Profile (viewing another user) =====
  const renderPublicProfile = () => {
    const u = viewingUser || { username: '', name: '', profile: {}, listings: [], posts: [] };
    const profileAvatarColors = {
      terracotta: 'linear-gradient(135deg, var(--terracotta), var(--gold))',
      sage: 'linear-gradient(135deg, var(--sage), var(--sage-deep))',
      pink: 'linear-gradient(135deg, var(--pink), var(--terracotta))',
      ink: 'linear-gradient(135deg, var(--ink-soft), var(--ink))',
    };
    const bg = profileAvatarColors[u.profile?.avatarColor] || profileAvatarColors.terracotta;
    const initial = (u.name || u.username || '?').trim().charAt(0).toUpperCase();
    return (
      <>
        <SubHeader title={<><span style={{fontStyle:'italic'}}>@{u.username}</span></>} onBack={() => { setScreen('app'); setActiveTab('style'); }}/>
        {viewingUserLoading ? (
          <div style={{padding:60,textAlign:'center',color:'var(--ink-soft)',fontSize:13}}>Loading profile…</div>
        ) : (
          <>
            <div style={{padding:'20px 20px 24px',textAlign:'center'}}>
              <div className="rv-prof-avatar" style={{background: bg, overflow:'hidden', padding:0, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto'}}>
                {u.profile?.avatarUrl ? (
                  <img src={u.profile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                ) : (
                  <span style={{fontFamily:'Fraunces, serif',fontSize:32,color:'white',fontWeight:500}}>{initial}</span>
                )}
              </div>
              <div style={{marginTop:14,fontFamily:'Fraunces, serif',fontSize:22}}>{u.name || u.username}</div>
              <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:4}}>@{u.username}</div>
              {u.profile?.bio && <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:12,padding:'0 30px',lineHeight:1.5,fontStyle:'italic'}}>"{u.profile.bio}"</div>}
              {u.profile?.location && <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:6,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><MapPin size={11} strokeWidth={1.8}/> {u.profile.location}</div>}
              {u.sellerRating != null && (
                <div style={{display:'flex',justifyContent:'center',gap:24,marginTop:18,fontSize:11,color:'var(--ink-soft)'}}>
                  <div><strong style={{color:'var(--ink)',fontSize:14,fontFamily:'Fraunces, serif'}}>{u.sellerRating?.toFixed?.(1) || u.sellerRating}</strong> rating</div>
                  <div><strong style={{color:'var(--ink)',fontSize:14,fontFamily:'Fraunces, serif'}}>{u.listings.length || u.listingsCount || 0}</strong> listings</div>
                  <div><strong style={{color:'var(--ink)',fontSize:14,fontFamily:'Fraunces, serif'}}>{u.posts.length}</strong> posts</div>
                </div>
              )}
            </div>

            {u.isPrivate ? (
              <div style={{padding:40,textAlign:'center',color:'var(--ink-soft)',fontSize:13,fontStyle:'italic'}}>This profile is private 🔒</div>
            ) : (
              <>
                {u.listings.length > 0 && (
                  <>
                    <div style={{padding:'8px 20px 4px',fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)'}}>Listings</div>
                    <div className="rv-grid" style={{padding:'8px 20px 20px'}}>
                      {u.listings.map((p, i) => {
                        const np = normalizeProduct(p);
                        return (
                          <div key={np.id || p._id} className="rv-card" style={{animationDelay:`${i*0.04}s`}} onClick={() => { setSelectedProduct(np); setScreen('detail'); }}>
                            <div className="rv-card-img"><img src={np.img} alt={np.title} loading="lazy" onError={(e) => handleImgError(e, np)}/></div>
                            <div className="rv-card-body">
                              <div className="rv-card-title">{np.title}</div>
                              <div className="rv-card-meta">
                                <div className="rv-card-price">₹{np.price}</div>
                                <div className="rv-card-orig">₹{np.originalPrice}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {u.posts.length > 0 && (
                  <>
                    <div style={{padding:'8px 20px 4px',fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)'}}>Lookbook</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2,padding:'4px 0 30px'}}>
                      {u.posts.map(p => (
                        <div key={p._id || p.id} style={{aspectRatio:'1',overflow:'hidden',cursor:'zoom-in'}} onClick={() => setLightboxImage(p.image || p.img)}>
                          <img src={p.image || p.img} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e) => { if (p.fallbackImage && e.currentTarget.src !== p.fallbackImage) e.currentTarget.src = p.fallbackImage; }}/>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {u.listings.length === 0 && u.posts.length === 0 && (
                  <div style={{padding:40,textAlign:'center',color:'var(--ink-soft)',fontSize:13,fontStyle:'italic'}}>Nothing here yet ✨</div>
                )}
              </>
            )}
          </>
        )}
      </>
    );
  };

  // ===== My Looks (posts I authored) =====
  const renderMyLooks = () => {
    const myHandle = (userName || '').toLowerCase().replace(/\s/g, '_');
    const lowerName = userName?.toLowerCase() || '';
    const mine = remotePosts.filter(p => p.user === myUsername || p.user === myHandle || p.user === lowerName);
    const deleteMyPost = async (postId) => {
      if (!confirm('Delete this look?')) return;
      const snapshot = remotePosts;
      setRemotePosts(prev => prev.filter(p => p.id !== postId));
      try { await api.deletePost(postId); pushToast('Post deleted', 'success'); }
      catch (e) { setRemotePosts(snapshot); pushToast(e.message || 'Could not delete', 'info'); }
    };
    const editMyPost = (post) => {
      setListingDraft({
        ...emptyListing,
        description: post.caption || '',
        tags: post.tags || [],
        postImg: post.img,
        postFile: null,
        taggedProducts: post.products || [],
      });
      setEditingPostId(post.id);
      setScreen('post-style');
    };
    return (
      <>
        <SubHeader title={<>My <span style={{fontStyle:'italic'}}>Looks</span></>} action={<button className="rv-icon-btn" onClick={() => setScreen('post-style')}><Plus size={16} strokeWidth={2}/></button>}/>
        {mine.length === 0 ? (
          <div className="rv-empty">
            <div className="rv-empty-icon">✨</div>
            <div className="rv-empty-title rv-serif">No looks yet</div>
            <div className="rv-empty-text">Post your first outfit and inspire the community.</div>
            <button onClick={() => setScreen('post-style')} style={{marginTop:20,padding:'12px 24px',background:'var(--ink)',color:'var(--paper)',border:'none',borderRadius:24,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Post a look</button>
          </div>
        ) : (
          <div style={{padding:'10px 14px 30px',display:'flex',flexDirection:'column',gap:14}}>
            {mine.map(post => (
              <div key={post.id} style={{display:'flex',gap:12,padding:12,background:'var(--cream)',borderRadius:14,border:'1px solid #eae0cc'}}>
                <div onClick={() => setLightboxImage(post.img)} style={{width:90,height:120,borderRadius:10,overflow:'hidden',flexShrink:0,cursor:'zoom-in',background:'#eee'}}>
                  <img src={post.img} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e) => { if (post.fallbackImage && e.currentTarget.src !== post.fallbackImage) e.currentTarget.src = post.fallbackImage; }}/>
                </div>
                <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
                  <div style={{fontSize:11,color:'var(--ink-soft)',marginBottom:4}}>{post.createdAt ? new Date(post.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Recent'}</div>
                  <div style={{fontFamily:'Fraunces, serif',fontSize:13,lineHeight:1.4,marginBottom:6,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{post.caption || <em style={{color:'var(--ink-soft)'}}>(no caption)</em>}</div>
                  <div style={{display:'flex',gap:12,fontSize:11,color:'var(--ink-soft)',marginTop:'auto'}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:3}}><Heart size={11}/> {post.likes || 0}</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:3}}><MessageCircle size={11}/> {(post.comments || []).length}</span>
                    {post.products?.length > 0 && <span style={{display:'inline-flex',alignItems:'center',gap:3}}><Package size={11}/> {post.products.length}</span>}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <button onClick={() => editMyPost(post)} style={{background:'var(--paper)',border:'1px solid #d6cab4',cursor:'pointer',color:'var(--ink)',width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}><Edit3 size={14} strokeWidth={1.8}/></button>
                  <button onClick={() => deleteMyPost(post.id)} style={{background:'var(--paper)',border:'1px solid #d6cab4',cursor:'pointer',color:'#c94848',width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={14} strokeWidth={1.8}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ===== Saved Looks =====
  const renderSavedLooks = () => {
    const saved = remotePosts.filter(p => p.savedByMe);
    return (
      <>
        <SubHeader title={<>Saved <span style={{fontStyle:'italic'}}>Looks</span></>}/>
        {saved.length === 0 ? (
          <div className="rv-empty">
            <div className="rv-empty-icon">🔖</div>
            <div className="rv-empty-title rv-serif">Nothing saved yet</div>
            <div className="rv-empty-text">Bookmark looks from the Lookbook to find them here.</div>
            <button onClick={() => { setActiveTab('style'); setScreen('app'); }} style={{marginTop:20,padding:'12px 24px',background:'var(--ink)',color:'var(--paper)',border:'none',borderRadius:24,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Browse Lookbook</button>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,padding:'10px 12px 30px'}}>
            {saved.map(p => (
              <div key={p.id} style={{position:'relative',aspectRatio:'3/4',overflow:'hidden',borderRadius:12,cursor:'pointer'}} onClick={() => setLightboxImage(p.image || p.img)}>
                <img src={p.image || p.img} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e) => { if (p.fallbackImage && e.currentTarget.src !== p.fallbackImage) e.currentTarget.src = p.fallbackImage; }}/>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 60%,rgba(0,0,0,0.6))',padding:8,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                  <div style={{color:'white',fontSize:10,fontWeight:600}}>@{p.user}</div>
                  <div style={{color:'rgba(255,255,255,0.85)',fontSize:9,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.caption}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ===== My Orders =====
  const renderMyOrders = () => (
    <>
      <SubHeader title={<>My <span style={{fontStyle:'italic'}}>Orders</span></>}/>
      <div style={{padding:'4px 20px 14px',fontSize:12,color:'var(--ink-soft)',fontStyle:'italic'}}>Your thrifted treasures, in transit & arrived</div>
      {orders.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon">🧳</div>
          <div className="rv-empty-title rv-serif">No orders yet</div>
          <div className="rv-empty-text">Find something pre-loved to call your own.</div>
          <button onClick={() => { setScreen('app'); setActiveTab('home'); }} style={{marginTop:20,padding:'12px 24px',background:'var(--ink)',color:'var(--paper)',border:'none',borderRadius:24,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Start browsing</button>
        </div>
      ) : (
        <div style={{padding:'8px 20px 20px'}}>
          {orders.map((o, i) => {
            const date = new Date(o.placedAt);
            const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div key={o.num} style={{background:'var(--paper)',border:'1px solid #eae0cc',borderRadius:16,padding:14,marginBottom:10,animation:`rvSlideUp 0.4s ease ${i*0.05}s backwards`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10,paddingBottom:10,borderBottom:'1px dashed #d6cab4'}}>
                  <div>
                    <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)'}}>Order</div>
                    <div style={{fontFamily:'Fraunces, serif',fontSize:16,fontWeight:600}}>{o.num}</div>
                    <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:2}}>{dateStr}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{padding:'4px 10px',background:o.status === 'Delivered' ? '#c8dcc4' : '#e8d5b7',color:o.status === 'Delivered' ? 'var(--sage-deep)' : 'var(--rust)',borderRadius:10,fontSize:10,fontWeight:600,letterSpacing:0.5}}>{o.status}</span>
                    <div style={{fontFamily:'Fraunces, serif',fontSize:18,fontWeight:600,color:'var(--terracotta)',marginTop:6}}>₹{o.total}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,overflowX:'auto'}}>
                  {o.items.map((it, idx) => (
                    <div key={idx} style={{flex:'0 0 auto',display:'flex',gap:8,alignItems:'center',background:'var(--cream)',borderRadius:10,padding:'6px 10px 6px 6px'}}>
                      <div style={{width:36,height:46,borderRadius:6,overflow:'hidden',flexShrink:0}}><img src={it.img} alt={it.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e) => handleImgError(e, it)}/></div>
                      <div>
                        <div style={{fontFamily:'Fraunces, serif',fontSize:11,fontWeight:500,whiteSpace:'nowrap',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>{it.title}</div>
                        <div style={{fontSize:10,color:'var(--ink-soft)'}}>₹{it.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8,marginTop:10,fontSize:11,color:'var(--ink-soft)',alignItems:'center'}}>
                  <Truck size={12} strokeWidth={1.8}/>
                  <span>{o.status === 'Delivered' ? 'Delivered' : 'Estimated delivery in 3-5 days'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ===== Shipping Addresses =====
  const renderAddresses = () => {
    if (editingAddress) {
      const addr = editingAddress;
      const setField = (k, v) => setEditingAddress({ ...addr, [k]: v });
      const save = async () => {
        if (!addr.name || !addr.line1 || !addr.city || !addr.pin) return;
        if (!getToken()) {
          // Offline fallback — local state
          if (addr.id) setAddresses(prev => prev.map(a => a.id === addr.id ? addr : a));
          else setAddresses(prev => [...prev, { ...addr, id: Date.now() }]);
          setEditingAddress(null);
          return;
        }
        try {
          // Coerce state to a string fallback if user left it blank
          const payload = { ...addr, state: addr.state || addr.city };
          let saved;
          if (addr.id && typeof addr.id === 'string') {
            saved = await api.updateAddress(addr.id, payload);
          } else {
            saved = await api.createAddress(payload);
          }
          const norm = normalizeAddress(saved);
          setAddresses(prev => addr.id && typeof addr.id === 'string'
            ? prev.map(a => a.id === addr.id ? norm : a)
            : [...prev, norm]);
          setEditingAddress(null);
          pushToast('Address saved', 'success');
        } catch (e) { pushToast(e.message || 'Could not save', 'info'); }
      };
      return (
        <>
          <SubHeader title={addr.id ? 'Edit address' : 'New address'} onBack={() => setEditingAddress(null)} action={<button onClick={save} style={{background:'none',border:'none',color:'var(--terracotta)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',padding:'8px 4px'}}>Save</button>}/>
          <div className="rv-field"><div className="rv-label">Label (Home, Office...)</div><input className="rv-input" value={addr.label || ''} onChange={e => setField('label', e.target.value)} placeholder="Home"/></div>
          <div className="rv-field"><div className="rv-label">Full name</div><input className="rv-input" value={addr.name || ''} onChange={e => setField('name', e.target.value)}/></div>
          <div className="rv-field"><div className="rv-label">Phone</div><input className="rv-input" value={addr.phone || ''} onChange={e => setField('phone', e.target.value)} placeholder="+91 98XXX XXXXX"/></div>
          <div className="rv-field"><div className="rv-label">Address line</div><input className="rv-input" value={addr.line1 || ''} onChange={e => setField('line1', e.target.value)} placeholder="Flat / House no., street"/></div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12,padding:'0 20px 14px'}}>
            <div><div className="rv-label">City</div><input className="rv-input" value={addr.city || ''} onChange={e => setField('city', e.target.value)} style={{marginBottom:0}}/></div>
            <div><div className="rv-label">PIN</div><input className="rv-input" value={addr.pin || ''} onChange={e => setField('pin', e.target.value)} style={{marginBottom:0}}/></div>
          </div>
          <div className="rv-field"><div className="rv-label">State</div><input className="rv-input" value={addr.state || ''} onChange={e => setField('state', e.target.value)}/></div>
          <div style={{padding:'10px 20px 30px'}}><button className="rv-btn-primary" onClick={save}>Save address</button></div>
        </>
      );
    }
    return (
      <>
        <SubHeader title={<>Shipping <span style={{fontStyle:'italic'}}>Addresses</span></>} action={<button className="rv-icon-btn" onClick={() => setEditingAddress({ label: 'Home', name: userName || '', phone: '', line1: '', city: '', state: '', pin: '', isDefault: addresses.length === 0 })}><Plus size={16} strokeWidth={2}/></button>}/>
        <div style={{padding:'4px 20px 14px',fontSize:12,color:'var(--ink-soft)',fontStyle:'italic'}}>Where should we send your finds?</div>
        {addresses.length === 0 ? (
          <div className="rv-empty"><div className="rv-empty-icon">📍</div><div className="rv-empty-title rv-serif">No addresses</div><div className="rv-empty-text">Add a delivery address to check out faster.</div></div>
        ) : (
          <div style={{padding:'8px 20px 20px'}}>
            {addresses.map(a => (
              <div key={a.id} style={{background:'var(--paper)',border: a.isDefault ? '1.5px solid var(--terracotta)' : '1px solid #eae0cc',borderRadius:14,padding:14,marginBottom:10,position:'relative'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                      <span style={{fontFamily:'Fraunces, serif',fontSize:14,fontWeight:600}}>{a.label}</span>
                      {a.isDefault && <span style={{padding:'2px 8px',background:'var(--terracotta)',color:'white',borderRadius:8,fontSize:9,fontWeight:600,letterSpacing:0.5}}>DEFAULT</span>}
                    </div>
                    <div style={{fontSize:13,fontWeight:500}}>{a.name}</div>
                    <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:2,lineHeight:1.5}}>{a.line1}<br/>{a.city}, {a.state} {a.pin}<br/>{a.phone}</div>
                  </div>
                  <button onClick={() => setEditingAddress(a)} style={{background:'var(--cream)',border:'none',width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink)'}}><Edit3 size={13} strokeWidth={1.8}/></button>
                </div>
                <div style={{display:'flex',gap:8,marginTop:10}}>
                  {!a.isDefault && <button onClick={async () => {
                    setAddresses(prev => prev.map(x => ({ ...x, isDefault: x.id === a.id })));
                    if (getToken() && typeof a.id === 'string') {
                      try { await api.updateAddress(a.id, { isDefault: true }); }
                      catch (e) { pushToast(e.message, 'info'); }
                    }
                  }} style={{flex:1,padding:'7px 10px',background:'var(--paper)',border:'1px solid #d6cab4',borderRadius:8,fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Set as default</button>}
                  <button onClick={async () => {
                    const prevList = addresses;
                    setAddresses(prev => prev.filter(x => x.id !== a.id));
                    if (getToken() && typeof a.id === 'string') {
                      try { await api.deleteAddress(a.id); }
                      catch (e) { setAddresses(prevList); pushToast(e.message, 'info'); }
                    }
                  }} style={{flex:!a.isDefault ? '0 0 auto' : 1,padding:'7px 10px',background:'var(--paper)',border:'1px solid #d6cab4',borderRadius:8,fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'#c94848'}}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ===== Payment Methods =====
  const renderPaymentMethods = () => {
    if (editingPayment) {
      const pm = editingPayment;
      const setField = (k, v) => setEditingPayment({ ...pm, [k]: v });
      const save = async () => {
        if (!pm.label || !pm.detail) return;
        if (!getToken()) {
          if (pm.id) setPaymentMethods(prev => prev.map(p => p.id === pm.id ? pm : p));
          else setPaymentMethods(prev => [...prev, { ...pm, id: Date.now() }]);
          setEditingPayment(null);
          return;
        }
        try {
          let saved;
          if (pm.id && typeof pm.id === 'string') saved = await api.updatePayment(pm.id, pm);
          else saved = await api.createPayment(pm);
          const norm = normalizePayment(saved);
          setPaymentMethods(prev => pm.id && typeof pm.id === 'string'
            ? prev.map(p => p.id === pm.id ? norm : p)
            : [...prev, norm]);
          setEditingPayment(null);
          pushToast('Payment method saved', 'success');
        } catch (e) { pushToast(e.message || 'Could not save', 'info'); }
      };
      return (
        <>
          <SubHeader title={pm.id ? 'Edit method' : 'Add method'} onBack={() => setEditingPayment(null)} action={<button onClick={save} style={{background:'none',border:'none',color:'var(--terracotta)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',padding:'8px 4px'}}>Save</button>}/>
          <div className="rv-field">
            <div className="rv-label">Type</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {[{id:'upi',label:'UPI',emoji:'📱'},{id:'card',label:'Card',emoji:'💳'},{id:'netbanking',label:'Net Banking',emoji:'🏦'}].map(t => (
                <button key={t.id} onClick={() => setField('type', t.id)} style={{padding:'10px 16px',borderRadius:14,border: pm.type === t.id ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: pm.type === t.id ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,color: pm.type === t.id ? 'var(--terracotta)' : 'var(--ink)'}}>{t.emoji} {t.label}</button>
              ))}
            </div>
          </div>
          <div className="rv-field"><div className="rv-label">Nickname</div><input className="rv-input" value={pm.label || ''} onChange={e => setField('label', e.target.value)} placeholder={pm.type === 'card' ? 'My HDFC card' : 'GPay UPI'}/></div>
          <div className="rv-field"><div className="rv-label">{pm.type === 'card' ? 'Last 4 digits' : pm.type === 'netbanking' ? 'Bank' : 'UPI ID'}</div><input className="rv-input" value={pm.detail || ''} onChange={e => setField('detail', e.target.value)} placeholder={pm.type === 'card' ? '•••• 4242' : pm.type === 'netbanking' ? 'HDFC Bank' : 'you@oksbi'}/></div>
          <div style={{padding:'10px 20px 30px'}}><button className="rv-btn-primary" onClick={save}>Save method</button></div>
        </>
      );
    }
    const typeIcon = (t) => t === 'card' ? '💳' : t === 'netbanking' ? '🏦' : '📱';
    return (
      <>
        <SubHeader title={<>Payment <span style={{fontStyle:'italic'}}>Methods</span></>} action={<button className="rv-icon-btn" onClick={() => setEditingPayment({ type: 'upi', label: '', detail: '', isDefault: paymentMethods.length === 0 })}><Plus size={16} strokeWidth={2}/></button>}/>
        <div style={{padding:'4px 20px 14px',fontSize:12,color:'var(--ink-soft)',fontStyle:'italic'}}>Saved for faster checkout</div>
        {paymentMethods.length === 0 ? (
          <div className="rv-empty"><div className="rv-empty-icon">💳</div><div className="rv-empty-title rv-serif">No payment methods</div><div className="rv-empty-text">Save a UPI, card, or bank for one-tap checkout.</div></div>
        ) : (
          <div style={{padding:'8px 20px 20px'}}>
            {paymentMethods.map(p => (
              <div key={p.id} style={{background:'var(--paper)',border: p.isDefault ? '1.5px solid var(--terracotta)' : '1px solid #eae0cc',borderRadius:14,padding:14,marginBottom:10,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:46,height:46,borderRadius:12,background:'var(--cream)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{typeIcon(p.type)}</div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontFamily:'Fraunces, serif',fontSize:14,fontWeight:600}}>{p.label}</span>
                    {p.isDefault && <span style={{padding:'2px 8px',background:'var(--terracotta)',color:'white',borderRadius:8,fontSize:9,fontWeight:600,letterSpacing:0.5}}>DEFAULT</span>}
                  </div>
                  <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:2}}>{p.detail}</div>
                  <div style={{display:'flex',gap:6,marginTop:8}}>
                    {!p.isDefault && <button onClick={async () => {
                      setPaymentMethods(prev => prev.map(x => ({ ...x, isDefault: x.id === p.id })));
                      if (getToken() && typeof p.id === 'string') {
                        try { await api.updatePayment(p.id, { isDefault: true }); }
                        catch (e) { pushToast(e.message, 'info'); }
                      }
                    }} style={{padding:'4px 10px',background:'var(--cream)',border:'1px solid #d6cab4',borderRadius:8,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>Make default</button>}
                    <button onClick={async () => {
                      const prevList = paymentMethods;
                      setPaymentMethods(prev => prev.filter(x => x.id !== p.id));
                      if (getToken() && typeof p.id === 'string') {
                        try { await api.deletePayment(p.id); }
                        catch (e) { setPaymentMethods(prevList); pushToast(e.message, 'info'); }
                      }
                    }} style={{padding:'4px 10px',background:'var(--cream)',border:'1px solid #d6cab4',borderRadius:8,fontSize:10,cursor:'pointer',fontFamily:'inherit',color:'#c94848'}}>Remove</button>
                  </div>
                </div>
                <button onClick={() => setEditingPayment(p)} style={{background:'var(--cream)',border:'none',width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink)'}}><Edit3 size={13} strokeWidth={1.8}/></button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ===== Sustainability Score =====
  const renderSustainability = () => {
    const itemsBought = sustainStats?.itemsRescued ?? orders.reduce((s, o) => s + (o.items?.length || 0), 0);
    const itemsSold = userListings.length;
    const totalImpact = itemsBought + itemsSold;
    // Prefer backend numbers if available
    const co2Saved = sustainStats?.co2SavedKg ?? (totalImpact * 10);
    const waterSaved = sustainStats?.waterSavedLiters ?? (totalImpact * 2700);
    const score = sustainStats ? Math.min(100, sustainStats.score) : Math.min(100, totalImpact * 8 + 12);
    const tier = sustainStats?.tier ? `${sustainStats.tier.label} ${sustainStats.tier.emoji}` : (score < 30 ? 'Sprout 🌱' : score < 60 ? 'Bloom 🌿' : score < 85 ? 'Grove 🌳' : 'Forest 🌲');
    return (
      <>
        <SubHeader title={<>Sustainability <span style={{fontStyle:'italic'}}>Score</span></>}/>
        <div style={{padding:'10px 20px 20px',textAlign:'center'}}>
          <div style={{position:'relative',width:180,height:180,margin:'10px auto 0'}}>
            <svg viewBox="0 0 180 180" style={{width:'100%',height:'100%',transform:'rotate(-90deg)'}}>
              <circle cx="90" cy="90" r="78" fill="none" stroke="#eae0cc" strokeWidth="10"/>
              <circle cx="90" cy="90" r="78" fill="none" stroke="var(--sage-deep)" strokeWidth="10" strokeDasharray={`${(score/100)*490} 490`} strokeLinecap="round"/>
            </svg>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%, -50%)',textAlign:'center'}}>
              <div style={{fontFamily:'Fraunces, serif',fontSize:48,fontWeight:600,lineHeight:1,color:'var(--ink)'}}>{score}</div>
              <div style={{fontSize:10,letterSpacing:2,textTransform:'uppercase',color:'var(--ink-soft)',marginTop:4}}>Eco Score</div>
            </div>
          </div>
          <div style={{fontFamily:'Fraunces, serif',fontSize:22,fontWeight:500,marginTop:14}}>{tier}</div>
          <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:4,padding:'0 20px',lineHeight:1.5}}>
            {totalImpact === 0 ? "Make your first thrift purchase to start growing." : `Through ${totalImpact} pre-loved item${totalImpact !== 1 ? 's' : ''}, you've kept fashion in the loop.`}
          </div>
        </div>

        <div style={{padding:'0 20px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'linear-gradient(135deg, #dce7d3 0%, #b8cdb0 100%)',borderRadius:16,padding:16,border:'1px solid #c8dcc4'}}>
            <div style={{fontSize:24,marginBottom:6}}>🌍</div>
            <div style={{fontFamily:'Fraunces, serif',fontSize:22,fontWeight:600,color:'var(--sage-deep)'}}>{co2Saved}<span style={{fontSize:12,marginLeft:2}}>kg</span></div>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'var(--sage-deep)',marginTop:2}}>CO₂ saved</div>
          </div>
          <div style={{background:'linear-gradient(135deg, #b8d6dc 0%, #7aa8b0 100%)',borderRadius:16,padding:16,border:'1px solid #b8d6dc'}}>
            <div style={{fontSize:24,marginBottom:6}}>💧</div>
            <div style={{fontFamily:'Fraunces, serif',fontSize:22,fontWeight:600,color:'var(--ocean,#1c4045)'}}>{(waterSaved/1000).toFixed(1)}<span style={{fontSize:12,marginLeft:2}}>kL</span></div>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'#1c4045',marginTop:2}}>Water saved</div>
          </div>
          <div style={{background:'var(--paper)',borderRadius:16,padding:16,border:'1px solid #eae0cc'}}>
            <div style={{fontSize:24,marginBottom:6}}>🛍️</div>
            <div style={{fontFamily:'Fraunces, serif',fontSize:22,fontWeight:600}}>{itemsBought}</div>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)',marginTop:2}}>Items thrifted</div>
          </div>
          <div style={{background:'var(--paper)',borderRadius:16,padding:16,border:'1px solid #eae0cc'}}>
            <div style={{fontSize:24,marginBottom:6}}>♻️</div>
            <div style={{fontFamily:'Fraunces, serif',fontSize:22,fontWeight:600}}>{itemsSold}</div>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)',marginTop:2}}>Items rehomed</div>
          </div>
        </div>

        {sustainStats?.breakdown && (
          <div style={{padding:'0 20px 16px'}}>
            <div style={{background:'var(--paper)',borderRadius:16,padding:14,border:'1px solid #eae0cc'}}>
              <div style={{fontFamily:'Fraunces, serif',fontSize:15,fontWeight:600,marginBottom:10}}>Points breakdown</div>
              {[
                { label: 'Purchases',  emoji: '🛍️', data: sustainStats.breakdown.purchases },
                { label: 'Sales',      emoji: '💚', data: sustainStats.breakdown.sales },
                { label: 'Listings',   emoji: '🏷️', data: sustainStats.breakdown.listings },
                { label: 'Lookbook posts', emoji: '✨', data: sustainStats.breakdown.posts },
              ].map(row => (
                <div key={row.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderTop:'1px solid #f0e6d0'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}><span style={{fontSize:14}}>{row.emoji}</span> {row.label} <span style={{color:'var(--ink-soft)',fontSize:11}}>×{row.data.count}</span></div>
                  <div style={{fontFamily:'Fraunces, serif',fontSize:14,fontWeight:600,color:'var(--sage-deep)'}}>+{row.data.points}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{padding:'0 20px 30px'}}>
          <div style={{background:'var(--cream)',borderRadius:16,padding:16,border:'1px solid #eae0cc'}}>
            <div style={{fontFamily:'Fraunces, serif',fontSize:15,fontWeight:600,marginBottom:8}}>How we calculate</div>
            <div style={{fontSize:12,color:'var(--ink-soft)',lineHeight:1.6}}>
              We estimate ~5.4 kg CO₂ and ~2,700 L of water saved per pre-loved garment vs buying new. Points: <strong>+12</strong> per purchase, <strong>+15</strong> per sale, <strong>+8</strong> per listing, <strong>+3</strong> per Lookbook post.
            </div>
          </div>
        </div>
      </>
    );
  };

  // ===== Privacy & Settings =====
  const renderSettings = () => {
    const Toggle = ({ on, onClick }) => (
      <button onClick={onClick} style={{width:42,height:24,borderRadius:12,background: on ? 'var(--terracotta)' : '#d6cab4',border:'none',position:'relative',cursor:'pointer',transition:'background 0.2s',padding:0}}>
        <div style={{position:'absolute',top:2,left: on ? 20 : 2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
      </button>
    );
    const setKey = (k) => {
      const next = { ...settings, [k]: !settings[k] };
      setSettings(next);
      if (getToken()) {
        api.updateSettings({ [k]: next[k] }).catch(e => pushToast(e.message, 'info'));
      }
    };
    const SettingRow = ({ icon, title, desc, k }) => (
      <div className="rv-menu-item" style={{cursor:'default'}}>
        <div className="rv-menu-icon">{icon}</div>
        <div style={{flex:1}}>
          <div className="rv-menu-text">{title}</div>
          {desc && <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:2}}>{desc}</div>}
        </div>
        <Toggle on={settings[k]} onClick={() => setKey(k)}/>
      </div>
    );
    return (
      <>
        <SubHeader title={<>Privacy & <span style={{fontStyle:'italic'}}>Settings</span></>}/>

        <div style={{padding:'14px 20px 6px',fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)',fontWeight:600}}>Notifications</div>
        <SettingRow icon={<MessageCircle size={16} strokeWidth={1.8}/>} title="Push notifications" desc="In-app toasts for cart, wishlist, orders" k="notifications"/>
        <SettingRow icon={<Sparkles size={16} strokeWidth={1.8}/>} title="Promotions & offers" desc="Sale alerts and curated picks" k="promotions"/>

        <div style={{padding:'18px 20px 6px',fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)',fontWeight:600}}>Privacy</div>
        <SettingRow icon={<Shield size={16} strokeWidth={1.8}/>} title="Private profile" desc="Hide your activity from non-followers" k="privateProfile"/>
        <SettingRow icon={<MapPin size={16} strokeWidth={1.8}/>} title="Show location" desc="Display your city on your profile" k="showLocation"/>

        <div style={{padding:'18px 20px 6px',fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)',fontWeight:600}}>Appearance</div>
        <SettingRow icon={<Sparkles size={16} strokeWidth={1.8}/>} title="Dark mode" desc="Switch to a moodier palette" k="darkMode"/>

        <div style={{padding:'18px 20px 6px',fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:'var(--ink-soft)',fontWeight:600}}>Account</div>
        <div className="rv-menu-item" onClick={openEditProfile}>
          <div className="rv-menu-icon"><User size={16} strokeWidth={1.8}/></div>
          <div className="rv-menu-text">Edit profile</div>
          <ChevronRight size={16} color="var(--ink-soft)"/>
        </div>
        <div className="rv-menu-item" onClick={async () => {
          const next = userRole === 'seller' ? 'buyer' : 'seller';
          setUserRole(next);
          pushToast(`Switched to ${next} mode`, 'success');
          if (getToken()) {
            try { await api.updateProfile({ role: next }); } catch (e) { pushToast(e.message, 'info'); }
          }
        }}>
          <div className="rv-menu-icon"><Package size={16} strokeWidth={1.8}/></div>
          <div style={{flex:1}}>
            <div className="rv-menu-text">Switch to {userRole === 'seller' ? 'buyer' : 'seller'} mode</div>
            <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:2}}>Currently: {userRole === 'seller' ? 'Seller' : 'Buyer'}</div>
          </div>
          <ChevronRight size={16} color="var(--ink-soft)"/>
        </div>

        <div style={{padding:'24px 20px 30px',textAlign:'center',fontSize:11,color:'var(--ink-soft)'}}>
          Revogue v1.0 · Made with care in India
        </div>
      </>
    );
  };

  const renderSell = () => {
    const draft = listingDraft;
    const setDraft = (patch) => setListingDraft({ ...draft, ...patch });
    const handleListingPhotos = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const remaining = 6 - draft.imgs.length;
      const toAdd = files.slice(0, remaining).filter(f => f.type.startsWith('image/'));
      if (!toAdd.length) return;
      // Keep a data-URL preview immediately, swap in the uploaded URL once done
      try {
        const previews = await Promise.all(toAdd.map(fileToDataUrl));
        const startIdx = draft.imgs.length;
        setDraft({ imgs: [...draft.imgs, ...previews] });
        if (getToken()) {
          try {
            const { files: uploaded } = await api.uploadImages(toAdd);
            setListingDraft(curr => {
              const next = [...curr.imgs];
              uploaded.forEach((u, i) => { next[startIdx + i] = u.url; });
              return { ...curr, imgs: next };
            });
          } catch (e) {
            pushToast(e.message || 'Upload failed — using local preview', 'info');
          }
        }
      } catch { alert('Could not read one or more images'); }
    };
    const removePhoto = (i) => setDraft({ imgs: draft.imgs.filter((_, idx) => idx !== i) });
    const publish = async () => {
      // Validation
      if (!draft.imgs.length) { setListingError('Add at least one photo'); return; }
      if (!draft.title.trim()) { setListingError('Title is required'); return; }
      if (!draft.brand.trim()) { setListingError('Brand is required'); return; }
      if (!draft.price || Number(draft.price) <= 0) { setListingError('Enter a valid price'); return; }
      if (!draft.originalPrice || Number(draft.originalPrice) < Number(draft.price)) { setListingError('MRP must be higher than your price'); return; }
      if (!draft.category) { setListingError('Pick a category'); return; }
      if (!draft.condition) { setListingError('Pick a condition'); return; }
      setListingError('');
      const payload = {
        title: draft.title.trim(),
        brand: draft.brand.trim(),
        price: Number(draft.price),
        originalPrice: Number(draft.originalPrice),
        condition: draft.condition,
        size: draft.size || 'M',
        category: draft.category,
        gender: draft.gender,
        // Only send hosted URLs to the server; drop any leftover data URLs
        images: draft.imgs.filter(u => typeof u === 'string' && !u.startsWith('data:')),
        tags: draft.tags.length ? draft.tags : ['New'],
        description: draft.description.trim(),
      };
      const isEdit = !!editingListingId;
      if (!getToken()) {
        if (isEdit) {
          setUserListings(prev => prev.map(x => x.id === editingListingId ? { ...x, ...payload, img: draft.imgs[0], imgs: draft.imgs } : x));
        } else {
          // Offline fallback — keep the original local-only listing
          setUserListings(prev => [{
            ...payload,
            id: Date.now(),
            img: draft.imgs[0],
            imgs: draft.imgs,
            seller: (userName || 'me').toLowerCase().replace(/\s/g, '_'),
            sellerRating: 5.0,
            likes: 0,
            isMine: true,
          }, ...prev]);
        }
      } else {
        // Refuse to publish if any photo is still uploading (data URL preview)
        const stillUploading = draft.imgs.some(u => typeof u === 'string' && u.startsWith('data:'));
        if (stillUploading) {
          setListingError('Photos are still uploading — please wait a moment.');
          return;
        }
        if (!payload.images.length) {
          setListingError('Photos are still uploading — please wait a moment.');
          return;
        }
        try {
          if (isEdit && typeof editingListingId === 'string') {
            const updated = await api.updateProduct(editingListingId, payload);
            const norm = { ...normalizeProduct(updated), isMine: true };
            setUserListings(prev => prev.map(x => x.id === editingListingId ? norm : x));
            setRemoteProducts(prev => prev.map(x => x.id === editingListingId ? norm : x));
          } else {
            const created = await api.createProduct(payload);
            setUserListings(prev => [{ ...normalizeProduct(created), isMine: true }, ...prev]);
            // Also surface it in the public catalog immediately
            setRemoteProducts(prev => [normalizeProduct(created), ...prev]);
          }
        } catch (e) {
          setListingError(e.message || (isEdit ? 'Could not update' : 'Could not publish'));
          return;
        }
      }
      pushToast(isEdit ? '✓ Listing updated!' : '✨ Your listing is live!', 'success');
      setListingDraft(emptyListing);
      setEditingListingId(null);
      // Clear any active filters so the new listing is visible immediately on home
      setSearchQuery('');
      setSelectedGender('All');
      setSelectedVibe(null);
      setSelectedCategory(null);
      setActiveTab(isEdit ? 'profile' : 'home');
      setScreen(isEdit ? 'my-listings' : 'app');
    };
    return (
      <>
        <div className="rv-header">
          <button className="rv-icon-btn" onClick={() => {
            // Cancel = drop draft + edit mode, go back where they came from
            const wasEditing = !!editingListingId;
            setListingDraft(emptyListing);
            setEditingListingId(null);
            setListingError('');
            if (wasEditing) { setScreen('my-listings'); } else { setActiveTab('home'); setScreen('app'); }
          }}><ArrowLeft size={16} strokeWidth={1.8}/></button>
          <div className="rv-logo rv-serif">{editingListingId ? <>Edit <span style={{fontStyle:'italic'}}>listing</span></> : <>List an <span style={{fontStyle:'italic'}}>item</span></>}</div>
          <div style={{width:38}}/>
        </div>
        <div style={{padding:'4px 20px 14px',fontSize:12,color:'var(--ink-soft)',fontStyle:'italic'}}>{editingListingId ? 'Update the details below — changes go live instantly.' : 'Give it a second life. Set your price in ₹.'}</div>

        {draft.imgs.length === 0 ? (
          <label style={{display:'block',cursor:'pointer'}}>
            <div className="rv-sell-upload">
              <Camera size={28} strokeWidth={1.5}/>
              <div style={{fontSize:13,fontWeight:500}}>Add photos</div>
              <div style={{fontSize:10,letterSpacing:1,textTransform:'uppercase'}}>Up to 6 · well-lit & honest</div>
            </div>
            <input type="file" accept="image/*" multiple onChange={handleListingPhotos} style={{display:'none'}}/>
          </label>
        ) : (
          <div style={{padding:'0 20px 14px'}}>
            <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
              {draft.imgs.map((src, i) => (
                <div key={i} style={{flex:'0 0 auto',width:90,height:110,borderRadius:12,overflow:'hidden',position:'relative',border:'1px solid #eae0cc'}}>
                  <img src={src} alt={`photo-${i+1}`} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <button onClick={() => removePhoto(i)} style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'rgba(26,20,16,0.8)',color:'white',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}><X size={12}/></button>
                  {i === 0 && <div style={{position:'absolute',bottom:4,left:4,padding:'2px 6px',background:'rgba(250,246,237,0.95)',borderRadius:6,fontSize:8,fontWeight:600,letterSpacing:0.5}}>COVER</div>}
                </div>
              ))}
              {draft.imgs.length < 6 && (
                <label style={{cursor:'pointer'}}>
                  <div style={{width:90,height:110,borderRadius:12,border:'2px dashed #d6cab4',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,color:'var(--ink-soft)',background:'var(--cream)'}}>
                    <Plus size={20} strokeWidth={1.5}/>
                    <div style={{fontSize:9,letterSpacing:1,textTransform:'uppercase'}}>{draft.imgs.length}/6</div>
                  </div>
                  <input type="file" accept="image/*" multiple onChange={handleListingPhotos} style={{display:'none'}}/>
                </label>
              )}
            </div>
          </div>
        )}

        <div className="rv-field">
          <div className="rv-label">Title</div>
          <input className="rv-input" placeholder="e.g. Vintage Linen Midi Dress" value={draft.title} onChange={e => setDraft({ title: e.target.value })}/>
        </div>
        <div className="rv-field">
          <div className="rv-label">Brand</div>
          <input className="rv-input" placeholder="e.g. Fabindia" value={draft.brand} onChange={e => setDraft({ brand: e.target.value })}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px 14px'}}>
          <div>
            <div className="rv-label">Your price (₹)</div>
            <input className="rv-input" placeholder="1299" type="number" value={draft.price} onChange={e => setDraft({ price: e.target.value })} style={{marginBottom:0}}/>
          </div>
          <div>
            <div className="rv-label">MRP (₹)</div>
            <input className="rv-input" placeholder="4500" type="number" value={draft.originalPrice} onChange={e => setDraft({ originalPrice: e.target.value })} style={{marginBottom:0}}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px 14px'}}>
          <div>
            <div className="rv-label">Size</div>
            <input className="rv-input" placeholder="M, 30, 9..." value={draft.size} onChange={e => setDraft({ size: e.target.value })} style={{marginBottom:0}}/>
          </div>
          <div>
            <div className="rv-label">For</div>
            <select className="rv-input" value={draft.gender} onChange={e => setDraft({ gender: e.target.value })} style={{marginBottom:0,appearance:'none',paddingRight:32,backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235a4f42\' stroke-width=\'2\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center'}}>
              <option>Women</option>
              <option>Men</option>
              <option>Unisex</option>
            </select>
          </div>
        </div>
        <div className="rv-field">
          <div className="rv-label">Category</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {CATEGORIES.map(c => (
              <button key={c.name} onClick={() => setDraft({ category: c.name })} style={{padding:'8px 14px',borderRadius:18,border: draft.category === c.name ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: draft.category === c.name ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: draft.category === c.name ? 'var(--terracotta)' : 'var(--ink)',fontWeight: draft.category === c.name ? 600 : 400}}>{c.emoji} {c.name}</button>
            ))}
          </div>
        </div>
        <div className="rv-field">
          <div className="rv-label">Condition</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {['Like New','Excellent','Good','Fair'].map(c => (
              <button key={c} onClick={() => setDraft({ condition: c })} style={{padding:'8px 14px',borderRadius:18,border: draft.condition === c ? '1.5px solid var(--terracotta)' : '1px solid #d6cab4',background: draft.condition === c ? '#faf2e8' : 'var(--paper)',fontSize:12,cursor:'pointer',fontFamily:'inherit',color: draft.condition === c ? 'var(--terracotta)' : 'var(--ink)',fontWeight: draft.condition === c ? 600 : 400}}>{c}</button>
            ))}
          </div>
        </div>
        <div className="rv-field">
          <div className="rv-label">Vibe tags</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {VIBES.map(v => {
              const isOn = draft.tags.includes(v.name);
              return (
                <button key={v.id} onClick={() => setDraft({ tags: isOn ? draft.tags.filter(t => t !== v.name) : [...draft.tags, v.name] })} style={{padding:'6px 12px',borderRadius:16,background: isOn ? v.color : 'var(--paper)',border: isOn ? '1.5px solid var(--ink)' : '1px solid #d6cab4',fontSize:11,fontWeight: isOn ? 600 : 500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>{v.emoji} {v.name}</button>
              );
            })}
          </div>
        </div>
        <div className="rv-field">
          <div className="rv-label">Description</div>
          <textarea className="rv-input" placeholder="Share the story — where it's from, why you loved it, any small flaws." rows={4} value={draft.description} onChange={e => setDraft({ description: e.target.value })} style={{resize:'none',fontFamily:'inherit'}}/>
        </div>
        {listingError && <div style={{padding:'0 20px 10px',fontSize:12,color:'#c94848'}}>⚠ {listingError}</div>}
        <div style={{padding:'0 20px 30px'}}>
          <button className="rv-btn-primary" onClick={publish}>{editingListingId ? 'Save changes' : 'Publish listing'}</button>
        </div>
      </>
    );
  };

  const renderPostStyle = () => {
    const handlePhoto = async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      try {
        const preview = await fileToDataUrl(file);
        setListingDraft(d => ({ ...d, postImg: preview, postFile: file }));
      } catch { pushToast('Could not read image', 'info'); }
    };
    const publishPost = async () => {
      const draft = listingDraft;
      if (!draft.postImg) { pushToast('Add a photo first', 'info'); return; }
      if (!getToken()) {
        pushToast('Sign in to post', 'info');
        return;
      }
      const isEdit = !!editingPostId;
      try {
        let imageUrl = draft.postImg;
        // If user picked a new file (even when editing), upload it
        if (draft.postFile) {
          const { url } = await api.uploadImage(draft.postFile);
          imageUrl = url;
        }
        // If editing and the image is still a data URL with no postFile (unchanged), keep it
        // Otherwise we must have a real http(s) URL to send to the backend
        if (typeof imageUrl !== 'string' || imageUrl.startsWith('data:')) {
          pushToast('Photo is still uploading — try again in a moment', 'info');
          return;
        }
        const body = {
          image: imageUrl,
          caption: draft.description || '',
          tags: draft.tags || [],
          products: (draft.taggedProducts || []).filter(id => typeof id === 'string'),
        };
        if (isEdit && typeof editingPostId === 'string') {
          const updated = await api.updatePost(editingPostId, body);
          const norm = normalizePost(updated);
          setRemotePosts(prev => prev.map(p => p.id === editingPostId ? norm : p));
          pushToast('✓ Post updated', 'success');
        } else {
          const created = await api.createPost(body);
          setRemotePosts(prev => [normalizePost(created), ...prev]);
          pushToast('✨ Posted to Lookbook!', 'success');
        }
        setListingDraft(emptyListing);
        setEditingPostId(null);
        setActiveTab('style');
        setScreen('app');  // CRITICAL — was missing, kept user stuck on post-style screen
      } catch (e) {
        pushToast(e.message || (isEdit ? 'Could not update' : 'Could not post'), 'info');
      }
    };
    return (
    <>
      <div className="rv-header">
        <button className="rv-icon-btn" onClick={() => {
          setListingDraft(emptyListing);
          setEditingPostId(null);
          setActiveTab('style');
          setScreen('app');  // CRITICAL — back button was leaving screen='post-style' so nothing changed
        }}><ArrowLeft size={16} strokeWidth={1.8}/></button>
        <div className="rv-logo rv-serif">{editingPostId ? <>Edit your <span style={{fontStyle:'italic'}}>post</span></> : <>Share your <span style={{fontStyle:'italic'}}>fit</span></>}</div>
        <div style={{width:38}}/>
      </div>
      {listingDraft.postImg ? (
        <div style={{padding:'0 20px 14px',position:'relative'}}>
          <div style={{aspectRatio:'1',borderRadius:20,overflow:'hidden',background:'var(--cream)',border:'1px solid #eae0cc'}}>
            <img src={listingDraft.postImg} alt="preview" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <button onClick={() => setListingDraft(d => ({ ...d, postImg: null, postFile: null }))} style={{position:'absolute',top:8,right:28,padding:'6px 10px',background:'rgba(26,20,16,0.8)',color:'white',border:'none',borderRadius:14,fontSize:11,cursor:'pointer'}}>Change</button>
        </div>
      ) : (
        <label style={{display:'block',cursor:'pointer'}}>
          <div className="rv-sell-upload" style={{aspectRatio:'1'}}>
            <Camera size={28} strokeWidth={1.5}/>
            <div style={{fontSize:13,fontWeight:500}}>Add a photo</div>
            <div style={{fontSize:10,letterSpacing:1,textTransform:'uppercase'}}>Show off the styling</div>
          </div>
          <input type="file" accept="image/*" onChange={handlePhoto} style={{display:'none'}}/>
        </label>
      )}
      <div className="rv-field">
        <div className="rv-label">Caption</div>
        <textarea className="rv-input" placeholder="What's the story behind this fit?" rows={3} value={listingDraft.description || ''} onChange={e => setListingDraft(d => ({ ...d, description: e.target.value }))} style={{resize:'none',fontFamily:'inherit'}}/>
      </div>
      <div className="rv-field">
        <div className="rv-label">Vibe tags</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {VIBES.map(v => {
            const isOn = (listingDraft.tags || []).includes(v.name);
            return (
              <button key={v.id} onClick={() => setListingDraft(d => ({ ...d, tags: isOn ? (d.tags || []).filter(t => t !== v.name) : [...(d.tags || []), v.name] }))} style={{padding:'6px 12px',borderRadius:16,background: isOn ? v.color : 'var(--paper)',border: isOn ? '1.5px solid var(--ink)' : '1px solid #d6cab4',fontSize:11,fontWeight: isOn ? 600 : 500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>{v.emoji} {v.name}</button>
            );
          })}
        </div>
      </div>
      <div style={{padding:'10px 20px 30px'}}>
        <button className="rv-btn-primary" onClick={publishPost}>{editingPostId ? 'Save changes' : 'Post to Lookbook'}</button>
      </div>
    </>
    );
  };

  const renderPayment = () => (
    <>
      <div className="rv-header">
        <button className="rv-icon-btn" onClick={() => setScreen('app')}><ArrowLeft size={16} strokeWidth={1.8}/></button>
        <div className="rv-logo rv-serif">Checkout</div>
        <div style={{width:38}}/>
      </div>

      <div className="rv-pay-section">
        <div className="rv-pay-label">Deliver to</div>
        <div style={{padding:14,background:'var(--paper)',border:'1px solid #e0d5c0',borderRadius:14,display:'flex',gap:12,alignItems:'flex-start'}}>
          <MapPin size={16} color="var(--terracotta)" strokeWidth={1.8} style={{marginTop:2,flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:500,fontSize:13}}>{userName || 'You'} · Home</div>
            <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:2,lineHeight:1.5}}>2nd Cross Rd, Indiranagar,<br/>Bengaluru, Karnataka 560038</div>
            <button style={{marginTop:6,padding:0,background:'none',border:'none',color:'var(--terracotta)',fontSize:11,fontWeight:500,cursor:'pointer'}}>Change →</button>
          </div>
        </div>
      </div>

      <div className="rv-pay-section">
        <div className="rv-pay-label">Payment method</div>
        {[
          { id: 'upi', icon: '📱', name: 'UPI', desc: 'Pay via GPay, PhonePe, Paytm' },
          { id: 'card', icon: '💳', name: 'Credit / Debit Card', desc: 'Visa, Mastercard, Rupay' },
          { id: 'netbanking', icon: '🏦', name: 'Net Banking', desc: 'All major Indian banks' },
          { id: 'cod', icon: '💵', name: 'Cash on Delivery', desc: '+ ₹30 handling charge' },
        ].map(m => (
          <div key={m.id} className={`rv-pay-option ${paymentMethod === m.id ? 'active' : ''}`} onClick={() => setPaymentMethod(m.id)}>
            <div className={`rv-pay-radio ${paymentMethod === m.id ? 'active' : ''}`}>{paymentMethod === m.id && <div className="rv-pay-radio-dot"/>}</div>
            <div style={{fontSize:22}}>{m.icon}</div>
            <div style={{flex:1}}>
              <div className="rv-pay-method-name">{m.name}</div>
              <div className="rv-pay-method-desc">{m.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {paymentMethod === 'upi' && (
        <div className="rv-pay-section">
          <div className="rv-pay-label">UPI ID</div>
          <input className="rv-input" placeholder="yourname@okhdfcbank" style={{marginBottom:0}}/>
        </div>
      )}
      {paymentMethod === 'card' && (
        <div className="rv-pay-section">
          <div className="rv-pay-label">Card details</div>
          <input className="rv-input" placeholder="Card number"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <input className="rv-input" placeholder="MM / YY" style={{marginBottom:0}}/>
            <input className="rv-input" placeholder="CVV" style={{marginBottom:0}}/>
          </div>
        </div>
      )}

      <div className="rv-summary" style={{marginBottom:10}}>
        <div className="rv-summary-row"><span>Items ({cart.length})</span><span>₹{cartTotal}</span></div>
        <div className="rv-summary-row"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : `₹${shipping}`}</span></div>
        <div className="rv-summary-row"><span>Platform fee</span><span>₹{platformFee}</span></div>
        {paymentMethod === 'cod' && <div className="rv-summary-row"><span>COD charge</span><span>₹30</span></div>}
        <div className="rv-summary-row total"><span className="rv-serif">Total</span><span className="rv-serif">₹{grandTotal + (paymentMethod === 'cod' ? 30 : 0)}</span></div>
      </div>

      <div style={{padding:'8px 20px',display:'flex',gap:8,alignItems:'center',fontSize:11,color:'var(--ink-soft)'}}>
        <Shield size={12} strokeWidth={1.8}/> <span>100% safe & encrypted payments</span>
      </div>

      <div style={{padding:'10px 20px 30px'}}>
        <button className="rv-btn-primary" onClick={async () => {
          if (!cart.length) { pushToast('Your bag is empty', 'info'); return; }
          const total = grandTotal + (paymentMethod === 'cod' ? 30 : 0);
          if (!getToken()) {
            // Offline fallback: synthetic order
            const orderNum = 'RVG' + Math.floor(Math.random() * 900000 + 100000);
            setOrders(prev => [{ id: orderNum, num: orderNum, total, items: [...cart], placedAt: new Date().toISOString(), status: 'Placed' }, ...prev]);
            setOrderConfirmed({ num: orderNum, total, items: cart.length });
            setCart([]);
            setScreen('confirm');
            return;
          }
          try {
            const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
            const shippingAddress = defaultAddr ? {
              label: defaultAddr.label, name: defaultAddr.name, line1: defaultAddr.line1, line2: defaultAddr.line2 || '',
              city: defaultAddr.city, state: defaultAddr.state, pin: defaultAddr.pin,
              phone: defaultAddr.phone || '', country: defaultAddr.country || 'India',
            } : {
              label: 'Home', name: userName || 'You', line1: '2nd Cross Rd, Indiranagar',
              city: 'Bengaluru', state: 'Karnataka', pin: '560038', phone: '+91 98XXX XXXXX',
            };
            const order = await api.createOrder({
              shippingAddress,
              paymentMethod: { type: paymentMethod, label: paymentMethod.toUpperCase() },
            });
            const norm = normalizeOrder(order);
            setOrders(prev => [norm, ...prev]);
            setOrderConfirmed({ num: norm.num, total: norm.total, items: norm.items.length });
            setCart([]);
            pushToast(`Order ${norm.num} placed`, 'success');
            // Refresh catalog so sold items disappear from search
            loadCatalog();
            // Refresh my-listings (in case a seller bought their own item — edge case but clean)
            api.listProducts({ mine: 'true', limit: 50 }).then(r => {
              setUserListings((r.items || []).map(p => normalizeProduct(p)).filter(Boolean).map(p => ({ ...p, isMine: true })));
            }).catch(() => {});
            // Refresh sustainability stats
            api.getSustainability().then(setSustainStats).catch(() => {});
            setScreen('confirm');
          } catch (e) {
            pushToast(e.message || 'Could not place order', 'info');
          }
        }}>Pay ₹{grandTotal + (paymentMethod === 'cod' ? 30 : 0)}</button>
      </div>
    </>
  );

  const renderConfirm = () => (
    <div className="rv-confirm">
      <div className="rv-confirm-icon"><Check size={44} strokeWidth={2.5}/></div>
      <div className="rv-confirm-title rv-serif">Order placed!</div>
      <div className="rv-confirm-text">Thank you for shopping consciously. Your thrifted treasures are being carefully packed.</div>
      <div className="rv-confirm-order">
        <div className="rv-confirm-order-label">Order number</div>
        <div className="rv-confirm-order-num rv-serif">{orderConfirmed?.num}</div>
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'center',fontSize:12,color:'var(--ink-soft)',marginBottom:30}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}><Truck size={14} strokeWidth={1.8}/> 3-5 days</div>
        <span>·</span>
        <div style={{display:'flex',alignItems:'center',gap:4}}><Package size={14} strokeWidth={1.8}/> {orderConfirmed?.items} items</div>
      </div>
      <button style={{padding:'14px 30px',background:'var(--ink)',color:'var(--paper)',border:'none',borderRadius:14,fontFamily:'inherit',fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',fontWeight:500}} onClick={() => { setScreen('app'); setActiveTab('home'); setOrderConfirmed(null); }}>Keep shopping →</button>
    </div>
  );

  const renderDetail = () => {
    if (!selectedProduct) return null;
    const p = selectedProduct;
    const inCart = cart.find(c => c.id === p.id);
    const discount = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
    return (
      <>
        <button className="rv-detail-back" onClick={() => setScreen('app')}><ArrowLeft size={18} strokeWidth={2}/></button>
        <button className="rv-detail-share" onClick={async () => {
          const url = `${window.location.origin}/?product=${p.id}`;
          const text = `Look what I found on Revogue ✨\n${p.title} by ${p.brand} · ₹${p.price} (was ₹${p.originalPrice})\n${url}`;
          if (navigator.share) {
            try { await navigator.share({ title: p.title, text, url }); return; } catch { return; }
          }
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }}><Share2 size={16} strokeWidth={1.8}/></button>
        <div className="rv-detail-img" onClick={() => setLightboxImage(p.img)} style={{cursor:'zoom-in'}}>
          <img src={p.img} alt={p.title} onError={(e) => handleImgError(e, p)}/>
        </div>
        <div className="rv-detail-body">
          <div className="rv-detail-meta">
            <div>
              <div className="rv-detail-brand">{p.brand}</div>
              <div className="rv-detail-title rv-serif">{p.title}</div>
            </div>
          </div>
          <div className="rv-detail-price-row">
            <span className="rv-detail-price rv-serif">₹{p.price}</span>
            <span className="rv-detail-original">₹{p.originalPrice}</span>
            <span className="rv-detail-discount">{discount}% OFF</span>
          </div>

          <div className="rv-spec-row">
            <div className="rv-spec">
              <div className="rv-spec-label">Condition</div>
              <div className="rv-spec-val rv-serif">{p.condition}</div>
            </div>
            <div className="rv-spec">
              <div className="rv-spec-label">Size</div>
              <div className="rv-spec-val rv-serif">{p.size}</div>
            </div>
            <div className="rv-spec">
              <div className="rv-spec-label">Category</div>
              <div className="rv-spec-val rv-serif">{p.category}</div>
            </div>
            <div className="rv-spec">
              <div className="rv-spec-label">For</div>
              <div className="rv-spec-val rv-serif">{p.gender}</div>
            </div>
          </div>

          <div className="rv-seller-card">
            <div className="rv-seller-avatar">{(p.seller || 'S')[0].toUpperCase()}</div>
            <div className="rv-seller-info">
              <div className="rv-seller-name">@{p.seller}</div>
              <div className="rv-seller-rating"><Star size={11} fill="var(--gold)" color="var(--gold)" strokeWidth={0}/> {p.sellerRating} · Verified seller</div>
            </div>
          </div>

          <div className="rv-desc-title rv-serif">The story</div>
          <div className="rv-desc-text">
            A thoughtfully pre-loved piece from {p.brand}. Worn occasionally, kept with care. Every thread still has life. Perfect for anyone looking to curate a closet with character — not quantity.
          </div>

          <div className="rv-desc-title rv-serif">Tags</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:20}}>
            {p.tags.map(t => <span key={t} style={{padding:'6px 12px',background:'var(--cream)',borderRadius:14,fontSize:11,border:'1px solid #eae0cc'}}>#{t}</span>)}
          </div>

          <div style={{display:'flex',gap:10,padding:'14px 0',borderTop:'1px solid #eae0cc',borderBottom:'1px solid #eae0cc',marginBottom:8}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <Truck size={18} color="var(--sage-deep)" strokeWidth={1.5}/>
              <div style={{fontSize:10,color:'var(--ink-soft)',textAlign:'center'}}>Free shipping<br/>over ₹999</div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <Shield size={18} color="var(--sage-deep)" strokeWidth={1.5}/>
              <div style={{fontSize:10,color:'var(--ink-soft)',textAlign:'center'}}>Quality<br/>verified</div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <Zap size={18} color="var(--sage-deep)" strokeWidth={1.5}/>
              <div style={{fontSize:10,color:'var(--ink-soft)',textAlign:'center'}}>Easy 3-day<br/>returns</div>
            </div>
          </div>
          <div style={{height:80}}/>
        </div>

        <div className="rv-detail-actions">
          <button className={`rv-btn-wish ${wishlist.includes(p.id) ? 'active' : ''}`} onClick={() => toggleWishlist(p.id)}>
            <Heart size={18} fill={wishlist.includes(p.id) ? 'white' : 'none'} strokeWidth={2}/>
          </button>
          <button className={`rv-btn-bag ${inCart ? 'in-cart' : ''}`} onClick={() => { if (!inCart) addToCart(p); setScreen('app'); setActiveTab('bag'); }}>
            {inCart ? '✓ In your bag · View' : `Add to bag · ₹${p.price}`}
          </button>
        </div>
      </>
    );
  };

  // ============ RENDER ============
  let content;
  if (screen === 'detail') content = renderDetail();
  else if (screen === 'payment') content = renderPayment();
  else if (screen === 'confirm') content = renderConfirm();
  else if (screen === 'post-style') content = renderPostStyle();
  else if (screen === 'edit-profile') content = renderEditProfile();
  else if (screen === 'my-listings') content = renderMyListings();
  else if (screen === 'public-profile') content = renderPublicProfile();
  else if (screen === 'my-looks') content = renderMyLooks();
  else if (screen === 'saved-looks') content = renderSavedLooks();
  else if (screen === 'my-orders') content = renderMyOrders();
  else if (screen === 'addresses') content = renderAddresses();
  else if (screen === 'payment-methods') content = renderPaymentMethods();
  else if (screen === 'sustainability') content = renderSustainability();
  else if (screen === 'settings') content = renderSettings();
  else if (activeTab === 'home') content = renderHome();
  else if (activeTab === 'search') content = renderSearch();
  else if (activeTab === 'sell') content = renderSell();
  else if (activeTab === 'style') content = renderStyleFeed();
  else if (activeTab === 'profile') content = renderProfile();
  else if (activeTab === 'wishlist') content = renderWishlist();
  else if (activeTab === 'bag') content = renderBag();

  const subPages = ['confirm', 'edit-profile', 'my-listings', 'my-orders', 'addresses', 'payment-methods', 'sustainability', 'settings', 'public-profile', 'saved-looks', 'my-looks'];
  const showTabBar = !subPages.includes(screen);

  return (
    <div className="revogue-root" style={themeVars}>
      <style>{styles}</style>
      <div className="rv-screen-wrap">
        <div className="rv-phone">
          <div className="rv-paper-texture" />
          <div className="rv-content">{content}</div>

          {/* Toast notifications */}
          {toasts.length > 0 && (
            <div className="rv-toast-stack">
              {toasts.map(t => (
                <div key={t.id} className={`rv-toast rv-toast-${t.kind}`}>
                  {t.kind === 'success' && <Check size={14} strokeWidth={2.5}/>}
                  {t.kind === 'info' && <span style={{fontSize:14,lineHeight:1}}>•</span>}
                  <span>{t.msg}</span>
                </div>
              ))}
            </div>
          )}
          {lightboxImage && (
            <div onClick={() => setLightboxImage(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out',animation:'rvFadeIn 0.2s ease'}}>
              <button onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.15)',border:'none',color:'white',width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',backdropFilter:'blur(8px)'}}>
                <X size={20}/>
              </button>
              <img src={lightboxImage} alt="" style={{maxWidth:'94%',maxHeight:'90%',objectFit:'contain',borderRadius:8,boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}}/>
            </div>
          )}
          {showTabBar && (
            <div className="rv-tab">
              <button className={`rv-tab-btn ${activeTab === 'home' && screen === 'app' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setScreen('app'); }}>
                <Home size={20} strokeWidth={1.8} fill={activeTab === 'home' ? 'currentColor' : 'none'}/>
                <span>Home</span>
              </button>
              <button className={`rv-tab-btn ${activeTab === 'search' && screen === 'app' ? 'active' : ''}`} onClick={() => { setActiveTab('search'); setScreen('app'); }}>
                <Search size={20} strokeWidth={1.8}/>
                <span>Search</span>
              </button>
              <button className="rv-tab-sell" onClick={() => { setActiveTab('sell'); setScreen('app'); }}>
                <Plus size={22} strokeWidth={2.2}/>
              </button>
              <button className={`rv-tab-btn ${activeTab === 'style' && screen === 'app' ? 'active' : ''}`} onClick={() => { setActiveTab('style'); setScreen('app'); }}>
                <Sparkles size={20} strokeWidth={1.8}/>
                <span>Lookbook</span>
              </button>
              <button className={`rv-tab-btn ${activeTab === 'profile' && screen === 'app' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setScreen('app'); }}>
                <User size={20} strokeWidth={1.8}/>
                <span>Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
