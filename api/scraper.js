// Shared scraper for stats.panthers.timetoscore.com.
//
// Both the REST API (server.js) and the public MCP server (api/mcp.js) call
// these functions, so the parsing logic lives in exactly one place. The parse*
// helpers are pure ($ -> data); the get* helpers fetch + parse and are the
// high-level surface the MCP tools expose.
import * as cheerio from 'cheerio';

export const ROOT = 'https://stats.panthers.timetoscore.com';

// The two rinks this app covers. Mirrors src/brand.ts RINKS. Season 0 is the
// current season on timetoscore, so every tool defaults to it.
export const RINKS = [
  {
    name: 'Panthers IceDen',
    league: '1',
    season: '0',
    blurb: 'IceDen Adult League · standings & schedules',
  },
  {
    name: 'Baptist IcePlex',
    league: '4',
    season: '0',
    blurb: 'BH Adult League · standings & schedules',
  },
];

// Resolve a { rink?, league? } selector to a league id. Accepts a league id
// directly, a rink display name (case-insensitive), or a fuzzy rink match
// (e.g. "iceden", "baptist"). Throws with a helpful message if neither works.
export function resolveLeague({ rink, league } = {}) {
  if (league != null && String(league).trim() !== '') return String(league).trim();
  if (rink != null && String(rink).trim() !== '') {
    const q = String(rink).trim().toLowerCase();
    const match =
      RINKS.find((r) => r.name.toLowerCase() === q) ||
      RINKS.find((r) => r.league === q) ||
      RINKS.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase())) ||
      RINKS.find((r) => q.includes(r.name.split(' ')[0].toLowerCase())) ||
      RINKS.find((r) => q.includes(r.name.split(' ')[1]?.toLowerCase() ?? '\0'));
    if (match) return match.league;
    throw new Error(
      `Unknown rink "${rink}". Use list_rinks to see valid rinks, or pass a league id. Known rinks: ${RINKS.map((r) => `${r.name} (league ${r.league})`).join(', ')}.`,
    );
  }
  throw new Error('Provide a "rink" name or a "league" id. Call list_rinks to see the options.');
}

