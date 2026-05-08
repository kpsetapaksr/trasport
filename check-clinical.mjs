import { MongoClient } from 'mongodb';

const CLINICAL_URI = 'mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/clinical?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
  const client = new MongoClient(CLINICAL_URI);
  try {
    await client.connect();
    const db = client.db('clinical');

    const collections = await db.listCollections().toArray();
    console.log('Collections in clinical DB:', collections.map(c => c.name));

    const appointments = await db.collection('appointments').find({}).limit(5).toArray();
    console.log('\nAppointments found:', appointments.length);
    if (appointments.length > 0) {
      appointments.forEach(a => {
        console.log(`  - ${a.patientName} | IC: ${a.patientIC} | Date: ${a.appointmentDate} | Status: ${a.status}`);
      });
    }

    const doctors = await db.collection('doctors').find({}).limit(5).toArray();
    console.log('\nDoctors found:', doctors.length);
    doctors.forEach(d => console.log(`  - ${d.name} (${d.specialization})`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

check();
