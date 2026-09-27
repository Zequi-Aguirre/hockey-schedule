import { useEffect, useState } from 'react';

export interface Game {
  gameId: string;
  gameNumber: string;
  date: string;
  time: string;
  rink: string;
  league: string;
  level: string;
  awayTeam: string;
  awayGoals: string;
  homeTeam: string;
  homeGoals: string;
  type: string;
  scoresheetUrl: string | null;
  hasScoresheet: boolean;
}

export interface ScheduleData {
  teamName: string;
  games: Game[];
  players: Record<string, string>[];
  goalies: Record<string, string>[];
  teamStats: Record<string, string>;
}

/** Shared team-schedule fetch used by both the team home and the /schedule view. */
export function useSchedule(teamId: string | undefined, season: string, league: string) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/schedule?team=${teamId}&season=${season}&league=${league}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [teamId, season, league]);

  return { data, loading, error };
}

/** Team win/loss/tie record from its played games. */
export function computeRecord(games: Game[], teamName: string) {
  const played = games.filter((g) => g.awayGoals !== '' && g.homeGoals !== '');
  let wins = 0, losses = 0, ties = 0;
  for (const g of played) {
    const isHome = g.homeTeam === teamName;
    const ours = parseInt(isHome ? g.homeGoals : g.awayGoals) || 0;
    const theirs = parseInt(isHome ? g.awayGoals : g.homeGoals) || 0;
    if (ours > theirs) wins++;
    else if (ours < theirs) losses++;
    else ties++;
  }
  return { played: played.length, wins, losses, ties };
}

/** First not-yet-played game (upcoming games are in schedule order). */
export function nextUpcoming(games: Game[]): Game | undefined {
  return games.find((g) => !g.awayGoals && !g.homeGoals);
}

/**
 * Friendly relative day label for a scraped date like "Sun Sep 27".
 * Returns "Today" / "Tomorrow" when it matches, otherwise the original string.
 */
export function relativeDay(dateStr: string): string {
  const m = dateStr.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  if (!m) return dateStr;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const mon = months.indexOf(m[1].toLowerCase().slice(0, 3));
  const day = parseInt(m[2], 10);
  if (mon < 0 || !day) return dateStr;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Assume current year; if that lands >6 months in the past, roll to next year.
  let target = new Date(now.getFullYear(), mon, day);
  if ((today.getTime() - target.getTime()) / 86400000 > 180) {
    target = new Date(now.getFullYear() + 1, mon, day);
  }
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return dateStr;
}