export function clean(text) {
  return (text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ─── High-level scraper helpers (fetch + parse) ──────────────────────────────

// Division-grouped standings for a rink/league (display-stats.php?league=N&season=0).
export async function getStandings({ rink, league, season = '0' } = {}) {
  const leagueId = resolveLeague({ rink, league });
  const $ = cheerio.load(await fetchHtml(`${ROOT}/display-stats.php?league=${leagueId}&season=${season}`));
  return {
    league: leagueId,
    season: String(season),
    rink: RINKS.find((r) => r.league === leagueId)?.name ?? null,
    divisions: parseDivisions($),
  };
}

// A team's schedule + results (display-schedule?team=&season=&league=&stat_class=).
export async function getTeamSchedule({ team, league = '1', season = '0', stat_class = '1' }) {
  if (!team) throw new Error('team is required');
  const $ = cheerio.load(
    await fetchHtml(`${ROOT}/display-schedule?team=${team}&season=${season}&league=${league}&stat_class=${stat_class}`),
  );
  const { teamName, games } = parseSchedule($);
  return { team: String(team), league: String(league), season: String(season), teamName, games };
}

// A team's roster (skater + goalie stat lines from the same schedule page).
export async function getRoster({ team, league = '1', season = '0', stat_class = '1' }) {
  if (!team) throw new Error('team is required');
  const $ = cheerio.load(
    await fetchHtml(`${ROOT}/display-schedule?team=${team}&season=${season}&league=${league}&stat_class=${stat_class}`),
  );
  const { teamName, players, goalies } = parseSchedule($);
  return { team: String(team), league: String(league), season: String(season), teamName, players, goalies };
}

// A single player's bio + season/game stats (display-player-stats.php?player=).
export async function getPlayerStats({ player }) {
  if (!player) throw new Error('player is required');
  const $ = cheerio.load(await fetchHtml(`${ROOT}/display-player-stats.php?player=${player}`));
  return { player: String(player), ...parsePlayer($) };
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

export function parseSchedule($) {
  const games = [];
  const players = [];
  const goalies = [];
  const teamStats = {};

  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length < 2) return;
    const titleText = clean($(rows[0]).find('th').first().text()).toLowerCase();

    if (titleText === 'game results') {
      rows.slice(2).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 9) return;

        const awayTeam = clean($(cells[6]).text());
        const homeTeam = clean($(cells[8]).text());

        const gameId = $(cells[0]).find('a').attr('href')?.match(/game_id=(\d+)/)?.[1]
          || clean($(cells[0]).text()).replace('*', '');

        const dateRaw = clean($(cells[1]).text());
        if (!dateRaw) return;

        games.push({
          gameId,
          gameNumber: clean($(cells[0]).text()).replace('*', ''),
          date: dateRaw,
          time: clean($(cells[2]).text()),
          rink: clean($(cells[3]).text()),
          league: clean($(cells[4]).text()),
          level: clean($(cells[5]).text()),
          awayTeam,
          awayGoals: clean($(cells[7]).text()),
          homeTeam,
          homeGoals: clean($(cells[9]).text()),
          type: clean($(cells[10]).text()),
          scoresheetUrl: $(cells[11]).find('a').attr('href') || null,
          hasScoresheet: !!$(cells[11]).find('a').attr('href'),
        });
      });
    }

    else if (titleText === 'player stats') {
      const colHeaders = [];
      $(rows[1]).find('th').each((_, th) => colHeaders.push(clean($(th).text())));
      rows.slice(2).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        const playerData = {};
        colHeaders.forEach((h, i) => { playerData[h] = clean($(cells[i])?.text() || ''); });
        const playerId = $(cells[0]).find('a').attr('href')?.match(/player=(\d+)/)?.[1] || null;
        if (playerId) playerData._playerId = playerId;
        if (playerData['Name']) players.push(playerData);
      });
    }

    else if (titleText === 'goalie stats') {
      const colHeaders = [];
      $(rows[1]).find('th').each((_, th) => colHeaders.push(clean($(th).text())));
      rows.slice(2).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        const goalieData = {};
        colHeaders.forEach((h, i) => { goalieData[h] = clean($(cells[i])?.text() || ''); });
        const playerId = $(cells[0]).find('a').attr('href')?.match(/player=(\d+)/)?.[1] || null;
        if (playerId) goalieData._playerId = playerId;
        if (goalieData['Name']) goalies.push(goalieData);
      });
    }

    else if (titleText === 'team stats' || titleText.includes('power play') || titleText.includes('penalty')) {
      rows.slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const label = clean($(cells[0]).text());
        const value = clean($(cells[1]).text());
        if (label) teamStats[label] = value;
      });
    }
  });

  // The target team appears in every game (home or away); opponents appear only once or twice
  const nameCounts = {};
  games.forEach(g => {
    if (g.awayTeam) nameCounts[g.awayTeam] = (nameCounts[g.awayTeam] || 0) + 1;
    if (g.homeTeam) nameCounts[g.homeTeam] = (nameCounts[g.homeTeam] || 0) + 1;
  });
  const teamName = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  return { teamName, games, players, goalies, teamStats };
}

