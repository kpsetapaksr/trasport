import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // 1. Find Driver
    const { Driver } = await import('@/lib/models');
    const driver = await Driver.findOne({ phone }).lean();
    if (!driver) {
      return NextResponse.json({ error: 'Driver credentials not found. Contact Admin.' }, { status: 404 });
    }

    // 2. Find Vehicles assigned to this driver ID
    const vehicles = await Vehicle.find({ driver_id: driver._id }).lean();
    const vehicleIds = vehicles.map(v => v._id);

    if (vehicleIds.length === 0) {
      return NextResponse.json({ error: 'No active vehicle assigned to your ID.' }, { status: 404 });
    }

    // Date filter — use ?date= param or default to today
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0,0,0,0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23,59,59,999);

    // Find all requests for these vehicles on the target date
    const manifest = await TransportRequest.find({
      appointment_date: { $gte: dayStart, $lte: dayEnd },
      $or: [
        { vehicle_id: { $in: vehicleIds } },
        { dropoff_vehicle_id: { $in: vehicleIds } }
      ],
      status: { $in: ['pending', 'confirmed', 'completed'] }
    })
    .sort({ pickup_time: 1, dropoff_time: 1 })
    .lean();

    return NextResponse.json({
      data: manifest,
      date: dayStart.toISOString().split('T')[0],
      driverProfile: driver,
      vehicleContext: vehicles[0]
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
