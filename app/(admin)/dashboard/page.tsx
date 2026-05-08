'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bus, Clock, CheckCircle, XCircle, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react'
import type { DashboardStats, TransportRequestType } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { adminFetch } from '@/lib/api-client'
import { getToken, clearAdminSession } from '@/lib/storage'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentRequests, setRecentRequests] = useState<TransportRequestType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (getToken()) {
      fetchStats()
    } else {
      // No token — force re-login to get a JWT
      clearAdminSession()
      router.push('/login')
    }
  }, [])

  const fetchStats = async () => {
    try {
      const res = await adminFetch('/api/transport/stats')
      if (res.status === 401) {
        clearAdminSession()
        router.push('/login')
        return
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Failed to fetch stats (${res.status}): ${body}`)
      }
      const data = await res.json()
      setStats(data.stats)
      setRecentRequests(data.recentRequests || [])
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Requests',
      value: stats?.totalRequests || 0,
      icon: Bus,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Pending Requests',
      value: stats?.pendingRequests || 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Confirmed Transport',
      value: stats?.confirmedTransport || 0,
      icon: CheckCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Completed Pickups',
      value: stats?.completedPickups || 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none bg-amber-50 text-amber-600">Pending</span>
      case 'confirmed':
        return <span className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none bg-blue-50 text-blue-600">Confirmed</span>
      case 'completed':
        return <span className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none bg-emerald-50 text-emerald-600">Completed</span>
      case 'cancelled':
        return <span className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none bg-red-50 text-red-600">Cancelled</span>
      default:
        return <span className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none bg-slate-50 text-slate-600">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-800">Dashboard</h1>
        <p className="text-sm font-medium text-slate-500 italic">Overview of transport booking operations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className={`p-6 rounded-[2rem] border-none shadow-sm ${card.bg} flex items-center justify-between group overflow-hidden relative`}>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.title}</p>
              <p className={`text-3xl font-black tracking-tighter ${card.color}`}>{card.value}</p>
            </div>
            <card.icon className={`h-12 w-12 ${card.color} opacity-10 absolute right-4 top-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform`} />
          </Card>
        ))}
      </div>

      {/* Recent Requests */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
        <div className="bg-slate-50/50 border-b border-slate-100 p-6">
          <h2 className="font-black text-lg text-slate-800 uppercase italic tracking-tighter">Recent Transport Requests</h2>
          <p className="text-sm font-medium text-slate-500 italic">Latest 5 transport booking requests</p>
        </div>
        <CardContent className="p-0">
          {recentRequests.length === 0 ? (
            <div className="py-16 text-center">
              <Bus className="mx-auto h-12 w-12 mb-3 text-slate-300 opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No transport requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Patient</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Station</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((req) => {
                    const sType = req.service_type || 'pickup'
                    return (
                      <tr key={req._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-800">{req.patient_name}</p>
                            <p className="text-xs text-slate-400">{req.phone_number}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                            {sType === 'pickup' && <><ArrowUp className="h-3 w-3" />Pickup</>}
                            {sType === 'drop' && <><ArrowDown className="h-3 w-3" />Drop</>}
                            {sType === 'both' && <><ArrowUpDown className="h-3 w-3" />Both</>}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {req.pickup_station && <div>{req.pickup_station}</div>}
                          {req.dropoff_station && <div className="text-orange-600">{req.dropoff_station}</div>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">{formatDate(req.appointment_date)}</td>
                        <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
