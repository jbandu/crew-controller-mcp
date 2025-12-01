/**
 * calculate-delay-cascade MCP Tool
 * Calculates downstream crew impact of delays and disruptions
 */

import { CrewStateService } from '../services/crew-state-service.js';

export interface CalculateDelayCascadeInput {
  flightNumber: string;
  currentDelayMinutes: number;
  projectedDelayMinutes?: number;
  includeDownstreamFlights?: boolean;
}

export interface CascadeImpact {
  affectedCrewCount: number;
  affectedFlightsCount: number;
  crewImpacts: CrewImpact[];
  flightImpacts: FlightImpact[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedCostUsd: number;
}

export interface CrewImpact {
  employeeId: string;
  name: string;
  position: string;
  currentFlight: string;
  downstreamFlights: string[];
  risks: CrewRisk[];
  actionRequired: boolean;
  actionDeadline?: string;
}

export interface CrewRisk {
  type: 'timeout' | 'connection_miss' | 'rest_violation' | 'hotel_needed';
  severity: 'warning' | 'critical';
  description: string;
  timeToImpact?: number; // minutes
  mitigationOptions: string[];
}

export interface FlightImpact {
  flightNumber: string;
  departureTimeUtc: string;
  impactType: 'crew_late' | 'crew_timeout' | 'crew_missing';
  minutesToDeparture: number;
  affectedPositions: string[];
  contingencyNeeded: boolean;
}

export async function calculateDelayCascade(
  input: CalculateDelayCascadeInput,
  crewStateService: CrewStateService
): Promise<any> {
  const {
    flightNumber,
    currentDelayMinutes,
    projectedDelayMinutes = currentDelayMinutes,
    includeDownstreamFlights = true
  } = input;

  const now = new Date();
  const crewImpacts: CrewImpact[] = [];
  const flightImpacts: FlightImpact[] = [];
  const recommendations: string[] = [];

  // Get crew assigned to delayed flight
  const assignedCrew = crewStateService.getCrewByState('DUTY')
    .filter(state => state.assignedFlights.includes(flightNumber));

  if (assignedCrew.length === 0) {
    return {
      error: true,
      message: `No crew found assigned to flight ${flightNumber}`,
      flightNumber
    };
  }

  // Analyze impact on each crew member
  for (const crewState of assignedCrew) {
    const member = crewStateService['crewMembers'].get(crewState.employeeId);
    if (!member) continue;

    const risks: CrewRisk[] = [];
    let actionRequired = false;
    let actionDeadline: string | undefined;

    // Check duty timeout risk
    const stateEnd = new Date(crewState.stateEndUtc);
    const delayedEnd = new Date(stateEnd.getTime() + projectedDelayMinutes * 60 * 1000);
    const dutyHoursWithDelay = crewState.dutyHoursCumulative + (projectedDelayMinutes / 60);

    if (dutyHoursWithDelay > 13) {
      risks.push({
        type: 'timeout',
        severity: 'critical',
        description: `Crew will exceed 13-hour FDP limit by ${(dutyHoursWithDelay - 13).toFixed(1)} hours`,
        timeToImpact: Math.max(0, ((13 - crewState.dutyHoursCumulative) * 60)),
        mitigationOptions: [
          'Find replacement crew immediately',
          'Request FAA extension (if applicable)',
          'Cancel flight or remove crew'
        ]
      });
      actionRequired = true;
      actionDeadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 min to act
    } else if (dutyHoursWithDelay > 11.5) {
      risks.push({
        type: 'timeout',
        severity: 'warning',
        description: `Crew approaching FDP limit: ${dutyHoursWithDelay.toFixed(1)} of 13 hours`,
        timeToImpact: ((13 - dutyHoursWithDelay) * 60),
        mitigationOptions: [
          'Monitor closely',
          'Prepare backup crew',
          'Consider early replacement'
        ]
      });
    }

    // Check downstream connections (mock - would query actual schedule)
    const downstreamFlights = includeDownstreamFlights
      ? [`DOWNSTREAM1`, `DOWNSTREAM2`] // Mock
      : [];

    if (downstreamFlights.length > 0 && projectedDelayMinutes > 30) {
      risks.push({
        type: 'connection_miss',
        severity: 'warning',
        description: `Crew may miss ${downstreamFlights.length} downstream flights`,
        timeToImpact: projectedDelayMinutes,
        mitigationOptions: [
          'Swap crew for downstream flights',
          'Deadhead crew on faster connection',
          'Adjust downstream schedule'
        ]
      });

      // Add flight impacts
      downstreamFlights.forEach(dsf => {
        flightImpacts.push({
          flightNumber: dsf,
          departureTimeUtc: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // Mock: 4 hrs
          impactType: 'crew_late',
          minutesToDeparture: 240 - projectedDelayMinutes,
          affectedPositions: [member.position],
          contingencyNeeded: projectedDelayMinutes > 60
        });
      });
    }

    // Check if overnight hotel needed
    if (projectedDelayMinutes > 180) { // 3+ hour delay
      const localHour = new Date(delayedEnd).getUTCHours();
      if (localHour >= 22 || localHour < 6) {
        risks.push({
          type: 'hotel_needed',
          severity: 'warning',
          description: 'Crew will need overnight accommodations due to late arrival',
          mitigationOptions: [
            'Book hotel at destination',
            'Arrange ground transportation',
            'Coordinate with crew schedulers'
          ]
        });
      }
    }

    crewImpacts.push({
      employeeId: crewState.employeeId,
      name: `${member.lastName}, ${member.firstName}`,
      position: member.position,
      currentFlight: flightNumber,
      downstreamFlights,
      risks,
      actionRequired,
      actionDeadline
    });
  }

  // Generate recommendations
  const criticalRisks = crewImpacts.flatMap(ci => ci.risks).filter(r => r.severity === 'critical');
  const warningRisks = crewImpacts.flatMap(ci => ci.risks).filter(r => r.severity === 'warning');

  if (criticalRisks.length > 0) {
    recommendations.push(`CRITICAL: ${criticalRisks.length} crew member(s) will timeout - find replacements immediately`);
  }

  if (flightImpacts.length > 0) {
    recommendations.push(`${flightImpacts.length} downstream flights affected - prepare contingency crew`);
  }

  if (projectedDelayMinutes > 120) {
    recommendations.push('Consider canceling flight to preserve crew for downstream operations');
  }

  if (warningRisks.some(r => r.type === 'hotel_needed')) {
    recommendations.push('Coordinate with crew logistics for overnight accommodations');
  }

  // Calculate severity
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (criticalRisks.length > 0) severity = 'critical';
  else if (flightImpacts.length > 2) severity = 'high';
  else if (warningRisks.length > 2) severity = 'medium';

  // Estimate cost
  const estimatedCostUsd = calculateCascadeCost(crewImpacts, flightImpacts, projectedDelayMinutes);

  return {
    flightNumber,
    currentDelayMinutes,
    projectedDelayMinutes,
    affectedCrewCount: crewImpacts.length,
    affectedFlightsCount: flightImpacts.length,
    crewImpacts,
    flightImpacts,
    recommendations,
    severity,
    estimatedCostUsd,
    timestamp: new Date().toISOString(),
    actionRequiredBy: crewImpacts.some(ci => ci.actionRequired)
      ? crewImpacts.filter(ci => ci.actionRequired)[0].actionDeadline
      : undefined
  };
}

function calculateCascadeCost(
  crewImpacts: CrewImpact[],
  flightImpacts: FlightImpact[],
  delayMinutes: number
): number {
  let cost = 0;

  // Crew replacement costs
  const replacementNeeded = crewImpacts.filter(ci => ci.actionRequired).length;
  cost += replacementNeeded * 2000; // $2K per replacement (call-out, deadhead, etc.)

  // Downstream flight delays/cancellations
  const criticalFlights = flightImpacts.filter(fi => fi.contingencyNeeded).length;
  cost += criticalFlights * 5000; // $5K per disrupted flight

  // Hotel/logistics
  const hotelNeeded = crewImpacts.filter(ci =>
    ci.risks.some(r => r.type === 'hotel_needed')
  ).length;
  cost += hotelNeeded * 200; // $200 per hotel

  // Passenger compensation (EU261/DOT) - simplified
  if (delayMinutes > 180) {
    cost += 10000; // $10K estimate for pax compensation
  }

  return cost;
}

export const calculateDelayCascadeSchema = {
  type: "object" as const,
  properties: {
    flightNumber: {
      type: "string" as const,
      description: "Flight number experiencing delay"
    },
    currentDelayMinutes: {
      type: "number" as const,
      description: "Current delay in minutes"
    },
    projectedDelayMinutes: {
      type: "number" as const,
      description: "Projected total delay in minutes (default: same as current)"
    },
    includeDownstreamFlights: {
      type: "boolean" as const,
      description: "Analyze impact on downstream flights (default: true)",
      default: true
    }
  },
  required: ["flightNumber", "currentDelayMinutes"]
};
