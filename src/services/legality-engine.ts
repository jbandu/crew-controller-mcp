/**
 * FAA Part 117 Legality Engine
 * Validates crew duty assignments against federal regulations
 */

import {
  LegalityCheck,
  ComplianceViolation,
  DutyPeriod,
  Part117Limits,
  FatigueRiskAssessment
} from '../types/compliance.js';
import { CrewDutyState } from '../types/crew.js';

export class LegalityEngine {
  private part117Limits: Part117Limits = {
    maxFlightDutyPeriod: 13, // Conservative default
    maxFlightTime: 9,
    minRestPeriod: 10,
    extendedRestPeriod: 12,
    maxFlightHours28Days: 100,
    maxFlightHours365Days: 1000,
    maxDutyHours168Hours: 60,
    woclStart: '02:00',
    woclEnd: '06:00'
  };

  /**
   * Validates if a crew member can legally accept a proposed duty
   */
  validateDuty(
    crewState: CrewDutyState,
    proposedDuty: DutyPeriod,
    checkCategories: string[] = ['part117']
  ): LegalityCheck {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceViolation[] = [];

    if (checkCategories.includes('part117')) {
      // Check flight duty period length
      const fdpViolation = this.checkFlightDutyPeriod(proposedDuty);
      if (fdpViolation) violations.push(fdpViolation);

      // Check flight time within FDP
      const flightTimeViolation = this.checkFlightTime(proposedDuty);
      if (flightTimeViolation) violations.push(flightTimeViolation);

      // Check rest requirements
      const restViolation = this.checkRestRequirements(crewState, proposedDuty);
      if (restViolation) violations.push(restViolation);

      // Check cumulative limits
      const cumulativeViolations = this.checkCumulativeLimits(crewState, proposedDuty);
      violations.push(...cumulativeViolations);

      // Check WOCL exposure (warning level)
      const woclWarning = this.checkWoclExposure(proposedDuty);
      if (woclWarning) warnings.push(woclWarning);
    }

    if (checkCategories.includes('fatigue_risk')) {
      const fatigueWarnings = this.assessFatigueRisk(crewState, proposedDuty);
      warnings.push(...fatigueWarnings);
    }

    return {
      isLegal: violations.filter(v => v.severity === 'blocking').length === 0,
      violations,
      warnings,
      checksPerformed: checkCategories.map(c => c as any),
      timestamp: new Date().toISOString(),
      auditLogId: this.generateAuditId()
    };
  }

  private checkFlightDutyPeriod(duty: DutyPeriod): ComplianceViolation | null {
    const fdpHours = duty.totalDutyHours;

    if (fdpHours > this.part117Limits.maxFlightDutyPeriod) {
      return {
        category: 'part117',
        rule: '117.25(d)',
        description: `Flight duty period exceeds maximum allowed`,
        severity: 'blocking',
        currentValue: fdpHours,
        limitValue: this.part117Limits.maxFlightDutyPeriod,
        recommendation: `Reduce duty by ${(fdpHours - this.part117Limits.maxFlightDutyPeriod).toFixed(1)} hours or assign different crew`
      };
    }

    return null;
  }

  private checkFlightTime(duty: DutyPeriod): ComplianceViolation | null {
    const flightHours = duty.totalFlightHours;

    if (flightHours > this.part117Limits.maxFlightTime) {
      return {
        category: 'part117',
        rule: '117.11(a)',
        description: `Flight time within duty period exceeds maximum`,
        severity: 'blocking',
        currentValue: flightHours,
        limitValue: this.part117Limits.maxFlightTime,
        recommendation: `Reduce flight time by ${(flightHours - this.part117Limits.maxFlightTime).toFixed(1)} hours`
      };
    }

    return null;
  }

