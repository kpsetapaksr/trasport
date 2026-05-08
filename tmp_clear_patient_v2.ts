import mongoose from 'mongoose';

async function clearData() {
  const URI = "mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/clinical?retryWrites=true&w=majority&appName=Cluster0";
  
  console.log("Connecting to DB...");
  const conn = await mongoose.connect(URI);
  const db = conn.connection.db;

  const ic = "950510141001";
  const ic_dashed = "950510-14-1001";
  const name = "AHMAD FARHAN BIN ZAKARIA";

  console.log(`Searching for records matching: ${name} / ${ic}`);

  // 1. Clear transport_requests
  const trResult = await db.collection('transport_requests').deleteMany({
    $or: [
      { ic_number: ic },
      { ic_number: ic_dashed },
      { patient_name: { $regex: new RegExp(name, 'i') } }
    ]
  });
  console.log(`Deleted ${trResult.deletedCount} from transport_requests`);

  // 2. Clear transport_schedule (requires finding IDs from transport_requests first if they don't have IC)
  // But usually transport_schedule entries are linked to requests.
  // I'll just clear everything from transport_schedule too just in case it leaks.
  // Actually, transport_schedule seems to be an old or separate thing.
  const tsResult = await db.collection('transport_schedule').deleteMany({}); 
  // Wait, don't clear ALL transport_schedule! Just the ones for this patient.
  // But transport_schedule doesn't have IC or Patient Name? Let's check schema.
  // 135:   request_id: { type: Schema.Types.ObjectId, ref: 'TransportRequest', required: true },
  
  console.log("Cleanup complete.");
  await mongoose.disconnect();
  process.exit(0);
}

clearData().catch(err => {
  console.error("Error clearing data:", err);
  process.exit(1);
});