export function parseGame($, gameId) {
  const result = {
    gameId,
    info: {},          // date, time, location, league, level
    score: [],         // [{side, team, p1, p2, p3, ot, so, final}]
    scoring: [],       // [{per, time, type, team, goal, ass1, ass2}]
    penalties: [],     // [{per, team, number, infraction, min}]
    rosters: {},       // {teamName: [{#, pos, name}, ...]}
  };

  // Scoring and penalty tables appear twice (one per team): visitor first, home second
  let scoringCount = 0;
  let penaltyCount = 0;

  $('table').each((tableIdx, table) => {
    const rows = $(table).find('tr');
    if (rows.length < 1) return;

    const firstThText = clean($(rows[0]).find('th').first().text());
    const titleLower = firstThText.toLowerCase();

    // ── Score by period (Table with "Team Name" header) ──
    if (firstThText === 'Team Name') {
      rows.slice(1).each((_, row) => {
        // Use th,td — "Visitor"/"Home" label is a <th>, rest are <td>
        const cells = $(row).find('th, td');
        if (cells.length < 4) return;
        const side = clean($(cells[0]).text());   // "Visitor" or "Home"
        const team = clean($(cells[1]).text());
        if (!team || side.toLowerCase().startsWith('period')) return;
        result.score.push({
          side,
          team,
          p1: clean($(cells[2]).text()),
          p2: clean($(cells[3]).text()),
          p3: clean($(cells[4]).text()),
          ot: clean($(cells[5]).text()),
          so: clean($(cells[6]).text()),
          final: clean($(cells[7]).text()),
        });
      });
    }

    // ── Scoring (goals) ──
    // HTML columns: Per | Time | [Strength: EN/PP/SH/etc] | Goal# | Ass.1 | Ass.2
    // Two tables: first = Visitor, second = Home
    else if (firstThText === 'Scoring') {
      const teamName = scoringCount === 0
        ? (result.score.find(s => s.side === 'Visitor')?.team || '')
        : (result.score.find(s => s.side === 'Home')?.team || '');
      scoringCount++;

      rows.slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) return;
        const per = clean($(cells[0]).text());
        if (!per) return;
        result.scoring.push({
          per,
          time: clean($(cells[1]).text()),
          type: clean($(cells[2]).text()),   // EN, PP, SH, 5on3, etc. — empty = even strength
          team: teamName,
          goal: clean($(cells[3]).text()),
          ass1: clean($(cells[4])?.text() || ''),
          ass2: clean($(cells[5])?.text() || ''),
        });
      });
    }

    // ── Penalties ──
    // HTML columns: Per | # | Infraction | Min | Off Ice | Start | End | On Ice
    // Two tables: first = Visitor, second = Home
    else if (firstThText === 'Penalties') {
      const teamName = penaltyCount === 0
        ? (result.score.find(s => s.side === 'Visitor')?.team || '')
        : (result.score.find(s => s.side === 'Home')?.team || '');
      penaltyCount++;

      rows.slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        const per = clean($(cells[0]).text());
        if (!per) return;
        result.penalties.push({
          per,
          time: clean($(cells[5])?.text() || ''),  // Start time of penalty
          team: teamName,
          number: clean($(cells[1]).text()),         // jersey #
          infraction: clean($(cells[2]).text()),
          min: clean($(cells[3])?.text() || ''),
        });
      });
    }

    // ── Rosters ──
    else if (titleLower.includes('players in game')) {
      const teamLabel = firstThText.split(' Players')[0].trim();
      // Roster cols come in pairs: #, Pos, Name, #, Pos, Name (two columns side by side)
      const skaters = [];
      rows.slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        // Left column
        const num1 = clean($(cells[0]).text());
        const pos1 = clean($(cells[1]).text());
        const name1 = clean($(cells[2]).text());
        if (name1) skaters.push({ '#': num1, pos: pos1, name: name1 });
        // Right column
        if (cells.length >= 6) {
          const num2 = clean($(cells[3]).text());
          const pos2 = clean($(cells[4]).text());
          const name2 = clean($(cells[5]).text());
          if (name2) skaters.push({ '#': num2, pos: pos2, name: name2 });
        }
      });
      if (skaters.length) result.rosters[teamLabel] = skaters;
    }

    // ── Game info (date, time, location) from misc cells ──
    else if (titleLower === 'scorekeeper' || titleLower === '') {
      rows.each((_, row) => {
        $(row).find('td').each((_, cell) => {
          const text = clean($(cell).text());
          if (text.startsWith('Date:')) result.info.date = text.replace('Date:', '');
          else if (text.startsWith('Time:')) result.info.time = text.replace('Time:', '');
          else if (text.startsWith('Location:')) result.info.location = text.replace('Location:', '').trim();
          else if (text.startsWith('League:')) result.info.league = text.replace('League:', '').trim();
          else if (text.startsWith('Level:')) result.info.level = text.replace('Level:', '').trim();
        });
      });
    }
  });

  // Sort by period (then preserve insertion order within same period)
  result.scoring.sort((a, b) => (parseInt(a.per) || 99) - (parseInt(b.per) || 99));
  result.penalties.sort((a, b) => (parseInt(a.per) || 99) - (parseInt(b.per) || 99));

  return result;
}

export function parsePlayer($) {
  const result = { name: '', bio: {}, seasons: [], games: [] };

  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length < 1) return;

    const firstThText = clean($(rows[0]).find('th').first().text());
    const titleLower = firstThText.toLowerCase();

    // Player name — first th that looks like a name (not a stat label)
    if (!result.name && firstThText && !titleLower.includes('stat') && !titleLower.includes('team') && !titleLower.includes('season') && rows.length >= 2) {
      const bioHeaders = [];
      const bioValues = [];
      $(rows[0]).find('th').each((_, th) => bioHeaders.push(clean($(th).text())));
      $(rows[1]).find('td').each((_, td) => bioValues.push(clean($(td).text())));

      if (bioHeaders[0] && bioHeaders[0] !== 'Team') {
        result.name = bioHeaders[0];
        // remaining headers are bio fields
        bioHeaders.slice(1).forEach((h, i) => {
          if (h && bioValues[i]) result.bio[h] = bioValues[i];
        });
      }
    }

    // Summary stats
    else if (titleLower.includes('summary')) {
      const headers = [];
      $(rows[1])?.find('th').each((_, th) => headers.push(clean($(th).text())));
      rows.slice(2).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const entry = {};
        headers.forEach((h, i) => { entry[h] = clean($(cells[i])?.text() || ''); });
        if (Object.values(entry).some(v => v)) result.seasons.push(entry);
      });
    }

    // Detailed game-by-game stats
    else if (titleLower.includes('detailed')) {
      const headers = [];
      $(rows[1])?.find('th').each((_, th) => headers.push(clean($(th).text())));
      rows.slice(2).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const entry = {};
        headers.forEach((h, i) => { entry[h] = clean($(cells[i])?.text() || ''); });
        if (Object.values(entry).some(v => v)) result.games.push(entry);
      });
    }
  });

  return result;
}

