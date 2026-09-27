// Per-team brand + theme configuration.
//
// The app is a generic multi-team viewer. Every team renders with the neutral
// GENERIC_THEME by default. A team only becomes "branded" (custom colors, logo,
// display name) by adding an entry to TEAMS below — so branding one more team
// later is a single object, no component changes.

export interface TeamTheme {
  isBranded: boolean;
  headerClass: string;      // team-page header container
  subtitleClass: string;    // header subtitle text
  tabActiveClass: string;   // active tab border + text
  accentText: string;       // links / accent text
  chipClass: string;        // "Up Next" chip, badges
  ringClass: string;        // logo ring
}

export interface TeamBrand {
  slug: string;        // stable url-safe alias key (e.g. /hookers)
  name: string;        // display name shown in the UI ("theirs", not the scraped name)
  shortName: string;   // compact label
  tagline: string;     // header subtitle / meta description
  logo: string;        // path under /public
  teamId: string;      // timetoscore team id
  league: string;      // timetoscore league id
  season: string;      // timetoscore season id ('0' = current)
  theme: TeamTheme;
}

// Neutral theme used by every non-branded team and the landing page.
export const GENERIC_THEME: TeamTheme = {
  isBranded: false,
  headerClass: 'bg-gray-900 border-b border-gray-800',
  subtitleClass: 'text-gray-400',
  tabActiveClass: 'border-blue-500 text-blue-400',
  accentText: 'text-blue-400',
  chipClass: 'bg-blue-600 text-white',
  ringClass: 'ring-gray-700',
};

// Pompano Beach Hookers — the one branded team (navy / gold / columbia).
const HOOKERS_THEME: TeamTheme = {
  isBranded: true,
  headerClass: 'bg-brand-navy border-b-4 border-brand-gold',
  subtitleClass: 'text-brand-columbia',
  tabActiveClass: 'border-brand-gold text-brand-gold',
  accentText: 'text-brand-gold',
  chipClass: 'bg-brand-gold text-brand-navy',
  ringClass: 'ring-brand-gold/50',
};

// The league/season this viewer is built around. Used as the default when a
// team page is opened without explicit query params.
export const DEFAULT_LEAGUE = '4';
export const DEFAULT_SEASON = '0';

export const TEAMS: Record<string, TeamBrand> = {
  'pb-hookers': {
    slug: 'hookers',
    name: 'Pompano Beach Hookers',
    shortName: 'Hookers',
    tagline: 'Schedule, scores, and stats for the Pompano Beach Hookers.',
    logo: '/hookers-logo.png',
    teamId: '472',
    league: '4',
    season: '0',
    theme: HOOKERS_THEME,
  },
};

/** Branded teams, for the landing page's featured section. */
export const FEATURED_TEAMS = Object.values(TEAMS);

/** Look up a branded team by its timetoscore team id. */
export function getBrandByTeamId(teamId: string | undefined): TeamBrand | undefined {
  if (!teamId) return undefined;
  return Object.values(TEAMS).find((t) => t.teamId === teamId);
}

/** Look up a branded team by its friendly slug (e.g. "hookers"). */
export function getBrandBySlug(slug: string | undefined): TeamBrand | undefined {
  if (!slug) return undefined;
  return Object.values(TEAMS).find((t) => t.slug === slug);
}

/** Theme for a team — branded teams get their custom theme, everyone else generic. */
export function getTeamTheme(teamId: string | undefined): TeamTheme {
  return getBrandByTeamId(teamId)?.theme ?? GENERIC_THEME;
}
