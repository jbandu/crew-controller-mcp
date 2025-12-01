#!/usr/bin/env node

/**
 * Crew Controller MCP Server
 * Real-time crew operations and IRROPS recovery
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { CrewStateService } from './services/crew-state-service.js';
import { mockCrewMembers, mockCrewStates } from './data/mock-crew-data.js';

// Import tool implementations
import {
  validateCrewLegality,
  validateCrewLegalitySchema
} from './tools/validate-crew-legality.js';
import {
  getCrewStatusRealtime,
  getCrewStatusRealtimeSchema
} from './tools/get-crew-status-realtime.js';
import {
  findReplacementCrew,
  findReplacementCrewSchema
} from './tools/find-replacement-crew.js';
import {
  executeCrewSwap,
  executeCrewSwapSchema
} from './tools/execute-crew-swap.js';
import {
  optimizeReserveCallout,
  optimizeReserveCalloutSchema
} from './tools/optimize-reserve-callout.js';
import {
  calculateDelayCascade,
  calculateDelayCascadeSchema
} from './tools/calculate-delay-cascade.js';
import {
  predictCrewDisruptions,
  predictCrewDisruptionsSchema
} from './tools/predict-crew-disruptions.js';
import {
  generateRecoveryPlan,
  generateRecoveryPlanSchema
} from './tools/generate-recovery-plan.js';
import {
  coordinateCrewLogistics,
  coordinateCrewLogisticsSchema
} from './tools/coordinate-crew-logistics.js';
import {
  sendCrewNotifications,
  sendCrewNotificationsSchema
} from './tools/send-crew-notifications.js';
import {
  logControllerActions,
  logControllerActionsSchema
} from './tools/log-controller-actions.js';
import {
  escalateToSupervisor,
  escalateToSupervisorSchema
} from './tools/escalate-to-supervisor.js';

// Initialize services
const crewStateService = new CrewStateService();

// Load mock data
mockCrewMembers.forEach(member => crewStateService.addCrewMember(member));
mockCrewStates.forEach(state => crewStateService.updateCrewState(state));

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'validate-crew-legality',
    description: 'Real-time FAA Part 117 and CBA compliance check for proposed crew duty. ' +
      'Validates if a crew member can legally accept a duty assignment considering ' +
      'flight duty periods, rest requirements, cumulative limits, and fatigue risk. ' +
      'Returns blocking violations, warnings, and detailed recommendations.',
    inputSchema: validateCrewLegalitySchema as any
  },
  {
    name: 'get-crew-status-realtime',
    description: 'Retrieves current duty state and availability for crew members. ' +
      'Can query by employee ID, location (IATA code), or state type (RESERVE, DUTY, etc.). ' +
      'Returns real-time position, availability, cumulative hours, and status flags ' +
      'like approaching timeout or fatigue risk.',
    inputSchema: getCrewStatusRealtimeSchema as any
  },
  {
    name: 'find-replacement-crew',
    description: 'Finds legal crew replacements for a flight position within seconds. ' +
      'Searches reserve pool and optionally includes deadhead options. ' +
      'Returns ranked candidates with legality checks, logistics, costs, and recommendations. ' +
      'Critical for IRROPS recovery with <10 second response time.',
    inputSchema: findReplacementCrewSchema as any
  },
  {
    name: 'execute-crew-swap',
    description: 'Executes a crew swap transaction with rollback capability. ' +
      'Removes original crew from flight and assigns replacement crew. ' +
      'Updates duty states, sends notifications, and creates audit trail. ' +
      'Supports dry-run mode for previewing changes before execution.',
    inputSchema: executeCrewSwapSchema as any
  },
  {
    name: 'optimize-reserve-callout',
    description: 'Determines optimal reserve usage order based on cost, fairness, or seniority. ' +
      'Ranks available reserves considering utilization, fatigue, and equitable distribution. ' +
      'Helps controllers make fair and cost-effective reserve callout decisions.',
    inputSchema: optimizeReserveCalloutSchema as any
  },
  {
    name: 'calculate-delay-cascade',
    description: 'Calculates downstream crew impact of flight delays. ' +
      'Identifies crew timeout risks, downstream connection misses, and hotel needs. ' +
      'Provides severity assessment, cost estimates, and actionable recommendations. ' +
      'Critical for proactive IRROPS management.',
    inputSchema: calculateDelayCascadeSchema as any
  },
  {
    name: 'predict-crew-disruptions',
    description: 'ML-based prediction of crew disruptions (sick calls, no-shows, timeouts). ' +
      'Analyzes fatigue patterns, duty hours, and historical data to predict disruptions 2-4 hours ahead. ' +
      'Enables proactive backup crew positioning and preventive actions.',
    inputSchema: predictCrewDisruptionsSchema as any
  },
  {
    name: 'generate-recovery-plan',
    description: 'Multi-flight crew recovery optimization during IRROPS. ' +
      'Generates comprehensive recovery plans with prioritized actions, cost analysis, and success probability. ' +
      'Compares baseline vs. optimized scenarios and identifies dependencies between actions.',
    inputSchema: generateRecoveryPlanSchema as any
  },
  {
    name: 'coordinate-crew-logistics',
    description: 'Manages hotels, ground transport, and meal vouchers for crew during irregular operations. ' +
      'Books accommodations, arranges transportation, and issues meal allowances. ' +
      'Supports routine, expedited, and emergency booking priorities.',
    inputSchema: coordinateCrewLogisticsSchema as any
  },
  {
    name: 'send-crew-notifications',
    description: 'Sends notifications to crew via SMS, email, and app push. ' +
      'Supports multi-channel delivery with priority levels and optional confirmation tracking. ' +
      'Critical for time-sensitive crew communications during schedule changes.',
    inputSchema: sendCrewNotificationsSchema as any
  },
  {
    name: 'log-controller-actions',
    description: 'Creates audit trail for controller actions (FAA compliance). ' +
      'Logs all crew assignments, schedule changes, and IRROPS actions with retention policies. ' +
      'Automatically flags critical actions for compliance review.',
    inputSchema: logControllerActionsSchema as any
  },
  {
    name: 'escalate-to-supervisor',
    description: 'Escalates complex situations to senior controller or supervisor. ' +
      'Routes issues based on severity, assembles context package, and tracks decision deadlines. ' +
      'Ensures proper oversight for high-impact operational decisions.',
    inputSchema: escalateToSupervisorSchema as any
  }
];

// Create MCP server
const server = new Server(
  {
    name: 'crew-controller-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'validate-crew-legality': {
        const result = await validateCrewLegality(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get-crew-status-realtime': {
        const result = await getCrewStatusRealtime(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'find-replacement-crew': {
        const result = await findReplacementCrew(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'execute-crew-swap': {
        const result = await executeCrewSwap(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'optimize-reserve-callout': {
        const result = await optimizeReserveCallout(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'calculate-delay-cascade': {
        const result = await calculateDelayCascade(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'predict-crew-disruptions': {
        const result = await predictCrewDisruptions(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'generate-recovery-plan': {
        const result = await generateRecoveryPlan(args as any, crewStateService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'coordinate-crew-logistics': {
        const result = await coordinateCrewLogistics(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'send-crew-notifications': {
        const result = await sendCrewNotifications(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'log-controller-actions': {
        const result = await logControllerActions(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'escalate-to-supervisor': {
        const result = await escalateToSupervisor(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: error.message,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup to stderr (stdout is reserved for MCP protocol)
  console.error('Crew Controller MCP Server started');
  console.error('Version: 0.1.0');
  console.error(`Loaded ${mockCrewMembers.length} crew members`);
  console.error(`Loaded ${mockCrewStates.length} crew states`);
  console.error('Available tools:');
  TOOLS.forEach(tool => {
    console.error(`  - ${tool.name}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
