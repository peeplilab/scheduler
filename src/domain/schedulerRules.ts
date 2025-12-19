import type { Appointment, SlotLock, Therapist, TimeAway } from '../types'
import { addMinutes, minutesDiff, overlaps, parseISO, snapMinutes } from '../utils/schedule'

type AvailabilityContext = {
  therapists: Therapist[]
  timeAway: TimeAway[]
}

export type SlotSnapConfig = {
  slotMinutes: number
}

export const isLockedAppointment = (appt: Appointment, clientId: string) => appt.createdBy !== clientId

export const isCancelled = (appt: Appointment) => Boolean(appt.cancelledAt)

export const getLocksForRange = (appointments: Appointment[], clientId: string): SlotLock[] => {
  return appointments
    .filter((a) => !a.cancelledAt)
    .filter((a) => a.createdBy !== clientId)
    .map((a) => ({
      id: `lock_${a.id}`,
      therapistId: a.therapistId,
      start: a.start,
      end: a.end,
      lockedBy: a.createdBy,
      reason: 'booked' as const,
    }))
}

export const slotOverlapsLocks = (
  therapistId: string,
  start: Date,
  end: Date,
  locks: SlotLock[],
): boolean => {
  return locks.some((lock) => {
    if (lock.therapistId !== therapistId) return false
    return overlaps(start, end, parseISO(lock.start), parseISO(lock.end))
  })
}

export const hasAppointmentOverlap = (
  appointments: Appointment[],
  therapistId: string,
  start: Date,
  end: Date,
  ignoreAppointmentId?: string,
) => {
  return appointments.some((a) => {
    if (a.cancelledAt) return false
    if (a.therapistId !== therapistId) return false
    if (ignoreAppointmentId && a.id === ignoreAppointmentId) return false
    return overlaps(start, end, parseISO(a.start), parseISO(a.end))
  })
}

export const withinTherapistWorkingHours = (therapist: Therapist, start: Date, end: Date) => {
  const dow = start.getDay()
  if (!therapist.workingHours.days.includes(dow)) return false

  const toMin = (d: Date) => d.getHours() * 60 + d.getMinutes()
  const toMinHHmm = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }

  const startMin = toMin(start)
  const endMin = toMin(end)

  return (
    startMin >= toMinHHmm(therapist.workingHours.start) &&
    endMin <= toMinHHmm(therapist.workingHours.end)
  )
}

export const hasTimeAwayConflict = (therapistId: string, start: Date, end: Date, away: TimeAway[]) => {
  const day = start.toISOString().split('T')[0]
  return away.some((slot) => {
    if (slot.therapistId !== therapistId) return false
    if (slot.date !== day) return false
    const startWindow = parseISO(`${day}T${slot.start}:00`)
    const endWindow = parseISO(`${day}T${slot.end}:00`)
    return overlaps(start, end, startWindow, endWindow)
  })
}

export const snapDateToSlot = (date: Date, slotMinutes: number, mode: 'floor' | 'round' | 'ceil') => {
  const mins = date.getHours() * 60 + date.getMinutes()
  const snapped = snapMinutes(mins, slotMinutes, mode)
  const next = new Date(date)
  next.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0)
  return next
}

export const computeEndFromDuration = (start: Date, durationMinutes: number) => addMinutes(start, durationMinutes)

export const getAppointmentDurationMinutes = (appt: Appointment) => minutesDiff(parseISO(appt.start), parseISO(appt.end))

export const canScheduleWindow = (
  therapistId: string,
  start: Date,
  end: Date,
  appointments: Appointment[],
  locks: SlotLock[],
  context: AvailabilityContext,
  ignoreAppointmentId?: string,
): { ok: true } | { ok: false; reason: string } => {
  const therapist = context.therapists.find((t) => t.id === therapistId)
  if (!therapist) return { ok: false, reason: 'Therapist not found' }

  if (!withinTherapistWorkingHours(therapist, start, end)) return { ok: false, reason: 'Outside working hours' }
  if (hasTimeAwayConflict(therapistId, start, end, context.timeAway)) return { ok: false, reason: 'Time off' }

  if (slotOverlapsLocks(therapistId, start, end, locks)) return { ok: false, reason: 'Slot locked by another user' }

  if (hasAppointmentOverlap(appointments, therapistId, start, end, ignoreAppointmentId)) {
    return { ok: false, reason: 'Overlapping appointment' }
  }

  return { ok: true }
}

export const nextAllowedStatuses: Record<Appointment['status'], Appointment['status'][]> = {
  'scheduled': ['check-in', 'in-progress', 'completed', 'incomplete'],
  'check-in': ['in-progress', 'completed', 'incomplete'],
  'in-progress': ['completed', 'incomplete'],
  'completed': [],
  'incomplete': [],
}
