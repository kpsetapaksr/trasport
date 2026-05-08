import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, TransportSchedule } from '@/lib/models';

// POST - Rebook: cancel old request and create a new one
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    const {
      old_request_id,
      service_type,
      pickup_station,
      pickup_time,
      dropoff_station,
      dropoff_time,
      vehicle_id,
      dropoff_vehicle_id,
    } = body;

    if (!old_request_id) {
      return NextResponse.json({ error: 'old_request_id is required' }, { status: 400 });
    }

    // 1. Find the old request
    const oldRequest = await TransportRequest.findById(old_request_id);
    if (!oldRequest) {
      return NextResponse.json({ error: 'Original transport request not found' }, { status: 404 });
    }

    if (oldRequest.status === 'completed') {
      return NextResponse.json({ error: 'Cannot rebook a completed trip' }, { status: 400 });
    }

    // 2. Cancel the old request if not already cancelled
    if (oldRequest.status !== 'cancelled') {
      oldRequest.status = 'cancelled';
      oldRequest.vehicle_id = undefined;
      oldRequest.dropoff_vehicle_id = undefined;
      await oldRequest.save();

      await TransportSchedule.findOneAndUpdate(
        { request_id: old_request_id },
        { status: 'cancelled' }
      );
    }

    // 3. Check for an existing active request with the same IC + date + service_type
    const newServiceType = service_type || oldRequest.service_type;
    const dateStart = new Date(oldRequest.appointment_date);
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(oldRequest.appointment_date);
    dateEnd.setUTCHours(23, 59, 59, 999);

    const duplicateCheck = await TransportRequest.findOne({
      _id: { $ne: old_request_id },
      ic_number: oldRequest.ic_number,
      appointment_date: { $gte: dateStart, $lte: dateEnd },
      service_type: newServiceType,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (duplicateCheck) {
      return NextResponse.json(
        { error: 'An active transport request already exists for this date' },
        { status: 409 }
      );
    }

    const newRequest = await TransportRequest.create({
      ic_number: oldRequest.ic_number,
      appointment_id: oldRequest.appointment_id,
      patient_name: oldRequest.patient_name,
      phone_number: oldRequest.phone_number,
      doctor_name: oldRequest.doctor_name,
      service_type: newServiceType,
      pickup_station: (newServiceType === 'pickup' || newServiceType === 'both')
        ? (pickup_station || oldRequest.pickup_station)
        : undefined,
      appointment_date: oldRequest.appointment_date,
      appointment_time: oldRequest.appointment_time,
      pickup_time: (newServiceType === 'pickup' || newServiceType === 'both')
        ? (pickup_time || undefined)
        : undefined,
      dropoff_station: (newServiceType === 'drop' || newServiceType === 'both')
        ? (dropoff_station || oldRequest.dropoff_station)
        : undefined,
      dropoff_time: (newServiceType === 'drop' || newServiceType === 'both')
        ? (dropoff_time || undefined)
        : undefined,
      vehicle_id: (newServiceType === 'pickup' || newServiceType === 'both')
        ? (vehicle_id || undefined)
        : undefined,
      dropoff_vehicle_id: (newServiceType === 'drop' || newServiceType === 'both')
        ? (dropoff_vehicle_id || undefined)
        : undefined,
      seats: oldRequest.seats || 1,
      transport_required: true,
      status: 'pending',
    });

    const populated = await TransportRequest.findById(newRequest._id)
      .populate({ path: 'vehicle_id', populate: { path: 'driver_id' } })
      .populate({ path: 'dropoff_vehicle_id', populate: { path: 'driver_id' } })
      .lean();

    return NextResponse.json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: populated,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: 'A transport request for this date already exists' }, { status: 409 });
    }
    console.error('Rebook transport error:', error);
    return NextResponse.json({ error: 'Failed to rebook transport' }, { status: 500 });
  }
}
