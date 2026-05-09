const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/transport?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;

        const vehicles = await db.collection('vehicles').find({}).limit(5).toArray();
        console.log("Total Vehicles:", vehicles.length);
        if (vehicles.length > 0) {
            console.log("Sample Vehicle ID:", vehicles[0]._id);
            console.log("Sample Vehicle Name:", vehicles[0].vehicle_name);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
