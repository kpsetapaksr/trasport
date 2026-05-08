'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Bus, Clock, MapPin, ArrowUp, ArrowDown, Truck,
  Plus, Trash2, Pencil, User, Phone, Search, X, Calendar, Filter,
  ChevronLeft, ChevronRight, Copy, CheckCircle2, Loader2, CalendarClock,
  ArrowRight, AlertTriangle, ShieldCheck, FlaskConical, XCircle, Info,
  RefreshCcw, Repeat, Ban, MousePointerClick,
} from 'lucide-react'
import { adminFetch } from '@/lib/api-client'

// --- TYPES ---
interface StationInfo {
  _id: string
  station_name: string
  location_name: string
  status: string
}

interface DriverInfo {
  _id: string
  name: string
  phone: string
}

interface VehicleInfo {
  _id: string
  vehicle_name: string
  vehicle_number: string
  vehicle_type: string
  seat_capacity: number
  driver_id?: DriverInfo
  status: string
}

interface SlotData {
  _id: string
  vehicle_id: string | VehicleInfo
  station_name: string
  type: 'pickup' | 'drop'
  time: string
  status: 'active' | 'inactive'
  date: string
  block_reason?: string
}

type TestSeverity = 'error' | 'warning' | 'info'

interface TestResult {
  vehicleId: string
  vehicleName: string
  vehicleNumber: string
  severity: TestSeverity
  message: string
}

