import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle } from '@/lib/models';
import { getClinicalModels } from '@/lib/clinical-models';

// Ensure Vehicle model is registered for populate
void Vehicle;

// POST - Look up the patient's latest upcoming appointment by IC number
// Appointments & Doctors come from the clinical database
// Transport requests come from the transport database
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { Appointment, Doctor } = await getClinicalModels();
    const { ic_number } = await request.json();

    if (!ic_number) {
      return NextResponse.json({ error: 'IC number is required' }, { status: 400 });
    }

    const cleanedIC = ic_number.replace(/[-\s]/g, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Try both cleaned and dashed IC formats
    const dashIC = cleanedIC.length === 12
      ? `${cleanedIC.slice(0, 6)}-${cleanedIC.slice(6, 8)}-${cleanedIC.slice(8)}`
      : cleanedIC;

    let appointments = await Appointment.find({
      patientIC: { $regex: new RegExp(`^${cleanedIC}$`, 'i') },
      appointmentDate: { $gte: todayStr },
      status: { $in: ['pending', 'confirmed'] },
    })
      .sort({ appointmentDate: 1, timeSlot: 1 })
      .lean();

    if (!appointments || appointments.length === 0) {
      appointments = await Appointment.find({
        patientIC: dashIC,
        appointmentDate: { $gte: todayStr },
        status: { $in: ['pending', 'confirmed'] },
      })
        .sort({ appointmentDate: 1, timeSlot: 1 })
        .lean();
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({
        found: false,
        message: 'No upcoming appointment found for this IC number',
      });
    }

    // Fetch doctor details
    const doctorIds = [...new Set(appointments.map((a: any) => a.doctorId))];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    const validObjectIds = doctorIds.filter(id => objectIdRegex.test(id));
    const doctorQuery = validObjectIds.length > 0
      ? { $or: [{ id: { $in: doctorIds } }, { _id: { $in: validObjectIds } }] }
      : { id: { $in: doctorIds } };
    const doctors = await Doctor.find(doctorQuery).lean();
    const doctorMap = new Map(doctors.map((d: any) => [d.id || d._id?.toString(), d]));

    // Check for existing transport bookings for this IC (include completed to prevent re-booking)
    const existingTransport = await TransportRequest.find({
      ic_number: { $regex: new RegExp(`^${cleanedIC}$`, 'i') },
      status: { $in: ['pending', 'confirmed', 'completed'] },
    })
      .populate('vehicle_id')
      .populate('dropoff_vehicle_id')
      .sort({ appointment_date: 1 })
      .lean();

    // Build maps: by appointment_id AND by date for matching
    const transportByAptId = new Map<string, any>();
    const transportByDate = new Map<string, any>();
    for (const t of existingTransport) {
      // Match by appointment_id (most reliable)
      if (t.appointment_id) {
        transportByAptId.set(t.appointment_id, t);
      }
      // Also match by date - handle timezone by normalizing both ways
      const d = new Date(t.appointment_date);
      // UTC date string
      const utcKey = d.toISOString().split('T')[0];
      transportByDate.set(utcKey, t);
      // Also store local date string (handles timezone offset)
      const localKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      transportByDate.set(localKey, t);
    }

    // Debug logs removed for production security

    // Group transport records by appointment (deduplicated)
    const transportByAptIdGroup = new Map<string, any[]>();
    const transportByDateGroup = new Map<string, any[]>();
    const seenIds = new Set<string>();

    for (const t of existingTransport) {
      const tId = String(t._id);
      if (seenIds.has(tId)) continue;
      seenIds.add(tId);

      if (t.appointment_id) {
        const key = t.appointment_id;
        if (!transportByAptIdGroup.has(key)) transportByAptIdGroup.set(key, []);
        transportByAptIdGroup.get(key)!.push(t);
      }
      // Also index by date for fallback matching
      const d = new Date(t.appointment_date);
      const utcKey = d.toISOString().split('T')[0];
      const localKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // Use both keys but store reference to same array
      const dateKey = utcKey; // primary key
      if (!transportByDateGroup.has(dateKey)) transportByDateGroup.set(dateKey, []);
      transportByDateGroup.get(dateKey)!.push(t);
      if (localKey !== dateKey && !transportByDateGroup.has(localKey)) {
        transportByDateGroup.set(localKey, transportByDateGroup.get(dateKey)!);
      }
    }

    // Enrich appointments with doctor info and transport booking status
    const enriched = appointments.map((apt: any) => {
      const doctor = doctorMap.get(apt.doctorId);
      // Try matching by appointment_id first, then by date
      const transports = transportByAptIdGroup.get(apt.id) || transportByDateGroup.get(apt.appointmentDate) || [];
      const transport = transportByAptId.get(apt.id) || transportByDate.get(apt.appointmentDate) || null;

      // Determine which service types are already booked
      const bookedTypes = new Set(transports.map((t: any) => t.service_type || 'pickup'));
      const pickupBooked = bookedTypes.has('pickup') || bookedTypes.has('both');
      const dropBooked = bookedTypes.has('drop') || bookedTypes.has('both');
      // "transportBooked" = true if at least one transport exists (for backward compat)
      // AND both pickup & drop are covered
      const hasAnyBooking = transports.length > 0;
      const allBooked = pickupBooked && dropBooked;

      return {
        ...apt,
        doctorName: doctor?.name || 'Unknown',
        doctorSpecialization: doctor?.specialization || '',
        transportBooked: allBooked,
        hasAnyBooking,
        pickupBooked,
        dropBooked,
        transportBooking: transport,
        transportBookings: transports,
      };
    });

    return NextResponse.json({
      found: true,
      appointment: enriched[0],
      allAppointments: enriched,
    });
  } catch (error: any) {
    console.error('Check appointment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
