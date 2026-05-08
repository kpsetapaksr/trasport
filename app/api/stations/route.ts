import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { PickupStation } from '@/lib/models';

// GET - List all stations
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const filter: any = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { station_name: { $regex: escaped, $options: 'i' } },
        { location_name: { $regex: escaped, $options: 'i' } },
      ];
    }

    const stations = await PickupStation.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: stations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create station
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    const { station_name, location_name } = body;
    if (!station_name || !location_name) {
      return NextResponse.json({ error: 'Station name and location are required' }, { status: 400 });
    }

    const station = await PickupStation.create(body);
    return NextResponse.json({ success: true, data: station }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