export default function TransportSchedulePage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([])
  const [stations, setStations] = useState<StationInfo[]>([])
  const [slots, setSlots] = useState<SlotData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'drop'>('all')

  // Date-wise Management
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editSlot, setEditSlot] = useState<SlotData | null>(null)
  const [editForm, setEditForm] = useState({ time: '', station_name: '', status: 'active' as string, block_reason: '' })

  // Delete confirm dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    slotId: string | null
    isRecurring?: boolean  // recurring (global) slot → hide for date only
    isUnblock?: boolean    // inactive blocked slot → restore
  }>({ open: false, slotId: null })
  const [deleting, setDeleting] = useState(false)

  // Clear vehicle confirm dialog
  const [clearVehicleConfirm, setClearVehicleConfirm] = useState<{ open: boolean; vehicleId: string; vehicleName: string; slotCount: number }>({
    open: false, vehicleId: '', vehicleName: '', slotCount: 0
  })
  const [clearing, setClearing] = useState(false)

  // Copy Forward confirm
  const [copyForwardConfirm, setCopyForwardConfirm] = useState(false)
  const [copying, setCopying] = useState(false)

  // Multi-select block mode
  const [blockMode, setBlockMode] = useState(false)
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [bulkBlockDialog, setBulkBlockDialog] = useState(false)
  const [bulkBlockReason, setBulkBlockReason] = useState('')
  const [bulkBlocking, setBulkBlocking] = useState(false)

  // Full day block (per vehicle)
  const [fullDayBlockDialog, setFullDayBlockDialog] = useState<{ open: boolean; vehicleId: string; vehicleName: string; slotIds: string[] }>({ open: false, vehicleId: '', vehicleName: '', slotIds: [] })
  const [fullDayReason, setFullDayReason] = useState('')
  const [fullDayBlocking, setFullDayBlocking] = useState(false)

  // Booking counts: key = `p|vehicleId|time` or `d|vehicleId|time` → booked seats
  const [bookingMap, setBookingMap] = useState<Map<string, number>>(new Map())

  // Logic Test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])

  const [form, setForm] = useState({
    vehicle_id: '',
    station_name: '',
    pickup_station: '',
    drop_station: '',
    travel_time: '30',
    type: 'both' as 'pickup' | 'drop' | 'both',
    date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '18:00',
    interval: '60',
  })

  const resetForm = (vehicleId = '', date = selectedDate) => {
    setForm({
      vehicle_id: vehicleId,
      station_name: '',
      pickup_station: '',
      drop_station: '',
      travel_time: '30',
      type: 'both',
      date,
      start_time: '07:00',
      end_time: '18:00',
      interval: '60',
    })
  }

  // Fetching Data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [vehRes, staRes, sloRes, reqRes] = await Promise.all([
        adminFetch('/api/vehicles'),
        adminFetch('/api/stations'),
        adminFetch(`/api/transport/vehicle-slots?date=${selectedDate}`),
        adminFetch(`/api/transport/requests?date=${selectedDate}&limit=500`),
      ])

      if (!vehRes.ok || !staRes.ok || !sloRes.ok) throw new Error('Failed to load data')

      const vehJson = await vehRes.json()
      const staJson = await staRes.json()
      const sloJson = await sloRes.json()

      setVehicles(vehJson.data || [])
      setStations(staJson.data || [])
      setSlots(sloJson.data || [])

      // Build booking count map from requests
      if (reqRes.ok) {
        const reqJson = await reqRes.json()
        const map = new Map<string, number>()
        ;(reqJson.data || []).forEach((r: any) => {
          if (r.status === 'cancelled') return
          const seats = r.seats || 1
          // Pickup
          if (r.vehicle_id && r.pickup_time) {
            const vId = typeof r.vehicle_id === 'object' ? r.vehicle_id._id : r.vehicle_id
            const key = `p|${String(vId)}|${r.pickup_time}`
            map.set(key, (map.get(key) || 0) + seats)
          }
          // Drop
          if (r.dropoff_vehicle_id && r.dropoff_time) {
            const vId = typeof r.dropoff_vehicle_id === 'object' ? r.dropoff_vehicle_id._id : r.dropoff_vehicle_id
            const key = `d|${String(vId)}|${r.dropoff_time}`
            map.set(key, (map.get(key) || 0) + seats)
          }
        })
        setBookingMap(map)
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load schedule data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  // Stats — only count slots that belong to active vehicles shown on screen
  const stats = useMemo(() => {
    const activeVehicleIds = new Set(vehicles.filter(v => v.status === 'active').map(v => v._id))
    const activeSlots = slots.filter(s => {
      const vId = s.vehicle_id != null && typeof s.vehicle_id === 'object' ? s.vehicle_id._id : s.vehicle_id
      return vId && activeVehicleIds.has(String(vId))
    })
    const orphanCount = slots.length - activeSlots.length
    return {
      total: activeSlots.length,
      pickups: activeSlots.filter(s => s.type === 'pickup').length,
      drops: activeSlots.filter(s => s.type === 'drop').length,
      vehicles: new Set(activeSlots.map(s => s.vehicle_id != null && typeof s.vehicle_id === 'object' ? s.vehicle_id._id : s.vehicle_id)).size,
      orphanCount,
    }
  }, [slots, vehicles])

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return vehicles.filter(v =>
      v.status === 'active' &&
      (v.vehicle_name.toLowerCase().includes(q) || v.vehicle_number.toLowerCase().includes(q))
    )
  }, [vehicles, searchQuery])

  const vehicleSlotsMap = useMemo(() => {
    const map = new Map<string, SlotData[]>()

    // Build keys for date-specific inactive overrides so we hide their recurring counterparts
    const inactiveOverrideKeys = new Set<string>()
    slots.forEach(slot => {
      if (slot.status === 'inactive' && slot.date === selectedDate) {
        const vId = String(typeof slot.vehicle_id === 'object' ? (slot.vehicle_id as VehicleInfo)._id : slot.vehicle_id)
        inactiveOverrideKeys.add(`${vId}|${slot.time}|${slot.station_name}|${slot.type}`)
      }
    })

    slots.forEach(slot => {
      const vId = slot.vehicle_id == null ? null : String(typeof slot.vehicle_id === 'object' ? (slot.vehicle_id as VehicleInfo)._id : slot.vehicle_id)
      if (!vId) return
      if (typeFilter !== 'all' && slot.type !== typeFilter) return

      // Hide active recurring slot when a date-specific inactive override exists for it
      if (slot.status === 'active' && (!slot.date || slot.date === '')) {
        if (inactiveOverrideKeys.has(`${vId}|${slot.time}|${slot.station_name}|${slot.type}`)) return
      }

      if (!map.has(vId)) map.set(vId, [])
      map.get(vId)?.push(slot)
    })
    return map
  }, [slots, typeFilter, selectedDate])

  // ---- Logic Test ----
  const runLogicTest = () => {
    const results: TestResult[] = []
    const activeVehicles = vehicles.filter(v => v.status === 'active')

    activeVehicles.forEach(vehicle => {
      // Use all slots (not filtered by typeFilter) for accurate test
      const allVehicleSlots = slots.filter(slot => {
        const vId = slot.vehicle_id != null && typeof slot.vehicle_id === 'object' ? slot.vehicle_id._id : slot.vehicle_id
        return String(vId) === String(vehicle._id)
      })
      const pickups = allVehicleSlots.filter(s => s.type === 'pickup')
      const drops = allVehicleSlots.filter(s => s.type === 'drop')
      const name = vehicle.vehicle_name
      const num = vehicle.vehicle_number

      // No slots at all
      if (allVehicleSlots.length === 0) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'warning', message: 'No slots assigned for this date' })
        return
      }

      // No driver assigned
      if (!vehicle.driver_id) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'warning', message: 'No driver assigned to this vehicle' })
      }

      // Pickups without drops
      if (pickups.length > 0 && drops.length === 0) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'error', message: `${pickups.length} pickup slot(s) but NO drop slots — round-trip incomplete` })
      }

      // Drops without pickups
      if (drops.length > 0 && pickups.length === 0) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'error', message: `${drops.length} drop slot(s) but NO pickup slots — round-trip incomplete` })
      }

      // Count mismatch
      if (pickups.length > 0 && drops.length > 0 && pickups.length !== drops.length) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'warning', message: `Pickup/Drop count mismatch: ${pickups.length}P vs ${drops.length}D` })
      }

      // Duplicate pickup times
      const pTimes = pickups.map(s => s.time)
      const uniquePTimes = new Set(pTimes)
      if (pTimes.length !== uniquePTimes.size) {
        const dups = pTimes.filter((t, i) => pTimes.indexOf(t) !== i)
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'error', message: `Duplicate pickup time(s): ${[...new Set(dups)].join(', ')}` })
      }

      // Duplicate drop times
      const dTimes = drops.map(s => s.time)
      const uniqueDTimes = new Set(dTimes)
      if (dTimes.length !== uniqueDTimes.size) {
        const dups = dTimes.filter((t, i) => dTimes.indexOf(t) !== i)
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'error', message: `Duplicate drop time(s): ${[...new Set(dups)].join(', ')}` })
      }

      // Pickup time >= drop time (logical ordering error)
      if (pickups.length > 0 && drops.length > 0) {
        const sortedP = [...pickups].sort((a, b) => a.time.localeCompare(b.time))
        const sortedD = [...drops].sort((a, b) => a.time.localeCompare(b.time))
        sortedP.forEach((p, idx) => {
          const d = sortedD[idx]
          if (d && p.time >= d.time) {
            results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'error', message: `Pickup ${p.time} is at/after corresponding drop ${d.time}` })
          }
        })
      }

      // Slots without station name
      const noStation = allVehicleSlots.filter(s => !s.station_name || s.station_name.trim() === '')
      if (noStation.length > 0) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'error', message: `${noStation.length} slot(s) have no station assigned` })
      }

      // All checks passed for this vehicle
      const vehicleIssues = results.filter(r => r.vehicleId === vehicle._id)
      if (vehicleIssues.length === 0) {
        results.push({ vehicleId: vehicle._id, vehicleName: name, vehicleNumber: num, severity: 'info', message: `${allVehicleSlots.length} slots — ${pickups.length}P / ${drops.length}D — all checks passed` })
      }
    })

    return results
  }

  const handleRunTest = () => {
    const results = runLogicTest()
    setTestResults(results)
    setTestDialogOpen(true)
  }

  // Handlers
  const handleSave = async () => {
    if (!form.vehicle_id) {
      toast({ title: 'Validation Error', description: 'Please select a vehicle', variant: 'destructive' })
      return
    }
    if (form.type === 'both' && (!form.pickup_station || !form.drop_station)) {
      toast({ title: 'Validation Error', description: 'Please select both station and hospital', variant: 'destructive' })
      return
    }
    if (form.type !== 'both' && (!form.station_name || !form.date)) {
      toast({ title: 'Validation Error', description: 'Missing required fields', variant: 'destructive' })
      return
    }
    const interval = parseInt(form.interval)
    if (isNaN(interval) || interval < 5) {
      toast({ title: 'Validation Error', description: 'Cadence must be at least 5 minutes', variant: 'destructive' })
      return
    }
    if (form.start_time >= form.end_time) {
      toast({ title: 'Validation Error', description: 'Start time must be before end time', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = form.type === 'both'
        ? {
            vehicle_id: form.vehicle_id,
            type: 'both',
            pickup_station: form.pickup_station,
            drop_station: form.drop_station,
            travel_time: form.travel_time,
            start_time: form.start_time,
            end_time: form.end_time,
            interval_minutes: form.interval,
          }
        : {
            vehicle_id: form.vehicle_id,
            station_name: form.station_name,
            type: form.type,
            date: form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            interval_minutes: form.interval,
          }

      const res = await adminFetch('/api/transport/vehicle-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast({ title: 'Schedule Built', description: `${result.count} slots deployed successfully.` })
      setDialogOpen(false)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm.slotId) return
    setDeleting(true)
    try {
      const res = await adminFetch(`/api/transport/vehicle-slots/${deleteConfirm.slotId}?date=${selectedDate}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to delete slot')

      const msg = deleteConfirm.isUnblock
        ? 'Slot restored for this date.'
        : deleteConfirm.isRecurring
          ? `Slot hidden for ${selectedDate} only.`
          : 'Slot permanently removed.'

      toast({ title: deleteConfirm.isUnblock ? 'Unblocked' : 'Done', description: msg })
      setDeleteConfirm({ open: false, slotId: null })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const handleClearVehicle = async () => {
    if (!clearVehicleConfirm.vehicleId) return
    setClearing(true)
    try {
      const res = await adminFetch(`/api/transport/vehicle-slots?vehicle_id=${clearVehicleConfirm.vehicleId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to clear slots')
      setSlots(prev => prev.filter(s => {
        const vId = s.vehicle_id != null && typeof s.vehicle_id === 'object' ? s.vehicle_id._id : s.vehicle_id
        return String(vId) !== String(clearVehicleConfirm.vehicleId)
      }))
      toast({ title: 'Cleared', description: `All slots removed for ${clearVehicleConfirm.vehicleName}.` })
      setClearVehicleConfirm({ open: false, vehicleId: '', vehicleName: '', slotCount: 0 })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setClearing(false)
    }
  }

  const handleEditOpen = (slot: SlotData) => {
    setEditSlot(slot)
    setEditForm({ time: slot.time, station_name: slot.station_name, status: slot.status, block_reason: (slot as any).block_reason || '' })
    setEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!editSlot) return
    setEditSaving(true)
    try {
      const isRecurring = !editSlot.date || editSlot.date === ''
      const url = isRecurring
        ? `/api/transport/vehicle-slots/${editSlot._id}?date=${selectedDate}`
        : `/api/transport/vehicle-slots/${editSlot._id}`

      const res = await adminFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: editForm.time,
          station_name: editForm.station_name,
          status: editForm.status,
          block_reason: editForm.status === 'inactive' ? editForm.block_reason : '',
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update slot')
      toast({ title: 'Updated', description: isRecurring ? `Changes apply to ${selectedDate} only.` : 'Slot updated.' })
      setEditDialogOpen(false)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleCopyForward = async () => {
    const nextDate = new Date(selectedDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = nextDate.toISOString().split('T')[0]

    setCopying(true)
    try {
      const res = await adminFetch('/api/transport/vehicle-slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_date: selectedDate, target_date: nextDateStr }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast({ title: 'Duplicated', description: `${result.count} slots copied to ${nextDateStr}.` })
      setSelectedDate(nextDateStr)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to replicate schedule.', variant: 'destructive' })
    } finally {
      setCopying(false)
      setCopyForwardConfirm(false)
    }
  }

  // ============================================================
  // Preview logic
  // ============================================================
  const previewSlots = useMemo(() => {
    const pairs: { pickup: string; drop: string }[] = []
    const times: string[] = []
    const [sh, sm] = form.start_time.split(':').map(Number)
    const [eh, em] = form.end_time.split(':').map(Number)
    const startMin = sh * 60 + (sm || 0)
    const endMin = eh * 60 + (em || 0)
    const interval = parseInt(form.interval) || 60
    const travelMin = parseInt(form.travel_time) || 30
    if (interval < 5 || startMin >= endMin) return { pairs: [], times: [], totalCount: 0 }

    const fmt = (t: number) => {
      const h = Math.floor(t / 60)
      const min = t % 60
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    }

    for (let m = startMin; m < endMin; m += interval) {
      times.push(fmt(m))
      if (form.type === 'both') {
        pairs.push({ pickup: fmt(m), drop: fmt(m + travelMin) })
      }
    }
    const totalCount = form.type === 'both' ? pairs.length * 2 : times.length
    return { pairs, times, totalCount }
  }, [form])

  const formatTime12h = (timeStr: string) => {
    const [h, m] = timeStr.split(':')
    const hours = parseInt(h)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    return `${h12}:${m} ${ampm}`
  }

  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today

  const nextDateStr = (() => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const toggleSlotSelect = (slotId: string) => {
    setSelectedSlotIds(prev => {
      const next = new Set(prev)
      next.has(slotId) ? next.delete(slotId) : next.add(slotId)
      return next
    })
  }

  const exitBlockMode = () => {
    setBlockMode(false)
    setSelectedSlotIds(new Set())
  }

  const handleBulkBlock = async () => {
    setBulkBlocking(true)
    try {
      const res = await adminFetch('/api/transport/vehicle-slots/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_ids: [...selectedSlotIds], date: selectedDate, reason: bulkBlockReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Blocked', description: `${data.blocked} slot(s) blocked for ${selectedDate}.` })
      setBulkBlockDialog(false)
      setBulkBlockReason('')
      exitBlockMode()
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setBulkBlocking(false)
    }
  }

  const handleFullDayBlock = async () => {
    setFullDayBlocking(true)
    try {
      const res = await adminFetch('/api/transport/vehicle-slots/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_ids: fullDayBlockDialog.slotIds, date: selectedDate, reason: fullDayReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Day Blocked', description: `${data.blocked} slots blocked for ${fullDayBlockDialog.vehicleName} on ${selectedDate}.` })
      setFullDayBlockDialog({ open: false, vehicleId: '', vehicleName: '', slotIds: [] })
      setFullDayReason('')
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setFullDayBlocking(false)
    }
  }

  // Test summary for badge
  const testSummary = useMemo(() => {
    const errors = testResults.filter(r => r.severity === 'error').length
    const warnings = testResults.filter(r => r.severity === 'warning').length
    return { errors, warnings }
  }, [testResults])

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">
             Fleet Deployment Hub
          </h1>
          <p className="text-sm font-medium text-slate-500 italic">Vehicle shuttle slot management — pickup & drop round trips.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleRunTest} className="rounded-xl border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 h-11 px-5 gap-2 font-black text-xs">
            <FlaskConical className="w-4 h-4" />
            Logic Test
            {testResults.length > 0 && (
              testSummary.errors > 0
                ? <Badge className="bg-red-500 text-white border-none text-[9px] px-1.5 py-0">{testSummary.errors} err</Badge>
                : testSummary.warnings > 0
                ? <Badge className="bg-amber-400 text-white border-none text-[9px] px-1.5 py-0">{testSummary.warnings} warn</Badge>
                : <Badge className="bg-emerald-500 text-white border-none text-[9px] px-1.5 py-0">OK</Badge>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setBlockMode(b => !b); setSelectedSlotIds(new Set()) }}
            className={`rounded-xl h-11 px-5 font-black text-xs gap-2 transition-colors ${blockMode ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'border-slate-200 hover:border-slate-300'}`}
          >
            {blockMode ? <><X className="w-4 h-4" /> Exit Selection</> : <><MousePointerClick className="w-4 h-4" /> Select Slots</>}
          </Button>
          <Button variant="outline" onClick={() => setCopyForwardConfirm(true)} disabled={slots.length === 0} className="rounded-xl border-slate-200 h-11 px-5">
            <Copy className="w-4 h-4 mr-2 text-primary" /> Duplicate Tomorrow
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-xl shadow-xl shadow-primary/20 h-11 px-5">
            <Plus className="h-4 w-4 mr-2" /> Assign New Slots
          </Button>
        </div>
      </div>

      {/* Date Master Controller */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
               <button onClick={() => {
                 const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0]);
               }} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>

               <div className="px-4 py-2 flex flex-col items-center">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Target Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="text-lg font-black text-slate-800 tracking-tighter leading-none bg-transparent border-none outline-none text-center cursor-pointer"
                  />
               </div>

               <button onClick={() => {
                 const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0]);
               }} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
            </div>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 rounded-xl hover:bg-primary/10 transition-all"
              >
                <RefreshCcw className="w-3 h-3" /> Today
              </button>
            )}

            <div className="h-10 w-px bg-slate-100" />
            <div className="flex gap-1">
               <Badge className={`rounded-xl px-4 py-2 text-[10px] items-center gap-2 font-black tracking-widest border-none shadow-none ${stats.total > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                  {stats.total > 0 ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {stats.total > 0 ? 'SYNCED' : 'HOLLOW'}
               </Badge>
            </div>
         </div>

         <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input placeholder="Search assigned unit..." className="pl-10 h-12 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/10 shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
               {(['all', 'pickup', 'drop'] as const).map((t) => (
                 <button key={t} onClick={() => setTypeFilter(t)} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${typeFilter === t ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}>{t}</button>
               ))}
            </div>
         </div>
      </div>

      {stats.orphanCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-[11px] font-black text-amber-700">
            {stats.orphanCount} orphaned slot{stats.orphanCount > 1 ? 's' : ''} belong to inactive or removed vehicles — not shown below. Stats above reflect only active fleet.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Slots', val: stats.total, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pickup Slots', val: stats.pickups, icon: ArrowUp, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Drop Slots', val: stats.drops, icon: ArrowDown, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Active Fleet', val: stats.vehicles, icon: Truck, color: 'text-teal-600', bg: 'bg-teal-50' }
        ].map((s, idx) => (
          <Card key={idx} className={`p-6 rounded-[2rem] border-none shadow-sm ${s.bg} flex items-center justify-between group overflow-hidden relative`}>
            <div className="relative z-10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-black tracking-tighter ${s.color}`}>{s.val}</p>
            </div>
            <s.icon className={`h-12 w-12 ${s.color} opacity-10 absolute right-4 top-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform`} />
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
          <Loader2 className="animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest">Syncing Deployment Data...</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredVehicles.map((vehicle) => {
            const allVehicleSlots = slots.filter(slot => {
              const vId = slot.vehicle_id != null && typeof slot.vehicle_id === 'object' ? slot.vehicle_id._id : slot.vehicle_id
              return String(vId) === String(vehicle._id)
            })
            const vehicleSlots = (vehicleSlotsMap.get(vehicle._id) || []).sort((a, b) => a.time.localeCompare(b.time))
            if (searchQuery && vehicleSlots.length === 0 && !vehicle.vehicle_name.toLowerCase().includes(searchQuery.toLowerCase())) return null

            const pickupSlots = vehicleSlots.filter(s => s.type === 'pickup')
            const dropSlots = vehicleSlots.filter(s => s.type === 'drop')
            const allPickups = allVehicleSlots.filter(s => s.type === 'pickup')
            const allDrops = allVehicleSlots.filter(s => s.type === 'drop')

            // Inline health check
            const dupPickupTimes = new Set(pickupSlots.map(s => s.time).filter((t, i, arr) => arr.indexOf(t) !== i))
            const dupDropTimes = new Set(dropSlots.map(s => s.time).filter((t, i, arr) => arr.indexOf(t) !== i))
            const inlineWarnings: string[] = []
            if (dupPickupTimes.size > 0) inlineWarnings.push(`Duplicate pickup times: ${[...dupPickupTimes].join(', ')}`)
            if (dupDropTimes.size > 0) inlineWarnings.push(`Duplicate drop times: ${[...dupDropTimes].join(', ')}`)
            if (allPickups.length > 0 && allDrops.length > 0 && allPickups.length !== allDrops.length)
              inlineWarnings.push(`Pickup/Drop count mismatch — ${allPickups.length}P vs ${allDrops.length}D`)
            if (allPickups.length > 0 && allDrops.length === 0) inlineWarnings.push('Pickup slots but no drop slots')
            if (allDrops.length > 0 && allPickups.length === 0) inlineWarnings.push('Drop slots but no pickup slots')

            return (
              <Card key={vehicle._id} className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100 group">
                <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-center gap-5 text-sm">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all"><Bus className="h-6 w-6" /></div>
                    <div>
                      <h3 className="font-black text-lg text-slate-800 flex items-center gap-2 leading-none uppercase italic tracking-tighter flex-wrap">
                        {vehicle.vehicle_name}
                        <Badge variant="secondary" className="font-mono text-[9px] bg-white text-slate-400 border border-slate-100">{vehicle.vehicle_number}</Badge>
                        {allVehicleSlots.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Badge className="text-[9px] font-black bg-primary/10 text-primary border-none px-2 py-0.5">
                              P:{allPickups.length}
                            </Badge>
                            <Badge className="text-[9px] font-black bg-orange-100 text-orange-600 border-none px-2 py-0.5">
                              D:{allDrops.length}
                            </Badge>
                          </span>
                        )}
                      </h3>
                      {vehicle.driver_id ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-3">
                           <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 opacity-40" /> {vehicle.driver_id.name}</span>
                           <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 opacity-40" /> {vehicle.driver_id.phone}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" /> Unassigned Operator
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allVehicleSlots.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl hover:bg-red-50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest text-slate-400"
                        onClick={() => setClearVehicleConfirm({ open: true, vehicleId: vehicle._id, vehicleName: vehicle.vehicle_name, slotCount: allVehicleSlots.length })}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear All
                      </Button>
                    )}
                    {vehicleSlots.filter(s => s.status === 'active').length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl hover:bg-red-50 hover:text-red-600 text-[10px] font-black uppercase tracking-widest text-slate-400"
                        onClick={() => {
                          const activeIds = vehicleSlots.filter(s => s.status === 'active').map(s => s._id)
                          setFullDayBlockDialog({ open: true, vehicleId: vehicle._id, vehicleName: vehicle.vehicle_name, slotIds: activeIds })
                        }}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1.5" /> Block Day
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="rounded-xl hover:bg-primary/5 hover:text-primary text-[10px] font-black uppercase tracking-widest" onClick={() => { resetForm(vehicle._id); setDialogOpen(true); }}>
                       <Plus className="h-3.5 w-3.5 mr-2" /> Add Slots
                    </Button>
                  </div>
                </div>
                {inlineWarnings.length > 0 && (
                  <div className="bg-amber-50 border-b border-amber-100 px-7 py-3 flex flex-col gap-1">
                    {inlineWarnings.map((w, i) => (
                      <p key={i} className="text-[10px] font-black text-amber-700 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
                <CardContent className="p-7">
                  {vehicleSlots.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-3 opacity-20 border-2 border-dashed border-slate-100 rounded-[2rem]">
                       <Calendar className="w-8 h-8" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No slots assigned.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Pickup Slots */}
                      {pickupSlots.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                            <ArrowUp className="w-3 h-3" /> Pickup — Station to Clinic
                            <span className="text-slate-300">({pickupSlots.length})</span>
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {pickupSlots.map((slot) => {
                              if (slot.status === 'inactive') return (
                                <div key={slot._id} className="group/slot relative flex flex-col items-center justify-center w-32 rounded-[1.5rem] border border-red-200 bg-red-50 pt-2 pb-2 opacity-80">
                                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5"><Ban className="w-2 h-2" />BLOCKED</span>
                                  <p className="text-sm font-black tracking-tighter leading-none mb-0.5 text-red-300 line-through">{formatTime12h(slot.time)}</p>
                                  <p className="text-[9px] font-bold text-red-300 normal-case w-[110px] text-center leading-tight line-clamp-1 px-1">{slot.station_name}</p>
                                  {slot.block_reason && <p className="text-[8px] text-red-400 italic text-center px-2 mt-1 leading-tight line-clamp-2">{slot.block_reason}</p>}
                                  <button onClick={() => setDeleteConfirm({ open: true, slotId: slot._id, isUnblock: true })} title="Unblock" className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-white border border-red-100 rounded-full text-emerald-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110"><CheckCircle2 className="h-3 w-3" /></button>
                                </div>
                              )
                              const isDup = dupPickupTimes.has(slot.time)
                              const booked = bookingMap.get(`p|${vehicle._id}|${slot.time}`) || 0
                              const cap = vehicle.seat_capacity || 0
                              const pct = cap > 0 ? Math.min(100, Math.round((booked / cap) * 100)) : 0
                              const isFull = cap > 0 && booked >= cap
                              const fillColor = isFull ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
                              const isSelected = blockMode && selectedSlotIds.has(slot._id)
                              const canSelect = blockMode && booked === 0
                              return (
                                <div
                                  key={slot._id}
                                  onClick={() => canSelect && toggleSlotSelect(slot._id)}
                                  title={`${slot.station_name} · ${slot.time} · ${booked}${cap ? `/${cap}` : ''} booked${slot.date === '' ? ' · Recurring' : ''}`}
                                  className={`group/slot relative flex flex-col items-center justify-center w-32 rounded-[1.5rem] border transition-all pt-2 pb-1.5
                                    ${canSelect ? 'cursor-pointer' : ''}
                                    ${isSelected ? 'ring-2 ring-red-500 bg-red-50 border-red-300' : isDup ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300' : 'bg-primary/5 border-primary/20 hover:bg-primary hover:border-primary'}`}
                                >
                                  {isSelected && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">✓ SEL</span>}
                                  {!isSelected && isDup && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-amber-400 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">DUPE</span>}
                                  <p className={`text-sm font-black tracking-tighter leading-none mb-0.5 group-hover/slot:text-white ${isSelected ? 'text-red-600' : isDup ? 'text-amber-700' : 'text-primary'}`}>{formatTime12h(slot.time)}</p>
                                  <p className="text-[9px] font-bold text-slate-500 group-hover/slot:text-white/70 normal-case w-[110px] text-center leading-tight line-clamp-1 px-1">{slot.station_name}</p>
                                  <div className="mt-1.5 w-[100px] flex flex-col items-center gap-0.5">
                                    <div className="flex items-center justify-between w-full px-0.5">
                                      <span className={`text-[9px] font-black group-hover/slot:text-white/80 ${isFull ? 'text-red-500' : booked > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{booked}{cap > 0 ? `/${cap}` : ''} bkd</span>
                                      {isFull && <span className="text-[8px] font-black text-red-500 group-hover/slot:text-white/80">FULL</span>}
                                    </div>
                                    {cap > 0 && <div className="w-full h-1 bg-slate-200 group-hover/slot:bg-white/20 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${fillColor} group-hover/slot:opacity-90`} style={{ width: `${pct}%` }} /></div>}
                                  </div>
                                  {!blockMode && booked === 0 && (
                                    <>
                                      <button onClick={() => handleEditOpen(slot)} className="absolute -top-1.5 -left-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-blue-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Pencil className="h-3 w-3" /></button>
                                      <button onClick={() => setDeleteConfirm({ open: true, slotId: slot._id, isRecurring: !slot.date || slot.date === '' })} className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-red-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Trash2 className="h-3 w-3" /></button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Drop Slots */}
                      {dropSlots.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <ArrowDown className="w-3 h-3" /> Drop — Clinic to Station
                            <span className="text-slate-300">({dropSlots.length})</span>
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {dropSlots.map((slot) => {
                              if (slot.status === 'inactive') return (
                                <div key={slot._id} className="group/slot relative flex flex-col items-center justify-center w-32 rounded-[1.5rem] border border-red-200 bg-red-50 pt-2 pb-2 opacity-80">
                                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5"><Ban className="w-2 h-2" />BLOCKED</span>
                                  <p className="text-sm font-black tracking-tighter leading-none mb-0.5 text-red-300 line-through">{formatTime12h(slot.time)}</p>
                                  <p className="text-[9px] font-bold text-red-300 normal-case w-[110px] text-center leading-tight line-clamp-1 px-1">{slot.station_name}</p>
                                  {slot.block_reason && <p className="text-[8px] text-red-400 italic text-center px-2 mt-1 leading-tight line-clamp-2">{slot.block_reason}</p>}
                                  <button onClick={() => setDeleteConfirm({ open: true, slotId: slot._id, isUnblock: true })} title="Unblock" className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-white border border-red-100 rounded-full text-emerald-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110"><CheckCircle2 className="h-3 w-3" /></button>
                                </div>
                              )
                              const isDup = dupDropTimes.has(slot.time)
                              const booked = bookingMap.get(`d|${vehicle._id}|${slot.time}`) || 0
                              const cap = vehicle.seat_capacity || 0
                              const pct = cap > 0 ? Math.min(100, Math.round((booked / cap) * 100)) : 0
                              const isFull = cap > 0 && booked >= cap
                              const fillColor = isFull ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
                              const isSelected = blockMode && selectedSlotIds.has(slot._id)
                              const canSelect = blockMode && booked === 0
                              return (
                                <div
                                  key={slot._id}
                                  onClick={() => canSelect && toggleSlotSelect(slot._id)}
                                  title={`${slot.station_name} · ${slot.time} · ${booked}${cap ? `/${cap}` : ''} booked${slot.date === '' ? ' · Recurring' : ''}`}
                                  className={`group/slot relative flex flex-col items-center justify-center w-32 rounded-[1.5rem] border transition-all pt-2 pb-1.5
                                    ${canSelect ? 'cursor-pointer' : ''}
                                    ${isSelected ? 'ring-2 ring-red-500 bg-red-50 border-red-300' : isDup ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300' : 'bg-orange-50 border-orange-200 hover:bg-orange-500 hover:border-orange-500'}`}
                                >
                                  {isSelected && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">✓ SEL</span>}
                                  {!isSelected && isDup && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-amber-400 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">DUPE</span>}
                                  <p className={`text-sm font-black tracking-tighter leading-none mb-0.5 group-hover/slot:text-white ${isSelected ? 'text-red-600' : isDup ? 'text-amber-700' : 'text-orange-700'}`}>{formatTime12h(slot.time)}</p>
                                  <p className="text-[9px] font-bold text-slate-500 group-hover/slot:text-white/70 normal-case w-[110px] text-center leading-tight line-clamp-1 px-1">{slot.station_name}</p>
                                  <div className="mt-1.5 w-[100px] flex flex-col items-center gap-0.5">
                                    <div className="flex items-center justify-between w-full px-0.5">
                                      <span className={`text-[9px] font-black group-hover/slot:text-white/80 ${isFull ? 'text-red-500' : booked > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{booked}{cap > 0 ? `/${cap}` : ''} bkd</span>
                                      {isFull && <span className="text-[8px] font-black text-red-500 group-hover/slot:text-white/80">FULL</span>}
                                    </div>
                                    {cap > 0 && <div className="w-full h-1 bg-slate-200 group-hover/slot:bg-white/20 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${fillColor} group-hover/slot:opacity-90`} style={{ width: `${pct}%` }} /></div>}
                                  </div>
                                  {!blockMode && booked === 0 && (
                                    <>
                                      <button onClick={() => handleEditOpen(slot)} className="absolute -top-1.5 -left-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-blue-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Pencil className="h-3 w-3" /></button>
                                      <button onClick={() => setDeleteConfirm({ open: true, slotId: slot._id, isRecurring: !slot.date || slot.date === '' })} className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-red-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Trash2 className="h-3 w-3" /></button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ============ FLOATING BLOCK BAR ============ */}
      {blockMode && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-[2rem] shadow-2xl transition-all duration-300 ${selectedSlotIds.size > 0 ? 'bg-slate-900 text-white scale-100' : 'bg-slate-700 text-white/60 scale-95'}`}>
          <MousePointerClick className="w-4 h-4 shrink-0" />
          <span className="text-sm font-black">
            {selectedSlotIds.size > 0 ? `${selectedSlotIds.size} slot${selectedSlotIds.size > 1 ? 's' : ''} selected` : 'Click slots to select'}
          </span>
          {selectedSlotIds.size > 0 && (
            <>
              <button onClick={() => setSelectedSlotIds(new Set())} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors px-2">Clear</button>
              <Button onClick={() => setBulkBlockDialog(true)} className="rounded-xl h-9 px-4 bg-red-500 hover:bg-red-600 text-white font-black text-xs gap-1.5">
                <Ban className="w-3.5 h-3.5" /> Block Selected
              </Button>
            </>
          )}
          <button onClick={exitBlockMode} className="ml-1 text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ============ BULK BLOCK DIALOG ============ */}
      <Dialog open={bulkBlockDialog} onOpenChange={(o) => { setBulkBlockDialog(o); if (!o) setBulkBlockReason('') }}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] [&>button]:text-white [&>button]:top-6 [&>button]:right-6">
          <div className="bg-red-600 p-8 text-white relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10 rotate-12 pointer-events-none"><Ban className="w-36 h-36" /></div>
            <DialogHeader className="relative z-10 space-y-1">
              <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                <Ban className="w-5 h-5" /> Block {selectedSlotIds.size} Slot{selectedSlotIds.size > 1 ? 's' : ''}
              </DialogTitle>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/50">For {selectedDate}</p>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Block Reason (Optional)</Label>
              <Input
                placeholder="e.g. Public holiday, vehicle maintenance..."
                value={bulkBlockReason}
                onChange={(e) => setBulkBlockReason(e.target.value)}
                className="h-14 rounded-2xl bg-red-50 border border-red-100 font-medium"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-3 pt-1">
              <Button variant="ghost" onClick={() => setBulkBlockDialog(false)} className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
              <Button onClick={handleBulkBlock} disabled={bulkBlocking} className="flex-[2] h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-red-600 hover:bg-red-700 shadow-xl shadow-red-500/20">
                {bulkBlocking ? <Loader2 className="animate-spin" /> : <><Ban className="w-4 h-4 mr-2" />Confirm Block</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ FULL DAY BLOCK DIALOG ============ */}
      <Dialog open={fullDayBlockDialog.open} onOpenChange={(o) => { setFullDayBlockDialog(d => ({ ...d, open: o })); if (!o) setFullDayReason('') }}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] [&>button]:text-white [&>button]:top-6 [&>button]:right-6">
          <div className="bg-red-700 p-8 text-white relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10 rotate-12 pointer-events-none"><Ban className="w-36 h-36" /></div>
            <DialogHeader className="relative z-10 space-y-1">
              <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                <Ban className="w-5 h-5" /> Block Full Day
              </DialogTitle>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/50">
                {fullDayBlockDialog.vehicleName} · {selectedDate} · {fullDayBlockDialog.slotIds.length} slots
              </p>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5 bg-white">
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-sm text-red-700 font-medium leading-relaxed">
              All <strong>{fullDayBlockDialog.slotIds.length} active slot{fullDayBlockDialog.slotIds.length !== 1 ? 's' : ''}</strong> for <strong>{fullDayBlockDialog.vehicleName}</strong> will be blocked for patients on <strong>{selectedDate}</strong>.
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Block Reason (Optional)</Label>
              <Input
                placeholder="e.g. Public holiday, driver leave..."
                value={fullDayReason}
                onChange={(e) => setFullDayReason(e.target.value)}
                className="h-14 rounded-2xl bg-red-50 border border-red-100 font-medium"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-3 pt-1">
              <Button variant="ghost" onClick={() => setFullDayBlockDialog(d => ({ ...d, open: false }))} className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
              <Button onClick={handleFullDayBlock} disabled={fullDayBlocking} className="flex-[2] h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-red-700 hover:bg-red-800 shadow-xl shadow-red-700/20">
                {fullDayBlocking ? <Loader2 className="animate-spin" /> : <><Ban className="w-4 h-4 mr-2" />Block All Slots</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ DEPLOYMENT WIZARD DIALOG ============ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] max-h-[90vh] flex flex-col [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">
           <div className="bg-primary p-10 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Calendar className="w-40 h-40" /></div>
              <DialogHeader className="space-y-1 relative z-10">
                 <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                    <CalendarClock className="w-7 h-7" /> Deployment Wizard
                 </DialogTitle>
                 <p className="text-[10px] uppercase font-black tracking-widest text-white/50">Auto-Generate Pickup & Drop Slots</p>
              </DialogHeader>
           </div>

           <div className="p-10 space-y-7 bg-white overflow-y-auto flex-1">

              {/* Vehicle + Type */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assigned Vehicle</Label>
                    <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                       <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                       <SelectContent className="rounded-2xl border-none shadow-xl">{vehicles.filter(v => v.status === 'active').map((v) => (<SelectItem key={v._id} value={v._id}>{v.vehicle_name} ({v.vehicle_number})</SelectItem>))}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Slot Type</Label>
                    <div className="flex p-1 bg-slate-100 rounded-2xl h-14 shadow-inner">
                       {(['both', 'pickup', 'drop'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={(e) => { e.preventDefault(); setForm({ ...form, type: t }); }}
                            className={`flex-1 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-200 ${form.type === t ? 'bg-white shadow-md text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {t}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              {form.type === 'both' && (
                <div className="bg-primary/5 rounded-2xl px-4 py-2.5 text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <Repeat className="w-3 h-3" /> Creates recurring global slots (all dates)
                </div>
              )}

              {/* Stations — context-aware labels */}
              {form.type === 'both' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station (Pickup Point)</Label>
                    <Select value={form.pickup_station} onValueChange={(v) => setForm({ ...form, pickup_station: v })}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="e.g. Taman Melati" /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">{stations.filter(s => s.status === 'active').map((s) => (<SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Clinic (Drop Point)</Label>
                    <Select value={form.drop_station} onValueChange={(v) => setForm({ ...form, drop_station: v })}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="e.g. Clinic KL" /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">{stations.filter(s => s.status === 'active').map((s) => (<SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station</Label>
                    <Select value={form.station_name} onValueChange={(v) => setForm({ ...form, station_name: v })}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="Which station?" /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">{stations.filter(s => s.status === 'active').map((s) => (<SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Target Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                  </div>
                </div>
              )}

              {/* Time config */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Daily Start</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Operation End</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cadence (Min, min 5)</Label>
                    <Input type="number" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" min="5" />
                 </div>
                 {form.type === 'both' ? (
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Travel Time (Min)</Label>
                     <Input type="number" value={form.travel_time} onChange={(e) => setForm({ ...form, travel_time: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" min="1" />
                   </div>
                 ) : (
                   <div className="flex items-end pb-1">
                     <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                       {previewSlots.totalCount > 0 ? `${previewSlots.totalCount} slots will be generated` : 'Adjust time range & cadence'}
                     </p>
                   </div>
                 )}
              </div>

              {/* Validation hint */}
              {form.start_time >= form.end_time && form.start_time && form.end_time && (
                <div className="bg-red-50 rounded-2xl px-4 py-2.5 text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                  <XCircle className="w-3 h-3" /> Start time must be before end time
                </div>
              )}

              {/* Preview */}
              {previewSlots.totalCount > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                     Preview — {previewSlots.totalCount} slots ({form.type === 'both' ? `${previewSlots.pairs.length} trips` : `${previewSlots.times.length} slots`})
                   </p>

                   {form.type === 'both' ? (
                     <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                       <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-300 pb-1 border-b border-slate-100">
                         <span className="flex-1 text-primary">Pickup @ Station</span>
                         <span className="w-6" />
                         <span className="flex-1 text-orange-500">Drop @ Clinic</span>
                       </div>
                       {previewSlots.pairs.map((p, i) => (
                         <div key={i} className="flex items-center gap-2">
                           <Badge className="flex-1 justify-center px-2 py-1.5 rounded-xl text-[10px] font-black border-none shadow-none bg-primary/10 text-primary">
                             {formatTime12h(p.pickup)}
                           </Badge>
                           <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                           <Badge className="flex-1 justify-center px-2 py-1.5 rounded-xl text-[10px] font-black border-none shadow-none bg-orange-100 text-orange-700">
                             {formatTime12h(p.drop)}
                           </Badge>
                         </div>
                       ))}
                       <p className="text-[8px] text-slate-400 pt-1 text-center">Travel time: {form.travel_time} min per trip</p>
                     </div>
                   ) : (
                     <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto no-scrollbar">
                       {previewSlots.times.map(t => (
                         <Badge key={t} className={`px-2 py-0.5 rounded-lg text-[9px] font-black border-none shadow-none ${form.type === 'pickup' ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-700'}`}>
                           {formatTime12h(t)}
                         </Badge>
                       ))}
                     </div>
                   )}
                </div>
              )}

              <DialogFooter className="gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setDialogOpen(false)} className="flex-1 h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Abort</Button>
                 <Button onClick={handleSave} disabled={saving || previewSlots.totalCount === 0} className="flex-[2] h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20">
                    {saving ? <Loader2 className="animate-spin" /> : `Deploy (${previewSlots.totalCount} slots)`}
                 </Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>

      {/* ============ EDIT SLOT DIALOG ============ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] [&>button]:text-white [&>button]:top-6 [&>button]:right-6 [&>button]:opacity-100">
           <div className="bg-blue-600 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Pencil className="w-32 h-32" /></div>
              <DialogHeader className="space-y-1 relative z-10">
                 <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                    <Pencil className="w-5 h-5" /> Edit Slot
                 </DialogTitle>
                 <p className="text-[10px] uppercase font-black tracking-widest text-white/50">
                   {editSlot?.type === 'pickup' ? 'Pickup' : 'Drop'} Slot
                   {(!editSlot?.date || editSlot?.date === '') ? ` · ${selectedDate} Only` : ` · ${editSlot?.date}`}
                 </p>
              </DialogHeader>
           </div>

           <div className="p-8 space-y-5 bg-white">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Time</Label>
                 <Input
                   type="time"
                   value={editForm.time}
                   onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                   className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                 />
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station</Label>
                 <Select value={editForm.station_name} onValueChange={(v) => setEditForm({ ...editForm, station_name: v })}>
                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-blue-200">
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl">
                      {stations.filter(s => s.status === 'active').map((s) => (
                        <SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status</Label>
                 <div className="flex p-1 bg-slate-100 rounded-2xl h-14 shadow-inner">
                    {(['active', 'inactive'] as const).map((s) => (
                       <button
                         key={s}
                         type="button"
                         onClick={() => setEditForm({ ...editForm, status: s, block_reason: s === 'active' ? '' : editForm.block_reason })}
                         className={`flex-1 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-200 ${
                           editForm.status === s
                             ? s === 'inactive' ? 'bg-white shadow-md text-red-500' : 'bg-white shadow-md text-blue-600'
                             : 'text-slate-400 hover:text-slate-600'
                         }`}
                       >
                         {s === 'inactive' ? '🔒 Inactive' : '✓ Active'}
                       </button>
                    ))}
                 </div>
              </div>

              {editForm.status === 'inactive' && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Block Reason (Optional)</Label>
                  <Input
                    placeholder="e.g. Vehicle maintenance, public holiday..."
                    value={editForm.block_reason}
                    onChange={(e) => setEditForm({ ...editForm, block_reason: e.target.value })}
                    className="h-12 rounded-2xl bg-red-50 border border-red-100 text-sm font-medium placeholder:text-slate-300"
                  />
                </div>
              )}

              <DialogFooter className="gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
                 <Button onClick={handleEditSave} disabled={editSaving || !editForm.time || !editForm.station_name} className="flex-[2] h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                    {editSaving ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                 </Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>

      {/* ============ DELETE / UNBLOCK CONFIRM DIALOG ============ */}
      <Dialog open={deleteConfirm.open} onOpenChange={(o) => !deleting && setDeleteConfirm({ open: o, slotId: o ? deleteConfirm.slotId : null })}>
        <DialogContent className="sm:max-w-[380px] border-none shadow-2xl rounded-[2.5rem] p-0 overflow-hidden">
          {deleteConfirm.isUnblock ? (
            /* ── Unblock ── */
            <>
              <div className="bg-emerald-500 p-7 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5" /> Unblock Slot
                  </DialogTitle>
                  <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                    Restore for {selectedDate} only
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-7 space-y-5 bg-white">
                <p className="text-sm text-slate-600">This will restore the slot for <strong>{selectedDate}</strong>. The recurring schedule is not affected.</p>
                <DialogFooter className="gap-3">
                  <Button variant="ghost" onClick={() => setDeleteConfirm({ open: false, slotId: null })} disabled={deleting} className="flex-1 h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
                  <Button onClick={handleDeleteConfirmed} disabled={deleting} className="flex-[2] h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-200">
                    {deleting ? <Loader2 className="animate-spin" /> : 'Yes, Unblock'}
                  </Button>
                </DialogFooter>
              </div>
            </>
          ) : deleteConfirm.isRecurring ? (
            /* ── Hide for this date only (recurring slot) ── */
            <>
              <div className="bg-amber-500 p-7 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                    <Ban className="w-5 h-5" /> Hide for This Date
                  </DialogTitle>
                  <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                    {selectedDate} only — recurring slot unchanged
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-7 space-y-5 bg-white">
                <p className="text-sm text-slate-600">This slot will be <strong>hidden for {selectedDate} only</strong>. The recurring global schedule remains intact for all other dates.</p>
                <DialogFooter className="gap-3">
                  <Button variant="ghost" onClick={() => setDeleteConfirm({ open: false, slotId: null })} disabled={deleting} className="flex-1 h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
                  <Button onClick={handleDeleteConfirmed} disabled={deleting} className="flex-[2] h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-200">
                    {deleting ? <Loader2 className="animate-spin" /> : `Hide for ${selectedDate}`}
                  </Button>
                </DialogFooter>
              </div>
            </>
          ) : (
            /* ── Permanent delete (date-specific slot) ── */
            <>
              <div className="bg-red-500 p-7 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                    <Trash2 className="w-5 h-5" /> Remove Slot
                  </DialogTitle>
                  <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                    Permanently removes this date-specific slot
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-7 space-y-5 bg-white">
                <p className="text-sm text-slate-600">This date-specific slot will be <strong>permanently deleted</strong>. This cannot be undone.</p>
                <DialogFooter className="gap-3">
                  <Button variant="ghost" onClick={() => setDeleteConfirm({ open: false, slotId: null })} disabled={deleting} className="flex-1 h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
                  <Button onClick={handleDeleteConfirmed} disabled={deleting} className="flex-[2] h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-red-500 hover:bg-red-600 shadow-xl shadow-red-200">
                    {deleting ? <Loader2 className="animate-spin" /> : 'Yes, Delete'}
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ CLEAR VEHICLE CONFIRM DIALOG ============ */}
      <Dialog open={clearVehicleConfirm.open} onOpenChange={(o) => !clearing && setClearVehicleConfirm(p => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-[380px] border-none shadow-2xl rounded-[2.5rem] p-0 overflow-hidden">
          <div className="bg-red-500 p-7 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                <Trash2 className="w-5 h-5" /> Clear All Slots
              </DialogTitle>
              <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                Removes all slots for this vehicle
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-7 space-y-5 bg-white">
            <p className="text-sm text-slate-600">
              Remove all <strong>{clearVehicleConfirm.slotCount}</strong> slots for <strong>{clearVehicleConfirm.vehicleName}</strong>? This deletes the vehicle's schedule entirely (all dates).
            </p>
            <DialogFooter className="gap-3">
              <Button variant="ghost" onClick={() => setClearVehicleConfirm(p => ({ ...p, open: false }))} disabled={clearing} className="flex-1 h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
              <Button onClick={handleClearVehicle} disabled={clearing} className="flex-[2] h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-red-500 hover:bg-red-600 shadow-xl shadow-red-200">
                {clearing ? <Loader2 className="animate-spin" /> : `Clear ${clearVehicleConfirm.slotCount} Slots`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ COPY FORWARD CONFIRM DIALOG ============ */}
      <Dialog open={copyForwardConfirm} onOpenChange={(o) => !copying && setCopyForwardConfirm(o)}>
        <DialogContent className="sm:max-w-[380px] border-none shadow-2xl rounded-[2.5rem] p-0 overflow-hidden">
          <div className="bg-primary p-7 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                <Copy className="w-5 h-5" /> Duplicate Schedule
              </DialogTitle>
              <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                Copy fleet schedule to next day
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-7 space-y-5 bg-white">
            <p className="text-sm text-slate-600">
              Copy <strong>{slots.length} slots</strong> from <strong>{selectedDate}</strong> to <strong>{nextDateStr}</strong>? Any existing schedule on the target date will be replaced.
            </p>
            <DialogFooter className="gap-3">
              <Button variant="ghost" onClick={() => setCopyForwardConfirm(false)} disabled={copying} className="flex-1 h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
              <Button onClick={handleCopyForward} disabled={copying} className="flex-[2] h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20">
                {copying ? <Loader2 className="animate-spin" /> : `Copy to ${nextDateStr}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ LOGIC TEST DIALOG ============ */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-[560px] border-none shadow-2xl rounded-[3rem] p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <div className="bg-violet-600 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><FlaskConical className="w-40 h-40" /></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                <FlaskConical className="w-6 h-6" /> Logic Test Report
              </DialogTitle>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/50 mt-1">
                Schedule for {selectedDate} — {vehicles.filter(v => v.status === 'active').length} vehicles analysed
              </p>
            </DialogHeader>
            {/* Summary badges */}
            <div className="flex gap-2 mt-4">
              {(() => {
                const errors = testResults.filter(r => r.severity === 'error').length
                const warnings = testResults.filter(r => r.severity === 'warning').length
                const ok = testResults.filter(r => r.severity === 'info').length
                return (
                  <>
                    <Badge className="bg-red-500/20 text-white border-none text-[10px] font-black px-3 py-1">{errors} Errors</Badge>
                    <Badge className="bg-amber-400/20 text-white border-none text-[10px] font-black px-3 py-1">{warnings} Warnings</Badge>
                    <Badge className="bg-emerald-400/20 text-white border-none text-[10px] font-black px-3 py-1">{ok} Passed</Badge>
                  </>
                )
              })()}
            </div>
          </div>

          <div className="p-7 overflow-y-auto flex-1 space-y-3 bg-white">
            {testResults.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-300">
                <ShieldCheck className="w-12 h-12" />
                <p className="text-[10px] font-black uppercase tracking-widest">No vehicles to test</p>
              </div>
            ) : (
              (() => {
                // Group by vehicle
                const byVehicle = new Map<string, TestResult[]>()
                testResults.forEach(r => {
                  if (!byVehicle.has(r.vehicleId)) byVehicle.set(r.vehicleId, [])
                  byVehicle.get(r.vehicleId)!.push(r)
                })

                return Array.from(byVehicle.entries()).map(([vehicleId, results]) => {
                  const hasErrors = results.some(r => r.severity === 'error')
                  const hasWarnings = results.some(r => r.severity === 'warning')
                  const allOk = results.every(r => r.severity === 'info')
                  const vName = results[0].vehicleName
                  const vNum = results[0].vehicleNumber

                  return (
                    <div key={vehicleId} className={`rounded-2xl border p-4 ${hasErrors ? 'bg-red-50 border-red-100' : hasWarnings ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {allOk
                          ? <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                          : hasErrors
                          ? <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        }
                        <span className="font-black text-sm text-slate-700">{vName}</span>
                        <span className="text-[9px] font-black text-slate-400 font-mono">{vNum}</span>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {results.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            {r.severity === 'error' && <XCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />}
                            {r.severity === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />}
                            {r.severity === 'info' && <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />}
                            <p className={`text-[11px] font-bold ${r.severity === 'error' ? 'text-red-600' : r.severity === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {r.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()
            )}
          </div>

          <div className="p-5 border-t border-slate-100 bg-white flex gap-3">
            <Button variant="ghost" onClick={() => { const r = runLogicTest(); setTestResults(r) }} className="flex-1 h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest gap-2">
              <RefreshCcw className="w-3.5 h-3.5" /> Re-Run Test
            </Button>
            <Button onClick={() => setTestDialogOpen(false)} className="flex-[2] h-12 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] bg-violet-600 hover:bg-violet-700">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
