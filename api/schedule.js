import * as cheerio from 'cheerio';

const BASE_URL = 'https://stats.panthers.timetoscore.com/display-schedule';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { team, season = '17', league = '1', stat_class = '1' } = req.query;

  if (!team) {
    return res.status(400).json({ error: 'team parameter is required' });
  }

  const url = `${BASE_URL}?team=${team}&season=${season}&league=${league}&stat_class=${stat_class}`;

  let html;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch schedule from source' });
    }
    html = await response.text();
  } catch (err) {
    return res.status(502).json({ error: 'Network error fetching schedule' });
  }

  const $ = cheerio.load(html);
  const data = parseSchedule($);

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.status(200).json(data);
}

function parseSchedule($) {
  const tables = $('table');

  const teamName = $('h1, h2, h3').first().text().trim() ||
    $('td b').first().text().trim() || '';

  const games = [];
  const players = [];
  const goalies = [];
  const teamStats = {};

  tables.each((tableIndex, table) => {
    const headers = [];
    $(table).find('tr').first().find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim());
    });

    const headerText = headers.join(' ').toLowerCase();

    if (headerText.includes('game') && headerText.includes('date') && headerText.includes('rink')) {
      // Schedule table
      $(table).find('tr').slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 6) return;

        const gameData = {
          gameNumber: $(cells[0]).text().trim(),
          date: $(cells[1]).text().trim(),
          time: $(cells[2]).text().trim(),
          rink: $(cells[3]).text().trim(),
          league: $(cells[4]).text().trim(),
          level: $(cells[5]).text().trim(),
          awayTeam: $(cells[6]).text().trim(),
          awayGoals: $(cells[7]).text().trim(),
          homeTeam: $(cells[8]).text().trim(),
          homeGoals: $(cells[9]).text().trim(),
          type: $(cells[10])?.text().trim() || '',
          scoresheetUrl: $(cells[11]).find('a').attr('href') || null,
        };

        if (gameData.date) games.push(gameData);
      });
    } else if (headerText.includes('gp') && headerText.includes('goals') && headerText.includes('pts') && !headerText.includes('save')) {
      // Player stats table
      $(table).find('tr').slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        const playerData = {};
        headers.forEach((header, i) => {
          playerData[header] = $(cells[i])?.text().trim() || '';
        });

        if (playerData['Name'] || playerData['name']) players.push(playerData);
      });
    } else if (headerText.includes('save') || headerText.includes('gaa') || headerText.includes('goalie')) {
      // Goalie stats table
      $(table).find('tr').slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;

        const goalieData = {};
        headers.forEach((header, i) => {
          goalieData[header] = $(cells[i])?.text().trim() || '';
        });

        if (goalieData['Name'] || goalieData['name']) goalies.push(goalieData);
      });
    } else if (headerText.includes('power play') || headerText.includes('pp') || headerText.includes('pk')) {
      // Team stats table
      $(table).find('tr').slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();
        if (label) teamStats[label] = value;
      });
    }
  });

  // Extract team name from schedule if not found
  const derivedTeamName = teamName ||
    games.find(g => g.awayGoals || g.homeGoals)?.homeTeam ||
    games[0]?.homeTeam || 'Team';

  return { teamName: derivedTeamName, games, players, goalies, teamStats };
}
