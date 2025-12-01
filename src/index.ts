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
