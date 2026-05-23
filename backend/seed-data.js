// Seed function — importable by both the CLI seed script and the in-memory DB bootstrap.
// Assumes mongoose is already connected. Does NOT touch the connection lifecycle.

const User = require('./models/User');
const Product = require('./models/Product');
const Post = require('./models/Post');
const Address = require('./models/Address');
const PaymentMethod = require('./models/PaymentMethod');
const Order = require('./models/Order');

const SELLERS = [
  { username: 'anaya_thrifts',       name: 'Anaya',     rating: 4.9 },
  { username: 'grunge_gallery',      name: 'Riya',      rating: 4.7 },
  { username: 'minimalist_m',        name: 'Meera',     rating: 4.8 },
  { username: 'tshirt_temple',       name: 'Tara',      rating: 4.6 },
  { username: 'vintage_vault',       name: 'Vidya',     rating: 4.7 },
  { username: 'preppy_kolkata',      name: 'Pari K',    rating: 4.5 },
  { username: 'denim_diary',         name: 'Diya',      rating: 4.8 },
  { username: 'utility_club',        name: 'Uday',      rating: 4.7 },
  { username: 'preppy_pari',         name: 'Pari',      rating: 4.9 },
  { username: 'sari_stories',        name: 'Sara',      rating: 4.9 },
  { username: 'bloom_boutique',      name: 'Bela',      rating: 4.9 },
  { username: 'soiree_seconds',      name: 'Sona',      rating: 4.9 },
  { username: 'summer_circles',      name: 'Suman',     rating: 4.7 },
  { username: 'noir_closet',         name: 'Nikita',    rating: 4.9 },
  { username: 'sole_society',        name: 'Sohan',     rating: 4.6 },
  { username: 'kicks_karma',         name: 'Karan',     rating: 4.7 },
  { username: 'platform_princess',   name: 'Priya',     rating: 4.9 },
  { username: 'retro_rani',          name: 'Rani',      rating: 5.0 },
  { username: 'thrift_thakur',       name: 'Tarun',     rating: 4.5 },
  { username: 'shades_shelf',        name: 'Saheb',     rating: 4.8 },
  { username: 'beach_bazaar',        name: 'Bhakti',    rating: 4.8 },
  { username: 'gold_rush',           name: 'Gauri',     rating: 4.8 },
  { username: 'silk_road',           name: 'Sneha',     rating: 4.8 },
  { username: 'time_keeper',         name: 'Tanvi',     rating: 4.7 },
];

