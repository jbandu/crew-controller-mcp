/**
 * optimize-reserve-callout MCP Tool
 * Determines optimal reserve usage order based on cost, availability, and fairness
 */

import { CrewStateService } from '../services/crew-state-service.js';

export interface OptimizeReserveCalloutInput {
  base: string;
  position: 'CA' | 'FO' | 'FA';
  requiredTimeUtc: string;
  duration: number; // hours
  priorityFactor?: 'cost' | 'fairness' | 'seniority';
  maxResults?: number;
}

export interface ReserveRecommendation {
  employeeId: string;
  name: string;
  rankScore: number;
  reasoning: string[];
  metrics: {
    utilizationThisMonth: number; // 0-100%
    daysOnReserveSinceLastCall: number;
    costPerHour: number;
    availabilityScore: number; // 0-100
    fatigueScore: number; // 0-100, lower is better
  };
  fairnessConsiderations: {
    calloutCountThisMonth: number;
    lastCalloutDate?: string;
    hoursUsedVsAvailable: number; // percentage
  };
}

export async function optimizeReserveCallout(
  input: OptimizeReserveCalloutInput,
  crewStateService: CrewStateService
): Promise<any> {
  const {
    base,
    position,
    requiredTimeUtc,
    duration,
    priorityFactor = 'fairness',
    maxResults = 5
  } = input;

  // Get all reserves at base for this position
  const reserves = crewStateService.getCrewByState('RESERVE')
    .filter(state => {
      const member = crewStateService['crewMembers'].get(state.employeeId);
      return member?.base === base && member?.position === position;
    });

  if (reserves.length === 0) {
    return {
      error: true,
      message: `No reserves available at ${base} for position ${position}`,
      base,
      position,
      requiredTimeUtc
    };
  }

  // Calculate recommendations
  const recommendations: ReserveRecommendation[] = reserves.map(reserve => {
    const member = crewStateService['crewMembers'].get(reserve.employeeId);

    // Calculate metrics
    const utilizationThisMonth = (reserve.dutyHoursCumulative / 160) * 100; // 160 hrs/month typical max
    const daysOnReserveSinceLastCall = 5; // Mock - would query history
    const costPerHour = reserve.flightHoursMonth > 75 ? 150 : 100; // Overtime threshold
    const availabilityScore = calculateAvailabilityScore(reserve, requiredTimeUtc);
    const fatigueScore = calculateFatigueScore(reserve);

    // Fairness metrics (mock - would query call history)
    const calloutCountThisMonth = Math.floor(reserve.dutyHoursCumulative / 20); // Estimate
    const hoursUsedVsAvailable = (reserve.dutyHoursCumulative / 100) * 100;

    // Calculate rank score based on priority factor
    const rankScore = calculateRankScore(
      {
        utilizationThisMonth,
        daysOnReserveSinceLastCall,
        costPerHour,
        availabilityScore,
        fatigueScore,
        calloutCountThisMonth,
        hoursUsedVsAvailable
      },
      priorityFactor
    );

    // Generate reasoning
    const reasoning = generateReasoning(
      {
        utilizationThisMonth,
        daysOnReserveSinceLastCall,
        costPerHour,
        fatigueScore,
        calloutCountThisMonth
      },
      priorityFactor
    );

    return {
      employeeId: reserve.employeeId,
      name: member ? `${member.lastName}, ${member.firstName}` : 'Unknown',
      rankScore,
      reasoning,
      metrics: {
        utilizationThisMonth,
        daysOnReserveSinceLastCall,
        costPerHour,
        availabilityScore,
        fatigueScore
      },
      fairnessConsiderations: {
        calloutCountThisMonth,
        lastCalloutDate: undefined, // Would query from history
        hoursUsedVsAvailable
      }
    };
  });

  // Sort by rank score
  const sortedRecommendations = recommendations
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, maxResults);

  return {
    base,
    position,
    requiredTimeUtc,
    duration,
    priorityFactor,
    recommendations: sortedRecommendations,
    poolStatus: {
      totalReserves: reserves.length,
      recommendedCount: sortedRecommendations.length,
      averageUtilization: recommendations.reduce((sum, r) => sum + r.metrics.utilizationThisMonth, 0) / recommendations.length,
      lowestCostOption: sortedRecommendations.reduce((min, r) =>
        r.metrics.costPerHour < min.metrics.costPerHour ? r : min
      ),
      fairestOption: sortedRecommendations.reduce((min, r) =>
        r.fairnessConsiderations.calloutCountThisMonth < min.fairnessConsiderations.calloutCountThisMonth ? r : min
      )
    },
    timestamp: new Date().toISOString()
  };
}

