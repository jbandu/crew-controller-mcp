/**
 * predict-crew-disruptions MCP Tool
 * ML-based prediction of crew disruptions (sick calls, no-shows, delays)
 */

import { CrewStateService } from '../services/crew-state-service.js';

export interface PredictCrewDisruptionsInput {
  timeWindowHours?: number; // How far ahead to predict
  base?: string; // Filter by base
  position?: string; // Filter by position
  minConfidence?: number; // 0-100, minimum prediction confidence
}

export interface DisruptionPrediction {
  employeeId: string;
  name: string;
  position: string;
  predictedDisruptionType: 'sick_call' | 'no_show' | 'late_check_in' | 'timeout_risk';
  confidence: number; // 0-100
  predictedTimeUtc: string;
  reasoning: string[];
  riskFactors: RiskFactor[];
  preventiveActions: string[];
  backupCrewRecommendations: string[];
}

export interface RiskFactor {
  factor: string;
  weight: number; // 0-1
  description: string;
}

export async function predictCrewDisruptions(
  input: PredictCrewDisruptionsInput,
  crewStateService: CrewStateService
): Promise<any> {
  const {
    timeWindowHours = 4,
    base,
    position,
    minConfidence = 50
  } = input;

  const predictions: DisruptionPrediction[] = [];
  const now = new Date();
  const windowEnd = new Date(now.getTime() + timeWindowHours * 60 * 60 * 1000);

  // Get all crew on duty or reserve
  const activeCrew = [
    ...crewStateService.getCrewByState('DUTY'),
    ...crewStateService.getCrewByState('RESERVE')
  ].filter(state => {
    const member = crewStateService['crewMembers'].get(state.employeeId);
    if (!member) return false;
    if (base && member.base !== base) return false;
    if (position && member.position !== position) return false;
    return true;
  });

  for (const crewState of activeCrew) {
    const member = crewStateService['crewMembers'].get(crewState.employeeId);
    if (!member) continue;

    // Run ML prediction (mock - would use actual ML model)
    const prediction = runPredictionModel(crewState, timeWindowHours);

    if (prediction.confidence >= minConfidence) {
      predictions.push({
        employeeId: crewState.employeeId,
        name: `${member.lastName}, ${member.firstName}`,
        position: member.position,
        predictedDisruptionType: prediction.type,
        confidence: prediction.confidence,
        predictedTimeUtc: prediction.predictedTimeUtc,
        reasoning: prediction.reasoning,
        riskFactors: prediction.riskFactors,
        preventiveActions: generatePreventiveActions(prediction.type, crewState),
        backupCrewRecommendations: [] // Would query reserve pool
      });
    }
  }

  // Sort by confidence and time
  predictions.sort((a, b) => {
    const timeDiff = new Date(a.predictedTimeUtc).getTime() - new Date(b.predictedTimeUtc).getTime();
    return timeDiff !== 0 ? timeDiff : b.confidence - a.confidence;
  });

  return {
    timeWindowHours,
    predictionCount: predictions.length,
    predictions,
    summary: {
      highConfidence: predictions.filter(p => p.confidence >= 80).length,
      mediumConfidence: predictions.filter(p => p.confidence >= 60 && p.confidence < 80).length,
      lowConfidence: predictions.filter(p => p.confidence < 60).length,
      byType: {
        sick_call: predictions.filter(p => p.predictedDisruptionType === 'sick_call').length,
        no_show: predictions.filter(p => p.predictedDisruptionType === 'no_show').length,
        late_check_in: predictions.filter(p => p.predictedDisruptionType === 'late_check_in').length,
        timeout_risk: predictions.filter(p => p.predictedDisruptionType === 'timeout_risk').length
      }
    },
    timestamp: new Date().toISOString()
  };
}

