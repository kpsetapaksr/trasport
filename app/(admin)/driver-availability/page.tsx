'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { adminFetch } from '@/lib/api-client'
import {
  CalendarOff, Ban, Plus, Loader2, Pencil, Trash2,
  CheckCircle2, XCircle, CalendarDays, Clock, AlertCircle,
} from 'lucide-react'

// ─── constants ───────────────────────────────────────────────────────────────

const LEAVE_TYPE_LABELS: Record<string, string> = {
  weekly_off: 'Weekly Off',
  annual_leave: 'Annual Leave',
  sick: 'Sick Leave',
  other: 'Other',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'pending' | 'destructive'> = {
  approved: 'success',
  pending: 'pending',
  rejected: 'destructive',
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`
}

const LEAVE_EMPTY = {
  driver_id: '',
  leave_type: 'annual_leave',
  start_date: '',
  end_date: '',
  reason: '',
  status: 'approved',
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function DriverAvailabilityPage() {
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'leaves' | 'overrides'>('leaves')
  const [drivers, setDrivers] = useState<any[]>([])
  const [driversLoading, setDriversLoading] = useState(true)

  // ── leaves state ─────────────────────────────────────────────────────────
  const [filterDriverId, setFilterDriverId] = useState('all')
  const [leaves, setLeaves] = useState<any[]>([])
  const [leavesLoading, setLeavesLoading] = useState(false)
  const [leaveDialog, setLeaveDialog] = useState(false)
  const [editingLeave, setEditingLeave] = useState<any>(null)
  const [leaveForm, setLeaveForm] = useState({ ...LEAVE_EMPTY })
  const [leaveSaving, setLeaveSaving] = useState(false)

  // ── overrides state ───────────────────────────────────────────────────────
  const [ovDriverId, setOvDriverId] = useState('')
  const [ovDate, setOvDate] = useState('')
  const [ovDoc, setOvDoc] = useState<any>(null)
  const [ovLoading, setOvLoading] = useState(false)
  const [ovSaving, setOvSaving] = useState(false)
  const [ovBlockAll, setOvBlockAll] = useState(false)
  const [ovDisabled, setOvDisabled] = useState<string[]>([])
  const [ovReason, setOvReason] = useState('')
  const [vehicleTimes, setVehicleTimes] = useState<string[]>([])

  // ─── init ─────────────────────────────────────────────────────────────────
  useEffect(() => { fetchDrivers() }, [])

  useEffect(() => {
    if (activeTab === 'leaves') fetchLeaves()
  }, [activeTab, filterDriverId])

  useEffect(() => {
    if (activeTab === 'overrides' && ovDriverId && ovDate) fetchOverride()
  }, [ovDriverId, ovDate])

  useEffect(() => {
    if (ovDriverId) fetchVehicleTimes(ovDriverId)
  }, [ovDriverId])

  // ─── fetchers ─────────────────────────────────────────────────────────────
  async function fetchDrivers() {
    try {
      setDriversLoading(true)
      const res = await adminFetch('/api/drivers')
      const data = await res.json()
      setDrivers(data.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load drivers.', variant: 'destructive' })
    } finally {
      setDriversLoading(false)
    }
  }

  async function fetchLeaves() {
    try {
      setLeavesLoading(true)
      const qs = filterDriverId !== 'all' ? `?driver_id=${filterDriverId}` : ''
      const res = await adminFetch(`/api/driver-leaves${qs}`)
      const data = await res.json()
      setLeaves(data.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load leaves.', variant: 'destructive' })
    } finally {
      setLeavesLoading(false)
    }
  }

  async function fetchOverride() {
    try {
      setOvLoading(true)
      const res = await adminFetch(`/api/slot-overrides?driver_id=${ovDriverId}&date=${ovDate}`)
      const data = await res.json()
      const ov = (data.data || [])[0] || null
      setOvDoc(ov)
      setOvBlockAll(ov?.block_full_day ?? false)
      setOvDisabled(ov?.disabled_slots ?? [])
      setOvReason(ov?.reason ?? '')
    } catch {
      toast({ title: 'Error', description: 'Failed to load override.', variant: 'destructive' })
    } finally {
      setOvLoading(false)
    }
  }

  async function fetchVehicleTimes(driverId: string) {
    try {
      const vRes = await adminFetch('/api/vehicles')
      const vData = await vRes.json()
      const vehicles: any[] = vData.data || []

      const driverVehicle = vehicles.find((v: any) => {
        const vid = v.driver_id?._id ? String(v.driver_id._id) : String(v.driver_id)
        return vid === driverId
      })
      if (!driverVehicle) { setVehicleTimes([]); return }

      const sRes = await adminFetch(`/api/transport/vehicle-slots?vehicle_id=${driverVehicle._id}`)
      const sData = await sRes.json()
      const slots: any[] = sData.data || []
      const times = [...new Set<string>(slots.filter((s: any) => s.status === 'active').map((s: any) => s.time))].sort()
      setVehicleTimes(times)
    } catch {
      setVehicleTimes([])
    }
  }

  // ─── leave actions ────────────────────────────────────────────────────────
  function openAddLeave() {
    setEditingLeave(null)
    setLeaveForm({ ...LEAVE_EMPTY, driver_id: filterDriverId !== 'all' ? filterDriverId : '' })
    setLeaveDialog(true)
  }

  function openEditLeave(leave: any) {
    setEditingLeave(leave)
    setLeaveForm({
      driver_id: String(leave.driver_id),
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason || '',
      status: leave.status,
    })
    setLeaveDialog(true)
  }

  async function saveLeave() {
    if (!leaveForm.driver_id || !leaveForm.start_date || !leaveForm.end_date) {
      toast({ title: 'Missing fields', description: 'Driver, start date, and end date are required.', variant: 'destructive' })
      return
    }
    setLeaveSaving(true)
    try {
      const url = editingLeave ? `/api/driver-leaves/${editingLeave._id}` : '/api/driver-leaves'
      const res = await adminFetch(url, {
        method: editingLeave ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Saved', description: editingLeave ? 'Leave updated.' : 'Leave added.' })
      setLeaveDialog(false)
      fetchLeaves()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLeaveSaving(false)
    }
  }

  async function quickStatus(leave: any, status: string) {
    try {
      const res = await adminFetch(`/api/driver-leaves/${leave._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      toast({ title: 'Updated', description: `Leave marked as ${status}.` })
      fetchLeaves()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  async function deleteLeave(id: string) {
    if (!confirm('Delete this leave entry?')) return
    try {
      const res = await adminFetch(`/api/driver-leaves/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast({ title: 'Deleted', description: 'Leave entry removed.' })
      fetchLeaves()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  // ─── override actions ─────────────────────────────────────────────────────
  function toggleSlot(time: string) {
    setOvDisabled(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    )
  }

  async function saveOverride() {
    if (!ovDriverId || !ovDate) {
      toast({ title: 'Missing fields', description: 'Select a driver and date first.', variant: 'destructive' })
      return
    }
    setOvSaving(true)
    try {
      const res = await adminFetch('/api/slot-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: ovDriverId,
          override_date: ovDate,
          block_full_day: ovBlockAll,
          disabled_slots: ovBlockAll ? [] : ovDisabled,
          reason: ovReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Saved', description: 'Slot override applied.' })
      fetchOverride()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setOvSaving(false)
    }
  }

  async function deleteOverride() {
    if (!ovDoc || !confirm('Remove this slot override?')) return
    try {
      const res = await adminFetch(`/api/slot-overrides/${ovDoc._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast({ title: 'Removed', description: 'Slot override cleared.' })
      setOvDoc(null); setOvBlockAll(false); setOvDisabled([]); setOvReason('')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  // ─── helpers ─────────────────────────────────────────────────────────────
  function driverName(id: string) {
    return drivers.find(d => String(d._id) === id)?.name || '—'
  }

  const canSaveOverride = ovBlockAll || ovDisabled.length > 0

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase italic leading-none">
            Driver Availability
          </h1>
          <p className="text-sm font-medium text-slate-500 italic">
            Manage driver leaves and slot overrides.
          </p>
        </div>
        {activeTab === 'leaves' && (
          <Button
            onClick={openAddLeave}
            className="rounded-[1.5rem] h-12 px-6 shadow-xl shadow-primary/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Add Leave
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-[1.5rem] w-fit">
        {(['leaves', 'overrides'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'leaves'
              ? <><CalendarOff className="w-3.5 h-3.5" /> Leave Management</>
              : <><Ban className="w-3.5 h-3.5" /> Slot Overrides</>}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════ TAB: LEAVES ═══════════════════════ */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">

          {/* Filter row */}
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={filterDriverId} onValueChange={setFilterDriverId}>
              <SelectTrigger className="w-56 h-12 rounded-[1.2rem] bg-white border-slate-200 shadow-sm text-sm font-medium">
                <SelectValue placeholder="All Drivers" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">All Drivers</SelectItem>
                {drivers.map(d => (
                  <SelectItem key={d._id} value={String(d._id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!leavesLoading && (
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {leaves.length} {leaves.length === 1 ? 'entry' : 'entries'}
              </p>
            )}
          </div>

          {/* Leave cards */}
          {leavesLoading ? (
            <div className="py-32 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-primary w-8 h-8 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Leaves...</p>
            </div>
          ) : leaves.length === 0 ? (
            <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic text-slate-400 text-sm">
              No leave entries found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {leaves.map((leave) => (
                <Card
                  key={leave._id}
                  className="p-6 rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 bg-white hover:shadow-lg transition-all duration-300 group"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                      </p>
                      <p className="font-black text-lg text-slate-800 italic leading-tight">
                        {driverName(String(leave.driver_id))}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[leave.status] ?? 'default'}
                      className="rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest capitalize shrink-0"
                    >
                      {leave.status}
                    </Badge>
                  </div>

                  {/* Date block */}
                  <div className="p-4 bg-slate-50 rounded-[1.5rem] mb-4 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{fmtDate(leave.start_date)}</span>
                      {leave.start_date !== leave.end_date && (
                        <>
                          <span className="text-slate-300">→</span>
                          <span>{fmtDate(leave.end_date)}</span>
                        </>
                      )}
                    </div>
                    {leave.reason && (
                      <p className="text-xs text-slate-400 italic pl-6 leading-relaxed">{leave.reason}</p>
                    )}
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {leave.status === 'pending' && (
                      <>
                        <button
                          onClick={() => quickStatus(leave, 'approved')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => quickStatus(leave, 'rejected')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openEditLeave(leave)}
                      className="p-2.5 bg-slate-100 text-slate-400 hover:text-primary hover:bg-white hover:shadow rounded-xl transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteLeave(String(leave._id))}
                      className="p-2.5 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-white hover:shadow rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════ TAB: SLOT OVERRIDES ════════════════════ */}
      {activeTab === 'overrides' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left panel: picker + legend */}
          <div className="space-y-5">
            <Card className="p-6 rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-5">
                Select Driver &amp; Date
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Driver</Label>
                  {driversLoading ? (
                    <div className="h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                    </div>
                  ) : (
                    <Select value={ovDriverId} onValueChange={setOvDriverId}>
                      <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner text-sm font-medium">
                        <SelectValue placeholder="Choose driver..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {drivers.map(d => (
                          <SelectItem key={d._id} value={String(d._id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</Label>
                  <Input
                    type="date"
                    value={ovDate}
                    onChange={(e) => setOvDate(e.target.value)}
                    className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner font-medium"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5 rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">How it works</p>
              <div className="space-y-3 text-xs text-slate-500 leading-relaxed">
                <div className="flex gap-2.5">
                  <Ban className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <span>Block Full Day removes all slots for this driver on that date.</span>
                </div>
                <div className="flex gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span>Disable specific times to block only selected pickups.</span>
                </div>
                <div className="flex gap-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <span>Driver leave takes priority over slot overrides.</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right panel: override config */}
          <div className="lg:col-span-2">
            {!ovDriverId || !ovDate ? (
              <div className="min-h-[320px] flex items-center justify-center rounded-[3rem] bg-white ring-1 ring-slate-100 border-2 border-dashed border-slate-100">
                <p className="text-slate-400 italic text-sm">Select a driver and date to configure.</p>
              </div>
            ) : ovLoading ? (
              <div className="min-h-[320px] flex flex-col items-center justify-center gap-3 rounded-[3rem] bg-white ring-1 ring-slate-100">
                <Loader2 className="animate-spin text-primary w-8 h-8 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading...</p>
              </div>
            ) : (
              <Card className="p-8 rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 bg-white">

                {/* Override header */}
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Override for</p>
                    <p className="font-black text-xl text-slate-800 italic leading-tight">{driverName(ovDriverId)}</p>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">{fmtDate(ovDate)}</p>
                  </div>
                  {ovDoc && (
                    <Badge variant="warning" className="rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                      Override Active
                    </Badge>
                  )}
                </div>

                {/* Block full day toggle */}
                <div className="mb-6 p-5 rounded-[1.5rem] bg-slate-50 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-sm text-slate-800">Block Full Day</p>
                    <p className="text-xs text-slate-400 mt-0.5">No slots shown for this driver on this date.</p>
                  </div>
                  <button
                    onClick={() => { setOvBlockAll(b => !b); setOvDisabled([]) }}
                    aria-label="Toggle block full day"
                    className={`relative w-14 h-7 rounded-full transition-colors ${ovBlockAll ? 'bg-red-500' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${ovBlockAll ? 'translate-x-7' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>

                {/* Specific slot disabling */}
                {!ovBlockAll && (
                  <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      Disable Specific Slots
                    </p>
                    {vehicleTimes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No active vehicle slots found for this driver. Assign a vehicle with configured slots first, or use Block Full Day.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {vehicleTimes.map(time => {
                            const isDisabled = ovDisabled.includes(time)
                            return (
                              <button
                                key={time}
                                onClick={() => toggleSlot(time)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                                  isDisabled
                                    ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-white'
                                }`}
                              >
                                {isDisabled && <Ban className="w-3 h-3" />}
                                {time}
                              </button>
                            )
                          })}
                        </div>
                        {ovDisabled.length > 0 && (
                          <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mt-3">
                            {ovDisabled.length} slot{ovDisabled.length !== 1 ? 's' : ''} will be disabled
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Reason */}
                <div className="mb-7 space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Reason (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. Vehicle maintenance, personal appointment..."
                    value={ovReason}
                    onChange={(e) => setOvReason(e.target.value)}
                    className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner text-sm"
                  />
                </div>

                {/* Save / Delete */}
                <div className="flex gap-3">
                  <Button
                    onClick={saveOverride}
                    disabled={ovSaving || !canSaveOverride}
                    className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20"
                  >
                    {ovSaving
                      ? <Loader2 className="animate-spin" />
                      : ovDoc ? 'Update Override' : 'Apply Override'}
                  </Button>
                  {ovDoc && (
                    <Button
                      variant="outline"
                      onClick={deleteOverride}
                      className="h-14 px-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest text-red-500 border-red-100 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ LEAVE ADD / EDIT DIALOG ════════════════════ */}
      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">

          {/* Dialog header */}
          <div className="bg-primary p-10 text-white relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10 rotate-12 pointer-events-none">
              <CalendarOff className="w-40 h-40" />
            </div>
            <DialogHeader className="relative z-10 space-y-1">
              <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                <CalendarOff className="w-6 h-6 shrink-0" />
                {editingLeave ? 'Edit Leave' : 'Add Leave'}
              </DialogTitle>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/50">
                Driver Leave Record
              </p>
            </DialogHeader>
          </div>

          {/* Dialog body */}
          <div className="p-10 space-y-5 bg-white">
            {/* Driver */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Driver</Label>
              <Select
                value={leaveForm.driver_id}
                onValueChange={(v) => setLeaveForm(f => ({ ...f, driver_id: v }))}
              >
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium">
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {drivers.map(d => (
                    <SelectItem key={d._id} value={String(d._id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Leave type */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Leave Type</Label>
              <Select
                value={leaveForm.leave_type}
                onValueChange={(v) => setLeaveForm(f => ({ ...f, leave_type: v }))}
              >
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="annual_leave">Annual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="weekly_off">Weekly Off</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</Label>
                <Input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                  className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</Label>
                <Input
                  type="date"
                  value={leaveForm.end_date}
                  min={leaveForm.start_date || undefined}
                  onChange={(e) => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                  className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</Label>
              <Select
                value={leaveForm.status}
                onValueChange={(v) => setLeaveForm(f => ({ ...f, status: v }))}
              >
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason (Optional)</Label>
              <Input
                placeholder="Annual trip, medical appointment..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium"
              />
            </div>

            <DialogFooter className="gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setLeaveDialog(false)}
                className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40"
              >
                Cancel
              </Button>
              <Button
                onClick={saveLeave}
                disabled={leaveSaving}
                className="flex-[2] h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20"
              >
                {leaveSaving
                  ? <Loader2 className="animate-spin" />
                  : editingLeave ? 'Update Leave' : 'Add Leave'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
