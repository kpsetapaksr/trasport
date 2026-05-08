import mongoose, { Schema, model, models } from 'mongoose';

// ============ APPOINTMENT (read-only, from Clinical-main) ============
const AppointmentSchema = new Schema({
  id: { type: String },
  patientName: { type: String },
  patientIC: { type: String },
  patientPhone: { type: String },
  patientEmail: { type: String },
  appointmentDate: { type: String },
  timeSlot: { type: String },
  doctorId: { type: String },
  status: { type: String },
}, { timestamps: true, collection: 'appointments' });

AppointmentSchema.index({ patientIC: 1, appointmentDate: 1 });

export const Appointment = models.Appointment || model('Appointment', AppointmentSchema);

// ============ DOCTOR (read-only, from Clinical-main) ============
const DoctorSchema = new Schema({
  id: { type: String },
  name: { type: String },
  specialization: { type: String },
  photo: { type: String },
  isActive: { type: Boolean },
}, { timestamps: true, collection: 'doctors' });

export const Doctor = models.Doctor || model('Doctor', DoctorSchema);

// ============ ADMIN ============
const AdminSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, default: '' },
  role: { type: String, default: 'admin' },
  lastLogin: { type: Date },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
}, { timestamps: true });

export const Admin = models.Admin || model('Admin', AdminSchema);

// ============ TRANSPORT REQUESTS ============
const TransportRequestSchema = new Schema({
  ic_number: {
    type: String, required: true,
    minlength: [10, 'IC must be at least 10 digits'],
    maxlength: [12, 'IC must be at most 12 digits'],
    match: [/^[0-9]+$/, 'IC must be numeric'],
  },
  appointment_id: { type: String },
  patient_name: { type: String, required: true, maxlength: [200, 'Name too long'] },
  phone_number: {
    type: String, default: '',
    validate: {
      validator: (v: string) => !v || /^[0-9]{10,11}$/.test(v.replace(/\D/g, '')),
      message: 'Phone must be 10–11 digits',
    },
  },
  doctor_name: { type: String },
  service_type: {
    type: String,
    enum: ['pickup', 'drop', 'both'],
    default: 'pickup',
  },
  pickup_station: { type: String },
  appointment_date: { type: Date, required: true },
  appointment_time: { type: String },
  pickup_time: {
    type: String,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'pickup_time must be HH:MM'],
  },
  dropoff_station: { type: String },
  dropoff_time: {
    type: String,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'dropoff_time must be HH:MM'],
  },
  seats: { type: Number, default: 1, min: [1, 'Min 1 seat'], max: [20, 'Max 20 seats'] },
  vehicle_id: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  dropoff_vehicle_id: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  },
  transport_required: { type: Boolean, default: true },
  pickup_status: {
    type: String,
    enum: ['pending', 'completed', 'no_show'],
    default: 'pending',
  },
  dropoff_status: {
    type: String,
    enum: ['pending', 'completed', 'no_show'],
    default: 'pending',
  },
  status_updated_by: { type: String, enum: ['admin', 'driver'], default: null },
  status_updated_at: { type: Date, default: null },
}, { timestamps: true, collection: 'transport_requests' });

TransportRequestSchema.index({ appointment_date: 1, status: 1 });
TransportRequestSchema.index({ ic_number: 1 });
// Compound unique index prevents duplicate requests at DB level (TOCTOU race guard)
TransportRequestSchema.index(
  { ic_number: 1, appointment_date: 1, service_type: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'confirmed', 'completed'] } },
  }
);

// Delete cached model so the new compound unique index is applied on every hot-reload
if (models.TransportRequest) delete (models as any).TransportRequest;
export const TransportRequest = model('TransportRequest', TransportRequestSchema);

// ============ VEHICLES ============
const VehicleSchema = new Schema({
  vehicle_name: { type: String, required: true },
  vehicle_number: { type: String, required: true, unique: true },
  vehicle_type: {
    type: String,
    enum: ['Car', 'Van', 'Bus'],
    required: true,
  },
  image: { type: String },
  seat_capacity: { type: Number, required: true },
  driver_id: { type: Schema.Types.ObjectId, ref: 'Driver' },
  status: {
    type: String,
    enum: ['active', 'maintenance'],
    default: 'active',
  },
}, { timestamps: true, collection: 'vehicles' });

export const Vehicle = models.Vehicle || model('Vehicle', VehicleSchema);

// ============ PICKUP STATIONS ============
const PickupStationSchema = new Schema({
  station_name: { type: String, required: true },
  location_name: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true, collection: 'pickup_stations' });

PickupStationSchema.index({ station_name: 1 });

