// Thin wrapper around fetch that:
//  - prefixes every request with VITE_API_URL
//  - auto-attaches the JWT from localStorage
//  - throws a real Error on non-2xx responses so callers can `try/catch`
//  - exposes one helper per backend resource so Revogue.jsx stays readable

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'rv_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, headers, isForm } = {}) {
  const token = getToken();
  const opts = {
    method,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  };
  if (body !== undefined) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.message) || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // --- auth ---
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  signin: (payload) => request('/api/auth/signin', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me'),

  // --- products ---
  listProducts: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== 'All')
    ).toString();
    return request(`/api/products${qs ? `?${qs}` : ''}`);
  },
  getProduct: (id) => request(`/api/products/${id}`),
  createProduct: (payload) => request('/api/products', { method: 'POST', body: payload }),
  updateProduct: (id, payload) => request(`/api/products/${id}`, { method: 'PATCH', body: payload }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),

  // --- wishlist ---
  getWishlist: () => request('/api/wishlist'),
  addWishlist: (productId) => request(`/api/wishlist/${productId}`, { method: 'POST' }),
  removeWishlist: (productId) => request(`/api/wishlist/${productId}`, { method: 'DELETE' }),

  // --- cart ---
  getCart: () => request('/api/cart'),
  addCart: (productId, qty = 1, size) => request('/api/cart', { method: 'POST', body: { productId, qty, size } }),
  updateCart: (productId, qty) => request(`/api/cart/${productId}`, { method: 'PATCH', body: { qty } }),
  removeCart: (productId) => request(`/api/cart/${productId}`, { method: 'DELETE' }),
  clearCart: () => request('/api/cart', { method: 'DELETE' }),

  // --- orders ---
  listOrders: () => request('/api/orders'),
  createOrder: (payload) => request('/api/orders', { method: 'POST', body: payload }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'POST' }),

  // --- posts ---
  listPosts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/posts${qs ? `?${qs}` : ''}`);
  },
  createPost: (payload) => request('/api/posts', { method: 'POST', body: payload }),
  updatePost: (id, payload) => request(`/api/posts/${id}`, { method: 'PATCH', body: payload }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE' }),
  likePost: (id) => request(`/api/posts/${id}/like`, { method: 'POST' }),
  savePost: (id) => request(`/api/posts/${id}/save`, { method: 'POST' }),
  commentPost: (id, text) => request(`/api/posts/${id}/comments`, { method: 'POST', body: { text } }),

  // --- addresses ---
  listAddresses: () => request('/api/addresses'),
  createAddress: (payload) => request('/api/addresses', { method: 'POST', body: payload }),
  updateAddress: (id, payload) => request(`/api/addresses/${id}`, { method: 'PATCH', body: payload }),
  deleteAddress: (id) => request(`/api/addresses/${id}`, { method: 'DELETE' }),

  // --- payment methods ---
  listPayments: () => request('/api/payment-methods'),
  createPayment: (payload) => request('/api/payment-methods', { method: 'POST', body: payload }),
  updatePayment: (id, payload) => request(`/api/payment-methods/${id}`, { method: 'PATCH', body: payload }),
  deletePayment: (id) => request(`/api/payment-methods/${id}`, { method: 'DELETE' }),

  // --- profile / settings ---
  updateProfile: (payload) => request('/api/users/me', { method: 'PATCH', body: payload }),
  updateSettings: (payload) => request('/api/users/me/settings', { method: 'PATCH', body: payload }),
  updateAvatar: (payload) => request('/api/users/me/avatar', { method: 'PATCH', body: payload }),
  getPublicProfile: (idOrUsername) => request(`/api/users/${encodeURIComponent(idOrUsername)}`),

  // --- sustainability ---
  getSustainability: () => request('/api/sustainability/me'),

  // --- uploads (FormData; do NOT JSON-stringify) ---
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request('/api/uploads', { method: 'POST', body: fd, isForm: true });
  },
  uploadImages: (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    return request('/api/uploads/multiple', { method: 'POST', body: fd, isForm: true });
  },
};

export default api;
