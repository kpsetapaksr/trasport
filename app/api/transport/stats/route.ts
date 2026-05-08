import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest } from '@/lib/models';

// GET - Dashboard statistics
export async function GET() {
  try {
    await dbConnect();

    const [totalRequests, pendingRequests, confirmedTransport, completedPickups] =
      await Promise.all([
        TransportRequest.countDocuments(),
        TransportRequest.countDocuments({ status: 'pending' }),
        TransportRequest.countDocuments({ status: 'confirmed' }),
        TransportRequest.countDocuments({ status: 'completed' }),
      ]);

    // Recent requests
    const recentRequests = await TransportRequest.find()
      .populate('vehicle_id')
      .populate('dropoff_vehicle_id')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Stats by date (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await TransportRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return NextResponse.json({
      stats: {
        totalRequests,
        pendingRequests,
        confirmedTransport,
        completedPickups,
      },
      recentRequests,
      dailyStats,
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
