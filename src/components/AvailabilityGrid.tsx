import type { Appointment, Clinic, Therapist, TimeAway } from '../types'
import { formatDay, formatTime, overlaps, parseISO, formatDateInput } from '../utils/schedule'

type AvailabilityStatus = 'available' | 'booked' | 'time-off' | 'off'

type Segment = {
  startMin: number
  endMin: number
  status: AvailabilityStatus
  label?: string
  sublabel?: string
}

const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

const atDate = (dateISO: string, minutes: number) => {
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  return parseISO(`${dateISO}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`)
}

const resolveSlot = (
  therapist: Therapist,
  dateISO: string,
  startMin: number,
  endMin: number,
  appts: Appointment[],
  away: TimeAway[],
): { status: AvailabilityStatus; label?: string; sublabel?: string } => {
  const start = atDate(dateISO, startMin)
  const end = atDate(dateISO, endMin)

  if (!therapist.workingHours.days.includes(start.getDay())) return { status: 'off' }

  const windowStart = toMinutes(therapist.workingHours.start)
  const windowEnd = toMinutes(therapist.workingHours.end)
  if (startMin < windowStart || endMin > windowEnd) return { status: 'off' }

  const awayHit = away.find((slot) => {
    if (slot.therapistId !== therapist.id || slot.date !== dateISO) return false
    return overlaps(start, end, atDate(dateISO, toMinutes(slot.start)), atDate(dateISO, toMinutes(slot.end)))
  })
  if (awayHit) return { status: 'time-off', label: 'Time off', sublabel: awayHit.reason }

  const apptHit = appts.find((appt) => {
    if (appt.cancelledAt) return false
    if (appt.therapistId !== therapist.id) return false
    return overlaps(start, end, parseISO(appt.start), parseISO(appt.end))
  })
  if (apptHit) {
    return {
      status: 'booked',
      label: apptHit.type === 'evaluation' ? 'Eval' : 'Follow-up',
      sublabel: apptHit.patient,
    }
  }

  return { status: 'available', label: 'Available' }
}

const buildSegments = (
  therapist: Therapist,
  dateISO: string,
  rangeStartMin: number,
  rangeEndMin: number,
  stepMin: number,
  appts: Appointment[],
  away: TimeAway[],
) => {
  const segments: Segment[] = []

  for (let cursor = rangeStartMin; cursor < rangeEndMin; cursor += stepMin) {
    const slot = resolveSlot(therapist, dateISO, cursor, cursor + stepMin, appts, away)
    const prev = segments[segments.length - 1]

    if (
      prev &&
      prev.status === slot.status &&
      prev.label === slot.label &&
      prev.sublabel === slot.sublabel &&
      prev.endMin === cursor
    ) {
      prev.endMin += stepMin
    } else {
      segments.push({
        startMin: cursor,
        endMin: cursor + stepMin,
        status: slot.status,
        label: slot.label,
        sublabel: slot.sublabel,
      })
    }
  }

  return segments
}

type AvailabilityGridProps = {
  dates: Date[]
  therapists: Therapist[]
  appointments: Appointment[]
  timeAway: TimeAway[]
  clinics: Clinic[]
  selectedTherapistId: string
  onSelectedTherapistIdChange: (id: string) => void
}

