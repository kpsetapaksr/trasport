import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { VehicleScheduleSlot } from '@/lib/models';

// POST — block one or more slots for a specific date with a reason.
// For recurring (date='') slots, creates a date-specific inactive override.
// For date-specific slots, updates status to inactive in-place.
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { slot_ids, date, reason = '' } = body;

    if (!Array.isArray(slot_ids) || slot_ids.length === 0) {
      return NextResponse.json({ error: 'slot_ids array is required' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const db = mongoose.connection.db!;
    let blocked = 0;

    for (const slotId of slot_ids) {
      let oid: ObjectId;
      try { oid = new ObjectId(slotId); } catch { continue; }

      const slot = await VehicleScheduleSlot.findById(oid).lean() as any;
      if (!slot) continue;

      if (!slot.date || slot.date === '') {
        // Recurring slot — create a date-specific inactive override (if not already present)
        const existing = await db.collection('vehicle_schedule_slots').findOne({
          vehicle_id: slot.vehicle_id,
          type: slot.type,
          time: slot.time,
          station_name: slot.station_name,
          date,
          status: 'inactive',
        });
        if (!existing) {
          const now = new Date();
          await db.collection('vehicle_schedule_slots').insertOne({
            vehicle_id: slot.vehicle_id,
            station_name: slot.station_name,
            type: slot.type,
            time: slot.time,
            date,
            status: 'inactive',
            block_reason: reason,
            createdAt: now,
            updatedAt: now,
          });
          blocked++;
        }
      } else {
        // Date-specific slot — mark inactive in place
        await db.collection('vehicle_schedule_slots').updateOne(
          { _id: oid },
          { $set: { status: 'inactive', block_reason: reason, updatedAt: new Date() } }
        );
        blocked++;
      }
    }

    return NextResponse.json({ blocked });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
