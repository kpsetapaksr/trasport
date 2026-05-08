import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest } from '@/lib/models';

// POST - Create transport request
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    const {
      ic_number,
      appointment_id,
      patient_name,
      phone_number,
      doctor_name,
      service_type = 'pickup',
      pickup_station,
      appointment_date,
      appointment_time,
      pickup_time,
      dropoff_station,
      dropoff_time,
      vehicle_id,
      dropoff_vehicle_id,
      seats,
      transport_required,
    } = body;

    if (!ic_number || !patient_name || !appointment_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate seats (explicit parse — do NOT use || 1 which makes 0 pass as 1)
    const seatCount = seats !== undefined && seats !== null ? Number(seats) : 1;
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 20) {
      return NextResponse.json({ error: 'Seats must be between 1 and 20' }, { status: 400 });
    }

    // Validate IC number format (10–12 digits)
    const cleanedICRaw = ic_number.replace(/[-\s]/g, '').trim();
    if (!/^[0-9]{10,12}$/.test(cleanedICRaw)) {
      return NextResponse.json({ error: 'Invalid IC number format (10–12 digits required)' }, { status: 400 });
    }

    // Strip all non-digit chars; if result isn't 10–11 digits, discard silently (don't block booking)
    const digitsOnly = phone_number ? phone_number.replace(/\D/g, '') : '';
    const cleanedPhone = /^[0-9]{10,11}$/.test(digitsOnly) ? digitsOnly : '';

    // Validate appointment date
    if (!appointment_date || isNaN(Date.parse(appointment_date))) {
      return NextResponse.json({ error: 'Invalid appointment date' }, { status: 400 });
    }

    // Validate service-specific fields
    if ((service_type === 'pickup' || service_type === 'both') && !pickup_station) {
      return NextResponse.json(
        { error: 'Pickup station is required for pickup service' },
        { status: 400 }
      );
    }
    if ((service_type === 'drop' || service_type === 'both') && !dropoff_station) {
      return NextResponse.json(
        { error: 'Drop-off station is required for drop service' },
        { status: 400 }
      );
    }

    // Check if a transport request already exists for this IC + date + service_type (prevent duplicates)
    const cleanedIC = cleanedICRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dateStart = new Date(appointment_date + 'T00:00:00+08:00');
    const dateEnd = new Date(appointment_date + 'T23:59:59+08:00');

    const duplicateFilter: any = {
      ic_number: { $regex: new RegExp(`^${cleanedIC}$`, 'i') },
      appointment_date: { $gte: dateStart, $lte: dateEnd },
      status: { $in: ['pending', 'confirmed', 'completed'] },
    };

    // For 'both', block if any booking exists for this date
    // For 'pickup', check same type or 'both' (include old records with no service_type)
    // For 'drop', check 'drop' or 'both'
    if (service_type === 'both') {
      // block if any booking exists — no extra filter needed
    } else if (service_type === 'pickup') {
      duplicateFilter.$or = [
        { service_type: 'pickup' },
        { service_type: 'both' },
        { service_type: { $exists: false } }, // old records without service_type = pickup
        { service_type: null },
      ];
    } else {
      // drop
      duplicateFilter.$or = [
        { service_type: 'drop' },
        { service_type: 'both' },
      ];
    }

    const existing = await TransportRequest.findOne(duplicateFilter);

    if (existing) {
      const typeLabel = service_type === 'both' ? 'transport' : service_type;
      return NextResponse.json(
        { error: `You already have a ${typeLabel} request for this appointment date` },
        { status: 409 }
      );
    }

    const transportRequest = await TransportRequest.create({
      ic_number: cleanedIC,
      appointment_id,
      patient_name,
      phone_number: cleanedPhone,
      doctor_name,
      service_type,
      pickup_station: (service_type === 'pickup' || service_type === 'both') ? pickup_station : undefined,
      appointment_date: new Date(appointment_date),
      appointment_time,
      pickup_time: (service_type === 'pickup' || service_type === 'both') ? pickup_time : undefined,
      dropoff_station: (service_type === 'drop' || service_type === 'both') ? dropoff_station : undefined,
      dropoff_time: (service_type === 'drop' || service_type === 'both') ? dropoff_time : undefined,
      vehicle_id: (service_type === 'pickup' || service_type === 'both') ? vehicle_id : undefined,
      dropoff_vehicle_id: (service_type === 'drop' || service_type === 'both') ? dropoff_vehicle_id : undefined,
      seats: seatCount,
      transport_required: transport_required ?? true,
      status: 'pending',
    });

    return NextResponse.json({ success: true, data: transportRequest }, { status: 201 });
  } catch (error: any) {
    // MongoDB duplicate key — race condition caught at DB level
    if (error.code === 11000) {
      return NextResponse.json({ error: 'A transport request for this date already exists' }, { status: 409 });
    }
    console.error('Create transport request error:', error);
    return NextResponse.json({ error: 'Failed to create transport request' }, { status: 500 });
  }
}
