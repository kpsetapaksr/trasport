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
    const override_date = searchParams.get('date');
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to');     // YYYY-MM-DD

    const filter: any = {};
    if (driver_id) {
      try { filter.driver_id = new ObjectId(driver_id); } catch { /* skip invalid */ }
    }
    if (override_date) {
      filter.override_date = override_date;
    } else {
      if (from) filter.override_date = { $gte: from };
      if (to) filter.override_date = { ...(filter.override_date || {}), $lte: to };
    }

    const overrides = await db.collection('driver_slot_overrides')
      .find(filter)
      .sort({ override_date: -1 })
      .toArray();

    return NextResponse.json({ data: overrides });
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
    const { driver_id, override_date, block_full_day, disabled_slots, reason, created_by } = body;

    if (!driver_id || !override_date) {
      return NextResponse.json(
        { error: 'driver_id and override_date are required' },
        { status: 400 }
      );
    }

    let driverObjectId: ObjectId;
    try {
      driverObjectId = new ObjectId(driver_id);
    } catch {
      return NextResponse.json({ error: 'Invalid driver_id' }, { status: 400 });
    }

    const now = new Date();

    // Upsert: one override doc per driver + date
    const result = await db.collection('driver_slot_overrides').findOneAndUpdate(
      { driver_id: driverObjectId, override_date },
      {
        $set: {
          block_full_day: block_full_day ?? false,
          disabled_slots: disabled_slots ?? [],
          reason: reason || '',
          created_by: created_by || 'admin',
          updatedAt: now,
        },
        $setOnInsert: {
          driver_id: driverObjectId,
          override_date,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
