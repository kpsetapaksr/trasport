'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminFetch } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, Printer, Download, RefreshCw, FileBarChart2,
} from 'lucide-react'

type Period = '1d' | '1w' | '1m' | '6m' | '1y' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: '1d', label: '1 Day' },
  { key: '1w', label: '1 Week' },
  { key: '1m', label: '1 Month' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
  { key: 'custom', label: 'Custom' },
]

function calcDates(period: Period, customStart: string, customEnd: string) {
  if (period === 'custom') return { startDate: customStart, endDate: customEnd }
  const today = new Date()
  const endDate = today.toISOString().split('T')[0]
  const start = new Date()
  if (period === '1w') start.setDate(start.getDate() - 6)
  else if (period === '1m') start.setMonth(start.getMonth() - 1)
  else if (period === '6m') start.setMonth(start.getMonth() - 6)
  else if (period === '1y') start.setFullYear(start.getFullYear() - 1)
  return { startDate: start.toISOString().split('T')[0], endDate }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  confirmed: 'bg-blue-50 text-blue-600 border-blue-100',
  pending: 'bg-amber-50 text-amber-500 border-amber-100',
  cancelled: 'bg-red-50 text-red-500 border-red-100',
}

const LEG_STYLE: Record<string, string> = {
  completed: 'text-emerald-600',
  no_show: 'text-red-500',
  pending: 'text-amber-500',
}

export default function ReportsPage() {
  const { toast } = useToast()
  const today = new Date().toISOString().split('T')[0]

  const [period, setPeriod] = useState<Period>('1m')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [vehicleId, setVehicleId] = useState('all')
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    adminFetch('/api/vehicles')
      .then(r => r.json())
      .then(d => setVehicles(d.data || []))
      .catch(() => {})
  }, [])

  const fetchReport = useCallback(async () => {
    const { startDate, endDate } = calcDates(period, customStart, customEnd)
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (vehicleId !== 'all') params.set('vehicle_id', vehicleId)
      const res = await adminFetch(`/api/transport/report?${params}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      const json = await res.json()
      setSummary(json.summary)
      setData(json.data || [])
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [period, customStart, customEnd, vehicleId])

  useEffect(() => { fetchReport() }, [fetchReport])

  const exportCSV = () => {
    const headers = ['Date', 'Patient Name', 'IC Number', 'Phone', 'Service Type', 'Vehicle', 'Pickup Status', 'Drop Status', 'Overall Status']
    const rows = data.map((r: any) => [
      formatDate(r.appointment_date),
      r.patient_name,
      r.ic_number || '',
      r.phone_number || '',
      r.service_type,
      r.vehicle_id?.vehicle_name
        ? `${r.vehicle_id.vehicle_name} (${r.vehicle_id.vehicle_number})`
        : r.dropoff_vehicle_id?.vehicle_name
        ? `${r.dropoff_vehicle_id.vehicle_name} (${r.dropoff_vehicle_id.vehicle_number})`
        : '',
      r.pickup_status || '',
      r.dropoff_status || '',
      r.status,
    ])
    const csv = [headers, ...rows]
      .map(row => row.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transport-report-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const { startDate, endDate } = calcDates(period, customStart, customEnd)
  const dateLabel = startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} — ${formatDate(endDate)}`

  const SUMMARY_CARDS = summary ? [
    { label: 'Total Bookings', value: summary.total, color: 'text-slate-700', bg: 'bg-white' },
    { label: 'Confirmed', value: summary.confirmed, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: summary.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending', value: summary.pending, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Cancelled', value: summary.cancelled, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Picked Up', value: summary.pickedUp, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Dropped Off', value: summary.droppedOff, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'No Show', value: summary.noShow, color: 'text-orange-500', bg: 'bg-orange-50' },
  ] : []

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 print:space-y-4 print:pb-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <FileBarChart2 className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase italic leading-none">Transport Report</h1>
          </div>
          <p className="text-sm font-medium text-slate-500 italic ml-10">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="rounded-2xl h-10 px-4 gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-2xl h-10 px-4 gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          {data.length > 0 && (
            <Button size="sm" onClick={exportCSV} className="rounded-2xl h-10 px-4 gap-2 shadow-lg shadow-primary/20">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 print:hidden">
        {/* Period buttons */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`h-10 px-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                period === p.key
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-primary/40 hover:text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">From</p>
              <Input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-11 rounded-2xl border-slate-200 text-sm font-bold w-44 bg-white shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">To</p>
              <Input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-11 rounded-2xl border-slate-200 text-sm font-bold w-44 bg-white shadow-sm"
              />
            </div>
          </div>
        )}

        {/* Vehicle filter */}
        <div className="flex items-center gap-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Vehicle</p>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="h-11 rounded-2xl bg-white border-slate-200 font-bold text-sm w-72 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
              <SelectItem value="all">All Vehicles</SelectItem>
              {vehicles.map(v => (
                <SelectItem key={v._id} value={v._id}>
                  {v.vehicle_name} — {v.vehicle_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SUMMARY_CARDS.map(s => (
            <Card key={s.label} className={`p-5 rounded-[2rem] border-none shadow-sm ring-1 ring-slate-100 ${s.bg}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Data Table */}
      <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Booking Records — {loading ? '...' : `${data.length} entries`}
          </p>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {loading && data.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-primary w-10 h-10 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Generating Report...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-24 text-center text-slate-400 italic text-sm">No bookings found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['#', 'Date', 'Patient Name', 'IC No.', 'Phone', 'Type', 'Vehicle', 'Pickup', 'Drop', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((r: any, i: number) => {
                  const pickupVehicle = r.vehicle_id?.vehicle_name
                    ? `${r.vehicle_id.vehicle_name} (${r.vehicle_id.vehicle_number})`
                    : null
                  const dropVehicle = r.dropoff_vehicle_id?.vehicle_name
                    ? `${r.dropoff_vehicle_id.vehicle_name} (${r.dropoff_vehicle_id.vehicle_number})`
                    : null
                  const vehicleLabel = pickupVehicle || dropVehicle || '—'

                  return (
                    <tr key={r._id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3 text-[10px] font-black text-slate-300">{i + 1}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        {formatDate(r.appointment_date)}
                      </td>
                      <td className="px-4 py-3 font-black text-sm text-slate-800 whitespace-nowrap">
                        {r.patient_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {r.ic_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {r.phone_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${
                          r.service_type === 'both' ? 'bg-purple-50 text-purple-600' :
                          r.service_type === 'pickup' ? 'bg-blue-50 text-blue-600' :
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {r.service_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        {vehicleLabel}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.service_type !== 'drop' ? (
                          <span className={`text-[9px] font-black uppercase tracking-wide ${LEG_STYLE[r.pickup_status] || 'text-slate-300'}`}>
                            {r.pickup_status?.replace('_', ' ') || '—'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-200">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.service_type !== 'pickup' ? (
                          <span className={`text-[9px] font-black uppercase tracking-wide ${LEG_STYLE[r.dropoff_status] || 'text-slate-300'}`}>
                            {r.dropoff_status?.replace('_', ' ') || '—'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-200">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLE[r.status] || 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
