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

    const leave = await db.collection('driver_leaves').findOne({ _id: oid });
    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    return NextResponse.json({ data: leave });
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
    const { leave_type, start_date, end_date, reason, status } = body;

    const updates: any = { updatedAt: new Date() };
    if (leave_type !== undefined) {
      if (!['weekly_off', 'annual_leave', 'sick', 'other'].includes(leave_type)) {
        return NextResponse.json({ error: 'Invalid leave_type' }, { status: 400 });
      }
      updates.leave_type = leave_type;
    }
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (reason !== undefined) updates.reason = reason;
    if (status !== undefined) {
      if (!['approved', 'pending', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = status;
    }

    // When dates are being changed, validate the new range and re-check for overlaps
    if (start_date !== undefined || end_date !== undefined) {
      const existing = await db.collection('driver_leaves').findOne({ _id: oid });
      if (!existing) return NextResponse.json({ error: 'Leave not found' }, { status: 404 });

      const newStart = updates.start_date ?? existing.start_date;
      const newEnd = updates.end_date ?? existing.end_date;

      if (newStart > newEnd) {
        return NextResponse.json({ error: 'start_date must be on or before end_date' }, { status: 400 });
      }

      const overlap = await db.collection('driver_leaves').findOne({
        _id: { $ne: oid },
        driver_id: existing.driver_id,
        status: { $ne: 'rejected' },
        start_date: { $lte: newEnd },
        end_date: { $gte: newStart },
      });
      if (overlap) {
        return NextResponse.json(
          { error: 'Updated dates overlap with an existing leave entry' },
          { status: 409 }
        );
      }
    }

    const result = await db.collection('driver_leaves').findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
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

    const result = await db.collection('driver_leaves').deleteOne({ _id: oid });
    if (result.deletedCount === 0) return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
