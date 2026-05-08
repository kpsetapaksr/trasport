'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { adminFetch } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, ChevronLeft, ChevronRight,
  Phone, CheckCircle2, XCircle, Clock,
  ArrowUp, ArrowDown, UserSquare2, RefreshCw,
  Car, Lock, Bus, Truck, Users, MapPin,
  ChevronDown, ChevronUp, AlertCircle, CreditCard
} from 'lucide-react'

type LegStatus = 'pending' | 'completed' | 'no_show'

interface PatientRow {
  _id: string
  patient_name: string
  phone_number?: string
  appointment_time?: string
  service_type: 'pickup' | 'drop' | 'both'
  pickup_status: LegStatus
  dropoff_status: LegStatus
  pickup_station?: string
  pickup_time?: string
  dropoff_station?: string
  dropoff_time?: string
  status: string
}

const legBadge = (s: LegStatus, locked = false) => {
  if (locked) return { label: 'Waiting Pickup', cls: 'bg-slate-50 text-slate-400 border-slate-100', icon: <Lock className="w-3 h-3" /> }
  if (s === 'completed') return { label: 'Done', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> }
  if (s === 'no_show') return { label: 'No Show', cls: 'bg-red-50 text-red-500 border-red-100', icon: <XCircle className="w-3 h-3" /> }
  return { label: 'Pending', cls: 'bg-amber-50 text-amber-500 border-amber-100', icon: <Clock className="w-3 h-3" /> }
}

const vehicleIcon = (type: string) => {
  if (type === 'Bus') return <Bus className="w-5 h-5" />
  if (type === 'Van') return <Truck className="w-5 h-5" />
  return <Car className="w-5 h-5" />
}

