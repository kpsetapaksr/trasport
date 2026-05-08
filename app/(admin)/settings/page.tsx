'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Lock, User, Bus, Settings2, Loader2, Eye, EyeOff } from 'lucide-react'
import { adminFetch } from '@/lib/api-client'

interface SlotOverride {
  time: string
  enabled: boolean
  custom_time?: string
}

interface TransportSettingsType {
  start_time: string
  end_time: string
  interval_minutes: number
  buffer_before_appointment: number
  travel_time_minutes: number
  appointment_duration_minutes: number
  max_seats_per_slot: number
  slot_overrides: SlotOverride[]
  enabled: boolean
  message: string
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { admin } = useAdminAuth()

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Transport settings
  const [transportSettings, setTransportSettings] = useState<TransportSettingsType>({
    start_time: '07:00',
    end_time: '17:00',
    interval_minutes: 30,
    buffer_before_appointment: 60,
    travel_time_minutes: 30,
    appointment_duration_minutes: 30,
    max_seats_per_slot: 0,
    slot_overrides: [],
    enabled: true,
    message: '',
  })
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetchTransportSettings()
  }, [])

  const fetchTransportSettings = async () => {
    try {
      const res = await adminFetch('/api/transport/settings')
      const data = await res.json()
      if (data.data) {
        setTransportSettings({
          start_time: data.data.start_time || '07:00',
          end_time: data.data.end_time || '17:00',
          interval_minutes: data.data.interval_minutes || 30,
          buffer_before_appointment: data.data.buffer_before_appointment || 60,
          travel_time_minutes: data.data.travel_time_minutes || 30,
          appointment_duration_minutes: data.data.appointment_duration_minutes || 30,
          max_seats_per_slot: data.data.max_seats_per_slot || 0,
          slot_overrides: data.data.slot_overrides || [],
          enabled: data.data.enabled ?? true,
          message: data.data.message || '',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load transport settings', variant: 'destructive' })
    } finally {
      setLoadingSettings(false)
    }
  }

  const handleSaveTransportSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await adminFetch('/api/transport/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transportSettings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Success', description: 'Transport settings updated' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' })
      return
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    setSavingPassword(true)
    try {
      const res = await adminFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: admin?._id,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Success', description: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSavingPassword(false)
    }
  }

  const updateSetting = (key: keyof TransportSettingsType, value: any) => {
    setTransportSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-800">Settings</h1>
        <p className="text-sm font-medium text-slate-500 italic">Manage transport configuration and account settings</p>
      </div>

      {/* ====== Transport Schedule Settings ====== */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <CardTitle className="font-black text-lg text-slate-800 flex items-center gap-3">
            <Bus className="h-5 w-5" /> Transport Schedule
          </CardTitle>
          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Configure when transport runs and how pickup & drop-off time slots are generated for patients
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {loadingSettings ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-6 w-6 text-primary" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Enable/Disable */}
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm text-slate-800">Transport Service</p>
                  <p className="text-xs text-slate-500">Enable or disable transport booking for patients</p>
                </div>
                <Select
                  value={transportSettings.enabled ? 'enabled' : 'disabled'}
                  onValueChange={(v) => updateSetting('enabled', v === 'enabled')}
                >
                  <SelectTrigger className="w-[140px] h-14 rounded-2xl bg-white border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timing Configuration */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Timing Configuration
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Travel Time (minutes)</Label>
                    <Select
                      value={String(transportSettings.travel_time_minutes)}
                      onValueChange={(v) => updateSetting('travel_time_minutes', Number(v))}
                    >
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="20">20 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 ml-1">
                      Estimated travel between station and clinic. Used for both pickup & drop-off.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Arrive Before Appointment (minutes)</Label>
                    <Select
                      value={String(transportSettings.buffer_before_appointment)}
                      onValueChange={(v) => updateSetting('buffer_before_appointment', Number(v))}
                    >
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        <SelectItem value="15">15 min before</SelectItem>
                        <SelectItem value="30">30 min before</SelectItem>
                        <SelectItem value="45">45 min before</SelectItem>
                        <SelectItem value="60">60 min before</SelectItem>
                        <SelectItem value="90">90 min before</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 ml-1">
                      For pickup: patient arrives this many min before appointment.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Appointment Duration (minutes)</Label>
                    <Select
                      value={String(transportSettings.appointment_duration_minutes)}
                      onValueChange={(v) => updateSetting('appointment_duration_minutes', Number(v))}
                    >
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                        <SelectItem value="120">120 min</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 ml-1">
                      For drop-off: estimated appointment length. Drop slots start after this.
                    </p>
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  <div className="rounded-2xl p-5 bg-blue-50">
                    <p className="text-xs text-blue-800">
                      <strong>Pickup example:</strong> Appointment at 10:00 AM, travel {transportSettings.travel_time_minutes} min →
                      latest pickup = {(() => {
                        const apt = 10 * 60;
                        const latest = apt - transportSettings.travel_time_minutes;
                        const h = Math.floor(latest / 60);
                        const m = latest % 60;
                        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      })()}.
                      Patient arrives at clinic by 10:00 AM.
                    </p>
                  </div>
                  <div className="rounded-2xl p-5 bg-orange-50">
                    <p className="text-xs text-orange-800">
                      <strong>Drop-off example:</strong> Appointment at 10:00 AM, duration {transportSettings.appointment_duration_minutes} min →
                      earliest drop slot = {(() => {
                        const apt = 10 * 60;
                        const earliest = apt + transportSettings.appointment_duration_minutes;
                        const h = Math.floor(earliest / 60);
                        const m = earliest % 60;
                        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      })()}.
                      Vehicle picks up patient from clinic after appointment ends.
                    </p>
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">Capacity Override</h3>
                <div className="space-y-2 max-w-xs">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Max Seats Per Slot</Label>
                  <Input
                    type="number"
                    min={0}
                    value={transportSettings.max_seats_per_slot}
                    onChange={(e) => updateSetting('max_seats_per_slot', Number(e.target.value) || 0)}
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                  />
                  <p className="text-xs text-slate-500 ml-1">
                    Set to 0 to use total active vehicle capacity automatically.
                    Set a number to override (e.g., limit to 10 seats per slot even if vehicles have more).
                  </p>
                </div>
              </div>

              {/* Patient Message */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">Patient Message</h3>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Message (shown on booking page when disabled)</Label>
                  <Input
                    value={transportSettings.message}
                    onChange={(e) => updateSetting('message', e.target.value)}
                    placeholder="e.g., Transport service temporarily unavailable due to maintenance"
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveTransportSettings}
                disabled={savingSettings}
                className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6 font-black uppercase text-[10px] tracking-widest"
              >
                {savingSettings ? 'Saving...' : 'Save Transport Settings'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Account Info ====== */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <CardTitle className="font-black text-lg text-slate-800 flex items-center gap-3">
            <User className="h-5 w-5" /> Account Information
          </CardTitle>
          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Your account details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-6 bg-slate-50 rounded-[2rem]">
              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Username</Label>
              <p className="text-sm font-black text-slate-700 mt-1">{admin?.username || '-'}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-[2rem]">
              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</Label>
              <p className="text-sm font-black text-slate-700 mt-1">{admin?.email || '-'}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-[2rem]">
              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Role</Label>
              <p className="text-sm font-black text-slate-700 capitalize mt-1">{admin?.role || '-'}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-[2rem]">
              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Login</Label>
              <p className="text-sm font-black text-slate-700 mt-1">{admin?.lastLogin ? new Date(admin.lastLogin).toLocaleString('en-MY') : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== Change Password ====== */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <CardTitle className="font-black text-lg text-slate-800 flex items-center gap-3">
            <Lock className="h-5 w-5" /> Change Password
          </CardTitle>
          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Update your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <form onSubmit={handleChangePassword} className="space-y-6 max-w-md">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Current Password</Label>
              <div className="relative">
                <Input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="h-14 rounded-2xl bg-slate-50 border-none font-bold pr-12" />
                <button type="button" onClick={() => setShowCurrentPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">New Password</Label>
              <div className="relative">
                <Input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="h-14 rounded-2xl bg-slate-50 border-none font-bold pr-12" />
                <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Confirm New Password</Label>
              <div className="relative">
                <Input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-14 rounded-2xl bg-slate-50 border-none font-bold pr-12" />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={savingPassword}
              className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6 font-black uppercase text-[10px] tracking-widest"
            >
              {savingPassword ? 'Updating...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
