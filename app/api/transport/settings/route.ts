import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportSettings } from '@/lib/models';

const DEFAULT_SETTINGS = {
  start_time: '07:00',
  end_time: '17:00',
  interval_minutes: 30,
  buffer_before_appointment: 60,
  travel_time_minutes: 30,
  appointment_duration_minutes: 30,
  max_seats_per_slot: 0,
  enabled: true,
  message: '',
};

// GET - Get transport settings (create defaults if not exists)
export async function GET() {
  try {
    await dbConnect();
    const db = TransportSettings.db;
    const collection = db.collection('transport_settings');

    let settings = await collection.findOne({});

    if (!settings) {
      await collection.insertOne({ ...DEFAULT_SETTINGS, slot_overrides: [], createdAt: new Date(), updatedAt: new Date() });
      settings = await collection.findOne({});
    }

    return NextResponse.json({ data: settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update transport settings
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    console.log('[settings PATCH] slot_overrides count:', body.slot_overrides?.length ?? 'none');

    // Use native collection update to avoid Mongoose schema caching issues
    const db = TransportSettings.db;
    const collection = db.collection('transport_settings');

    const existing = await collection.findOne({});
    if (existing) {
      await collection.updateOne({ _id: existing._id }, { $set: body });
    } else {
      await collection.insertOne({ ...DEFAULT_SETTINGS, ...body, createdAt: new Date(), updatedAt: new Date() });
    }

    const settings = await collection.findOne({});
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('[settings PATCH] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
