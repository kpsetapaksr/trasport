'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  User, Phone, ShieldCheck, Search,
  Loader2, Plus, Key, Pencil, Trash2,
  UserSquare2, Eye, EyeOff, Camera, Copy
} from 'lucide-react'
import { adminFetch } from '@/lib/api-client'

const emptyForm = {
  name: '',
  image: '',
  phone: '',
  password: '',
  id_card_number: '',
  isActive: true
}

export default function DriversManagementPage() {
  const { toast } = useToast()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  const toggleReveal = (id: string) =>
    setRevealedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied', description: `${label} copied to clipboard.` })
  }

  const fetchDrivers = async () => {
    try {
      setLoading(true)
      const res = await adminFetch('/api/drivers')
      if (!res.ok) throw new Error('Failed to fetch drivers')
      const data = await res.json()
      setDrivers(data.data || [])
    } catch {
       toast({ title: 'Sync Error', description: 'Failed to access personnel directory.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDrivers()
  }, [])

  // Upload image immediately to server when selected
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'drivers')
      
      const res = await adminFetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      
      // Store the server URL in form state
      setForm(prev => ({ ...prev, image: data.url }))
      toast({ title: 'Photo Ready', description: 'Identity photo synced to network.' })
    } catch (err: any) {
      toast({ title: 'Upload Error', description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.password) {
       toast({ title: 'Missing Data', description: 'Enter full name, mobile and password.', variant: 'destructive' })
       return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/drivers/${editingId}` : '/api/drivers'
      const method = editingId ? 'PUT' : 'POST'
      
      // Clean form for DB (remove internal _id if present)
      const { _id, ...saveData } = form as any;

      const res = await adminFetch(url, {
        method,
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(saveData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast({ title: 'Identity Secured', description: `Verified: ${form.name}` })
      setDialogOpen(false)
      fetchDrivers()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
     if (!confirm('Decommission this driver from the network?')) return
     try {
       const res = await adminFetch(`/api/drivers/${id}`, { method: 'DELETE' })
       if (!res.ok) throw new Error('Deletion failed')
       toast({ title: 'Success', description: 'Driver removed.' })
       fetchDrivers()
     } catch (err: any) {
       toast({ title: 'Error', description: err.message, variant: 'destructive' })
     }
  }

  const filtered = drivers.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.phone.includes(search)
  )

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase italic leading-none">Fleet Personnel</h1>
          <p className="text-sm font-medium text-slate-500 italic">Verified identity and photo-active manifest.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }} className="rounded-[1.5rem] h-12 px-6 shadow-xl shadow-primary/20">
           <Plus className="w-5 h-5 mr-2" /> Register Personnel
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Filter identity directory..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-14 bg-white rounded-[1.5rem] border-slate-200 shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-32 flex flex-col items-center gap-4">
             <Loader2 className="animate-spin text-primary w-10 h-10 opacity-20" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Network Personnel...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic text-slate-400 text-sm">Registry is currently empty.</div>
        ) : filtered.map(d => (
          <Card key={d._id} className="p-6 rounded-[3rem] border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:shadow-2xl hover:ring-primary/10 transition-all duration-500">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-500 shadow-inner overflow-hidden border border-slate-100 ring-4 ring-white">
                    {d.image ? (
                       <img src={d.image} alt={d.name} className="w-full h-full object-cover" />
                    ) : (
                       <UserSquare2 className="w-8 h-8 text-slate-200" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-slate-800 tracking-tighter italic uppercase leading-none">{d.name}</h3>
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-2 flex items-center gap-1.5 leading-none transition-all group-hover:gap-2"><ShieldCheck className="w-3.5 h-3.5" /> ID Verified</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => { setEditingId(d._id); setForm({ ...d, id_card_number: d.id_card_number ?? '' }); setDialogOpen(true); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-white hover:shadow-lg rounded-full transition-all"><Pencil className="w-4 h-4" /></button>
                   <button onClick={() => handleDelete(d._id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-white hover:shadow-lg rounded-full transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
             </div>

             <div className="space-y-4">
                <div className="p-5 bg-slate-50/50 rounded-[2.5rem] border border-slate-100/50 group-hover:bg-white transition-colors space-y-0 divide-y divide-slate-100">

                   {/* Login Details header */}
                   <div className="flex items-center justify-between pb-3">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Key className="w-3 h-3" /> Login Details</p>
                     <button
                       onClick={() => toggleReveal(d._id)}
                       className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
                     >
                       {revealedIds.has(d._id) ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Show</>}
                     </button>
                   </div>

                   {/* Username */}
                   <div className="py-3 space-y-1">
                     <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Username (Phone)</p>
                     <div className="flex items-center justify-between gap-2">
                       <p className="text-sm font-black text-slate-700 font-mono tracking-tight">{d.phone}</p>
                       <button onClick={() => copyText(d.phone, 'Username')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-primary transition-colors">
                         <Copy className="w-3.5 h-3.5" />
                       </button>
                     </div>
                   </div>

                   {/* Password */}
                   <div className="py-3 space-y-1">
                     <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Password</p>
                     <div className="flex items-center justify-between gap-2">
                       <p className="text-sm font-black text-slate-700 font-mono tracking-tight">
                         {revealedIds.has(d._id)
                           ? (d.plain_password || <span className="text-slate-300 text-xs italic font-sans">Not available</span>)
                           : '••••••••'}
                       </p>
                       {revealedIds.has(d._id) && d.plain_password && (
                         <button onClick={() => copyText(d.plain_password, 'Password')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-primary transition-colors">
                           <Copy className="w-3.5 h-3.5" />
                         </button>
                       )}
                     </div>
                   </div>

                   {/* ID Card */}
                   {d.id_card_number && (
                     <div className="pt-3 space-y-1">
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">ID Card No.</p>
                       <p className="text-sm font-black text-slate-700 font-mono">{d.id_card_number}</p>
                     </div>
                   )}
                </div>
             </div>

             <div className="mt-8 pt-4 px-2 flex items-center justify-between">
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" /> System Recorded
                </div>
                <Badge className={`rounded-xl px-4 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${d.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                   {d.isActive ? 'On-Duty Ready' : 'Lockdown'}
                </Badge>
             </div>
          </Card>
        ))}
      </div>

      {/* Driver Identity Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] max-h-[90vh] flex flex-col [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">
           <div className="bg-primary p-10 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Key className="w-40 h-40" /></div>
              <DialogHeader className="space-y-1 relative z-10">
                 <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                    <UserSquare2 className="w-7 h-7" /> Identity Config
                 </DialogTitle>
                 <p className="text-[10px] uppercase font-black tracking-widest text-white/50">Establish Photo Credentials & Access</p>
              </DialogHeader>
           </div>
           
           <div className="p-10 space-y-8 bg-white overflow-y-auto flex-1">
              <div className="space-y-6">
                 {/* Cinematic Upload Hub */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Visualization (Capture)</Label>
                    <div className="flex items-center gap-6">
                       <div className="w-24 h-24 bg-slate-50 rounded-[2.2rem] flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden relative group transition-all hover:border-primary/50 ring-4 ring-slate-50">
                          {form.image ? (
                             <img src={form.image} className="w-full h-full object-cover" />
                          ) : (
                             <div className="flex flex-col items-center gap-1.5">
                               {uploading ? <Loader2 className="animate-spin text-primary" /> : <Camera className="w-7 h-7 text-slate-300 transition-transform group-hover:scale-110" />}
                               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Snap Photo</span>
                             </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/jpeg,image/png,image/webp"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={handleImageUpload}
                          />
                       </div>
                       <div className="flex-1 space-y-2">
                          <p className="text-[11px] font-black uppercase text-slate-800 tracking-tighter leading-none mb-1">Personnel Headshot</p>
                          <p className="text-[9px] text-slate-400 italic leading-tight">Image will be optimized automatically for the patient manifest.</p>
                          {form.image && <button onClick={() => setForm({...form, image: ''})} className="text-[8px] font-black uppercase text-red-400 hover:text-red-600 transition-colors">Reset Profile Photo</button>}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Certified Full Name</Label>
                    <Input 
                       placeholder="Admin Display Name" 
                       className="h-14 rounded-2xl bg-slate-50 border-none font-black text-lg focus:ring-2 focus:ring-primary/20 shadow-inner"
                       value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Card Number</Label>
                    <Input
                       placeholder="IC / Passport Number"
                       className="h-14 rounded-2xl bg-slate-50 border-none font-mono font-bold focus:ring-2 focus:ring-primary/20 shadow-inner"
                       value={(form as any).id_card_number ?? ''}
                       onChange={(e) => setForm({ ...form, id_card_number: e.target.value } as any)}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UserID (Mobile)</Label>
                       <Input 
                          placeholder="011-XXXXX" 
                          className="h-14 rounded-2xl bg-slate-50 border-none font-mono font-bold focus:ring-2 focus:ring-primary/20 shadow-inner"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Key</Label>
                       <div className="relative">
                          <Input 
                             type={showPassword ? 'text' : 'password'}
                             placeholder="••••••••" 
                             className="h-14 rounded-2xl bg-slate-50 border-none font-mono focus:ring-2 focus:ring-primary/20 shadow-inner"
                             value={form.password}
                             onChange={(e) => setForm({ ...form, password: e.target.value })}
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
                          >
                             {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                       </div>
                    </div>
                 </div>
              </div>

              <DialogFooter className="gap-3 pt-4">
                 <Button variant="ghost" onClick={() => setDialogOpen(false)} className="flex-1 h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Abort</Button>
                 <Button onClick={handleSave} disabled={saving || uploading} className="flex-[2] h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20">
                    {saving ? <Loader2 className="animate-spin" /> : editingId ? 'Commit Update' : 'Initialize Identity'}
                 </Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
