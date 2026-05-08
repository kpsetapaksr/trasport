import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { join } from 'path';

const MONGODB_URI = 'mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/transport?retryWrites=true&w=majority&appName=Cluster0';
const BACKUP_DIR = './backup/clinical_backup_20260409';

const collections = [
  { file: 'admins.json', collection: 'admins' },
  { file: 'drivers.json', collection: 'drivers' },
  { file: 'vehicles.json', collection: 'vehicles' },
  { file: 'pickup_stations.json', collection: 'pickup_stations' },
  { file: 'transport_requests.json', collection: 'transport_requests' },
  { file: 'transport_schedule.json', collection: 'transport_schedule' },
  { file: 'transport_settings.json', collection: 'transport_settings' },
  { file: 'vehicle_schedule_slots.json', collection: 'vehicle_schedule_slots' },
];

// Convert _id strings and ObjectId references to proper ObjectId instances
function convertIds(doc) {
  const converted = { ...doc };

  // Convert _id
  if (converted._id && typeof converted._id === 'string' && converted._id.length === 24) {
    converted._id = new ObjectId(converted._id);
  }

  // Convert known ObjectId reference fields
  const objectIdFields = [
    'vehicle_id', 'dropoff_vehicle_id', 'driver_id', 'request_id',
  ];
  for (const field of objectIdFields) {
    if (converted[field] && typeof converted[field] === 'string' && converted[field].length === 24) {
      converted._id; // keep _id as-is since already converted
      try {
        converted[field] = new ObjectId(converted[field]);
      } catch {
        // keep as string if not valid ObjectId
      }
    }
  }

  // Convert date fields
  const dateFields = ['createdAt', 'updatedAt', 'lastLogin', 'lockUntil', 'appointment_date'];
  for (const field of dateFields) {
    if (converted[field] && typeof converted[field] === 'string') {
      const d = new Date(converted[field]);
      if (!isNaN(d.getTime())) {
        converted[field] = d;
      }
    }
    if (converted[field] === null) {
      converted[field] = null;
    }
  }

  return converted;
}

async function restore() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');

    const db = client.db('transport');

    for (const { file, collection } of collections) {
      const filePath = join(BACKUP_DIR, file);
      const raw = readFileSync(filePath, 'utf-8');
      const docs = JSON.parse(raw);

      if (docs.length === 0) {
        console.log(`  Skipping ${collection} (empty)`);
        continue;
      }

      // Drop existing collection first
      try {
        await db.collection(collection).drop();
        console.log(`  Dropped existing '${collection}'`);
      } catch {
        // Collection might not exist yet
      }

      // Convert and insert
      const converted = docs.map(convertIds);
      const result = await db.collection(collection).insertMany(converted);
      console.log(`  Restored '${collection}': ${result.insertedCount} documents`);
    }

    console.log('\nAll collections restored successfully!');
  } catch (error) {
    console.error('Restore failed:', error);
  } finally {
    await client.close();
  }
}

restore();
