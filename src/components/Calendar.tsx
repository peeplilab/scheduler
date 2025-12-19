import { useMemo, useState } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, type SlotInfo } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { CreateAppointmentInput } from '../api/schedulerApi'
import {
  canScheduleWindow,
  getAppointmentDurationMinutes,
  nextAllowedStatuses,
  snapDateToSlot,
} from '../domain/schedulerRules'
import type { Appointment, Clinic, Therapist, TimeAway } from '../types'
import { addMinutes, formatDateInput, formatTime, parseISO } from '../utils/schedule'

type ViewMode = 'day' | 'week'

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resourceId?: string
  appointment: Appointment
}

type BackgroundEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resourceId?: string
  kind: 'away'
}

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

const DragAndDropCalendar = withDragAndDrop(BigCalendar)

type CalendarProps = {
  dates: Date[]
  appointments: Appointment[]
  therapists: Therapist[]
  clinics: Clinic[]
  conflicts: Set<string>
  viewMode: ViewMode
  timeAway: TimeAway[]

  onReassign: (id: string, therapistId: string) => void
  isTherapistEligible: (therapistId: string, start: string, end: string, ignoreId?: string) => boolean

  onCreate: (input: CreateAppointmentInput) => void
  onReschedule: (id: string, start: string, end: string) => void
  onCancel: (id: string) => void
  onUpdateStatus: (id: string, status: Appointment['status']) => void
}

