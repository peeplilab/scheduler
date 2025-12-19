import { useEffect, useMemo, useState } from 'react'
import './index.css'
import './App.css'
import { AvailabilityGrid } from './components/AvailabilityGrid'
import { CalendarView } from './components/Calendar'
import { FilterBar } from './components/FilterBar'
import { clinics, therapists, timeAway } from './mockData'
import { createLocalSchedulerApi } from './api/localSchedulerApi'
import { useSchedulerPolling } from './hooks/useSchedulerPolling'
import { addDays, detectConflicts, buildRange, formatDateInput, isTherapistAvailable, withinDateRange } from './utils/schedule'
import type { Appointment, StaffRole } from './types'

type ViewMode = 'day' | 'week'

function App() {
  const api = useMemo(() => createLocalSchedulerApi(), [])
  const [selectedClinics, setSelectedClinics] = useState<string[]>(clinics.map((clinic) => clinic.id))
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [dateStart, setDateStart] = useState(() => formatDateInput(new Date()))
  const [dateEnd, setDateEnd] = useState(() => formatDateInput(addDays(new Date(), 6)))
  const [feedback, setFeedback] = useState<string>('')
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(() => therapists[0]?.id ?? '')
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false)

  const { snapshot, error, refresh } = useSchedulerPolling({ api, rangeStart: dateStart, rangeEnd: dateEnd })
  const appointments: Appointment[] = snapshot?.appointments ?? []

  const filteredAppointments = useMemo(() => {
    const clinicFiltered = appointments.filter((appt) => selectedClinics.includes(appt.clinicId))
    const roleFiltered =
      roleFilter === 'all'
        ? clinicFiltered
        : clinicFiltered.filter((appt) => {
            const therapist = therapists.find((t) => t.id === appt.therapistId)
            return therapist?.role === roleFilter
          })
    return roleFiltered.filter((appt) => withinDateRange(appt.start, dateStart, dateEnd))
  }, [appointments, dateEnd, dateStart, roleFilter, selectedClinics])

  const scopedTherapists = useMemo(() => {
    const visibleIds = new Set<string>()
    filteredAppointments.forEach((appt) => visibleIds.add(appt.therapistId))

    const base = therapists.filter(
      (therapist) => selectedClinics.includes(therapist.clinicId) || visibleIds.has(therapist.id),
    )
    return roleFilter === 'all' ? base : base.filter((t) => t.role === roleFilter)
  }, [filteredAppointments, roleFilter, selectedClinics])

  useEffect(() => {
    if (!scopedTherapists.length) return
    const exists = scopedTherapists.some((t) => t.id === selectedTherapistId)
    if (!exists) {
      setSelectedTherapistId(scopedTherapists[0].id)
    }
  }, [scopedTherapists, selectedTherapistId])

  const days = useMemo(() => buildRange(dateStart, dateEnd, viewMode), [dateEnd, dateStart, viewMode])
  const conflicts = useMemo(() => detectConflicts(filteredAppointments), [filteredAppointments])

  const safeSetDateEnd = (value: string) => {
    if (value < dateStart) {
      setDateStart(value)
    }
    setDateEnd(value)
  }

  const safeSetDateStart = (value: string) => {
    setDateStart(value)
    if (value > dateEnd) {
      setDateEnd(value)
    }
  }

  const handleReassign = async (appointmentId: string, therapistId: string) => {
    try {
      const target = appointments.find((appt) => appt.id === appointmentId)
      if (!target) return
      if (target.therapistId === therapistId) return

      const therapist = therapists.find((t) => t.id === therapistId)
      if (!therapist) return

      const remaining = appointments.filter((appt) => appt.id !== appointmentId)
      const canAssign = isTherapistAvailable(therapist, target.start, target.end, remaining, timeAway)
      if (!canAssign) {
        setFeedback(`${therapist.name} is not available for that time window.`)
        return
      }

      await api.reassignAppointment(appointmentId, therapistId)
      setFeedback(`Reassigned to ${therapist.name} (${therapist.role})`)
      refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to reassign appointment'
      setFeedback(message)
    }
  }

  const therapistEligible = (
    therapistId: string,
    start: string,
    end: string,
    ignoreAppointmentId?: string,
  ) => {
    const therapist = therapists.find((t) => t.id === therapistId)
    if (!therapist) return false
    const remaining = appointments.filter(
      (appt) => appt.therapistId === therapistId && appt.id !== ignoreAppointmentId,
    )
    return isTherapistAvailable(therapist, start, end, remaining, timeAway)
  }

  const filterSummary = useMemo(() => {
    const clinicLabel =
      selectedClinics.length === clinics.length
        ? 'All clinics'
        : `${selectedClinics.length}/${clinics.length} clinics`
    const roleLabel = roleFilter === 'all' ? 'All roles' : roleFilter
    return `${clinicLabel} · ${roleLabel} · ${dateStart} to ${dateEnd} · ${viewMode.toUpperCase()}`
  }, [dateEnd, dateStart, roleFilter, selectedClinics.length, viewMode])

  return (
    <div className="page">
      <header className="hero">
        <div className="topbar">
          <div>
            <p className="eyebrow">Scheduler</p>
            <h1>Multi-clinic scheduling + therapist availability</h1>
            <p className="muted small">{filterSummary}</p>
          </div>
          <div className="topbar__actions">
            <button className="chip chip--active" type="button" onClick={() => setFiltersOpen(true)} title="Filter by clinic, role, date range, and view">
              Filters
            </button>
          </div>
        </div>
        {(feedback || error) && (
          <div className="alert">
            {error ? `${error}` : ''}
            {feedback ? ` ${feedback}` : ''}
          </div>
        )}
      </header>

      {filtersOpen && (
        <div
          className="drawerOverlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFiltersOpen(false)
          }}
        >
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="drawer__header">
              <div>
                <p className="eyebrow">Filters</p>
                <p className="muted small">Clinics, roles, date range, view</p>
              </div>
              <button className="chip" type="button" onClick={() => setFiltersOpen(false)}>
                Close
              </button>
            </div>
            <div className="drawer__body">
              <FilterBar
                clinics={clinics}
                selectedClinics={selectedClinics}
                onClinicsChange={setSelectedClinics}
                roleFilter={roleFilter}
                onRoleChange={setRoleFilter}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                dateStart={dateStart}
                dateEnd={dateEnd}
                onDateStartChange={safeSetDateStart}
                onDateEndChange={safeSetDateEnd}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="layout">
        <CalendarView
          dates={days}
          appointments={filteredAppointments}
          therapists={therapists}
          clinics={clinics}
          conflicts={conflicts}
          viewMode={viewMode}
          timeAway={timeAway}
          onReassign={handleReassign}
          isTherapistEligible={therapistEligible}
          onCreate={async (input) => {
            try {
              await api.createAppointment(input)
              setFeedback('Appointment created')
              refresh()
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Failed to create appointment'
              setFeedback(message)
            }
          }}
          onReschedule={async (id, start, end) => {
            try {
              await api.rescheduleAppointment(id, start, end)
              setFeedback('Appointment rescheduled')
              refresh()
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Failed to reschedule appointment'
              setFeedback(message)
            }
          }}
          onCancel={async (id) => {
            try {
              await api.cancelAppointment(id)
              setFeedback('Appointment cancelled')
              refresh()
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Failed to cancel appointment'
              setFeedback(message)
            }
          }}
          onUpdateStatus={async (id, status) => {
            try {
              await api.updateAppointmentStatus(id, status)
              setFeedback('Status updated')
              refresh()
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Failed to update status'
              setFeedback(message)
            }
          }}
        />

        <AvailabilityGrid
          dates={days}
          therapists={scopedTherapists}
          appointments={appointments}
          timeAway={timeAway}
          clinics={clinics}
          selectedTherapistId={selectedTherapistId}
          onSelectedTherapistIdChange={setSelectedTherapistId}
        />
      </div>
    </div>
  )
}

export default App
