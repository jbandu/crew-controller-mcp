/**
 * generate-recovery-plan MCP Tool
 * Multi-flight crew recovery optimization during IRROPS
 */

import { CrewStateService } from '../services/crew-state-service.js';

export interface GenerateRecoveryPlanInput {
  disruptedFlights: string[]; // Flight numbers
  scenario: 'weather' | 'maintenance' | 'crew_shortage' | 'atc_delay' | 'general';
  recoveryStrategy?: 'minimize_cost' | 'minimize_delay' | 'maximize_coverage';
  maxRecoveryTimeHours?: number;
}

export interface RecoveryPlan {
  planId: string;
  scenario: string;
  strategy: string;
  totalCostUsd: number;
  estimatedRecoveryTimeHours: number;
  actions: RecoveryAction[];
  metricscomparison: {
    baseline: RecoveryMetrics;
    withPlan: RecoveryMetrics;
    improvement: RecoveryMetrics;
  };
  risks: string[];
  alternativePlans?: RecoveryPlan[];
}

export interface RecoveryAction {
  actionId: string;
  priority: number; // 1 = highest
  actionType: 'crew_swap' | 'cancel_flight' | 'deadhead_crew' | 'delay_flight' | 'ferry_flight';
  flightNumber: string;
  details: any;
  costUsd: number;
  dependencies: string[]; // Other actionIds this depends on
  executionDeadline: string;
}

export interface RecoveryMetrics {
  flightsCanceled: number;
  flightsDelayed: number;
  passengersImpacted: number;
  crewReassignments: number;
  totalCostUsd: number;
}

