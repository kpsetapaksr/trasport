'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Bus,
  Clock,
  MapPin,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
  Phone,
  Timer,
  ShieldCheck,
  Truck,
  User,
  CreditCard,
  UserCircle2,
  Calendar,
  RefreshCw,
  XCircle,
  ChevronLeft
} from 'lucide-react'

export default function RequestTransportPage() {
  const { toast } = useToast()
  const [step, setStep] = useState<'IDENTIFY' | 'MONITOR' | 'REBOOK' | 'BOOK'>('IDENTIFY')
  const [icNumber, setIcNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [monitorData, setMonitorData] = useState<any>(null)
  const [allRequests, setAllRequests] = useState<any[]>([])

  const [bookingPhone, setBookingPhone] = useState('')

  // Rebook state
  const [rebookLoading, setRebookLoading] = useState(false)
  const [rebookSlots, setRebookSlots] = useState<any[]>([])
  const [rebookStations, setRebookStations] = useState<any[]>([])
  const [selectedStation, setSelectedStation] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [rebookServiceType, setRebookServiceType] = useState<'pickup' | 'drop' | 'both'>('pickup')
  // For 'both': separate drop-off selections
  const [dropSlots, setDropSlots] = useState<any[]>([])
  const [selectedDropStation, setSelectedDropStation] = useState('')
  const [selectedDropSlot, setSelectedDropSlot] = useState<any>(null)
  const [selectedDropVehicle, setSelectedDropVehicle] = useState<any>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  // --- Step 1: Identification ---
  const handleIdentify = async () => {
    if (!icNumber || icNumber.length < 5) {
      toast({ title: 'Validation', description: 'Please enter a valid IC number.', variant: 'destructive' })
      return
    }
    const cleanedIC = icNumber.replace(/[-\s]/g, '').trim()
    setLoading(true)
    setAppointments([])
    try {
      const res = await fetch(`/api/transport/requests?search=${encodeURIComponent(cleanedIC)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const userRequests = json.data || []
      if (userRequests.length > 0) {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const upcomingRequests = userRequests.filter((r: any) => new Date(r.appointment_date) >= todayStart)
        if (upcomingRequests.length > 0) {
          setAllRequests(upcomingRequests)
          setMonitorData(upcomingRequests[0])
          setStep('MONITOR')
          return
        }
      }

      // No transport requests found — check appointments collection
      const aptRes = await fetch('/api/transport/check-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ic_number: icNumber }),
      })
      const aptJson = await aptRes.json()

      if (aptJson.found && aptJson.allAppointments?.length > 0) {
        setAppointments(aptJson.allAppointments)
        setAllRequests([])
        setMonitorData(null)
        setStep('MONITOR')
      } else {
        toast({ title: 'No Bookings', description: 'We could not find any appointments or transport requests for this IC.', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'System Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // --- Book Transport from Appointment ---
  const handleStartBooking = async (apt: any) => {
    setSelectedAppointment(apt)
    setBookingPhone(apt.patientPhone || '')
    setRebookServiceType('pickup')
    setSelectedStation('')
    setSelectedDropStation('')
    setSelectedSlot(null)
    setSelectedVehicle(null)
    setSelectedDropSlot(null)
    setSelectedDropVehicle(null)
    setRebookSlots([])
    setDropSlots([])
    setStep('BOOK')

    try {
      const res = await fetch('/api/stations?status=active')
      const json = await res.json()
      setRebookStations(json.data || [])
    } catch { }
  }

  const handleBookTransport = async () => {
    if (!selectedAppointment) return
    const needsPickup = rebookServiceType === 'pickup' || rebookServiceType === 'both'
    const needsDrop = rebookServiceType === 'drop' || rebookServiceType === 'both'

    if (needsPickup && !selectedStation) {
      toast({ title: 'Required', description: 'Please select a pickup station.', variant: 'destructive' })
      return
    }
    if (needsPickup && (!selectedSlot || !selectedVehicle)) {
      toast({ title: 'Required', description: 'Please select a pickup time slot and vehicle.', variant: 'destructive' })
      return
    }
    if (needsDrop && !selectedDropStation) {
      toast({ title: 'Required', description: 'Please select a drop-off station.', variant: 'destructive' })
      return
    }
    if (needsDrop && (!selectedDropSlot || !selectedDropVehicle)) {
      toast({ title: 'Required', description: 'Please select a drop-off time slot and vehicle.', variant: 'destructive' })
      return
    }

    setBookingLoading(true)
    try {
      const res = await fetch('/api/transport/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ic_number: selectedAppointment.patientIC || icNumber,
          appointment_id: selectedAppointment.id,
          patient_name: selectedAppointment.patientName,
          phone_number: bookingPhone || selectedAppointment.patientPhone || '',
          doctor_name: selectedAppointment.doctorName || '',
          service_type: rebookServiceType,
          appointment_date: selectedAppointment.appointmentDate,
          appointment_time: selectedAppointment.timeSlot || '',
          pickup_station: needsPickup ? selectedStation : undefined,
          pickup_time: needsPickup ? selectedSlot?.time : undefined,
          vehicle_id: needsPickup ? selectedVehicle?._id : undefined,
          dropoff_station: needsDrop ? selectedDropStation : undefined,
          dropoff_time: needsDrop ? selectedDropSlot?.time : undefined,
          dropoff_vehicle_id: needsDrop ? selectedDropVehicle?._id : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      toast({ title: 'Booked!', description: 'Your transport has been booked successfully.' })

      // Refresh — now transport request exists, go to MONITOR
      const cleanedSearch = icNumber.replace(/[-\s]/g, '').trim()
      const refreshRes = await fetch(`/api/transport/requests?search=${encodeURIComponent(cleanedSearch)}`)
      const refreshJson = await refreshRes.json()
      const userRequests = refreshJson.data || []
      setAllRequests(userRequests)
      setAppointments([])
      const newBooking = userRequests.find((r: any) => r._id === json.data?._id) || userRequests[0]
      setMonitorData(newBooking)
      setStep('MONITOR')
    } catch (err: any) {
      toast({ title: 'Booking Failed', description: err.message, variant: 'destructive' })
    } finally {
      setBookingLoading(false)
    }
  }

  // Get available time slots for a vehicle from a list of slots
  const getVehicleTimes = (vehicleId: string, slotsList: any[]) => {
    return slotsList
      .filter((s: any) => s.vehicles?.some((v: any) => v._id === vehicleId && !v.isFull))
      .map((s: any) => s.time)
      .sort()
  }

  const formatTime12h = (time: string | undefined | null) => {
    if (!time) return '--:--'
    if (time.includes('AM') || time.includes('PM')) return time
    try {
      const [h, m] = time.split(':')
      const hour = parseInt(h)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const h12 = hour % 12 || 12
      return `${h12}:${m || '00'} ${ampm}`
    } catch { return time }
  }

  // --- Rebook: Init ---
  const handleStartRebook = async () => {
    if (!monitorData) return
    setRebookServiceType(monitorData.service_type || 'pickup')
    setSelectedStation(monitorData.pickup_station || '')
    setSelectedDropStation(monitorData.dropoff_station || '')
    setSelectedSlot(null)
    setSelectedVehicle(null)
    setSelectedDropSlot(null)
    setSelectedDropVehicle(null)
    setRebookSlots([])
    setDropSlots([])
    setStep('REBOOK')

    // Load stations
    try {
      const res = await fetch('/api/stations?status=active')
      const json = await res.json()
      setRebookStations(json.data || [])
    } catch { }
  }

  // --- Load slots (shared by REBOOK and BOOK) ---
  const loadSlots = async (serviceType: 'pickup' | 'drop', stationName: string) => {
    // Use monitorData for rebook, selectedAppointment for new booking
    const source = monitorData || selectedAppointment
    if (!source || !stationName) return
    const date = source.appointment_date
      ? new Date(source.appointment_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
      : source.appointmentDate || ''
    const aptTime = source.appointment_time || source.timeSlot || ''
    if (!date) return
    setSlotsLoading(true)
    try {
      const res = await fetch(`/api/transport/available-slots?date=${date}&appointment_time=${encodeURIComponent(aptTime)}&service_type=${serviceType}&station=${encodeURIComponent(stationName)}`)
      const json = await res.json()
      const slots = (json.slots || []).filter((s: any) => !s.isFull)
      if (serviceType === 'pickup') {
        setRebookSlots(slots)
        setSelectedVehicle(null)
        setSelectedSlot(null)
      } else {
        setDropSlots(slots)
        setSelectedDropVehicle(null)
        setSelectedDropSlot(null)
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load available slots', variant: 'destructive' })
    } finally {
      setSlotsLoading(false)
    }
  }

  // Load pickup slots when pickup station changes
  useEffect(() => {
    if ((step === 'REBOOK' || step === 'BOOK') && selectedStation) {
      if (rebookServiceType === 'pickup' || rebookServiceType === 'both') {
        loadSlots('pickup', selectedStation)
      }
    }
  }, [step, rebookServiceType, selectedStation])

  // Load drop slots when drop station changes
  useEffect(() => {
    if ((step === 'REBOOK' || step === 'BOOK') && selectedDropStation) {
      if (rebookServiceType === 'drop' || rebookServiceType === 'both') {
        loadSlots('drop', selectedDropStation)
      }
    }
  }, [step, rebookServiceType, selectedDropStation])

  // --- Rebook: Submit ---
  const handleRebook = async () => {
    const needsPickup = rebookServiceType === 'pickup' || rebookServiceType === 'both'
    const needsDrop = rebookServiceType === 'drop' || rebookServiceType === 'both'

    if (needsPickup && !selectedStation) {
      toast({ title: 'Required', description: 'Please select a pickup station.', variant: 'destructive' })
      return
    }
    if (needsPickup && (!selectedSlot || !selectedVehicle)) {
      toast({ title: 'Required', description: 'Please select a pickup time slot and vehicle.', variant: 'destructive' })
      return
    }
    if (needsDrop && !selectedDropStation) {
      toast({ title: 'Required', description: 'Please select a drop-off station.', variant: 'destructive' })
      return
    }
    if (needsDrop && (!selectedDropSlot || !selectedDropVehicle)) {
      toast({ title: 'Required', description: 'Please select a drop-off time slot and vehicle.', variant: 'destructive' })
      return
    }

    setRebookLoading(true)
    try {
      const res = await fetch('/api/transport/rebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_request_id: monitorData._id,
          service_type: rebookServiceType,
          pickup_station: needsPickup ? selectedStation : undefined,
          pickup_time: needsPickup ? selectedSlot?.time : undefined,
          vehicle_id: needsPickup ? selectedVehicle?._id : undefined,
          dropoff_station: needsDrop ? selectedDropStation : undefined,
          dropoff_time: needsDrop ? selectedDropSlot?.time : undefined,
          dropoff_vehicle_id: needsDrop ? selectedDropVehicle?._id : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      toast({ title: 'Rebooked!', description: 'Your transport has been rescheduled successfully.' })

      // Refresh the list
      const cleanedSearch = icNumber.replace(/[-\s]/g, '').trim()
      const refreshRes = await fetch(`/api/transport/requests?search=${encodeURIComponent(cleanedSearch)}`)
      const refreshJson = await refreshRes.json()
      const userRequests = refreshJson.data || []
      setAllRequests(userRequests)
      // Show the new booking
      const newBooking = userRequests.find((r: any) => r._id === json.data?._id) || userRequests[0]
      setMonitorData(newBooking)
      setStep('MONITOR')
    } catch (err: any) {
      toast({ title: 'Rebook Failed', description: err.message, variant: 'destructive' })
    } finally {
      setRebookLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-12 px-6">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden -z-10">
         <Bus className="absolute -top-20 -left-20 w-[600px] h-[600px] rotate-12" />
         <MapPin className="absolute -bottom-20 -right-20 w-[400px] h-[400px] -rotate-12" />
      </div>

      <div className="w-full max-w-lg space-y-10">
        <header className="text-center space-y-3">
           <div className="inline-flex p-4 bg-primary/10 rounded-3xl text-primary animate-pulse mb-2">
              <Bus className="w-10 h-10" />
           </div>
           <h1 className="text-4xl font-black italic tracking-tighter text-slate-800 uppercase">ShuttleSync</h1>
           <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] font-sans">Visual Journey Monitor</p>
        </header>

        {step === 'IDENTIFY' && (
          <Card className="p-10 rounded-[3rem] border-none shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
             <div className="space-y-4">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Identity Verification</Label>
                   <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      <Input
                        placeholder="Enter IC Number (e.g. 9505...)"
                        className="h-16 pl-12 rounded-2xl bg-slate-50 border-none font-black text-lg focus:ring-2 focus:ring-primary/20 shadow-inner"
                        value={icNumber}
                        onChange={(e) => setIcNumber(e.target.value)}
                      />
                   </div>
                </div>
             </div>

             <Button onClick={handleIdentify} disabled={loading} className="w-full h-16 rounded-[2rem] bg-slate-900 font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95">
                {loading ? <Loader2 className="animate-spin" /> : <>Access Dashboard <ArrowRight className="ml-2 w-5 h-5" /></>}
             </Button>
          </Card>
        )}

        {step === 'MONITOR' && !monitorData && appointments.length > 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="relative group">
                <div className="bg-white rounded-[4rem] shadow-2xl overflow-hidden p-10 border border-white space-y-8 relative">
                   <div className="flex flex-col items-center gap-4 text-center">
                      <div className="h-20 w-20 bg-amber-50 rounded-[2rem] flex items-center justify-center">
                         <Calendar className="w-10 h-10 text-amber-500" />
                      </div>
                      <div className="space-y-1">
                         <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Appointments Found</h2>
                         <p className="text-sm text-slate-400">No transport has been booked yet for the following appointments.</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      {appointments.slice(0, 1).map((apt: any, idx: number) => (
                        <div key={apt._id || idx} className="p-6 bg-slate-50 rounded-3xl space-y-3">
                           <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                 <h3 className="text-lg font-black text-slate-800 tracking-tighter">{apt.patientName}</h3>
                                 <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                                    <Calendar className="w-3.5 h-3.5" /> {apt.appointmentDate}
                                    {apt.timeSlot && <><Clock className="w-3.5 h-3.5 ml-2" /> {apt.timeSlot}</>}
                                 </div>
                              </div>
                              <Badge className="uppercase font-black text-[10px] border-none px-3 py-1.5 rounded-xl tracking-widest shadow-none bg-emerald-50 text-emerald-600">
                                 {apt.status}
                              </Badge>
                           </div>
                           {apt.doctorName && (
                              <div className="flex items-center gap-2 text-slate-500 text-xs">
                                 <User className="w-3.5 h-3.5" /> Dr. {apt.doctorName} {apt.doctorSpecialization ? `(${apt.doctorSpecialization})` : ''}
                              </div>
                           )}
                           {apt.hasAnyBooking && apt.transportBookings?.length > 0 ? (
                              <div className="flex items-center gap-2 text-primary text-xs font-bold">
                                 <Bus className="w-3.5 h-3.5" /> Transport already booked
                              </div>
                           ) : (
                              <Button
                                onClick={() => handleStartBooking(apt)}
                                className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest shadow-lg transition-all hover:scale-[1.01] active:scale-95 gap-2 mt-2"
                              >
                                <Bus className="w-4 h-4" /> Book Transport
                              </Button>
                           )}
                        </div>
                      ))}
                   </div>
                </div>
             </div>
             <Button onClick={() => setStep('IDENTIFY')} className="w-full h-16 rounded-[2.5rem] bg-slate-900 hover:bg-black font-black uppercase text-[10px] tracking-widest shadow-2xl transition-all active:scale-95">Back to Dashboard Hub</Button>
          </div>
        )}

        {step === 'MONITOR' && monitorData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             {allRequests.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide no-scrollbar">
                   {allRequests.map((req) => (
                      <button key={req._id} onClick={() => setMonitorData(req)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shrink-0 transition-all ${monitorData._id === req._id ? 'bg-primary text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
                         Appt {new Date(req.appointment_date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </button>
                   ))}
                </div>
             )}

             <div className="relative group">
                <div className="bg-white rounded-[4rem] shadow-2xl overflow-hidden p-10 border border-white space-y-10 relative">
                    <div className="flex justify-between items-start">
                       <div className="space-y-1">
                          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">{monitorData.patient_name}</h2>
                          <div className="flex items-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest pl-1">
                             <Calendar className="w-4 h-4" /> {new Date(monitorData.appointment_date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })}
                          </div>
                       </div>
                       <Badge className={`uppercase font-black text-[10px] border-none px-4 py-2 rounded-2xl tracking-widest shadow-none ${
                          monitorData.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' :
                          monitorData.status === 'cancelled' ? 'bg-red-50 text-red-500' :
                          'bg-amber-50 text-amber-600'
                       }`}>
                          {monitorData.status}
                       </Badge>
                    </div>

                    {/* Cancelled state with rebook option */}
                    {monitorData.status === 'cancelled' ? (
                       <div className="flex flex-col items-center gap-6 py-8">
                          <div className="h-20 w-20 bg-red-50 rounded-[2rem] flex items-center justify-center">
                             <XCircle className="w-10 h-10 text-red-400" />
                          </div>
                          <div className="text-center space-y-2">
                             <p className="text-lg font-black text-slate-700">Booking Cancelled</p>
                             <p className="text-sm text-slate-400">This transport request has been cancelled.</p>
                          </div>
                          <Button
                            onClick={handleStartRebook}
                            className="h-14 px-10 rounded-[2rem] bg-primary hover:bg-primary/90 font-black uppercase text-[11px] tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-95 gap-3"
                          >
                            <RefreshCw className="w-5 h-5" /> Rebook Transport
                          </Button>
                       </div>
                    ) : (
                      <>
                        <div className="space-y-12">
                           {[
                             { id: monitorData.vehicle_id, icon: ArrowUp, type: 'pickup', title: 'Arrival Segment', time: monitorData.pickup_time, station: monitorData.pickup_station || 'Clinic', textColor: 'text-primary', bg: 'bg-primary/5' },
                             { id: monitorData.dropoff_vehicle_id, icon: ArrowDown, type: 'drop', title: 'Return Segment', time: monitorData.dropoff_time, station: monitorData.dropoff_station || 'Home Hub', textColor: 'text-orange-500', bg: 'bg-orange-50' }
                           ].filter(seg => monitorData.service_type === 'both' || monitorData.service_type === seg.type).map((seg, idx) => (
                              <div key={idx} className="flex flex-col gap-6 group">
                                 <div className="flex items-start gap-6">
                                    <div className={`h-14 w-14 ${seg.bg} rounded-[1.5rem] flex items-center justify-center ${seg.textColor} shrink-0`}><seg.icon className="w-7 h-7" /></div>
                                    <div className="space-y-1">
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{seg.title}</p>
                                       <p className="text-xl font-black text-slate-800 tracking-tighter italic leading-none">{formatTime12h(seg.time)} <span className="text-slate-300 font-normal ml-2">@ {seg.station}</span></p>
                                    </div>
                                 </div>

                                 {monitorData.status === 'confirmed' && seg.id ? (
                                    <div className="ml-5 pl-5 border-l-2 border-dashed border-slate-100 flex flex-col gap-6 animate-in fade-in slide-in-from-left-4 duration-500">
                                       <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-slate-100 group/card">
                                          <div className="aspect-[16/6] relative overflow-hidden bg-slate-50">
                                             {typeof seg.id === 'object' && (seg.id as any).image ? (
                                                <img src={(seg.id as any).image} className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700" />
                                             ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center opacity-10"><Bus className="w-20 h-20" /></div>
                                             )}
                                             <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{typeof seg.id === 'object' ? (seg.id as any).vehicle_number : 'SYNC-X'}</span>
                                             </div>
                                          </div>

                                          <div className="p-6 flex items-center justify-between gap-4">
                                             <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-slate-50 rounded-2xl overflow-hidden shadow-inner border border-slate-100 flex items-center justify-center shrink-0">
                                                   {typeof seg.id === 'object' && (seg.id as any).driver_id?.image ? (
                                                      <img src={(seg.id as any).driver_id.image} className="w-full h-full object-cover" />
                                                   ) : (
                                                      <User className="w-6 h-6 text-slate-300" />
                                                   )}
                                                </div>
                                                <div>
                                                   <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1.5 italic flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> ID Verified Operator</p>
                                                   <h4 className="text-base font-black text-slate-800 leading-none italic uppercase tracking-tighter">Capt. {typeof seg.id === 'object' ? (seg.id as any).driver_id?.name : 'Personnel Assigned'}</h4>
                                                </div>
                                             </div>

                                             {typeof seg.id === 'object' && (seg.id as any).driver_id?.phone && (
                                                <a href={`tel:${(seg.id as any).driver_id.phone}`} className="h-14 w-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl active:scale-90 transition-all">
                                                   <Phone className="w-6 h-6" />
                                                </a>
                                             )}
                                          </div>
                                       </Card>
                                    </div>
                                 ) : monitorData.status === 'pending' && (
                                    <div className="ml-5 pl-5 border-l-2 border-dashed border-slate-100 italic flex items-center gap-3 text-amber-500">
                                       <Timer className="w-4 h-4 animate-spin-slow" />
                                       <span className="text-[10px] font-black uppercase tracking-widest">Verifying Fleet Unit Assignment...</span>
                                    </div>
                                 )}
                              </div>
                           ))}
                        </div>

                        <div className="pt-10 border-t border-slate-50 flex flex-col items-center gap-6">
                           <div className="px-8 py-3 bg-slate-900 rounded-full flex items-center gap-3 shadow-2xl shadow-black/10">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                              <span className="text-[9px] font-black text-white uppercase tracking-[0.4em]">Integrated Fleet Sync Active</span>
                           </div>
                           <div className="flex gap-4 items-center opacity-20 filter grayscale">
                              {Array.from({length: 15}).map((_,i) => <div key={i} className={`h-8 w-1 rounded-full ${i%4===0 ? 'bg-primary' : 'bg-slate-300'}`} />)}
                           </div>
                        </div>
                      </>
                    )}
                </div>
             </div>

             <Button onClick={() => setStep('IDENTIFY')} className="w-full h-16 rounded-[2.5rem] bg-slate-900 hover:bg-black font-black uppercase text-[10px] tracking-widest shadow-2xl transition-all active:scale-95">Back to Dashboard Hub</Button>
          </div>
        )}

        {/* ========== REBOOK STEP ========== */}
        {step === 'REBOOK' && monitorData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <Card className="bg-white rounded-[3rem] shadow-2xl overflow-hidden p-8 border-none space-y-8">
                <div className="flex items-center gap-4">
                   <button onClick={() => setStep('MONITOR')} className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <ChevronLeft className="w-5 h-5 text-slate-600" />
                   </button>
                   <div>
                      <h2 className="text-xl font-black text-slate-800 tracking-tighter">Rebook Transport</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monitorData.patient_name} &mdash; {new Date(monitorData.appointment_date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })}</p>
                   </div>
                </div>

                {/* Service Type Selector */}
                <div className="space-y-3">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Service Type</Label>
                   <div className="flex gap-3">
                      {(['pickup', 'drop', 'both'] as const).map((type) => (
                         <button
                           key={type}
                           onClick={() => {
                             setRebookServiceType(type)
                             setSelectedSlot(null)
                             setSelectedVehicle(null)
                             setSelectedDropSlot(null)
                             setSelectedDropVehicle(null)
                             setSelectedStation('')
                             setSelectedDropStation('')
                             setRebookSlots([])
                             setDropSlots([])
                           }}
                           className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                             rebookServiceType === type
                               ? 'bg-primary text-white shadow-lg'
                               : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                           }`}
                         >
                           {type === 'both' ? 'Both' : type === 'pickup' ? 'Pickup' : 'Drop-off'}
                         </button>
                      ))}
                   </div>
                </div>

                {/* PICKUP SECTION — order: Station → Vehicle → Time Slot */}
                {(rebookServiceType === 'pickup' || rebookServiceType === 'both') && (
                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><ArrowUp className="w-5 h-5" /></div>
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pickup Details</Label>
                     </div>

                     {/* 1. Station */}
                     <select
                       value={selectedStation}
                       onChange={(e) => setSelectedStation(e.target.value)}
                       className="w-full h-14 px-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none"
                     >
                       <option value="">Select Pickup Station</option>
                       {rebookStations.map((s: any) => (
                         <option key={s._id} value={s.station_name}>{s.station_name} - {s.location_name}</option>
                       ))}
                     </select>

                     {/* 2. Vehicle — or no-slots message */}
                     {slotsLoading ? (
                       <div className="flex items-center justify-center py-8 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mr-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Loading vehicles...</span>
                       </div>
                     ) : selectedStation && rebookSlots.length === 0 ? (
                       <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                          <p className="text-xs font-bold text-amber-700">No pickup slots are configured for this station on this date. Please contact the clinic or choose a different station.</p>
                       </div>
                     ) : rebookSlots.length > 0 && (() => {
                       const seen = new Set<string>();
                       const uniqueVehicles = rebookSlots.flatMap((s: any) => s.vehicles || []).filter((v: any) => {
                         if (!v || v.isFull || seen.has(v._id)) return false;
                         seen.add(v._id);
                         return true;
                       });
                       return uniqueVehicles.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Vehicle</Label>
                            <div className="space-y-2">
                               {uniqueVehicles.map((v: any) => {
                                 const times = getVehicleTimes(v._id, rebookSlots);
                                 return (
                                 <button
                                   key={v._id}
                                   onClick={() => { setSelectedVehicle(v); setSelectedSlot(null) }}
                                   className={`w-full p-4 rounded-2xl text-left flex items-center gap-4 transition-all ${
                                     selectedVehicle?._id === v._id
                                       ? 'bg-primary/10 ring-2 ring-primary/30'
                                       : 'bg-slate-50 hover:bg-slate-100'
                                   }`}
                                 >
                                   <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                      <Truck className="w-5 h-5 text-slate-400" />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-sm font-black text-slate-800">{v.vehicle_name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">{v.vehicle_number}</p>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {times.map((t: string) => (
                                          <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded-lg">{formatTime12h(t)}</span>
                                        ))}
                                      </div>
                                   </div>
                                   {selectedVehicle?._id === v._id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                                 </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : null;
                     })()}

                     {/* 3. Time Slot (shown after vehicle selected) */}
                     {selectedVehicle && (() => {
                       const vehicleSlots = rebookSlots.filter((s: any) =>
                         s.vehicles?.some((v: any) => v._id === selectedVehicle._id && !v.isFull)
                       );
                       return vehicleSlots.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Time Slot</Label>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                               {vehicleSlots.map((slot: any) => {
                                 const vInfo = slot.vehicles.find((v: any) => v._id === selectedVehicle._id);
                                 return (
                                   <button
                                     key={slot.time}
                                     onClick={() => setSelectedSlot(slot)}
                                     className={`w-full p-4 rounded-2xl text-left transition-all ${
                                       selectedSlot?.time === slot.time
                                         ? 'bg-primary/10 ring-2 ring-primary/30'
                                         : 'bg-slate-50 hover:bg-slate-100'
                                     }`}
                                   >
                                     <div className="flex justify-between items-center">
                                        <div>
                                           <p className="text-base font-black text-slate-800">{formatTime12h(slot.time)}</p>
                                           <p className="text-[10px] text-slate-400 font-bold">{slot.description}</p>
                                        </div>
                                        <Badge className={`text-[9px] font-black border-none ${slot.isRecommended ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                           {slot.isRecommended ? `Recommended · ${vInfo?.available ?? slot.available} seats` : `${vInfo?.available ?? slot.available} seats`}
                                        </Badge>
                                     </div>
                                   </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : (
                         <div className="text-center py-6 text-slate-400">
                            <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No pickup slots available for this vehicle</p>
                         </div>
                       );
                     })()}
                  </div>
                )}

                {/* DROP-OFF SECTION — order: Station → Vehicle → Time Slot */}
                {(rebookServiceType === 'drop' || rebookServiceType === 'both') && (
                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500"><ArrowDown className="w-5 h-5" /></div>
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Drop-off Details</Label>
                     </div>

                     {/* 1. Station */}
                     <select
                       value={selectedDropStation}
                       onChange={(e) => setSelectedDropStation(e.target.value)}
                       className="w-full h-14 px-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none"
                     >
                       <option value="">Select Drop-off Station</option>
                       {rebookStations.map((s: any) => (
                         <option key={s._id} value={s.station_name}>{s.station_name} - {s.location_name}</option>
                       ))}
                     </select>

                     {/* 2. Vehicle — or no-slots message */}
                     {slotsLoading ? (
                       <div className="flex items-center justify-center py-8 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mr-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Loading vehicles...</span>
                       </div>
                     ) : selectedDropStation && dropSlots.length === 0 ? (
                       <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                          <p className="text-xs font-bold text-amber-700">No drop-off slots are configured for this station on this date. Please contact the clinic or choose a different station.</p>
                       </div>
                     ) : dropSlots.length > 0 && (() => {
                       const seen = new Set<string>();
                       const uniqueVehicles = dropSlots.flatMap((s: any) => s.vehicles || []).filter((v: any) => {
                         if (!v || v.isFull || seen.has(v._id)) return false;
                         seen.add(v._id);
                         return true;
                       });
                       return uniqueVehicles.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Vehicle</Label>
                            <div className="space-y-2">
                               {uniqueVehicles.map((v: any) => {
                                 const times = getVehicleTimes(v._id, dropSlots);
                                 return (
                                 <button
                                   key={v._id}
                                   onClick={() => { setSelectedDropVehicle(v); setSelectedDropSlot(null) }}
                                   className={`w-full p-4 rounded-2xl text-left flex items-center gap-4 transition-all ${
                                     selectedDropVehicle?._id === v._id
                                       ? 'bg-orange-50 ring-2 ring-orange-300'
                                       : 'bg-slate-50 hover:bg-slate-100'
                                   }`}
                                 >
                                   <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                      <Truck className="w-5 h-5 text-slate-400" />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-sm font-black text-slate-800">{v.vehicle_name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">{v.vehicle_number}</p>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {times.map((t: string) => (
                                          <span key={t} className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-bold rounded-lg">{formatTime12h(t)}</span>
                                        ))}
                                      </div>
                                   </div>
                                   {selectedDropVehicle?._id === v._id && <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />}
                                 </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : null;
                     })()}

                     {/* 3. Time Slot (shown after vehicle selected) */}
                     {selectedDropVehicle && (() => {
                       const vehicleSlots = dropSlots.filter((s: any) =>
                         s.vehicles?.some((v: any) => v._id === selectedDropVehicle._id && !v.isFull)
                       );
                       return vehicleSlots.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Time Slot</Label>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                               {vehicleSlots.map((slot: any) => {
                                 const vInfo = slot.vehicles.find((v: any) => v._id === selectedDropVehicle._id);
                                 return (
                                   <button
                                     key={slot.time}
                                     onClick={() => setSelectedDropSlot(slot)}
                                     className={`w-full p-4 rounded-2xl text-left transition-all ${
                                       selectedDropSlot?.time === slot.time
                                         ? 'bg-orange-50 ring-2 ring-orange-300'
                                         : 'bg-slate-50 hover:bg-slate-100'
                                     }`}
                                   >
                                     <div className="flex justify-between items-center">
                                        <div>
                                           <p className="text-base font-black text-slate-800">{formatTime12h(slot.time)}</p>
                                           <p className="text-[10px] text-slate-400 font-bold">{slot.description}</p>
                                        </div>
                                        <Badge className={`text-[9px] font-black border-none ${slot.isRecommended ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                           {slot.isRecommended ? `Recommended · ${vInfo?.available ?? slot.available} seats` : `${vInfo?.available ?? slot.available} seats`}
                                        </Badge>
                                     </div>
                                   </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : (
                         <div className="text-center py-6 text-slate-400">
                            <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No drop-off slots available for this vehicle</p>
                         </div>
                       );
                     })()}
                  </div>
                )}

                {/* Confirm Rebook Button */}
                <Button
                  onClick={handleRebook}
                  disabled={rebookLoading}
                  className="w-full h-16 rounded-[2rem] bg-primary hover:bg-primary/90 font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all hover:scale-[1.01] active:scale-95"
                >
                  {rebookLoading ? <Loader2 className="animate-spin" /> : <>Confirm Rebooking <CheckCircle2 className="ml-2 w-5 h-5" /></>}
                </Button>
             </Card>

             <Button onClick={() => setStep('MONITOR')} variant="outline" className="w-full h-14 rounded-[2rem] font-black uppercase text-[10px] tracking-widest border-slate-200">
                Cancel
             </Button>
          </div>
        )}

        {/* ========== BOOK TRANSPORT STEP ========== */}
        {step === 'BOOK' && selectedAppointment && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <Card className="bg-white rounded-[3rem] shadow-2xl overflow-hidden p-8 border-none space-y-8">
                <div className="flex items-center gap-4">
                   <button onClick={() => { setStep('MONITOR'); setSelectedAppointment(null) }} className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <ChevronLeft className="w-5 h-5 text-slate-600" />
                   </button>
                   <div>
                      <h2 className="text-xl font-black text-slate-800 tracking-tighter">Book Transport</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedAppointment.patientName} &mdash; {selectedAppointment.appointmentDate}</p>
                   </div>
                </div>

                {/* Optional phone input — shown only when appointment has no phone */}
                {!selectedAppointment.patientPhone && (
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contact Number <span className="text-slate-300">(optional)</span></Label>
                     <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input
                          placeholder="e.g. 0123456789"
                          className="h-12 pl-11 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-primary/20"
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        />
                     </div>
                  </div>
                )}

                {/* Service Type Selector */}
                <div className="space-y-3">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Service Type</Label>
                   <div className="flex gap-3">
                      {(['pickup', 'drop', 'both'] as const).map((type) => (
                         <button
                           key={type}
                           onClick={() => {
                             setRebookServiceType(type)
                             setSelectedSlot(null)
                             setSelectedVehicle(null)
                             setSelectedDropSlot(null)
                             setSelectedDropVehicle(null)
                             setSelectedStation('')
                             setSelectedDropStation('')
                             setRebookSlots([])
                             setDropSlots([])
                           }}
                           className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                             rebookServiceType === type
                               ? 'bg-primary text-white shadow-lg'
                               : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                           }`}
                         >
                           {type === 'both' ? 'Both' : type === 'pickup' ? 'Pickup' : 'Drop-off'}
                         </button>
                      ))}
                   </div>
                </div>

                {/* PICKUP SECTION — order: Station → Vehicle → Time Slot */}
                {(rebookServiceType === 'pickup' || rebookServiceType === 'both') && (
                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><ArrowUp className="w-5 h-5" /></div>
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pickup Details</Label>
                     </div>

                     {/* 1. Station */}
                     <select
                       value={selectedStation}
                       onChange={(e) => setSelectedStation(e.target.value)}
                       className="w-full h-14 px-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none"
                     >
                       <option value="">Select Pickup Station</option>
                       {rebookStations.map((s: any) => (
                         <option key={s._id} value={s.station_name}>{s.station_name} - {s.location_name}</option>
                       ))}
                     </select>

                     {/* 2. Vehicle — or no-slots message */}
                     {slotsLoading ? (
                       <div className="flex items-center justify-center py-8 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mr-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Loading vehicles...</span>
                       </div>
                     ) : selectedStation && rebookSlots.length === 0 ? (
                       <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                          <p className="text-xs font-bold text-amber-700">No pickup slots are configured for this station on this date. Please contact the clinic or choose a different station.</p>
                       </div>
                     ) : rebookSlots.length > 0 && (() => {
                       const seen = new Set<string>();
                       const uniqueVehicles = rebookSlots.flatMap((s: any) => s.vehicles || []).filter((v: any) => {
                         if (!v || v.isFull || seen.has(v._id)) return false;
                         seen.add(v._id);
                         return true;
                       });
                       return uniqueVehicles.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Vehicle</Label>
                            <div className="space-y-2">
                               {uniqueVehicles.map((v: any) => {
                                 const times = getVehicleTimes(v._id, rebookSlots);
                                 return (
                                 <button
                                   key={v._id}
                                   onClick={() => { setSelectedVehicle(v); setSelectedSlot(null) }}
                                   className={`w-full p-4 rounded-2xl text-left flex items-center gap-4 transition-all ${
                                     selectedVehicle?._id === v._id
                                       ? 'bg-primary/10 ring-2 ring-primary/30'
                                       : 'bg-slate-50 hover:bg-slate-100'
                                   }`}
                                 >
                                   <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                      <Truck className="w-5 h-5 text-slate-400" />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-sm font-black text-slate-800">{v.vehicle_name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">{v.vehicle_number}</p>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {times.map((t: string) => (
                                          <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded-lg">{formatTime12h(t)}</span>
                                        ))}
                                      </div>
                                   </div>
                                   {selectedVehicle?._id === v._id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                                 </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : null;
                     })()}

                     {/* 3. Time Slot (shown after vehicle selected) */}
                     {selectedVehicle && (() => {
                       const vehicleSlots = rebookSlots.filter((s: any) =>
                         s.vehicles?.some((v: any) => v._id === selectedVehicle._id && !v.isFull)
                       );
                       return vehicleSlots.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Time Slot</Label>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                               {vehicleSlots.map((slot: any) => {
                                 const vInfo = slot.vehicles.find((v: any) => v._id === selectedVehicle._id);
                                 return (
                                   <button
                                     key={slot.time}
                                     onClick={() => setSelectedSlot(slot)}
                                     className={`w-full p-4 rounded-2xl text-left transition-all ${
                                       selectedSlot?.time === slot.time
                                         ? 'bg-primary/10 ring-2 ring-primary/30'
                                         : 'bg-slate-50 hover:bg-slate-100'
                                     }`}
                                   >
                                     <div className="flex justify-between items-center">
                                        <div>
                                           <p className="text-base font-black text-slate-800">{formatTime12h(slot.time)}</p>
                                           <p className="text-[10px] text-slate-400 font-bold">{slot.description}</p>
                                        </div>
                                        <Badge className={`text-[9px] font-black border-none ${slot.isRecommended ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                           {slot.isRecommended ? `Recommended · ${vInfo?.available ?? slot.available} seats` : `${vInfo?.available ?? slot.available} seats`}
                                        </Badge>
                                     </div>
                                   </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : (
                         <div className="text-center py-6 text-slate-400">
                            <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No pickup slots available for this vehicle</p>
                         </div>
                       );
                     })()}
                  </div>
                )}

                {/* DROP-OFF SECTION — order: Station → Vehicle → Time Slot */}
                {(rebookServiceType === 'drop' || rebookServiceType === 'both') && (
                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500"><ArrowDown className="w-5 h-5" /></div>
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Drop-off Details</Label>
                     </div>

                     {/* 1. Station */}
                     <select
                       value={selectedDropStation}
                       onChange={(e) => setSelectedDropStation(e.target.value)}
                       className="w-full h-14 px-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none"
                     >
                       <option value="">Select Drop-off Station</option>
                       {rebookStations.map((s: any) => (
                         <option key={s._id} value={s.station_name}>{s.station_name} - {s.location_name}</option>
                       ))}
                     </select>

                     {/* 2. Vehicle — or no-slots message */}
                     {slotsLoading ? (
                       <div className="flex items-center justify-center py-8 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mr-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Loading vehicles...</span>
                       </div>
                     ) : selectedDropStation && dropSlots.length === 0 ? (
                       <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                          <p className="text-xs font-bold text-amber-700">No drop-off slots are configured for this station on this date. Please contact the clinic or choose a different station.</p>
                       </div>
                     ) : dropSlots.length > 0 && (() => {
                       const seen = new Set<string>();
                       const uniqueVehicles = dropSlots.flatMap((s: any) => s.vehicles || []).filter((v: any) => {
                         if (!v || v.isFull || seen.has(v._id)) return false;
                         seen.add(v._id);
                         return true;
                       });
                       return uniqueVehicles.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Vehicle</Label>
                            <div className="space-y-2">
                               {uniqueVehicles.map((v: any) => {
                                 const times = getVehicleTimes(v._id, dropSlots);
                                 return (
                                 <button
                                   key={v._id}
                                   onClick={() => { setSelectedDropVehicle(v); setSelectedDropSlot(null) }}
                                   className={`w-full p-4 rounded-2xl text-left flex items-center gap-4 transition-all ${
                                     selectedDropVehicle?._id === v._id
                                       ? 'bg-orange-50 ring-2 ring-orange-300'
                                       : 'bg-slate-50 hover:bg-slate-100'
                                   }`}
                                 >
                                   <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                      <Truck className="w-5 h-5 text-slate-400" />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-sm font-black text-slate-800">{v.vehicle_name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">{v.vehicle_number}</p>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {times.map((t: string) => (
                                          <span key={t} className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-bold rounded-lg">{formatTime12h(t)}</span>
                                        ))}
                                      </div>
                                   </div>
                                   {selectedDropVehicle?._id === v._id && <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />}
                                 </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : null;
                     })()}

                     {/* 3. Time Slot (shown after vehicle selected) */}
                     {selectedDropVehicle && (() => {
                       const vehicleSlots = dropSlots.filter((s: any) =>
                         s.vehicles?.some((v: any) => v._id === selectedDropVehicle._id && !v.isFull)
                       );
                       return vehicleSlots.length > 0 ? (
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Time Slot</Label>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                               {vehicleSlots.map((slot: any) => {
                                 const vInfo = slot.vehicles.find((v: any) => v._id === selectedDropVehicle._id);
                                 return (
                                   <button
                                     key={slot.time}
                                     onClick={() => setSelectedDropSlot(slot)}
                                     className={`w-full p-4 rounded-2xl text-left transition-all ${
                                       selectedDropSlot?.time === slot.time
                                         ? 'bg-orange-50 ring-2 ring-orange-300'
                                         : 'bg-slate-50 hover:bg-slate-100'
                                     }`}
                                   >
                                     <div className="flex justify-between items-center">
                                        <div>
                                           <p className="text-base font-black text-slate-800">{formatTime12h(slot.time)}</p>
                                           <p className="text-[10px] text-slate-400 font-bold">{slot.description}</p>
                                        </div>
                                        <Badge className={`text-[9px] font-black border-none ${slot.isRecommended ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                           {slot.isRecommended ? `Recommended · ${vInfo?.available ?? slot.available} seats` : `${vInfo?.available ?? slot.available} seats`}
                                        </Badge>
                                     </div>
                                   </button>
                                 );
                               })}
                            </div>
                         </div>
                       ) : (
                         <div className="text-center py-6 text-slate-400">
                            <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No drop-off slots available for this vehicle</p>
                         </div>
                       );
                     })()}
                  </div>
                )}

                {/* Confirm Booking Button */}
                <Button
                  onClick={handleBookTransport}
                  disabled={bookingLoading}
                  className="w-full h-16 rounded-[2rem] bg-primary hover:bg-primary/90 font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all hover:scale-[1.01] active:scale-95"
                >
                  {bookingLoading ? <Loader2 className="animate-spin" /> : <>Confirm Booking <CheckCircle2 className="ml-2 w-5 h-5" /></>}
                </Button>
             </Card>

             <Button onClick={() => { setStep('MONITOR'); setSelectedAppointment(null) }} variant="outline" className="w-full h-14 rounded-[2rem] font-black uppercase text-[10px] tracking-widest border-slate-200">
                Cancel
             </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={`block ${className}`}>{children}</label>
}