function calculateAvailabilityScore(reserve: any, requiredTimeUtc: string): number {
  const requiredTime = new Date(requiredTimeUtc);
  const stateEnd = new Date(reserve.stateEndUtc);

  // Full score if available for next 12 hours
  const hoursAvailable = (stateEnd.getTime() - requiredTime.getTime()) / (1000 * 60 * 60);

  if (hoursAvailable >= 12) return 100;
  if (hoursAvailable >= 8) return 80;
  if (hoursAvailable >= 4) return 60;
  return 40;
}

function calculateFatigueScore(reserve: any): number {
  let score = 0;

  // Lower is better
  score += reserve.consecutiveDutyDays * 15; // 15 points per consecutive day
  score += (reserve.dutyHoursCumulative / 160) * 30; // Up to 30 points for utilization

  if (reserve.lastWoclExposure) {
    const hoursSinceWocl = (Date.now() - new Date(reserve.lastWoclExposure).getTime()) / (1000 * 60 * 60);
    if (hoursSinceWocl < 24) score += 20;
  }

  return Math.min(100, score);
}

function calculateRankScore(metrics: any, priorityFactor: string): number {
  let score = 100;

  switch (priorityFactor) {
    case 'cost':
      // Prioritize low cost
      score -= (metrics.costPerHour - 100) / 2; // -25 for $150/hr
      score -= metrics.utilizationThisMonth / 5; // Penalty for high utilization
      break;

    case 'fairness':
      // Prioritize even distribution
      score -= metrics.calloutCountThisMonth * 10; // -10 per callout
      score -= metrics.hoursUsedVsAvailable / 2; // Penalty for high usage
      score += metrics.daysOnReserveSinceLastCall * 2; // Bonus for waiting longer
      break;

    case 'seniority':
      // Would use actual seniority number
      score += (metrics.utilizationThisMonth < 50 ? 20 : 0); // Senior crew typically lower hours
      break;
  }

  // Common penalties
  score -= metrics.fatigueScore / 2; // Penalty for fatigue
  score += metrics.availabilityScore / 5; // Bonus for availability

  return Math.max(0, Math.min(100, score));
}

function generateReasoning(metrics: any, priorityFactor: string): string[] {
  const reasons: string[] = [];

  if (priorityFactor === 'cost') {
    if (metrics.costPerHour === 100) {
      reasons.push('Regular pay rate - no overtime premium');
    } else {
      reasons.push('Overtime premium applies - higher cost');
    }
  }

  if (priorityFactor === 'fairness') {
    if (metrics.calloutCountThisMonth === 0) {
      reasons.push('Has not been called out this month');
    } else if (metrics.calloutCountThisMonth >= 3) {
      reasons.push(`Already called out ${metrics.calloutCountThisMonth} times this month`);
    }

    if (metrics.daysOnReserveSinceLastCall >= 7) {
      reasons.push(`${metrics.daysOnReserveSinceLastCall} days since last callout - fair rotation`);
    }
  }

  if (metrics.fatigueScore < 30) {
    reasons.push('Low fatigue risk - fresh crew');
  } else if (metrics.fatigueScore > 60) {
    reasons.push('Elevated fatigue risk - monitor closely');
  }

  if (metrics.utilizationThisMonth < 50) {
    reasons.push('Below average utilization - good availability');
  } else if (metrics.utilizationThisMonth > 80) {
    reasons.push('High utilization this month - approaching limits');
  }

  return reasons;
}

export const optimizeReserveCalloutSchema = {
  type: "object" as const,
  properties: {
    base: {
      type: "string" as const,
      description: "Crew base IATA code (e.g., ORD, DFW, LAX)"
    },
    position: {
      type: "string" as const,
      enum: ["CA", "FO", "FA"],
      description: "Crew position needed"
    },
    requiredTimeUtc: {
      type: "string" as const,
      format: "date-time",
      description: "When the reserve needs to report for duty"
    },
    duration: {
      type: "number" as const,
      description: "Expected duty duration in hours"
    },
    priorityFactor: {
      type: "string" as const,
      enum: ["cost", "fairness", "seniority"],
      description: "Primary optimization criteria (default: fairness)",
      default: "fairness"
    },
    maxResults: {
      type: "number" as const,
      description: "Maximum number of recommendations (default: 5)",
      default: 5
    }
  },
  required: ["base", "position", "requiredTimeUtc", "duration"]
};
