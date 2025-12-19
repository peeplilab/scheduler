import type {
  Appointment,
  AppointmentMode,
  AppointmentStatus,
  AppointmentType,
  Clinic,
  StaffRole,
  Therapist,
  TimeAway,
} from './types'

export const clinics: Clinic[] = [
  { id: 'c1', name: 'Redwood Clinic', color: '#0ea5e9', location: 'North' },
  { id: 'c2', name: 'Bayview Therapy', color: '#f59e0b', location: 'Central' },
  { id: 'c3', name: 'Summit Rehab', color: '#22c55e', location: 'East' },
]

export const staffRoles: StaffRole[] = ['PT', 'OT', 'Speech']

export const therapists: Therapist[] = [
  {
    id: 't1',
    name: 'Alex Morgan',
    role: 'PT',
    clinicId: 'c1',
    workingHours: { start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5] },
  },
  {
    id: 't2',
    name: 'Priya Desai',
    role: 'PT',
    clinicId: 'c2',
    workingHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
  },
  {
    id: 't3',
    name: 'Sofia Bennett',
    role: 'OT',
    clinicId: 'c3',
    workingHours: { start: '10:00', end: '18:00', days: [1, 2, 3, 4, 5] },
  },
  {
    id: 't4',
    name: 'Marcus Lee',
    role: 'Speech',
    clinicId: 'c1',
    workingHours: { start: '08:00', end: '15:00', days: [1, 2, 3, 4, 5] },
  },
  {
    id: 't5',
    name: 'Jamie Flores',
    role: 'PT',
    clinicId: 'c3',
    workingHours: { start: '07:00', end: '12:00', days: [1, 2, 3, 4, 5] },
  },
]

const toISO = (date: string, time: string) => `${date}T${time}:00`

const seededBy = 'seed'
const seededUpdatedAt = toISO('2025-01-01', '00:00')

const seedStatus: AppointmentStatus = 'scheduled'
const seedMode: AppointmentMode = 'in-clinic'

export const appointments: Appointment[] = [
  {
    id: 'a1',
    clinicId: 'c1',
    therapistId: 't1',
    patient: 'D. Carter',
    start: toISO('2025-01-13', '09:00'),
    end: toISO('2025-01-13', '10:00'),
    type: 'evaluation',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-13', '09:00'), end: toISO('2025-01-13', '10:00'), status: seedStatus },
      },
    ],
  },
  {
    id: 'a2',
    clinicId: 'c1',
    therapistId: 't1',
    patient: 'R. Patel',
    start: toISO('2025-01-13', '09:30'),
    end: toISO('2025-01-13', '10:30'),
    type: 'followup',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-13', '09:30'), end: toISO('2025-01-13', '10:30'), status: seedStatus },
      },
    ],
  },
  {
    id: 'a3',
    clinicId: 'c2',
    therapistId: 't2',
    patient: 'M. Young',
    start: toISO('2025-01-14', '11:00'),
    end: toISO('2025-01-14', '12:00'),
    type: 'evaluation',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-14', '11:00'), end: toISO('2025-01-14', '12:00'), status: seedStatus },
      },
    ],
  },
  {
    id: 'a4',
    clinicId: 'c3',
    therapistId: 't3',
    patient: 'S. Hill',
    start: toISO('2025-01-15', '14:00'),
    end: toISO('2025-01-15', '15:30'),
    type: 'followup',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-15', '14:00'), end: toISO('2025-01-15', '15:30'), status: seedStatus },
      },
    ],
  },
  {
    id: 'a5',
    clinicId: 'c1',
    therapistId: 't4',
    patient: 'A. Kim',
    start: toISO('2025-01-15', '10:00'),
    end: toISO('2025-01-15', '11:00'),
    type: 'evaluation',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-15', '10:00'), end: toISO('2025-01-15', '11:00'), status: seedStatus },
      },
    ],
  },
  {
    id: 'a6',
    clinicId: 'c2',
    therapistId: 't2',
    patient: 'L. Brooks',
    start: toISO('2025-01-16', '15:00'),
    end: toISO('2025-01-16', '16:30'),
    type: 'followup',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-16', '15:00'), end: toISO('2025-01-16', '16:30'), status: seedStatus },
      },
    ],
  },
  {
    id: 'a7',
    clinicId: 'c1',
    therapistId: 't5',
    patient: 'C. Nguyen',
    start: toISO('2025-01-16', '09:30'),
    end: toISO('2025-01-16', '10:00'),
    type: 'followup',

    mode: seedMode,
    status: seedStatus,
    createdBy: seededBy,
    updatedAt: seededUpdatedAt,
    audit: [
      {
        at: seededUpdatedAt,
        by: seededBy,
        type: 'created',
        to: { start: toISO('2025-01-16', '09:30'), end: toISO('2025-01-16', '10:00'), status: seedStatus },
      },
    ],
  },
]

export const timeAway: TimeAway[] = [
  { id: 'away1', therapistId: 't2', date: '2025-01-16', start: '13:00', end: '14:30', reason: 'Training' },
  { id: 'away2', therapistId: 't3', date: '2025-01-14', start: '10:00', end: '12:00', reason: 'Outreach' },
  { id: 'away3', therapistId: 't4', date: '2025-01-17', start: '09:00', end: '11:00', reason: 'Time off' },
]

export const appointmentTypes: AppointmentType[] = ['evaluation', 'followup']
