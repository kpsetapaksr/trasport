const mongoose = require('mongoose');

async function clearData() {
  const URI = "mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/clinical?retryWrites=true&w=majority&appName=Cluster0";
  
  console.log("Connecting to DB...");
  const conn = await mongoose.connect(URI);
  const db = conn.connection.db;

  const ic = "950510141001";
  const name = "AHMAD FARHAN BIN ZAKARIA";

  console.log(`Searching for records matching: ${name} / ${ic}`);

  // Delete from transport_requests (the main collection)
  const trResult = await db.collection('transport_requests').deleteMany({
    $or: [
      { ic_number: ic },
      { ic_number: "950510-14-1001" },
      { patient_name: { $regex: new RegExp(name, 'i') } }
    ]
  });
  console.log(`Deleted ${trResult.deletedCount} from transport_requests`);

  console.log("Cleanup complete.");
  await mongoose.disconnect();
  process.exit(0);
}

clearData().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
