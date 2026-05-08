export interface Admin {
  _id: string;
  username: string;
  email?: string;
  role: string;
  lastLogin?: string;
}

export interface TransportRequestType {
  _id: string;
  ic_number: string;
  appointment_id?: string;
  patient_name: string;
  phone_number: string;
  doctor_name?: string;
  service_type: 'pickup' | 'drop' | 'both';
  pickup_station?: string;
  appointment_date: string;
  appointment_time?: string;
  pickup_time?: string;
  dropoff_station?: string;
  dropoff_time?: string;
  seats?: number;
  vehicle_id?: string | VehicleType;
  dropoff_vehicle_id?: string | VehicleType;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  pickup_status?: 'pending' | 'completed' | 'no_show';
  dropoff_status?: 'pending' | 'completed' | 'no_show';
  status_updated_by?: 'admin' | 'driver' | null;
  status_updated_at?: string | null;
  transport_required: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleType {
  _id: string;
  vehicle_name: string;
  vehicle_number: string;
  vehicle_type: 'Car' | 'Van' | 'Bus';
  image?: string;
  seat_capacity: number;
  driver_id?: any;
  status: 'active' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface PickupStationType {
  _id: string;
  station_name: string;
  location_name: string;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface TransportScheduleType {
  _id: string;
  request_id: string | TransportRequestType;
  vehicle_id: string | VehicleType;
  pickup_time?: string;
  dropoff_time?: string;
  service_type: 'pickup' | 'drop' | 'both';
  driver_name?: string;
  driver_phone?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface DriverLeaveType {
  _id: string;
  driver_id: string;
  leave_type: 'weekly_off' | 'annual_leave' | 'sick' | 'other';
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason?: string;
  status: 'approved' | 'pending' | 'rejected';
  created_by: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriverSlotOverrideType {
  _id: string;
  driver_id: string;
  override_date: string; // YYYY-MM-DD
  block_full_day: boolean;
  disabled_slots: string[]; // ['09:00', '10:30']
  reason?: string;
  created_by: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  confirmedTransport: number;
  completedPickups: number;
}
