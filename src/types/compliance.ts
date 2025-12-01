/**
 * FAA Part 117 and compliance types
 */

export type ViolationSeverity = 'blocking' | 'warning' | 'advisory';
export type ComplianceCategory = 'part117' | 'cba' | 'fatigue_risk' | 'currency' | 'monthly_limits';

export interface LegalityCheck {
  isLegal: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceViolation[];
  checksPerformed: ComplianceCategory[];
  timestamp: string; // ISO 8601
  auditLogId?: string;
}

export interface ComplianceViolation {
  category: ComplianceCategory;
  rule: string; // e.g., "117.25(d)" for Part 117 rules
  description: string;
  severity: ViolationSeverity;
  currentValue?: number;
  limitValue?: number;
  recommendation?: string;
}

export interface Part117Limits {
  // Flight Duty Period limits
  maxFlightDutyPeriod: number; // hours, varies by acclimatization and start time
  maxFlightTime: number; // hours within FDP

  // Rest requirements
  minRestPeriod: number; // hours, typically 10
  extendedRestPeriod: number; // hours, typically 12 for consecutive nights

  // Cumulative limits
  maxFlightHours28Days: number; // 100 hours domestic, 60 for Part 121
  maxFlightHours365Days: number; // 1000 hours domestic
  maxDutyHours168Hours: number; // 60 hours in 168 consecutive hours

  // WOCL considerations
  woclStart: string; // Local time, e.g., "02:00"
  woclEnd: string; // Local time, e.g., "06:00"
}

export interface DutyPeriod {
  startTimeUtc: string; // ISO 8601
  endTimeUtc: string; // ISO 8601
  reportTimeUtc: string; // ISO 8601
  releaseTimeUtc: string; // ISO 8601
  flights: FlightSegment[];
  totalDutyHours: number;
  totalFlightHours: number;
}

export interface FlightSegment {
  flightNumber: string;
  departureUtc: string; // ISO 8601
  arrivalUtc: string; // ISO 8601
  flightTimeHours: number;
  origin: string; // IATA
  destination: string; // IATA
}

export interface FatigueRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  factors: FatigueRiskFactor[];
  score: number; // 0-100
  recommendation: string;
}

export interface FatigueRiskFactor {
  factor: string; // e.g., "WOCL_EXPOSURE", "CONSECUTIVE_DUTY_DAYS"
  impact: 'low' | 'medium' | 'high';
  description: string;
  mitigations: string[];
}