export function AvailabilityGrid({
  dates,
  therapists,
  appointments,
  timeAway,
  clinics,
  selectedTherapistId,
  onSelectedTherapistIdChange,
}: AvailabilityGridProps) {
  const rangeStartMinutes = 7 * 60
  const rangeEndMinutes = 18 * 60
  const pxPerMinute = 1.05
  const stepMinutes = 30

  if (!therapists.length) {
    return (
      <div className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Therapist availability</p>
            <p className="muted">No therapists match current filters.</p>
          </div>
        </div>
      </div>
    )
  }

  const selected = therapists.find((t) => t.id === selectedTherapistId) ?? therapists[0]
  const clinicLookup = Object.fromEntries(clinics.map((c) => [c.id, c]))
  const assignedClinic = clinicLookup[selected.clinicId]

  const heightPx = (rangeEndMinutes - rangeStartMinutes) * pxPerMinute

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Therapist availability</p>
          <p className="muted">Pick a therapist and see availability by time slot</p>
        </div>
      </div>

      <div className="availabilityPicker">
        <div>
          <label className="label">Therapist</label>
          <select
            value={selected.id}
            onChange={(e) => onSelectedTherapistIdChange(e.target.value)}
            className="input"
          >
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.role} ({clinicLookup[t.clinicId]?.name ?? 'Unknown clinic'})
              </option>
            ))}
          </select>
        </div>
        <div className="availabilityPicker__meta">
          <div className="muted small">Assigned clinic</div>
          <div className="availabilityPicker__clinic">
            <span className="schedule__clinicDot" style={{ backgroundColor: assignedClinic?.color ?? 'transparent' }} />
            <span>{assignedClinic?.name ?? 'Unknown'}</span>
          </div>
          <div className="muted small">Working hours</div>
          <div className="small">{selected.workingHours.start}-{selected.workingHours.end}</div>
        </div>
      </div>

      <div className="availability">
        <div className="availability__legend">
          <span className="legend legend--available">Available</span>
          <span className="legend legend--booked">Booked</span>
          <span className="legend legend--time-off">Time-off</span>
          <span className="legend legend--off">Off</span>
        </div>

        <div className="availabilityTimeline">
          <div className="availabilityTimeline__header">
            <div className="schedule__corner">Time</div>
            {dates.map((d) => (
              <div key={d.toISOString()} className="schedule__dayHeader">
                {formatDay(d)}
              </div>
            ))}
          </div>

          <div className="availabilityTimeline__body">
            <div className="schedule__gutter" style={{ height: heightPx }}>
              {Array.from(
                { length: Math.floor((rangeEndMinutes - rangeStartMinutes) / 60) + 1 },
                (_, idx) => rangeStartMinutes + idx * 60,
              ).map((min) => (
                <div
                  key={min}
                  className="schedule__timeMark"
                  style={{ top: (min - rangeStartMinutes) * pxPerMinute }}
                >
                  {String(Math.floor(min / 60)).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {dates.map((d) => {
              const dateISO = formatDateInput(d)
              const segments = buildSegments(
                selected,
                dateISO,
                rangeStartMinutes,
                rangeEndMinutes,
                stepMinutes,
                appointments,
                timeAway,
              )

              return (
                <div key={d.toISOString()} className="availabilityTimeline__day" style={{ height: heightPx }}>
                  {Array.from(
                    { length: Math.floor((rangeEndMinutes - rangeStartMinutes) / 60) + 1 },
                    (_, idx) => rangeStartMinutes + idx * 60,
                  ).map((min) => (
                    <div
                      key={min}
                      className="schedule__line"
                      style={{ top: (min - rangeStartMinutes) * pxPerMinute }}
                    />
                  ))}

                  {segments.map((seg) => (
                    <div
                      key={`${seg.startMin}-${seg.status}-${seg.label ?? ''}-${seg.sublabel ?? ''}`}
                      className={`availabilityTimeline__segment availabilityTimeline__segment--${seg.status}`}
                      style={{
                        top: (seg.startMin - rangeStartMinutes) * pxPerMinute,
                        height: Math.max((seg.endMin - seg.startMin) * pxPerMinute, 10),
                      }}
                    >
                      {seg.status === 'booked' && (
                        <div className="availabilityTimeline__segmentLabel">
                          <span className={seg.label === 'Eval' ? 'badge badge--evaluation' : 'badge badge--followup'}>
                            {seg.label}
                          </span>
                          <span className="muted small">{seg.sublabel}</span>
                        </div>
                      )}
                      {seg.status === 'time-off' && (
                        <div className="availabilityTimeline__segmentLabel">
                          <span className="badge badge--conflict">Time off</span>
                          <span className="muted small">{seg.sublabel}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        <div className="availabilityAppts">
          <p className="eyebrow">Booked appointments</p>
          <div className="availabilityAppts__rows">
            {[...appointments]
              .filter((a) => a.therapistId === selected.id)
              .filter((a) => !a.cancelledAt)
              .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
              .map((a) => {
                const clinic = clinicLookup[a.clinicId]
                return (
                  <div key={a.id} className="availabilityAppts__row">
                    <div>
                      <div className="availabilityAppts__title">{a.patient}</div>
                      <div className="muted small">
                        {formatTime(a.start)}-{formatTime(a.end)} · {clinic?.name ?? 'Unknown clinic'}
                      </div>
                    </div>
                    <div>
                      <span className={`badge badge--${a.type}`}>{a.type === 'evaluation' ? 'Evaluation' : 'Follow-up'}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
