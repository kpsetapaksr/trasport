import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const driver_id = searchParams.get('driver_id');
    const status = searchParams.get('status');
    const from = searchParams.get('from');   // YYYY-MM-DD — filter leaves overlapping from this date
    const to = searchParams.get('to');       // YYYY-MM-DD — filter leaves overlapping to this date

    const filter: any = {};
    if (driver_id) {
      try { filter.driver_id = new ObjectId(driver_id); } catch { /* skip invalid id */ }
    }
    if (status) filter.status = status;
    // Return leaves that overlap with [from, to] range
    if (from) filter.end_date = { $gte: from };
    if (to) filter.start_date = { ...(filter.start_date || {}), $lte: to };

    const leaves = await db.collection('driver_leaves')
      .find(filter)
      .sort({ start_date: -1 })
      .toArray();

    return NextResponse.json({ data: leaves });
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
    const { driver_id, leave_type, start_date, end_date, reason, status, created_by } = body;

    if (!driver_id || !leave_type || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'driver_id, leave_type, start_date, and end_date are required' },
        { status: 400 }
      );
    }
    if (!['weekly_off', 'annual_leave', 'sick', 'other'].includes(leave_type)) {
      return NextResponse.json({ error: 'Invalid leave_type' }, { status: 400 });
    }
    if (start_date > end_date) {
      return NextResponse.json({ error: 'start_date must be on or before end_date' }, { status: 400 });
    }

    let driverObjectId: ObjectId;
    try {
      driverObjectId = new ObjectId(driver_id);
    } catch {
      return NextResponse.json({ error: 'Invalid driver_id' }, { status: 400 });
    }

    // Reject if dates overlap with any non-rejected leave for the same driver
    const overlap = await db.collection('driver_leaves').findOne({
      driver_id: driverObjectId,
      status: { $ne: 'rejected' },
      start_date: { $lte: end_date },
      end_date: { $gte: start_date },
    });
    if (overlap) {
      return NextResponse.json(
        { error: 'Leave dates overlap with an existing leave entry' },
        { status: 409 }
      );
    }

    const now = new Date();
    const doc = {
      driver_id: driverObjectId,
      leave_type,
      start_date,
      end_date,
      reason: reason || '',
      status: status || 'approved',
      created_by: created_by || 'admin',
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('driver_leaves').insertOne(doc);
    return NextResponse.json({ data: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
