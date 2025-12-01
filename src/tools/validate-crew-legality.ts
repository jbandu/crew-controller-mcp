/**
 * validate-crew-legality MCP Tool
 * Real-time FAA Part 117 and CBA compliance checking
 */

import { CrewStateService } from '../services/crew-state-service.js';
import { LegalityEngine } from '../services/legality-engine.js';
import { DutyPeriod } from '../types/compliance.js';

export interface ValidateCrewLegalityInput {
  employeeId: string;
  proposedDuty: {
    flights: Array<{
      flightNumber: string;
      departureUtc: string;
      arrivalUtc: string;
      origin: string;
      destination: string;
      flightTimeHours: number;
    }>;
    startTimeUtc: string;
    endTimeUtc: string;
    reportTimeUtc: string;
  };
  checkCategories?: string[];
}

export async function validateCrewLegality(
  input: ValidateCrewLegalityInput,
  crewStateService: CrewStateService
): Promise<any> {
  const { employeeId, proposedDuty, checkCategories = ['part117', 'fatigue_risk'] } = input;

  // Get current crew state
  const crewState = crewStateService.getCrewStatus(employeeId);
  if (!crewState) {
    return {
      error: true,
      message: `Crew member ${employeeId} not found`,
      isLegal: false
    };
  }

  // Calculate total duty and flight hours
  const totalFlightHours = proposedDuty.flights.reduce(
    (sum, flight) => sum + flight.flightTimeHours,
    0
  );

  const startTime = new Date(proposedDuty.startTimeUtc);
  const endTime = new Date(proposedDuty.endTimeUtc);
  const totalDutyHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

  // Create DutyPeriod object
  const dutyPeriod: DutyPeriod = {
    startTimeUtc: proposedDuty.startTimeUtc,
    endTimeUtc: proposedDuty.endTimeUtc,
    reportTimeUtc: proposedDuty.reportTimeUtc,
    releaseTimeUtc: proposedDuty.endTimeUtc,
    flights: proposedDuty.flights.map(f => ({
      flightNumber: f.flightNumber,
      departureUtc: f.departureUtc,
      arrivalUtc: f.arrivalUtc,
      flightTimeHours: f.flightTimeHours,
      origin: f.origin,
      destination: f.destination
    })),
    totalDutyHours,
    totalFlightHours
  };

  // Validate using legality engine
  const legalityEngine = new LegalityEngine();
  const result = legalityEngine.validateDuty(crewState, dutyPeriod, checkCategories);

  return {
    employeeId,
    isLegal: result.isLegal,
    violations: result.violations,
    warnings: result.warnings,
    checksPerformed: result.checksPerformed,
    crewCurrentState: {
      location: crewState.currentLocation,
      stateType: crewState.stateType,
      dutyHoursMonth: crewState.dutyHoursCumulative,
      flightHoursMonth: crewState.flightHoursMonth,
      consecutiveDutyDays: crewState.consecutiveDutyDays
    },
    proposedDutyHours: totalDutyHours,
    proposedFlightHours: totalFlightHours,
    timestamp: result.timestamp,
    auditLogId: result.auditLogId
  };
}

export const validateCrewLegalitySchema = {
  type: "object" as const,
  properties: {
    employeeId: {
      type: "string" as const,
      description: "Unique identifier for the crew member"
    },
    proposedDuty: {
      type: "object" as const,
      properties: {
        flights: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              flightNumber: { type: "string" as const },
              departureUtc: { type: "string" as const, format: "date-time" },
              arrivalUtc: { type: "string" as const, format: "date-time" },
              origin: { type: "string" as const, description: "IATA airport code" },
              destination: { type: "string" as const, description: "IATA airport code" },
              flightTimeHours: { type: "number" as const }
            },
            required: ["flightNumber", "departureUtc", "arrivalUtc", "origin", "destination", "flightTimeHours"]
          }
        },
        startTimeUtc: { type: "string" as const, format: "date-time" },
        endTimeUtc: { type: "string" as const, format: "date-time" },
        reportTimeUtc: { type: "string" as const, format: "date-time" }
      },
      required: ["flights", "startTimeUtc", "endTimeUtc", "reportTimeUtc"]
    },
    checkCategories: {
      type: "array" as const,
      items: {
        type: "string" as const,
        enum: ["part117", "cba", "fatigue_risk", "currency", "monthly_limits"]
      },
      description: "Categories of compliance checks to perform",
      default: ["part117", "fatigue_risk"]
    }
  },
  required: ["employeeId", "proposedDuty"]
};
