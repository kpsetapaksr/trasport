import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle } from '@/lib/models';

// Ensure Vehicle model registered
void Vehicle;

export async function GET() {
  try {
    await dbConnect();

    // Get all transport requests with vehicle populated
    const requests = await TransportRequest.find({})
      .populate('vehicle_id')
      .lean();

    // Also get all vehicles
    const vehicles = await Vehicle.find({}).lean();

    return NextResponse.json({
      requestCount: requests.length,
      vehicleCount: vehicles.length,
      requests: requests.map((r: any) => ({
        _id: r._id,
        patient_name: r.patient_name,
        status: r.status,
        vehicle_id_raw: r.vehicle_id,
        vehicle_id_type: typeof r.vehicle_id,
        vehicle_is_object: r.vehicle_id && typeof r.vehicle_id === 'object',
      })),
      vehicles: vehicles.map((v: any) => ({
        _id: v._id,
        vehicle_name: v.vehicle_name,
        vehicle_number: v.vehicle_number,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
