const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/transport?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;

        const slot = await db.collection('vehicle_schedule_slots').findOne({ _id: new mongoose.Types.ObjectId("69d73e60c95aa5d37172d8da") });
        console.log("Slot Vehicle ID:", slot.vehicle_id);

        const vehicle = await db.collection('vehicles').findOne({ _id: slot.vehicle_id });
        console.log("Vehicle found:", vehicle ? "YES" : "NO");
        if (vehicle) {
            console.log("Vehicle Name:", vehicle.vehicle_name);
            console.log("Vehicle Status:", vehicle.status);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