  private checkRestRequirements(
    crewState: CrewDutyState,
    proposedDuty: DutyPeriod
  ): ComplianceViolation | null {
    const lastDutyEnd = new Date(crewState.stateEndUtc);
    const nextDutyStart = new Date(proposedDuty.startTimeUtc);
    const restHours = (nextDutyStart.getTime() - lastDutyEnd.getTime()) / (1000 * 60 * 60);

    const requiredRest = crewState.consecutiveDutyDays >= 3
      ? this.part117Limits.extendedRestPeriod
      : this.part117Limits.minRestPeriod;

    if (restHours < requiredRest) {
      return {
        category: 'part117',
        rule: '117.25(b)',
        description: `Insufficient rest period between duties`,
        severity: 'blocking',
        currentValue: restHours,
        limitValue: requiredRest,
        recommendation: `Provide additional ${(requiredRest - restHours).toFixed(1)} hours rest`
      };
    }

    return null;
  }

  private checkCumulativeLimits(
    crewState: CrewDutyState,
    proposedDuty: DutyPeriod
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check 28-day limit
    const projected28DayHours = crewState.flightHoursMonth + proposedDuty.totalFlightHours;
    if (projected28DayHours > this.part117Limits.maxFlightHours28Days) {
      violations.push({
        category: 'part117',
        rule: '117.23(b)',
        description: `28-day flight hour limit would be exceeded`,
        severity: 'blocking',
        currentValue: projected28DayHours,
        limitValue: this.part117Limits.maxFlightHours28Days,
        recommendation: `Crew has only ${(this.part117Limits.maxFlightHours28Days - crewState.flightHoursMonth).toFixed(1)} hours remaining this period`
      });
    }

    // Check annual limit
    const projectedYearHours = crewState.flightHoursYear + proposedDuty.totalFlightHours;
    if (projectedYearHours > this.part117Limits.maxFlightHours365Days) {
      violations.push({
        category: 'part117',
        rule: '117.23(b)',
        description: `365-day flight hour limit would be exceeded`,
        severity: 'blocking',
        currentValue: projectedYearHours,
        limitValue: this.part117Limits.maxFlightHours365Days
      });
    }

    return violations;
  }

  private checkWoclExposure(duty: DutyPeriod): ComplianceViolation | null {
    // Simplified WOCL check - in production, this would consider timezone and local time
    const dutyStart = new Date(duty.startTimeUtc);
    const dutyHour = dutyStart.getUTCHours();

    // Approximate WOCL as 2am-6am UTC (simplified)
    if (dutyHour >= 2 && dutyHour <= 6) {
      return {
        category: 'fatigue_risk',
        rule: 'FRMS_WOCL',
        description: `Duty overlaps Window of Circadian Low (${this.part117Limits.woclStart}-${this.part117Limits.woclEnd})`,
        severity: 'warning',
        recommendation: 'Consider additional rest or different crew with better circadian alignment'
      };
    }

    return null;
  }

  private assessFatigueRisk(
    crewState: CrewDutyState,
    proposedDuty: DutyPeriod
  ): ComplianceViolation[] {
    const warnings: ComplianceViolation[] = [];

    // Check consecutive duty days
    if (crewState.consecutiveDutyDays >= 5) {
      warnings.push({
        category: 'fatigue_risk',
        rule: 'FRMS_CONSECUTIVE_DUTY',
        description: `Crew has worked ${crewState.consecutiveDutyDays} consecutive days`,
        severity: 'advisory',
        recommendation: 'Consider scheduling day off soon to prevent cumulative fatigue'
      });
    }

    // Check duty length approaching limits
    if (proposedDuty.totalDutyHours > 11) {
      warnings.push({
        category: 'fatigue_risk',
        rule: 'FRMS_LONG_DUTY',
        description: `Duty period exceeds 11 hours`,
        severity: 'advisory',
        recommendation: 'Monitor crew for signs of fatigue during duty'
      });
    }

    return warnings;
  }

  private generateAuditId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const random = Math.random().toString(36).substring(7);
    return `audit_${timestamp}_${random}`;
  }
}
