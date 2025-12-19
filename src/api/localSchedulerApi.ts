import { appointments as seedAppointments } from '../mockData'
import type { Appointment, AppointmentAuditEvent, SlotLock } from '../types'
import { overlaps, parseISO, withinDateRange } from '../utils/schedule'
import type { CreateAppointmentInput, SchedulerApi, SchedulerSnapshot } from './schedulerApi'

type StoredSchedulerState = {
  version: number
  updatedAt: string // ISO
  appointments: Appointment[]
}

const STORAGE_KEY = 'scheduler:poc:v1'
const CLIENT_ID_KEY = 'scheduler:poc:clientId'

const nowIso = () => new Date().toISOString()

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID()
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

const getOrCreateClientId = () => {
  const existing = sessionStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const next = `client_${randomId()}`
  sessionStorage.setItem(CLIENT_ID_KEY, next)
  return next
}

const readState = (): StoredSchedulerState => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seededAt = nowIso()
    const initial: StoredSchedulerState = {
      version: 1,
      updatedAt: seededAt,
      appointments: seedAppointments,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }

  try {
    return JSON.parse(raw) as StoredSchedulerState
  } catch {
    const resetAt = nowIso()
    const initial: StoredSchedulerState = {
      version: 1,
      updatedAt: resetAt,
      appointments: seedAppointments,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
}

const writeState = (next: StoredSchedulerState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

const buildLocks = (appointments: Appointment[], clientId: string): SlotLock[] => {
  return appointments
    .filter((a) => !a.cancelledAt)
    .filter((a) => a.createdBy !== clientId)
    .map((a) => ({
      id: `lock_${a.id}`,
      therapistId: a.therapistId,
      start: a.start,
      end: a.end,
      lockedBy: a.createdBy,
      reason: 'booked',
    }))
}

const findAppointmentOrThrow = (appointments: Appointment[], id: string) => {
  const appt = appointments.find((a) => a.id === id)
  if (!appt) throw new Error('Appointment not found')
  return appt
}

const assertOwnedOrThrow = (appt: Appointment, clientId: string) => {
  if (appt.createdBy !== clientId) throw new Error('Appointment is locked by another user')
  if (appt.cancelledAt) throw new Error('Appointment is cancelled')
}

const assertNoOverlapOrThrow = (appointments: Appointment[], candidate: Appointment) => {
  const start = parseISO(candidate.start)
  const end = parseISO(candidate.end)
  const hasOverlap = appointments.some((a) => {
    if (a.cancelledAt) return false
    if (a.id === candidate.id) return false
    if (a.therapistId !== candidate.therapistId) return false
    return overlaps(start, end, parseISO(a.start), parseISO(a.end))
  })
  if (hasOverlap) throw new Error('Overlapping booking for this resource')
}

export const createLocalSchedulerApi = (): SchedulerApi => {
  const clientId = getOrCreateClientId()

  const fetchSnapshot = async (rangeStart: string, rangeEnd: string): Promise<SchedulerSnapshot> => {
    const state = readState()
    const inRange = state.appointments.filter((a) => withinDateRange(a.start, rangeStart, rangeEnd))

    return {
      appointments: inRange,
      locks: buildLocks(inRange, clientId),
      serverTime: nowIso(),
      version: state.version,
    }
  }

  const createAppointment = async (input: CreateAppointmentInput): Promise<Appointment> => {
    const state = readState()
    const at = nowIso()

    const appt: Appointment = {
      id: randomId(),
      clinicId: input.clinicId,
      therapistId: input.therapistId,
      patient: input.patient,
      start: input.start,
      end: input.end,
      type: input.type,
      mode: input.mode,
      status: 'scheduled',
      createdBy: clientId,
      updatedAt: at,
      audit: [
        {
          at,
          by: clientId,
          type: 'created',
          to: { start: input.start, end: input.end, status: 'scheduled' },
        },
      ],
    }

    assertNoOverlapOrThrow(state.appointments, appt)

    const next: StoredSchedulerState = {
      version: state.version + 1,
      updatedAt: at,
      appointments: [...state.appointments, appt],
    }
    writeState(next)
    return appt
  }

  const rescheduleAppointment = async (id: string, start: string, end: string): Promise<Appointment> => {
    const state = readState()
    const current = findAppointmentOrThrow(state.appointments, id)
    assertOwnedOrThrow(current, clientId)

    const at = nowIso()
    const nextAppt: Appointment = {
      ...current,
      start,
      end,
      updatedAt: at,
      audit: [
        ...current.audit,
        {
          at,
          by: clientId,
          type: 'rescheduled',
          from: { start: current.start, end: current.end },
          to: { start, end },
        },
      ],
    }

    assertNoOverlapOrThrow(state.appointments, nextAppt)

    const next: StoredSchedulerState = {
      version: state.version + 1,
      updatedAt: at,
      appointments: state.appointments.map((a) => (a.id === id ? nextAppt : a)),
    }
    writeState(next)
    return nextAppt
  }

  const reassignAppointment = async (id: string, therapistId: string): Promise<Appointment> => {
    const state = readState()
    const current = findAppointmentOrThrow(state.appointments, id)
    assertOwnedOrThrow(current, clientId)

    const at = nowIso()
    const nextAppt: Appointment = {
      ...current,
      therapistId,
      updatedAt: at,
      audit: [
        ...current.audit,
        {
          at,
          by: clientId,
          type: 'rescheduled',
          note: `reassigned:${current.therapistId}->${therapistId}`,
        },
      ],
    }

    assertNoOverlapOrThrow(state.appointments, nextAppt)

    const next: StoredSchedulerState = {
      version: state.version + 1,
      updatedAt: at,
      appointments: state.appointments.map((a) => (a.id === id ? nextAppt : a)),
    }
    writeState(next)
    return nextAppt
  }

  const updateAppointmentStatus = async (id: string, status: Appointment['status']): Promise<Appointment> => {
    const state = readState()
    const current = findAppointmentOrThrow(state.appointments, id)
    assertOwnedOrThrow(current, clientId)

    const at = nowIso()
    const event: AppointmentAuditEvent = {
      at,
      by: clientId,
      type: 'status-change',
      from: { status: current.status },
      to: { status },
    }

    const nextAppt: Appointment = {
      ...current,
      status,
      updatedAt: at,
      audit: [...current.audit, event],
    }

    const next: StoredSchedulerState = {
      version: state.version + 1,
      updatedAt: at,
      appointments: state.appointments.map((a) => (a.id === id ? nextAppt : a)),
    }
    writeState(next)
    return nextAppt
  }

  const cancelAppointment = async (id: string): Promise<Appointment> => {
    const state = readState()
    const current = findAppointmentOrThrow(state.appointments, id)
    assertOwnedOrThrow(current, clientId)

    const at = nowIso()
    const nextAppt: Appointment = {
      ...current,
      cancelledAt: at,
      cancelledBy: clientId,
      updatedAt: at,
      audit: [
        ...current.audit,
        {
          at,
          by: clientId,
          type: 'cancelled',
        },
      ],
    }

    const next: StoredSchedulerState = {
      version: state.version + 1,
      updatedAt: at,
      appointments: state.appointments.map((a) => (a.id === id ? nextAppt : a)),
    }
    writeState(next)
    return nextAppt
  }

  return {
    getClientId: () => clientId,
    fetchSnapshot,
    createAppointment,
    rescheduleAppointment,
    reassignAppointment,
    updateAppointmentStatus,
    cancelAppointment,
  }
}
