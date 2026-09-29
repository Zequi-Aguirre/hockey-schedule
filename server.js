import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ROOT,
  fetchHtml,
  parseSchedule,
  parseGame,
  parsePlayer,
  parseLeague,
  parseDivisions,
} from './api/scraper.js';
import { registerMcpEndpoint } from './api/mcp.js';

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Respect X-Forwarded-Proto/Host from Render's proxy so og:url uses https.
app.set('trust proxy', true);
app.use(cors());

// Public, no-auth MCP server (Streamable HTTP) at /mcp — must be mounted before
// the SPA catch-all so it isn't swallowed by the static/HTML handler.
registerMcpEndpoint(app);

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
    image: '/og/hookers-card.jpg',
    imageW: 1200,
    imageH: 630,
  },
};
// Friendly slugs -> team id (mirrors the aliases in src/brand.ts).
const OG_SLUGS = { hookers: '472' };

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
    const data = parseLeague($, league, season);
    data.divisions = parseDivisions($);
    return res.json(data);
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
