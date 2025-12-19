import type { Appointment, SlotLock } from '../types'

export type SchedulerSnapshot = {
  appointments: Appointment[]
  locks: SlotLock[]
  serverTime: string // ISO
  version: number
}

export type CreateAppointmentInput = {
  clinicId: string
  therapistId: string
  patient: string
  start: string // ISO
  end: string // ISO
  type: Appointment['type']
  mode: Appointment['mode']
}

export type SchedulerApi = {
  getClientId: () => string
  fetchSnapshot: (rangeStart: string, rangeEnd: string) => Promise<SchedulerSnapshot>
  createAppointment: (input: CreateAppointmentInput) => Promise<Appointment>
  rescheduleAppointment: (id: string, start: string, end: string) => Promise<Appointment>
  reassignAppointment: (id: string, therapistId: string) => Promise<Appointment>
  updateAppointmentStatus: (id: string, status: Appointment['status']) => Promise<Appointment>
  cancelAppointment: (id: string) => Promise<Appointment>
}
