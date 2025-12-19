export type StaffRole = 'PT' | 'OT' | 'Speech'

export type AppointmentType = 'evaluation' | 'followup'

export type AppointmentStatus = 'scheduled' | 'check-in' | 'in-progress' | 'completed' | 'incomplete'

export type AppointmentMode = 'in-clinic' | 'telephonic'

export type AppointmentAuditEvent = {
  at: string // ISO
  by: string
  type: 'created' | 'rescheduled' | 'cancelled' | 'status-change'
  from?: {
    start?: string
    end?: string
    status?: AppointmentStatus
  }
  to?: {
    start?: string
    end?: string
    status?: AppointmentStatus
  }
  note?: string
}

export type Clinic = {
  id: string
  name: string
  color: string
  location: string
}

export type WorkingHours = {
  start: string // HH:mm
  end: string // HH:mm
  days: number[] // 0 = Sunday
}

export type Therapist = {
  id: string
  name: string
  role: StaffRole
  clinicId: string
  workingHours: WorkingHours
}

export type Appointment = {
  id: string
  clinicId: string
  therapistId: string
  patient: string
  start: string // ISO string
  end: string // ISO string
  type: AppointmentType

  mode: AppointmentMode
  status: AppointmentStatus

  createdBy: string
  updatedAt: string // ISO
  cancelledAt?: string // ISO
  cancelledBy?: string
  audit: AppointmentAuditEvent[]
}

export type SlotLock = {
  id: string
  therapistId: string
  start: string // ISO
  end: string // ISO
  lockedBy: string
  reason: 'booked'
}

export type TimeAway = {
  id: string
  therapistId: string
  date: string // YYYY-MM-DD
  start: string // HH:mm
  end: string // HH:mm
  reason: string
}

export type AvailabilityStatus = 'available' | 'booked' | 'time-off' | 'off'