const PRODUCTS = [
  { title: "Cream Cable Knit Sweater", brand: "Zara", price: 749, originalPrice: 2799, condition: "Like New", size: "M", category: "Tops", gender: "Women", seller: "anaya_thrifts", img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&h=800&fit=crop&q=80", tags: ["Cottagecore", "Winter"], likes: 234 },
  { title: "Brown Plaid Flannel Shirt", brand: "UNIQLO", price: 599, originalPrice: 2299, condition: "Good", size: "L", category: "Tops", gender: "Unisex", seller: "grunge_gallery", img: "https://sangiev.com/cdn/shop/files/Front_3151992c-0e31-4aaf-8d0e-e126b4b95852.jpg?v=1730451373", tags: ["Grunge", "Streetwear"], likes: 203 },
  { title: "Ribbed Cream Turtleneck", brand: "COS", price: 599, originalPrice: 2499, condition: "Like New", size: "M", category: "Tops", gender: "Women", seller: "minimalist_m", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUkq3pGQ2H0ycHMB-ztXTPmkSt1CBlm4v4TQ&s", tags: ["Minimal", "Old Money"], likes: 167 },
  { title: "White Tee Classic Fit", brand: "H&M", price: 199, originalPrice: 799, condition: "Good", size: "S", category: "Tops", gender: "Unisex", seller: "tshirt_temple", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop&q=80", tags: ["Streetwear", "Minimal"], likes: 142 },
  { title: "Striped Breton Long Sleeve", brand: "Marks & Spencer", price: 549, originalPrice: 1899, condition: "Like New", size: "M", category: "Tops", gender: "Women", seller: "vintage_vault", img: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcR0xJXh73Jhf8hyBcAe1QwShcFjNjMHLXC1oWqf0zj6N-ogImvyhKQ-W8TXNypvF90oLecokt9mKRADo3VC8QknVOY9xEmO_h9dVfo1HIKlrPHdVEIdk-3411Y", tags: ["Old Money", "Minimal"], likes: 198 },
  { title: "Navy Polo Shirt", brand: "Wrogn", price: 449, originalPrice: 1799, condition: "Good", size: "L", category: "Tops", gender: "Men", seller: "preppy_kolkata", img: "https://wrogn.com/cdn/shop/files/WUTS1210S_1.jpg?v=1754396652", tags: ["Preppy", "Old Money"], likes: 98 },

  { title: "Wide-Leg Blue Denim", brand: "Levi's", price: 799, originalPrice: 3999, condition: "Good", size: "30", category: "Bottoms", gender: "Unisex", seller: "denim_diary", img: "https://www.only.in/cdn/shop/files/902124001_g5_c879d080-16ad-4ca3-9413-529405913d03.jpg?v=1752845764&width=1080", tags: ["Y2K", "Vintage"], likes: 156 },
  { title: "Mom-Fit Light Wash Jeans", brand: "Levi's", price: 749, originalPrice: 2999, condition: "Good", size: "28", category: "Bottoms", gender: "Women", seller: "denim_diary", img: "https://image.hm.com/assets/hm/d4/93/d493fec2a73e1da187eddd49add7ec4efaa191be.jpg?imwidth=2160", tags: ["Y2K", "Retro"], likes: 412 },
  { title: "Olive Cargo Pants", brand: "H&M", price: 699, originalPrice: 2499, condition: "Like New", size: "32", category: "Bottoms", gender: "Men", seller: "utility_club", img: "https://limitededt.in/cdn/shop/files/62471933_1.jpg?v=1757160923&width=2048", tags: ["Streetwear", "Y2K"], likes: 221 },
  { title: "Pleated Mini Skirt", brand: "Forever 21", price: 399, originalPrice: 1499, condition: "Like New", size: "S", category: "Bottoms", gender: "Women", seller: "preppy_pari", img: "https://littleboxindia.com/cdn/shop/products/back_view_of_High_Waisted_Pleated_Tennis_Skirt_In_Black.jpg?v=1742285473", tags: ["Preppy", "Y2K"], likes: 267 },
  { title: "Plaid Mini Skirt", brand: "Urban Outfitters", price: 499, originalPrice: 1999, condition: "Like New", size: "S", category: "Bottoms", gender: "Women", seller: "preppy_pari", img: "https://media.karousell.com/media/photos/products/2024/10/2/thrifted_y2k_plaid_skirt_1727836594_36d9c355_progressive.jpg", tags: ["Preppy", "Y2K"], likes: 298 },

  { title: "Beige Linen Midi Dress", brand: "Fabindia", price: 1299, originalPrice: 4500, condition: "Like New", size: "M", category: "Dresses", gender: "Women", seller: "sari_stories", img: "https://www.na-kd.com/globalassets/linen_blend_seam_detail_midi_dress_1100-011361-0005_0005_flatlay.jpg", tags: ["Cottagecore", "Summer"], likes: 298 },
  { title: "Floral Tea Dress", brand: "Cotton On", price: 699, originalPrice: 2799, condition: "Like New", size: "M", category: "Dresses", gender: "Women", seller: "bloom_boutique", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAo2RDzyO9-EMFojxP4XMGEMZMyrhAp-9D9Q&s", tags: ["Cottagecore", "Spring"], likes: 334 },
  { title: "Black Satin Slip Dress", brand: "Zara", price: 899, originalPrice: 2999, condition: "Like New", size: "S", category: "Dresses", gender: "Women", seller: "soiree_seconds", img: "https://img01.ztat.net/article/spp-media-p1/a38ecda94db44c86be627f2817bef03b/bb330f70f9f247918e11ab98e35e953e.jpg?imwidth=800&filter=packshot", tags: ["Y2K", "Luxe"], likes: 389 },
  { title: "Yellow Sundress", brand: "Mango", price: 849, originalPrice: 2999, condition: "Excellent", size: "M", category: "Dresses", gender: "Women", seller: "summer_circles", img: "https://i.etsystatic.com/6058764/r/il/c7e54f/1593043620/il_fullxfull.1593043620_kzp2.jpg", tags: ["Cottagecore", "Summer"], likes: 256 },
  { title: "Red Wrap Dress", brand: "Zara", price: 999, originalPrice: 3499, condition: "Like New", size: "M", category: "Dresses", gender: "Women", seller: "noir_closet", img: "https://i.etsystatic.com/6017977/r/il/f137f2/5076826342/il_fullxfull.5076826342_350e.jpg", tags: ["Y2K", "Luxe"], likes: 312 },

  { title: "Brown Leather Oxford Shoes", brand: "Clarks", price: 1499, originalPrice: 5999, condition: "Good", size: "9", category: "Shoes", gender: "Men", seller: "sole_society", img: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&h=800&fit=crop&q=80", tags: ["Old Money"], likes: 87 },
  { title: "Retro White Sneakers", brand: "Adidas", price: 999, originalPrice: 3999, condition: "Good", size: "8", category: "Shoes", gender: "Unisex", seller: "kicks_karma", img: "https://d1pdzcnm6xgxlz.cloudfront.net/footwear/8905875429074-9.jpg", tags: ["Streetwear", "Retro"], likes: 342 },
  { title: "Black Combat Boots", brand: "Dr. Martens", price: 1899, originalPrice: 6499, condition: "Excellent", size: "7", category: "Shoes", gender: "Women", seller: "platform_princess", img: "https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/D23054s.jpg?im=Resize,width=750", tags: ["Y2K", "Grunge"], likes: 456 },
  { title: "Tan Leather Loafers", brand: "Bata", price: 1199, originalPrice: 3999, condition: "Like New", size: "8", category: "Shoes", gender: "Unisex", seller: "preppy_kolkata", img: "https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/G12546s.jpg?im=Resize,width=750", tags: ["Old Money", "Preppy"], likes: 134 },
  { title: "Strappy Heeled Sandals", brand: "Steve Madden", price: 1099, originalPrice: 4499, condition: "Excellent", size: "7", category: "Shoes", gender: "Women", seller: "soiree_seconds", img: "https://images-static.nykaa.com/media/catalog/product/8/6/862bd46Lux-A-White_1.jpg?tr=w-500", tags: ["Y2K", "Luxe"], likes: 287 },

  { title: "Red Cropped Bomber", brand: "Urbanic", price: 899, originalPrice: 3499, condition: "Excellent", size: "S", category: "Outerwear", gender: "Women", seller: "retro_rani", img: "https://assets.ajio.com/medias/sys_master/root/20221019/2tFr/634ef522f997ddfdbd314e3a/-473Wx593H-410339290-4900-MODEL.jpg", tags: ["Y2K", "Streetwear"], likes: 412 },
  { title: "Black Leather Jacket", brand: "Mango", price: 1899, originalPrice: 6999, condition: "Excellent", size: "M", category: "Outerwear", gender: "Women", seller: "noir_closet", img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop&q=80", tags: ["Grunge", "Streetwear"], likes: 523 },
  { title: "Camel Trench Coat", brand: "H&M", price: 1499, originalPrice: 5499, condition: "Like New", size: "M", category: "Outerwear", gender: "Women", seller: "vintage_vault", img: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&h=800&fit=crop&q=80", tags: ["Old Money", "Minimal"], likes: 367 },
  { title: "Brown Corduroy Jacket", brand: "Roadster", price: 749, originalPrice: 2499, condition: "Good", size: "L", category: "Outerwear", gender: "Men", seller: "thrift_thakur", img: "https://m.media-amazon.com/images/I/A18T3boO-FL._AC_UY1100_.jpg", tags: ["Retro", "Autumn"], likes: 142 },

  { title: "Tortoise-Shell Sunglasses", brand: "Ray-Ban", price: 849, originalPrice: 3500, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Unisex", seller: "shades_shelf", img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=800&fit=crop&q=80", tags: ["Old Money", "Vintage"], likes: 287 },
  { title: "Woven Straw Tote Bag", brand: "Accessorize", price: 549, originalPrice: 1999, condition: "Like New", size: "One Size", category: "Accessories", gender: "Women", seller: "beach_bazaar", img: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=800&fit=crop&q=80", tags: ["Cottagecore", "Summer"], likes: 198 },
  { title: "Chunky Gold Chain Necklace", brand: "Vintage", price: 249, originalPrice: 899, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Unisex", seller: "gold_rush", img: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=800&fit=crop&q=80", tags: ["Y2K", "Streetwear"], likes: 178 },
  { title: "Silk Printed Scarf", brand: "Vintage", price: 349, originalPrice: 1200, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Women", seller: "silk_road", img: "https://www.studiodecorai.com/cdn/shop/products/studio-decorai-scarf-dahlia-dawn-silk-scarf-39900743598376.jpg?v=1677827884&width=1946", tags: ["Vintage", "Luxe"], likes: 145 },
  { title: "Vintage Leather Watch", brand: "Fossil", price: 1299, originalPrice: 4999, condition: "Excellent", size: "One Size", category: "Accessories", gender: "Unisex", seller: "time_keeper", img: "https://viange.in/cdn/shop/files/3809D631-7F4D-4897-A71A-D7E55960CE2B_1024x1024@2x.jpg?v=1750847934", tags: ["Old Money", "Vintage"], likes: 198 },
];

const STYLE_POSTS = [
  { user: "anaya_thrifts",  avatar: "🌸", caption: "Paired this vintage knit with wide-leg denim for a cozy cottagecore morning ☕", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80", tags: ["#cottagecore", "#thriftedfit"], productTitles: ["Cream Cable Knit Sweater", "White Tee Classic Fit"], likes: 1243 },
  { user: "retro_rani",     avatar: "🎀", caption: "Red bomber season is officially open. Going full Y2K maximalist this week", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80", tags: ["#y2k", "#streetstyle"], productTitles: ["Red Cropped Bomber"], likes: 2891 },
  { user: "vintage_vault",  avatar: "🍂", caption: "Old money energy with this cream quarter-zip. Thrifted, timeless, tenderly loved", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80", tags: ["#oldmoney", "#quietluxury"], productTitles: ["Striped Breton Long Sleeve"], likes: 1567 },
  { user: "grunge_gallery", avatar: "⚡", caption: "Oversized flannel + chunky chain = the uniform. Thrifting > fast fashion always", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80", tags: ["#grunge", "#sustainable"], productTitles: ["Brown Plaid Flannel Shirt", "Chunky Gold Chain Necklace"], likes: 987 },
  { user: "noir_closet",    avatar: "🖤", caption: "Leather jacket + platform boots. Pre-loved pieces, post-punk mood", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80", tags: ["#grunge", "#vintage"], productTitles: ["Black Leather Jacket", "Black Combat Boots"], likes: 2134 },
  { user: "soiree_seconds", avatar: "✨", caption: "Slip dress season. Found this gem for ₹899 and I'm obsessed", image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80", tags: ["#y2k", "#luxe"], productTitles: ["Black Satin Slip Dress"], likes: 1789 },
];

async function seed({ wipe = true, log = (m) => console.log(m) } = {}) {
  if (wipe) {
    log('[seed] clearing collections...');
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Post.deleteMany({}),
      Address.deleteMany({}),
      PaymentMethod.deleteMany({}),
      Order.deleteMany({}),
    ]);
  }

  log('[seed] creating sellers...');
  const sellerDocs = {};
  for (const s of SELLERS) {
    const u = await User.create({
      name: s.name,
      username: s.username,
      email: `${s.username}@revogue.demo`,
      password: 'password123',
      role: 'both',
      sellerRating: s.rating,
      profile: { bio: `Curating thrifted treasures · @${s.username}`, location: 'India', avatarColor: 'terracotta' },
    });
    sellerDocs[s.username] = u;
  }

  log('[seed] creating demo buyer (demo@revogue.io / password123)...');
  const buyer = await User.create({
    name: 'Demo Buyer',
    username: 'demo_buyer',
    email: 'demo@revogue.io',
    password: 'password123',
    role: 'buyer',
    profile: { bio: 'Just here for the thrifting ✨', location: 'Bengaluru, IN' },
  });
  await Address.create({
    user: buyer._id, label: 'Home', name: 'Demo Buyer', line1: '2nd Cross Rd, Indiranagar',
    city: 'Bengaluru', state: 'Karnataka', pin: '560038', phone: '+91 98XXX XXXXX', isDefault: true,
  });
  await PaymentMethod.create({
    user: buyer._id, type: 'upi', label: 'GPay UPI', detail: 'demo@oksbi', isDefault: true,
  });

  log('[seed] creating products...');
  const productDocs = {};
  for (const p of PRODUCTS) {
    const seller = sellerDocs[p.seller];
    const created = await Product.create({
      title: p.title, brand: p.brand, price: p.price, originalPrice: p.originalPrice,
      condition: p.condition, size: p.size, category: p.category, gender: p.gender,
      tags: p.tags, images: [p.img], likes: p.likes,
      seller: seller?._id, sellerHandle: p.seller, sellerRating: seller?.sellerRating || 4.8,
      isCurated: true,
      description: `${p.brand} · ${p.condition} · Size ${p.size}. Pre-loved and ready for its next chapter.`,
    });
    productDocs[p.title] = created;
  }

  log('[seed] creating style posts...');
  for (const post of STYLE_POSTS) {
    const author = sellerDocs[post.user];
    const productIds = post.productTitles
      .map(t => productDocs[t]?._id)
      .filter(Boolean);
    await Post.create({
      user: author?._id,
      username: post.user,
      avatar: post.avatar,
      caption: post.caption,
      image: post.image,
      tags: post.tags,
      products: productIds,
      likes: post.likes,
    });
  }

  return {
    sellers: Object.keys(sellerDocs).length,
    buyers: 1,
    products: PRODUCTS.length,
    posts: STYLE_POSTS.length,
  };
}

module.exports = seed;
