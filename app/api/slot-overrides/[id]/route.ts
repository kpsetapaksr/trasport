import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const { id } = await params;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const override = await db.collection('driver_slot_overrides').findOne({ _id: oid });
    if (!override) return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    return NextResponse.json({ data: override });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const { id } = await params;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const updates: any = { updatedAt: new Date() };
    if (body.block_full_day !== undefined) updates.block_full_day = body.block_full_day;
    if (body.disabled_slots !== undefined) updates.disabled_slots = body.disabled_slots;
    if (body.reason !== undefined) updates.reason = body.reason;

    const result = await db.collection('driver_slot_overrides').findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const { id } = await params;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const result = await db.collection('driver_slot_overrides').deleteOne({ _id: oid });
    if (result.deletedCount === 0) return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
