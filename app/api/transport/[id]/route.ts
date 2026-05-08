import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, TransportSchedule } from '@/lib/models';
import { verifyToken } from '@/lib/auth';

// GET - Get single transport request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const transportRequest = await TransportRequest.findById(id).populate('vehicle_id').populate('dropoff_vehicle_id').lean();
    if (!transportRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: transportRequest });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update transport request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    // Identify who is making the update
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const tokenPayload = token ? await verifyToken(token) : null;
    const updaterRole = tokenPayload?.role ?? null;

    // Whitelist allowed fields
    const allowedFields: Record<string, any> = {};
    const allowed = ['status', 'pickup_status', 'dropoff_status', 'vehicle_id', 'dropoff_vehicle_id', 'pickup_station', 'dropoff_station', 'pickup_time', 'dropoff_time', 'seats'];
    for (const key of allowed) {
      if (body[key] !== undefined) allowedFields[key] = body[key];
    }

    // Record who changed status/leg status
    if (allowedFields.status || allowedFields.pickup_status || allowedFields.dropoff_status) {
      allowedFields.status_updated_by = updaterRole;
      allowedFields.status_updated_at = new Date();
    }

    const transportRequest = await TransportRequest.findByIdAndUpdate(
      id,
      { $set: allowedFields },
      { new: true }
    ).populate('vehicle_id').populate('dropoff_vehicle_id');

    if (!transportRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Auto-resolve: if both legs are done/no_show, update overall status
    if (allowedFields.pickup_status || allowedFields.dropoff_status) {
      const pStatus = transportRequest.pickup_status;
      const dStatus = transportRequest.dropoff_status;
      const sType = transportRequest.service_type;

      const pickupResolved = sType === 'drop' || pStatus === 'completed' || pStatus === 'no_show';
      const dropResolved = sType === 'pickup' || dStatus === 'completed' || dStatus === 'no_show';

      if (pickupResolved && dropResolved && transportRequest.status !== 'completed' && transportRequest.status !== 'cancelled') {
        // If pickup was no_show, auto-mark drop as no_show too (patient never arrived)
        if (pStatus === 'no_show' && sType === 'both' && dStatus === 'pending') {
          transportRequest.dropoff_status = 'no_show';
        }
        // If ALL legs are no_show, mark as cancelled; otherwise completed
        const finalPickup = transportRequest.pickup_status;
        const finalDrop = transportRequest.dropoff_status;
        const allNoShow = (sType === 'both' && finalPickup === 'no_show' && finalDrop === 'no_show')
          || (sType === 'pickup' && finalPickup === 'no_show')
          || (sType === 'drop' && finalDrop === 'no_show');
        transportRequest.status = allNoShow ? 'cancelled' : 'completed';
        await transportRequest.save();
      }
    }

    // Sync status with schedule if status changed
    if (allowedFields.status || transportRequest.status === 'completed') {
      await TransportSchedule.findOneAndUpdate(
        { request_id: id },
        { status: transportRequest.status }
      );
    }

    return NextResponse.json({ success: true, data: transportRequest });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
