import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, PickupStation } from '@/lib/models';

export async function GET() {
  try {
    await dbConnect();

    // Get available stations
    const stations = await PickupStation.find({ status: 'active' }).lean();
    const stationNames = stations.map((s: any) => s.station_name);
    if (stationNames.length === 0) {
      stationNames.push('Chennai Central', 'Egmore', 'Koyambedu');
    }

    const testBookings = [
      {
        ic_number: '901234105678',
        patient_name: 'DEMO TEST USER',
        phone_number: '9787136232',
        doctor_name: 'Dr Navin Nair A/L Ramachendren',
        pickup_station: stationNames[0] || 'Chennai Central',
        appointment_date: new Date('2026-03-27'),
        appointment_time: '09:00 AM - 09:10 AM',
        pickup_time: '08:00',
        seats: 1,
        status: 'pending',
      },
      {
        ic_number: '901234105678',
        patient_name: 'DEMO TEST USER',
        phone_number: '9787136232',
        doctor_name: 'Dr Navin Nair A/L Ramachendren',
        pickup_station: stationNames[1] || stationNames[0] || 'Egmore',
        appointment_date: new Date('2026-03-28'),
        appointment_time: '10:30 AM - 10:40 AM',
        pickup_time: '09:30',
        seats: 2,
        status: 'pending',
      },
      {
        ic_number: '901234105678',
        patient_name: 'DEMO TEST USER',
        phone_number: '9787136232',
        doctor_name: 'Dr Navin Nair A/L Ramachendren',
        pickup_station: stationNames[0] || 'Chennai Central',
        appointment_date: new Date('2026-03-29'),
        appointment_time: '11:00 AM - 11:10 AM',
        pickup_time: '10:00',
        seats: 1,
        status: 'confirmed',
      },
      {
        ic_number: '901234105678',
        patient_name: 'DEMO TEST USER',
        phone_number: '9787136232',
        doctor_name: 'Dr Navin Nair A/L Ramachendren',
        pickup_station: stationNames[1] || stationNames[0] || 'Egmore',
        appointment_date: new Date('2026-03-30'),
        appointment_time: '02:00 PM - 02:10 PM',
        pickup_time: '12:30',
        seats: 1,
        status: 'pending',
      },
      {
        ic_number: '901234105678',
        patient_name: 'DEMO TEST USER',
        phone_number: '9787136232',
        doctor_name: 'Dr Navin Nair A/L Ramachendren',
        pickup_station: stationNames[0] || 'Chennai Central',
        appointment_date: new Date('2026-03-31'),
        appointment_time: '03:30 PM - 03:40 PM',
        pickup_time: '02:30',
        seats: 3,
        status: 'pending',
      },
    ];

    const created = await TransportRequest.insertMany(testBookings);

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} test transport bookings for DEMO TEST USER`,
      data: created,
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
