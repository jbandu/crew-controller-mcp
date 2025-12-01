# Testing Guide for crew-controller-mcp

## Quick Test

To verify the server starts properly:

```bash
cd /home/jbandu/workspace/crew-controller-mcp
node dist/index.js
```

You should see output like:
```
Crew Controller MCP Server started
Version: 0.1.0
Loaded 5 crew members
Loaded 5 crew states
Available tools:
  - validate-crew-legality
  - get-crew-status-realtime
  - find-replacement-crew
```

Press Ctrl+C to exit.

## Testing with MCP Inspector

The MCP Inspector provides a visual interface for testing MCP servers:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This will:
1. Start the MCP server
2. Open a web interface (usually http://localhost:5173)
3. Let you call tools interactively

## Example Test Cases

### Test 1: Get Crew Status for a Reserve

**Tool**: `get-crew-status-realtime`

**Input**:
```json
{
  "employeeId": "10002"
}
```

**Expected Output**: Should show Sarah Johnson (FO) on RESERVE status at ORD

---

### Test 2: Find All Reserves at ORD

**Tool**: `get-crew-status-realtime`

**Input**:
```json
{
  "stateType": "RESERVE"
}
```

**Expected Output**: Should return 3 crew members (10002, 10004, 10005)

---

### Test 3: Validate Crew Legality

**Tool**: `validate-crew-legality`

**Input**:
```json
{
  "employeeId": "10002",
  "proposedDuty": {
    "flights": [
      {
        "flightNumber": "TEST101",
        "departureUtc": "2024-12-15T14:00:00Z",
        "arrivalUtc": "2024-12-15T18:00:00Z",
        "origin": "ORD",
        "destination": "LAX",
        "flightTimeHours": 4.0
      }
    ],
    "startTimeUtc": "2024-12-15T13:00:00Z",
    "endTimeUtc": "2024-12-15T18:30:00Z",
    "reportTimeUtc": "2024-12-15T13:00:00Z"
  },
  "checkCategories": ["part117", "fatigue_risk"]
}
```

**Expected Output**: Should return `isLegal: true` with no violations

---

### Test 4: Find Replacement Crew

**Tool**: `find-replacement-crew`

**Input**:
```json
{
  "flightNumber": "AA1234",
  "position": "FO",
  "departureTimeUtc": "2024-12-15T14:00:00Z",
  "base": "ORD",
  "aircraftType": "B737",
  "maxResults": 3
}
```

**Expected Output**: Should return ranked candidates (10002, 10005 are eligible FOs)

---

### Test 5: Edge Case - Crew Timing Out

**Tool**: `validate-crew-legality`

**Input** (14-hour duty - should FAIL):
```json
{
  "employeeId": "10002",
  "proposedDuty": {
    "flights": [
      {
        "flightNumber": "TEST999",
        "departureUtc": "2024-12-15T06:00:00Z",
        "arrivalUtc": "2024-12-15T19:00:00Z",
        "origin": "ORD",
        "destination": "HNL",
        "flightTimeHours": 9.0
      }
    ],
    "startTimeUtc": "2024-12-15T05:00:00Z",
    "endTimeUtc": "2024-12-15T19:00:00Z",
    "reportTimeUtc": "2024-12-15T05:00:00Z"
  }
}
```

**Expected Output**: Should return `isLegal: false` with Part 117.25(d) violation (FDP exceeds 13 hours)

---

## Integration with Claude Desktop

1. Copy the configuration from `example-config.json`
2. Add it to your Claude Desktop config:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

3. Restart Claude Desktop

4. Ask Claude:
   ```
   Can you show me all reserve crew at ORD?
   ```

Claude should use the `get-crew-status-realtime` tool automatically.

## Mock Data Reference

### Crew Members

| Employee ID | Name | Position | Base | Status |
|-------------|------|----------|------|--------|
| 10001 | Smith, John | CA | ORD | On duty (DFW) |
| 10002 | Johnson, Sarah | FO | ORD | Reserve |
| 10003 | Chen, Michael | CA | ORD | Day off |
| 10004 | Rodriguez, Emily | FA | ORD | Reserve |
| 10005 | Williams, David | FO | ORD | Reserve |

### Key Statistics

- **10002 (Johnson)**: Fresh crew, 38.5 hours monthly, 2 consecutive days
- **10005 (Williams)**: Very fresh, 22.3 hours monthly, 1 consecutive day
- **10001 (Smith)**: Higher hours, 62.3 monthly, 3 consecutive days (may have warnings)

## Common Issues

### Server Won't Start

**Symptom**: Error about missing modules
**Fix**:
```bash
rm -rf node_modules dist
npm install
npm run build
```

### TypeScript Errors

**Symptom**: Build fails with type errors
**Fix**: Ensure TypeScript version matches:
```bash
npm install typescript@^5.7.2 --save-dev
```

### MCP Inspector Can't Connect

**Symptom**: Browser shows connection error
**Fix**:
- Check server is running: `ps aux | grep crew-controller`
- Try different port: `PORT=5174 npx @modelcontextprotocol/inspector ...`

## Performance Benchmarks

Expected response times (on typical hardware):
- `get-crew-status-realtime`: <5ms
- `validate-crew-legality`: <10ms
- `find-replacement-crew`: <500ms (with mock data)

## Next Steps

After basic testing works:
1. Try complex scenarios (multiple flights, WOCL violations)
2. Test with real-world data from your airline
3. Integrate with actual crew tracking systems
4. Add custom business rules to legality engine

## Debugging

Enable verbose logging:
```bash
DEBUG=* node dist/index.js 2>&1 | tee server.log
```

Check tool responses:
```bash
# Server logs go to stderr, so they won't interfere with MCP protocol
tail -f server.log
```
