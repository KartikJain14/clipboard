import { MongoClient } from 'mongodb';

let client;
let clientPromise;

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  if (!clientPromise) {
    const options = {};

    client = new MongoClient(uri, options);

    if (process.env.NODE_ENV === 'development') {
      // Prevent multiple connections in dev due to hot reload
      if (!global._mongoClientPromise) {
        global._mongoClientPromise = client.connect();
      }
      clientPromise = global._mongoClientPromise;
    } else {
      clientPromise = client.connect();
    }
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  if (!client) return null;

  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  const dbName = uri.split('/').pop()?.split('?')[0];
  return client.db(dbName);
}