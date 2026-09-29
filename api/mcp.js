// Public, no-auth MCP server for the hockey league.
//
// Exposes the timetoscore scraper (api/scraper.js) as read-only MCP tools over
// Streamable HTTP at POST /mcp. It backs a public league GPT, so there is NO
// auth: ChatGPT connects with Authentication = None. Every tool is read-only
// and returns structured JSON scraped live from stats.panthers.timetoscore.com.
import { webcrypto } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// The Streamable HTTP transport uses the Web Crypto global (randomUUID), which
// Node only exposes as globalThis.crypto from v19+. Polyfill it on older runtimes.
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import {
  RINKS,
  getStandings,
  getTeamSchedule,
  getRoster,
  getPlayerStats,
} from './scraper.js';

export const MCP_SERVER_INFO = { name: 'hockey-league', version: '1.0.0' };

// Wrap any JSON-able value as an MCP tool result. We return the data both as a
// human/LLM-readable text block (pretty JSON) and as structuredContent so
// clients that support it get typed data. Errors come back with isError:true
// and a plain message rather than throwing across the transport.
function ok(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}
function fail(err) {
  return {
    content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }],
    isError: true,
  };
}

// Build a fully-configured MCP server with all five read-only tools registered.
// Used both by the HTTP endpoint (fresh server per request, stateless) and by
// the in-memory test client.
export function createMcpServer() {
  const server = new McpServer(MCP_SERVER_INFO, {
    instructions:
      'Read-only access to a local adult hockey league (data scraped live from ' +
      'stats.panthers.timetoscore.com). Two rinks each map to a timetoscore ' +
      '"league" number: Panthers IceDen = league 1, Baptist IcePlex = league 4 ' +
      '(season 0 = current). Call list_rinks first to learn which league/season ' +
      'to pass, then get_standings for division standings, get_team_schedule and ' +
      'get_roster for a team (needs its numeric team id + league), and ' +
      'get_player_stats for a player (needs a numeric player id). Team and player ' +
      'ids come from the results of the other tools.',
  });

  // (1) list_rinks — the two rinks and their league numbers. No upstream call;
  // this is the map the model needs before calling anything else.
  server.registerTool(
    'list_rinks',
    {
      title: 'List rinks',
      description:
        'List the rinks (venues) this league data covers and the timetoscore ' +
        '"league" number + season to use for each. Call this first: the league ' +
        'number it returns is what get_standings / get_team_schedule / get_roster ' +
        'expect. Panthers IceDen = league 1, Baptist IcePlex = league 4, season 0.',
      inputSchema: {},
    },
    async () => {
      try {
        return ok({ rinks: RINKS });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // (2) get_standings — division-grouped standings for a rink/league.
  server.registerTool(
    'get_standings',
    {
      title: 'Get standings',
      description:
        'Get the current division-grouped standings for a rink or league. Pass ' +
        'either rink (e.g. "Panthers IceDen" or "Baptist IcePlex") or league (the ' +
        'numeric id from list_rinks). Returns an array of divisions, each with its ' +
        'stat columns and ranked teams (team name, teamId, and W/L/T/Pts-style ' +
        'stats). Use the returned teamId with get_team_schedule or get_roster.',
      inputSchema: {
        rink: z
          .string()
          .optional()
          .describe('Rink name, e.g. "Panthers IceDen" or "Baptist IcePlex". Provide this OR league.'),
        league: z
          .string()
          .optional()
          .describe('timetoscore league id (e.g. "1" or "4") from list_rinks. Provide this OR rink.'),
        season: z
          .string()
          .optional()
          .describe('Season id; defaults to "0" (the current season).'),
      },
    },
    async ({ rink, league, season }) => {
      try {
        return ok(await getStandings({ rink, league, season: season ?? '0' }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  // (3) get_team_schedule — a team's games + results.
  server.registerTool(
    'get_team_schedule',
    {
      title: 'Get team schedule',
      description:
        "Get a team's full schedule and game results (past and upcoming). Requires " +
        'the numeric team id (from get_standings) and the league id (from ' +
        'list_rinks). Returns the resolved team name and a list of games with date, ' +
        'time, rink, opponent, and score.',
      inputSchema: {
        team: z.string().describe('Numeric team id (from get_standings teamId).'),
        league: z
          .string()
          .describe('timetoscore league id the team plays in (e.g. "1" or "4"), from list_rinks.'),
        season: z.string().optional().describe('Season id; defaults to "0" (current season).'),
      },
    },
    async ({ team, league, season }) => {
      try {
        return ok(await getTeamSchedule({ team, league, season: season ?? '0' }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  // (4) get_roster — a team's skater + goalie stat lines.
  server.registerTool(
    'get_roster',
    {
      title: 'Get team roster',
      description:
        "Get a team's roster with per-player season stats: skaters (players) and " +
        'goalies, each with their stat line and player id. Requires the numeric ' +
        'team id (from get_standings) and the league id (from list_rinks). Use a ' +
        "returned player id with get_player_stats for that player's detail.",
      inputSchema: {
        team: z.string().describe('Numeric team id (from get_standings teamId).'),
        league: z
          .string()
          .describe('timetoscore league id the team plays in (e.g. "1" or "4"), from list_rinks.'),
        season: z.string().optional().describe('Season id; defaults to "0" (current season).'),
      },
    },
    async ({ team, league, season }) => {
      try {
        return ok(await getRoster({ team, league, season: season ?? '0' }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  // (5) get_player_stats — a single player's bio + season/game stats.
  server.registerTool(
    'get_player_stats',
    {
      title: 'Get player stats',
      description:
        "Get a single player's profile: name, bio, per-season summary stats, and " +
        'game-by-game detail. Requires the numeric player id, which comes from ' +
        'get_roster (or a game roster).',
      inputSchema: {
        player: z.string().describe('Numeric player id (from get_roster).'),
      },
    },
    async ({ player }) => {
      try {
        return ok(await getPlayerStats({ player }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}

// Mount POST /mcp on the given Express app as a stateless Streamable HTTP
// endpoint: a fresh server + transport per request (no sessions, no auth), which
// is the simplest correct shape for public read-only tools. GET/DELETE aren't
// used without sessions, so they return 405.
export function registerMcpEndpoint(app, route = '/mcp') {
  const jsonBody = express.json({ limit: '1mb' });

  app.post(route, jsonBody, async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[mcp] request error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const methodNotAllowed = (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. This MCP endpoint is stateless; use POST.' },
      id: null,
    });
  };
  app.get(route, methodNotAllowed);
  app.delete(route, methodNotAllowed);

  return app;
}
