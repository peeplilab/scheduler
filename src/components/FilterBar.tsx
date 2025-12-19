import type { Clinic, StaffRole } from '../types'

type ViewMode = 'day' | 'week'

type FilterBarProps = {
  clinics: Clinic[]
  selectedClinics: string[]
  onClinicsChange: (ids: string[]) => void
  roleFilter: StaffRole | 'all'
  onRoleChange: (role: StaffRole | 'all') => void
  viewMode: ViewMode
  onViewModeChange: (view: ViewMode) => void
  dateStart: string
  dateEnd: string
  onDateStartChange: (value: string) => void
  onDateEndChange: (value: string) => void
}

export function FilterBar({
  clinics,
  selectedClinics,
  onClinicsChange,
  roleFilter,
  onRoleChange,
  viewMode,
  onViewModeChange,
  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
}: FilterBarProps) {
  const toggleClinic = (id: string) => {
    const exists = selectedClinics.includes(id)
    const next = exists ? selectedClinics.filter((c) => c !== id) : [...selectedClinics, id]
    onClinicsChange(next.length ? next : clinics.map((c) => c.id))
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Filters</p>
          <p className="muted">Multi-clinic, role, date window</p>
        </div>
        <div className="segmented">
          {(['day', 'week'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={mode === viewMode ? 'chip chip--active' : 'chip'}
              onClick={() => onViewModeChange(mode)}
              type="button"
            >
              {mode.toUpperCase()} view
            </button>
          ))}
        </div>
      </div>

      <div className="filter-grid">
        <div>
          <label className="label">Clinics</label>
          <div className="pill-row">
            {clinics.map((clinic) => (
              <button
                key={clinic.id}
                type="button"
                className={selectedClinics.includes(clinic.id) ? 'pill pill--selected' : 'pill'}
                onClick={() => toggleClinic(clinic.id)}
              >
                <span className="dot" style={{ backgroundColor: clinic.color }} />
                {clinic.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Staff role</label>
          <select
            value={roleFilter}
            onChange={(e) => onRoleChange(e.target.value as StaffRole | 'all')}
            className="input"
          >
            <option value="all">All roles</option>
            <option value="PT">Physical Therapy</option>
            <option value="OT">Occupational Therapy</option>
            <option value="Speech">Speech</option>
          </select>
        </div>

        <div>
          <label className="label">Date start</label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Date end</label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="input"
          />
        </div>
      </div>
    </div>
  )
}
