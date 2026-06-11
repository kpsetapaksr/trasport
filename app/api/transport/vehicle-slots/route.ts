import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { VehicleScheduleSlot } from '@/lib/models';

// GET - List all slots (optionally filtered by vehicle and/or date)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const vehicle_id = searchParams.get('vehicle_id');
    const date = searchParams.get('date');

    const filter: any = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    // Slots are date-scoped: only return slots for the exact requested date.
    if (date) filter.date = date;

    const slots = await VehicleScheduleSlot.find(filter)
      .populate('vehicle_id')
      .sort({ time: 1 })
      .lean();

    return NextResponse.json({ data: slots });
  } catch (error: any) {
    console.error('Vehicle slots GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicle slots' }, { status: 500 });
  }
}

// DELETE - Delete all slots (optionally filtered by vehicle_id)
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const vehicle_id = searchParams.get('vehicle_id');

    const filter: any = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;

    const result = await VehicleScheduleSlot.deleteMany(filter);

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('Vehicle slots DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete vehicle slots' }, { status: 500 });
  }
}

// PUT - Copy all slots from one date to another
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const { source_date, target_date } = await request.json();

    if (!source_date || !target_date) {
      return NextResponse.json({ error: 'source_date and target_date are required' }, { status: 400 });
    }

    if (source_date === target_date) {
      return NextResponse.json({ error: 'Source and target dates must be different' }, { status: 400 });
    }

    // Get all slots from source date
    const sourceSlots = await VehicleScheduleSlot.find({ date: source_date }).lean();

    if (sourceSlots.length === 0) {
      return NextResponse.json({ error: 'No slots found on source date to copy' }, { status: 404 });
    }

    // Remove existing slots on target date to avoid duplicates
    await VehicleScheduleSlot.deleteMany({ date: target_date });

    // Create copies with the new date
    const newSlots = sourceSlots.map((slot: any) => ({
      vehicle_id: slot.vehicle_id,
      station_name: slot.station_name,
      type: slot.type,
      date: target_date,
      time: slot.time,
      status: slot.status,
    }));

    const created = await VehicleScheduleSlot.insertMany(newSlots);

    return NextResponse.json({ success: true, count: created.length });
  } catch (error: any) {
    console.error('Vehicle slots PUT error:', error);
    return NextResponse.json({ error: 'Failed to copy vehicle slots' }, { status: 500 });
  }
}

const formatTime = (totalMin: number) => {
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

// POST - Bulk create slots from start_time, end_time, interval
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { vehicle_id, type, start_time, end_time, interval_minutes } = body;

    if (!vehicle_id || !type || !start_time || !end_time || !interval_minutes) {
      return NextResponse.json(
        { error: 'vehicle_id, type, start_time, end_time, and interval_minutes are required' },
        { status: 400 }
      );
    }

    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    const interval = Math.floor(parseFloat(String(interval_minutes)));

    if (!Number.isFinite(interval) || interval < 5 || interval > 480) {
      return NextResponse.json({ error: 'Interval must be between 5 and 480 minutes' }, { status: 400 });
    }

    if (startMin >= endMin) {
      return NextResponse.json({ error: 'start_time must be before end_time' }, { status: 400 });
    }

    // Resolve the list of target dates. Slots are always date-scoped:
    //   - month: 'YYYY-MM'  → every day in that month (optionally skipping weekends)
    //   - date:  'YYYY-MM-DD' → that single day
    const { date, month, skip_weekends } = body;
    let targetDates: string[];
    if (month) {
      const mm = String(month).match(/^(\d{4})-(\d{2})$/);
      if (!mm) {
        return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 });
      }
      const year = parseInt(mm[1]);
      const monthNum = parseInt(mm[2]);
      if (monthNum < 1 || monthNum > 12) {
        return NextResponse.json({ error: 'month must be between 01 and 12' }, { status: 400 });
      }
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      targetDates = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, monthNum - 1, d).getDay(); // 0=Sun … 6=Sat
        if (skip_weekends && (dow === 0 || dow === 6)) continue;
        targetDates.push(`${mm[1]}-${mm[2]}-${String(d).padStart(2, '0')}`);
      }
    } else if (date) {
      targetDates = [date];
    } else {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) or month (YYYY-MM) is required' }, { status: 400 });
    }

    if (targetDates.length === 0) {
      return NextResponse.json({ error: 'No target dates to generate (every day was skipped)' }, { status: 400 });
    }

    const slotsToCreate: any[] = [];

    if (type === 'both') {
      // ============================================================
      // BOTH mode — Round-trip logic (date-scoped: one set of slots per target date)
      //
      // Real-world flow for ONE vehicle:
      //   07:00  PICKUP @ Station   → loads patients, drives to hospital
      //   07:30  Arrive Hospital    → (travel_time = 30min)
      //   07:30  DROP   @ Hospital  → loads patients going home, drives to station
      //   08:00  Arrive Station     → (travel_time = 30min)
      //   08:00  PICKUP @ Station   → next round trip
      //
      // pickup_station = where patients board   (e.g. "Taman Melati")
      // drop_station   = hospital / destination (e.g. "Hospital KL")
      //
      // Pickup time at station:  start, start+interval, start+2*interval ...
      // Drop time at hospital:   pickup_time + travel_time
      // ============================================================

      const { pickup_station, drop_station, travel_time } = body;
      if (!pickup_station || !drop_station || !travel_time) {
        return NextResponse.json(
          { error: 'pickup_station, drop_station, and travel_time are required for both mode' },
          { status: 400 }
        );
      }
      const travelMin = parseInt(travel_time) || 30;

      for (const d of targetDates) {
        for (let m = startMin; m < endMin; m += interval) {
          // PICKUP slot — vehicle is at STATION at this time
          slotsToCreate.push({
            vehicle_id,
            station_name: pickup_station,
            type: 'pickup',
            date: d,
            time: formatTime(m),
            status: 'active',
          });

          // DROP slot — vehicle arrives at HOSPITAL after travel
          const dropTime = m + travelMin;
          if (dropTime >= 24 * 60) continue; // skip slots that overflow past midnight
          slotsToCreate.push({
            vehicle_id,
            station_name: drop_station,
            type: 'drop',
            date: d,
            time: formatTime(dropTime),
            status: 'active',
          });
        }
      }

      // Replace existing slots for this vehicle on the target dates
      await VehicleScheduleSlot.deleteMany({ vehicle_id, date: { $in: targetDates } });

    } else {
      // Single type mode (pickup or drop)
      const { station_name } = body;
      if (!station_name) {
        return NextResponse.json(
          { error: 'station_name is required for single type mode' },
          { status: 400 }
        );
      }

      for (const d of targetDates) {
        for (let m = startMin; m < endMin; m += interval) {
          slotsToCreate.push({
            vehicle_id,
            station_name,
            type,
            date: d,
            time: formatTime(m),
            status: 'active',
          });
        }
      }

      await VehicleScheduleSlot.deleteMany({ vehicle_id, type, date: { $in: targetDates }, station_name });
    }

    if (slotsToCreate.length === 0) {
      return NextResponse.json({ error: 'No time slots to create' }, { status: 400 });
    }

    const created = await VehicleScheduleSlot.insertMany(slotsToCreate);

    return NextResponse.json({ success: true, data: created, count: created.length });
  } catch (error: any) {
    console.error('Vehicle slots POST error:', error);
    return NextResponse.json({ error: 'Failed to create vehicle slots' }, { status: 500 });
  }
}
