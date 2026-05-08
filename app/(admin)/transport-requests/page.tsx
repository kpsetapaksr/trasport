'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Search, Truck, Clock, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown,
  ArrowUpDown, Calendar, Filter, MapPin, Bus, UserCheck, Phone, User, MoreHorizontal, Loader2
} from 'lucide-react'
import type { TransportRequestType, VehicleType } from '@/lib/types'
import { adminFetch } from '@/lib/api-client'

// Consistency helper for 12h time
const formatTime12h = (timeStr: string | undefined | null) => {
  if (!timeStr) return '--:--'
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) return timeStr
  try {
    const [hours, minutes] = timeStr.split(':')
    const h = parseInt(hours)
    const m = minutes || '00'
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${m} ${ampm}`
  } catch { return timeStr }
}

export default function TransportRequestsPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<TransportRequestType[]>([])
  const [vehicles, setVehicles] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all')
  const [selectedDateFilter, setSelectedDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<TransportRequestType | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedDropoffVehicle, setSelectedDropoffVehicle] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [dropoffTime, setDropoffTime] = useState('')
  const [assigning, setAssigning] = useState(false)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (serviceTypeFilter !== 'all') params.set('service_type', serviceTypeFilter)
      if (search) params.set('search', search)
      if (selectedDateFilter) params.set('date', selectedDateFilter)

      const res = await adminFetch(`/api/transport/requests?${params}`)
      if (!res.ok) throw new Error('Failed to fetch requests')
      const data = await res.json()
      setRequests(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch {
      toast({ title: 'Error', description: 'Failed to sync operations', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [page, statusFilter, serviceTypeFilter, search, selectedDateFilter])

  const fetchVehicles = async () => {
    try {
      const res = await adminFetch('/api/vehicles?status=active')
      if (!res.ok) throw new Error('Failed to fetch vehicles')
      const data = await res.json()
      setVehicles(data.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load vehicles', variant: 'destructive' })
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchVehicles()
  }, [fetchRequests])

  const handleAssign = async () => {
    if (!selectedRequest || !selectedVehicle) return
    setAssigning(true)
    try {
      const res = await adminFetch('/api/transport/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest._id,
          vehicle_id: selectedVehicle,
          dropoff_vehicle_id: selectedDropoffVehicle || selectedVehicle,
          pickup_time: pickupTime || undefined,
          dropoff_time: dropoffTime || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Dispatched', description: 'Assignment complete.' })
      setAssignOpen(false)
      fetchRequests()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setAssigning(false) }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await adminFetch(`/api/transport/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast({ title: 'Status Updated', description: `Request marked as ${newStatus}` })
      fetchRequests()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const stats = useMemo(() => ({
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    completed: requests.filter(r => r.status === 'completed').length,
  }), [requests])

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Fleet Operations</h1>
          <p className="text-sm font-medium text-slate-500 italic">Real-time daily journey control</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3 md:space-y-0 md:flex md:flex-row md:items-center md:justify-between md:gap-4">

        {/* Row 1 mobile: Date Picker */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const base = selectedDateFilter || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
              const d = new Date(base + 'T12:00:00')
              d.setDate(d.getDate() - 1)
              setSelectedDateFilter(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))
            }}
            className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div className="relative flex-1 min-w-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="date"
              className="pl-10 h-11 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 w-full"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              const base = selectedDateFilter || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
              const d = new Date(base + 'T12:00:00')
              d.setDate(d.getDate() + 1)
              setSelectedDateFilter(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))
            }}
            className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
          {selectedDateFilter && (
            <button
              onClick={() => setSelectedDateFilter('')}
              className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-400 transition-colors shrink-0"
              title="Clear Date"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Row 2 mobile: Status Filter Tabs */}
        <div className="p-1.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {['all', 'pending', 'confirmed', 'completed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest whitespace-nowrap shrink-0 ${
                statusFilter === s
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white'
              }`}
            >
              {s} ({s === 'all' ? requests.length : (stats as any)[s] || 0})
            </button>
          ))}
        </div>

        {/* Row 3 mobile: Search + Service Type */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search..."
              className="pl-9 h-11 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/10 shadow-inner w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-slate-50 border-none font-bold w-[130px] shrink-0">
              <SelectValue placeholder="Service All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pickup">Pickups</SelectItem>
              <SelectItem value="drop">Drops</SelectItem>
              <SelectItem value="both">Both Legs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Badges Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-[2rem] border-none shadow-sm bg-amber-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-600/70">Pending</p>
          <p className="text-2xl font-black tracking-tighter text-amber-700">{stats.pending}</p>
        </div>
        <div className="p-4 rounded-[2rem] border-none shadow-sm bg-blue-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-600/70">Confirmed</p>
          <p className="text-2xl font-black tracking-tighter text-blue-700">{stats.confirmed}</p>
        </div>
        <div className="p-4 rounded-[2rem] border-none shadow-sm bg-emerald-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70">Completed</p>
          <p className="text-2xl font-black tracking-tighter text-emerald-700">{stats.completed}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                <th className="px-6 py-4">Patient Profile</th>
                <th className="px-6 py-4">Journey Leg(s)</th>
                <th className="px-6 py-4">Appt Period</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mt-3">Loading operations</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No requests found</p>
                  </td>
                </tr>
              ) : requests.map((req) => {
                const vehicle = typeof req.vehicle_id === 'object' ? req.vehicle_id as VehicleType : null
                const isPickup = req.service_type === 'pickup' || req.service_type === 'both'
                const isDrop = req.service_type === 'drop' || req.service_type === 'both'

                return (
                  <tr key={req._id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          req.status === 'completed' ? 'bg-emerald-50 text-emerald-500' :
                          req.status === 'cancelled' ? 'bg-red-50 text-red-400' :
                          'bg-slate-50 text-slate-400'
                        }`}>
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-slate-800 leading-none truncate">{req.patient_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{req.ic_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col gap-1">
                        {isPickup && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <ArrowUp className="w-3 h-3 text-primary opacity-70" />
                            <span className="font-semibold">{req.pickup_station || 'Home'}</span>
                            <span className="text-slate-400 font-normal">@ {formatTime12h(req.pickup_time)}</span>
                          </div>
                        )}
                        {isDrop && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <ArrowDown className="w-3 h-3 text-orange-400 opacity-70" />
                            <span className="font-semibold">{req.dropoff_station || 'Home'}</span>
                            <span className="text-slate-400 font-normal">@ {formatTime12h(req.dropoff_time)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[11px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-700 font-semibold">{new Date(req.appointment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3 h-3 opacity-30" />
                          <span>{req.appointment_time}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <Badge className={`rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none ${
                          req.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                          req.status === 'confirmed' ? 'bg-blue-50 text-blue-600' :
                          req.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-red-50 text-red-500'
                        }`}>
                          {req.status}
                        </Badge>
                        {req.status_updated_by ? (
                          <div className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest ${
                            req.status_updated_by === 'driver'
                              ? 'bg-violet-50 text-violet-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span>{req.status_updated_by === 'driver' ? '🚌 By Driver' : '👤 By Admin'}</span>
                            {req.status_updated_at && (
                              <span className="font-normal normal-case tracking-normal opacity-70">
                                {new Date(req.status_updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                {' · '}
                                {new Date(req.status_updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-300 uppercase tracking-widest">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {vehicle && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 text-[10px] font-bold text-slate-500">
                            <Truck className="w-3 h-3 opacity-30" /> {vehicle.vehicle_number}
                          </div>
                        )}

                        {req.status !== 'completed' && req.status !== 'cancelled' && (
                          <Button size="sm" onClick={() => {
                            setSelectedRequest(req);
                            setSelectedVehicle(typeof req.vehicle_id === 'object' ? (req.vehicle_id as any)?._id : req.vehicle_id || '');
                            setSelectedDropoffVehicle(typeof req.dropoff_vehicle_id === 'object' ? (req.dropoff_vehicle_id as any)?._id : req.dropoff_vehicle_id || '');
                            setPickupTime(req.pickup_time || '');
                            setDropoffTime(req.dropoff_time || '');
                            setAssignOpen(true);
                          }} className="rounded-xl shadow-xl shadow-primary/20 h-9 px-4 text-[10px] font-black uppercase tracking-widest">
                            {req.status === 'confirmed' ? 'Edit' : 'Dispatch'}
                          </Button>
                        )}

                        <Select onValueChange={(v) => handleStatusUpdate(req._id, v)}>
                          <SelectTrigger className="h-8 w-8 p-0 border-none bg-transparent hover:bg-slate-50 rounded-xl outline-none ring-0 focus:ring-0">
                            <MoreHorizontal className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="confirmed">Confirm All</SelectItem>
                            <SelectItem value="completed">Finish Trip</SelectItem>
                            <SelectItem value="cancelled">Abort Trip</SelectItem>
                            <SelectItem value="pending">Back to Pool</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-6 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-xl h-9 px-4 text-[10px] font-black uppercase tracking-widest"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="rounded-xl h-9 px-4 text-[10px] font-black uppercase tracking-widest"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Dispatch Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] max-h-[90vh] flex flex-col [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">
          <div className="bg-primary p-10 text-white relative">
            <div className="absolute top-6 right-16 opacity-10">
              <Truck className="w-20 h-20" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-white/50">{selectedRequest?.patient_name}</DialogDescription>
              <DialogTitle className="text-2xl font-black italic tracking-tighter text-white">Assignment Sync</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-10 space-y-8 bg-white overflow-y-auto flex-1">
            <div className="space-y-6">
              {(selectedRequest?.service_type === 'pickup' || selectedRequest?.service_type === 'both') && (
                <div className="space-y-5 p-6 bg-slate-50 rounded-[2rem]">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><ArrowUp className="w-3.5 h-3.5" /> Pickup Leg</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Vehicle</Label>
                      <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                        <SelectTrigger className="h-14 rounded-2xl bg-white border-none font-bold">
                          <SelectValue placeholder="Select shuttle..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => <SelectItem key={v._id} value={v._id}>{v.vehicle_name} ({v.vehicle_number})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</Label>
                      <Input type="time" className="h-14 rounded-2xl bg-white border-none font-bold" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              {(selectedRequest?.service_type === 'drop' || selectedRequest?.service_type === 'both') && (
                <div className="space-y-5 p-6 bg-orange-50/50 rounded-[2rem]">
                  <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-2"><ArrowDown className="w-3.5 h-3.5" /> Return Leg</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Vehicle</Label>
                      <Select value={selectedDropoffVehicle} onValueChange={setSelectedDropoffVehicle}>
                        <SelectTrigger className="h-14 rounded-2xl bg-white border-none font-bold">
                          <SelectValue placeholder="Select shuttle..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => <SelectItem key={v._id} value={v._id}>{v.vehicle_name} ({v.vehicle_number})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</Label>
                      <Input type="time" className="h-14 rounded-2xl bg-white border-none font-bold" value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-3 sm:flex-row">
              <Button variant="ghost" onClick={() => setAssignOpen(false)} className="flex-1 h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button onClick={handleAssign} disabled={!selectedVehicle || assigning} className="flex-[2] h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest">
                {assigning ? 'Saving...' : 'Confirm Sync'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
