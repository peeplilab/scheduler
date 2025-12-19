# Scheduler (React + TypeScript + Vite)

Frontend-only scheduling cockpit with mocked data. Shows multi-clinic calendar, therapist availability grid, and conflict-aware reassignment.

## Features

- Multi-clinic day/week calendar with filters by clinic, role, and date range
- Appointment type badges (evaluation vs follow-up) and conflict highlights to prevent double booking
- Therapist availability grid that respects working hours and time-off
- In-memory mock data for clinics, therapists, appointments, and time-away slots
- Temporary cross-clinic reassignment of therapists with availability checks

## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - type-check and build
- `npm run preview` - preview production build
- `npm run lint` - eslint

No backend or API calls; all state is in memory.
