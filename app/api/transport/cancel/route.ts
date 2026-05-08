import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, TransportSchedule } from '@/lib/models';

// DELETE - Cancel transport request
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { request_id } = await request.json();

    if (!request_id) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
    }

    const transportRequest = await TransportRequest.findById(request_id);
    if (!transportRequest) {
      return NextResponse.json({ error: 'Transport request not found' }, { status: 404 });
    }

    transportRequest.status = 'cancelled';
    transportRequest.vehicle_id = undefined;
    await transportRequest.save();

    // Cancel associated schedule
    await TransportSchedule.findOneAndUpdate(
      { request_id },
      { status: 'cancelled' }
    );

    return NextResponse.json({ success: true, data: transportRequest });
  } catch (error: any) {
    console.error('Cancel transport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
