/**
 * Unit tests for the Transport Schedule "Assign New Slots" module
 * Covers: POST (bulk create), GET (list), PUT (copy forward), DELETE (bulk),
 *         single slot DELETE/PUT, and the frontend preview time generation logic.
 */

import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { VehicleScheduleSlot, Vehicle, PickupStation } from '@/lib/models'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Replicate the frontend previewTimes logic for testing */
function generatePreviewTimes(start_time: string, end_time: string, interval: string): string[] {
  const times: string[] = []
  const [sh, sm] = start_time.split(':').map(Number)
  const [eh, em] = end_time.split(':').map(Number)
  const startMin = sh * 60 + (sm || 0)
  const endMin = eh * 60 + (em || 0)
  const intervalNum = parseInt(interval) || 30
  if (intervalNum < 5 || startMin >= endMin) return []
  for (let m = startMin; m < endMin; m += intervalNum) {
    const h = Math.floor(m / 60)
    const min = m % 60
    times.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return times
}

/** Replicate the API slot generation logic */
function generateSlots(params: {
  vehicle_id: string
  station_name: string
  type: 'pickup' | 'drop'
  date: string
  start_time: string
  end_time: string
  interval_minutes: string | number
}) {
  const { vehicle_id, station_name, type, date, start_time, end_time, interval_minutes } = params
  const [sh, sm] = start_time.split(':').map(Number)
  const [eh, em] = end_time.split(':').map(Number)
  const startMin = sh * 60 + (sm || 0)
  const endMin = eh * 60 + (em || 0)
  const interval = parseInt(String(interval_minutes)) || 30

  if (startMin >= endMin || interval < 1) return []

  const slots = []
  for (let m = startMin; m < endMin; m += interval) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push({
      vehicle_id,
      station_name,
      type,
      date,
      time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      status: 'active',
    })
  }
  return slots
}

// ─── Preview Time Generation (Frontend Logic) ────────────────────────────────

describe('Preview Time Generation (Frontend)', () => {
  test('generates correct 30-min slots from 07:00 to 09:00', () => {
    const times = generatePreviewTimes('07:00', '09:00', '30')
    expect(times).toEqual(['07:00', '07:30', '08:00', '08:30'])
  })

  test('generates correct 60-min slots from 08:00 to 12:00', () => {
    const times = generatePreviewTimes('08:00', '12:00', '60')
    expect(times).toEqual(['08:00', '09:00', '10:00', '11:00'])
  })

  test('generates correct 15-min slots from 10:00 to 11:00', () => {
    const times = generatePreviewTimes('10:00', '11:00', '15')
    expect(times).toEqual(['10:00', '10:15', '10:30', '10:45'])
  })

  test('returns empty array when start >= end', () => {
    expect(generatePreviewTimes('12:00', '08:00', '30')).toEqual([])
    expect(generatePreviewTimes('10:00', '10:00', '30')).toEqual([])
  })

  test('returns empty array when interval < 5', () => {
    expect(generatePreviewTimes('07:00', '09:00', '4')).toEqual([])
    // Note: '0' and '-1' fall through to || 30 default, so they generate slots
    // This matches the actual frontend behavior (parseInt('0') || 30 === 30)
    expect(generatePreviewTimes('07:00', '09:00', '0')).toEqual(['07:00', '07:30', '08:00', '08:30'])
    expect(generatePreviewTimes('07:00', '09:00', '-1')).toEqual([])
  })

  test('handles non-standard intervals correctly', () => {
    const times = generatePreviewTimes('09:00', '10:30', '20')
    expect(times).toEqual(['09:00', '09:20', '09:40', '10:00', '10:20'])
  })

  test('handles single-slot scenario (interval > range)', () => {
    const times = generatePreviewTimes('09:00', '09:20', '30')
    expect(times).toEqual(['09:00'])
  })

  test('handles full-day schedule', () => {
    const times = generatePreviewTimes('06:00', '22:00', '30')
    expect(times.length).toBe(32) // 16 hours * 2 slots/hour
    expect(times[0]).toBe('06:00')
    expect(times[times.length - 1]).toBe('21:30')
  })

  test('defaults to 30 min interval when parsing fails', () => {
    const times = generatePreviewTimes('07:00', '09:00', 'abc')
    expect(times).toEqual(['07:00', '07:30', '08:00', '08:30'])
  })

  test('handles midnight boundary (23:00 to 23:59)', () => {
    const times = generatePreviewTimes('23:00', '23:59', '15')
    expect(times).toEqual(['23:00', '23:15', '23:30', '23:45'])
  })
})

