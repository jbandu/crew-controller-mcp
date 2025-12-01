/**
 * get-crew-status-realtime MCP Tool
 * Retrieves current duty state and availability for crew members
 */

import { CrewStateService } from '../services/crew-state-service.js';

export interface GetCrewStatusInput {
  employeeId?: string;
  location?: string;
  stateType?: string;
  position?: string;
  includeUpcoming?: boolean;
}

export async function getCrewStatusRealtime(
  input: GetCrewStatusInput,
  crewStateService: CrewStateService
): Promise<any> {
  const { employeeId, location, stateType, position, includeUpcoming = false } = input;

  // Single crew member query
  if (employeeId) {
    const state = crewStateService.getCrewStatus(employeeId);
    if (!state) {
      return {
        error: true,
        message: `Crew member ${employeeId} not found`
      };
    }

    return {
      crew: [formatCrewStatus(state)],
      count: 1,
      timestamp: new Date().toISOString()
    };
  }

  // Location-based query
  if (location) {
    const crewAtLocation = crewStateService.getCrewAtLocation(location);
    return {
      crew: crewAtLocation.map(formatCrewStatus),
      count: crewAtLocation.length,
      location,
      timestamp: new Date().toISOString()
    };
  }

  // State-based query (e.g., all reserves)
  if (stateType) {
    const crewByState = crewStateService.getCrewByState(stateType);
    return {
      crew: crewByState.map(formatCrewStatus),
      count: crewByState.length,
      stateType,
      timestamp: new Date().toISOString()
    };
  }

  return {
    error: true,
    message: "Must provide either employeeId, location, or stateType"
  };
}

function formatCrewStatus(state: any) {
  const now = new Date();
  const stateEnd = new Date(state.stateEndUtc);
  const hoursRemaining = (stateEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

  return {
    employeeId: state.employeeId,
    currentState: {
      type: state.stateType,
      startUtc: state.stateStartUtc,
      endUtc: state.stateEndUtc,
      hoursRemaining: Math.max(0, hoursRemaining).toFixed(1)
    },
    location: state.currentLocation,
    availability: {
      isAvailable: state.stateType === 'RESERVE' && hoursRemaining > 0,
      nextAvailableUtc: state.stateType === 'DUTY' ? state.stateEndUtc : null,
      checkInStatus: hoursRemaining < 2 ? 'PENDING' : 'OK'
    },
    limits: {
      dutyHoursCumulative: state.dutyHoursCumulative,
      flightHoursMonth: state.flightHoursMonth,
      flightHoursYear: state.flightHoursYear,
      consecutiveDutyDays: state.consecutiveDutyDays
    },
    flags: generateStatusFlags(state)
  };
}

function generateStatusFlags(state: any): string[] {
  const flags: string[] = [];

  if (state.stateType === 'SICK') flags.push('UNAVAILABLE_SICK');
  if (state.stateType === 'VACATION') flags.push('UNAVAILABLE_VACATION');

  const now = new Date();
  const stateEnd = new Date(state.stateEndUtc);
  const hoursRemaining = (stateEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining < 2 && state.stateType === 'DUTY') {
    flags.push('APPROACHING_TIMEOUT');
  }

  if (state.flightHoursMonth > 90) {
    flags.push('HIGH_MONTHLY_HOURS');
  }

  if (state.consecutiveDutyDays >= 5) {
    flags.push('FATIGUE_RISK');
  }

  if (state.dutyHoursCumulative < 10) {
    flags.push('FRESH_CREW');
  }

  return flags;
}

export const getCrewStatusRealtimeSchema = {
  type: "object" as const,
  properties: {
    employeeId: {
      type: "string" as const,
      description: "Get status for specific crew member by employee ID"
    },
    location: {
      type: "string" as const,
      description: "Get all crew currently at this IATA airport code"
    },
    stateType: {
      type: "string" as const,
      enum: ["DUTY", "REST", "RESERVE", "OFF", "SICK", "VACATION"],
      description: "Get all crew in this state (e.g., all reserves)"
    },
    position: {
      type: "string" as const,
      enum: ["CA", "FO", "FA"],
      description: "Filter by crew position"
    },
    includeUpcoming: {
      type: "boolean" as const,
      description: "Include upcoming scheduled duties",
      default: false
    }
  },
  oneOf: [
    { required: ["employeeId"] },
    { required: ["location"] },
    { required: ["stateType"] }
  ]
};
