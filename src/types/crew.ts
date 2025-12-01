/**
 * Core crew data types for crew-controller-mcp
 */

import { LegalityCheck } from './compliance.js';

export type CrewPosition = 'CA' | 'FO' | 'FA';
export type CrewStateType = 'DUTY' | 'REST' | 'RESERVE' | 'OFF' | 'SICK' | 'VACATION';
export type AircraftType = 'B737' | 'B738' | 'A320' | 'A321' | 'E175' | 'E190';

export interface CrewMember {
  employeeId: string;
  firstName: string;
  lastName: string;
  position: CrewPosition;
  base: string; // IATA code
  seniority: number;
  qualifications: CrewQualifications;
  contactInfo: ContactInfo;
}

export interface CrewQualifications {
  aircraftTypes: AircraftType[];
  currencies: Currency[];
  ratings: string[];
  languagesProficient: string[];
}

export interface Currency {
  type: 'LANDING' | 'INSTRUMENT' | 'TRAINING' | 'MEDICAL';
  expirationDate: string; // ISO 8601
  status: 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface ContactInfo {
  mobile: string;
  email: string;
  emergencyContact: string;
}

export interface CrewDutyState {
  employeeId: string;
  stateStartUtc: string; // ISO 8601
  stateEndUtc: string; // ISO 8601
  stateType: CrewStateType;
  currentLocation: string; // IATA code

  // Cumulative tracking for Part 117
  dutyHoursCumulative: number;
  restHoursCumulative: number;
  flightHoursMonth: number;
  flightHoursYear: number;

  // Fatigue risk
  lastWoclExposure?: string; // ISO 8601
  consecutiveDutyDays: number;

  // Current assignment
  assignedFlights: string[]; // Flight numbers
  reportTimeUtc?: string; // ISO 8601
}

export interface FlightDuty {
  flightNumber: string;
  origin: string; // IATA
  destination: string; // IATA
  scheduledDepartureUtc: string; // ISO 8601
  scheduledArrivalUtc: string; // ISO 8601
  actualDepartureUtc?: string; // ISO 8601
  actualArrivalUtc?: string; // ISO 8601
  aircraftType: AircraftType;
  requiredPositions: {
    CA: number;
    FO: number;
    FA: number;
  };
  assignedCrew: {
    position: CrewPosition;
    employeeId: string;
  }[];
}

export interface CrewReplacement {
  employeeId: string;
  name: string;
  legality: LegalityCheck;
  logistics: CrewLogistics;
  cost: CrewCost;
  rankScore: number; // 0-100, higher is better
}

export interface CrewLogistics {
  currentLocation: string; // IATA
  positioningRequired: boolean;
  positioningFlight?: string;
  readyTimeUtc: string; // ISO 8601
  travelTimeMinutes: number;
}

export interface CrewCost {
  payCredit: number; // Flight hours credited
  perDiem: number; // USD
  deadheadCost: number; // USD
  hotelCost: number; // USD
  overtimePremium: number; // USD
  totalUsd: number;
}

export interface ReservePool {
  base: string; // IATA
  position: CrewPosition;
  availableCrewIds: string[];
  utilizationPercent: number;
  nextAvailableUtc: string; // ISO 8601
}
