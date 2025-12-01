/**
 * Crew State Service
 * Manages crew duty state and availability queries
 */

import { CrewDutyState, CrewMember, CrewReplacement, ReservePool } from '../types/crew.js';
import { DutyPeriod } from '../types/compliance.js';
import { LegalityEngine } from './legality-engine.js';

export class CrewStateService {
  private legalityEngine: LegalityEngine;

  // In-memory storage (in production, this would be a database)
  private crewStates: Map<string, CrewDutyState> = new Map();
  private crewMembers: Map<string, CrewMember> = new Map();

  constructor() {
    this.legalityEngine = new LegalityEngine();
  }

  /**
   * Get current duty state for a crew member
   */
  getCrewStatus(employeeId: string): CrewDutyState | null {
    return this.crewStates.get(employeeId) || null;
  }

  /**
   * Get all crew currently at a specific location
   */
  getCrewAtLocation(location: string): CrewDutyState[] {
    return Array.from(this.crewStates.values())
      .filter(state => state.currentLocation === location);
  }

  /**
   * Get crew by state type (e.g., all reserves)
   */
  getCrewByState(stateType: string): CrewDutyState[] {
    return Array.from(this.crewStates.values())
      .filter(state => state.stateType === stateType);
  }

  /**
   * Find replacement crew for a flight
   */
  async findReplacementCrew(params: {
    flightNumber: string;
    position: string;
    departureTimeUtc: string;
    base: string;
    aircraftType: string;
    maxResults?: number;
    includeDeadheadOptions?: boolean;
  }): Promise<CrewReplacement[]> {
    const { position, departureTimeUtc, base, aircraftType, maxResults = 5 } = params;

    // Get all reserves at base for this position
    const reserves = this.getCrewByState('RESERVE')
      .filter(state => {
        const member = this.crewMembers.get(state.employeeId);
        return member?.base === base &&
               member?.position === position &&
               member?.qualifications.aircraftTypes.includes(aircraftType as any);
      });

    const candidates: CrewReplacement[] = [];

    for (const reserve of reserves) {
      const member = this.crewMembers.get(reserve.employeeId);
      if (!member) continue;

      // Create proposed duty (simplified - would be more complex in production)
      const proposedDuty: DutyPeriod = {
        startTimeUtc: departureTimeUtc,
        endTimeUtc: new Date(new Date(departureTimeUtc).getTime() + 5 * 60 * 60 * 1000).toISOString(),
        reportTimeUtc: new Date(new Date(departureTimeUtc).getTime() - 1 * 60 * 60 * 1000).toISOString(),
        releaseTimeUtc: new Date(new Date(departureTimeUtc).getTime() + 5.5 * 60 * 60 * 1000).toISOString(),
        flights: [],
        totalDutyHours: 6.5,
        totalFlightHours: 5
      };

      // Check legality
      const legalityCheck = this.legalityEngine.validateDuty(
        reserve,
        proposedDuty,
        ['part117', 'fatigue_risk']
      );

      if (!legalityCheck.isLegal) continue;

      // Calculate cost (simplified)
      const cost = this.calculateCrewCost(reserve, proposedDuty);

      // Calculate rank score
      const rankScore = this.calculateRankScore(reserve, legalityCheck, cost);

      candidates.push({
        employeeId: member.employeeId,
        name: `${member.lastName}, ${member.firstName}`,
        legality: legalityCheck,
        logistics: {
          currentLocation: reserve.currentLocation,
          positioningRequired: false,
          readyTimeUtc: departureTimeUtc,
          travelTimeMinutes: 0
        },
        cost,
        rankScore
      });
    }

    // Sort by rank score (descending) and return top N
    return candidates
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, maxResults);
  }

  /**
   * Calculate cost of using this crew member
   */
  private calculateCrewCost(state: CrewDutyState, duty: DutyPeriod): any {
    // Simplified cost calculation
    const payCredit = duty.totalFlightHours;
    const perDiem = duty.totalDutyHours * 2.5; // $2.50/hour example
    const deadheadCost = 0; // No deadhead for reserves at base
    const hotelCost = 0; // Day turn, no hotel
    const overtimePremium = state.flightHoursMonth > 75 ? payCredit * 50 : 0;

    return {
      payCredit,
      perDiem,
      deadheadCost,
      hotelCost,
      overtimePremium,
      totalUsd: (payCredit * 100) + perDiem + overtimePremium // $100/hr example rate
    };
  }

  /**
   * Calculate ranking score for crew replacement
   */
  private calculateRankScore(
    state: CrewDutyState,
    legality: any,
    cost: any
  ): number {
    let score = 100;

    // Penalty for warnings
    score -= legality.warnings.length * 5;

    // Penalty for high cost (relative)
    if (cost.totalUsd > 1000) score -= 10;
    if (cost.overtimePremium > 0) score -= 15;

    // Bonus for being fresh (low duty hours)
    if (state.dutyHoursCumulative < 20) score += 10;

    // Bonus for consecutive duty days (prefer fresh crew)
    if (state.consecutiveDutyDays < 3) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update crew state (for testing)
   */
  updateCrewState(state: CrewDutyState): void {
    this.crewStates.set(state.employeeId, state);
  }

  /**
   * Add crew member (for testing)
   */
  addCrewMember(member: CrewMember): void {
    this.crewMembers.set(member.employeeId, member);
  }

  /**
   * Get reserve pool status
   */
  getReservePoolStatus(base: string, position: string): ReservePool {
    const reserves = this.getCrewByState('RESERVE')
      .filter(state => {
        const member = this.crewMembers.get(state.employeeId);
        return member?.base === base && member?.position === position;
      });

    const totalReservesNeeded = 10; // Example
    const utilizationPercent = ((totalReservesNeeded - reserves.length) / totalReservesNeeded) * 100;

    return {
      base,
      position: position as any,
      availableCrewIds: reserves.map(r => r.employeeId),
      utilizationPercent,
      nextAvailableUtc: reserves.length > 0
        ? reserves[0].stateEndUtc
        : new Date().toISOString()
    };
  }
}
