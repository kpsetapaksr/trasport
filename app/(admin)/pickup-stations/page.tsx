'use client'

import { useEffect, useState } from 'react'
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
import { Plus, Pencil, Trash2, Search, MapPin, Navigation, Map, MoreVertical, Globe, Building2, Loader2 } from 'lucide-react'
import type { PickupStationType } from '@/lib/types'
import { adminFetch } from '@/lib/api-client'

const emptyForm = {
  station_name: '',
  location_name: '',
  latitude: '',
  longitude: '',
  status: 'active' as 'active' | 'inactive',
}

export default function PickupStationsPage() {
  const { toast } = useToast()
  const [stations, setStations] = useState<PickupStationType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchStations = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await adminFetch(`/api/stations?${params}`)
      if (!res.ok) throw new Error('Failed to fetch stations')
      const data = await res.json()
      setStations(data.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch stations', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStations()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (s: PickupStationType) => {
    setEditingId(s._id)
    setForm({
      station_name: s.station_name,
      location_name: s.location_name,
      latitude: s.latitude?.toString() || '',
      longitude: s.longitude?.toString() || '',
      status: s.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.station_name || !form.location_name) {
      toast({ title: 'Validation', description: 'Name and Location are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/stations/${editingId}` : '/api/stations'
      const method = editingId ? 'PUT' : 'POST'

      const payload: any = {
        station_name: form.station_name,
        location_name: form.location_name,
        status: form.status,
      }
      if (form.latitude) payload.latitude = parseFloat(form.latitude)
      if (form.longitude) payload.longitude = parseFloat(form.longitude)

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: 'Success', description: editingId ? 'Station updated' : 'Station created' })
      setDialogOpen(false)
      fetchStations()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this station?')) return
    try {
      const res = await adminFetch(`/api/stations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast({ title: 'Success', description: 'Station removed' })
      fetchStations()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">
            Fleet Stations
          </h1>
          <p className="text-sm font-medium text-slate-500 italic">Manage hubs for pickup and drop-off operations.</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6">
          <Plus className="h-5 w-5 mr-2" /> Add New Hub
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter stations by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/10 shadow-inner"
          />
        </div>
      </div>

      {/* Content */}
      {loading && stations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scanning network stations...</p>
        </div>
      ) : stations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <MapPin className="h-16 w-16 text-slate-200 mb-4" />
          <p className="text-lg font-bold text-slate-800">No stations found</p>
          <p className="text-sm text-slate-500">Try adjusting your search or add a new hub.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stations.map((s) => (
            <Card key={s._id} className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:shadow-xl transition-all duration-300">
               <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                       <MapPin className="w-6 h-6" />
                    </div>
                    <Badge className={`rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-none ${
                      s.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.status}
                    </Badge>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-none line-clamp-1">{s.station_name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                       <Navigation className="w-3 h-3" /> {s.location_name}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                     <div className="flex items-center gap-4">
                        <div className="flex-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Coordinates</p>
                           <p className="text-xs font-mono text-slate-600 truncate">{s.latitude || '0'}° N, {s.longitude || '0'}° E</p>
                        </div>
                        <Globe className="w-4 h-4 text-slate-300" />
                     </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl h-10 text-xs font-bold" onClick={() => openEdit(s)}>
                       <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" className="rounded-xl h-10 w-10 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(s._id)}>
                       <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
               </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modern Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] max-h-[90vh] flex flex-col [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">
           <div className="bg-primary p-10 text-white relative">
              <MapPin className="absolute right-6 bottom-4 w-24 h-24 text-white/5" />
              <DialogHeader className="space-y-1">
                 <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3"><Map /> Hub Configuration</DialogTitle>
                 <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-white/50">Define the geographic Hub for transport logistics.</DialogDescription>
              </DialogHeader>
           </div>
           <div className="p-10 space-y-8 bg-white overflow-y-auto flex-1">
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station Identity</Label>
                    <Input
                      placeholder="e.g., Central Plaza Hub"
                      className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                      value={form.station_name}
                      onChange={(e) => setForm({ ...form, station_name: e.target.value })}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Geographic Location</Label>
                    <div className="relative">
                       <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                       <Input
                        placeholder="Detailed address or area"
                        className="pl-10 h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={form.location_name}
                        onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Latitude</Label>
                       <Input
                        placeholder="0.0000"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Longitude</Label>
                       <Input
                        placeholder="0.0000"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Operational Status</Label>
                    <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                       <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="active">Active Hub</SelectItem>
                          <SelectItem value="inactive">Paused Hub</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <DialogFooter className="flex gap-3 pt-4">
                 <Button variant="ghost" onClick={() => setDialogOpen(false)} className="flex-1 h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
                 <Button onClick={handleSave} disabled={saving} className="flex-[2] h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20">
                    {saving ? 'Syncing...' : editingId ? 'Update Hub' : 'Register Hub'}
                 </Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
