import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

export async function GET() {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const vehicles = await db.collection('vehicles').find({}).sort({ vehicle_name: 1 }).toArray();

    // Manually populate driver_id
    const populated = await Promise.all(vehicles.map(async (v) => {
      if (v.driver_id) {
        try {
          const driver = await db.collection('drivers').findOne({ _id: v.driver_id });
          return { ...v, driver_id: driver || v.driver_id };
        } catch {
          return v;
        }
      }
      return v;
    }));

    return NextResponse.json({ data: populated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    const body = await request.json();
    const { _id, ...data } = body;

    // Validate required fields
    if (!data.vehicle_name || !data.vehicle_number || !data.vehicle_type || !data.seat_capacity) {
      return NextResponse.json(
        { error: 'vehicle_name, vehicle_number, vehicle_type, and seat_capacity are required' },
        { status: 400 }
      );
    }

    // Check for duplicate plate
    const existing = await db.collection('vehicles').findOne({ vehicle_number: data.vehicle_number });
    if (existing) {
      return NextResponse.json({ error: "Plate number already registered." }, { status: 400 });
    }

    // Handle driver_id
    if (!data.driver_id || data.driver_id === 'none' || data.driver_id === '') {
      data.driver_id = null;
    } else {
      try {
        data.driver_id = new mongoose.Types.ObjectId(data.driver_id);
      } catch {
        data.driver_id = null;
      }
    }

    const now = new Date();
    const doc = { ...data, createdAt: now, updatedAt: now };
    const result = await db.collection('vehicles').insertOne(doc);

    return NextResponse.json({ data: { ...doc, _id: result.insertedId } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