export function CalendarView({
  dates,
  appointments,
  therapists,
  clinics,
  conflicts,
  viewMode,
  timeAway,
  onReassign,
  isTherapistEligible,
  onCreate,
  onReschedule,
  onCancel,
  onUpdateStatus,
}: CalendarProps) {
  const slotMinutes = 15
  const [query, setQuery] = useState('')

  const [createPatient, setCreatePatient] = useState('')
  const [createType, setCreateType] = useState<Appointment['type']>('evaluation')
  const [createMode, setCreateMode] = useState<Appointment['mode']>('in-clinic')
  const [createTherapistId, setCreateTherapistId] = useState<string>(() => therapists[0]?.id ?? '')
  const [createDate, setCreateDate] = useState<string>(() => formatDateInput(dates[0] ?? new Date()))
  const [createStartTime, setCreateStartTime] = useState<string>('09:00')
  const [createDurationMinutes, setCreateDurationMinutes] = useState<number>(60)

  const therapistLookup = useMemo(() => Object.fromEntries(therapists.map((t) => [t.id, t])), [therapists])
  const clinicLookup = useMemo(() => Object.fromEntries(clinics.map((c) => [c.id, c])), [clinics])

  const normalizedQuery = query.trim().toLowerCase()
  const listView = useMemo(() => {
    const base = [...appointments].sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
    if (!normalizedQuery) return base
    return base.filter((a) => {
      const therapist = therapistLookup[a.therapistId]
      const hay = `${a.patient} ${therapist?.name ?? ''} ${therapist?.role ?? ''} ${a.type} ${a.status}`.toLowerCase()
      return hay.includes(normalizedQuery)
    })
  }, [appointments, normalizedQuery, therapistLookup])

  const toTimeInput = (date: Date) => {
    const hh = date.getHours()
    const mm = date.getMinutes()
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }

  const applyCreatePreset = (therapistId: string, start: Date, end: Date) => {
    const snappedStart = snapDateToSlot(start, slotMinutes, 'floor')
    const rawMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / (60 * 1000)))
    const durationMinutes = Math.max(slotMinutes, Math.round(rawMinutes / slotMinutes) * slotMinutes)
    const slots = Math.min(4, Math.max(1, Math.round(durationMinutes / slotMinutes)))

    setCreateTherapistId(therapistId)
    setCreateDate(formatDateInput(snappedStart))
    setCreateStartTime(toTimeInput(snappedStart))
    setCreateDurationMinutes(slots * slotMinutes)
  }

  const handleCreate = () => {
    const therapist = therapistLookup[createTherapistId]
    if (!therapist) return

    const patient = createPatient.trim()
    if (!patient) return

    const [hh, mm] = createStartTime.split(':').map(Number)
    const rawStart = parseISO(`${createDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`)
    const start = snapDateToSlot(rawStart, slotMinutes, 'floor')
    const duration = Math.max(slotMinutes, Math.round(createDurationMinutes / slotMinutes) * slotMinutes)
    const end = addMinutes(start, duration)

    const validation = canScheduleWindow(therapist.id, start, end, appointments, [], { therapists, timeAway })
    if (!validation.ok) return

    onCreate({
      clinicId: therapist.clinicId,
      therapistId: therapist.id,
      patient,
      start: start.toISOString(),
      end: end.toISOString(),
      type: createType,
      mode: createMode,
    })

    setCreatePatient('')
  }

  const selectedDay = dates[0]
  const selectedDayISO = selectedDay ? formatDateInput(selectedDay) : formatDateInput(new Date())

  const calendarAnchorDate = selectedDay ?? new Date()
  const calendarMin = useMemo(() => {
    const next = new Date(calendarAnchorDate)
    next.setHours(7, 0, 0, 0)
    return next
  }, [calendarAnchorDate])
  const calendarMax = useMemo(() => {
    const next = new Date(calendarAnchorDate)
    next.setHours(18, 0, 0, 0)
    return next
  }, [calendarAnchorDate])

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return appointments
      .filter((a) => !a.cancelledAt)
      .map((appt) => ({
        id: appt.id,
        title: appt.patient,
        start: parseISO(appt.start),
        end: parseISO(appt.end),
        resourceId: appt.therapistId,
        appointment: appt,
      }))
  }, [appointments])

  const backgroundEvents = useMemo<BackgroundEvent[]>(() => {
    if (viewMode !== 'day') return []

    const awayEvents = timeAway
      .filter((a) => a.date === selectedDayISO)
      .map((a) => ({
        id: `away_${a.id}`,
        title: 'Time off',
        start: parseISO(`${a.date}T${a.start}:00`),
        end: parseISO(`${a.date}T${a.end}:00`),
        resourceId: a.therapistId,
        kind: 'away' as const,
      }))

    return awayEvents
  }, [selectedDayISO, timeAway, viewMode])

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const resourceId = (slotInfo as unknown as { resourceId?: unknown }).resourceId
    if (typeof resourceId !== 'string') return
    applyCreatePreset(resourceId, slotInfo.start, slotInfo.end)
  }

  const handleEventDrop = (args: { event: CalendarEvent; start: Date; end: Date; resourceId?: string | number }) => {
    const { event, start, resourceId } = args
    const appt = event.appointment
    if (appt.cancelledAt) return
    if (resourceId && String(resourceId) !== appt.therapistId) return

    const snappedStart = snapDateToSlot(start, slotMinutes, 'round')
    const duration = getAppointmentDurationMinutes(appt)
    const nextEnd = addMinutes(snappedStart, duration)

    const validation = canScheduleWindow(
      appt.therapistId,
      snappedStart,
      nextEnd,
      appointments,
      [],
      { therapists, timeAway },
      appt.id,
    )
    if (!validation.ok) return

    onReschedule(appt.id, snappedStart.toISOString(), nextEnd.toISOString())
  }

  const getClinicColor = (appt: Appointment) => clinicLookup[appt.clinicId]?.color

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Multi-clinic schedule</p>
          <p className="muted">Create, search, reschedule, cancel</p>
        </div>
      </div>

      <div className="schedulerControls">
        <div className="schedulerControls__row">
          <div>
            <label className="label">Search</label>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Patient, therapist, type, status…"
              title="Search across patient, therapist, type, and status"
            />
          </div>
          <div>
            <label className="label">Patient</label>
            <input
              className="input"
              value={createPatient}
              onChange={(e) => setCreatePatient(e.target.value)}
              placeholder="Search existing patient or type a new one…"
              title="Start typing a patient name (existing or new)"
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={createType} onChange={(e) => setCreateType(e.target.value as Appointment['type'])}>
              <option value="evaluation">Evaluation</option>
              <option value="followup">Follow-up</option>
            </select>
          </div>
          <div>
            <label className="label">Mode</label>
            <select className="input" value={createMode} onChange={(e) => setCreateMode(e.target.value as Appointment['mode'])}>
              <option value="in-clinic">In-clinic</option>
              <option value="telephonic">Telephonic</option>
            </select>
          </div>
        </div>

        <div className="schedulerControls__row">
          <div>
            <label className="label">Resource</label>
            <select className="input" value={createTherapistId} onChange={(e) => setCreateTherapistId(e.target.value)}>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Start</label>
            <input type="time" className="input" value={createStartTime} onChange={(e) => setCreateStartTime(e.target.value)} step={slotMinutes * 60} />
          </div>
          <div>
            <label className="label">Duration</label>
            <select className="input" value={createDurationMinutes} onChange={(e) => setCreateDurationMinutes(Number(e.target.value))}>
              {[1, 2, 3, 4].map((m) => (
                <option key={m} value={m * slotMinutes}>
                  {m * slotMinutes} minutes
                </option>
              ))}
            </select>
          </div>

          <div className="schedulerControls__cta">
            <button type="button" className="chip chip--active" onClick={handleCreate} title="Creates an appointment and snaps it to 15-minute slots">
              Create
            </button>
            <div className="muted small" title="You can also drag-and-drop existing appointments to reschedule">
              Tip: click a day/resource column to preset start time.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 560 }} title="Drag and drop appointments to reschedule (snaps to 15-minute slots)">
        <DragAndDropCalendar
          localizer={localizer}
          date={calendarAnchorDate}
          view={viewMode}
          toolbar={false}
          events={calendarEvents}
          backgroundEvents={backgroundEvents as unknown as CalendarEvent[]}
          selectable
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop as unknown as (args: unknown) => void}
          draggableAccessor={(event: CalendarEvent) => !event.appointment.cancelledAt}
          resizable={false}
          step={slotMinutes}
          timeslots={60 / slotMinutes}
          min={calendarMin}
          max={calendarMax}
          resources={viewMode === 'day' ? therapists : undefined}
          resourceIdAccessor={(t: Therapist) => t.id}
          resourceTitleAccessor={(t: Therapist) => `${t.name} · ${t.role}`}
          eventPropGetter={(event: CalendarEvent) => {
            const appt = event.appointment
            const conflict = conflicts.has(appt.id)
            const clinicColor = getClinicColor(appt)

            return {
              className: conflict ? 'schedule__appt--conflict' : '',
              style: {
                borderLeft: clinicColor ? `4px solid ${clinicColor}` : undefined,
              },
            }
          }}
          tooltipAccessor={(event: CalendarEvent) => {
            const appt = event.appointment
            const therapist = therapistLookup[appt.therapistId]
            const clinic = clinicLookup[appt.clinicId]
            return `${appt.patient} · ${clinic?.name ?? ''} · ${therapist?.name ?? ''} · ${formatTime(appt.start)}-${formatTime(appt.end)}`
          }}
        />
      </div>

      <div className="scheduleList">
        <div className="scheduleList__header">
          <p className="eyebrow">Reassignments</p>
          <p className="muted small">Searchable list with lifecycle + cancellation</p>
        </div>

        {!listView.length ? (
          <p className="muted small">No appointments in this range.</p>
        ) : (
          <div className="scheduleList__rows">
            {listView.map((appt) => {
              const therapist = therapistLookup[appt.therapistId]
              const clinic = clinicLookup[appt.clinicId]
              const options = therapists.map((candidate) => ({
                candidate,
                available: isTherapistEligible(candidate.id, appt.start, appt.end, appt.id),
              }))

              const isConflict = conflicts.has(appt.id)
              const cancelled = Boolean(appt.cancelledAt)

              const lastAudit = appt.audit[appt.audit.length - 1]
              const statusDelta = lastAudit && lastAudit.type === 'status-change' ? ` ${lastAudit.from?.status ?? ''}→${lastAudit.to?.status ?? ''}` : ''
              const lastAuditLabel = lastAudit ? `${new Date(lastAudit.at).toLocaleString()} · ${lastAudit.type}${statusDelta}` : ''
              const allowedStatuses = [appt.status, ...nextAllowedStatuses[appt.status]]
              const allowedStatusesUnique = Array.from(new Set(allowedStatuses))

              return (
                <div key={appt.id} className={cancelled ? 'scheduleList__row scheduleList__row--cancelled' : isConflict ? 'scheduleList__row scheduleList__row--conflict' : 'scheduleList__row'}>
                  <div className="scheduleList__who">
                    <div className="scheduleList__title">{appt.patient}</div>
                    <div className="muted small">{formatTime(appt.start)}-{formatTime(appt.end)} · {clinic.name} · {therapist.name} ({therapist.role})</div>
                    {lastAuditLabel && <div className="muted small">Last change: {lastAuditLabel}</div>}
                  </div>
                  <div className="scheduleList__badges">
                    <span className={`badge badge--${appt.type}`}>{appt.type === 'evaluation' ? 'Evaluation' : 'Follow-up'}</span>
                    <span className={`badge badge--status badge--status-${appt.status}`}>{appt.status}</span>
                    {cancelled && <span className="badge badge--cancelled">Cancelled</span>}
                    {isConflict && <span className="badge badge--conflict">Conflict</span>}
                  </div>
                  <div className="scheduleList__action">
                    <select
                      value={appt.status}
                      onChange={(e) => onUpdateStatus(appt.id, e.target.value as Appointment['status'])}
                      className="input scheduleList__select"
                      disabled={cancelled}
                      aria-label="Appointment status"
                      title="Status transitions are constrained to the allowed lifecycle"
                    >
                      {allowedStatusesUnique.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={appt.therapistId}
                      onChange={(e) => onReassign(appt.id, e.target.value)}
                      className="input scheduleList__select"
                      disabled={cancelled}
                      title="Reassign to a different resource (disabled options are unavailable)"
                    >
                      {options.map(({ candidate, available }) => (
                        <option key={candidate.id} value={candidate.id} disabled={!available}>
                          {candidate.name} · {candidate.role} ({clinicLookup[candidate.clinicId].name}){!available ? ' - unavailable' : ''}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="chip" onClick={() => onCancel(appt.id)} disabled={cancelled} title="Cancels the appointment (cannot be undone)">Cancel</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
