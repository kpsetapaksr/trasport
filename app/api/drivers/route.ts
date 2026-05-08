import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    const drivers = await db.collection('drivers').find({}).sort({ name: 1 }).toArray();
    return NextResponse.json({ data: drivers });
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
    
    // Check for duplicate phone
    const existing = await db.collection('drivers').findOne({ phone: body.phone });
    if (existing) {
      return NextResponse.json({ error: "Mobile number already registered." }, { status: 400 });
    }
    
    // Store plain password for admin display, then hash for auth
    if (body.password) {
      body.plain_password = body.password;
      body.password = await bcrypt.hash(body.password, 10);
    }

    const now = new Date();
    const doc = {
      ...body,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await db.collection('drivers').insertOne(doc);
    return NextResponse.json({ data: { ...doc, _id: result.insertedId } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
