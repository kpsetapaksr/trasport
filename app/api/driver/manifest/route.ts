import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle } from '@/lib/models';
import { getClinicalModels } from '@/lib/clinical-models';

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
    const manifestRaw = await TransportRequest.find({
      appointment_date: { $gte: dayStart, $lte: dayEnd },
      $or: [
        { vehicle_id: { $in: vehicleIds } },
        { dropoff_vehicle_id: { $in: vehicleIds } }
      ],
      status: { $in: ['pending', 'confirmed', 'completed'] }
    })
    .sort({ pickup_time: 1, dropoff_time: 1 })
    .lean();

    // Enrich with fallback phone from Appointment if missing
    const { Appointment } = await getClinicalModels();
    const manifest = await Promise.all(manifestRaw.map(async (trip: any) => {
      let phoneNumber = trip.phone_number;

      // If phone_number is missing or just "null"/empty, try to find it
      if (!phoneNumber || phoneNumber === 'null' || phoneNumber === '') {
        // 1. Try by appointment_id
        if (trip.appointment_id) {
          const appt = (await Appointment.findOne({ id: trip.appointment_id }).lean()) as any;
          if (appt?.patientPhone) {
            phoneNumber = appt.patientPhone;
          }
        }

        // 2. Fallback to IC + Date if still no phone
        if ((!phoneNumber || phoneNumber === 'null' || phoneNumber === '') && trip.ic_number) {
          const d = new Date(trip.appointment_date);
          const dStr = d.toISOString().split('T')[0]; 
          const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          // Clean IC for regex
          const cleanedIC = trip.ic_number.replace(/[-\s]/g, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const dashIC = cleanedIC.length === 12
            ? `${cleanedIC.slice(0, 6)}-${cleanedIC.slice(6, 8)}-${cleanedIC.slice(8)}`
            : cleanedIC;

          const appt = (await Appointment.findOne({ 
            $or: [
              { patientIC: { $regex: new RegExp(`^${cleanedIC}$`, 'i') } },
              { patientIC: { $regex: new RegExp(`^${dashIC}$`, 'i') } }
            ],
            appointmentDate: { $in: [dStr, localStr] }
          }).lean()) as any;
          
          if (appt?.patientPhone) {
            phoneNumber = appt.patientPhone;
          }
        }

        // 3. Last resort: search by IC regardless of date (get most recent)
        if ((!phoneNumber || phoneNumber === 'null' || phoneNumber === '') && trip.ic_number) {
          const cleanedIC = trip.ic_number.replace(/[-\s]/g, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const dashIC = cleanedIC.length === 12
            ? `${cleanedIC.slice(0, 6)}-${cleanedIC.slice(6, 8)}-${cleanedIC.slice(8)}`
            : cleanedIC;

          const anyAppt = (await Appointment.findOne({ 
            $or: [
              { patientIC: { $regex: new RegExp(`^${cleanedIC}$`, 'i') } },
              { patientIC: { $regex: new RegExp(`^${dashIC}$`, 'i') } }
            ],
            patientPhone: { $exists: true, $ne: '' }
          }).sort({ appointmentDate: -1 }).lean()) as any;
          
          if (anyAppt?.patientPhone) {
            phoneNumber = anyAppt.patientPhone;
          }
        }
      }

      return { ...trip, phone_number: phoneNumber };
    }));

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
