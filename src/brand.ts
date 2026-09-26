// Per-team brand configuration.
//
// The app is white-labeled per team. Add a new team by dropping another entry
// into TEAMS below (with its timetoscore team id / league / season) and, if you
// want it to be the landing page, point DEFAULT_TEAM_SLUG at it.

export interface TeamBrand {
  slug: string;        // stable url-safe key
  name: string;        // display name shown in the UI ("theirs", not the scraped name)
  shortName: string;   // compact label
  tagline: string;     // header subtitle / meta description
  logo: string;        // path under /public
  teamId: string;      // timetoscore team id
  league: string;      // timetoscore league id
  season: string;      // timetoscore season id ('0' = current)
}

export const TEAMS: Record<string, TeamBrand> = {
  'pb-hookers': {
    slug: 'pb-hookers',
    name: 'Pompano Beach Hookers',
    shortName: 'Hookers',
    tagline: 'Schedule, scores, and stats for the Pompano Beach Hookers.',
    logo: '/hookers-logo.png',
    teamId: '472',
    league: '4',
    season: '0',
  },
};

export const DEFAULT_TEAM_SLUG = 'pb-hookers';
export const DEFAULT_TEAM = TEAMS[DEFAULT_TEAM_SLUG];

/** Look up a team brand by its timetoscore team id (used to brand the team page). */
export function getBrandByTeamId(teamId: string | undefined): TeamBrand | undefined {
  if (!teamId) return undefined;
  return Object.values(TEAMS).find((t) => t.teamId === teamId);
}
