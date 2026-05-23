// End-to-end smoke test for every API endpoint.
// Assumes the backend is running on http://localhost:5000 with the seeded demo data.

const BASE = 'http://localhost:5000';

let pass = 0;
let fail = 0;
const failures = [];

function log(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; failures.push(`${name} — ${detail}`); console.log(`  ✗ ${name}  ${detail}`); }
}

async function req(method, path, { body, token, isForm } = {}) {
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  console.log('\n=== HEALTH & META ===');
  let r = await req('GET', '/api/health');
  log('GET /api/health', r.ok && r.data.ok === true);

  r = await req('GET', '/api/products/meta');
  log('GET /api/products/meta', r.ok && Array.isArray(r.data.categories) && r.data.categories.length === 6);

  console.log('\n=== PRODUCTS (anonymous) ===');
  r = await req('GET', '/api/products?limit=10');
  const products = r.data.items || [];
  log('GET /api/products', r.ok && products.length > 0, `got ${products.length} items`);

  r = await req('GET', '/api/products?category=Tops');
  log('GET /api/products?category=Tops', r.ok && r.data.items.every(p => p.category === 'Tops'));

  r = await req('GET', '/api/products?gender=Women');
  log('GET /api/products?gender=Women', r.ok && r.data.items.every(p => ['Women', 'Unisex'].includes(p.gender)));

  r = await req('GET', '/api/products?vibe=Cottagecore');
  log('GET /api/products?vibe=Cottagecore', r.ok && r.data.items.every(p => p.tags.includes('Cottagecore')));

  r = await req('GET', '/api/products?q=denim');
  log('GET /api/products?q=denim', r.ok && r.data.items.length > 0);

  r = await req('GET', '/api/products?sort=price-low&limit=5');
  const prices = r.data.items.map(p => p.price);
  log('GET /api/products?sort=price-low', r.ok && prices.every((v, i) => i === 0 || v >= prices[i-1]));

  r = await req('GET', `/api/products/${products[0]._id}`);
  log('GET /api/products/:id', r.ok && r.data._id === products[0]._id);

  r = await req('GET', '/api/products/invalidid');
  log('GET /api/products/:id (400 invalid)', r.status === 400);

  r = await req('GET', '/api/products/507f1f77bcf86cd799439011');
  log('GET /api/products/:id (404 not found)', r.status === 404);

  console.log('\n=== AUTH ===');
  r = await req('POST', '/api/auth/signin', { body: { contact: 'demo@revogue.io', password: 'wrong' } });
  log('POST /api/auth/signin (bad password → 401)', r.status === 401);

  r = await req('POST', '/api/auth/signin', { body: { contact: 'demo@revogue.io', password: 'password123' } });
  log('POST /api/auth/signin (demo buyer)', r.ok && r.data.token && r.data.user.email === 'demo@revogue.io');
  const token = r.data.token;

  r = await req('GET', '/api/auth/me', { token });
  log('GET /api/auth/me', r.ok && r.data.user.email === 'demo@revogue.io');

  r = await req('GET', '/api/auth/me');
  log('GET /api/auth/me (no token → 401)', r.status === 401);

  // Brand new signup
  const newEmail = `qa+${Date.now()}@revogue.test`;
  r = await req('POST', '/api/auth/signup', {
    body: { name: 'QA User', contact: newEmail, password: 'qatest123' },
  });
  log('POST /api/auth/signup (new user)', r.ok && r.data.token);
  const qaToken = r.data.token;

  r = await req('POST', '/api/auth/signup', {
    body: { name: 'Dup', contact: newEmail, password: 'qatest123' },
  });
  log('POST /api/auth/signup (duplicate → 409)', r.status === 409);

  r = await req('POST', '/api/auth/signup', { body: { name: 'Bad', contact: 'notanemail', password: 'qatest123' } });
  log('POST /api/auth/signup (invalid email → 400)', r.status === 400);

  r = await req('POST', '/api/auth/signup', { body: { name: 'Short', contact: `qa2+${Date.now()}@x.io`, password: '123' } });
  log('POST /api/auth/signup (short password → 400)', r.status === 400);

  console.log('\n=== USER PROFILE ===');
  r = await req('PATCH', '/api/users/me', { token: qaToken, body: { profile: { bio: 'Updated bio', location: 'Mumbai' } } });
  log('PATCH /api/users/me (update profile)', r.ok && r.data.user.profile.bio === 'Updated bio');

  r = await req('PATCH', '/api/users/me/settings', { token: qaToken, body: { darkMode: true, promotions: true } });
  log('PATCH /api/users/me/settings', r.ok && r.data.settings.darkMode === true);

  r = await req('PATCH', '/api/users/me/avatar', { token: qaToken, body: { avatarColor: 'sage' } });
  log('PATCH /api/users/me/avatar', r.ok && r.data.profile.avatarColor === 'sage');

  console.log('\n=== WISHLIST ===');
  const productId = products[0]._id;
  r = await req('POST', `/api/wishlist/${productId}`, { token });
  log('POST /api/wishlist/:id', r.ok && r.data.items.some(p => p._id === productId));

  r = await req('POST', `/api/wishlist/${productId}`, { token });
  log('POST /api/wishlist/:id (duplicate is no-op)', r.ok && r.data.items.filter(p => p._id === productId).length === 1);

  r = await req('GET', '/api/wishlist', { token });
  log('GET /api/wishlist', r.ok && r.data.items.length === 1);

  r = await req('DELETE', `/api/wishlist/${productId}`, { token });
  log('DELETE /api/wishlist/:id', r.ok && r.data.items.length === 0);

  console.log('\n=== CART ===');
  r = await req('POST', '/api/cart', { token, body: { productId, qty: 1 } });
  log('POST /api/cart', r.ok && r.data.items.length === 1 && r.data.subtotal === products[0].price);

  r = await req('PATCH', `/api/cart/${productId}`, { token, body: { qty: 2 } });
  log('PATCH /api/cart/:id', r.ok && r.data.items[0].qty === 2);

  // add a second product
  const productId2 = products[1]._id;
  r = await req('POST', '/api/cart', { token, body: { productId: productId2 } });
  log('POST /api/cart (second item)', r.ok && r.data.items.length === 2);

  r = await req('GET', '/api/cart', { token });
  log('GET /api/cart', r.ok && r.data.count === 3);

  r = await req('DELETE', `/api/cart/${productId2}`, { token });
  log('DELETE /api/cart/:id', r.ok && r.data.items.length === 1);

  // restore qty to 1 for cleaner order
  await req('PATCH', `/api/cart/${productId}`, { token, body: { qty: 1 } });

  console.log('\n=== ADDRESSES ===');
  r = await req('GET', '/api/addresses', { token });
  const seededAddrCount = r.data.items.length;
  log('GET /api/addresses (seeded)', r.ok && seededAddrCount === 1);

  r = await req('POST', '/api/addresses', {
    token,
    body: { label: 'Office', name: 'Demo Buyer', line1: 'WeWork Galaxy', city: 'Bengaluru', state: 'KA', pin: '560001', phone: '+91 9999999999' },
  });
  const newAddrId = r.data._id;
  log('POST /api/addresses', r.ok && r.data.label === 'Office');

  r = await req('PATCH', `/api/addresses/${newAddrId}`, { token, body: { isDefault: true } });
  log('PATCH /api/addresses/:id (set default)', r.ok && r.data.isDefault === true);

  r = await req('GET', '/api/addresses', { token });
  log('GET /api/addresses (after default change)', r.ok && r.data.items.filter(a => a.isDefault).length === 1);

  console.log('\n=== PAYMENT METHODS ===');
  r = await req('GET', '/api/payment-methods', { token });
  log('GET /api/payment-methods (seeded)', r.ok && r.data.items.length === 1);

  r = await req('POST', '/api/payment-methods', {
    token,
    body: { type: 'card', label: 'HDFC Visa', detail: '•••• 4242', last4: '4242' },
  });
  const newPmId = r.data._id;
  log('POST /api/payment-methods (card)', r.ok && r.data.type === 'card');

  r = await req('PATCH', `/api/payment-methods/${newPmId}`, { token, body: { label: 'HDFC Visa (renamed)' } });
  log('PATCH /api/payment-methods/:id', r.ok && r.data.label === 'HDFC Visa (renamed)');

  r = await req('DELETE', `/api/payment-methods/${newPmId}`, { token });
  log('DELETE /api/payment-methods/:id', r.ok);

  console.log('\n=== ORDERS ===');
  r = await req('POST', '/api/orders', {
    token,
    body: {
      addressId: newAddrId,
      paymentMethod: { type: 'upi', label: 'GPay UPI', detail: 'demo@oksbi' },
    },
  });
  log('POST /api/orders (from cart)', r.ok && r.data.items && r.data.items.length === 1 && r.data.status === 'placed');
  const orderId = r.data._id;

  r = await req('GET', '/api/orders', { token });
  log('GET /api/orders (history)', r.ok && r.data.items.length >= 1);

  r = await req('GET', `/api/orders/${orderId}`, { token });
  log('GET /api/orders/:id', r.ok && r.data._id === orderId);

  // After ordering, that product should be marked sold and removed from cart
  r = await req('GET', '/api/cart', { token });
  log('Cart cleared after order', r.ok && r.data.items.length === 0);

  r = await req('GET', `/api/products/${productId}`);
  log('Product marked sold after order', r.data.status === 'sold');

  r = await req('POST', `/api/orders/${orderId}/cancel`, { token });
  log('POST /api/orders/:id/cancel', r.ok && r.data.status === 'cancelled');

  r = await req('GET', `/api/products/${productId}`);
  log('Product restored to active on cancel', r.data.status === 'active');

  console.log('\n=== STYLE POSTS ===');
  r = await req('GET', '/api/posts');
  const posts = r.data.items || [];
  log('GET /api/posts', r.ok && posts.length === 6);

  const postId = posts[0]._id;
  r = await req('POST', `/api/posts/${postId}/like`, { token });
  log('POST /api/posts/:id/like (toggle on)', r.ok && r.data.liked === true);

  r = await req('POST', `/api/posts/${postId}/like`, { token });
  log('POST /api/posts/:id/like (toggle off)', r.ok && r.data.liked === false);

  r = await req('POST', `/api/posts/${postId}/save`, { token });
  log('POST /api/posts/:id/save', r.ok && r.data.saved === true);

  r = await req('POST', `/api/posts/${postId}/comments`, { token, body: { text: 'Love this fit!' } });
  log('POST /api/posts/:id/comments', r.ok && r.data.text === 'Love this fit!');

  r = await req('GET', `/api/posts/${postId}`, { token });
  log('GET /api/posts/:id (comment persisted)', r.ok && r.data.comments.some(c => c.text === 'Love this fit!'));

  // Create a new post as the QA user
  r = await req('POST', '/api/posts', {
    token: qaToken,
    body: {
      image: 'https://example.com/test.jpg',
      caption: 'QA test post',
      tags: ['test'],
    },
  });
  const newPostId = r.data._id;
  log('POST /api/posts (create)', r.ok && r.data.caption === 'QA test post');

  r = await req('DELETE', `/api/posts/${newPostId}`, { token: qaToken });
  log('DELETE /api/posts/:id (own)', r.ok);

  console.log('\n=== SELLER FLOW (create / edit / delete listings) ===');
  r = await req('POST', '/api/products', {
    token: qaToken,
    body: {
      title: 'QA Test Listing',
      brand: 'TestBrand',
      price: 499,
      originalPrice: 1999,
      condition: 'Like New',
      size: 'M',
      category: 'Tops',
      gender: 'Women',
      tags: ['Y2K'],
      images: ['https://example.com/test.jpg'],
      description: 'Test description',
    },
  });
  const newListingId = r.data._id;
  log('POST /api/products (create listing)', r.ok && r.data.title === 'QA Test Listing');

  r = await req('GET', `/api/products?mine=true`, { token: qaToken });
  log('GET /api/products?mine=true', r.ok && r.data.items.some(p => p._id === newListingId));

  r = await req('PATCH', `/api/products/${newListingId}`, { token: qaToken, body: { price: 399 } });
  log('PATCH /api/products/:id (own)', r.ok && r.data.price === 399);

  r = await req('PATCH', `/api/products/${newListingId}`, { token, body: { price: 1 } });
  log('PATCH /api/products/:id (someone else → 403)', r.status === 403);

  r = await req('DELETE', `/api/products/${newListingId}`, { token: qaToken });
  log('DELETE /api/products/:id (own)', r.ok);

  console.log('\n=== SUSTAINABILITY ===');
  r = await req('GET', '/api/sustainability/me', { token });
  log('GET /api/sustainability/me', r.ok && typeof r.data.score === 'number' && r.data.tier);

  console.log('\n=== RATE LIMITING ===');
  // /api/auth has a 50/15min limit. Don't actually trip it.
  let any429 = false;
  for (let i = 0; i < 5; i++) {
    const rr = await req('POST', '/api/auth/signin', { body: { contact: 'nope@x.io', password: 'nope' } });
    if (rr.status === 429) { any429 = true; break; }
  }
  log('Auth endpoint accepts repeated bad attempts (no premature 429)', !any429);

  console.log('\n=== UPLOADS (negative tests; positive needs FormData) ===');
  r = await req('POST', '/api/uploads');
  log('POST /api/uploads (no token → 401)', r.status === 401);

  console.log('\n=== DELETE ADDR (cleanup) ===');
  r = await req('DELETE', `/api/addresses/${newAddrId}`, { token });
  log('DELETE /api/addresses/:id', r.ok);

  console.log('\n=========================');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  · ' + f);
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch(err => {
  console.error('TEST RUNNER CRASHED:', err);
  process.exit(2);
});
