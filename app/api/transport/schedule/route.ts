import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle } from '@/lib/models';

// GET - Vehicle-based transport schedule for a given date
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    const dateStart = new Date(date + 'T00:00:00.000Z');
    const dateEnd = new Date(date + 'T23:59:59.999Z');

    // Get all vehicles
    const vehicles = await Vehicle.find().sort({ vehicle_name: 1 }).lean();

    // Get all transport requests for this date (non-cancelled)
    const requests = await TransportRequest.find({
      appointment_date: { $gte: dateStart, $lte: dateEnd },
      status: { $in: ['pending', 'confirmed', 'completed'] },
    })
      .populate('vehicle_id')
      .populate('dropoff_vehicle_id')
      .sort({ pickup_time: 1, dropoff_time: 1 })
      .lean();

    // Build schedule per vehicle
    const schedule = vehicles.map((vehicle: any) => {
      const vId = String(vehicle._id);

      // Pickup trips for this vehicle
      const pickupTrips = requests
        .filter((r: any) => {
          const assignedId = r.vehicle_id?._id ? String(r.vehicle_id._id) : String(r.vehicle_id);
          const sType = r.service_type || 'pickup';
          return assignedId === vId && (sType === 'pickup' || sType === 'both');
        })
        .map((r: any) => ({
          _id: r._id,
          type: 'pickup' as const,
          time: r.pickup_time || '',
          patient_name: r.patient_name,
          phone_number: r.phone_number,
          ic_number: r.ic_number,
          station: r.pickup_station,
          appointment_time: r.appointment_time,
          seats: r.seats || 1,
          status: r.status,
          service_type: r.service_type || 'pickup',
        }));

      // Drop-off trips for this vehicle
      const dropoffTrips = requests
        .filter((r: any) => {
          const sType = r.service_type || 'pickup';
          if (sType === 'drop') {
            // For drop-only requests, check dropoff_vehicle_id first, fall back to vehicle_id
            const dropVId = r.dropoff_vehicle_id?._id ? String(r.dropoff_vehicle_id._id) : String(r.dropoff_vehicle_id);
            const assignedId = r.vehicle_id?._id ? String(r.vehicle_id._id) : String(r.vehicle_id);
            return dropVId === vId || assignedId === vId;
          }
          if (sType === 'both') {
            const dropVId = r.dropoff_vehicle_id?._id ? String(r.dropoff_vehicle_id._id) : String(r.dropoff_vehicle_id);
            return dropVId === vId;
          }
          return false;
        })
        .map((r: any) => ({
          _id: r._id,
          type: 'drop' as const,
          time: r.dropoff_time || '',
          patient_name: r.patient_name,
          phone_number: r.phone_number,
          ic_number: r.ic_number,
          station: r.dropoff_station,
          appointment_time: r.appointment_time,
          seats: r.seats || 1,
          status: r.status,
          service_type: r.service_type || 'pickup',
        }));

      // Combine and sort all trips by time
      const allTrips = [...pickupTrips, ...dropoffTrips].sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      const totalSeats = allTrips.reduce((sum, t) => sum + t.seats, 0);

      return {
        vehicle: {
          _id: vId,
          vehicle_name: vehicle.vehicle_name,
          vehicle_number: vehicle.vehicle_number,
          vehicle_type: vehicle.vehicle_type,
          seat_capacity: vehicle.seat_capacity,
          driver_name: vehicle.driver_name,
          driver_phone: vehicle.driver_phone,
          status: vehicle.status,
        },
        trips: allTrips,
        totalTrips: allTrips.length,
        totalSeats,
        pickupCount: pickupTrips.length,
        dropoffCount: dropoffTrips.length,
      };
    });

    // Also get unassigned requests (no vehicle_id)
    const unassigned = requests
      .filter((r: any) => !r.vehicle_id)
      .map((r: any) => ({
        _id: r._id,
        type: (r.service_type === 'drop' ? 'drop' : 'pickup') as 'pickup' | 'drop',
        time: r.pickup_time || r.dropoff_time || '',
        patient_name: r.patient_name,
        phone_number: r.phone_number,
        ic_number: r.ic_number,
        station: r.pickup_station || r.dropoff_station,
        appointment_time: r.appointment_time,
        seats: r.seats || 1,
        status: r.status,
        service_type: r.service_type || 'pickup',
      }));

    return NextResponse.json({
      date,
      schedule,
      unassigned,
      summary: {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter((v: any) => v.status === 'active').length,
        totalTrips: requests.length,
        unassignedCount: unassigned.length,
      },
    });
  } catch (error: any) {
    console.error('Schedule error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
