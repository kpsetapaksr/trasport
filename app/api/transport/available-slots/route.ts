import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { Vehicle, TransportRequest, TransportSettings, VehicleScheduleSlot } from '@/lib/models';

// GET - Get available transport time slots for a given date
//
// Slots are now driven by VehicleScheduleSlot records created by admin.
// Each slot ties a specific vehicle to a specific date/time/type.
//
// For PICKUP service:
//   pickup_time + travel_time must be <= appointment_time
//   (patient must arrive before appointment)
//
// For DROP service:
//   dropoff_time must be >= appointment_time + appointment_duration
//   (patient leaves after appointment ends)

const DEFAULT_SETTINGS = {
  start_time: '07:00',
  end_time: '17:00',
  interval_minutes: 30,
  buffer_before_appointment: 60,
  travel_time_minutes: 30,
  appointment_duration_minutes: 30,
  max_seats_per_slot: 0,
  enabled: true,
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Parse appointment time which can be:
//   "12:00 PM - 12:10 PM", "9:30 AM - 10:00 AM", "14:00", "09:30", etc.
// Returns the START time in 24h minutes
function parseAppointmentTime(timeStr: string): number | null {
  if (!timeStr) return null;

  const firstPart = timeStr.split('-')[0].trim();

  const match12h = firstPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12h) {
    let h = parseInt(match12h[1]);
    const m = parseInt(match12h[2]);
    const period = match12h[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  const match24h = firstPart.match(/^(\d{1,2}):(\d{2})$/);
  if (match24h) {
    const h = parseInt(match24h[1]);
    const m = parseInt(match24h[2]);
    return h * 60 + m;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const appointmentTime = searchParams.get('appointment_time');
    const serviceType = searchParams.get('service_type') || 'pickup'; // 'pickup' or 'drop'
    const station = searchParams.get('station'); // optional: filter by station name

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    // Normalize date and prepare query for multiple formats
    let normalizedDate = date;
    const dateVariations = [date, '', null];
    
    // Handle DD-MM-YYYY or DD/MM/YYYY
    const dateMatch = date.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (dateMatch) {
      const [_, d, m, y] = dateMatch;
      dateVariations.push(`${y}-${m}-${d}`);
      dateVariations.push(`${d}-${m}-${y}`); // Keep original order with dashes
      normalizedDate = `${y}-${m}-${d}`;
    } 
    // Handle YYYY-MM-DD
    else if (date.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
      const [_, y, m, d] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)!;
      dateVariations.push(`${d}-${m}-${y}`);
    }

    // 2. Fetch VehicleScheduleSlot records for this date + type
    const allScheduleSlots = await VehicleScheduleSlot.find({
      date: { $in: dateVariations },
      type: { $regex: new RegExp(`^${serviceType}$`, 'i') }
    }).populate('vehicle_id').lean();

    // 2b. Filter by station in JS (Ultra-Lenient "Nuclear" match)
    let filteredByStation = allScheduleSlots;
    let stationMatchFound = false;

    if (station) {
      const cleanTarget = station.split(' - ')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
      const matched = allScheduleSlots.filter((s: any) => {
        if (!s.station_name) return false;
        const cleanSlot = s.station_name.replace(/[^a-z0-9]/gi, '').toLowerCase();
        return cleanSlot.includes(cleanTarget) || cleanTarget.includes(cleanSlot);
      });

      if (matched.length > 0) {
        filteredByStation = matched;
        stationMatchFound = true;
      } else {
        // FALLBACK: If no match for station, show ALL slots for this date
        // so the user can at least see something and we can debug.
        filteredByStation = allScheduleSlots;
        stationMatchFound = false;
      }
    }

    // 1. Load settings (Restored)
    const settingsCollection = TransportSettings.db.collection('transport_settings');
    let settings: any = await settingsCollection.findOne({});
    if (!settings) {
      settings = DEFAULT_SETTINGS;
    }

    const travelTime = settings.travel_time_minutes || 30;
    const buffer = settings.buffer_before_appointment || 60;
    const appointmentDuration = settings.appointment_duration_minutes || 30;

    // Filter slots - ignoring 'inactive' status for now to ensure visibility
    const scheduleSlots = filteredByStation.filter((s: any) => {
      if (s.status === 'deleted') return false;
      return true;
    });

    if (scheduleSlots.length === 0) {
      return NextResponse.json({
        date,
        normalizedDate,
        dateVariations,
        serviceType,
        appointmentTime: appointmentTime || null,
        totalCapacity: 0,
        vehicleCount: 0,
        totalVehicleCapacity: 0,
        recommendedTime: '',
        slots: [],
        message: `No slots found for date: ${date}. variations tried: ${dateVariations.join(', ')}`,
        settings: {
          start_time: settings.start_time,
          end_time: settings.end_time,
          interval_minutes: settings.interval_minutes,
          buffer_before_appointment: buffer,
          travel_time_minutes: travelTime,
          appointment_duration_minutes: appointmentDuration,
        },
      });
    }

    // 3a. Driver leave & slot override filtering
    const driverIdStrings = new Set<string>();
    for (const slot of scheduleSlots) {
      const v = slot.vehicle_id as any;
      if (v?.driver_id) driverIdStrings.add(String(v.driver_id));
    }

    const blockedDriverIds = new Set<string>();
    const partialOverrideMap = new Map<string, Set<string>>();

    if (driverIdStrings.size > 0) {
      const rawDb = mongoose.connection.db!;
      const driverObjectIds = [...driverIdStrings]
        .map((id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
        .filter(Boolean);

      const [leaves, overrides] = await Promise.all([
        rawDb.collection('driver_leaves').find({
          driver_id: { $in: driverObjectIds },
          start_date: { $lte: date },
          end_date: { $gte: date },
          status: 'approved',
        }).toArray(),
        rawDb.collection('driver_slot_overrides').find({
          driver_id: { $in: driverObjectIds },
          override_date: date,
        }).toArray(),
      ]);

      for (const leave of leaves) {
        blockedDriverIds.add(String(leave.driver_id));
      }
      for (const ov of overrides) {
        const dId = String(ov.driver_id);
        if (ov.block_full_day) {
          blockedDriverIds.add(dId);
        } else if (ov.disabled_slots?.length > 0) {
          if (!partialOverrideMap.has(dId)) partialOverrideMap.set(dId, new Set());
          for (const t of ov.disabled_slots) partialOverrideMap.get(dId)!.add(t);
        }
      }
    }

    // 3. Group schedule slots by time → vehicles at that time
    const timeVehicleMap = new Map<string, any[]>();
    const allVehicleIds = new Set<string>();

    // Fetch all active vehicles once as a fallback for orphaned slots
    const activeVehicles = await mongoose.model('Vehicle').find({ status: 'active' }).lean();
    const fallbackVehicle = activeVehicles[0];

    for (const slot of scheduleSlots) {
      let v = slot.vehicle_id as any;
      
      // ORPHANED SLOT RECOVERY:
      // If the vehicle record is missing, try to use the fallback vehicle
      if (!v || !v.vehicle_name) {
        if (fallbackVehicle) {
          v = fallbackVehicle;
        } else {
          continue; // No vehicles at all in the system
        }
      }

      // skip if explicitly in maintenance
      if (v.status === 'maintenance') continue; 

      const driverId = v.driver_id ? String(v.driver_id) : null;
      // Skip vehicles whose driver is on leave or fully blocked for the day
      if (driverId && blockedDriverIds.has(driverId)) continue;

      allVehicleIds.add(String(v._id));
      if (!timeVehicleMap.has(slot.time)) {
        timeVehicleMap.set(slot.time, []);
      }
      timeVehicleMap.get(slot.time)!.push({
        _id: String(v._id),
        vehicle_name: v.vehicle_name,
        vehicle_number: v.vehicle_number,
        vehicle_type: v.vehicle_type,
        seat_capacity: v.seat_capacity || 4,
        driver_name: v.driver_name,
        driver_id: driverId,
      });
    }

    // Remove vehicles from specific time slots based on partial overrides,
    // then drop any time slot that ends up with no vehicles.
    if (partialOverrideMap.size > 0) {
      for (const [time, vehicles] of timeVehicleMap) {
        const filtered = vehicles.filter((v: any) => {
          if (!v.driver_id) return true;
          return !partialOverrideMap.get(v.driver_id)?.has(time);
        });
        if (filtered.length === 0) {
          timeVehicleMap.delete(time);
        } else {
          timeVehicleMap.set(time, filtered);
        }
      }
    }

    // Sort times
    let allSlotTimes = Array.from(timeVehicleMap.keys()).sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b)
    );

    if (allSlotTimes.length === 0) {
      return NextResponse.json({
        date,
        serviceType,
        appointmentTime: appointmentTime || null,
        totalCapacity: 0,
        vehicleCount: 0,
        totalVehicleCapacity: 0,
        recommendedTime: '',
        slots: [],
        message: 'No active vehicle slots for this date',
        settings: {
          start_time: settings.start_time,
          end_time: settings.end_time,
          interval_minutes: settings.interval_minutes,
          buffer_before_appointment: buffer,
          travel_time_minutes: travelTime,
          appointment_duration_minutes: appointmentDuration,
        },
      });
    }

    // 4. Filter by appointment time constraint
    let filteredSlots = allSlotTimes;
    let recommendedTime = '';

    // Drop-off requests MUST supply appointment_time to calculate earliest drop slot
    if (serviceType === 'drop' && !appointmentTime) {
      return NextResponse.json(
        { error: 'appointment_time is required for drop-off requests' },
        { status: 400 }
      );
    }

    if (appointmentTime) {
      const parsedAptMinutes = parseAppointmentTime(appointmentTime);

      const aptMinutes = parsedAptMinutes ?? timeToMinutes(settings.end_time);

      if (serviceType === 'drop') {
        // DROP-OFF: slot time >= appointment_time + appointment_duration
        const earliestDropMinutes = aptMinutes + appointmentDuration;

        filteredSlots = allSlotTimes.filter((slot) => {
          const slotMinutes = timeToMinutes(slot);
          return slotMinutes >= earliestDropMinutes;
        });

        // Recommended: shortly after appointment ends + small buffer
        const idealDropMinutes = aptMinutes + appointmentDuration + 15;
        if (filteredSlots.length > 0) {
          let closestDiff = Infinity;
          for (const slot of filteredSlots) {
            const diff = Math.abs(timeToMinutes(slot) - idealDropMinutes);
            if (diff < closestDiff) {
              closestDiff = diff;
              recommendedTime = slot;
            }
          }
        }
      } else {
        // PICKUP: Any slot strictly before the appointment time is valid
        // We still use travelTime for the "Recommended" calculation, but not for hiding slots.
        filteredSlots = allSlotTimes.filter((slot) => {
          const slotMinutes = timeToMinutes(slot);
          return slotMinutes < aptMinutes;
        });

        const idealPickupMinutes = aptMinutes - travelTime - Math.floor(buffer / 2);
        if (filteredSlots.length > 0) {
          let closestDiff = Infinity;
          for (const slot of filteredSlots) {
            const diff = Math.abs(timeToMinutes(slot) - idealPickupMinutes);
            if (diff < closestDiff) {
              closestDiff = diff;
              recommendedTime = slot;
            }
          }
        }
      }

      // (Removed aggressive fallback to ensure only valid times are shown)

      // Limit slots for focused display
      if (serviceType === 'pickup') {
        // Show only the 2 slots closest to the appointment time
        if (filteredSlots.length > 2) {
          filteredSlots = filteredSlots.slice(-2);
        }
      } else if (serviceType === 'drop') {
        // Limit to 3 slots for drop-off: recommended + 2 after
        if (recommendedTime && filteredSlots.length > 3) {
          const recIdx = filteredSlots.indexOf(recommendedTime);
          if (recIdx !== -1) {
            filteredSlots = filteredSlots.slice(recIdx, recIdx + 3);
          }
        }
      }
    }

    // 5. Count booked seats per slot per vehicle for this date
    const dateStart = new Date(date + 'T00:00:00+08:00');
    const dateEnd = new Date(date + 'T23:59:59+08:00');

    const timeFieldName = serviceType === 'drop' ? 'dropoff_time' : 'pickup_time';
    const timeField = serviceType === 'drop' ? '$dropoff_time' : '$pickup_time';
    const vehicleField = serviceType === 'drop' ? 'dropoff_vehicle_id' : 'vehicle_id';

    const serviceTypeMatch = serviceType === 'drop'
      ? { service_type: { $in: ['drop', 'both'] } }
      : { $or: [
          { service_type: { $in: ['pickup', 'both'] } },
          { service_type: { $exists: false } },
          { service_type: null },
        ] };

    // Aggregate booked seats per slot (total)
    const bookedRequests = await TransportRequest.aggregate([
      {
        $match: {
          appointment_date: { $gte: dateStart, $lte: dateEnd },
          [timeFieldName]: { $ne: null, $exists: true },
          status: { $in: ['pending', 'confirmed'] },
          ...serviceTypeMatch,
        },
      },
      {
        $group: {
          _id: timeField,
          bookedSeats: { $sum: { $ifNull: ['$seats', 1] } },
        },
      },
    ]);

    const bookedMap = new Map(bookedRequests.map((b: any) => [b._id, b.bookedSeats]));

    // Aggregate booked seats per slot per vehicle
    const bookedPerVehicle = await TransportRequest.aggregate([
      {
        $match: {
          appointment_date: { $gte: dateStart, $lte: dateEnd },
          [timeFieldName]: { $ne: null, $exists: true },
          [vehicleField]: { $ne: null, $exists: true },
          status: { $in: ['pending', 'confirmed'] },
          ...serviceTypeMatch,
        },
      },
      {
        $group: {
          _id: { time: timeField, vehicle: `$${vehicleField}` },
          bookedSeats: { $sum: { $ifNull: ['$seats', 1] } },
        },
      },
    ]);

    // Build map: slotTime -> vehicleId -> bookedSeats
    const vehicleBookedMap = new Map<string, Map<string, number>>();
    for (const b of bookedPerVehicle) {
      const slotTime = b._id.time;
      const vId = String(b._id.vehicle);
      if (!vehicleBookedMap.has(slotTime)) vehicleBookedMap.set(slotTime, new Map());
      vehicleBookedMap.get(slotTime)!.set(vId, b.bookedSeats);
    }

    // 6. Build slots with availability + per-vehicle breakdown
    const slots = filteredSlots.map((time) => {
      const vehicles = timeVehicleMap.get(time) || [];
      const vBookedForSlot = vehicleBookedMap.get(time) || new Map();

      // Calculate per-vehicle availability
      const vehicleAvailability = vehicles.map((v: any) => {
        const vBooked = vBookedForSlot.get(v._id) || 0;
        const vAvailable = Math.max(0, v.seat_capacity - vBooked);
        return {
          _id: v._id,
          vehicle_name: v.vehicle_name,
          vehicle_number: v.vehicle_number,
          vehicle_type: v.vehicle_type,
          seat_capacity: v.seat_capacity,
          driver_name: v.driver_name,
          booked: vBooked,
          available: vAvailable,
          isFull: vAvailable <= 0,
        };
      });

      // Total capacity for this slot = sum of all vehicle capacities at this time
      const totalCapacity = vehicles.reduce((sum: number, v: any) => sum + v.seat_capacity, 0);
      const booked = bookedMap.get(time) || 0;
      const available = Math.max(0, totalCapacity - booked);

      const slotMinutes = timeToMinutes(time);
      let arrivalTime: string;
      let description: string;
      if (serviceType === 'drop') {
        const arrivalMinutes = slotMinutes + travelTime;
        arrivalTime = minutesToTime(arrivalMinutes);
        description = `Depart clinic at ${time}, arrive at station by ${arrivalTime}`;
      } else {
        const arrivalMinutes = slotMinutes + travelTime;
        arrivalTime = minutesToTime(arrivalMinutes);
        description = `Pickup at ${time}, arrive at clinic by ${arrivalTime}`;
      }

      return {
        time,
        arrivalTime,
        description,
        totalCapacity,
        booked,
        available,
        isFull: available <= 0,
        isRecommended: time === recommendedTime,
        vehicles: vehicleAvailability,
      };
    });

    // Calculate totals
    const totalVehicleCapacity = slots.reduce((sum, s) => sum + s.totalCapacity, 0);

    return NextResponse.json({
      date,
      serviceType,
      appointmentTime: appointmentTime || null,
      totalCapacity: totalVehicleCapacity,
      vehicleCount: allVehicleIds.size,
      totalVehicleCapacity,
      recommendedTime,
      slots,
      settings: {
        start_time: settings.start_time,
        end_time: settings.end_time,
        interval_minutes: settings.interval_minutes,
        buffer_before_appointment: buffer,
        travel_time_minutes: travelTime,
        appointment_duration_minutes: appointmentDuration,
      },
    });
  } catch (error: any) {
    console.error('Available slots error:', error);
    return NextResponse.json({ error: 'Failed to fetch available slots' }, { status: 500 });
  }
}
