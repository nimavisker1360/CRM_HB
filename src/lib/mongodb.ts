import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalForMongoose.mongooseCache) {
  globalForMongoose.mongooseCache = cached;
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!uri) {
    throw new Error("MONGODB_URI or DATABASE_URL is not configured.");
  }

  cached.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });

  cached.conn = await cached.promise;

  return cached.conn;
}