function runPredictionModel(crewState: any, timeWindowHours: number): any {
  // Mock ML model - in production, this would use TensorFlow/scikit-learn
  const riskFactors: RiskFactor[] = [];
  const reasoning: string[] = [];
  let confidence = 0;
  let type: 'sick_call' | 'no_show' | 'late_check_in' | 'timeout_risk' = 'sick_call';

  // Factor 1: Fatigue
  if (crewState.consecutiveDutyDays >= 5) {
    riskFactors.push({
      factor: 'high_consecutive_days',
      weight: 0.3,
      description: `${crewState.consecutiveDutyDays} consecutive duty days`
    });
    reasoning.push('Crew has worked many consecutive days - fatigue risk');
    confidence += 25;
  }

  // Factor 2: High monthly hours
  if (crewState.flightHoursMonth > 80) {
    riskFactors.push({
      factor: 'high_monthly_hours',
      weight: 0.25,
      description: `${crewState.flightHoursMonth} flight hours this month`
    });
    reasoning.push('Above average monthly hours');
    confidence += 20;
  }

  // Factor 3: Recent WOCL exposure
  if (crewState.lastWoclExposure) {
    const hoursSinceWocl = (Date.now() - new Date(crewState.lastWoclExposure).getTime()) / (1000 * 60 * 60);
    if (hoursSinceWocl < 24) {
      riskFactors.push({
        factor: 'recent_wocl',
        weight: 0.2,
        description: 'Recent Window of Circadian Low exposure'
      });
      reasoning.push('Recent overnight duty - circadian disruption');
      confidence += 15;
    }
  }

  // Factor 4: Timeout risk
  if (crewState.dutyHoursCumulative > 11) {
    type = 'timeout_risk';
    riskFactors.push({
      factor: 'approaching_limit',
      weight: 0.4,
      description: `${crewState.dutyHoursCumulative} duty hours cumulative`
    });
    reasoning.push('Approaching FDP limits');
    confidence += 30;
  }

  // Historical pattern (mock - would use actual history)
  const historicalSickCallRate = 0.15; // 15% baseline
  if (Math.random() < historicalSickCallRate) {
    confidence += 10;
    reasoning.push('Historical pattern suggests elevated risk');
  }

  const predictedTimeUtc = new Date(
    Date.now() + Math.random() * timeWindowHours * 60 * 60 * 1000
  ).toISOString();

  return {
    type,
    confidence: Math.min(100, confidence),
    predictedTimeUtc,
    reasoning,
    riskFactors
  };
}

function generatePreventiveActions(
  type: string,
  crewState: any
): string[] {
  const actions: string[] = [];

  switch (type) {
    case 'sick_call':
      actions.push('Pre-position backup crew at base');
      actions.push('Monitor crew check-in status closely');
      actions.push('Have reserve pool on standby');
      break;

    case 'no_show':
      actions.push('Call crew 2 hours before report time');
      actions.push('Send app notification and SMS reminder');
      actions.push('Prepare immediate replacement options');
      break;

    case 'timeout_risk':
      actions.push('Monitor flight delays closely');
      actions.push('Identify replacement crew now');
      actions.push('Consider early swap to prevent disruption');
      break;

    case 'late_check_in':
      actions.push('Send early check-in reminder');
      actions.push('Have backup crew on standby');
      break;
  }

  if (crewState.consecutiveDutyDays >= 5) {
    actions.push('Consider mandatory rest day after current duty');
  }

  return actions;
}

export const predictCrewDisruptionsSchema = {
  type: "object" as const,
  properties: {
    timeWindowHours: {
      type: "number" as const,
      description: "How many hours ahead to predict (default: 4)",
      default: 4
    },
    base: {
      type: "string" as const,
      description: "Filter predictions by crew base IATA code"
    },
    position: {
      type: "string" as const,
      enum: ["CA", "FO", "FA"],
      description: "Filter predictions by crew position"
    },
    minConfidence: {
      type: "number" as const,
      description: "Minimum prediction confidence 0-100 (default: 50)",
      default: 50,
      minimum: 0,
      maximum: 100
    }
  }
};
