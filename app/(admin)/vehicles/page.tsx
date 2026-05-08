'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Search, Truck, Users, User, Bus, ShieldCheck, Loader2, Camera, Car, Settings } from 'lucide-react'
import { adminFetch } from '@/lib/api-client'

const emptyForm = {
  vehicle_name: '',
  vehicle_number: '',
  vehicle_type: 'Van' as 'Car' | 'Van' | 'Bus',
  image: '',
  seat_capacity: 4,
  driver_id: '',
  status: 'active' as 'active' | 'maintenance',
}

export default function VehiclesPage() {
  const { toast } = useToast()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const resV = await adminFetch('/api/vehicles')
      const resD = await adminFetch('/api/drivers')
      if (!resV.ok) throw new Error('Failed to fetch vehicles')
      if (!resD.ok) throw new Error('Failed to fetch drivers')
      const dataV = await resV.json()
      const dataD = await resD.json()
      setVehicles(dataV.data || [])
      setDrivers(dataD.data || [])
    } catch {
      toast({ title: 'System Error', description: 'Failed to access the visual fleet manifest.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'vehicles')

      const res = await adminFetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setForm(prev => ({ ...prev, image: data.url }))
      toast({ title: 'Asset Visual Synced', description: 'Vehicle hero image is ready.' })
    } catch (err: any) {
      toast({ title: 'Sync Error', description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.vehicle_name || !form.vehicle_number) {
      toast({ title: 'Validation', description: 'Asset designation and plate are mandatory.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/vehicles/${editingId}` : '/api/vehicles'
      const method = editingId ? 'PUT' : 'POST'

      const payload = { ...form }
      if (payload.driver_id === 'none') payload.driver_id = ''

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Network save failed')

      toast({ title: 'Asset Secured', description: 'Logistics registry updated successfully.' })
      setDialogOpen(false)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Registry Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('DANGER: Permanently decommission this visual asset?')) return
    try {
      const res = await adminFetch(`/api/vehicles/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Decommissioning failed')
      toast({ title: 'Asset Removed', description: 'Vehicle purged from the fleet manifest.' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'System Error', description: err.message, variant: 'destructive' })
    }
  }

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'Car': return <Car className="h-6 w-6" />
      case 'Bus': return <Bus className="h-6 w-6" />
      default: return <Truck className="h-6 w-6" />
    }
  }

  const filtered = vehicles.filter(v =>
    v.vehicle_name.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicle_number.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = vehicles.filter(v => v.status === 'active').length
  const totalSeats = vehicles.reduce((acc, v) => acc + (v.seat_capacity || 0), 0)

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Fleet Manifest</h1>
          <p className="text-sm font-medium text-slate-500 italic">Manage vehicles, assignments, and fleet capacity</p>
        </div>
        <Button
          onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}
          className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-[2rem] border-none shadow-sm bg-emerald-50 flex items-center justify-between group overflow-hidden relative">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active</p>
            <p className="text-3xl font-black tracking-tighter text-emerald-600">{activeCount}</p>
          </div>
          <ShieldCheck className="w-10 h-10 text-emerald-200 absolute right-6" />
        </div>
        <div className="p-6 rounded-[2rem] border-none shadow-sm bg-blue-50 flex items-center justify-between group overflow-hidden relative">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Vehicles</p>
            <p className="text-3xl font-black tracking-tighter text-blue-600">{vehicles.length}</p>
          </div>
          <Truck className="w-10 h-10 text-blue-200 absolute right-6" />
        </div>
        <div className="p-6 rounded-[2rem] border-none shadow-sm bg-violet-50 flex items-center justify-between group overflow-hidden relative">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Seat Capacity</p>
            <p className="text-3xl font-black tracking-tighter text-violet-600">{totalSeats}</p>
          </div>
          <Users className="w-10 h-10 text-violet-200 absolute right-6" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/10 shadow-inner"
          />
        </div>
      </div>

      {/* Vehicle Cards */}
      {loading && vehicles.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin w-8 h-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
          <p className="text-slate-400 text-sm font-medium">No vehicles match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((v) => (
            <Card
              key={v._id}
              className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:shadow-xl transition-all duration-300"
            >
              {/* Image / Placeholder */}
              {v.image ? (
                <div className="aspect-[16/9] relative bg-slate-100 overflow-hidden rounded-t-[2.5rem]">
                  <img src={v.image} alt={v.vehicle_name} className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4">
                    <Badge className={`rounded-full px-3 py-1 text-[10px] uppercase font-black border-none ${
                      v.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {v.status}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="aspect-[16/9] relative bg-slate-50 overflow-hidden rounded-t-[2.5rem] flex flex-col items-center justify-center gap-2">
                  <div className="text-slate-300">{getVehicleIcon(v.vehicle_type)}</div>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No Image</p>
                  <div className="absolute top-4 right-4">
                    <Badge className={`rounded-full px-3 py-1 text-[10px] uppercase font-black border-none ${
                      v.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {v.status}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Card Body */}
              <div className="p-6 space-y-6">
                {/* Name + Number + Seats */}
                <div className="space-y-3">
                  <h3 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">
                    {v.vehicle_name}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[9px] bg-white text-slate-400 border border-slate-100">
                      {v.vehicle_number}
                    </Badge>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> {v.seat_capacity} Seats
                    </span>
                  </div>
                </div>

                {/* Driver Section */}
                <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                  {v.driver_id ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border-2 border-white shadow-sm shrink-0 flex items-center justify-center">
                        {v.driver_id.image ? (
                          <img src={v.driver_id.image} alt={v.driver_id.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver</p>
                        <p className="text-sm font-bold text-slate-700 truncate">{v.driver_id.name}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver</p>
                        <p className="text-sm font-medium text-slate-400 italic">Unassigned</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setEditingId(v._id); setForm({ ...v, driver_id: (v.driver_id?._id || v.driver_id || 'none') }); setDialogOpen(true); }}
                    className="rounded-xl h-10 text-xs font-bold flex-1"
                  >
                    <Pencil className="w-3 h-3 mr-2" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(v._id)}
                    className="h-10 w-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] max-h-[90vh] flex flex-col [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">
          {/* Dialog Header */}
          <div className="bg-primary p-10 text-white relative overflow-hidden shrink-0">
            <div className="absolute -top-6 -right-6 opacity-10 rotate-12">
              <Truck className="w-40 h-40" />
            </div>
            <DialogHeader className="relative z-10">
              <p className="text-[10px] uppercase font-black tracking-widest text-white/50">Vehicle Registry</p>
              <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                <Truck className="w-6 h-6" /> {editingId ? 'Edit Vehicle' : 'New Vehicle'}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Dialog Body */}
          <div className="p-10 space-y-8 bg-white overflow-y-auto flex-1">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vehicle Image</Label>
              <div className="w-full h-40 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden relative flex items-center justify-center">
                {form.image ? (
                  <img src={form.image} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-slate-300" />
                )}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={handleImageUpload} disabled={uploading} />
              </div>
              {form.image && (
                <button onClick={() => setForm({...form, image: ''})} className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-red-500 hover:text-red-600 mt-1">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>

            {/* Vehicle Name */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vehicle Name</Label>
              <Input
                placeholder="e.g., Executive Shuttle 01"
                className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                value={form.vehicle_name}
                onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })}
              />
            </div>

            {/* Plate + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Plate Number</Label>
                <Input
                  placeholder="TN-01-AB-1234"
                  className="h-14 rounded-2xl bg-slate-50 border-none font-bold uppercase"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vehicle Type</Label>
                <Select value={form.vehicle_type} onValueChange={(v: any) => setForm({ ...form, vehicle_type: v })}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Bus">Bus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seats + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Seat Capacity</Label>
                <Input
                  type="number"
                  className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                  value={form.seat_capacity}
                  onChange={(e) => setForm({ ...form, seat_capacity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Driver Select */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assigned Driver</Label>
              <Select value={form.driver_id} onValueChange={(v: any) => setForm({ ...form, driver_id: v })}>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl">
                  <SelectItem value="none">Unassigned</SelectItem>
                  {drivers.map(d => (
                    <SelectItem key={d._id} value={d._id}>
                      <span className="flex flex-col">
                        <span>{d.name}</span>
                        {d.id_card_number && (
                          <span className="text-[10px] text-slate-400 font-normal">{d.id_card_number}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="gap-3 pt-4 px-10 pb-10 bg-white">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="flex-1 h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40"
            >
              Abort
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex-[2] h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20"
            >
              {saving ? <Loader2 className="animate-spin w-5 h-5" /> : editingId ? 'Save Changes' : 'Create Vehicle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
