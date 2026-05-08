const mongoose = require('mongoose');

async function clearData() {
  const URI = "mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/clinical?retryWrites=true&w=majority&appName=Cluster0";
  
  console.log("Connecting to DB...");
  const conn = await mongoose.connect(URI);
  const db = conn.connection.db;

  const targetNames = [
    "AHMAD FARHAN BIN ZAKARIA",
    "AHMAD AMINUDDIN BIN KARIM",
    "DEMO TEST USER"
  ];

  console.log(`Deleting records for: ${targetNames.join(', ')}`);

  const result = await db.collection('transport_requests').deleteMany({
    patient_name: { $in: targetNames }
  });
  
  console.log(`Successfully deleted ${result.deletedCount} transport records.`);

  await mongoose.disconnect();
  process.exit(0);
}

clearData().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
