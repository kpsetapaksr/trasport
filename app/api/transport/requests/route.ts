import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest } from '@/lib/models';

// GET - List all transport requests
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const serviceType = searchParams.get('service_type');
    const date = searchParams.get('date');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50'));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (date) {
      const startOfDay = new Date(date + 'T00:00:00+08:00');
      const endOfDay = new Date(date + 'T23:59:59+08:00');
      filter.appointment_date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (serviceType && serviceType !== 'all') {
      filter.service_type = serviceType;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { patient_name: { $regex: escaped, $options: 'i' } },
        { phone_number: { $regex: escaped, $options: 'i' } },
        { ic_number: { $regex: escaped, $options: 'i' } },
        { pickup_station: { $regex: escaped, $options: 'i' } },
        { dropoff_station: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [requests, total] = await Promise.all([
      TransportRequest.find(filter)
        .populate({ path: 'vehicle_id', populate: { path: 'driver_id' } })
        .populate({ path: 'dropoff_vehicle_id', populate: { path: 'driver_id' } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TransportRequest.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List transport requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch transport requests' }, { status: 500 });
  }
}