export const PickupStation = models.PickupStation || model('PickupStation', PickupStationSchema);

// ============ DRIVERS (Credentials) ============
const DriverSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  id_card_number: { type: String },
  image: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'drivers' });

// Delete cached model to pick up schema changes without server restart
if (models.Driver) delete (models as any).Driver;
export const Driver = model('Driver', DriverSchema);

// ============ VEHICLE SCHEDULE SLOTS ============
const VehicleScheduleSlotSchema = new Schema({
  vehicle_id: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  station_name: { type: String, required: true },
  type: { type: String, enum: ['pickup', 'drop'], required: true },
  date: { type: String, default: '' },
  time: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  block_reason: { type: String, default: '' },
}, { timestamps: true, collection: 'vehicle_schedule_slots' });

VehicleScheduleSlotSchema.index({ vehicle_id: 1 });
VehicleScheduleSlotSchema.index({ date: 1, type: 1, status: 1 });

// Delete cached model to pick up schema changes without server restart
if (models.VehicleScheduleSlot) delete (models as any).VehicleScheduleSlot;
export const VehicleScheduleSlot = model('VehicleScheduleSlot', VehicleScheduleSlotSchema);

// ============ TRANSPORT SCHEDULE ============
const TransportScheduleSchema = new Schema({
  request_id: { type: Schema.Types.ObjectId, ref: 'TransportRequest', required: true },
  vehicle_id: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  pickup_time: { type: String },
  dropoff_time: { type: String },
  service_type: { type: String, enum: ['pickup', 'drop', 'both'], default: 'pickup' },
  driver_name: { type: String },
  driver_phone: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  },
}, { timestamps: true, collection: 'transport_schedule' });

export const TransportSchedule = models.TransportSchedule || model('TransportSchedule', TransportScheduleSchema);

// ============ DRIVER LEAVES ============
const DriverLeaveSchema = new Schema({
  driver_id: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  leave_type: {
    type: String,
    enum: ['weekly_off', 'annual_leave', 'sick', 'other'],
    required: true,
  },
  start_date: { type: String, required: true }, // YYYY-MM-DD
  end_date: { type: String, required: true },   // YYYY-MM-DD
  reason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'approved',
  },
  created_by: { type: String, default: 'admin' },
}, { timestamps: true, collection: 'driver_leaves' });

DriverLeaveSchema.index({ driver_id: 1, start_date: 1, end_date: 1 });
DriverLeaveSchema.index({ start_date: 1, end_date: 1, status: 1 });

if (models.DriverLeave) delete (models as any).DriverLeave;
export const DriverLeave = model('DriverLeave', DriverLeaveSchema);

// ============ DRIVER SLOT OVERRIDES ============
const DriverSlotOverrideSchema = new Schema({
  driver_id: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  override_date: { type: String, required: true }, // YYYY-MM-DD
  block_full_day: { type: Boolean, default: false },
  disabled_slots: { type: [String], default: [] }, // ['09:00', '10:30']
  reason: { type: String, default: '' },
  created_by: { type: String, default: 'admin' },
}, { timestamps: true, collection: 'driver_slot_overrides' });

DriverSlotOverrideSchema.index({ driver_id: 1, override_date: 1 }, { unique: true });

if (models.DriverSlotOverride) delete (models as any).DriverSlotOverride;
export const DriverSlotOverride = model('DriverSlotOverride', DriverSlotOverrideSchema);

// ============ TRANSPORT SETTINGS ============
const SlotOverrideSchema = new Schema({
  time: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  custom_time: { type: String, default: '' },
}, { _id: false });

const TransportSettingsSchema = new Schema({
  // Schedule configuration
  start_time: { type: String, default: '07:00' },       // First pickup slot
  end_time: { type: String, default: '17:00' },          // Last pickup slot
  interval_minutes: { type: Number, default: 30 },       // Slot interval
  buffer_before_appointment: { type: Number, default: 60 }, // Minutes: patient must be picked up at least X min before appt
  travel_time_minutes: { type: Number, default: 30 },    // Estimated travel time from station to hospital
  appointment_duration_minutes: { type: Number, default: 30 }, // Estimated appointment length (for drop-off calculation)
  max_seats_per_slot: { type: Number, default: 0 },      // 0 = use total vehicle capacity
  // Per-slot overrides
  slot_overrides: { type: [SlotOverrideSchema], default: [] },
  // Status
  enabled: { type: Boolean, default: true },
  message: { type: String, default: '' },                 // Optional message shown to patients
}, { timestamps: true, collection: 'transport_settings' });

export const TransportSettings = models.TransportSettings || model('TransportSettings', TransportSettingsSchema);
