'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { driverFetch } from '@/lib/api-client'
import { setDriverToken } from '@/lib/storage'
import {
  Truck, Phone, User,
  Clock, CheckCircle2, ArrowRight,
  Loader2, LogOut, Navigation,
  ArrowUp, ArrowDown,
  Calendar, ShieldCheck, Timer,
  Key, Eye, EyeOff, Bus, XCircle, AlertTriangle, Lock, MoreHorizontal
} from 'lucide-react'

interface DriverTrip {
  _id: string
  patient_name: string
  ic_number: string
  phone_number?: string
  appointment_time?: string
  service_type: 'pickup' | 'drop' | 'both'
  pickup_station?: string
  pickup_time?: string
  dropoff_station?: string
  dropoff_time?: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  pickup_status: 'pending' | 'completed' | 'no_show'
  dropoff_status: 'pending' | 'completed' | 'no_show'
  vehicle_id?: string
  dropoff_vehicle_id?: string
  seats?: number
}

export default function DriverOpsConsole() {
  const { toast } = useToast()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [trips, setTrips] = useState<DriverTrip[]>([])
  const [driverInfo, setDriverInfo] = useState<any>(null)
  const [vehicleInfo, setVehicleInfo] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const savedPhone = localStorage.getItem('driver_phone')
    if (savedPhone) {
      setIsAuthenticated(true)
      setPhone(savedPhone)
      fetchManifest(savedPhone, selectedDate)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && phone) {
      fetchManifest(phone, selectedDate)
    }
  }, [selectedDate])

  const fetchManifest = async (p: string, date?: string) => {
    setLoading(true)
    try {
      const dateParam = date || selectedDate
      const res = await driverFetch(`/api/driver/manifest?phone=${p}&date=${dateParam}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTrips(data.data || [])
      setDriverInfo(data.driverProfile)
      setVehicleInfo(data.vehicleContext)
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' })
      if (err.message.includes('credentials')) handleLogout()
    } finally {
      setLoading(false)
    }
  }

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${day}`)
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  const handleLogin = async () => {
    if (!phone || !password) {
      toast({ title: 'Credentials Required', description: 'Enter UserID and Password.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const authRes = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      })
      const authData = await authRes.json()
      if (!authRes.ok) throw new Error(authData.error)
      setIsAuthenticated(true)
      localStorage.setItem('driver_phone', phone)
      setDriverToken(authData.token)
      toast({ title: 'Identity Verified', description: `Welcome on duty.` })
      fetchManifest(phone)
    } catch (err: any) {
      toast({ title: 'Access Denied', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleLegUpdate = async (id: string, leg: 'pickup' | 'dropoff', action: 'completed' | 'no_show') => {
    setActionLoadingId(id + leg)
    try {
      const field = leg === 'pickup' ? 'pickup_status' : 'dropoff_status'
      const res = await driverFetch(`/api/transport/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: action }),
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      setTrips(prev => prev.map(t => t._id === id ? { ...t, ...data.data } : t))
      const label = leg === 'pickup' ? 'Pickup' : 'Drop-off'
      toast({
        title: action === 'no_show' ? 'No Show Recorded' : 'Confirmed',
        description: `${label} marked as ${action === 'no_show' ? 'no-show' : 'completed'}`
      })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await driverFetch(`/api/transport/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()
      setTrips(prev => prev.map(t => t._id === id ? { ...t, ...data.data } : t))
      toast({ title: 'Status Updated', description: `Trip marked as ${newStatus}` })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    setPhone('')
    setPassword('')
    setIsAuthenticated(false)
    setTrips([])
    setDriverInfo(null)
    setVehicleInfo(null)
  }

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

  // --- Derived stats ---
  const totalPickups = trips.filter(t => t.service_type === 'pickup' || t.service_type === 'both').length
  const totalDropoffs = trips.filter(t => t.service_type === 'drop' || t.service_type === 'both').length
  const donePickups = trips.filter(t => (t.service_type === 'pickup' || t.service_type === 'both') && t.pickup_status === 'completed').length
  const doneDropoffs = trips.filter(t => (t.service_type === 'drop' || t.service_type === 'both') && t.dropoff_status === 'completed').length
  const noShows = trips.filter(t => t.pickup_status === 'no_show' || t.dropoff_status === 'no_show').length

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
        <div className="w-full max-w-sm space-y-8 animate-in zoom-in-95 duration-500">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-primary rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/30 relative">
              <div className="absolute inset-0 bg-white/10 rounded-[2rem] animate-ping opacity-20" />
              <Truck className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">Operations</h1>
            <p className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-500">Integrated ShuttleSync Network</p>
          </div>

          <Card className="p-10 rounded-[3rem] bg-white border-none shadow-2xl space-y-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">UserID (Mobile)</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Registered Number"
                    className="h-14 pl-12 text-lg rounded-2xl bg-slate-50 border-none font-mono text-slate-800 focus:ring-2 focus:ring-primary/20"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Access Password</Label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-14 pl-12 text-lg rounded-2xl bg-slate-50 border-none font-mono text-slate-800 focus:ring-2 focus:ring-primary/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={handleLogin} disabled={loading} className="w-full h-16 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-primary/20">
              {loading ? <Loader2 className="animate-spin" /> : <>Log On Duty <ArrowRight className="ml-2 w-5 h-5" /></>}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      {/* Header */}
      <header className="relative bg-slate-900 text-white overflow-hidden rounded-b-[4rem] shadow-2xl">
        <div className="absolute inset-0 opacity-20 filter saturate-0">
          {vehicleInfo?.image ? (
            <img src={vehicleInfo.image} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Bus className="w-48 h-48 opacity-10" /></div>
          )}
        </div>

        <div className="relative z-10 p-8 pb-20 space-y-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-[1.8rem] overflow-hidden shadow-2xl border-4 border-white/10 p-0.5">
                {driverInfo?.image ? (
                  <img src={driverInfo.image} className="w-full h-full object-cover rounded-[1.5rem]" />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary"><User className="w-8 h-8" /></div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter leading-none italic uppercase">{driverInfo?.name || 'On-Duty Officer'}</h2>
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 leading-none">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Personnel
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-12 h-12 bg-white/5 hover:bg-red-500 rounded-full flex items-center justify-center transition-all active:scale-90 border border-white/10">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] text-slate-800 flex items-center justify-between shadow-xl ring-1 ring-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Assigned Unit</p>
                <h4 className="text-lg font-black tracking-tighter leading-none italic">{vehicleInfo?.vehicle_name || 'Fleet Unit'}</h4>
              </div>
            </div>
            <Badge className="bg-slate-900 text-white font-mono text-[9px] px-3 py-1 rounded-xl uppercase tracking-widest border-none">
              {vehicleInfo?.vehicle_number || 'SYNC-X'}
            </Badge>
          </div>
        </div>

        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          <div className="px-5 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Operational Pulse Active</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 -mt-10 relative z-20 space-y-4">
        {/* Date Navigator */}
        <Card className="rounded-[2.5rem] border-none shadow-xl p-4 flex items-center justify-between">
          <button onClick={() => changeDate(-1)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-all active:scale-90">
            <ArrowUp className="w-4 h-4 text-slate-400 -rotate-90" />
          </button>
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isToday ? 'Today' : 'Schedule'}</p>
            <p className="text-sm font-black text-slate-800 tracking-tight">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => changeDate(1)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-all active:scale-90">
            <ArrowUp className="w-4 h-4 text-slate-400 rotate-90" />
          </button>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-2xl font-black text-slate-800">{trips.length}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-2xl font-black text-blue-500">{donePickups}/{totalPickups}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pickup</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-2xl font-black text-orange-500">{doneDropoffs}/{totalDropoffs}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Drop</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-2xl font-black text-emerald-500">{trips.filter(t => t.status === 'completed').length}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Done</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-2xl font-black text-red-500">{noShows}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No Show</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Manifest <span className="text-primary font-black">({trips.length})</span>
          </h3>
          <button
            onClick={() => fetchManifest(phone, selectedDate)}
            className="w-10 h-10 bg-white rounded-full shadow-lg text-slate-400 hover:text-primary transition-all flex items-center justify-center"
          >
            <Timer className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest">Loading manifest...</p>
          </div>
        ) : trips.length === 0 ? (
          <Card className="p-16 rounded-[4rem] text-center shadow-xl border-none flex flex-col items-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <Navigation className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">No Trips</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">No assignments for this date</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map(trip => {
              const isActing = (leg: string) => actionLoadingId === trip._id + leg
              const pickupResolved = trip.pickup_status === 'completed' || trip.pickup_status === 'no_show'
              const dropoffLocked = trip.service_type === 'both' && !pickupResolved
              const tripCancelled = trip.status === 'cancelled'
              const tripNotConfirmed = trip.status === 'pending'

              return (
                <Card key={trip._id} className="rounded-[2.5rem] sm:rounded-[3rem] border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all overflow-hidden flex flex-col">
                  <div className="p-6 sm:p-8 flex-1 space-y-5">

                    {/* Patient Info */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <h4 className="text-lg sm:text-xl font-black text-slate-800 tracking-tighter italic leading-tight truncate">{trip.patient_name}</h4>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {trip.phone_number && trip.phone_number !== 'null' && trip.phone_number !== '' ? (
                            <a 
                              href={`tel:${trip.phone_number.replace(/\D/g, '')}`}
                              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all group"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-4 h-4 fill-current group-hover:animate-bounce" />
                              <span className="text-xs font-black tracking-tight">{trip.phone_number}</span>
                            </a>
                          ) : (
                            <div className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-400 rounded-2xl">
                              <Phone className="w-4 h-4" />
                              <span className="text-xs font-black tracking-tight">No Phone</span>
                            </div>
                          )}
                          
                          {trip.seats && trip.seats > 1 && (
                            <span className="px-4 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-[1.2rem]">
                              {trip.seats} Pax
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge className={`uppercase text-[9px] font-black px-3 py-1.5 rounded-xl border-none shadow-none tracking-widest ${
                          trip.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          trip.status === 'cancelled' ? 'bg-red-50 text-red-500' :
                          trip.status === 'confirmed' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {trip.status}
                        </Badge>
                        <Select onValueChange={(v) => handleStatusUpdate(trip._id, v)}>
                          <SelectTrigger className="h-10 w-10 p-0 border-none bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">
                            <MoreHorizontal className="w-4 h-4 text-slate-400 mx-auto" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="confirmed">Confirm Trip</SelectItem>
                            <SelectItem value="completed">Finish Trip</SelectItem>
                            <SelectItem value="cancelled">Abort Trip</SelectItem>
                            <SelectItem value="pending">Set Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Appointment Time */}
                    {trip.appointment_time && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-2xl">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Appt:</span>
                        <span className="text-[11px] font-bold text-slate-700">{formatTime12h(trip.appointment_time)}</span>
                      </div>
                    )}

                    {/* Journey Legs */}
                    <div className="space-y-3">

                      {/* ── PICKUP LEG ── */}
                      {(trip.service_type === 'pickup' || trip.service_type === 'both') && (
                        <div className="rounded-2xl border border-primary/10 overflow-hidden">
                          <div className="p-5 bg-primary/5 flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm shrink-0">
                              <ArrowUp className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pickup</p>
                              <p className="text-sm font-black text-slate-700 truncate">{trip.pickup_station || 'Station'}</p>
                            </div>
                            <span className="text-sm font-black text-primary bg-white px-3 py-1.5 rounded-xl shadow-sm shrink-0">
                              {formatTime12h(trip.pickup_time)}
                            </span>
                          </div>
                          <div className="px-5 py-3 bg-white border-t border-primary/10">
                            {trip.pickup_status === 'completed' ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-emerald-500 bg-emerald-50 rounded-xl">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Picked Up</span>
                              </div>
                            ) : trip.pickup_status === 'no_show' ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-red-500 bg-red-50 rounded-xl">
                                <XCircle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">No Show</span>
                              </div>
                            ) : tripCancelled ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-slate-400 bg-slate-50 rounded-xl">
                                <XCircle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Trip Cancelled</span>
                              </div>
                            ) : tripNotConfirmed ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-amber-500 bg-amber-50 rounded-xl">
                                <Lock className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Confirmation</span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleLegUpdate(trip._id, 'pickup', 'completed')}
                                  className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-md active:scale-95"
                                  disabled={isActing('pickup')}
                                >
                                  {isActing('pickup') ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Picked Up</>}
                                </Button>
                                <Button
                                  onClick={() => handleLegUpdate(trip._id, 'pickup', 'no_show')}
                                  variant="outline"
                                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 active:scale-95"
                                  disabled={isActing('pickup')}
                                >
                                  <AlertTriangle className="w-4 h-4 mr-1" /> No Show
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── DROPOFF LEG ── */}
                      {(trip.service_type === 'drop' || trip.service_type === 'both') && (
                        <div className="rounded-2xl border border-orange-100 overflow-hidden">
                          <div className="p-5 bg-orange-50 flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm shrink-0">
                              <ArrowDown className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Drop-off</p>
                              <p className="text-sm font-black text-slate-700 truncate">{trip.dropoff_station || 'Station'}</p>
                            </div>
                            <span className="text-sm font-black text-orange-600 bg-white px-3 py-1.5 rounded-xl shadow-sm shrink-0">
                              {formatTime12h(trip.dropoff_time)}
                            </span>
                          </div>
                          <div className="px-5 py-3 bg-white border-t border-orange-100">
                            {trip.dropoff_status === 'completed' ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-emerald-500 bg-emerald-50 rounded-xl">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Dropped Off</span>
                              </div>
                            ) : trip.dropoff_status === 'no_show' ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-red-500 bg-red-50 rounded-xl">
                                <XCircle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">No Show</span>
                              </div>
                            ) : tripCancelled ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-slate-400 bg-slate-50 rounded-xl">
                                <XCircle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Trip Cancelled</span>
                              </div>
                            ) : tripNotConfirmed ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-amber-500 bg-amber-50 rounded-xl">
                                <Lock className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Confirmation</span>
                              </div>
                            ) : dropoffLocked ? (
                              <div className="h-10 flex items-center justify-center gap-2 text-slate-400 bg-slate-50 rounded-xl">
                                <Lock className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Waiting for Pickup</span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleLegUpdate(trip._id, 'dropoff', 'completed')}
                                  className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest bg-orange-500 hover:bg-orange-600 shadow-md active:scale-95"
                                  disabled={isActing('dropoff')}
                                >
                                  {isActing('dropoff') ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Dropped Off</>}
                                </Button>
                                <Button
                                  onClick={() => handleLegUpdate(trip._id, 'dropoff', 'no_show')}
                                  variant="outline"
                                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 active:scale-95"
                                  disabled={isActing('dropoff')}
                                >
                                  <AlertTriangle className="w-4 h-4 mr-1" /> No Show
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      <footer className="mt-16 py-12 text-center opacity-20">
        <p className="text-[10px] font-black uppercase tracking-[1em] text-slate-400">Integrated Medical Support Network</p>
      </footer>
    </div>
  )
}
