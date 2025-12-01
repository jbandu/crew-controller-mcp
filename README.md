# Crew Controller MCP Server

**Real-time crew operations and IRROPS recovery for airline operations**

An MCP (Model Context Protocol) server providing crew scheduling, legality checking, and disruption recovery tools for airline crew controllers. Built specifically for high-pressure, day-of-operations scenarios requiring sub-10-second response times.

## Overview

The Crew Controller MCP Server enables AI agents to perform critical crew operations tasks:

- **Real-time legality validation** against FAA Part 117 regulations
- **Crew availability queries** by location, state, or employee ID
- **Intelligent crew replacement** finding with cost and legality ranking
- **IRROPS recovery support** with rapid crew reassignment capabilities

## Installation

```bash
cd crew-controller-mcp
npm install
npm run build
```

## Running the Server

```bash
npm start
```

The server runs using stdio transport for MCP communication.

## Configuration with Claude Desktop

Add to your Claude Desktop MCP configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "crew-controller": {
      "command": "node",
      "args": ["/absolute/path/to/crew-controller-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### 1. validate-crew-legality

**Purpose**: Real-time FAA Part 117 compliance checking for proposed crew duties.

**Use Cases**:
- Verify crew can legally accept a swap or callout
- Pre-validate assignments before execution
- Audit trail generation for FAA compliance

**Example**:

```json
{
  "employeeId": "10002",
  "proposedDuty": {
    "flights": [
      {
        "flightNumber": "AA1001",
        "departureUtc": "2024-12-15T14:00:00Z",
        "arrivalUtc": "2024-12-15T17:30:00Z",
        "origin": "ORD",
        "destination": "LAX",
        "flightTimeHours": 4.0
      }
    ],
    "startTimeUtc": "2024-12-15T13:00:00Z",
    "endTimeUtc": "2024-12-15T18:00:00Z",
    "reportTimeUtc": "2024-12-15T13:00:00Z"
  },
  "checkCategories": ["part117", "fatigue_risk"]
}
```

**Response**:

```json
{
  "employeeId": "10002",
  "isLegal": true,
  "violations": [],
  "warnings": [
    {
      "category": "fatigue_risk",
      "rule": "FRMS_WOCL",
      "description": "Duty overlaps Window of Circadian Low"
    }
  ],
  "checksPerformed": ["part117", "fatigue_risk"],
  "crewCurrentState": {
    "location": "ORD",
    "stateType": "RESERVE",
    "dutyHoursMonth": 28.2,
    "flightHoursMonth": 38.5,
    "consecutiveDutyDays": 2
  },
  "proposedDutyHours": 5.0,
  "proposedFlightHours": 4.0,
  "timestamp": "2024-12-01T12:00:00Z",
  "auditLogId": "audit_20241201_120000_abc123"
}
```

**Key Features**:
- Checks flight duty period limits (FAA 117.25)
- Validates rest requirements (FAA 117.25b)
- Cumulative limits (28-day, 365-day)
- WOCL (Window of Circadian Low) exposure warnings
- Fatigue risk assessment

---

### 2. get-crew-status-realtime

**Purpose**: Query current duty state and availability for crew members.

**Use Cases**:
- Check reserve availability during IRROPS
- Monitor crew approaching duty timeout
- Find all crew at a specific station
- Identify high-risk fatigue situations

**Query by Employee ID**:

```json
{
  "employeeId": "10002"
}
```

**Query by Location**:

```json
{
  "location": "ORD"
}
```

**Query by State Type**:

```json
{
  "stateType": "RESERVE"
}
```

**Response**:

```json
{
  "crew": [
    {
      "employeeId": "10002",
      "currentState": {
        "type": "RESERVE",
        "startUtc": "2024-12-01T08:00:00Z",
        "endUtc": "2024-12-01T20:00:00Z",
        "hoursRemaining": "8.0"
      },
      "location": "ORD",
      "availability": {
        "isAvailable": true,
        "nextAvailableUtc": null,
        "checkInStatus": "OK"
      },
      "limits": {
        "dutyHoursCumulative": 28.2,
        "flightHoursMonth": 38.5,
        "flightHoursYear": 512.3,
        "consecutiveDutyDays": 2
      },
      "flags": ["FRESH_CREW"]
    }
  ],
  "count": 1,
  "timestamp": "2024-12-01T12:00:00Z"
}
```

**Status Flags**:
- `UNAVAILABLE_SICK` - Crew member on sick leave
- `UNAVAILABLE_VACATION` - Crew member on vacation
- `APPROACHING_TIMEOUT` - Less than 2 hours duty remaining
- `HIGH_MONTHLY_HOURS` - Over 90 hours this month
- `FATIGUE_RISK` - 5+ consecutive duty days
- `FRESH_CREW` - Less than 10 hours duty cumulative

---

### 3. find-replacement-crew

**Purpose**: Find legal crew replacements for a flight position with intelligent ranking.

**Use Cases**:
- Sick call coverage (<10 minute resolution)
- Crew timeout replacement
- IRROPS recovery crew assignment
- Reserve pool optimization

**Example**:

```json
{
  "flightNumber": "AA1001",
  "position": "FO",
  "departureTimeUtc": "2024-12-15T14:00:00Z",
  "base": "ORD",
  "aircraftType": "B737",
  "maxResults": 5,
  "includeDeadheadOptions": true
}
```

**Response**:

```json
{
  "flightNumber": "AA1001",
  "position": "FO",
  "departureTimeUtc": "2024-12-15T14:00:00Z",
  "candidates": [
    {
      "employeeId": "10005",
      "name": "Williams, David",
      "legality": {
        "isLegal": true,
        "dutyRemainingHours": 13.0,
        "restCompliant": true,
        "currencyValid": true,
        "violations": [],
        "warnings": []
      },
      "logistics": {
        "currentLocation": "ORD",
        "positioningRequired": false,
        "readyTimeUtc": "2024-12-15T14:00:00Z",
        "travelTimeMinutes": 0
      },
      "cost": {
        "payCredit": 5.0,
        "perDiem": 16.25,
        "deadheadCost": 0,
        "hotelCost": 0,
        "overtimePremium": 0,
        "totalUsd": 516.25
      },
      "rankScore": 95,
      "recommendation": "EXCELLENT: Optimal crew choice with no concerns"
    }
  ],
  "searchMetadata": {
    "searchedCount": 15,
    "legalCount": 1,
    "responseTimeMs": 8456,
    "basesSearched": ["ORD"],
    "includesDeadheads": true
  },
  "recommendations": [
    "Multiple good options available"
  ]
}
```

**Ranking Algorithm**:
- Base score: 100 points
- Deductions:
  - -5 points per warning
  - -10 points for cost > $1000
  - -15 points for overtime premium
- Bonuses:
  - +10 points for low cumulative duty hours
  - +5 points for fresh crew (<3 consecutive days)

**Recommendation Levels**:
- **EXCELLENT** (90-100): Optimal choice
- **GOOD** (75-89): Suitable with minor considerations
- **ACCEPTABLE** (60-74): Legal but check warnings
- **USE WITH CAUTION** (<60): Legal but multiple concerns

---

## Architecture

```
crew-controller-mcp/
├── src/
│   ├── index.ts                 # Main MCP server
│   ├── types/
│   │   ├── crew.ts              # Crew data types
│   │   └── compliance.ts        # FAA Part 117 types
│   ├── services/
│   │   ├── legality-engine.ts   # Part 117 rules engine
│   │   └── crew-state-service.ts # Crew state management
│   ├── tools/
│   │   ├── validate-crew-legality.ts
│   │   ├── get-crew-status-realtime.ts
│   │   └── find-replacement-crew.ts
│   └── data/
│       └── mock-crew-data.ts    # Test data
├── package.json
├── tsconfig.json
└── README.md
```

## Mock Data

The server includes 5 mock crew members with realistic duty states:

- **Employee 10001** (CA, ORD): On duty, flying DFW
- **Employee 10002** (FO, ORD): Reserve, available
- **Employee 10003** (CA, ORD): Day off
- **Employee 10004** (FA, ORD): Reserve, available
- **Employee 10005** (FO, ORD): Reserve, fresh crew

All crew are based at ORD with B737 qualifications.

## FAA Part 117 Rules Implemented

### Flight Duty Period Limits
- **117.25(d)**: Maximum 13-hour FDP (simplified, varies by acclimatization)
- **117.11(a)**: Maximum 9 hours flight time within FDP

### Rest Requirements
- **117.25(b)**: Minimum 10 hours rest between duties
- Extended rest (12 hours) after 3+ consecutive duty days

### Cumulative Limits
- **117.23(b)**: 100 flight hours per 28 days
- **117.23(b)**: 1000 flight hours per 365 days
- 60 duty hours per 168 hours

### Fatigue Risk Management
- WOCL exposure detection (2am-6am local time)
- Consecutive duty day tracking
- Long duty period warnings (>11 hours)

## Integration Examples

### Use Case: Sick Call Recovery

```typescript
// 1. Check reserve pool
const reserves = await getCrewStatusRealtime({
  stateType: "RESERVE",
  location: "ORD"
});

// 2. Find replacement for sick crew
const candidates = await findReplacementCrew({
  flightNumber: "AA1234",
  position: "FO",
  departureTimeUtc: "2024-12-15T14:00:00Z",
  base: "ORD",
  aircraftType: "B737",
  maxResults: 3
});

// 3. Validate top candidate
const validation = await validateCrewLegality({
  employeeId: candidates[0].employeeId,
  proposedDuty: { /* duty details */ }
});

// 4. Execute swap (external system integration)
```

### Use Case: IRROPS Recovery

```typescript
// Flight delayed, crew timing out
const crewStatus = await getCrewStatusRealtime({
  employeeId: "10001"
});

if (crewStatus.flags.includes("APPROACHING_TIMEOUT")) {
  // Find immediate replacement
  const replacements = await findReplacementCrew({
    flightNumber: "AA1234",
    position: "CA",
    departureTimeUtc: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    base: "DFW",
    aircraftType: "B737"
  });
}
```

## Performance

- **validate-crew-legality**: ~5ms (in-memory rules engine)
- **get-crew-status-realtime**: ~2ms (indexed queries)
- **find-replacement-crew**: <10 seconds (meets operational SLA)

## Future Enhancements

### Phase 2 Features
- [ ] Real database integration (PostgreSQL + Redis)
- [ ] execute-crew-swap transaction handling
- [ ] Multi-base deadhead search
- [ ] Union CBA rules integration
- [ ] predict-crew-disruptions ML model

### Phase 3 Features
- [ ] Event-driven architecture (NATS/Kafka)
- [ ] IRROPS orchestrator coordination
- [ ] Cross-MCP communication (aircraft, baggage)
- [ ] Real-time cost tracking
- [ ] Historical analytics

### Data Integrations Needed
- Crew tracking system APIs (IBS, NAVBLUE, Sabre)
- Flight operations system
- Hotel/vendor booking systems
- Notification services (SMS, email, app push)

## Development

### Run in Development Mode

```bash
npm run dev
```

### Type Checking

```bash
npx tsc --noEmit
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT

## Contributing

This is an initial MVP. Contributions welcome, especially:
- Additional FAA Part 117 rules (acclimatization, augmented crews)
- Union CBA rule engines
- Real-world data integration examples
- Performance optimizations

## Support

For issues or questions about MCP integration, see:
- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

For aviation operations questions, consult:
- [FAA Part 117](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117)
- Your airline's crew scheduling policies
