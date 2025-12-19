import type { Appointment, Therapist, TimeAway, WorkingHours } from '../types'

type ViewMode = 'day' | 'week'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const parseISO = (value: string) => new Date(value)

export const formatDateInput = (date: Date) => date.toISOString().split('T')[0]

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY)

export const isSameDay = (date: Date, other: Date) =>
  date.getFullYear() === other.getFullYear() &&
  date.getMonth() === other.getMonth() &&
  date.getDate() === other.getDate()

const minutesSinceMidnight = (date: Date) => date.getHours() * 60 + date.getMinutes()

const minutesFromHHmm = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date) =>
  startA < endB && endA > startB

export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000)

export const minutesDiff = (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / (60 * 1000))

export const snapMinutes = (minutesFromMidnightValue: number, slotMinutes: number, mode: 'floor' | 'round' | 'ceil') => {
  const ratio = minutesFromMidnightValue / slotMinutes
  const snapped =
    mode === 'floor' ? Math.floor(ratio) : mode === 'ceil' ? Math.ceil(ratio) : Math.round(ratio)
  return snapped * slotMinutes
}

const withinWorkingWindow = (workingHours: WorkingHours, start: Date, end: Date) => {
  const dow = start.getDay()
  if (!workingHours.days.includes(dow)) return false
  const startMinutes = minutesSinceMidnight(start)
  const endMinutes = minutesSinceMidnight(end)
  return (
    startMinutes >= minutesFromHHmm(workingHours.start) &&
    endMinutes <= minutesFromHHmm(workingHours.end)
  )
}

const hasTimeAwayConflict = (therapistId: string, start: Date, end: Date, away: TimeAway[]) => {
  return away.some((slot) => {
    if (slot.therapistId !== therapistId) return false
    const day = slot.date
    const startWindow = parseISO(`${day}T${slot.start}:00`)
    const endWindow = parseISO(`${day}T${slot.end}:00`)
    return overlaps(start, end, startWindow, endWindow)
  })
}

export const isTherapistAvailable = (
  therapist: Therapist,
  startISO: string,
  endISO: string,
  currentAppointments: Appointment[],
  away: TimeAway[],
) => {
  const start = parseISO(startISO)
  const end = parseISO(endISO)

  if (!withinWorkingWindow(therapist.workingHours, start, end)) return false
  if (hasTimeAwayConflict(therapist.id, start, end, away)) return false

  const hasOverlap = currentAppointments.some((appt) => {
    if (appt.cancelledAt) return false
    return appt.therapistId === therapist.id && overlaps(start, end, parseISO(appt.start), parseISO(appt.end))
  })
  return !hasOverlap
}

export const detectConflicts = (appts: Appointment[]) => {
  const conflicts = new Set<string>()
  const grouped = appts.reduce<Record<string, Appointment[]>>((acc, appt) => {
    if (appt.cancelledAt) return acc
    acc[appt.therapistId] = acc[appt.therapistId] || []
    acc[appt.therapistId].push(appt)
    return acc
  }, {})

  Object.values(grouped).forEach((list) => {
    const sorted = [...list].sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i]
      const next = sorted[i + 1]
      if (overlaps(parseISO(current.start), parseISO(current.end), parseISO(next.start), parseISO(next.end))) {
        conflicts.add(current.id)
        conflicts.add(next.id)
      }
    }
  })

  return conflicts
}

export const buildRange = (startInput: string, endInput: string, view: ViewMode) => {
  const start = parseISO(`${startInput}T00:00:00`)
  const end = parseISO(`${endInput}T00:00:00`)
  const maxEnd = view === 'week' ? addDays(start, 6) : start
  const actualEnd = end < maxEnd ? end : maxEnd

  const days: Date[] = []
  for (let cursor = start; cursor <= actualEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}

export const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export const formatTime = (value: string) => {
  const date = parseISO(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const withinDateRange = (iso: string, start: string, end: string) => {
  const date = parseISO(iso)
  const startDate = parseISO(`${start}T00:00:00`)
  const endDate = parseISO(`${end}T23:59:59`)
  return date >= startDate && date <= endDate
}
