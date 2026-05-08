import mongoose from 'mongoose';

const CLINICAL_MONGODB_URI = process.env.CLINICAL_MONGODB_URI;

if (!CLINICAL_MONGODB_URI) {
  throw new Error(
    'Please define the CLINICAL_MONGODB_URI environment variable inside .env.local'
  );
}

interface MongooseCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
}

declare global {
  var clinicalMongoose: MongooseCache;
}

let cached: MongooseCache = global.clinicalMongoose;

if (!cached) {
  cached = global.clinicalMongoose = { conn: null, promise: null };
}

async function clinicalDbConnect(): Promise<mongoose.Connection> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 1,
      minPoolSize: 0,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.createConnection(CLINICAL_MONGODB_URI!, opts)
      .asPromise();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default clinicalDbConnect;
