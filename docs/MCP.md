# Public MCP server

A public, **no-auth** [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes the league's read-only data as tools, so any MCP client
(e.g. a public ChatGPT connector / GPT) can answer questions about the league.

- **Endpoint:** `POST /mcp` (Streamable HTTP) — same origin/host as the app,
  e.g. `https://hockey-schedule.onrender.com/mcp`
- **Auth:** none. It's public read-only data scraped from
  `stats.panthers.timetoscore.com`. No OAuth, no DCR, no auth discovery.
- **Transport:** stateless — a fresh MCP server + transport per request. `GET`
  and `DELETE` on `/mcp` return `405` (no sessions to resume).
- Implemented in [`api/mcp.js`](../api/mcp.js) using
  `@modelcontextprotocol/sdk`; all data comes from the shared scraper in
  [`api/scraper.js`](../api/scraper.js) (the same functions the REST API uses).

## Connect it in ChatGPT

Settings → Connectors → **Add custom connector** (a.k.a. "Add custom MCP"):

- **URL:** `https://hockey-schedule.onrender.com/mcp`
- **Authentication:** **None**

## Tools

| Tool | Input | Maps to (timetoscore) |
| --- | --- | --- |
| `list_rinks` | _(none)_ | static: Panthers IceDen = league 1, Baptist IcePlex = league 4, season 0 |
| `get_standings` | `{ rink? , league? , season?="0" }` | `display-stats.php?league=N&season=0` → `parseDivisions` |
| `get_team_schedule` | `{ team, league, season?="0" }` | `display-schedule?team=&league=&season=&stat_class=1` → `parseSchedule` |
| `get_roster` | `{ team, league, season?="0" }` | `display-schedule?...` → `parseSchedule` (players + goalies) |
| `get_player_stats` | `{ player }` | `display-player-stats.php?player=` → `parsePlayer` |

Each tool returns structured JSON (as both a text block and `structuredContent`).
`team` / `player` are numeric ids surfaced by the other tools; call `list_rinks`
first to learn which `league` to pass.

## Test locally

```bash
npm run dev:api            # starts the server on :3001 (serves /mcp too)
```

Then run the in-memory client test (initialize → tools/list → tools/call for
each tool against live data): see the harness used during development, which
connects an SDK `Client` to `createMcpServer()` over `InMemoryTransport`.