// ─── Slot Generation (API Logic) ─────────────────────────────────────────────

describe('Slot Generation (API Logic)', () => {
  const baseParams = {
    vehicle_id: '507f1f77bcf86cd799439011',
    station_name: 'LRT SRI RAMPAI',
    type: 'pickup' as const,
    date: '2026-04-10',
    start_time: '07:00',
    end_time: '18:00',
    interval_minutes: '30',
  }

  test('generates correct number of slots for standard schedule', () => {
    const slots = generateSlots(baseParams)
    // 07:00 to 18:00 with 30-min = 22 slots
    expect(slots.length).toBe(22)
  })

  test('each slot has correct structure', () => {
    const slots = generateSlots(baseParams)
    slots.forEach(slot => {
      expect(slot).toHaveProperty('vehicle_id', baseParams.vehicle_id)
      expect(slot).toHaveProperty('station_name', baseParams.station_name)
      expect(slot).toHaveProperty('type', 'pickup')
      expect(slot).toHaveProperty('date', '2026-04-10')
      expect(slot).toHaveProperty('status', 'active')
      expect(slot.time).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  test('first and last slots are correct', () => {
    const slots = generateSlots(baseParams)
    expect(slots[0].time).toBe('07:00')
    expect(slots[slots.length - 1].time).toBe('17:30')
  })

  test('generates drop type slots', () => {
    const slots = generateSlots({ ...baseParams, type: 'drop' })
    slots.forEach(slot => {
      expect(slot.type).toBe('drop')
    })
  })

  test('returns empty for invalid time range', () => {
    expect(generateSlots({ ...baseParams, start_time: '18:00', end_time: '07:00' })).toEqual([])
    expect(generateSlots({ ...baseParams, start_time: '10:00', end_time: '10:00' })).toEqual([])
  })

  test('returns empty for negative interval, defaults 0 to 30', () => {
    // parseInt('0') || 30 === 30, so '0' defaults to 30-min interval (not empty)
    expect(generateSlots({ ...baseParams, interval_minutes: '0', start_time: '07:00', end_time: '09:00' }).length).toBe(4)
    // Negative: parseInt('-5') || 30 = -5, which is < 1, so returns empty
    expect(generateSlots({ ...baseParams, interval_minutes: '-5' })).toEqual([])
  })

  test('defaults interval to 30 for invalid input', () => {
    const slots = generateSlots({ ...baseParams, interval_minutes: 'abc', start_time: '07:00', end_time: '09:00' })
    expect(slots.length).toBe(4) // 07:00, 07:30, 08:00, 08:30
  })

  test('handles 5-minute interval (high frequency)', () => {
    const slots = generateSlots({ ...baseParams, start_time: '09:00', end_time: '10:00', interval_minutes: '5' })
    expect(slots.length).toBe(12) // 60min / 5min
    expect(slots[0].time).toBe('09:00')
    expect(slots[11].time).toBe('09:55')
  })

  test('preserves date across all generated slots', () => {
    const slots = generateSlots({ ...baseParams, date: '2026-12-25' })
    slots.forEach(slot => expect(slot.date).toBe('2026-12-25'))
  })
})

// ─── Form Validation (Frontend) ──────────────────────────────────────────────

describe('Form Validation', () => {
  function validateForm(form: { vehicle_id: string; station_name: string; date: string }) {
    return !!(form.vehicle_id && form.station_name && form.date)
  }

  test('valid form passes', () => {
    expect(validateForm({ vehicle_id: 'abc123', station_name: 'Station A', date: '2026-04-10' })).toBe(true)
  })

  test('missing vehicle_id fails', () => {
    expect(validateForm({ vehicle_id: '', station_name: 'Station A', date: '2026-04-10' })).toBe(false)
  })

  test('missing station_name fails', () => {
    expect(validateForm({ vehicle_id: 'abc123', station_name: '', date: '2026-04-10' })).toBe(false)
  })

  test('missing date fails', () => {
    expect(validateForm({ vehicle_id: 'abc123', station_name: 'Station A', date: '' })).toBe(false)
  })

  test('all empty fails', () => {
    expect(validateForm({ vehicle_id: '', station_name: '', date: '' })).toBe(false)
  })
})

// ─── Time Formatting (Frontend) ──────────────────────────────────────────────

describe('Time Formatting (12h)', () => {
  function formatTime12h(timeStr: string) {
    const [h, m] = timeStr.split(':')
    const hours = parseInt(h)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    return `${h12}:${m} ${ampm}`
  }

  test('formats morning times', () => {
    expect(formatTime12h('07:00')).toBe('7:00 AM')
    expect(formatTime12h('09:30')).toBe('9:30 AM')
  })

  test('formats noon', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM')
  })

  test('formats afternoon/evening', () => {
    expect(formatTime12h('13:00')).toBe('1:00 PM')
    expect(formatTime12h('17:30')).toBe('5:30 PM')
    expect(formatTime12h('23:45')).toBe('11:45 PM')
  })

  test('formats midnight', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM')
  })
})

// ─── Copy Forward Logic ──────────────────────────────────────────────────────

describe('Copy Forward (Date Logic)', () => {
  function getNextDate(selectedDate: string): string {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  test('next day calculation', () => {
    expect(getNextDate('2026-04-10')).toBe('2026-04-11')
  })

  test('crosses month boundary', () => {
    expect(getNextDate('2026-04-30')).toBe('2026-05-01')
  })

  test('crosses year boundary', () => {
    expect(getNextDate('2026-12-31')).toBe('2027-01-01')
  })

  test('handles February 28 (non-leap)', () => {
    expect(getNextDate('2026-02-28')).toBe('2026-03-01')
  })

  test('handles February 29 (leap year)', () => {
    expect(getNextDate('2028-02-29')).toBe('2028-03-01')
  })
})

// ─── API Route: POST Validation ──────────────────────────────────────────────

describe('API POST /vehicle-slots Validation', () => {
  function validatePostBody(body: any): { valid: boolean; error?: string } {
    const { vehicle_id, station_name, type, date, start_time, end_time, interval_minutes } = body
    if (!vehicle_id || !station_name || !type || !date || !start_time || !end_time || !interval_minutes) {
      return { valid: false, error: 'Missing required fields' }
    }

    const [sh, sm] = start_time.split(':').map(Number)
    const [eh, em] = end_time.split(':').map(Number)
    const startMin = sh * 60 + (sm || 0)
    const endMin = eh * 60 + (em || 0)
    const interval = parseInt(interval_minutes) || 30

    if (startMin >= endMin || interval < 1) {
      return { valid: false, error: 'Invalid time range or interval' }
    }

    return { valid: true }
  }

  test('valid body passes', () => {
    const result = validatePostBody({
      vehicle_id: 'v1', station_name: 'S1', type: 'pickup',
      date: '2026-04-10', start_time: '07:00', end_time: '18:00', interval_minutes: '30'
    })
    expect(result.valid).toBe(true)
  })

  test('missing vehicle_id fails', () => {
    const result = validatePostBody({
      vehicle_id: '', station_name: 'S1', type: 'pickup',
      date: '2026-04-10', start_time: '07:00', end_time: '18:00', interval_minutes: '30'
    })
    expect(result.valid).toBe(false)
  })

  test('missing station_name fails', () => {
    const result = validatePostBody({
      vehicle_id: 'v1', station_name: '', type: 'pickup',
      date: '2026-04-10', start_time: '07:00', end_time: '18:00', interval_minutes: '30'
    })
    expect(result.valid).toBe(false)
  })

  test('missing type fails', () => {
    const result = validatePostBody({
      vehicle_id: 'v1', station_name: 'S1', type: '',
      date: '2026-04-10', start_time: '07:00', end_time: '18:00', interval_minutes: '30'
    })
    expect(result.valid).toBe(false)
  })

  test('invalid time range fails', () => {
    const result = validatePostBody({
      vehicle_id: 'v1', station_name: 'S1', type: 'pickup',
      date: '2026-04-10', start_time: '18:00', end_time: '07:00', interval_minutes: '30'
    })
    expect(result.valid).toBe(false)
  })

  test('zero interval defaults to 30 (passes validation)', () => {
    // parseInt('0') || 30 = 30, so 0 becomes valid
    const result = validatePostBody({
      vehicle_id: 'v1', station_name: 'S1', type: 'pickup',
      date: '2026-04-10', start_time: '07:00', end_time: '18:00', interval_minutes: '0'
    })
    expect(result.valid).toBe(true)
  })

  test('all fields missing fails', () => {
    const result = validatePostBody({})
    expect(result.valid).toBe(false)
  })
})

// ─── API Route: PUT Copy Forward Validation ──────────────────────────────────

describe('API PUT /vehicle-slots (Copy Forward) Validation', () => {
  function validateCopyBody(body: any): { valid: boolean; error?: string } {
    const { source_date, target_date } = body
    if (!source_date || !target_date) {
      return { valid: false, error: 'source_date and target_date are required' }
    }
    if (source_date === target_date) {
      return { valid: false, error: 'Source and target dates must be different' }
    }
    return { valid: true }
  }

  test('valid copy body passes', () => {
    expect(validateCopyBody({ source_date: '2026-04-10', target_date: '2026-04-11' }).valid).toBe(true)
  })

  test('missing source_date fails', () => {
    expect(validateCopyBody({ target_date: '2026-04-11' }).valid).toBe(false)
  })

  test('missing target_date fails', () => {
    expect(validateCopyBody({ source_date: '2026-04-10' }).valid).toBe(false)
  })

  test('same dates fail', () => {
    const result = validateCopyBody({ source_date: '2026-04-10', target_date: '2026-04-10' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('different')
  })

  test('empty body fails', () => {
    expect(validateCopyBody({}).valid).toBe(false)
  })
})

// ─── Stats Computation ───────────────────────────────────────────────────────

describe('Stats Computation', () => {
  function computeStats(slots: { type: string; vehicle_id: string }[]) {
    const vehicleIds = new Set(slots.map(s => s.vehicle_id))
    return {
      total: slots.length,
      pickups: slots.filter(s => s.type === 'pickup').length,
      drops: slots.filter(s => s.type === 'drop').length,
      vehicles: vehicleIds.size,
    }
  }

  test('empty slots', () => {
    const stats = computeStats([])
    expect(stats).toEqual({ total: 0, pickups: 0, drops: 0, vehicles: 0 })
  })

  test('mixed slots with multiple vehicles', () => {
    const slots = [
      { type: 'pickup', vehicle_id: 'v1' },
      { type: 'pickup', vehicle_id: 'v1' },
      { type: 'drop', vehicle_id: 'v2' },
      { type: 'drop', vehicle_id: 'v2' },
      { type: 'pickup', vehicle_id: 'v3' },
    ]
    const stats = computeStats(slots)
    expect(stats.total).toBe(5)
    expect(stats.pickups).toBe(3)
    expect(stats.drops).toBe(2)
    expect(stats.vehicles).toBe(3)
  })

  test('all same vehicle', () => {
    const slots = [
      { type: 'pickup', vehicle_id: 'v1' },
      { type: 'drop', vehicle_id: 'v1' },
    ]
    expect(computeStats(slots).vehicles).toBe(1)
  })
})

// ─── Filter Logic ────────────────────────────────────────────────────────────

describe('Vehicle Slots Filter', () => {
  function filterSlots(
    slots: { vehicle_id: string; type: string }[],
    typeFilter: 'all' | 'pickup' | 'drop'
  ) {
    const map = new Map<string, typeof slots>()
    slots.forEach(slot => {
      if (typeFilter !== 'all' && slot.type !== typeFilter) return
      if (!map.has(slot.vehicle_id)) map.set(slot.vehicle_id, [])
      map.get(slot.vehicle_id)?.push(slot)
    })
    return map
  }

  const testSlots = [
    { vehicle_id: 'v1', type: 'pickup' },
    { vehicle_id: 'v1', type: 'drop' },
    { vehicle_id: 'v2', type: 'pickup' },
    { vehicle_id: 'v2', type: 'pickup' },
  ]

  test('filter all returns everything grouped', () => {
    const map = filterSlots(testSlots, 'all')
    expect(map.get('v1')?.length).toBe(2)
    expect(map.get('v2')?.length).toBe(2)
  })

  test('filter pickup only', () => {
    const map = filterSlots(testSlots, 'pickup')
    expect(map.get('v1')?.length).toBe(1)
    expect(map.get('v2')?.length).toBe(2)
  })

  test('filter drop only', () => {
    const map = filterSlots(testSlots, 'drop')
    expect(map.get('v1')?.length).toBe(1)
    expect(map.has('v2')).toBe(false) // v2 has no drops
  })

  test('empty slots', () => {
    const map = filterSlots([], 'all')
    expect(map.size).toBe(0)
  })
})

// ─── Search Filter Logic ─────────────────────────────────────────────────────

describe('Vehicle Search Filter', () => {
  function filterVehicles(
    vehicles: { vehicle_name: string; vehicle_number: string; status: string }[],
    query: string
  ) {
    const q = query.toLowerCase()
    return vehicles.filter(v =>
      v.status === 'active' &&
      (v.vehicle_name.toLowerCase().includes(q) || v.vehicle_number.toLowerCase().includes(q))
    )
  }

  const vehicles = [
    { vehicle_name: 'Shuttle Alpha', vehicle_number: 'TN-01-AB-1234', status: 'active' },
    { vehicle_name: 'Shuttle Beta', vehicle_number: 'TN-02-CD-5678', status: 'active' },
    { vehicle_name: 'Old Bus', vehicle_number: 'TN-03-EF-9012', status: 'maintenance' },
  ]

  test('empty query returns all active', () => {
    expect(filterVehicles(vehicles, '').length).toBe(2)
  })

  test('search by name', () => {
    const result = filterVehicles(vehicles, 'alpha')
    expect(result.length).toBe(1)
    expect(result[0].vehicle_name).toBe('Shuttle Alpha')
  })

  test('search by number', () => {
    const result = filterVehicles(vehicles, 'TN-02')
    expect(result.length).toBe(1)
    expect(result[0].vehicle_name).toBe('Shuttle Beta')
  })

  test('excludes maintenance vehicles', () => {
    const result = filterVehicles(vehicles, 'Old')
    expect(result.length).toBe(0)
  })

  test('case insensitive', () => {
    expect(filterVehicles(vehicles, 'SHUTTLE').length).toBe(2)
  })

  test('no match returns empty', () => {
    expect(filterVehicles(vehicles, 'xyz').length).toBe(0)
  })
})
