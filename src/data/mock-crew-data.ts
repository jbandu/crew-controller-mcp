/**
 * Mock crew data for testing and development
 */

import { CrewMember, CrewDutyState } from '../types/crew.js';

export const mockCrewMembers: CrewMember[] = [
  {
    employeeId: '10001',
    firstName: 'John',
    lastName: 'Smith',
    position: 'CA',
    base: 'ORD',
    seniority: 5200,
    qualifications: {
      aircraftTypes: ['B737', 'B738'],
      currencies: [
        {
          type: 'LANDING',
          expirationDate: '2025-06-01T00:00:00Z',
          status: 'CURRENT'
        },
        {
          type: 'MEDICAL',
          expirationDate: '2025-12-01T00:00:00Z',
          status: 'CURRENT'
        }
      ],
      ratings: ['ATP', 'B737'],
      languagesProficient: ['English']
    },
    contactInfo: {
      mobile: '+1-555-0101',
      email: 'john.smith@airline.com',
      emergencyContact: '+1-555-0102'
    }
  },
  {
    employeeId: '10002',
    firstName: 'Sarah',
    lastName: 'Johnson',
    position: 'FO',
    base: 'ORD',
    seniority: 3100,
    qualifications: {
      aircraftTypes: ['B737', 'B738'],
      currencies: [
        {
          type: 'LANDING',
          expirationDate: '2025-05-15T00:00:00Z',
          status: 'CURRENT'
        },
        {
          type: 'MEDICAL',
          expirationDate: '2025-11-01T00:00:00Z',
          status: 'CURRENT'
        }
      ],
      ratings: ['ATP', 'B737'],
      languagesProficient: ['English', 'Spanish']
    },
    contactInfo: {
      mobile: '+1-555-0201',
      email: 'sarah.johnson@airline.com',
      emergencyContact: '+1-555-0202'
    }
  },
  {
    employeeId: '10003',
    firstName: 'Michael',
    lastName: 'Chen',
    position: 'CA',
    base: 'ORD',
    seniority: 7800,
    qualifications: {
      aircraftTypes: ['B737', 'B738', 'A320'],
      currencies: [
        {
          type: 'LANDING',
          expirationDate: '2025-07-01T00:00:00Z',
          status: 'CURRENT'
        },
        {
          type: 'MEDICAL',
          expirationDate: '2026-01-01T00:00:00Z',
          status: 'CURRENT'
        }
      ],
      ratings: ['ATP', 'B737', 'A320'],
      languagesProficient: ['English', 'Mandarin']
    },
    contactInfo: {
      mobile: '+1-555-0301',
      email: 'michael.chen@airline.com',
      emergencyContact: '+1-555-0302'
    }
  },
  {
    employeeId: '10004',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    position: 'FA',
    base: 'ORD',
    seniority: 2400,
    qualifications: {
      aircraftTypes: ['B737', 'B738', 'A320', 'A321'],
      currencies: [
        {
          type: 'TRAINING',
          expirationDate: '2025-08-01T00:00:00Z',
          status: 'CURRENT'
        },
        {
          type: 'MEDICAL',
          expirationDate: '2025-10-01T00:00:00Z',
          status: 'CURRENT'
        }
      ],
      ratings: ['FA_CERTIFICATION'],
      languagesProficient: ['English', 'Spanish']
    },
    contactInfo: {
      mobile: '+1-555-0401',
      email: 'emily.rodriguez@airline.com',
      emergencyContact: '+1-555-0402'
    }
  },
  {
    employeeId: '10005',
    firstName: 'David',
    lastName: 'Williams',
    position: 'FO',
    base: 'ORD',
    seniority: 1800,
    qualifications: {
      aircraftTypes: ['B737'],
      currencies: [
        {
          type: 'LANDING',
          expirationDate: '2025-04-01T00:00:00Z',
          status: 'CURRENT'
        },
        {
          type: 'MEDICAL',
          expirationDate: '2025-09-01T00:00:00Z',
          status: 'CURRENT'
        }
      ],
      ratings: ['ATP', 'B737'],
      languagesProficient: ['English']
    },
    contactInfo: {
      mobile: '+1-555-0501',
      email: 'david.williams@airline.com',
      emergencyContact: '+1-555-0502'
    }
  }
];

export const mockCrewStates: CrewDutyState[] = [
  {
    employeeId: '10001',
    stateStartUtc: '2024-12-01T06:00:00Z',
    stateEndUtc: '2024-12-01T18:00:00Z',
    stateType: 'DUTY',
    currentLocation: 'DFW',
    dutyHoursCumulative: 45.5,
    restHoursCumulative: 72.0,
    flightHoursMonth: 62.3,
    flightHoursYear: 745.8,
    lastWoclExposure: '2024-11-28T04:00:00Z',
    consecutiveDutyDays: 3,
    assignedFlights: ['AA1234', 'AA1235'],
    reportTimeUtc: '2024-12-01T05:00:00Z'
  },
  {
    employeeId: '10002',
    stateStartUtc: '2024-12-01T08:00:00Z',
    stateEndUtc: '2024-12-01T20:00:00Z',
    stateType: 'RESERVE',
    currentLocation: 'ORD',
    dutyHoursCumulative: 28.2,
    restHoursCumulative: 96.0,
    flightHoursMonth: 38.5,
    flightHoursYear: 512.3,
    consecutiveDutyDays: 2,
    assignedFlights: []
  },
  {
    employeeId: '10003',
    stateStartUtc: '2024-12-01T00:00:00Z',
    stateEndUtc: '2024-12-02T00:00:00Z',
    stateType: 'OFF',
    currentLocation: 'ORD',
    dutyHoursCumulative: 52.1,
    restHoursCumulative: 48.0,
    flightHoursMonth: 71.2,
    flightHoursYear: 892.5,
    consecutiveDutyDays: 0,
    assignedFlights: []
  },
  {
    employeeId: '10004',
    stateStartUtc: '2024-12-01T06:00:00Z',
    stateEndUtc: '2024-12-01T22:00:00Z',
    stateType: 'RESERVE',
    currentLocation: 'ORD',
    dutyHoursCumulative: 32.8,
    restHoursCumulative: 84.0,
    flightHoursMonth: 45.7,
    flightHoursYear: 598.3,
    consecutiveDutyDays: 1,
    assignedFlights: []
  },
  {
    employeeId: '10005',
    stateStartUtc: '2024-12-01T10:00:00Z',
    stateEndUtc: '2024-12-01T22:00:00Z',
    stateType: 'RESERVE',
    currentLocation: 'ORD',
    dutyHoursCumulative: 18.5,
    restHoursCumulative: 120.0,
    flightHoursMonth: 22.3,
    flightHoursYear: 345.6,
    consecutiveDutyDays: 1,
    assignedFlights: []
  }
];
