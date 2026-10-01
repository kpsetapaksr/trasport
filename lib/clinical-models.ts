import { Schema } from 'mongoose';
import clinicalDbConnect from './clinical-db';

// ============ APPOINTMENT (from clinical database) ============
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

// ============ DOCTOR (from clinical database) ============
const DoctorSchema = new Schema({
  id: { type: String },
  name: { type: String },
  specialization: { type: String },
  photo: { type: String },
  isActive: { type: Boolean },
}, { timestamps: true, collection: 'doctors' });

// ============ PATIENT (from clinical database) ============
// Used to resolve the patient's full registered (MyKad) name by IC, so the
// transport portal shows the authoritative full name rather than whatever name
// happens to be stored on an individual appointment.
const PatientSchema = new Schema({
  id: { type: String },
  name: { type: String },
  ic: { type: String },
  phone: { type: String },
}, { timestamps: true, collection: 'patients' });

// Get models from the clinical connection
export async function getClinicalModels() {
  const conn = await clinicalDbConnect();
  const Appointment = conn.models.Appointment || conn.model('Appointment', AppointmentSchema);
  const Doctor = conn.models.Doctor || conn.model('Doctor', DoctorSchema);
  const Patient = conn.models.Patient || conn.model('Patient', PatientSchema);
  return { Appointment, Doctor, Patient };
}
