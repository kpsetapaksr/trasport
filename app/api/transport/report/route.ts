import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { TransportRequest } from '@/lib/models'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(req.url)

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const vehicleId = searchParams.get('vehicle_id')

    const query: any = {}

    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setUTCHours(23, 59, 59, 999)
      query.appointment_date = { $gte: start, $lte: end }
    }

    if (vehicleId && vehicleId !== 'all') {
      const oid = new mongoose.Types.ObjectId(vehicleId)
      query.$or = [{ vehicle_id: oid }, { dropoff_vehicle_id: oid }]
    }

    const requests = await TransportRequest.find(query)
      .populate('vehicle_id', 'vehicle_name vehicle_number vehicle_type')
      .populate('dropoff_vehicle_id', 'vehicle_name vehicle_number vehicle_type')
      .sort({ appointment_date: -1, appointment_time: 1 })
      .limit(2000)
      .lean()

    const total = requests.length
    const completed = requests.filter((r: any) => r.status === 'completed').length
    const confirmed = requests.filter((r: any) => r.status === 'confirmed').length
    const pending = requests.filter((r: any) => r.status === 'pending').length
    const cancelled = requests.filter((r: any) => r.status === 'cancelled').length
    const pickedUp = requests.filter((r: any) => r.pickup_status === 'completed').length
    const droppedOff = requests.filter((r: any) => r.dropoff_status === 'completed').length
    const noShow = requests.filter((r: any) => r.pickup_status === 'no_show' || r.dropoff_status === 'no_show').length

    return NextResponse.json({
      summary: { total, completed, confirmed, pending, cancelled, pickedUp, droppedOff, noShow },
      data: requests,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
