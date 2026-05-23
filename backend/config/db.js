const mongoose = require('mongoose');

async function startMemoryServer() {
  // Lazy-require so production deployments don't need this dev dependency installed
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mem = await MongoMemoryServer.create({ instance: { dbName: 'revogue' } });
  const uri = mem.getUri();
  console.log('[db] no MongoDB reachable — booted an in-memory MongoDB for dev');
  console.log(`[db]   ephemeral URI: ${uri}`);
  console.log('[db]   data resets on every restart. Set MONGO_URI in .env for persistence.');
  return uri;
}

async function tryConnect(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 4000,
  });
}

async function connectDB() {
  const configuredUri = process.env.MONGO_URI;
  if (configuredUri) {
    try {
      await tryConnect(configuredUri);
      console.log(`[db] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return;
    } catch (err) {
      console.warn(`[db] could not reach ${configuredUri}: ${err.message}`);
      if (process.env.NODE_ENV === 'production') throw err;
      console.warn('[db] falling back to in-memory MongoDB for this session');
    }
  } else {
    console.log('[db] MONGO_URI not set — starting in-memory MongoDB');
  }

  const memUri = await startMemoryServer();
  await tryConnect(memUri);
  console.log(`[db] connected: in-memory @ ${mongoose.connection.name}`);

  // Auto-seed the in-memory DB so the app has data on first launch
  if (process.env.AUTO_SEED !== 'false') {
    const User = require('../models/User');
    const count = await User.estimatedDocumentCount();
    if (count === 0) {
      console.log('[db] in-memory DB is empty — auto-seeding demo data...');
      try {
        const seed = require('../seed-data');
        await seed();
        console.log('[db] auto-seed complete');
      } catch (e) {
        console.warn('[db] auto-seed failed:', e.message);
      }
    }
  }
}

module.exports = connectDB;
