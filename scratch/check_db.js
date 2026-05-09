const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://naveen_db_user:vh7zmG9HJDoUK9RR@cluster0.r8ba8yp.mongodb.net/transport?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    try {
        console.log("Connecting to:", MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log("Connected.");

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name).join(', '));

        const slots = await db.collection('vehicle_schedule_slots').find({}).limit(5).toArray();
        console.log("Found", slots.length, "total slots.");
        
        if (slots.length > 0) {
            console.log("Sample Slot:", JSON.stringify(slots[0], null, 2));
        }

        const dateVariations = ["2026-05-10", "10-05-2026", "10/05/2026", ""];
        const matches = await db.collection('vehicle_schedule_slots').find({
            date: { $in: dateVariations },
            type: "pickup"
        }).toArray();
        
        console.log("Matches for May 10th Pickup:", matches.length);
        if (matches.length > 0) {
            console.log("First Match:", JSON.stringify(matches[0], null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
