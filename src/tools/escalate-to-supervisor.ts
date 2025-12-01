/**
 * escalate-to-supervisor MCP Tool
 * Escalates complex situations to senior controller or supervisor
 */

export interface EscalateToSupervisorInput {
  situation: string;
  severity: 'routine' | 'urgent' | 'critical';
  context: EscalationContext;
  requestedBy: string; // Controller ID
  suggestedActions?: string[];
  timeToDecisionMinutes?: number;
}

export interface EscalationContext {
  affectedFlights: string[];
  affectedCrew: string[];
  estimatedCostImpact?: number;
  passengerImpact?: number;
  complianceIssues?: string[];
  attemptedActions?: string[];
}

export async function escalateToSupervisor(
  input: EscalateToSupervisorInput
): Promise<any> {
  const {
    situation,
    severity,
    context,
    requestedBy,
    suggestedActions = [],
    timeToDecisionMinutes = 30
  } = input;

  const escalationId = generateEscalationId();
  const timestamp = new Date().toISOString();
  const decisionDeadline = new Date(
    Date.now() + timeToDecisionMinutes * 60 * 1000
  ).toISOString();

  // Determine supervisor to notify based on severity
  const supervisor = assignSupervisor(severity, context);

  // Prepare escalation package
  const escalationPackage = {
    escalationId,
    timestamp,
    situation,
    severity,
    requestedBy,
    assignedTo: supervisor,
    context: {
      ...context,
      summary: generateSituationSummary(context)
    },
    suggestedActions,
    decisionDeadline,
    status: 'pending',
    priority: calculatePriority(severity, context)
  };

  // Send notifications to supervisor
  await notifySupervisor(supervisor, escalationPackage);

  // Create audit trail
  await logEscalation(escalationPackage);

  return {
    escalationId,
    status: 'escalated',
    assignedTo: supervisor,
    decisionDeadline,
    estimatedResponseMinutes: getEstimatedResponseTime(severity),
    nextSteps: [
      `Supervisor ${supervisor.name} has been notified`,
      `Monitor escalation status via escalation ID: ${escalationId}`,
      `Decision required by ${decisionDeadline}`,
      'Continue monitoring situation until supervisor responds'
    ],
    contactInfo: supervisor.contactInfo,
    timestamp
  };
}

function generateEscalationId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function assignSupervisor(severity: string, context: EscalationContext): any {
  // Mock supervisor assignment - would query org structure
  const supervisors = {
    routine: {
      id: 'SUP_001',
      name: 'Anderson, Sarah',
      title: 'Senior Crew Controller',
      contactInfo: {
        mobile: '+1-555-1001',
        email: 'sarah.anderson@airline.com'
      }
    },
    urgent: {
      id: 'SUP_002',
      name: 'Chen, Michael',
      title: 'Crew Control Supervisor',
      contactInfo: {
        mobile: '+1-555-1002',
        email: 'michael.chen@airline.com',
        pager: '5551002'
      }
    },
    critical: {
      id: 'SUP_003',
      name: 'Rodriguez, Maria',
      title: 'Director of Crew Operations',
      contactInfo: {
        mobile: '+1-555-1003',
        email: 'maria.rodriguez@airline.com',
        pager: '5551003'
      }
    }
  };

  return supervisors[severity as keyof typeof supervisors] || supervisors.routine;
}

function generateSituationSummary(context: EscalationContext): string {
  const parts: string[] = [];

  if (context.affectedFlights.length > 0) {
    parts.push(`${context.affectedFlights.length} flights affected`);
  }

  if (context.affectedCrew.length > 0) {
    parts.push(`${context.affectedCrew.length} crew members impacted`);
  }

  if (context.estimatedCostImpact) {
    parts.push(`Est. cost: $${context.estimatedCostImpact.toLocaleString()}`);
  }

  if (context.passengerImpact) {
    parts.push(`${context.passengerImpact} passengers affected`);
  }

  if (context.complianceIssues && context.complianceIssues.length > 0) {
    parts.push(`COMPLIANCE ISSUES: ${context.complianceIssues.join(', ')}`);
  }

  return parts.join(' | ');
}

function calculatePriority(severity: string, context: EscalationContext): number {
  let priority = { routine: 3, urgent: 2, critical: 1 }[severity] || 3;

  if (context.complianceIssues && context.complianceIssues.length > 0) {
    priority = Math.min(priority, 1); // Compliance issues always high priority
  }

  if (context.affectedFlights.length > 5) {
    priority = Math.min(priority, 2);
  }

  return priority;
}

async function notifySupervisor(supervisor: any, escalation: any): Promise<void> {
  // Mock notification - would send via multiple channels
  console.error(`[ESCALATION] Notifying ${supervisor.name} about ${escalation.escalationId}`);
  console.error(`  Severity: ${escalation.severity}`);
  console.error(`  Situation: ${escalation.situation}`);
  console.error(`  Decision deadline: ${escalation.decisionDeadline}`);
}

async function logEscalation(escalation: any): Promise<void> {
  // Mock audit logging
  console.error(`[AUDIT] Escalation logged: ${escalation.escalationId}`);
}

function getEstimatedResponseTime(severity: string): number {
  return {
    routine: 30,
    urgent: 10,
    critical: 5
  }[severity] || 30;
}

export const escalateToSupervisorSchema = {
  type: "object" as const,
  properties: {
    situation: {
      type: "string" as const,
      description: "Description of the situation requiring escalation"
    },
    severity: {
      type: "string" as const,
      enum: ["routine", "urgent", "critical"],
      description: "Severity level of the situation"
    },
    context: {
      type: "object" as const,
      properties: {
        affectedFlights: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Flight numbers affected"
        },
        affectedCrew: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Crew employee IDs affected"
        },
        estimatedCostImpact: {
          type: "number" as const,
          description: "Estimated cost impact in USD"
        },
        passengerImpact: {
          type: "number" as const,
          description: "Number of passengers affected"
        },
        complianceIssues: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Any compliance or regulatory concerns"
        },
        attemptedActions: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Actions already attempted"
        }
      },
      required: ["affectedFlights", "affectedCrew"]
    },
    requestedBy: {
      type: "string" as const,
      description: "Controller employee ID requesting escalation"
    },
    suggestedActions: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Suggested actions for supervisor consideration"
    },
    timeToDecisionMinutes: {
      type: "number" as const,
      description: "Time available for decision in minutes (default: 30)",
      default: 30
    }
  },
  required: ["situation", "severity", "context", "requestedBy"]
};
