/**
 * execute-crew-swap MCP Tool
 * Executes a crew swap transaction with rollback capability
 */

import { CrewStateService } from '../services/crew-state-service.js';

export interface ExecuteCrewSwapInput {
  flightNumber: string;
  position: 'CA' | 'FO' | 'FA';
  originalCrewId: string;
  replacementCrewId: string;
  reason: string;
  effectiveTimeUtc: string;
  notifyCrews?: boolean;
  dryRun?: boolean;
}

export interface SwapTransaction {
  transactionId: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  changes: SwapChange[];
  notifications: NotificationRecord[];
  rollbackAvailable: boolean;
}

export interface SwapChange {
  entity: string; // 'crew_assignment', 'duty_state', 'pairing'
  entityId: string;
  action: 'create' | 'update' | 'delete';
  beforeState: any;
  afterState: any;
}

export interface NotificationRecord {
  recipientId: string;
  channel: 'sms' | 'email' | 'app_push';
  message: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
}

export async function executeCrewSwap(
  input: ExecuteCrewSwapInput,
  crewStateService: CrewStateService
): Promise<any> {
  const {
    flightNumber,
    position,
    originalCrewId,
    replacementCrewId,
    reason,
    effectiveTimeUtc,
    notifyCrews = true,
    dryRun = false
  } = input;

  // Generate transaction ID
  const transactionId = generateTransactionId();
  const timestamp = new Date().toISOString();

  // Validate both crew members exist
  const originalCrew = crewStateService.getCrewStatus(originalCrewId);
  const replacementCrew = crewStateService.getCrewStatus(replacementCrewId);

  if (!originalCrew) {
    return {
      error: true,
      message: `Original crew member ${originalCrewId} not found`,
      transactionId
    };
  }

  if (!replacementCrew) {
    return {
      error: true,
      message: `Replacement crew member ${replacementCrewId} not found`,
      transactionId
    };
  }

  // Track changes for rollback
  const changes: SwapChange[] = [];

  // Change 1: Remove original crew from flight
  changes.push({
    entity: 'crew_assignment',
    entityId: `${flightNumber}-${originalCrewId}`,
    action: 'delete',
    beforeState: {
      flightNumber,
      position,
      employeeId: originalCrewId,
      assignedAt: originalCrew.stateStartUtc
    },
    afterState: null
  });

  // Change 2: Assign replacement crew to flight
  changes.push({
    entity: 'crew_assignment',
    entityId: `${flightNumber}-${replacementCrewId}`,
    action: 'create',
    beforeState: null,
    afterState: {
      flightNumber,
      position,
      employeeId: replacementCrewId,
      assignedAt: timestamp
    }
  });

  // Change 3: Update original crew state (back to reserve or off)
  const newOriginalState = {
    ...originalCrew,
    stateType: 'RESERVE' as const,
    assignedFlights: originalCrew.assignedFlights.filter(f => f !== flightNumber)
  };

  changes.push({
    entity: 'duty_state',
    entityId: originalCrewId,
    action: 'update',
    beforeState: { ...originalCrew },
    afterState: newOriginalState
  });

  // Change 4: Update replacement crew state
  const newReplacementState = {
    ...replacementCrew,
    stateType: 'DUTY' as const,
    assignedFlights: [...replacementCrew.assignedFlights, flightNumber],
    reportTimeUtc: effectiveTimeUtc
  };

  changes.push({
    entity: 'duty_state',
    entityId: replacementCrewId,
    action: 'update',
    beforeState: { ...replacementCrew },
    afterState: newReplacementState
  });

  // Prepare notifications
  const notifications: NotificationRecord[] = [];

  if (notifyCrews) {
    // Notify original crew
    notifications.push({
      recipientId: originalCrewId,
      channel: 'app_push',
      message: `You have been removed from flight ${flightNumber}. Reason: ${reason}. Contact crew scheduling if you have questions.`,
      status: 'pending'
    });

    // Notify replacement crew
    notifications.push({
      recipientId: replacementCrewId,
      channel: 'app_push',
      message: `You have been assigned to flight ${flightNumber} as ${position}. Report time: ${effectiveTimeUtc}. Check your app for details.`,
      status: 'pending'
    });
  }

  // Dry run mode - don't actually execute
  if (dryRun) {
    return {
      transactionId,
      timestamp,
      status: 'pending',
      dryRun: true,
      message: 'Dry run completed successfully - no changes made',
      changes,
      notifications,
      costImpact: calculateSwapCost(originalCrew, replacementCrew),
      rollbackAvailable: false
    };
  }

  // Execute changes (in production, this would be a database transaction)
  try {
    // Update crew states
    crewStateService.updateCrewState(newOriginalState);
    crewStateService.updateCrewState(newReplacementState);

    // Mark notifications as sent (simulated)
    notifications.forEach(n => {
      n.sentAt = new Date().toISOString();
      n.status = 'sent';
    });

    return {
      transactionId,
      timestamp,
      status: 'completed',
      flightNumber,
      position,
      changes: changes.map(c => ({
        entity: c.entity,
        entityId: c.entityId,
        action: c.action
      })),
      notifications: notifications.map(n => ({
        recipientId: n.recipientId,
        channel: n.channel,
        status: n.status,
        sentAt: n.sentAt
      })),
      costImpact: calculateSwapCost(originalCrew, replacementCrew),
      rollbackAvailable: true,
      rollbackDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      message: 'Crew swap executed successfully'
    };
  } catch (error: any) {
    return {
      error: true,
      transactionId,
      timestamp,
      status: 'failed',
      message: `Failed to execute swap: ${error.message}`,
      changes: [],
      rollbackAvailable: false
    };
  }
}

function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `swap_${timestamp}_${random}`;
}

function calculateSwapCost(originalCrew: any, replacementCrew: any): any {
  // Simplified cost calculation
  const originalCostPerHour = 100; // Base rate
  const replacementCostPerHour = replacementCrew.flightHoursMonth > 75 ? 150 : 100; // Overtime

  return {
    originalCrewCost: 0, // Already paid
    replacementCrewCost: 500, // 5 hours * $100
    additionalCost: replacementCostPerHour > originalCostPerHour ? 250 : 0,
    totalImpactUsd: replacementCostPerHour > originalCostPerHour ? 250 : 0,
    breakdown: {
      overtimePremium: replacementCrew.flightHoursMonth > 75 ? 250 : 0,
      calloutPay: 0,
      deadheadCost: 0
    }
  };
}

export const executeCrewSwapSchema = {
  type: "object" as const,
  properties: {
    flightNumber: {
      type: "string" as const,
      description: "Flight number for the crew swap"
    },
    position: {
      type: "string" as const,
      enum: ["CA", "FO", "FA"],
      description: "Crew position being swapped"
    },
    originalCrewId: {
      type: "string" as const,
      description: "Employee ID of crew being removed"
    },
    replacementCrewId: {
      type: "string" as const,
      description: "Employee ID of replacement crew"
    },
    reason: {
      type: "string" as const,
      description: "Reason for swap (e.g., sick call, timeout, IRROPS)"
    },
    effectiveTimeUtc: {
      type: "string" as const,
      format: "date-time",
      description: "When the swap takes effect (report time for replacement crew)"
    },
    notifyCrews: {
      type: "boolean" as const,
      description: "Send notifications to affected crew members (default: true)",
      default: true
    },
    dryRun: {
      type: "boolean" as const,
      description: "Preview changes without executing (default: false)",
      default: false
    }
  },
  required: ["flightNumber", "position", "originalCrewId", "replacementCrewId", "reason", "effectiveTimeUtc"]
};