export default function PickupMonitorPage() {
  const { toast } = useToast()
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [requests, setRequests] = useState<PatientRow[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)

  const fetchRequests = async (date: string) => {
    setLoadingRequests(true)
    try {
      const res = await adminFetch(`/api/transport/requests?date=${date}&limit=500`)
      if (!res.ok) throw new Error('Failed to fetch requests')
      const data = await res.json()
      setRequests(data.data || [])
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchVehicles = async () => {
    setLoadingVehicles(true)
    try {
      const res = await adminFetch('/api/vehicles')
      if (!res.ok) throw new Error('Failed to fetch vehicles')
      const data = await res.json()
      setVehicles(data.data || [])
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingVehicles(false)
    }
  }

  useEffect(() => { fetchVehicles() }, [])
  useEffect(() => {
    fetchRequests(selectedDate)
    const interval = setInterval(() => fetchRequests(selectedDate), 30000)
    return () => clearInterval(interval)
  }, [selectedDate])

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const formatTime12h = (t?: string | null) => {
    if (!t) return '--:--'
    if (/AM|PM/i.test(t)) return t
    try {
      const [h, m] = t.split(':').map(Number)
      return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
    } catch { return t }
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const loading = loadingRequests || loadingVehicles

  // ── Map each request to its vehicle ids ──
  const getVehicleId = (req: any) =>
    req.vehicle_id?._id ? String(req.vehicle_id._id) : req.vehicle_id ? String(req.vehicle_id) : null
  const getDropVehicleId = (req: any) =>
    req.dropoff_vehicle_id?._id ? String(req.dropoff_vehicle_id._id) : req.dropoff_vehicle_id ? String(req.dropoff_vehicle_id) : null

  // Count patients per vehicle (for selector cards)
  const patientCountByVehicle = useMemo(() => {
    const map: Record<string, number> = {}
    for (const req of requests) {
      const vid = getVehicleId(req as any)
      const dvid = getDropVehicleId(req as any)
      if (vid) map[vid] = (map[vid] || 0) + 1
      else if (dvid) map[dvid] = (map[dvid] || 0) + 1
    }
    return map
  }, [requests])

  // Patients for selected vehicle (or all if none selected)
  const filteredPatients = useMemo(() => {
    if (!selectedVehicleId) return requests as any[]
    return (requests as any[]).filter(req => {
      const vid = getVehicleId(req)
      const dvid = getDropVehicleId(req)
      return vid === selectedVehicleId || dvid === selectedVehicleId
    })
  }, [requests, selectedVehicleId])

  // Selected vehicle object (with populated driver)
  const selectedVehicle = selectedVehicleId ? vehicles.find(v => String(v._id) === selectedVehicleId) : null

  // Unassigned patients (no vehicle on either leg)
  const unassignedPatients = useMemo(() =>
    (requests as any[]).filter(req => !getVehicleId(req) && !getDropVehicleId(req)),
    [requests]
  )

  // ── Overall summary ──
  const total = requests.length
  const pickedUp = requests.filter(r => r.pickup_status === 'completed').length
  const droppedOff = requests.filter(r => r.dropoff_status === 'completed').length
  const noShows = requests.filter(r => r.pickup_status === 'no_show' || r.dropoff_status === 'no_show').length
  const pending = requests.filter(r => r.pickup_status === 'pending' && r.dropoff_status === 'pending').length

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase italic leading-none">Pickup Monitor</h1>
          <p className="text-sm font-medium text-slate-500 italic">Select a date and vehicle to view patient status.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchRequests(selectedDate); fetchVehicles() }} className="rounded-2xl h-10 px-5 gap-2 self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* ── Date Selector ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-[2rem] p-2 shadow-sm ring-1 ring-slate-100">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center px-3 min-w-[180px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{isToday ? 'Today' : 'Selected Date'}</p>
            <p className="text-sm font-black text-slate-800">{formatDate(selectedDate)}</p>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <Input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="h-11 rounded-2xl border-slate-200 text-sm font-bold w-40 bg-white shadow-sm"
        />
        {!isToday && (
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="h-11 px-5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
            Today
          </button>
        )}
      </div>

      {/* ── Overall Summary Counts ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-slate-700', bg: 'bg-white' },
          { label: 'Picked Up', value: pickedUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Dropped Off', value: droppedOff, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'No Show', value: noShows, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Pending', value: pending, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map(s => (
          <Card key={s.label} className={`p-5 rounded-[2rem] border-none shadow-sm ring-1 ring-slate-100 ${s.bg}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary w-10 h-10 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading...</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Vehicle Selector ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Vehicle</p>
              {selectedVehicleId && (
                <button onClick={() => setSelectedVehicleId(null)} className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline">
                  Clear Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {/* All vehicles card */}
              <button
                onClick={() => setSelectedVehicleId(null)}
                className={`text-left p-5 rounded-[2rem] border-2 transition-all hover:shadow-md ${
                  !selectedVehicleId
                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${!selectedVehicleId ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-slate-800">All Vehicles</p>
                    <p className="text-[10px] font-bold text-slate-400">{total} patients</p>
                  </div>
                </div>
              </button>

              {vehicles.map(v => {
                const vid = String(v._id)
                const count = patientCountByVehicle[vid] || 0
                const isSelected = selectedVehicleId === vid
                const driver = v.driver_id

                return (
                  <button
                    key={vid}
                    onClick={() => setSelectedVehicleId(vid)}
                    className={`text-left p-5 rounded-[2rem] border-2 transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Vehicle image or icon */}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {v.image ? (
                          <img src={v.image} alt={v.vehicle_name} className="w-full h-full object-cover" />
                        ) : (
                          vehicleIcon(v.vehicle_type)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-800 truncate">{v.vehicle_name}</p>
                        <p className="text-[10px] font-bold text-slate-500 font-mono">{v.vehicle_number}</p>
                        {driver?.name && (
                          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{driver.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${count > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                            {count} patient{count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400">
                            {v.seat_capacity} seats
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Selected Vehicle Details + Patients ── */}
          {selectedVehicle && (
            <VehicleDetailPanel
              vehicle={selectedVehicle}
              patients={filteredPatients}
              formatTime12h={formatTime12h}
            />
          )}

          {/* ── All vehicles view (no filter selected) ── */}
          {!selectedVehicle && (
            <AllVehiclesView
              vehicles={vehicles}
              requests={requests as any[]}
              patientCountByVehicle={patientCountByVehicle}
              getVehicleId={getVehicleId}
              getDropVehicleId={getDropVehicleId}
              formatTime12h={formatTime12h}
              onSelectVehicle={setSelectedVehicleId}
              unassigned={unassignedPatients}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Vehicle Detail Panel (when one vehicle is selected) ──
function VehicleDetailPanel({ vehicle, patients, formatTime12h }: {
  vehicle: any
  patients: any[]
  formatTime12h: (t?: string | null) => string
}) {
  const driver = vehicle.driver_id
  const pickedUp = patients.filter(p => p.pickup_status === 'completed').length
  const droppedOff = patients.filter(p => p.dropoff_status === 'completed').length
  const noShows = patients.filter(p => p.pickup_status === 'no_show' || p.dropoff_status === 'no_show').length
  const pending = patients.filter(p => p.pickup_status === 'pending' && p.dropoff_status === 'pending').length

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Vehicle + Driver info card */}
      <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">

          {/* Vehicle side */}
          <div className="p-6 space-y-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vehicle</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-[1.5rem] bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 text-slate-300">
                {vehicle.image ? (
                  <img src={vehicle.image} alt={vehicle.vehicle_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-slate-300">{vehicleIcon(vehicle.vehicle_type)}</div>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-xl text-slate-800 tracking-tighter italic uppercase leading-none">{vehicle.vehicle_name}</h3>
                <p className="font-mono font-black text-sm text-primary">{vehicle.vehicle_number}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge className="rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-200">
                    {vehicle.vehicle_type}
                  </Badge>
                  <Badge className="rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {vehicle.seat_capacity} seats
                  </Badge>
                  <Badge className={`rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>
                    {vehicle.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Driver side */}
          <div className="p-6 space-y-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Driver</p>
            {driver ? (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-[1.5rem] bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                  {driver.image ? (
                    <img src={driver.image} alt={driver.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserSquare2 className="w-9 h-9 text-slate-200" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-xl text-slate-800 tracking-tighter italic uppercase leading-none">{driver.name}</h3>
                  <a href={`tel:${driver.phone}`} className="text-[11px] font-bold text-primary flex items-center gap-1.5 hover:underline">
                    <Phone className="w-3.5 h-3.5" /> {driver.phone}
                  </a>
                  {driver.id_card_number && (
                    <p className="text-[11px] font-mono font-bold text-slate-500 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" /> {driver.id_card_number}
                    </p>
                  )}
                  <Badge className={`rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border mt-1 ${driver.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                    {driver.isActive ? 'On Duty' : 'Off Duty'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-400 py-4">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-bold italic">No driver assigned to this vehicle</p>
              </div>
            )}
          </div>
        </div>

        {/* Per-vehicle stats bar */}
        <div className="border-t border-slate-100 grid grid-cols-4 divide-x divide-slate-100">
          {[
            { label: 'Patients', value: patients.length, color: 'text-slate-700' },
            { label: 'Picked Up', value: pickedUp, color: 'text-blue-600' },
            { label: 'Dropped', value: droppedOff, color: 'text-emerald-600' },
            { label: 'No Show', value: noShows, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Patient list */}
      <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Patient Manifest — {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        {patients.length === 0 ? (
          <div className="py-16 text-center text-slate-400 italic text-sm">No patients assigned to this vehicle for this date.</div>
        ) : (
          <PatientTable patients={patients} formatTime12h={formatTime12h} />
        )}
      </Card>
    </div>
  )
}

// ── All Vehicles View (default, no filter) ──
function AllVehiclesView({ vehicles, requests, patientCountByVehicle, getVehicleId, getDropVehicleId, formatTime12h, onSelectVehicle, unassigned }: {
  vehicles: any[]
  requests: any[]
  patientCountByVehicle: Record<string, number>
  getVehicleId: (r: any) => string | null
  getDropVehicleId: (r: any) => string | null
  formatTime12h: (t?: string | null) => string
  onSelectVehicle: (id: string) => void
  unassigned: any[]
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const vehiclesWithPatients = vehicles
    .map(v => {
      const vid = String(v._id)
      const patients = requests.filter(r => getVehicleId(r) === vid || getDropVehicleId(r) === vid)
      return { ...v, patients }
    })
    .filter(v => v.patients.length > 0)

  return (
    <div className="space-y-4">
      {vehiclesWithPatients.map(v => {
        const vid = String(v._id)
        const driver = v.driver_id
        const isExpanded = !!expanded[vid]
        const pickedUp = v.patients.filter((p: any) => p.pickup_status === 'completed').length
        const droppedOff = v.patients.filter((p: any) => p.dropoff_status === 'completed').length
        const noShows = v.patients.filter((p: any) => p.pickup_status === 'no_show' || p.dropoff_status === 'no_show').length
        const pending = v.patients.filter((p: any) => p.pickup_status === 'pending' && p.dropoff_status === 'pending').length

        return (
          <Card key={vid} className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
            {/* Clickable header */}
            <button
              onClick={() => toggle(vid)}
              className="w-full p-6 flex flex-col sm:flex-row sm:items-center gap-4 text-left hover:bg-slate-50/50 transition-colors"
            >
              {/* Vehicle + driver info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-[1.5rem] bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 text-slate-300">
                  {v.image ? (
                    <img src={v.image} alt={v.vehicle_name} className="w-full h-full object-cover" />
                  ) : vehicleIcon(v.vehicle_type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base text-slate-800 tracking-tighter italic uppercase">{v.vehicle_name}</h3>
                    <span className="font-mono text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{v.vehicle_number}</span>
                  </div>
                  {driver ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        {driver.image ? <img src={driver.image} className="w-full h-full object-cover" /> : <UserSquare2 className="w-full h-full text-slate-300" />}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 truncate">{driver.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5"><Phone className="w-3 h-3" />{driver.phone}</span>
                      {driver.id_card_number && (
                        <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-0.5"><CreditCard className="w-3 h-3" />{driver.id_card_number}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-orange-400 italic mt-0.5">No driver assigned</p>
                  )}
                </div>
              </div>

              {/* Stats chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {v.patients.length} patient{v.patients.length !== 1 ? 's' : ''}
                </span>
                {pickedUp > 0 && <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[9px] font-black uppercase tracking-widest text-blue-600">{pickedUp} picked</span>}
                {droppedOff > 0 && <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[9px] font-black uppercase tracking-widest text-emerald-600">{droppedOff} dropped</span>}
                {noShows > 0 && <span className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-[9px] font-black uppercase tracking-widest text-red-500">{noShows} no-show</span>}
                {pending > 0 && <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[9px] font-black uppercase tracking-widest text-amber-500">{pending} pending</span>}
                <span className="text-slate-300 ml-1">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </div>
            </button>

            {/* Expanded patient list */}
            {isExpanded && (
              <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                <PatientTable patients={v.patients} formatTime12h={formatTime12h} />
              </div>
            )}
          </Card>
        )
      })}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-orange-100 overflow-hidden">
          <div className="p-5 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <div>
              <p className="font-black text-sm text-orange-600 uppercase tracking-tight italic">Unassigned — No Vehicle</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-orange-300">{unassigned.length} patient{unassigned.length !== 1 ? 's' : ''} awaiting assignment</p>
            </div>
          </div>
          <PatientTable patients={unassigned} formatTime12h={formatTime12h} />
        </Card>
      )}

      {vehiclesWithPatients.length === 0 && unassigned.length === 0 && (
        <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic text-slate-400 text-sm">
          No transport requests for this date.
        </div>
      )}
    </div>
  )
}

// ── Reusable Patient Table ──
function PatientTable({ patients, formatTime12h }: { patients: any[], formatTime12h: (t?: string | null) => string }) {
  return (
    <div className="divide-y divide-slate-50">
      {patients.map((p: any, i: number) => {
        const pickupResolved = p.pickup_status === 'completed' || p.pickup_status === 'no_show'
        const dropLocked = p.service_type === 'both' && !pickupResolved
        const pickupBadge = legBadge(p.pickup_status)
        const dropBadge = legBadge(p.dropoff_status, dropLocked)

        return (
          <div key={p._id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50/30 transition-colors">
            {/* Row number + patient info */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 truncate">{p.patient_name}</p>
                <div className="flex flex-wrap items-center gap-3 mt-0.5">
                  {p.phone_number && (
                    <a href={`tel:${p.phone_number}`} className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline">
                      <Phone className="w-3 h-3" /> {p.phone_number}
                    </a>
                  )}
                  {p.appointment_time && (
                    <span className="text-[10px] font-bold text-slate-400">Appt: {formatTime12h(p.appointment_time)}</span>
                  )}
                  {/* Station info */}
                  {(p.service_type === 'pickup' || p.service_type === 'both') && p.pickup_station && (
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {p.pickup_station}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
              {(p.service_type === 'pickup' || p.service_type === 'both') && (
                <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${pickupBadge.cls}`}>
                  <ArrowUp className="w-3 h-3" />
                  {pickupBadge.icon}
                  <span>{pickupBadge.label}</span>
                  {p.pickup_time && <span className="opacity-50">· {formatTime12h(p.pickup_time)}</span>}
                </div>
              )}
              {(p.service_type === 'drop' || p.service_type === 'both') && (
                <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${dropBadge.cls}`}>
                  <ArrowDown className="w-3 h-3" />
                  {dropBadge.icon}
                  <span>{dropBadge.label}</span>
                  {p.dropoff_time && <span className="opacity-50">· {formatTime12h(p.dropoff_time)}</span>}
                </div>
              )}
              <Badge className={`rounded-xl px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border ${
                p.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                p.status === 'cancelled' ? 'bg-red-50 text-red-500 border-red-100' :
                p.status === 'confirmed' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                'bg-slate-50 text-slate-400 border-slate-100'
              }`}>
                {p.status}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}
