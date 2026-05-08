import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

export async function GET(_request: NextRequest, { params }: { params: any }) {
  try {
    await dbConnect();
    const { id } = await params;
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    let objectId: mongoose.Types.ObjectId;
    try {
      objectId = new mongoose.Types.ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 });
    }

    const vehicle = await db.collection('vehicles').findOne({ _id: objectId });
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    return NextResponse.json({ data: vehicle });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: any }) {
  try {
    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();

    const { _id, __v, ...updateData } = body;

    // Convert driver_id: handle 'none', empty string, or valid ObjectId
    if (!updateData.driver_id || updateData.driver_id === 'none' || updateData.driver_id === '') {
      updateData.driver_id = null;
    } else {
      try {
        updateData.driver_id = new mongoose.Types.ObjectId(updateData.driver_id);
      } catch {
        updateData.driver_id = null;
      }
    }

    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    const result = await db.collection('vehicles').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { ...updateData, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // Populate driver info manually
    let populated = { ...result };
    if (result.driver_id) {
      try {
        const driver = await db.collection('drivers').findOne({ _id: result.driver_id });
        if (driver) populated.driver_id = driver;
      } catch {}
    }

    return NextResponse.json({ data: populated });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: "Plate number already exists" }, { status: 409 });
    }
    console.error("Vehicle PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: any }) {
  try {
    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    const result = await db.collection('vehicles').deleteOne({
      _id: new mongoose.Types.ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
