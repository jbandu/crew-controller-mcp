/**
 * log-controller-actions MCP Tool
 * Creates audit trail for controller actions (FAA compliance)
 */

export interface LogControllerActionsInput {
  action: string;
  controllerId: string;
  details: Record<string, any>;
  affectedEntities?: AffectedEntity[];
  severity?: 'info' | 'warning' | 'critical';
  category?: 'crew_assignment' | 'schedule_change' | 'irrops' | 'compliance' | 'other';
}

export interface AffectedEntity {
  entityType: 'crew' | 'flight' | 'aircraft' | 'passenger';
  entityId: string;
  changeType: 'create' | 'update' | 'delete';
}

export async function logControllerActions(
  input: LogControllerActionsInput
): Promise<any> {
  const {
    action,
    controllerId,
    details,
    affectedEntities = [],
    severity = 'info',
    category = 'other'
  } = input;

  const logId = generateLogId();
  const timestamp = new Date().toISOString();

  const logEntry = {
    logId,
    timestamp,
    action,
    controllerId,
    severity,
    category,
    details,
    affectedEntities,
    metadata: {
      source: 'crew-controller-mcp',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'production'
    }
  };

  // In production, this would write to database and audit log system
  await persistLog(logEntry);

  // For FAA compliance, certain actions trigger additional reporting
  if (severity === 'critical' || category === 'compliance') {
    await flagForComplianceReview(logEntry);
  }

  return {
    logId,
    timestamp,
    action,
    status: 'logged',
    retention: {
      retentionPeriodDays: calculateRetentionPeriod(category, severity),
      deleteAfter: calculateDeleteDate(category, severity)
    },
    complianceFlags: severity === 'critical' ? ['FAA_REVIEW_REQUIRED'] : [],
    message: 'Action logged successfully'
  };
}

function generateLogId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `log_${timestamp}_${random}`;
}

async function persistLog(logEntry: any): Promise<void> {
  // Mock persistence - would write to database
  console.error(`[AUDIT LOG] ${JSON.stringify(logEntry)}`);
}

async function flagForComplianceReview(logEntry: any): Promise<void> {
  // Mock compliance flagging - would notify compliance team
  console.error(`[COMPLIANCE FLAG] ${logEntry.logId} requires review`);
}

function calculateRetentionPeriod(category: string, severity: string): number {
  // FAA requires 6 months for most operational records
  if (category === 'compliance') return 2190; // 6 years
  if (category === 'irrops') return 1095; // 3 years
  if (severity === 'critical') return 730; // 2 years
  return 180; // 6 months default
}

function calculateDeleteDate(category: string, severity: string): string {
  const days = calculateRetentionPeriod(category, severity);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export const logControllerActionsSchema = {
  type: "object" as const,
  properties: {
    action: {
      type: "string" as const,
      description: "Description of the action taken"
    },
    controllerId: {
      type: "string" as const,
      description: "Employee ID of the crew controller"
    },
    details: {
      type: "object" as const,
      description: "Detailed information about the action",
      additionalProperties: true
    },
    affectedEntities: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          entityType: {
            type: "string" as const,
            enum: ["crew", "flight", "aircraft", "passenger"]
          },
          entityId: { type: "string" as const },
          changeType: {
            type: "string" as const,
            enum: ["create", "update", "delete"]
          }
        },
        required: ["entityType", "entityId", "changeType"]
      },
      description: "Entities affected by this action"
    },
    severity: {
      type: "string" as const,
      enum: ["info", "warning", "critical"],
      description: "Severity level of the action",
      default: "info"
    },
    category: {
      type: "string" as const,
      enum: ["crew_assignment", "schedule_change", "irrops", "compliance", "other"],
      description: "Action category",
      default: "other"
    }
  },
  required: ["action", "controllerId", "details"]
};
