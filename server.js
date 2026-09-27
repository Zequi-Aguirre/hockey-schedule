import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Respect X-Forwarded-Proto/Host from Render's proxy so og:url uses https.
app.set('trust proxy', true);
app.use(cors());

const ROOT = 'https://stats.panthers.timetoscore.com';

// ─── Social share (Open Graph) config ────────────────────────────────────────
// SPA scrapers (WhatsApp/iMessage/etc.) don't run JS, so per-route meta must be
// injected into index.html server-side. Keep this in sync with src/brand.ts.
const SITE_NAME = 'Hockey Schedule';
const OG_DEFAULTS = {
  league: '4',
  season: '0',
  image: '/og-default.jpg',
  imageW: 1200,
  imageH: 630,
  title: 'Hockey Schedule - Find Your Team',
  description:
    'Find your team’s next game, full schedule, scores, and stats — a clean, mobile-friendly view of the league.',
};
// Branded teams get bespoke copy + their own share image (keyed by team id).
const OG_BRANDED = {
  '472': {
    name: 'Pompano Beach Hookers',
    title: 'Pompano Beach Hookers - Schedule & Next Game',
    description: 'Next game, full schedule, and stats for the Pompano Beach Hookers.',
    image: '/hookers-og.jpg',
    imageW: 1200,
    imageH: 630,
  },
};
// Friendly slugs -> team id (mirrors the aliases in src/brand.ts).
const OG_SLUGS = { hookers: '472' };

function clean(text) {
  return (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// --- Schedule ---
app.get('/api/schedule', async (req, res) => {
  const { team, season = '17', league = '1', stat_class = '1' } = req.query;
  if (!team) return res.status(400).json({ error: 'team parameter is required' });
  try {
    const html = await fetchHtml(`${ROOT}/display-schedule?team=${team}&season=${season}&league=${league}&stat_class=${stat_class}`);
    const $ = cheerio.load(html);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(parseSchedule($));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// --- Game detail ---
app.get('/api/game', async (req, res) => {
  const { game_id } = req.query;
  if (!game_id) return res.status(400).json({ error: 'game_id required' });
  try {
    const html = await fetchHtml(`${ROOT}/oss-scoresheet?game_id=${game_id}&mode=display`);
    const $ = cheerio.load(html);
    res.setHeader('Cache-Control', 'no-cache');
    return res.json(parseGame($, game_id));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// --- Player detail ---
app.get('/api/player', async (req, res) => {
  const { player_id } = req.query;
  if (!player_id) return res.status(400).json({ error: 'player_id required' });
  try {
    const html = await fetchHtml(`${ROOT}/display-player-stats.php?player=${player_id}`);
    const $ = cheerio.load(html);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(parsePlayer($));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// --- League teams ---
app.get('/api/league', async (req, res) => {
  const { league = '1', season = '0' } = req.query;
  try {
    const html = await fetchHtml(`${ROOT}/display-stats.php?league=${league}&season=${season}`);
    const $ = cheerio.load(html);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(parseLeague($, league, season));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// Serve React build in production, injecting per-route social meta into the HTML.
if (process.env.NODE_ENV === 'production') {
  // index:false so "/" falls through to the meta-injecting handler below.
  app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

  const templatePath = path.join(__dirname, 'dist', 'index.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  app.get('*splat', async (req, res) => {
    try {
      const meta = await buildMeta(req);
      const html = injectMeta(template, meta);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(html);
    } catch {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(template);
    }
  });
}

// ─── Social meta helpers ─────────────────────────────────────────────────────

function baseUrl(req) {
  const host = req.get('host') || 'hockey-schedule.onrender.com';
  const proto = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

const nameCache = new Map(); // `${teamId}:${league}:${season}` -> { name, exp }

async function resolveTeamName(teamId, league, season) {
  const key = `${teamId}:${league}:${season}`;
  const hit = nameCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.name;
  try {
    const url = `${ROOT}/display-schedule?team=${teamId}&season=${season}&league=${league}&stat_class=1`;
    // Cap the wait so a slow upstream never hangs page render.
    const html = await Promise.race([
      fetchHtml(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    const { teamName } = parseSchedule(cheerio.load(html));
    const name = teamName || null;
    nameCache.set(key, { name, exp: Date.now() + 3600_000 });
    return name;
  } catch {
    return null;
  }
}

async function buildMeta(req) {
  const base = baseUrl(req);
  const url = base + req.originalUrl;

  let title = OG_DEFAULTS.title;
  let description = OG_DEFAULTS.description;
  let image = OG_DEFAULTS.image;
  let imageW = OG_DEFAULTS.imageW;
  let imageH = OG_DEFAULTS.imageH;

  // First path segment: a slug (e.g. "hookers") or a numeric team id.
  const segs = req.path.split('/').filter(Boolean);
  let teamId = null;
  if (segs.length >= 1) {
    const first = segs[0];
    if (OG_SLUGS[first]) teamId = OG_SLUGS[first];
    else if (/^\d+$/.test(first)) teamId = first;
  }

  if (teamId) {
    const branded = OG_BRANDED[teamId];
    if (branded) {
      title = branded.title;
      description = branded.description;
      image = branded.image;
      imageW = branded.imageW;
      imageH = branded.imageH;
    } else {
      const league = req.query.league || OG_DEFAULTS.league;
      const season = req.query.season || OG_DEFAULTS.season;
      const name = (await resolveTeamName(teamId, league, season)) || `Team ${teamId}`;
      title = `${name} - Schedule & Next Game`;
      description = `Next game, full schedule, and stats for ${name}.`;
    }
  }

  return { title, description, image: base + image, imageW, imageH, url };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metaTags(m) {
  const t = escapeHtml(m.title);
  const d = escapeHtml(m.description);
  const img = escapeHtml(m.image);
  const url = escapeHtml(m.url);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:width" content="${m.imageW}" />`,
    `<meta property="og:image:height" content="${m.imageH}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].map((tag) => `    ${tag}`).join('\n');
}

// Strip the build's static title/description/og/twitter tags, inject per-route ones.
function injectMeta(html, meta) {
  const out = html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');
  return out.replace('</head>', `${metaTags(meta)}\n  </head>`);
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseSchedule($) {
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

function parseGame($, gameId) {
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

function parsePlayer($) {
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

function parseLeague($, league, season) {
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
