import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/transport?retryWrites=true&w=majority&appName=Cluster0';

async function updateAdmin() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('transport');

    const hashedPassword = await bcrypt.hash("h'/&?4Y5lN?M.7oJ", 10);

    const result = await db.collection('admins').updateOne(
      { username: 'admin' },
      {
        $set: {
          password: hashedPassword,
          failedAttempts: 0,
          lockUntil: null,
        },
      }
    );

    if (result.matchedCount === 1) {
      console.log('Admin password updated successfully!');
      console.log('Username: admin');
      console.log("Password: h'/&?4Y5lN?M.7oJ");
    } else {
      console.log('Admin user not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateAdmin();
