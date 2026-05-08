import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { VehicleScheduleSlot } from '@/lib/models';

// PUT - Update a slot.
// If ?date=YYYY-MM-DD is provided and the slot is global (date=''),
// a date-specific override is created/updated instead of touching the global slot.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forDate = searchParams.get('date');
    const body = await request.json();

    const slot = await VehicleScheduleSlot.findById(id).lean() as any;
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    // If editing a recurring slot for a specific date, create/update a date-specific override
    if (forDate && (!slot.date || slot.date === '')) {
      const newTime = body.time ?? slot.time;
      const timeChanged = newTime !== slot.time;

      if (timeChanged) {
        // Time changed: hide the original recurring slot for this date,
        // then create a new date-specific slot at the new time.

        // 1. Ensure an inactive override exists for the original time
        const existingOriginal = await VehicleScheduleSlot.findOne({
          vehicle_id: slot.vehicle_id,
          type: slot.type,
          time: slot.time,
          station_name: slot.station_name,
          date: forDate,
        });
        if (existingOriginal) {
          await VehicleScheduleSlot.findByIdAndUpdate(existingOriginal._id, {
            $set: { status: 'inactive', block_reason: `Time moved to ${newTime}` },
          });
        } else {
          await VehicleScheduleSlot.create({
            vehicle_id: slot.vehicle_id,
            station_name: slot.station_name,
            type: slot.type,
            time: slot.time,
            date: forDate,
            status: 'inactive',
            block_reason: `Time moved to ${newTime}`,
          });
        }

        // 2. Create the new date-specific slot at the new time
        //    (if one already exists at newTime, update it)
        const existingNew = await VehicleScheduleSlot.findOne({
          vehicle_id: slot.vehicle_id,
          type: slot.type,
          time: newTime,
          date: forDate,
        });
        let result;
        if (existingNew) {
          result = await VehicleScheduleSlot.findByIdAndUpdate(
            existingNew._id,
            { $set: { station_name: body.station_name ?? slot.station_name, status: body.status ?? 'active', block_reason: body.block_reason ?? '' } },
            { new: true }
          );
        } else {
          result = await VehicleScheduleSlot.create({
            vehicle_id: slot.vehicle_id,
            station_name: body.station_name ?? slot.station_name,
            type: slot.type,
            time: newTime,
            date: forDate,
            status: body.status ?? 'active',
            block_reason: body.block_reason ?? '',
          });
        }
        return NextResponse.json({ success: true, data: result, dateOverride: true, timeChanged: true });
      }

      // Time unchanged: create/update a date-specific override
      const existing = await VehicleScheduleSlot.findOne({
        vehicle_id: slot.vehicle_id,
        type: slot.type,
        time: slot.time,
        station_name: slot.station_name,
        date: forDate,
      });

      if (existing) {
        const updated = await VehicleScheduleSlot.findByIdAndUpdate(
          existing._id,
          { $set: { ...body, date: forDate } },
          { new: true }
        );
        return NextResponse.json({ success: true, data: updated, dateOverride: true });
      } else {
        const created = await VehicleScheduleSlot.create({
          vehicle_id: slot.vehicle_id,
          station_name: body.station_name ?? slot.station_name,
          type: slot.type,
          time: body.time ?? slot.time,
          date: forDate,
          status: body.status ?? slot.status,
          block_reason: body.block_reason ?? '',
        });
        return NextResponse.json({ success: true, data: created, dateOverride: true });
      }
    }

    // Normal update for date-specific slots (or no date param given)
    const updated = await VehicleScheduleSlot.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );
    if (!updated) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a slot
// If ?date=YYYY-MM-DD is provided and the slot is global (date=''),
// create a date-specific inactive override instead of deleting globally.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forDate = searchParams.get('date');

    const slot = await VehicleScheduleSlot.findById(id);
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    // If a specific date is given and the slot is global (no date),
    // create a date-specific inactive override instead of deleting
    if (forDate && (!slot.date || slot.date === '')) {
      // Check if override already exists
      const existing = await VehicleScheduleSlot.findOne({
        vehicle_id: slot.vehicle_id,
        station_name: slot.station_name,
        type: slot.type,
        time: slot.time,
        date: forDate,
      });

      if (existing) {
        // Update existing override to inactive
        existing.status = 'inactive';
        await existing.save();
      } else {
        // Create a date-specific inactive override
        await VehicleScheduleSlot.create({
          vehicle_id: slot.vehicle_id,
          station_name: slot.station_name,
          type: slot.type,
          time: slot.time,
          date: forDate,
          status: 'inactive',
        });
      }

      return NextResponse.json({ success: true, override: true });
    }

    // Otherwise delete normally (date-specific slot or no date param)
    await VehicleScheduleSlot.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