export function parseLeague($, league, season) {
  const byId = {};   // teamId -> entry (deduped)
  const order = [];  // preserve first-seen order
  const levels = [];

  function upsert(teamId, fields, level) {
    if (!teamId) return;
    if (!byId[teamId]) { byId[teamId] = { _teamId: teamId }; order.push(teamId); }
    const entry = byId[teamId];
    Object.entries(fields).forEach(([k, v]) => { if (v && !entry[k]) entry[k] = v; });
    if (level && !entry._level) entry._level = level;
  }

  // 1) Standings-style tables (league pages that list W/L/T/Pts per team).
  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length < 2) return;
    const titleText = clean($(rows[0]).find('th').first().text());
    const titleLower = titleText.toLowerCase();

    if (titleLower.includes('team') || titleLower.includes('standing') || titleLower.includes('division') || titleLower.includes('level')) {
      const headers = [];
      $(rows[1]).find('th').each((_, th) => headers.push(clean($(th).text())));

      rows.slice(2).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const entry = {};
        headers.forEach((h, i) => { entry[h] = clean($(cells[i])?.text() || ''); });
        const teamId = $(cells[0]).find('a').attr('href')?.match(/team=(\d+)/)?.[1] || null;
        if (teamId) upsert(teamId, entry, titleText);
      });

      if (!levels.includes(titleText) && titleText) levels.push(titleText);
    }
  });

  // 2) Fallback / supplement: many league pages (e.g. BH Adult) are a big
  //    schedule grid with no standings table. Harvest every distinct team from
  //    its "display-schedule?team=N" links so the finder still lists real teams.
  $('a[href*="display-schedule?team="]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const teamId = href.match(/team=(\d+)/)?.[1];
    const name = clean($(a).text());
    if (teamId && name) upsert(teamId, { name });
  });

  const teams = order.map((id) => byId[id]).filter((t) => t.name || Object.keys(t).some((k) => !k.startsWith('_')));
  return { league, season, levels, teams };
}

// Parse the display-stats.php page into per-division standings, mirroring the
// site's own layout. The page is one big table where each division section is:
//   <tr><th>{Division} Schedule</th></tr>        (label; league-wide row too)
//   ...optional "Division Player Stats"/"Playoff Tree" label rows...
//   <tr><th></th><th>Team</th><th>GP</th>...      (standings header)
//   <tr><td>1</td><td><a team=..>Name</a></td>... (team rows)
// The most recent "... Schedule" label before a standings header names that
// division; the league-wide "ID Adult"/"BH Adult" row is overridden by the
// first real division label, so it never becomes a division.
export function parseDivisions($) {
  const divisions = [];
  let pendingLabel = null;   // last seen "... Schedule" label
  let current = null;        // division currently collecting team rows
  let headers = null;        // header cells of the current standings table

  $('table').first().find('tr').each((_, tr) => {
    const ths = $(tr).find('th');
    const tds = $(tr).find('td');

    // Section label row: a lone <th> ending in "Schedule".
    if (ths.length === 1 && tds.length === 0) {
      const txt = clean($(ths[0]).text());
      if (/schedule$/i.test(txt)) pendingLabel = txt.replace(/\s*schedule$/i, '').trim();
      return;
    }

    // Standings header row: <th> cells including Team + GP → starts a division.
    if (ths.length >= 3) {
      const cols = ths.map((_i, th) => clean($(th).text())).get();
      if (cols.includes('Team') && cols.includes('GP')) {
        headers = cols;                       // e.g. ['', 'Team', 'GP', 'W', ...]
        current = { name: pendingLabel || 'Division', columns: cols.slice(2), teams: [] };
        divisions.push(current);
      }
      return;
    }

    // Team row: <td> cells belonging to the current division.
    if (current && headers && tds.length >= 3) {
      const vals = tds.map((_i, td) => clean($(td).text())).get();
      const teamId = $(tds[1]).find('a').attr('href')?.match(/team=(\d+)/)?.[1]
        || $(tds[0]).find('a').attr('href')?.match(/team=(\d+)/)?.[1] || null;
      const name = vals[1];
      if (!name) return;
      const stats = {};
      headers.slice(2).forEach((h, i) => { stats[h] = vals[i + 2] ?? ''; });
      current.teams.push({ rank: vals[0], name, teamId, stats });
    }
  });

  return divisions;
}
