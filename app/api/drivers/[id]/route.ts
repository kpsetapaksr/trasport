import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export async function PUT(request: NextRequest, { params }: { params: any }) {
  try {
    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    
    // Use native MongoDB driver to bypass Mongoose schema caching issues
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    const { _id, __v, ...updateData } = body;

    // Store plain password for admin display, then hash for auth
    if (updateData.password && !updateData.password.startsWith('$2')) {
      updateData.plain_password = updateData.password;
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const result = await db.collection('drivers').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { ...updateData, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }
    
    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error("Driver PUT error:", error);
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
    const result = await db.collection('drivers').deleteOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
