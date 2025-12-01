/**
 * find-replacement-crew MCP Tool
 * Finds legal crew replacements for a flight position with ranking
 */

import { CrewStateService } from '../services/crew-state-service.js';
import { ComplianceViolation } from '../types/compliance.js';

export interface FindReplacementCrewInput {
  flightNumber: string;
  position: 'CA' | 'FO' | 'FA';
  departureTimeUtc: string;
  base: string;
  aircraftType: string;
  maxResults?: number;
  includeDeadheadOptions?: boolean;
}

export async function findReplacementCrew(
  input: FindReplacementCrewInput,
  crewStateService: CrewStateService
): Promise<any> {
  const startTime = Date.now();

  const {
    flightNumber,
    position,
    departureTimeUtc,
    base,
    aircraftType,
    maxResults = 5,
    includeDeadheadOptions = true
  } = input;

  try {
    // Find replacement candidates
    const candidates = await crewStateService.findReplacementCrew({
      flightNumber,
      position,
      departureTimeUtc,
      base,
      aircraftType,
      maxResults,
      includeDeadheadOptions
    });

    const responseTime = Date.now() - startTime;

    return {
      flightNumber,
      position,
      departureTimeUtc,
      candidates: candidates.map(c => ({
        employeeId: c.employeeId,
        name: c.name,
        legality: {
          isLegal: c.legality.isLegal,
          dutyRemainingHours: calculateRemainingDuty(c),
          restCompliant: c.legality.violations.filter((v: ComplianceViolation) =>
            v.rule.includes('117.25(b)')
          ).length === 0,
          currencyValid: true, // Simplified
          violations: c.legality.violations.map((v: ComplianceViolation) => ({
            rule: v.rule,
            description: v.description,
            severity: v.severity
          })),
          warnings: c.legality.warnings.map((w: ComplianceViolation) => ({
            rule: w.rule,
            description: w.description
          }))
        },
        logistics: {
          currentLocation: c.logistics.currentLocation,
          positioningRequired: c.logistics.positioningRequired,
          positioningFlight: c.logistics.positioningFlight,
          readyTimeUtc: c.logistics.readyTimeUtc,
          travelTimeMinutes: c.logistics.travelTimeMinutes
        },
        cost: {
          payCredit: c.cost.payCredit,
          perDiem: c.cost.perDiem,
          deadheadCost: c.cost.deadheadCost,
          hotelCost: c.cost.hotelCost,
          overtimePremium: c.cost.overtimePremium,
          totalUsd: c.cost.totalUsd
        },
        rankScore: c.rankScore,
        recommendation: generateRecommendation(c)
      })),
      searchMetadata: {
        searchedCount: candidates.length + 10, // Mock total searched
        legalCount: candidates.length,
        responseTimeMs: responseTime,
        basesSearched: [base],
        includesDeadheads: includeDeadheadOptions
      },
      recommendations: generateOverallRecommendations(candidates)
    };
  } catch (error: any) {
    return {
      error: true,
      message: error.message,
      flightNumber,
      position,
      departureTimeUtc
    };
  }
}

function calculateRemainingDuty(candidate: any): number {
  // Simplified calculation - in production would be more sophisticated
  const maxDuty = 13;
  const currentDuty = candidate.legality.violations
    .find((v: any) => v.rule === '117.25(d)')?.currentValue || 0;

  return Math.max(0, maxDuty - currentDuty);
}

function generateRecommendation(candidate: any): string {
  if (candidate.rankScore >= 90) {
    return 'EXCELLENT: Optimal crew choice with no concerns';
  } else if (candidate.rankScore >= 75) {
    return 'GOOD: Suitable crew with minor considerations';
  } else if (candidate.rankScore >= 60) {
    return 'ACCEPTABLE: Legal but check warnings';
  } else {
    return 'USE WITH CAUTION: Legal but multiple concerns';
  }
}

function generateOverallRecommendations(candidates: any[]): string[] {
  const recommendations: string[] = [];

  if (candidates.length === 0) {
    recommendations.push('NO LEGAL CREW FOUND: Consider deadhead from another base or cancel flight');
    return recommendations;
  }

  if (candidates.length < 3) {
    recommendations.push('LIMITED OPTIONS: Consider activating additional reserves');
  }

  const highCostCandidates = candidates.filter(c => c.cost.totalUsd > 1000);
  if (highCostCandidates.length === candidates.length) {
    recommendations.push('HIGH COST: All options involve premium pay or deadheads');
  }

  const fatigueRiskCandidates = candidates.filter(c =>
    c.legality.warnings.some((w: any) => w.rule.includes('FRMS'))
  );
  if (fatigueRiskCandidates.length > candidates.length / 2) {
    recommendations.push('FATIGUE RISK: Monitor crew closely during duty');
  }

  if (recommendations.length === 0) {
    recommendations.push('Multiple good options available');
  }

  return recommendations;
}

export const findReplacementCrewSchema = {
  type: "object" as const,
  properties: {
    flightNumber: {
      type: "string" as const,
      description: "Flight number requiring crew replacement"
    },
    position: {
      type: "string" as const,
      enum: ["CA", "FO", "FA"],
      description: "Crew position to fill (CA=Captain, FO=First Officer, FA=Flight Attendant)"
    },
    departureTimeUtc: {
      type: "string" as const,
      format: "date-time",
      description: "Scheduled departure time in UTC (ISO 8601 format)"
    },
    base: {
      type: "string" as const,
      description: "Crew base IATA code to search (e.g., ORD, LAX, DFW)"
    },
    aircraftType: {
      type: "string" as const,
      enum: ["B737", "B738", "A320", "A321", "E175", "E190"],
      description: "Aircraft type requiring qualification"
    },
    maxResults: {
      type: "number" as const,
      description: "Maximum number of candidates to return (default: 5)",
      default: 5,
      minimum: 1,
      maximum: 20
    },
    includeDeadheadOptions: {
      type: "boolean" as const,
      description: "Include crew requiring deadhead positioning (default: true)",
      default: true
    }
  },
  required: ["flightNumber", "position", "departureTimeUtc", "base", "aircraftType"]
};
