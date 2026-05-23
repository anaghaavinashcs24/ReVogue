require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const seed = require('./seed-data');

async function run() {
  await connectDB();
  const stats = await seed({ wipe: true });
  console.log('[seed] done.');
  console.log(`  · ${stats.sellers} sellers`);
  console.log(`  · ${stats.buyers} demo buyer (demo@revogue.io / password123)`);
  console.log(`  · ${stats.products} products`);
  console.log(`  · ${stats.posts} style posts`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
