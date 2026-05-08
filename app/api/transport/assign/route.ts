import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle, TransportSchedule } from '@/lib/models';

// PUT - Assign vehicle and pickup/dropoff time to a request
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const { request_id, vehicle_id, pickup_time, dropoff_vehicle_id, dropoff_time } = await request.json();

    if (!request_id || !vehicle_id) {
      return NextResponse.json(
        { error: 'request_id and vehicle_id are required' },
        { status: 400 }
      );
    }

    const transportRequest = await TransportRequest.findById(request_id);
    if (!transportRequest) {
      return NextResponse.json({ error: 'Transport request not found' }, { status: 404 });
    }

    const vehicle = await Vehicle.findById(vehicle_id).populate('driver_id');
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Check seat availability for the assigned vehicle + time slot
    const assignTime = pickup_time || transportRequest.pickup_time;
    if (assignTime) {
      const dateStart = new Date(transportRequest.appointment_date);
      dateStart.setUTCHours(0, 0, 0, 0);
      const dateEnd = new Date(transportRequest.appointment_date);
      dateEnd.setUTCHours(23, 59, 59, 999);

      const bookedAgg = await TransportRequest.aggregate([
        {
          $match: {
            _id: { $ne: transportRequest._id },
            vehicle_id: vehicle._id,
            pickup_time: assignTime,
            appointment_date: { $gte: dateStart, $lte: dateEnd },
            status: { $in: ['pending', 'confirmed'] },
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$seats', 1] } } } },
      ]);

      const alreadyBooked = bookedAgg[0]?.total || 0;
      const requestSeats = transportRequest.seats || 1;
      if (alreadyBooked + requestSeats > vehicle.seat_capacity) {
        return NextResponse.json(
          { error: `Vehicle is over capacity: ${alreadyBooked + requestSeats} seats needed, ${vehicle.seat_capacity} available` },
          { status: 409 }
        );
      }
    }

    // Update transport request
    transportRequest.vehicle_id = vehicle_id;
    if (pickup_time) transportRequest.pickup_time = pickup_time;
    if (dropoff_time) transportRequest.dropoff_time = dropoff_time;
    if (dropoff_vehicle_id) transportRequest.dropoff_vehicle_id = dropoff_vehicle_id;
    transportRequest.status = 'confirmed';
    await transportRequest.save();

    // Create or update transport schedule
    const driver = vehicle.driver_id as any;
    const scheduleData: any = {
      request_id,
      vehicle_id,
      pickup_time: pickup_time || transportRequest.pickup_time,
      dropoff_time: dropoff_time || transportRequest.dropoff_time,
      service_type: transportRequest.service_type || 'pickup',
      driver_name: driver?.name || '',
      driver_phone: driver?.phone || '',
      status: 'confirmed',
    };

    await TransportSchedule.findOneAndUpdate(
      { request_id },
      scheduleData,
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: transportRequest });
  } catch (error: any) {
    console.error('Assign vehicle error:', error);
    return NextResponse.json({ error: 'Failed to assign vehicle' }, { status: 500 });
  }
}