export async function generateRecoveryPlan(
  input: GenerateRecoveryPlanInput,
  crewStateService: CrewStateService
): Promise<any> {
  const {
    disruptedFlights,
    scenario,
    recoveryStrategy = 'minimize_delay',
    maxRecoveryTimeHours = 8
  } = input;

  const planId = `recovery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date();

  // Analyze disrupted flights
  const actions: RecoveryAction[] = [];
  let totalCost = 0;
  let crewReassignments = 0;
  let flightsCanceled = 0;
  let flightsDelayed = 0;

  for (let i = 0; i < disruptedFlights.length; i++) {
    const flightNumber = disruptedFlights[i];

    // Get crew currently assigned
    const assignedCrew = crewStateService.getCrewByState('DUTY')
      .filter(state => state.assignedFlights.includes(flightNumber));

    if (assignedCrew.length === 0) {
      // No crew - flight likely already canceled
      actions.push({
        actionId: `action_${i + 1}`,
        priority: 1,
        actionType: 'cancel_flight',
        flightNumber,
        details: {
          reason: 'No crew available',
          rebookPassengers: true,
          estimatedPaxCount: 150
        },
        costUsd: 15000, // Estimated pax compensation
        dependencies: [],
        executionDeadline: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString()
      });
      totalCost += 15000;
      flightsCanceled++;
      continue;
    }

    // Check if crew can still operate
    const crewTimeoutRisk = assignedCrew.some(c => c.dutyHoursCumulative > 11);

    if (crewTimeoutRisk) {
      // Need crew swap
      actions.push({
        actionId: `action_${i + 1}`,
        priority: 1,
        actionType: 'crew_swap',
        flightNumber,
        details: {
          positionsNeeded: assignedCrew.filter(c => c.dutyHoursCumulative > 11).length,
          strategy: 'call_reserves',
          estimatedSwapTimeMinutes: 45
        },
        costUsd: 2000,
        dependencies: [],
        executionDeadline: new Date(now.getTime() + 30 * 60 * 1000).toISOString()
      });
      totalCost += 2000;
      crewReassignments++;
    } else if (recoveryStrategy === 'minimize_delay') {
      // Delay flight slightly to optimize crew utilization
      actions.push({
        actionId: `action_${i + 1}`,
        priority: 2,
        actionType: 'delay_flight',
        flightNumber,
        details: {
          delayMinutes: 30,
          reason: 'Crew optimization',
          notifyPassengers: true
        },
        costUsd: 500, // Minor delay cost
        dependencies: [],
        executionDeadline: new Date(now.getTime() + 15 * 60 * 1000).toISOString()
      });
      totalCost += 500;
      flightsDelayed++;
    }
  }

  // Sort actions by priority
  actions.sort((a, b) => a.priority - b.priority);

  // Calculate metrics
  const baselineMetrics: RecoveryMetrics = {
    flightsCanceled: disruptedFlights.length,
    flightsDelayed: 0,
    passengersImpacted: disruptedFlights.length * 150,
    crewReassignments: 0,
    totalCostUsd: disruptedFlights.length * 15000
  };

  const withPlanMetrics: RecoveryMetrics = {
    flightsCanceled,
    flightsDelayed,
    passengersImpacted: (flightsCanceled * 150) + (flightsDelayed * 50),
    crewReassignments,
    totalCostUsd: totalCost
  };

  const improvement: RecoveryMetrics = {
    flightsCanceled: baselineMetrics.flightsCanceled - withPlanMetrics.flightsCanceled,
    flightsDelayed: withPlanMetrics.flightsDelayed,
    passengersImpacted: baselineMetrics.passengersImpacted - withPlanMetrics.passengersImpacted,
    crewReassignments: withPlanMetrics.crewReassignments,
    totalCostUsd: baselineMetrics.totalCostUsd - withPlanMetrics.totalCostUsd
  };

  const risks = generateRisks(actions, scenario);

  return {
    planId,
    scenario,
    strategy: recoveryStrategy,
    totalCostUsd: totalCost,
    estimatedRecoveryTimeHours: calculateRecoveryTime(actions),
    actions,
    metricsComparison: {
      baseline: baselineMetrics,
      withPlan: withPlanMetrics,
      improvement
    },
    risks,
    summary: {
      actionCount: actions.length,
      criticalActions: actions.filter(a => a.priority === 1).length,
      costSavings: improvement.totalCostUsd,
      flightsSaved: improvement.flightsCanceled,
      successProbability: calculateSuccessProbability(actions, risks)
    },
    timestamp: new Date().toISOString()
  };
}

function calculateRecoveryTime(actions: RecoveryAction[]): number {
  // Estimate based on action types
  let totalMinutes = 0;
  for (const action of actions) {
    switch (action.actionType) {
      case 'crew_swap': totalMinutes += 45; break;
      case 'deadhead_crew': totalMinutes += 120; break;
      case 'cancel_flight': totalMinutes += 15; break;
      case 'delay_flight': totalMinutes += 30; break;
      case 'ferry_flight': totalMinutes += 180; break;
    }
  }
  return totalMinutes / 60;
}

function generateRisks(actions: RecoveryAction[], scenario: string): string[] {
  const risks: string[] = [];

  const swapCount = actions.filter(a => a.actionType === 'crew_swap').length;
  if (swapCount > 3) {
    risks.push(`High crew swap volume (${swapCount}) - reserve pool may be insufficient`);
  }

  const criticalActions = actions.filter(a => a.priority === 1).length;
  if (criticalActions > 5) {
    risks.push('Many critical actions required - execution complexity high');
  }

  if (scenario === 'weather') {
    risks.push('Weather-related disruptions may worsen - plan may need adjustment');
  }

  const deadheads = actions.filter(a => a.actionType === 'deadhead_crew').length;
  if (deadheads > 0) {
    risks.push(`Deadhead operations required (${deadheads}) - subject to flight availability`);
  }

  if (risks.length === 0) {
    risks.push('Low risk - plan is straightforward to execute');
  }

  return risks;
}

function calculateSuccessProbability(actions: RecoveryAction[], risks: string[]): number {
  let probability = 95; // Base success rate

  probability -= actions.length * 2; // -2% per action
  probability -= risks.length * 5; // -5% per risk

  const criticalCount = actions.filter(a => a.priority === 1).length;
  probability -= criticalCount * 3; // -3% per critical action

  return Math.max(50, Math.min(100, probability));
}

export const generateRecoveryPlanSchema = {
  type: "object" as const,
  properties: {
    disruptedFlights: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "List of flight numbers experiencing disruption"
    },
    scenario: {
      type: "string" as const,
      enum: ["weather", "maintenance", "crew_shortage", "atc_delay", "general"],
      description: "Type of disruption scenario"
    },
    recoveryStrategy: {
      type: "string" as const,
      enum: ["minimize_cost", "minimize_delay", "maximize_coverage"],
      description: "Recovery optimization goal (default: minimize_delay)",
      default: "minimize_delay"
    },
    maxRecoveryTimeHours: {
      type: "number" as const,
      description: "Maximum acceptable recovery time in hours (default: 8)",
      default: 8
    }
  },
  required: ["disruptedFlights", "scenario"]
};
